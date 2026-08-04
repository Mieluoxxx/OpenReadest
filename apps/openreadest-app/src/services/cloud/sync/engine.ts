import { v4 as uuidv4 } from 'uuid';
import { AppService } from '@/types/system';
import { Book } from '@/types/book';
import { computeLocalFingerprint, isJsonPath } from '@/services/webdav/sync/fingerprint';
import {
  CloudConflictItem,
  CloudProfile,
  CloudSyncLogItem,
  CloudSyncProgress,
  CloudSyncResult,
} from '../models';
import {
  getLocalBookPaths,
  getLocalLibraryPath,
  getRemoteBookKeys,
  getRemoteLibraryKey,
  getRemoteSyncStateKey,
} from '../paths';
import { getRemoteStorageErrorMessage, RemoteStorageError } from '../remote/errors';
import { RemoteObjectMetadata, RemoteObjectStore } from '../remote/types';
import {
  CloudSyncStateEntry,
  CloudSyncStateFileFingerprint,
  CloudSyncStateRemoteFingerprint,
  CloudSyncStateV1,
  createEmptyCloudSyncState,
  mergeCloudSyncStates,
  parseRemoteCloudSyncState,
  readLocalCloudSyncState,
  writeLocalCloudSyncState,
} from '../state';

export type CloudSyncCallbacks = {
  onProgress?: (progress: CloudSyncProgress) => void;
  onLog?: (log: CloudSyncLogItem) => void;
};

export type CloudSyncControl = {
  shouldPause?: () => boolean;
  waitUntilResumed?: () => Promise<void>;
  shouldCancel?: () => boolean;
};

export type CloudSyncOptions = {
  books: Book[];
  includeBookFiles?: boolean;
  includeConfig?: boolean;
  includeCovers?: boolean;
  includeLibrary?: boolean;
  dryRun?: boolean;
};

const areLocalFingerprintsEqual = (
  left?: CloudSyncStateFileFingerprint,
  right?: CloudSyncStateFileFingerprint,
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.md5 && right.md5) return left.md5 === right.md5;
  return typeof left.size === 'number' && left.size === right.size;
};

const areRemoteFingerprintsEqual = (
  left?: CloudSyncStateRemoteFingerprint,
  right?: CloudSyncStateRemoteFingerprint,
) => {
  if (!left && !right) return true;
  if (!left || !right) return false;
  if (left.etag && right.etag) return left.etag === right.etag;
  if (left.lastModified && right.lastModified) return left.lastModified === right.lastModified;
  return typeof left.size === 'number' && left.size === right.size;
};

const toRemoteFingerprint = (
  metadata: RemoteObjectMetadata | null,
): CloudSyncStateRemoteFingerprint | undefined => {
  if (!metadata) return undefined;
  return {
    etag: metadata.etag,
    lastModified: metadata.lastModified,
    size: metadata.size,
  };
};

const parseTimestamp = (value?: string): number | undefined => {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
};

const pickNewestSide = (conflict: CloudConflictItem): 'local' | 'remote' => {
  const localAt = conflict.local?.observedAt;
  const remoteAt = parseTimestamp(conflict.remote?.lastModified);
  if (typeof localAt !== 'number' && typeof remoteAt !== 'number') return 'local';
  if (typeof localAt !== 'number') return 'remote';
  if (typeof remoteAt !== 'number') return 'local';
  return localAt >= remoteAt ? 'local' : 'remote';
};

const readRemoteState = async (store: RemoteObjectStore): Promise<CloudSyncStateV1> => {
  const key = getRemoteSyncStateKey();
  if (!(await store.stat(key))) return createEmptyCloudSyncState();
  return parseRemoteCloudSyncState(await store.read(key));
};

const writeRemoteState = async (store: RemoteObjectStore, state: CloudSyncStateV1) => {
  await store.write(getRemoteSyncStateKey(), new TextEncoder().encode(JSON.stringify(state)), {
    contentType: 'application/json; charset=utf-8',
  });
};

const readLocalBytes = async (appService: AppService, path: string): Promise<Uint8Array> => {
  const data = (await appService.readFile(
    path,
    'Books',
    isJsonPath(path) ? 'text' : 'binary',
  )) as string | ArrayBuffer;
  return typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
};

const writeLocalBytes = async (appService: AppService, path: string, data: Uint8Array) => {
  const dirPath = path.split('/').slice(0, -1).join('/');
  if (dirPath) await appService.createDir(dirPath, 'Books', true).catch(() => {});
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  await appService.writeFile(path, 'Books', buffer);
};

const getErrorDetails = (error: unknown) => {
  if (!(error instanceof RemoteStorageError)) return {};
  return {
    provider: error.provider,
    statusCode: error.statusCode,
    requestId: error.requestId,
  };
};

export const syncCloudSelection = async (
  appService: AppService,
  profile: CloudProfile,
  store: RemoteObjectStore,
  options: CloudSyncOptions,
  callbacks?: CloudSyncCallbacks,
  control?: CloudSyncControl,
): Promise<CloudSyncResult> => {
  const localState = await readLocalCloudSyncState(appService, profile.id);
  const remoteState = await readRemoteState(store);
  const state = mergeCloudSyncStates(localState, remoteState);

  const items: Array<{ key: string; localPath: string }> = [];
  if (options.includeLibrary ?? true) {
    items.push({ key: getRemoteLibraryKey(), localPath: getLocalLibraryPath() });
  }
  for (const book of options.books) {
    const local = getLocalBookPaths(book);
    const remote = getRemoteBookKeys(book);
    if (options.includeBookFiles ?? true) {
      items.push({ key: remote.bookFile, localPath: local.bookFile });
    }
    if (options.includeCovers ?? true) {
      items.push({ key: remote.coverFile, localPath: local.coverFile });
    }
    if (options.includeConfig ?? true) {
      items.push({ key: remote.configFile, localPath: local.configFile });
    }
  }

  const progress: CloudSyncProgress = { totalItems: items.length, completedItems: 0 };
  callbacks?.onProgress?.({ ...progress });

  let completedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;
  const conflicts: CloudConflictItem[] = [];

  const log = (
    direction: 'upload' | 'download',
    path: string,
    status: CloudSyncLogItem['status'],
    message?: string,
    error?: unknown,
  ) => {
    callbacks?.onLog?.({
      id: uuidv4(),
      timestamp: Date.now(),
      direction,
      path,
      status,
      message,
      provider: profile.provider,
      ...getErrorDetails(error),
    });
  };

  for (const item of items) {
    while (control?.shouldPause?.() && control.waitUntilResumed) {
      await control.waitUntilResumed();
    }
    if (control?.shouldCancel?.()) break;

    progress.currentPath = item.key;
    progress.currentDirection = undefined;
    callbacks?.onProgress?.({ ...progress });

    const baseEntry = state.entries[item.key];
    const localFingerprint = await computeLocalFingerprint(appService, item.localPath, 'Books');
    let remoteMetadata: RemoteObjectMetadata | null;
    try {
      remoteMetadata = await store.stat(item.key);
    } catch (error) {
      failedCount += 1;
      log('download', item.key, 'failed', getRemoteStorageErrorMessage(error), error);
      progress.completedItems += 1;
      callbacks?.onProgress?.({ ...progress });
      continue;
    }

    const remoteFingerprint = toRemoteFingerprint(remoteMetadata);
    const localExists = !!localFingerprint;
    const remoteExists = !!remoteMetadata;
    const localChanged = localExists && !areLocalFingerprintsEqual(localFingerprint, baseEntry?.local);
    const remoteChanged = remoteExists && !areRemoteFingerprintsEqual(remoteFingerprint, baseEntry?.remote);

    let direction: 'upload' | 'download' | null = null;
    if (localExists && !remoteExists) direction = 'upload';
    else if (!localExists && remoteExists) direction = 'download';
    else if (localChanged && remoteChanged) {
      const conflict: CloudConflictItem = {
        path: item.key,
        local: localFingerprint ?? undefined,
        remote: remoteFingerprint,
      };
      if (profile.conflictStrategy === 'manual') {
        conflicts.push(conflict);
        log('download', item.key, 'conflict', '检测到冲突');
      } else {
        direction =
          profile.conflictStrategy === 'local'
            ? 'upload'
            : profile.conflictStrategy === 'remote'
              ? 'download'
              : pickNewestSide(conflict) === 'local'
                ? 'upload'
                : 'download';
      }
    } else if (localChanged) direction = 'upload';
    else if (remoteChanged) direction = 'download';

    if (localChanged && remoteChanged && profile.conflictStrategy === 'manual') {
      progress.completedItems += 1;
      callbacks?.onProgress?.({ ...progress });
      continue;
    }

    if (!direction) {
      skippedCount += 1;
      log('upload', item.key, 'skipped', localExists || remoteExists ? '无需同步' : '文件不存在');
      progress.completedItems += 1;
      callbacks?.onProgress?.({ ...progress });
      continue;
    }

    progress.currentDirection = direction;
    callbacks?.onProgress?.({ ...progress });

    if (options.dryRun) {
      skippedCount += 1;
      log(direction, item.key, 'skipped', '模拟执行');
      progress.completedItems += 1;
      callbacks?.onProgress?.({ ...progress });
      continue;
    }

    try {
      if (direction === 'upload') {
        const data = await readLocalBytes(appService, item.localPath);
        await store.write(item.key, data, {
          contentType: isJsonPath(item.localPath)
            ? 'application/json; charset=utf-8'
            : undefined,
        });
      } else {
        await writeLocalBytes(appService, item.localPath, await store.read(item.key));
      }

      const nextLocal = await computeLocalFingerprint(appService, item.localPath, 'Books');
      const nextRemote = toRemoteFingerprint(await store.stat(item.key));
      if (!nextLocal || !nextRemote) throw new Error('同步后无法确认文件状态');

      const updatedAt = Date.now();
      const entry: CloudSyncStateEntry = {
        updatedAt,
        local: nextLocal,
        remote: nextRemote,
      };
      state.entries[item.key] = entry;
      state.updatedAt = Math.max(state.updatedAt, updatedAt);
      completedCount += 1;
      log(direction, item.key, 'completed');
    } catch (error) {
      failedCount += 1;
      log(direction, item.key, 'failed', getRemoteStorageErrorMessage(error), error);
    }

    progress.completedItems += 1;
    callbacks?.onProgress?.({ ...progress });
  }

  let stateWritten = !!options.dryRun;
  if (!options.dryRun) {
    try {
      await writeLocalCloudSyncState(appService, profile.id, state);
      await writeRemoteState(store, state);
      stateWritten = true;
    } catch (error) {
      failedCount += 1;
      log('upload', getRemoteSyncStateKey(), 'failed', getRemoteStorageErrorMessage(error), error);
    }
  }

  return {
    completedCount,
    failedCount,
    skippedCount,
    conflictCount: conflicts.length,
    conflicts,
    stateWritten,
  };
};


import { AppService } from '@/types/system';
import { getLocalSyncStatePath } from './paths';

export interface CloudSyncStateFileFingerprint {
  size?: number;
  md5?: string;
  observedAt?: number;
}

export interface CloudSyncStateRemoteFingerprint {
  etag?: string;
  lastModified?: string;
  size?: number;
}

export interface CloudSyncStateEntry {
  updatedAt: number;
  local?: CloudSyncStateFileFingerprint;
  remote?: CloudSyncStateRemoteFingerprint;
}

export interface CloudSyncStateV1 {
  version: 1;
  updatedAt: number;
  entries: Record<string, CloudSyncStateEntry>;
}

export const createEmptyCloudSyncState = (): CloudSyncStateV1 => ({
  version: 1,
  updatedAt: Date.now(),
  entries: {},
});

const parseCloudSyncState = (text: string): CloudSyncStateV1 | null => {
  try {
    const state = JSON.parse(text) as CloudSyncStateV1;
    if (state.version !== 1 || !state.entries || typeof state.entries !== 'object') return null;
    return state;
  } catch {
    return null;
  }
};

export const readLocalCloudSyncState = async (
  appService: AppService,
  profileId: string,
): Promise<CloudSyncStateV1> => {
  const path = getLocalSyncStatePath(profileId);
  const exists = await appService.exists(path, 'Settings').catch(() => false);
  if (!exists) return createEmptyCloudSyncState();
  const text = (await appService.readFile(path, 'Settings', 'text')) as string;
  return parseCloudSyncState(text) ?? createEmptyCloudSyncState();
};

export const writeLocalCloudSyncState = async (
  appService: AppService,
  profileId: string,
  state: CloudSyncStateV1,
): Promise<void> => {
  const path = getLocalSyncStatePath(profileId);
  const dirPath = path.split('/').slice(0, -1).join('/');
  await appService.createDir(dirPath, 'Settings', true).catch(() => {});
  await appService.writeFile(path, 'Settings', JSON.stringify(state));
};

export const parseRemoteCloudSyncState = (data: Uint8Array): CloudSyncStateV1 => {
  return parseCloudSyncState(new TextDecoder().decode(data)) ?? createEmptyCloudSyncState();
};

export const mergeCloudSyncStates = (
  local: CloudSyncStateV1,
  remote: CloudSyncStateV1,
): CloudSyncStateV1 => {
  const keys = new Set([...Object.keys(local.entries), ...Object.keys(remote.entries)]);
  const entries: Record<string, CloudSyncStateEntry> = {};
  for (const key of keys) {
    const localEntry = local.entries[key];
    const remoteEntry = remote.entries[key];
    if (!localEntry) entries[key] = remoteEntry!;
    else if (!remoteEntry) entries[key] = localEntry;
    else entries[key] = localEntry.updatedAt >= remoteEntry.updatedAt ? localEntry : remoteEntry;
  }
  return {
    version: 1,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    entries,
  };
};


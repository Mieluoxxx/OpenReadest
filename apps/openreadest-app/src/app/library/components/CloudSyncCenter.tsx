'use client';

import clsx from 'clsx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  MdAdd,
  MdClose,
  MdCloudDownload,
  MdCloudUpload,
  MdPause,
  MdPlayArrow,
} from 'react-icons/md';
import Dialog from '@/components/Dialog';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useLibraryStore } from '@/store/libraryStore';
import {
  loadCloudSyncStoreFromStorage,
  useCloudSyncStore,
} from '@/store/cloudSyncStore';
import {
  CloudLibraryService,
  CloudProfile,
  CloudProvider,
  RemoteBookSummary,
  createRemoteObjectStore,
  getRemoteStorageErrorMessage,
  normalizeObjectKey,
  syncCloudSelection,
  validateCloudProfileName,
} from '@/services/cloud';
import { getUniqueCloudProfileName } from '@/services/cloud/profileName';
import { RemoteStorageError } from '@/services/cloud/remote/errors';
import { RemoteObjectStore } from '@/services/cloud/remote/types';
import { Book } from '@/types/book';
import { eventDispatcher } from '@/utils/event';
import CloudProfileForm from './CloudProfileForm';

const CLOUD_SYNC_DIALOG_ID = 'cloud_sync_center';

export const setCloudSyncCenterVisible = (
  visible: boolean,
  provider: CloudProvider = 'webdav',
) => {
  const dialog = document.getElementById(CLOUD_SYNC_DIALOG_ID);
  dialog?.dispatchEvent(
    new CustomEvent('setDialogVisibility', { detail: { visible, provider } }),
  );
};

const createDefaultProfile = (provider: CloudProvider, existingNames: string[]): CloudProfile => {
  const common = {
    id: uuidv4(),
    name: getUniqueCloudProfileName(provider, existingNames),
    conflictStrategy: 'manual' as const,
  };
  if (provider === 's3') {
    return {
      ...common,
      provider: 's3',
      config: {
        endpoint: '',
        region: '',
        accessKeyId: '',
        secretAccessKey: '',
        bucketName: '',
        remotePrefix: '',
      },
    };
  }
  return {
    ...common,
    provider: 'webdav',
    config: {
      serverUrl: '',
      remotePath: '',
      username: '',
      password: '',
      allowInsecureHttp: false,
      allowInsecureTls: false,
    },
  };
};

const formatDateTime = (timestamp: number) => new Date(timestamp).toLocaleString();

const isProfileReady = (profile: CloudProfile) => {
  if (profile.provider === 'webdav') {
    return !!profile.config.serverUrl && !!profile.config.username;
  }
  return !!(
    profile.config.endpoint &&
    profile.config.region &&
    profile.config.accessKeyId &&
    profile.config.secretAccessKey &&
    profile.config.bucketName
  );
};

const getProfileAddress = (profile: CloudProfile) => {
  const address = profile.provider === 's3' ? profile.config.endpoint : profile.config.serverUrl;
  try {
    const url = new URL(address);
    const port = url.port ? `:${url.port}` : '';
    const prefix = profile.provider === 's3' ? `${profile.config.bucketName} · ` : '';
    return `${prefix}${url.hostname}${port}`;
  } catch {
    return address.replace(/^https?:\/\//i, '').split('/')[0] || address;
  }
};

type CloudSyncCenterProps = {
  embedded?: boolean;
  provider?: CloudProvider;
};

export const CloudSyncCenter = ({ embedded = false, provider }: CloudSyncCenterProps) => {
  const _ = useTranslation();
  const { appService, envConfig } = useEnv();
  const getVisibleLibrary = useLibraryStore((state) => state.getVisibleLibrary);
  const updateBooks = useLibraryStore((state) => state.updateBooks);
  const library = getVisibleLibrary();

  const {
    profiles,
    activeProfileId,
    isSyncing,
    isPaused,
    progress,
    lastSuccessAt,
    logs,
    activeTab,
    centerProvider,
    setCloudSyncCenterOpen,
    setCenterProvider,
    setActiveTab,
    restore,
    setActiveProfileId,
    upsertProfile,
    deleteProfile,
    setSyncing,
    setPaused,
    setProgress,
    setLastSuccessAt,
    addLog,
    clearLogs,
    autoSyncEnabled,
    autoSyncIntervalMinutes,
    setAutoSyncEnabled,
    setAutoSyncIntervalMinutes,
  } = useCloudSyncStore();

  const selectedProvider = provider ?? centerProvider;
  const [isOpen, setIsOpen] = useState(embedded);
  const [editing, setEditing] = useState<CloudProfile>(() =>
    createDefaultProfile(selectedProvider, []),
  );
  const [selectedUploadHashes, setSelectedUploadHashes] = useState<Set<string>>(new Set());
  const [selectedDownloadHashes, setSelectedDownloadHashes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteBooks, setRemoteBooks] = useState<RemoteBookSummary[]>([]);
  const [remoteCountInfo, setRemoteCountInfo] = useState<{
    prefixCount: number;
    libraryCount: number;
  } | null>(null);
  const resumeResolverRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef(false);

  const visible = embedded || isOpen;
  const providerProfiles = useMemo(
    () => profiles.filter((profileItem) => profileItem.provider === selectedProvider),
    [profiles, selectedProvider],
  );
  const selectedProfile = useMemo(
    () => providerProfiles.find((profileItem) => profileItem.id === editing.id) ?? null,
    [editing.id, providerProfiles],
  );

  useEffect(() => {
    if (embedded) return;
    const handleVisibility = (event: Event) => {
      const detail = (event as CustomEvent<{ visible: boolean; provider?: CloudProvider }>).detail;
      if (detail.provider) setCenterProvider(detail.provider);
      setIsOpen(detail.visible);
      setCloudSyncCenterOpen(detail.visible, detail.provider);
    };
    const element = document.getElementById(CLOUD_SYNC_DIALOG_ID);
    element?.addEventListener('setDialogVisibility', handleVisibility);
    return () => element?.removeEventListener('setDialogVisibility', handleVisibility);
  }, [embedded, setCenterProvider, setCloudSyncCenterOpen]);

  useEffect(() => {
    if (!visible) return;
    restore(loadCloudSyncStoreFromStorage());
  }, [restore, visible]);

  useEffect(() => {
    if (!visible) return;
    const active = providerProfiles.find((item) => item.id === activeProfileId) ?? providerProfiles[0];
    setEditing(active ?? createDefaultProfile(selectedProvider, profiles.map((item) => item.name)));
    setRemoteBooks([]);
    setRemoteCountInfo(null);
  }, [activeProfileId, profiles, providerProfiles, selectedProvider, visible]);

  useEffect(() => {
    if (!isPaused && resumeResolverRef.current) {
      resumeResolverRef.current();
      resumeResolverRef.current = null;
    }
  }, [isPaused]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredLocalBooks = useMemo(() => {
    if (!normalizedQuery) return library;
    return library.filter((book) =>
      `${book.title} ${book.sourceTitle || ''} ${book.author || ''} ${book.format} ${book.hash}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [library, normalizedQuery]);
  const filteredRemoteBooks = useMemo(() => {
    if (!normalizedQuery) return remoteBooks;
    return remoteBooks.filter((book) =>
      `${book.title} ${book.sourceTitle || ''} ${book.format || ''} ${book.hash}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, remoteBooks]);

  const showToast = (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
  ) => eventDispatcher.dispatch('toast', { message, type });

  const buildValidatedProfile = () => {
    const idToName = Object.fromEntries(profiles.map((profileItem) => [profileItem.id, profileItem.name]));
    const check = validateCloudProfileName(
      editing.name,
      profiles.map((profileItem) => profileItem.name),
      selectedProfile?.id ?? null,
      idToName,
    );
    if (!check.ok) {
      showToast(_(check.error), 'error');
      return null;
    }
    if (editing.provider === 's3') {
      return {
        ...editing,
        name: check.name,
        config: {
          ...editing.config,
          endpoint: editing.config.endpoint.trim().replace(/\/+$/, ''),
          region: editing.config.region.trim(),
          accessKeyId: editing.config.accessKeyId.trim(),
          bucketName: editing.config.bucketName.trim(),
          remotePrefix: normalizeObjectKey(editing.config.remotePrefix),
        },
      };
    }
    return {
      ...editing,
      name: check.name,
      config: {
        ...editing.config,
        serverUrl: editing.config.serverUrl.trim().replace(/\/+$/, ''),
        remotePath: editing.config.remotePath.trim(),
        username: editing.config.username.trim(),
      },
    };
  };

  const confirmInsecureS3 = (profileItem: CloudProfile) => {
    if (profileItem.provider !== 's3' || !profileItem.config.endpoint.startsWith('http://')) {
      return true;
    }
    return window.confirm(_('HTTP 连接不会加密对象内容，仍要继续吗？'));
  };

  const saveProfile = () => {
    const profileItem = buildValidatedProfile();
    if (!profileItem || !confirmInsecureS3(profileItem)) return;
    upsertProfile(profileItem);
    setEditing(profileItem);
    showToast(_('配置已保存'), 'success');
  };

  const removeProfile = () => {
    if (!selectedProfile) return;
    deleteProfile(selectedProfile.id);
    showToast(_('配置已删除'), 'success');
  };

  const addErrorLog = (path: string, error: unknown, direction: 'upload' | 'download') => {
    const remoteError = error instanceof RemoteStorageError ? error : null;
    addLog({
      id: uuidv4(),
      timestamp: Date.now(),
      direction,
      path,
      status: 'failed',
      message: getRemoteStorageErrorMessage(error),
      provider: editing.provider,
      statusCode: remoteError?.statusCode,
      requestId: remoteError?.requestId,
    });
  };

  const loadRemoteBooks = async (
    profileOverride?: CloudProfile,
    storeOverride?: RemoteObjectStore,
  ) => {
    const profileItem = profileOverride ?? editing;
    if (!isProfileReady(profileItem)) {
      setRemoteBooks([]);
      setRemoteCountInfo(null);
      return;
    }
    try {
      const store = storeOverride ?? (await createRemoteObjectStore(profileItem));
      const result = await new CloudLibraryService(store).listRemoteBooks();
      setRemoteBooks(result.books);
      setRemoteCountInfo({
        prefixCount: result.prefixCount,
        libraryCount: result.libraryCount,
      });
    } catch (error) {
      setRemoteBooks([]);
      setRemoteCountInfo(null);
      addErrorLog('OpenReadest/Books/', error, 'download');
    }
  };

  const testConnection = async () => {
    const profileItem = buildValidatedProfile();
    if (!profileItem || !confirmInsecureS3(profileItem)) return;
    try {
      const store = await createRemoteObjectStore(profileItem);
      const result = await store.testAccess();
      const connectedProfile =
        profileItem.provider === 's3' && result.addressingStyle
          ? {
              ...profileItem,
              config: { ...profileItem.config, addressingStyle: result.addressingStyle },
            }
          : profileItem;
      upsertProfile(connectedProfile);
      setEditing(connectedProfile);
      showToast(_('连接成功'), 'success');
      await loadRemoteBooks(connectedProfile, store);
    } catch (error) {
      addErrorLog('连接测试', error, 'download');
      showToast(_(getRemoteStorageErrorMessage(error)), 'error');
    }
  };

  useEffect(() => {
    if (!visible || activeTab !== 'download' || !selectedProfile) return;
    void loadRemoteBooks(selectedProfile);
    // Loading is intentionally tied to profile selection, not every credential keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedProfile?.id, visible]);

  const addDownloadedBooksToShelf = async (books: Book[]) => {
    if (!envConfig || books.length === 0) return;
    await updateBooks(envConfig, books);
  };

  const startSync = async (mode: 'upload' | 'download') => {
    if (!appService) return;
    const profileItem = buildValidatedProfile();
    if (!profileItem) return;
    upsertProfile(profileItem);
    setEditing(profileItem);
    cancelRef.current = false;
    setSyncing(true);
    setPaused(false);
    setProgress({ totalItems: 0, completedItems: 0 });

    try {
      const store = await createRemoteObjectStore(profileItem);
      const libraryService = new CloudLibraryService(store);
      const pickedBooks: Book[] =
        mode === 'upload'
          ? library.filter((book) => selectedUploadHashes.has(book.hash))
          : await Promise.all(
              remoteBooks
                .filter((book) => selectedDownloadHashes.has(book.hash))
                .map(async (book) => {
                  const inferred = await libraryService.inferRemoteBookFile(book.hash);
                  return {
                    hash: book.hash,
                    format: book.format ?? inferred?.format ?? 'EPUB',
                    title: book.title || inferred?.title || book.hash,
                    sourceTitle: inferred?.title ?? book.sourceTitle,
                    author: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  } as Book;
                }),
            );

      if (mode === 'upload' && pickedBooks.length > 0) {
        await libraryService.upsertRemoteLibrary(pickedBooks);
      }

      const waitUntilResumed = () =>
        new Promise<void>((resolve) => {
          resumeResolverRef.current = resolve;
        });
      const result = await syncCloudSelection(
        appService,
        profileItem,
        store,
        { books: pickedBooks, includeLibrary: false },
        { onProgress: setProgress, onLog: addLog },
        {
          shouldPause: () => useCloudSyncStore.getState().isPaused,
          waitUntilResumed,
          shouldCancel: () => cancelRef.current,
        },
      );

      if (result.conflictCount > 0) {
        showToast(_('检测到同步冲突，请在日志中查看'), 'warning');
        setActiveTab('logs');
      } else if (result.failedCount > 0 || !result.stateWritten) {
        showToast(_('同步失败，请查看日志'), 'error');
        setActiveTab('logs');
      } else {
        const timestamp = Date.now();
        const updated = { ...profileItem, lastSyncAt: timestamp };
        upsertProfile(updated);
        setEditing(updated);
        setLastSuccessAt(timestamp);
        showToast(_('同步完成'), 'success');
        if (mode === 'download') await addDownloadedBooksToShelf(pickedBooks);
        await loadRemoteBooks(updated, store);
      }
    } catch (error) {
      addErrorLog('同步任务', error, mode);
      showToast(_('同步失败'), 'error');
    } finally {
      setSyncing(false);
      setPaused(false);
    }
  };

  const currentLastSyncAt = selectedProfile?.lastSyncAt ?? lastSuccessAt;
  const progressPercent =
    progress && progress.totalItems > 0
      ? Math.round((progress.completedItems / progress.totalItems) * 100)
      : 0;

  const header = (
    <div className='flex w-full items-center justify-between'>
      <div className='flex min-w-0 flex-col'>
        <div className='truncate text-base font-semibold'>
          {selectedProvider === 's3' ? _('S3 设置与同步') : _('WebDAV 设置与同步')}
        </div>
        <div className='text-base-content/60 text-xs'>
          {currentLastSyncAt
            ? _('上次成功同步：{{time}}', { time: formatDateTime(currentLastSyncAt) })
            : _('尚未进行同步')}
        </div>
      </div>
      <button
        className='btn btn-ghost btn-sm btn-circle'
        onClick={() => setCloudSyncCenterVisible(false, selectedProvider)}
        aria-label={_('关闭')}
      >
        <MdClose size={18} />
      </button>
    </div>
  );

  const toggleHash = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    hash: string,
  ) => {
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(hash)) next.delete(hash);
      else next.add(hash);
      return next;
    });
  };

  const content = (
    <div className='flex flex-col gap-4'>
      <div className='flex flex-col gap-3'>
        <div
          className={clsx(
            'flex flex-col gap-3',
            !embedded && 'sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <div className={clsx('flex min-w-0 gap-2', !embedded && 'flex-1')}>
            <select
              className='select select-bordered min-w-0 flex-1'
              value={selectedProfile?.id ?? ''}
              onChange={(event) => {
                const profileItem = providerProfiles.find((item) => item.id === event.target.value);
                if (!profileItem) return;
                setActiveProfileId(profileItem.id);
                setEditing(profileItem);
              }}
            >
              <option value=''>{_('请选择配置')}</option>
              {providerProfiles.map((profileItem) => (
                <option key={profileItem.id} value={profileItem.id}>
                  {profileItem.name}
                </option>
              ))}
            </select>
            <button
              type='button'
              className='btn btn-ghost btn-square'
              aria-label={_('新建配置')}
              title={_('新建配置')}
              onClick={() =>
                setEditing(
                  createDefaultProfile(selectedProvider, profiles.map((profileItem) => profileItem.name)),
                )
              }
            >
              <MdAdd size={20} />
            </button>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <button className='btn btn-sm' onClick={saveProfile}>
              {_('保存配置')}
            </button>
            <button className='btn btn-sm' onClick={testConnection}>
              {_('测试连接')}
            </button>
            <button
              className='btn btn-error btn-sm'
              onClick={removeProfile}
              disabled={!selectedProfile}
            >
              {_('删除配置')}
            </button>
          </div>
        </div>

        <CloudProfileForm profile={editing} embedded={embedded} onChange={setEditing} />

        <div
          className={clsx(
            'flex flex-col gap-3',
            !embedded && 'sm:flex-row sm:items-center sm:justify-between',
          )}
        >
          <label className='flex items-center gap-2'>
            <input
              type='checkbox'
              className='checkbox checkbox-sm'
              checked={autoSyncEnabled}
              onChange={(event) => setAutoSyncEnabled(event.target.checked)}
            />
            <span className='text-sm'>{_('开启自动同步（仅在应用运行时）')}</span>
          </label>
          <div className={clsx('flex gap-2', embedded ? 'flex-col items-stretch' : 'items-center')}>
            <span className='text-sm'>{_('同步间隔（分钟）')}</span>
            <input
              className={clsx('input input-bordered input-sm w-24', embedded && 'w-full')}
              type='number'
              min={5}
              max={1440}
              value={autoSyncIntervalMinutes}
              onChange={(event) =>
                setAutoSyncIntervalMinutes(Number.parseInt(event.target.value, 10) || 15)
              }
              disabled={!autoSyncEnabled}
            />
          </div>
        </div>
      </div>

      <div className='border-base-300 rounded-lg border'>
        <div className='border-base-300 flex border-b'>
          {(['upload', 'download', 'logs', 'profiles'] as const).map((tab) => {
            const labels = {
              upload: _('上传'),
              download: _('下载'),
              logs: _('同步日志'),
              profiles: _('配置列表'),
            };
            return (
              <button
                key={tab}
                className={clsx(
                  'flex min-w-0 flex-1 items-center justify-center px-1 py-3 text-sm font-medium',
                  activeTab === tab
                    ? 'border-base-content text-base-content border-b-2'
                    : 'text-base-content/60',
                )}
                onClick={() => setActiveTab(tab)}
              >
                <span className='truncate'>{labels[tab]}</span>
              </button>
            );
          })}
        </div>

        {activeTab === 'upload' ? (
          <div className='h-72 overflow-y-auto p-2'>
            <div className='flex items-center justify-between gap-2 px-2 pb-2'>
              <div className='text-base-content/60 text-xs'>{_('本地书籍')}</div>
              <input
                className='input input-bordered input-sm min-w-0 max-w-56'
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={_('搜索')}
              />
            </div>
            <ul className='space-y-1'>
              {filteredLocalBooks.map((book) => {
                const selected = selectedUploadHashes.has(book.hash);
                return (
                  <li
                    key={book.hash}
                    className='hover:bg-base-200 flex cursor-pointer items-center justify-between rounded p-2'
                    onClick={() => toggleHash(setSelectedUploadHashes, book.hash)}
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      <input type='checkbox' className='checkbox checkbox-sm' readOnly checked={selected} />
                      <span className='truncate text-sm'>{book.title}</span>
                    </div>
                    <div className='text-base-content/50 text-xs'>{book.format}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {activeTab === 'download' ? (
          <div className='h-72 overflow-y-auto p-2'>
            <div className='flex flex-col gap-2 px-2 pb-2 sm:flex-row sm:items-center sm:justify-between'>
              <div className='min-w-0'>
                <div className='text-base-content/70 text-xs font-medium'>{_('云端书籍')}</div>
                <div className='text-base-content/60 text-xs'>
                  {remoteCountInfo
                    ? `${_('目录')} ${remoteCountInfo.prefixCount} · ${_('清单')} ${remoteCountInfo.libraryCount}`
                    : ''}
                </div>
              </div>
              <div className='flex min-w-0 items-center gap-2'>
                <input
                  className='input input-bordered input-sm min-w-0 max-w-56'
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={_('搜索')}
                />
                <button className='btn btn-ghost btn-xs' onClick={() => void loadRemoteBooks()}>
                  {_('刷新')}
                </button>
              </div>
            </div>
            <ul className='space-y-1'>
              {filteredRemoteBooks.map((book) => {
                const selected = selectedDownloadHashes.has(book.hash);
                return (
                  <li
                    key={book.hash}
                    className='hover:bg-base-200 flex cursor-pointer items-center justify-between rounded p-2'
                    onClick={() => toggleHash(setSelectedDownloadHashes, book.hash)}
                  >
                    <div className='flex min-w-0 items-center gap-3'>
                      <input type='checkbox' className='checkbox checkbox-sm' readOnly checked={selected} />
                      <span className='truncate text-sm'>{book.title}</span>
                    </div>
                    <div className='text-base-content/50 text-xs'>{book.format || ''}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {activeTab === 'logs' ? (
          <div className='h-72 overflow-y-auto p-3'>
            <div className='flex items-center justify-between pb-2'>
              <div className='text-base-content/60 text-xs'>{_('最多保留 500 条记录')}</div>
              <div className='flex items-center gap-2'>
                <button className='btn btn-ghost btn-xs' onClick={clearLogs}>
                  {_('清空')}
                </button>
                <button
                  className='btn btn-ghost btn-xs'
                  onClick={async () => {
                    if (!appService) return;
                    const saved = await appService.saveFile(
                      'cloud-sync-log.json',
                      JSON.stringify(logs, null, 2),
                      'application/json',
                    );
                    if (saved) showToast(_('日志已导出'), 'success');
                  }}
                >
                  {_('导出')}
                </button>
              </div>
            </div>
            <div className='space-y-2'>
              {logs.map((log) => (
                <div key={log.id} className='border-base-300 rounded-lg border p-2 text-sm'>
                  <div className='flex items-center justify-between gap-2'>
                    <div className='truncate'>{log.path}</div>
                    <div className='text-base-content/60 shrink-0 text-xs'>
                      {formatDateTime(log.timestamp)}
                    </div>
                  </div>
                  <div className='text-base-content/60 flex items-center justify-between gap-2 pt-1 text-xs'>
                    <span className='shrink-0'>
                      {(log.provider || selectedProvider).toUpperCase()} ·{' '}
                      {log.direction === 'upload' ? _('上传') : _('下载')} · {log.status}
                    </span>
                    <span className='truncate'>{log.message || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === 'profiles' ? (
          <div className='h-72 overflow-y-auto p-2'>
            <div className='text-base-content/60 px-2 pb-2 text-xs'>{_('已保存配置')}</div>
            <ul className='space-y-1'>
              {providerProfiles.map((profileItem) => {
                const isActive = profileItem.id === activeProfileId;
                return (
                  <li
                    key={profileItem.id}
                    className={clsx(
                      'flex cursor-pointer items-center justify-between gap-3 rounded p-2',
                      isActive ? 'bg-base-200' : 'hover:bg-base-200',
                    )}
                    onClick={() => {
                      setActiveProfileId(profileItem.id);
                      setEditing(profileItem);
                    }}
                  >
                    <div className='min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate text-sm font-medium'>{profileItem.name}</span>
                        {isActive ? (
                          <span className='badge badge-primary badge-xs'>{_('默认')}</span>
                        ) : null}
                      </div>
                      <div className='text-base-content/60 truncate text-xs'>
                        {getProfileAddress(profileItem)}
                      </div>
                    </div>
                    <div className='text-base-content/60 shrink-0 text-xs'>
                      {profileItem.lastSyncAt
                        ? formatDateTime(profileItem.lastSyncAt)
                        : _('尚未同步')}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className='border-base-300 bg-base-200/30 border-t p-4'>
          {isSyncing ? (
            <div className='mb-3'>
              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-base-content/70 truncate'>{progress?.currentPath || ''}</span>
                <span className='text-base-content/70 shrink-0'>{progressPercent}%</span>
              </div>
              <div className='bg-base-300 mt-1 h-2 w-full overflow-hidden rounded-full'>
                <div
                  className='bg-primary h-full transition-all'
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <button
              className='btn btn-primary w-full'
              disabled={isSyncing || selectedUploadHashes.size === 0}
              onClick={() => void startSync('upload')}
            >
              <MdCloudUpload size={18} />
              {_('上传选中书籍')}
            </button>
            <button
              className='btn btn-primary w-full'
              disabled={isSyncing || selectedDownloadHashes.size === 0}
              onClick={() => void startSync('download')}
            >
              <MdCloudDownload size={18} />
              {_('下载选中书籍')}
            </button>
          </div>

          <div className='mt-3 flex items-center justify-between'>
            <button
              className='btn btn-ghost btn-sm'
              onClick={() => setPaused(!isPaused)}
              disabled={!isSyncing}
            >
              {isPaused ? <MdPlayArrow size={18} /> : <MdPause size={18} />}
              {isPaused ? _('恢复') : _('暂停')}
            </button>
            <button
              className='btn btn-ghost btn-sm'
              onClick={() => {
                cancelRef.current = true;
                showToast(_('已请求停止，当前任务完成后将退出'), 'info');
              }}
              disabled={!isSyncing}
            >
              {_('停止')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <Dialog
      id={CLOUD_SYNC_DIALOG_ID}
      isOpen={isOpen}
      header={header}
      onClose={() => {
        setIsOpen(false);
        setCloudSyncCenterOpen(false);
      }}
      boxClassName='sm:!w-[720px] sm:!max-w-screen-md sm:h-auto'
    >
      {content}
    </Dialog>
  );
};

export default CloudSyncCenter;


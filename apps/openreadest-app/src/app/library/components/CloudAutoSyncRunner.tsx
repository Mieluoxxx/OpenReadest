'use client';

import { useEffect } from 'react';
import { useEnv } from '@/context/EnvContext';
import { createRemoteObjectStore, syncCloudSelection } from '@/services/cloud';
import { CloudProfile } from '@/services/cloud/models';
import {
  loadCloudSyncStoreFromStorage,
  useCloudSyncStore,
} from '@/store/cloudSyncStore';
import { useLibraryStore } from '@/store/libraryStore';
import { eventDispatcher } from '@/utils/event';

const isReady = (profile: CloudProfile) => {
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

const shouldRun = () => typeof navigator !== 'undefined' && navigator.onLine;

const CloudAutoSyncRunner = () => {
  const { appService } = useEnv();
  const getVisibleLibrary = useLibraryStore((state) => state.getVisibleLibrary);
  const {
    autoSyncEnabled,
    autoSyncIntervalMinutes,
    activeProfileId,
    restore,
    addLog,
    setProgress,
    setLastSuccessAt,
    setSyncing,
    upsertProfile,
  } = useCloudSyncStore();

  useEffect(() => {
    restore(loadCloudSyncStoreFromStorage());
  }, [restore]);

  useEffect(() => {
    if (!autoSyncEnabled || !appService) return;

    let disposed = false;
    const tick = async () => {
      if (disposed || !shouldRun() || useCloudSyncStore.getState().isSyncing) return;
      const { profiles, activeProfileId: currentActiveId } = useCloudSyncStore.getState();
      const profile = profiles.find((item) => item.id === currentActiveId);
      if (!profile || !isReady(profile)) return;
      const books = getVisibleLibrary();
      if (books.length === 0) return;

      setSyncing(true);
      try {
        const store = await createRemoteObjectStore(profile);
        const result = await syncCloudSelection(
          appService,
          profile,
          store,
          { books, includeLibrary: true },
          { onProgress: setProgress, onLog: addLog },
        );
        if (result.failedCount > 0 || result.conflictCount > 0 || !result.stateWritten) {
          throw new Error('Cloud auto sync incomplete');
        }
        const timestamp = Date.now();
        setLastSuccessAt(timestamp);
        const latest = useCloudSyncStore
          .getState()
          .profiles.find((item) => item.id === profile.id);
        upsertProfile({ ...(latest ?? profile), lastSyncAt: timestamp });
      } catch {
        eventDispatcher.dispatch('toast', {
          message: `${profile.provider.toUpperCase()} 自动同步失败`,
          type: 'warning',
        });
      } finally {
        setSyncing(false);
      }
    };

    const handle = window.setInterval(
      () => void tick(),
      Math.max(5, autoSyncIntervalMinutes) * 60 * 1000,
    );
    void tick();
    return () => {
      disposed = true;
      window.clearInterval(handle);
    };
  }, [
    activeProfileId,
    addLog,
    appService,
    autoSyncEnabled,
    autoSyncIntervalMinutes,
    getVisibleLibrary,
    setLastSuccessAt,
    setProgress,
    setSyncing,
    upsertProfile,
  ]);

  return null;
};

export default CloudAutoSyncRunner;


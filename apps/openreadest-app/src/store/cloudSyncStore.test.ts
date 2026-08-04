import { beforeEach, describe, expect, it } from 'vitest';
import { CloudProfile } from '@/services/cloud/models';
import {
  CLOUD_SYNC_STORAGE_KEY,
  loadCloudSyncStoreFromStorage,
  useCloudSyncStore,
} from './cloudSyncStore';

const makeWebDavProfile = (id: string, name: string): CloudProfile => ({
  id,
  name,
  provider: 'webdav',
  conflictStrategy: 'manual',
  config: {
    serverUrl: 'https://dav.example.com',
    remotePath: '/remote',
    username: 'reader',
    password: 'secret',
  },
});

const makeS3Profile = (id: string, name: string): CloudProfile => ({
  id,
  name,
  provider: 's3',
  conflictStrategy: 'manual',
  config: {
    endpoint: 'https://s3.example.com',
    region: 'auto',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucketName: 'books',
    remotePrefix: 'reader',
  },
});

beforeEach(() => {
  localStorage.clear();
  useCloudSyncStore.setState({
    profiles: [],
    activeProfileId: null,
    logs: [],
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 15,
    isCloudSyncCenterOpen: false,
    centerProvider: 'webdav',
    activeTab: 'upload',
    isSyncing: false,
    isPaused: false,
    progress: null,
    lastSuccessAt: null,
  });
});

describe('cloudSyncStore', () => {
  it('persists WebDAV and S3 profiles in one versioned payload', () => {
    const store = useCloudSyncStore.getState();
    store.upsertProfile(makeWebDavProfile('dav', 'WebDAV'));
    store.upsertProfile(makeS3Profile('s3', 'S3'));

    const saved = JSON.parse(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY) || '{}') as {
      profiles: CloudProfile[];
      activeProfileId: string;
    };
    expect(saved.profiles.map((profile) => profile.provider)).toEqual(['s3', 'webdav']);
    expect(saved.activeProfileId).toBe('s3');
  });

  it('does not read legacy WebDAV storage keys', () => {
    localStorage.setItem('readest_webdav_profiles_v1', JSON.stringify([makeWebDavProfile('legacy', 'Legacy')]));
    expect(loadCloudSyncStoreFromStorage().profiles).toEqual([]);
  });

  it('keeps one active profile across providers', () => {
    const store = useCloudSyncStore.getState();
    store.upsertProfile(makeWebDavProfile('dav', 'WebDAV'));
    store.upsertProfile(makeS3Profile('s3', 'S3'));
    expect(useCloudSyncStore.getState().activeProfileId).toBe('s3');
    store.setActiveProfileId('dav');
    expect(loadCloudSyncStoreFromStorage().activeProfileId).toBe('dav');
  });

  it('selects another profile when the active profile is deleted', () => {
    const store = useCloudSyncStore.getState();
    store.upsertProfile(makeWebDavProfile('dav', 'WebDAV'));
    store.upsertProfile(makeS3Profile('s3', 'S3'));
    store.deleteProfile('s3');
    expect(useCloudSyncStore.getState().activeProfileId).toBe('dav');
  });

  it('sanitizes duplicate and invalid names on load', () => {
    const profiles = [
      makeWebDavProfile('dav', 'Same'),
      makeS3Profile('s3', 'Same'),
      makeS3Profile('s3-2', 'bad name'),
    ];
    localStorage.setItem(
      CLOUD_SYNC_STORAGE_KEY,
      JSON.stringify({ profiles, activeProfileId: 'dav' }),
    );
    const loaded = loadCloudSyncStoreFromStorage();
    expect(new Set(loaded.profiles.map((profile) => profile.name)).size).toBe(3);
    expect(loaded.profiles.every((profile) => /^[\u4e00-\u9fffA-Za-z0-9_]{1,32}$/.test(profile.name))).toBe(true);
  });

  it('clamps auto sync interval and keeps at most 500 logs', () => {
    const store = useCloudSyncStore.getState();
    store.setAutoSyncIntervalMinutes(1);
    store.setAutoSyncEnabled(true);
    for (let index = 0; index < 505; index += 1) {
      store.addLog({
        id: String(index),
        timestamp: index,
        direction: 'upload',
        path: 'item',
        status: 'completed',
      });
    }
    const loaded = loadCloudSyncStoreFromStorage();
    expect(loaded.autoSyncIntervalMinutes).toBe(5);
    expect(loaded.autoSyncEnabled).toBe(true);
    expect(loaded.logs).toHaveLength(500);
  });

  it('restores persisted data and rejects an unknown active id', () => {
    localStorage.setItem(
      CLOUD_SYNC_STORAGE_KEY,
      JSON.stringify({
        profiles: [makeS3Profile('s3', 'S3')],
        activeProfileId: 'missing',
        logs: [],
      }),
    );
    useCloudSyncStore.getState().restore();
    expect(useCloudSyncStore.getState().activeProfileId).toBe('s3');
  });

  it('updates transient state without placing it in the persisted payload', () => {
    const store = useCloudSyncStore.getState();
    store.setCloudSyncCenterOpen(true, 's3');
    store.setActiveTab('logs');
    store.setSyncing(true);
    store.setPaused(true);
    store.setProgress({ totalItems: 2, completedItems: 1 });
    store.setLastSuccessAt(123);
    expect(useCloudSyncStore.getState()).toMatchObject({
      isCloudSyncCenterOpen: true,
      centerProvider: 's3',
      activeTab: 'logs',
      isSyncing: true,
      isPaused: true,
      lastSuccessAt: 123,
    });
    expect(localStorage.getItem(CLOUD_SYNC_STORAGE_KEY)).toBeNull();
  });
});


import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CloudAutoSyncRunner from '@/app/library/components/CloudAutoSyncRunner';
import { createRemoteObjectStore, syncCloudSelection } from '@/services/cloud';
import { CLOUD_SYNC_STORAGE_KEY, useCloudSyncStore } from '@/store/cloudSyncStore';
import { useLibraryStore } from '@/store/libraryStore';
import { Book } from '@/types/book';

const envMock = vi.hoisted(() => ({
  appService: { readFile: vi.fn() },
  envConfig: {},
}));

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => envMock,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/services/cloud', () => ({
  createRemoteObjectStore: vi.fn(async () => ({ provider: 's3' as const })),
  syncCloudSelection: vi.fn(),
}));

const mockSync = vi.mocked(syncCloudSelection);
const mockCreateStore = vi.mocked(createRemoteObjectStore);

const book: Book = {
  hash: 'hash1',
  format: 'EPUB',
  title: 'The Alchemist',
  author: 'Author',
  createdAt: 1,
  updatedAt: 1,
};

const seedStore = () => {
  localStorage.setItem(
    CLOUD_SYNC_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      profiles: [
        {
          id: 's3',
          name: 'S3',
          provider: 's3',
          conflictStrategy: 'manual',
          lastSyncAt: 0,
          config: {
            endpoint: 'https://s3.example.com',
            region: 'auto',
            accessKeyId: 'access',
            secretAccessKey: 'secret',
            bucketName: 'books',
            remotePrefix: '',
          },
        },
      ],
      activeProfileId: 's3',
      logs: [],
      autoSyncEnabled: true,
      autoSyncIntervalMinutes: 5,
      lastSuccessAt: null,
    }),
  );
};

beforeEach(() => {
  localStorage.clear();
  useCloudSyncStore.setState({
    profiles: [],
    activeProfileId: null,
    logs: [],
    autoSyncEnabled: true,
    autoSyncIntervalMinutes: 5,
    isCloudSyncCenterOpen: false,
    centerProvider: 'webdav',
    activeTab: 'upload',
    isSyncing: false,
    isPaused: false,
    progress: null,
    lastSuccessAt: null,
  });
  useLibraryStore.setState({ library: [book] });
  mockSync.mockReset();
  mockCreateStore.mockReset();
  mockSync.mockResolvedValue({
    completedCount: 1,
    failedCount: 0,
    skippedCount: 0,
    conflictCount: 0,
    conflicts: [],
    stateWritten: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('CloudAutoSyncRunner', () => {
  it('syncs once per interval instead of looping after a successful sync', async () => {
    vi.useFakeTimers();
    seedStore();
    render(<CloudAutoSyncRunner />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockSync).toHaveBeenCalledTimes(1);

    // No interval elapsed yet: the post-sync profile upsert must not retrigger a sync.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockSync).toHaveBeenCalledTimes(1);

    // One interval passes: exactly one more sync.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(mockSync).toHaveBeenCalledTimes(2);
  });

  it('does not sync when auto sync is disabled', () => {
    vi.useFakeTimers();
    seedStore();
    useCloudSyncStore.setState({ autoSyncEnabled: false });
    render(<CloudAutoSyncRunner />);
    expect(mockSync).not.toHaveBeenCalled();
  });

  it('skips sync while a manual sync is running', async () => {
    vi.useFakeTimers();
    seedStore();
    useCloudSyncStore.setState({ isSyncing: true });
    render(<CloudAutoSyncRunner />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    });
    expect(mockSync).not.toHaveBeenCalled();
  });
});

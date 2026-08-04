import { describe, expect, it } from 'vitest';
import { createMockAppService } from '@/__tests__/webdav/mockAppService';
import { S3CloudProfile } from '../models';
import { getLocalSyncStatePath, getRemoteSyncStateKey } from '../paths';
import { RemoteStorageError } from '../remote/errors';
import {
  RemoteAccessResult,
  RemoteListEntry,
  RemoteObjectMetadata,
  RemoteObjectStore,
} from '../remote/types';
import { syncCloudSelection } from './engine';

class MemoryRemoteStore implements RemoteObjectStore {
  readonly provider = 's3' as const;
  readonly objects = new Map<string, Uint8Array>();
  readonly failingWrites = new Set<string>();

  async testAccess(): Promise<RemoteAccessResult> {
    return { addressingStyle: 'path' };
  }

  async listChildren(): Promise<RemoteListEntry[]> {
    return [];
  }

  async stat(key: string): Promise<RemoteObjectMetadata | null> {
    const data = this.objects.get(key);
    return data
      ? { key, etag: `etag-${data.byteLength}`, lastModified: new Date(1).toISOString(), size: data.byteLength }
      : null;
  }

  async read(key: string): Promise<Uint8Array> {
    const data = this.objects.get(key);
    if (!data) throw new RemoteStorageError('not_found', 'missing', { provider: 's3', key });
    return data;
  }

  async write(key: string, data: Uint8Array): Promise<RemoteObjectMetadata> {
    if (this.failingWrites.has(key)) {
      throw new RemoteStorageError('server_error', 'failed', { provider: 's3', key });
    }
    this.objects.set(key, new Uint8Array(data));
    return (await this.stat(key))!;
  }
}

const profile: S3CloudProfile = {
  id: 'profile-a',
  name: 'S3',
  provider: 's3',
  conflictStrategy: 'manual',
  config: {
    endpoint: 'https://s3.example.com',
    region: 'auto',
    accessKeyId: 'access',
    secretAccessKey: 'secret',
    bucketName: 'books',
    remotePrefix: '',
  },
};

const book = {
  hash: 'hash',
  format: 'EPUB' as const,
  title: 'Title',
  author: 'Author',
  createdAt: 1,
  updatedAt: 1,
};

describe('syncCloudSelection', () => {
  it('does not advance the baseline for a failed object', async () => {
    const { appService, putText, getText } = createMockAppService();
    const store = new MemoryRemoteStore();
    await putText('Books', 'hash/config.json', JSON.stringify({ progress: 0.5 }));
    store.failingWrites.add('OpenReadest/Books/hash/config.json');

    const result = await syncCloudSelection(
      appService,
      profile,
      store,
      {
        books: [book],
        includeLibrary: false,
        includeBookFiles: false,
        includeCovers: false,
      },
    );

    expect(result.failedCount).toBe(1);
    expect(result.stateWritten).toBe(true);
    const state = JSON.parse(await getText('Settings', getLocalSyncStatePath(profile.id))) as {
      entries: Record<string, unknown>;
    };
    expect(state.entries['OpenReadest/Books/hash/config.json']).toBeUndefined();
    expect(store.objects.has(getRemoteSyncStateKey())).toBe(true);
  });

  it('isolates local state by profile id', async () => {
    const { appService, putText, stores } = createMockAppService();
    const store = new MemoryRemoteStore();
    await putText('Books', 'hash/config.json', JSON.stringify({ progress: 0.5 }));

    await syncCloudSelection(
      appService,
      profile,
      store,
      { books: [book], includeLibrary: false, includeBookFiles: false, includeCovers: false },
    );
    await syncCloudSelection(
      appService,
      { ...profile, id: 'profile-b' },
      store,
      { books: [book], includeLibrary: false, includeBookFiles: false, includeCovers: false },
    );

    expect(stores.Settings.has(getLocalSyncStatePath('profile-a'))).toBe(true);
    expect(stores.Settings.has(getLocalSyncStatePath('profile-b'))).toBe(true);
  });
});


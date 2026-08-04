// Copyright (c) 2026 luyishui
import { describe, it, expect, afterEach } from 'vitest';
import { createMockWebDavServer } from './mockWebDavServer';
import { createMockAppService } from './mockAppService';
import { syncCloudSelection } from '../../services/cloud/sync/engine';
import { WebDavCloudProfile } from '../../services/cloud/models';
import { WebDavObjectStore } from '../../services/cloud/remote/WebDavObjectStore';
import { Book } from '../../types/book';

const createBook = (hash: string, title: string): Book => {
  return {
    hash,
    format: 'EPUB',
    title,
    author: 'Author',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

describe('WebDAV sync integration', () => {
  const servers: Array<() => Promise<void>> = [];
  afterEach(async () => {
    for (const close of servers.splice(0)) {
      await close();
    }
  });

  it('uploads local files to remote when remote missing', async () => {
    const webdav = await createMockWebDavServer({ username: 'u', password: 'p' });
    servers.push(webdav.close);
    const { appService, putText, putBinary, stores } = createMockAppService();

    const book = createBook('hash1', 'The Alchemist');
    await putText('Books', 'library.json', JSON.stringify([book]));
    await putBinary('Books', 'hash1/The Alchemist.epub', new Uint8Array([1, 2, 3, 4]));
    await putText('Books', 'hash1/config.json', JSON.stringify({ updatedAt: 1, progress: 0.5 }));

    const profile: WebDavCloudProfile = {
      id: 'p1',
      name: '测试',
      provider: 'webdav',
      conflictStrategy: 'manual',
      config: {
        serverUrl: webdav.serverUrl,
        remotePath: '/dav',
        username: 'u',
        password: 'p',
        allowInsecureHttp: true,
      },
    };

    const logs: Array<{ path: string; status: string; message?: string }> = [];
    const result = await syncCloudSelection(
      appService,
      profile,
      new WebDavObjectStore(profile.config),
      { books: [book], includeCovers: false },
      {
        onLog: (l) => logs.push({ path: l.path, status: l.status, message: l.message }),
      },
    );
    expect(result.conflicts.length).toBe(0);

    const remotePaths = Array.from(webdav.store.keys());
    expect(remotePaths).toContain('/dav/OpenReadest/Books/library.json');
    expect(remotePaths).toContain('/dav/OpenReadest/Books/hash1/The Alchemist.epub');
    expect(remotePaths).toContain('/dav/OpenReadest/Books/hash1/config.json');
    expect(remotePaths).toContain('/dav/OpenReadest/System/sync-state.json');
    expect(stores.Settings.has('cloud-sync/p1/sync-state.json')).toBe(true);

    const second = await syncCloudSelection(
      appService,
      profile,
      new WebDavObjectStore(profile.config),
      { books: [book], includeCovers: false },
    );
    expect(second.completedCount).toBe(0);
    expect(second.skippedCount).toBeGreaterThan(0);
  });

  it('downloads remote files to local when local missing', async () => {
    const webdav = await createMockWebDavServer({ username: 'u', password: 'p' });
    servers.push(webdav.close);
    const { appService, getText } = createMockAppService();

    const book = createBook('hash2', 'Dune');
    const profile: WebDavCloudProfile = {
      id: 'p1',
      name: '测试',
      provider: 'webdav',
      conflictStrategy: 'manual',
      config: {
        serverUrl: webdav.serverUrl,
        remotePath: '/dav',
        username: 'u',
        password: 'p',
        allowInsecureHttp: true,
      },
    };

    const auth = `Basic ${Buffer.from('u:p', 'utf-8').toString('base64')}`;
    await fetch(`${webdav.serverUrl}/dav/OpenReadest/Books/library.json`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify([book]),
    });
    await fetch(`${webdav.serverUrl}/dav/OpenReadest/Books/hash2/Dune.epub`, {
      method: 'PUT',
      headers: { Authorization: auth },
      body: new Uint8Array([9, 9, 9]),
    });
    await fetch(`${webdav.serverUrl}/dav/OpenReadest/Books/hash2/config.json`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt: 2, progress: 0.1 }),
    });

    const result = await syncCloudSelection(
      appService,
      profile,
      new WebDavObjectStore(profile.config),
      { books: [book], includeCovers: false },
    );
    expect(result.conflicts.length).toBe(0);
    const libraryText = await getText('Books', 'library.json');
    expect(JSON.parse(libraryText)[0].hash).toBe('hash2');
    expect(await getText('Books', 'hash2/config.json')).toContain('progress');
  });

  it('detects conflicts when both sides changed and strategy is manual', async () => {
    const webdav = await createMockWebDavServer({ username: 'u', password: 'p' });
    servers.push(webdav.close);
    const { appService, putText, getText } = createMockAppService();

    const book = createBook('hash3', '1984');
    await putText('Books', 'library.json', JSON.stringify([book]));
    await putText('Books', 'hash3/config.json', JSON.stringify({ updatedAt: 1, progress: 0.2 }));

    const profileBase: WebDavCloudProfile = {
      id: 'p1',
      name: '测试',
      provider: 'webdav',
      conflictStrategy: 'local',
      config: {
        serverUrl: webdav.serverUrl,
        remotePath: '/dav',
        username: 'u',
        password: 'p',
        allowInsecureHttp: true,
      },
    };

    await syncCloudSelection(
      appService,
      profileBase,
      new WebDavObjectStore(profileBase.config),
      { books: [book], includeCovers: false, includeBookFiles: false },
    );

    await putText('Books', 'hash3/config.json', JSON.stringify({ updatedAt: 2, progress: 0.3 }));

    const auth = `Basic ${Buffer.from('u:p', 'utf-8').toString('base64')}`;
    await fetch(`${webdav.serverUrl}/dav/OpenReadest/Books/hash3/config.json`, {
      method: 'PUT',
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ updatedAt: 3, progress: 0.4 }),
    });

    const profileManual: WebDavCloudProfile = { ...profileBase, conflictStrategy: 'manual' };
    const result = await syncCloudSelection(
      appService,
      profileManual,
      new WebDavObjectStore(profileManual.config),
      { books: [book], includeCovers: false, includeBookFiles: false },
    );

    expect(result.conflicts.length).toBe(1);
    expect(result.conflicts[0]!.path).toContain('Books/hash3/config.json');
    expect(await getText('Books', 'hash3/config.json')).toContain('0.3');
  });
});

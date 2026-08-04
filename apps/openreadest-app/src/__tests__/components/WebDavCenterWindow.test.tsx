import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebDavCenterWindow } from '@/app/library/components/WebDavCenterWindow';
import { useWebDavStore } from '@/store/webdavStore';

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: null, envConfig: {} }),
}));

vi.mock('@/store/libraryStore', () => ({
  useLibraryStore: (
    selector: (state: { getVisibleLibrary: () => []; updateBooks: () => void }) => unknown,
  ) => selector({ getVisibleLibrary: () => [], updateBooks: () => {} }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/components/Dialog', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/services/webdav/client/WebDavClient', () => ({
  WebDavClient: class {
    propfind = vi.fn(async () => ({ ok: false, error: 'mocked client' }));
  },
}));

vi.mock('@/services/webdav/sync/engine', () => ({
  syncWebDavSelection: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  useWebDavStore.setState({
    activeTab: 'upload',
    profiles: [],
    activeProfileId: null,
    isSyncing: false,
    isPaused: false,
    progress: null,
    lastSuccessAt: null,
    logs: [],
    autoSyncEnabled: false,
    autoSyncIntervalMinutes: 15,
  });
});

afterEach(() => {
  cleanup();
});

describe('WebDavCenterWindow embedded layout and actions', () => {
  it('keeps the embedded form single-column and exposes concise sync labels', () => {
    render(<WebDavCenterWindow embedded />);

    const formGrid = screen.getByText('备注名').parentElement?.parentElement;
    expect(formGrid?.classList.contains('grid-cols-1')).toBe(true);
    expect(formGrid?.classList.contains('sm:grid-cols-2')).toBe(false);
    expect(screen.getByRole('button', { name: '上传' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '上传（本地）' })).toBeNull();
    expect(screen.getByRole('button', { name: '下载' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '下载（云端）' })).toBeNull();
  });

  it('saves a new profile through 保存配置 without a separate 新增 action', async () => {
    render(<WebDavCenterWindow embedded />);

    expect(screen.queryByRole('button', { name: '新增' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));

    await waitFor(() => {
      expect(useWebDavStore.getState().profiles).toHaveLength(1);
      expect(useWebDavStore.getState().profiles[0].name).toBe('WebDAV');
    });
  });

  it('deletes the selected saved profile through 删除配置', async () => {
    const profile = {
      id: 'saved-dav',
      name: 'SavedDAV',
      serverUrl: 'https://dav.example.com',
      remotePath: '/books',
      username: 'reader',
      password: 'secret',
      allowInsecureHttp: false,
      allowInsecureTls: false,
      conflictStrategy: 'manual' as const,
    };
    localStorage.setItem('readest_webdav_profiles_v1', JSON.stringify([profile]));
    localStorage.setItem('readest_webdav_active_profile_v1', profile.id);

    render(<WebDavCenterWindow embedded />);
    const deleteButton = screen.getByRole('button', { name: '删除配置' });
    await waitFor(() => expect((deleteButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(useWebDavStore.getState().profiles).toHaveLength(0);
      expect(localStorage.getItem('readest_webdav_profiles_v1')).toBe('[]');
    });
  });
});

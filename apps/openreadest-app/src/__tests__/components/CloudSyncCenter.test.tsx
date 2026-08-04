import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncCenter } from '@/app/library/components/CloudSyncCenter';
import { CLOUD_SYNC_STORAGE_KEY, useCloudSyncStore } from '@/store/cloudSyncStore';
import { CloudProfile } from '@/services/cloud/models';

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

afterEach(cleanup);

describe('CloudSyncCenter embedded layout and profiles', () => {
  it('keeps the embedded WebDAV form single-column', () => {
    render(<CloudSyncCenter embedded provider='webdav' />);
    const formGrid = screen.getByText('备注名').parentElement?.parentElement;
    expect(formGrid?.classList.contains('grid-cols-1')).toBe(true);
    expect(formGrid?.classList.contains('sm:grid-cols-2')).toBe(false);
    expect(screen.getByRole('button', { name: '上传' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '下载' })).toBeTruthy();
  });

  it('saves a new WebDAV profile in the unified store', async () => {
    render(<CloudSyncCenter embedded provider='webdav' />);
    fireEvent.click(screen.getByRole('button', { name: '保存配置' }));
    await waitFor(() => {
      const [profile] = useCloudSyncStore.getState().profiles;
      expect(profile?.provider).toBe('webdav');
      expect(profile?.name).toBe('WebDAV');
    });
  });

  it('renders all six S3 fields and masks Secret Key by default', () => {
    render(<CloudSyncCenter embedded provider='s3' />);
    for (const label of ['Endpoint', 'Region', 'Access Key', 'Secret Key', 'Bucket Name', 'Remote Prefix']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    const secretInput = screen.getByText('Secret Key').parentElement?.querySelector('input');
    expect(secretInput?.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: '显示 Secret Key' }));
    expect(secretInput?.type).toBe('text');
  });

  it('deletes a selected S3 profile from the unified payload', async () => {
    const profile: CloudProfile = {
      id: 's3-profile',
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
    localStorage.setItem(
      CLOUD_SYNC_STORAGE_KEY,
      JSON.stringify({ profiles: [profile], activeProfileId: profile.id, logs: [] }),
    );
    render(<CloudSyncCenter embedded provider='s3' />);
    const deleteButton = screen.getByRole('button', { name: '删除配置' });
    await waitFor(() => expect((deleteButton as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(deleteButton);
    await waitFor(() => expect(useCloudSyncStore.getState().profiles).toHaveLength(0));
  });
});


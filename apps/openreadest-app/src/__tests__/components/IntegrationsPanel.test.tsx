import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IntegrationsPanel from '@/components/settings/IntegrationsPanel';
import { CLOUD_SYNC_STORAGE_KEY, useCloudSyncStore } from '@/store/cloudSyncStore';
import { CloudProfile } from '@/services/cloud/models';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string, values?: { count?: number }) =>
    values?.count === undefined ? key : key.replace('{{count}}', String(values.count)),
}));

vi.mock('@/app/library/components/CloudSyncCenter', () => ({
  default: ({ provider }: { provider: string }) => (
    <div data-testid='cloud-sync-center'>{provider}</div>
  ),
}));

const webdavProfile: CloudProfile = {
  id: 'dav',
  name: 'WorkDAV',
  provider: 'webdav',
  conflictStrategy: 'manual',
  config: {
    serverUrl: 'https://dav.example.com',
    remotePath: '/books',
    username: 'reader',
    password: 'secret',
  },
};

const s3Profile: CloudProfile = {
  id: 's3',
  name: 'Archive',
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

describe('IntegrationsPanel', () => {
  it('shows WebDAV and S3 as parallel cloud sync entries', () => {
    render(<IntegrationsPanel />);
    expect(screen.getByRole('button', { name: 'WebDAV' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'S3' })).toBeTruthy();
    expect(screen.getAllByText('Not configured')).toHaveLength(2);
  });

  it('opens the shared center filtered to the selected provider', () => {
    render(<IntegrationsPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'S3' }));
    expect(screen.getByTestId('cloud-sync-center').textContent).toBe('s3');
    expect(screen.getByText('Integrations')).toBeTruthy();
  });

  it('shows the active profile and configured count per provider', () => {
    localStorage.setItem(
      CLOUD_SYNC_STORAGE_KEY,
      JSON.stringify({
        profiles: [webdavProfile, s3Profile],
        activeProfileId: s3Profile.id,
        logs: [],
        autoSyncEnabled: false,
        autoSyncIntervalMinutes: 15,
      }),
    );
    render(<IntegrationsPanel />);
    expect(screen.getByText('正在使用 · Archive')).toBeTruthy();
    expect(screen.getByText('已配置 1 个')).toBeTruthy();
  });
});

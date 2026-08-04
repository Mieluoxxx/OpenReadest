import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import IntegrationsPanel from '@/components/settings/IntegrationsPanel';
import { useWebDavStore } from '@/store/webdavStore';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/app/library/components/WebDavCenterWindow', () => ({
  default: () => <div data-testid='webdav-inline-form' />,
}));

const PROFILES_KEY = 'readest_webdav_profiles_v1';
const ACTIVE_PROFILE_KEY = 'readest_webdav_active_profile_v1';

const activeProfile = {
  id: 'work-dav',
  name: 'WorkDAV',
  serverUrl: 'https://dav.example.com',
  remotePath: '/books',
  username: 'reader',
  password: 'secret',
  allowInsecureHttp: false,
  allowInsecureTls: false,
  conflictStrategy: 'manual' as const,
};

beforeEach(() => {
  localStorage.clear();
  useWebDavStore.setState({
    isWebDavCenterOpen: false,
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

describe('IntegrationsPanel', () => {
  it('opens the WebDAV detail view with its configuration form inline', () => {
    render(<IntegrationsPanel />);

    expect(screen.getByText('Cloud Sync')).toBeTruthy();
    const webDavButton = screen.getByRole('button', { name: 'WebDAV' });
    expect(screen.getByText('Not configured')).toBeTruthy();

    fireEvent.click(webDavButton);

    expect(screen.getByText('Integrations')).toBeTruthy();
    const integrationsButton = screen.getByText('Integrations');
    expect(integrationsButton.closest('h2')?.classList.contains('font-medium')).toBe(true);
    expect(integrationsButton.closest('h2')?.classList.contains('text-2xl')).toBe(false);
    expect(screen.getByTestId('webdav-inline-form')).toBeTruthy();
    expect(
      screen.queryByText('Configure WebDAV cloud sync for your library and reading progress.'),
    ).toBeNull();
  });

  it('shows the active persisted profile name', () => {
    localStorage.setItem(PROFILES_KEY, JSON.stringify([activeProfile]));
    localStorage.setItem(ACTIVE_PROFILE_KEY, activeProfile.id);

    render(<IntegrationsPanel />);

    expect(screen.getByText(activeProfile.name)).toBeTruthy();
    expect(screen.queryByText('Not configured')).toBeNull();
  });
});

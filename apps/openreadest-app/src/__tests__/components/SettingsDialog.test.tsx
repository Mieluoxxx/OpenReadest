import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SettingsDialog from '@/components/settings/SettingsDialog';

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: undefined }),
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({
    setFontPanelView: vi.fn(),
    setSettingsDialogOpen: vi.fn(),
  }),
}));

vi.mock('@/hooks/useResponsiveSize', () => ({
  useResponsiveSize: () => 16,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/utils/rtl', () => ({
  getDirFromUILanguage: () => 'ltr',
}));

vi.mock('@/components/Dialog', () => ({
  default: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => (
    <div>
      {header}
      {children}
    </div>
  ),
}));

vi.mock('@/components/Dropdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='settings-menu'>{children}</div>
  ),
}));

vi.mock('@/components/settings/DialogMenu', () => ({
  default: () => <div />,
}));

vi.mock('@/components/settings/FontPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/LayoutPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/ColorPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/ControlPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/LangPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/IntegrationsPanel', () => ({ default: () => null }));
vi.mock('@/components/settings/MiscPanel', () => ({ default: () => null }));

const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth');

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('lastConfigPanel', 'Integration');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return this.classList.contains('dialog-tabs') ? 800 : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get() {
      return this.tagName === 'BUTTON' ? 120 : 0;
    },
  });
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  if (originalClientWidth) {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth);
  }
  if (originalScrollWidth) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth);
  }
});

describe('SettingsDialog titlebar', () => {
  it('keeps integration tabs compact when all labels do not fit', async () => {
    render(<SettingsDialog bookKey='' />);

    await vi.waitFor(() => {
      const tabLabels = Array.from(document.querySelectorAll('.dialog-tabs span'));
      expect(
        tabLabels.find((label) => label.textContent === 'Font')?.classList.contains('hidden'),
      ).toBe(true);
      expect(
        tabLabels
          .find((label) => label.textContent === 'Integrations')
          ?.classList.contains('hidden'),
      ).toBe(false);
    });
    expect(screen.getByTestId('settings-menu')).toBeTruthy();
    expect(document.querySelector('[aria-hidden="true"].h-8.w-8')).toBeNull();
  });
});

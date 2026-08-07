import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AiPanel from '@/components/settings/AiPanel';
import { testAiConnection } from '@/services/ai/aiClient';

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {} }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: () => ({ settings: { globalAiSettings: { baseUrl: '', model: '' } } }),
}));

vi.mock('@/services/ai/AiConfigRepository', () => ({
  AiConfigRepository: {
    getConfig: vi.fn().mockResolvedValue({ apiKey: '' }),
    saveConfig: vi.fn(),
    saveApiKey: vi.fn(),
    clearApiKey: vi.fn(),
  },
}));

vi.mock('@/services/ai/aiClient', () => ({
  testAiConnection: vi.fn(),
}));

describe('AiPanel', () => {
  beforeEach(() => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('uses the AI Integration title and keeps the API key controls compact', () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    expect(screen.getByText('AI Integration')).toBeTruthy();
    expect(screen.queryByText(/Translated source text is sent/)).toBeNull();
    expect(screen.queryByText(/API key is stored in plain text/)).toBeNull();
    expect(screen.queryByText(/AI service configured/)).toBeNull();
    expect(screen.queryByText(/AI service not configured/)).toBeNull();

    const keyInput = screen.getByPlaceholderText('Leave empty for no auth');
    expect(keyInput.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Show API key' }));
    expect(keyInput.getAttribute('type')).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide API key' })).toBeTruthy();
  });

  it('shows a green success check after a successful connection test', async () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(screen.getByPlaceholderText('https://api.openai.com/v1'), {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('gpt-4o-mini'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Connection successful')).toBeTruthy();
    });
    expect(testAiConnection).toHaveBeenCalledWith({
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      apiKey: undefined,
    });
  });

  it('shows connection errors in the test row', async () => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: false, code: 'NETWORK' });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(screen.getByPlaceholderText('https://api.openai.com/v1'), {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('gpt-4o-mini'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.textContent).toBe('Network error, please check your connection.');
      expect(status.closest('.config-item')).toBeTruthy();
    });
  });
});

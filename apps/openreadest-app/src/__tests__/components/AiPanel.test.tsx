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

    fireEvent.change(screen.getByPlaceholderText('https://api.deepseek.com/v1'), {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
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

  it('shows a red cross after a failed connection test', async () => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: false, code: 'NETWORK' });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(screen.getByPlaceholderText('https://api.deepseek.com/v1'), {
      target: { value: 'http://localhost:11434/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      const cross = screen.getByLabelText('Connection failed');
      expect(cross.closest('.config-item')).toBeTruthy();
      expect(screen.queryByText(/Network error/)).toBeNull();
    });
  });

  it('orders fields as Base URL, API Key, Model Name and keeps input widths aligned', () => {
    const { container } = render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    const rows = Array.from(container.querySelectorAll('.config-item'));
    const fieldTexts = rows.map((row) => row.querySelector('span')?.textContent ?? '');
    const order = ['Base URL', 'API Key (optional)', 'Model Name'];
    const positions = order.map((label) => fieldTexts.indexOf(label));
    expect(positions).toEqual([0, 1, 2]);

    // 三个字段行共享同一等宽两列网格布局类
    order.forEach((_, i) => {
      const row = rows[positions[i]!]!;
      expect(row.className).toContain('!grid');
      expect(row.className).toContain('grid-cols-[minmax(0,1fr)_minmax(0,2fr)]');
    });

    // 操作按钮顺序：Test → Save → Clear API Key
    const buttons = Array.from(container.querySelectorAll('button')).map(
      (btn) => btn.textContent?.trim() ?? '',
    );
    const testIdx = buttons.indexOf('Test');
    const saveIdx = buttons.indexOf('Save');
    const clearIdx = buttons.indexOf('Clear API Key');
    expect(testIdx).toBeGreaterThan(-1);
    expect(saveIdx).toBeGreaterThan(testIdx);
    expect(clearIdx).toBeGreaterThan(saveIdx);
  });
});

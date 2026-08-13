import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AiPanel from '@/components/settings/AiPanel';
import { AiConfigRepository } from '@/services/ai/AiConfigRepository';
import { testAiConnection } from '@/services/ai/aiClient';
import { useSettingsStore } from '@/store/settingsStore';

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {} }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({ settings: { globalAiSettings: { baseUrl: '', model: '' } } })),
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

const getBaseUrlInput = () => screen.getByPlaceholderText('https://api.deepseek.com');

describe('AiPanel', () => {
  beforeEach(() => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(useSettingsStore).mockReturnValue({
      settings: { globalAiSettings: { baseUrl: '', model: '' } },
    });
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

  it('shows four message format options in a dropdown and defaults to DeepSeek', () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    const select = screen.getByRole('combobox', { name: 'Message Format' });
    const optionLabels = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent ?? '',
    );
    expect(optionLabels).toEqual([
      'OpenAI Compatible',
      'OpenAI Responses',
      'Anthropic Messages',
      'Love From DeepSeek',
    ]);
    expect(select).toHaveProperty('value', 'deepseek');
  });

  it('fills preset values when switching formats and keeps them per format', () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    const baseUrlInput = getBaseUrlInput();
    const modelInput = screen.getByPlaceholderText('deepseek-v4-flash');

    // 编辑 deepseek 草稿
    fireEvent.change(baseUrlInput, { target: { value: 'http://my-host/v1' } });
    fireEvent.change(modelInput, { target: { value: 'my-model' } });

    // 切到 Anthropic：填入预设
    fireEvent.change(screen.getByRole('combobox', { name: 'Message Format' }), {
      target: { value: 'anthropic' },
    });
    expect(screen.getByPlaceholderText('https://api.anthropic.com')).toHaveProperty(
      'value',
      'https://api.anthropic.com',
    );
    expect(screen.getByPlaceholderText('claude-sonnet-4-5')).toHaveProperty(
      'value',
      'claude-sonnet-4-5',
    );

    // 切回 DeepSeek：保留编辑值
    fireEvent.change(screen.getByRole('combobox', { name: 'Message Format' }), {
      target: { value: 'deepseek' },
    });
    expect(getBaseUrlInput()).toHaveProperty('value', 'http://my-host/v1');
    expect(screen.getByPlaceholderText('deepseek-v4-flash')).toHaveProperty('value', 'my-model');
  });

  it('defaults to DeepSeek for legacy saved configs without format, keeping saved values', () => {
    vi.mocked(useSettingsStore).mockReturnValue({
      settings: {
        globalAiSettings: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
      },
    });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    expect(screen.getByRole('combobox', { name: 'Message Format' })).toHaveProperty(
      'value',
      'deepseek',
    );
    // 旧配置值直接展示（行为等价迁移）
    expect(screen.getByPlaceholderText('https://api.deepseek.com')).toHaveProperty(
      'value',
      'https://api.deepseek.com/v1',
    );
  });

  it('shows a green success check after a successful connection test', async () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(getBaseUrlInput(), { target: { value: 'http://localhost:11434/v1' } });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Connection successful')).toBeTruthy();
    });
    expect(testAiConnection).toHaveBeenCalledWith({
      format: 'deepseek',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      apiKey: undefined,
    });
  });

  it('falls back to the saved API key when testing with an empty input', async () => {
    vi.mocked(AiConfigRepository.getConfig).mockResolvedValue({
      format: 'deepseek',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
      apiKey: 'saved-key-123',
    });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    // 等待「已保存 key」状态生效（占位符变化）
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Saved, enter to replace')).toBeTruthy();
    });

    fireEvent.change(getBaseUrlInput(), { target: { value: 'http://localhost:11434/v1' } });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      expect(testAiConnection).toHaveBeenCalledWith({
        format: 'deepseek',
        baseUrl: 'http://localhost:11434/v1',
        model: 'llama3.2',
        apiKey: 'saved-key-123',
      });
    });
  });

  it('shows a red cross after a failed connection test', async () => {
    vi.mocked(testAiConnection).mockResolvedValue({ ok: false, code: 'NETWORK' });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(getBaseUrlInput(), { target: { value: 'http://localhost:11434/v1' } });
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

  it('shows debug error info below the AI Integration card after a failed test', async () => {
    vi.mocked(testAiConnection).mockResolvedValue({
      ok: false,
      code: 'AUTH_FAILED',
      message: 'HTTP 401: Invalid API key',
    });
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(getBaseUrlInput(), { target: { value: 'http://localhost:11434/v1' } });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
      target: { value: 'llama3.2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Test' }));

    await waitFor(() => {
      const debugText = screen.getByText(/\[AUTH_FAILED\] HTTP 401: Invalid API key/);
      expect(debugText.className).toContain('text-error');
      // debug 信息位于 AI 集成卡片下方，而非卡片内部
      expect(debugText.closest('.config-item')).toBeNull();
      const card = debugText.previousElementSibling;
      expect(card?.classList.contains('card')).toBeTruthy();
    });
  });

  it('orders fields as Message Format, Base URL, API Key, Model Name and keeps input widths aligned', () => {
    const { container } = render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    const rows = Array.from(container.querySelectorAll('.config-item'));
    const fieldTexts = rows.map((row) => row.querySelector('span')?.textContent ?? '');
    const order = ['Message Format', 'Base URL', 'API Key (optional)', 'Model Name'];
    const positions = order.map((label) => fieldTexts.indexOf(label));
    expect(positions).toEqual([0, 1, 2, 3]);

    // 字段行共享同一等宽两列网格布局类
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

  it('persists the current format when saving', async () => {
    render(<AiPanel onRegisterReset={vi.fn()} bookKey='' />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Message Format' }), {
      target: { value: 'anthropic' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(AiConfigRepository.saveConfig).toHaveBeenCalledWith(
        {},
        'https://api.anthropic.com',
        'claude-sonnet-4-5',
        'anthropic',
      );
    });
  });
});

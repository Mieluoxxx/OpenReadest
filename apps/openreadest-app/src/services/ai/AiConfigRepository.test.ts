import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiConfigRepository } from './AiConfigRepository';

vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(),
  },
}));

vi.mock('@/services/environment', () => ({
  default: {
    getAppService: vi.fn(),
  },
}));

import { useSettingsStore } from '@/store/settingsStore';
import environmentConfig from '@/services/environment';

const getStateMock = vi.mocked(useSettingsStore.getState);
const getAppServiceMock = vi.mocked(environmentConfig.getAppService);

const mockSettings = (globalAiSettings?: Record<string, unknown>) => {
  getStateMock.mockReturnValue({
    settings: { globalAiSettings },
    setSettings: vi.fn(),
    saveSettings: vi.fn(),
  } as unknown as ReturnType<typeof useSettingsStore.getState>);
};

describe('AiConfigRepository — format 迁移', () => {
  beforeEach(() => {
    // 秘密文件不存在 → readApiKey 返回 undefined
    getAppServiceMock.mockResolvedValue({
      readFile: vi.fn().mockRejectedValue(new Error('not found')),
      writeFile: vi.fn(),
      deleteFile: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('无 format 的旧配置解析为 openai-chat（行为等价迁移）', async () => {
    mockSettings({ baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' });
    const config = await AiConfigRepository.getConfig();
    expect(config.format).toBe('openai-chat');
    expect(config.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(config.model).toBe('deepseek-v4-flash');
  });

  it('缺失 globalAiSettings 时归一为 openai-chat', async () => {
    mockSettings(undefined);
    const config = await AiConfigRepository.getConfig();
    expect(config.format).toBe('openai-chat');
  });

  it('未知/非法 format 值归一为 openai-chat', async () => {
    mockSettings({ baseUrl: 'x', model: 'y', format: 'weird-format' });
    const config = await AiConfigRepository.getConfig();
    expect(config.format).toBe('openai-chat');
  });

  it.each(['openai-chat', 'openai-responses', 'anthropic', 'deepseek'] as const)(
    '合法 format %s 透传',
    async (format) => {
      mockSettings({ baseUrl: 'x', model: 'y', format });
      const config = await AiConfigRepository.getConfig();
      expect(config.format).toBe(format);
    },
  );

  it('saveConfig 持久化 format 到 globalAiSettings', async () => {
    mockSettings({ baseUrl: 'old', model: 'old-model', format: 'deepseek' });
    const saveSettings = vi.fn().mockResolvedValue(undefined);
    getStateMock.mockReturnValue({
      settings: { globalAiSettings: { baseUrl: 'old', model: 'old-model', format: 'deepseek' } },
      setSettings: vi.fn(),
      saveSettings,
    } as unknown as ReturnType<typeof useSettingsStore.getState>);

    await AiConfigRepository.saveConfig(
      {} as never,
      'https://api.anthropic.com',
      'claude-x',
      'anthropic',
    );

    const saved = saveSettings.mock.calls[0]![1] as {
      globalAiSettings: { baseUrl: string; model: string; format: string };
    };
    expect(saved.globalAiSettings).toEqual({
      baseUrl: 'https://api.anthropic.com',
      model: 'claude-x',
      format: 'anthropic',
    });
  });
});

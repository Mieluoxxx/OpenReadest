import environmentConfig, { EnvConfigType } from '@/services/environment';
import { useSettingsStore } from '@/store/settingsStore';
import type { AiSettings } from '@/types/settings';

/** API Key 秘密文件名（存于 Settings 目录，与 settings.json 分离、不随云同步）。 */
const AI_SECRETS_FILENAME = 'ai-secrets.json';

export interface AiConfig {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const readApiKey = async (): Promise<string | undefined> => {
  try {
    const appService = await environmentConfig.getAppService();
    const content = await appService.readFile(AI_SECRETS_FILENAME, 'Settings', 'text');
    const parsed = JSON.parse(content as string) as { apiKey?: unknown };
    return typeof parsed?.apiKey === 'string' ? parsed.apiKey : undefined;
  } catch {
    // 文件不存在或解析失败 → 视为无 key（API Key 可选）
    return undefined;
  }
};

const writeApiKey = async (apiKey: string): Promise<void> => {
  const appService = await environmentConfig.getAppService();
  await appService.writeFile(AI_SECRETS_FILENAME, 'Settings', JSON.stringify({ apiKey }, null, 2));
};

export const AiConfigRepository = {
  /**
   * 同步读取非敏感配置（Base URL / 模型），供 getCacheNamespace / isConfigured 等
   * 无法异步的场景使用；不依赖 React 渲染上下文。
   */
  getNonSecretConfig(): AiSettings {
    const { globalAiSettings } = useSettingsStore.getState().settings;
    return globalAiSettings ?? { baseUrl: '', model: '' };
  },

  /** 配置完整判定：baseUrl && model（API Key 可选）。 */
  isConfigured(): boolean {
    const { baseUrl, model } = AiConfigRepository.getNonSecretConfig();
    return !!baseUrl && !!model;
  },

  /** 聚合读取完整配置（含异步读取的秘密文件中的 API Key）。 */
  async getConfig(): Promise<AiConfig> {
    const { baseUrl, model } = AiConfigRepository.getNonSecretConfig();
    const apiKey = await readApiKey();
    return { baseUrl, model, apiKey };
  },

  /** 保存非敏感配置（写 zustand store + 持久化 settings.json）。 */
  async saveConfig(envConfig: EnvConfigType, baseUrl: string, model: string): Promise<void> {
    const { settings, setSettings, saveSettings } = useSettingsStore.getState();
    const next: typeof settings = { ...settings, globalAiSettings: { baseUrl, model } };
    setSettings(next);
    await saveSettings(envConfig, next);
  },

  /** 保存 API Key 到本地明文秘密文件。 */
  async saveApiKey(apiKey: string): Promise<void> {
    await writeApiKey(apiKey);
  },

  /** 清除 API Key（保留 Base URL / 模型）。 */
  async clearApiKey(): Promise<void> {
    try {
      const appService = await environmentConfig.getAppService();
      await appService.deleteFile(AI_SECRETS_FILENAME, 'Settings');
    } catch {
      // 文件不存在等 → 幂等忽略
    }
  },
};

import { md5 } from 'js-md5';
import { stubTranslation as _ } from '@/utils/misc';
import { TranslationProvider } from '../types';
import { AI_PROMPT_VERSION, AiError, requestAiTranslation } from '@/services/ai/aiClient';
import { AiConfigRepository } from '@/services/ai/AiConfigRepository';

const getCacheNamespace = (): string => {
  const { baseUrl, model } = AiConfigRepository.getNonSecretConfig();
  return `ai:${md5(`${baseUrl}|${model}|${AI_PROMPT_VERSION}`)}`;
};

export const aiProvider: TranslationProvider = {
  name: 'ai',
  label: _('AI Translate'),
  // 不使用 authRequired（该字段 = 需要 OpenReadest 登录 token）；
  // AI 可用性由 AiConfigRepository.isConfigured() 判定。
  getCacheNamespace,
  translate: async (texts: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
    const config = await AiConfigRepository.getConfig();
    if (!config.baseUrl || !config.model) {
      throw new AiError('NOT_CONFIGURED', 'AI service is not configured.');
    }

    // requestAiTranslation 在客户端层做全局并发限制与同请求去重；
    // 这里仅保持输入索引对齐，空白项原样回填。
    return Promise.all(
      texts.map((text) =>
        text?.trim()
          ? requestAiTranslation(config, text, sourceLang, targetLang)
          : Promise.resolve(text),
      ),
    );
  },
};

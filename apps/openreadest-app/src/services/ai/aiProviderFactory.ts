import { createAnthropic } from '@ai-sdk/anthropic';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { LanguageModel } from 'ai';
import { isTauriAppPlatform } from '@/services/environment';
import type { AiConfig } from './AiConfigRepository';

/**
 * 平台 fetch：Tauri 桌面端注入插件 fetch（走系统 HTTP 栈），web 端用 window.fetch。
 * 每次调用动态获取，避免模块加载时捕获的全局 fetch 引用失效（测试注入/平台切换场景）。
 * tauriFetch 签名 (input, init?) => Promise<Response> 与 SDK fetch 兼容（spike 已验证）。
 */
const getPlatformFetch = (): typeof fetch =>
  isTauriAppPlatform() ? (tauriFetch as typeof fetch) : fetch;

/**
 * 按消息格式构建 AI SDK 语言模型（provider 实例 + 模型句柄）。
 * 实例不缓存：每次按 config 现建，避免持有过期 apiKey；调用方按需 memo。
 */
export const createAiModel = (config: AiConfig): LanguageModel => {
  const platformFetch = getPlatformFetch();
  switch (config.format) {
    case 'openai-chat':
      // OpenAI Chat Completions 协议 + 任意兼容端点（createOpenAICompatible 是正确抽象）。
      return createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        fetch: platformFetch,
      })(config.model);
    case 'openai-responses':
      // 官方 OpenAI Responses API。
      return createOpenAI({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        fetch: platformFetch,
      }).responses(config.model);
    case 'anthropic':
      // Anthropic Messages API。
      return createAnthropic({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        fetch: platformFetch,
      })(config.model);
    case 'deepseek':
      // DeepSeek 官方 provider（baseURL 默认 https://api.deepseek.com，支持自定义）。
      return createDeepSeek({
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        fetch: platformFetch,
      })(config.model);
  }
};

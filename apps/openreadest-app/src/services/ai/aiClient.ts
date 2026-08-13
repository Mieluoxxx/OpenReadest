import { APICallError, NoSuchModelError, RetryError, generateText } from 'ai';
import type { AiFormat } from '@/types/settings';
import type { AiConfig } from './AiConfigRepository';
import { createAiModel } from './aiProviderFactory';

/** 版本号参与缓存命名空间，提示词变更时递增以使旧缓存失效。 */
export const AI_PROMPT_VERSION = 1;

/** 整个操作（含重试）的总截止超时（毫秒）。 */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** 页面级全局并发上限。每个段落会独立调用 provider，因此必须在客户端层限流。 */
export const AI_MAX_CONCURRENCY = 3;

/** SDK 重试次数（传给 generateText maxRetries，429/5xx/网络错误由 SDK 接管）。 */
export const AI_MAX_RETRIES = 2;

export type AiErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_FAILED'
  | 'ENDPOINT_OR_MODEL_ERROR'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'TIMEOUT'
  | 'BAD_RESPONSE'
  | 'NETWORK';

export class AiError extends Error {
  code: AiErrorCode;
  statusCode?: number;

  constructor(code: AiErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export { createAiModel };

const buildSystemPrompt = (sourceLang: string, targetLang: string): string => {
  return [
    'You are a translation engine.',
    'Translate the user-provided text from the source language to the target language.',
    'Rules:',
    '- Return ONLY the translation, no explanations, no headings, no Markdown.',
    '- Preserve the original paragraph and line structure.',
    '- Keep proper nouns and names consistent.',
    `Source language: ${sourceLang || 'auto'}`,
    `Target language: ${targetLang}`,
  ].join('\n');
};

const classifyHttpError = (status: number): AiErrorCode => {
  if (status === 401 || status === 403) return 'AUTH_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 400 && status < 500) return 'ENDPOINT_OR_MODEL_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  return 'ENDPOINT_OR_MODEL_ERROR';
};

/**
 * SDK 错误 → 8 种 AiErrorCode 归一映射。
 * - APICallError：>=400 按 HTTP 状态分类；2xx/3xx（响应解析失败等）→ BAD_RESPONSE
 * - NoSuchModelError → ENDPOINT_OR_MODEL_ERROR
 * - RetryError → 取 lastError（重试耗尽后的原始错误）递归映射
 * - AbortError（abortSignal 触发）→ TIMEOUT
 * - 其余：网络类错误特征 → NETWORK；其余未知（SDK 解析崩溃等）→ BAD_RESPONSE
 */
const NETWORK_ERROR_PATTERN =
  /fetch failed|failed to fetch|networkerror|network error|load failed/i;

const toAiError = (error: unknown): AiError => {
  if (error instanceof AiError) return error;
  if (error instanceof APICallError) {
    if (typeof error.statusCode === 'number' && error.statusCode >= 400) {
      return new AiError(
        classifyHttpError(error.statusCode),
        `HTTP ${error.statusCode}: ${error.message}`,
        error.statusCode,
      );
    }
    // 2xx/3xx 的 APICallError：响应解析失败等（如 Invalid JSON response）。
    return new AiError('BAD_RESPONSE', error.message);
  }
  if (error instanceof NoSuchModelError) {
    return new AiError('ENDPOINT_OR_MODEL_ERROR', error.message);
  }
  if (error instanceof RetryError) {
    if (error.lastError) return toAiError(error.lastError);
    return new AiError('NETWORK', error.message);
  }
  if (error instanceof Error && error.name === 'AbortError') {
    return new AiError('TIMEOUT', 'AI request timed out.');
  }
  const message =
    error instanceof Error ? error.message : 'AI request failed due to a network error.';
  if (NETWORK_ERROR_PATTERN.test(message)) {
    return new AiError('NETWORK', message);
  }
  // SDK 内部解析崩溃（如空 choices 时读 undefined）等未知错误：按响应不可用处理。
  return new AiError('BAD_RESPONSE', message || 'AI service returned an invalid response.');
};

let activeRequestCount = 0;
const pendingRequests: Array<() => void> = [];
const inFlightRequests = new Map<string, Promise<string>>();

const runWithRequestSlot = <T>(task: () => Promise<T>): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeRequestCount += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeRequestCount -= 1;
          pendingRequests.shift()?.();
        });
    };
    if (activeRequestCount < AI_MAX_CONCURRENCY) run();
    else pendingRequests.push(run);
  });
};

export interface AiCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 拆分 system 消息：AI SDK v7 不允许 system 出现在 messages 字段，
 * 需通过 instructions 选项传入（SDK 会转为请求体中的 system 消息）。
 */
const splitSystemMessages = (messages: AiCompletionMessage[]) => {
  const instructions: string[] = [];
  const rest: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const message of messages) {
    if (message.role === 'system') {
      instructions.push(message.content);
    } else {
      rest.push({ role: message.role, content: message.content });
    }
  }
  return { instructions: instructions.join('\n\n') || undefined, messages: rest };
};

const requestAiCompletionOnce = async (
  config: AiConfig,
  messages: AiCompletionMessage[],
  options?: { temperature?: number },
): Promise<string> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  try {
    const { instructions, messages: sdkMessages } = splitSystemMessages(messages);
    const result = await generateText({
      model: createAiModel(config),
      instructions,
      messages: sdkMessages,
      temperature: options?.temperature,
      abortSignal: controller.signal,
      maxRetries: AI_MAX_RETRIES,
    });
    const text = result.text?.trim();
    if (!text) {
      throw new AiError('BAD_RESPONSE', 'AI service returned an empty response.');
    }
    return text;
  } catch (err) {
    throw toAiError(err);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * 通用 AI 完成入口（字符串输出）。SDK 负责多协议请求/响应解析与重试；
 * 本层保留并发限流 ×3、同请求去重与 30s 总截止超时（SDK 不提供的部分）。
 * 失败抛 AiError（归一错误码）。
 */
export const requestAiCompletion = (
  config: AiConfig,
  messages: AiCompletionMessage[],
  options?: { temperature?: number },
): Promise<string> => {
  if (!config.baseUrl?.trim() || !config.model?.trim()) {
    return Promise.reject(new AiError('NOT_CONFIGURED', 'AI service is not configured.'));
  }
  const key = JSON.stringify([config.format, config.baseUrl, config.model, messages]);
  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const request = runWithRequestSlot(() => requestAiCompletionOnce(config, messages, options));
  inFlightRequests.set(key, request);
  request.then(
    () => inFlightRequests.delete(key),
    () => inFlightRequests.delete(key),
  );
  return request;
};

/**
 * 请求一次 AI 翻译。返回译文；失败抛 AiError（归一错误码）。
 * 每次仅发送单条文本，不聚合整书。
 */
export const requestAiTranslation = (
  config: AiConfig,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> => {
  return requestAiCompletion(
    config,
    [
      { role: 'system', content: buildSystemPrompt(sourceLang, targetLang) },
      { role: 'user', content: text },
    ],
    { temperature: 0.3 },
  );
};

export interface TestAiConnectionResult {
  ok: boolean;
  code?: AiErrorCode;
  message?: string;
}

/** 用草稿配置发一次最小请求，返回归一结果（复用 requestAiCompletion 的错误分类）。 */
export const testAiConnection = async (draft: {
  format: AiFormat;
  baseUrl: string;
  model: string;
  apiKey?: string;
}): Promise<TestAiConnectionResult> => {
  try {
    await requestAiTranslation(draft, 'Hello, world!', 'en', 'zh-Hans');
    return { ok: true };
  } catch (err) {
    if (err instanceof AiError) {
      return { ok: false, code: err.code, message: err.message };
    }
    return { ok: false, code: 'NETWORK', message: String(err) };
  }
};

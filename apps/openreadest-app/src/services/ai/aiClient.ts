import { fetch as tauriFetch } from '@tauri-apps/plugin-http';
import { isTauriAppPlatform } from '@/services/environment';
import type { AiConfig } from './AiConfigRepository';

/** 版本号参与缓存命名空间，提示词变更时递增以使旧缓存失效。 */
export const AI_PROMPT_VERSION = 1;

/** 默认请求超时（毫秒）。 */
export const AI_REQUEST_TIMEOUT_MS = 30_000;

/** 页面级全局并发上限。每个段落会独立调用 provider，因此必须在客户端层限流。 */
export const AI_MAX_CONCURRENCY = 3;

/** 网络/超时/限流/服务端错误的自动重试次数。 */
export const AI_MAX_RETRIES = 2;
const AI_RETRY_BASE_DELAY_MS = 500;

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

/**
 * 确定性规范化 Base URL：trim 尾部 `/` 后追加 `/chat/completions`；
 * 若已以该 endpoint 结尾则直接使用。空输入返回空串。
 */
export const normalizeBaseUrl = (raw: string): string => {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/chat/completions')) return trimmed;
  return `${trimmed}/chat/completions`;
};

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

const extractTextContent = (content: unknown): string | null => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return null;

  const parts = content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join('') : null;
};

const extractCompletionText = (data: unknown): string | null => {
  if (!data || typeof data !== 'object') return null;
  const payload = data as {
    choices?: Array<{
      message?: { content?: unknown };
      delta?: { content?: unknown };
      text?: unknown;
    }>;
    output_text?: unknown;
  };
  const choice = payload.choices?.[0];
  return (
    extractTextContent(choice?.message?.content) ??
    extractTextContent(choice?.delta?.content) ??
    extractTextContent(choice?.text) ??
    extractTextContent(payload.output_text)
  );
};

const parseSseCompletion = (body: string): string | null => {
  const parts: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const text = extractCompletionText(JSON.parse(data));
      if (text) parts.push(text);
    } catch {
      // 忽略心跳/非 JSON SSE 行；最终无内容时统一报 BAD_RESPONSE。
    }
  }
  return parts.length > 0 ? parts.join('') : null;
};

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return typeof response.text === 'function' ? await response.text() : '';
  } catch {
    return '';
  }
};

const getContentType = (response: Response): string => {
  try {
    return response.headers?.get('content-type')?.toLowerCase() ?? '';
  } catch {
    return '';
  }
};

const looksLikeHtml = (body: string): boolean => /^\s*(?:<!doctype\s+html|<html\b)/i.test(body);

const parseSuccessResponse = (body: string, contentType: string): string => {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new AiError('BAD_RESPONSE', 'AI service returned an empty response.');
  }

  if (contentType.includes('text/event-stream') || /^data:/m.test(trimmed)) {
    const streamed = parseSseCompletion(trimmed);
    if (streamed?.trim()) return streamed.trim();
    throw new AiError('BAD_RESPONSE', 'AI service returned an invalid event stream.');
  }

  try {
    const content = extractCompletionText(JSON.parse(trimmed));
    if (content?.trim()) return content.trim();
    throw new AiError('BAD_RESPONSE', 'Response does not contain translation content.');
  } catch (error) {
    if (error instanceof AiError) throw error;
  }

  // 一些兼容服务直接返回 text/plain；HTML 常代表代理/网关错误页，不能当译文。
  if (!looksLikeHtml(trimmed) && (!contentType || contentType.includes('text/plain'))) {
    return trimmed;
  }
  throw new AiError(
    'BAD_RESPONSE',
    `AI service returned unsupported content${contentType ? ` (${contentType})` : ''}.`,
  );
};

const extractProviderErrorMessage = (body: string): string | null => {
  if (!body.trim() || looksLikeHtml(body)) return null;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const message = parsed.error?.message ?? parsed.message;
    return typeof message === 'string' ? message.slice(0, 240) : null;
  } catch {
    return body.trim().slice(0, 240);
  }
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

const getRequestKey = (
  config: AiConfig,
  text: string,
  sourceLang: string,
  targetLang: string,
): string => JSON.stringify([config.baseUrl, config.model, sourceLang, targetLang, text]);

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const isRetryableAiError = (error: unknown): error is AiError => {
  return (
    error instanceof AiError &&
    ['NETWORK', 'TIMEOUT', 'RATE_LIMITED', 'SERVER_ERROR'].includes(error.code)
  );
};

/**
 * 请求一次 Chat Completions 翻译。返回译文；失败抛 AiError（归一错误码）。
 * 每次仅发送单条文本，不聚合整书。
 */
const requestAiTranslationOnce = async (
  config: AiConfig,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> => {
  const url = normalizeBaseUrl(config.baseUrl);
  if (!url || !config.model) {
    throw new AiError('NOT_CONFIGURED', 'AI service is not configured.');
  }

  const fetchImpl = isTauriAppPlatform() ? tauriFetch : window.fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream, text/plain',
  };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: buildSystemPrompt(sourceLang, targetLang) },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });

    const body = await readResponseText(response);
    if (!response.ok) {
      const detail = extractProviderErrorMessage(body);
      throw new AiError(
        classifyHttpError(response.status),
        detail ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`,
        response.status,
      );
    }
    return parseSuccessResponse(body, getContentType(response));
  } catch (err) {
    if (err instanceof AiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('TIMEOUT', 'AI request timed out.');
    }
    const message =
      err instanceof Error ? err.message : 'AI request failed due to a network error.';
    throw new AiError('NETWORK', message);
  } finally {
    clearTimeout(timeoutId);
  }
};

const requestAiTranslationWithRetry = async (
  config: AiConfig,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestAiTranslationOnce(config, text, sourceLang, targetLang);
    } catch (error) {
      if (!isRetryableAiError(error) || attempt >= AI_MAX_RETRIES) throw error;
      await sleep(AI_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
};

export const requestAiTranslation = (
  config: AiConfig,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> => {
  const key = getRequestKey(config, text, sourceLang, targetLang);
  const existing = inFlightRequests.get(key);
  if (existing) return existing;

  const request = runWithRequestSlot(() =>
    requestAiTranslationWithRetry(config, text, sourceLang, targetLang),
  );
  inFlightRequests.set(key, request);
  request.then(
    () => inFlightRequests.delete(key),
    () => inFlightRequests.delete(key),
  );
  return request;
};

export interface TestAiConnectionResult {
  ok: boolean;
  code?: AiErrorCode;
  message?: string;
}

/** 用草稿配置发一次最小请求，返回归一结果（复用 requestAiTranslation 的错误分类）。 */
export const testAiConnection = async (draft: {
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_MAX_CONCURRENCY,
  AI_REQUEST_TIMEOUT_MS,
  requestAiCompletion,
  requestAiTranslation,
} from './aiClient';
import type { AiConfig } from './AiConfigRepository';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

const openAiChatConfig: AiConfig = {
  format: 'openai-chat',
  baseUrl: 'https://host/v1',
  model: 'test-model',
  apiKey: 'sk-test',
};

const jsonHeaders = { 'content-type': 'application/json' };

const mockChatOk = (text = '你好') =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      status: 200,
      headers: jsonHeaders,
    }),
  );

const mockChatError = (status: number) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ error: { message: 'provider error' } }), {
      status,
      headers: jsonHeaders,
    }),
  );

interface ChatRequestBody {
  model?: string;
  temperature?: number;
  messages?: Array<{ role: string; content: string }>;
  input?: unknown;
  [key: string]: unknown;
}

const chatBodyOf = (init?: RequestInit): ChatRequestBody =>
  JSON.parse((init?.body as string) ?? '{}') as ChatRequestBody;

describe('requestAiCompletion — 协议契约（确定性 mock fetch，不依赖外部凭据）', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('openai-chat: POST {baseURL}/chat/completions，body 含 model/messages/temperature', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiCompletion(openAiChatConfig, [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);

    expect(result).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://host/v1/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    const body = chatBodyOf(init as RequestInit);
    expect(body.model).toBe('test-model');
    expect(body.temperature).toBeUndefined();
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'hello' },
    ]);
  });

  it('openai-chat: 尾斜杠 baseURL 被 SDK 规范化', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    await requestAiCompletion({ ...openAiChatConfig, baseUrl: 'https://host/v1/' }, [
      { role: 'user', content: 'hi' },
    ]);

    expect(fetchMock.mock.calls[0]![0]).toBe('https://host/v1/chat/completions');
  });

  it('openai-responses: POST {baseURL}/responses，input 消息结构', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              type: 'message',
              role: 'assistant',
              id: 'msg_1',
              content: [{ type: 'output_text', text: '你好', annotations: [] }],
            },
          ],
        }),
        { status: 200, headers: jsonHeaders },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiCompletion(
      {
        format: 'openai-responses',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-5',
        apiKey: 'sk-test',
      },
      [{ role: 'user', content: 'hello' }],
    );

    expect(result).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect((init as RequestInit).method).toBe('POST');
    const body = chatBodyOf(init as RequestInit);
    expect(body.model).toBe('gpt-5');
    expect(body.input).toEqual([
      { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
    ]);
  });

  it('anthropic: POST {baseURL}/v1/messages，x-api-key 鉴权头', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'message',
          content: [{ type: 'text', text: '你好' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: jsonHeaders },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiCompletion(
      {
        format: 'anthropic',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-sonnet-4-5',
        apiKey: 'sk-test',
      },
      [{ role: 'user', content: 'hello' }],
    );

    expect(result).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-test');
    expect(headers['anthropic-version']).toBeTruthy();
    const body = chatBodyOf(init as RequestInit);
    expect(body.model).toBe('claude-sonnet-4-5');
  });

  it('deepseek: POST https://api.deepseek.com/chat/completions', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiCompletion(
      {
        format: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        apiKey: 'sk-test',
      },
      [{ role: 'user', content: 'hello' }],
    );

    expect(result).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect((init as RequestInit).method).toBe('POST');
    expect(chatBodyOf(init as RequestInit).model).toBe('deepseek-v4-flash');
  });

  it('未配置 apiKey 时不发送 Authorization 头（无 env 回退）', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    await requestAiCompletion(
      { format: 'openai-chat', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
      [{ role: 'user', content: 'hi' }],
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
  });
});

describe('requestAiCompletion — 错误归一映射', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('throws NOT_CONFIGURED when baseUrl or model is missing (no fetch)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestAiTranslation({ ...openAiChatConfig, model: '' }, 'hi', 'en', 'zh-Hans'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    await expect(
      requestAiTranslation({ ...openAiChatConfig, baseUrl: '  ' }, 'hi', 'en', 'zh-Hans'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'AUTH_FAILED'],
    [403, 'AUTH_FAILED'],
    [404, 'ENDPOINT_OR_MODEL_ERROR'],
    [422, 'ENDPOINT_OR_MODEL_ERROR'],
    [500, 'SERVER_ERROR'],
    [503, 'SERVER_ERROR'],
  ])('HTTP %i → %s', async (status, code) => {
    vi.useFakeTimers();
    const fetchMock = mockChatError(status);
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({ code });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('throws RATE_LIMITED on 429 after SDK retries (3 calls)', async () => {
    vi.useFakeTimers();
    const fetchMock = mockChatError(429);
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws TIMEOUT when the 30s deadline elapses (abort)', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);
    await assertion;
  });

  it('throws NETWORK on a fetch rejection', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({ code: 'NETWORK' });
    await vi.runAllTimersAsync();
    await assertion;
  });

  it('throws BAD_RESPONSE on an empty choices response', async () => {
    vi.stubGlobal('fetch', mockChatOkWithChoices([]));
    await expect(
      requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans'),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('throws BAD_RESPONSE on invalid JSON body', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } }),
        ),
    );
    await expect(
      requestAiTranslation(openAiChatConfig, 'hi', 'en', 'zh-Hans'),
    ).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });
});

describe('requestAiTranslation — 行为回归', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('assembles system + user messages with temperature 0.3 and returns the translation', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiTranslation(openAiChatConfig, 'hello', 'en', 'zh-Hans');

    expect(result).toBe('你好');
    const [, init] = fetchMock.mock.calls[0]!;
    const body = chatBodyOf(init as RequestInit);
    expect(body.temperature).toBe(0.3);
    expect((body.messages as Array<{ role: string }>).map((m) => m.role)).toEqual([
      'system',
      'user',
    ]);
    const userMsg = (body.messages as Array<{ content: string }>)[1]!;
    expect(userMsg.content).toBe('hello');
  });

  it('deduplicates concurrent identical requests', async () => {
    const fetchMock = mockChatOk();
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      requestAiTranslation(openAiChatConfig, 'same text', 'en', 'zh-Hans'),
      requestAiTranslation(openAiChatConfig, 'same text', 'en', 'zh-Hans'),
    ]);

    expect(first).toBe('你好');
    expect(second).toBe('你好');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it(`limits concurrency to ${AI_MAX_CONCURRENCY}`, async () => {
    const resolvers: Array<() => void> = [];
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(() =>
            resolve(
              new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
                status: 200,
                headers: jsonHeaders,
              }),
            ),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const requests = ['t1', 't2', 't3', 't4'].map((t) =>
      requestAiTranslation(openAiChatConfig, t, 'en', 'zh-Hans'),
    );
    // 等待前 3 个进入 fetch，第 4 个在队列等待
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(AI_MAX_CONCURRENCY));

    // 释放一个槽位，第 4 个进入 fetch
    resolvers[0]?.();
    await requests[0]!;
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(AI_MAX_CONCURRENCY + 1));

    resolvers.forEach((resolve) => resolve());
    await expect(Promise.all(requests)).resolves.toEqual(['ok', 'ok', 'ok', 'ok']);
  });
});

const mockChatOkWithChoices = (choices: unknown[]) =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ choices }), { status: 200, headers: jsonHeaders }),
    );

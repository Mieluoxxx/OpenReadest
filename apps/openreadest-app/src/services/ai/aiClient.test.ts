import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeBaseUrl, requestAiTranslation } from './aiClient';

vi.mock('@tauri-apps/plugin-http', () => ({ fetch: vi.fn() }));

const config = { baseUrl: 'https://host/v1', model: 'test-model', apiKey: 'sk-test' };

const mockOkResponse = (choices: unknown[] = [{ message: { content: '你好' } }]) =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify({ choices }),
  });

describe('normalizeBaseUrl', () => {
  it('trims trailing slashes and appends /chat/completions', () => {
    expect(normalizeBaseUrl('https://host/v1/')).toBe('https://host/v1/chat/completions');
    expect(normalizeBaseUrl('https://host/v1')).toBe('https://host/v1/chat/completions');
  });

  it('keeps an existing /chat/completions endpoint unchanged', () => {
    expect(normalizeBaseUrl('https://host/v1/chat/completions')).toBe(
      'https://host/v1/chat/completions',
    );
  });

  it('returns empty for empty or whitespace input', () => {
    expect(normalizeBaseUrl('')).toBe('');
    expect(normalizeBaseUrl('   ')).toBe('');
  });
});

describe('requestAiTranslation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('extracts translation from an OpenAI-compatible response and sends expected body', async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestAiTranslation(config, 'hello', 'en', 'zh-Hans');

    expect(result).toBe('你好');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://host/v1/chat/completions');
    const body = JSON.parse((init as { body?: string }).body ?? '{}') as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe('test-model');
    expect((body as { stream?: boolean }).stream).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0]?.role).toBe('system');
    expect(body.messages[1]?.content).toBe('hello');
  });

  it('normalizes a trailing-slash base URL in the request URL', async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal('fetch', fetchMock);

    await requestAiTranslation({ ...config, baseUrl: 'https://host/v1/' }, 'hi', 'en', 'zh-Hans');

    expect(fetchMock.mock.calls[0]![0]).toBe('https://host/v1/chat/completions');
  });

  it('omits Authorization header when no apiKey is set', async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal('fetch', fetchMock);

    await requestAiTranslation(
      { baseUrl: config.baseUrl, model: config.model },
      'hi',
      'en',
      'zh-Hans',
    );

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = (init as { headers?: Record<string, string> }).headers ?? {};
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws NOT_CONFIGURED when model is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      requestAiTranslation({ ...config, model: '' }, 'hi', 'en', 'zh-Hans'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws AUTH_FAILED on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(requestAiTranslation(config, 'hi', 'en', 'zh-Hans')).rejects.toMatchObject({
      code: 'AUTH_FAILED',
    });
  });

  it('throws RATE_LIMITED on 429', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(config, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws ENDPOINT_OR_MODEL_ERROR on 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(requestAiTranslation(config, 'hi', 'en', 'zh-Hans')).rejects.toMatchObject({
      code: 'ENDPOINT_OR_MODEL_ERROR',
    });
  });

  it('throws BAD_RESPONSE on invalid response shape', async () => {
    vi.stubGlobal('fetch', mockOkResponse([]));

    await expect(requestAiTranslation(config, 'hi', 'en', 'zh-Hans')).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  it('throws TIMEOUT on abort error', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(config, 'hi', 'en', 'zh-Hans');
    const assertion = expect(request).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('accepts a non-empty text/plain translation response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => '你好',
      }),
    );

    await expect(requestAiTranslation(config, 'hello', 'en', 'zh-Hans')).resolves.toBe('你好');
  });

  it('assembles an SSE chat-completions response', async () => {
    const sse = [
      'data: {"choices":[{"delta":{"content":"你"}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"好"}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/event-stream' }),
        text: async () => sse,
      }),
    );

    await expect(requestAiTranslation(config, 'hello', 'en', 'zh-Hans')).resolves.toBe('你好');
  });

  it('deduplicates concurrent identical requests', async () => {
    const fetchMock = mockOkResponse();
    vi.stubGlobal('fetch', fetchMock);

    const [first, second] = await Promise.all([
      requestAiTranslation(config, 'same text', 'en', 'zh-Hans'),
      requestAiTranslation(config, 'same text', 'en', 'zh-Hans'),
    ]);

    expect(first).toBe('你好');
    expect(second).toBe('你好');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a transient network failure and returns the later success', async () => {
    const fetchMock = mockOkResponse();
    fetchMock.mockRejectedValueOnce(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    const request = requestAiTranslation(config, 'retry me', 'en', 'zh-Hans');
    const assertion = expect(request).resolves.toBe('你好');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects an HTML error page even when it has HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<!doctype html><html><body>gateway error</body></html>',
      }),
    );

    await expect(requestAiTranslation(config, 'hello', 'en', 'zh-Hans')).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });
});

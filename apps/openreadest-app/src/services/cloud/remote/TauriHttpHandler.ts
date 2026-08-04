import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

type SmithyQuery = Record<string, string | string[] | null>;

type SmithyHttpRequest = {
  protocol: string;
  hostname: string;
  port?: number;
  method: string;
  path: string;
  query?: SmithyQuery;
  headers: Record<string, string>;
  body?: BodyInit | null;
};

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const buildQueryString = (query?: SmithyQuery) => {
  if (!query) return '';
  const pairs: Array<[string, string | null]> = [];
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) pairs.push([key, item]);
    } else {
      pairs.push([key, value]);
    }
  }
  pairs.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyOrder = encodeRfc3986(leftKey).localeCompare(encodeRfc3986(rightKey));
    if (keyOrder !== 0) return keyOrder;
    return encodeRfc3986(leftValue ?? '').localeCompare(encodeRfc3986(rightValue ?? ''));
  });
  return pairs
    .map(([key, value]) =>
      value === null ? encodeRfc3986(key) : `${encodeRfc3986(key)}=${encodeRfc3986(value)}`,
    )
    .join('&');
};

export class TauriHttpHandler {
  async handle(
    request: SmithyHttpRequest,
    options?: { abortSignal?: AbortSignal },
  ): Promise<{
    response: {
      statusCode: number;
      reason: string;
      headers: Record<string, string>;
      body: ReadableStream<Uint8Array> | null;
    };
  }> {
    const protocol = request.protocol.endsWith(':') ? request.protocol : `${request.protocol}:`;
    const port = request.port ? `:${request.port}` : '';
    const query = buildQueryString(request.query);
    const url = `${protocol}//${request.hostname}${port}${request.path}${query ? `?${query}` : ''}`;
    const response = await tauriFetch(url, {
      method: request.method,
      headers: request.headers,
      body: request.body ?? null,
      signal: options?.abortSignal,
    });
    return {
      response: {
        statusCode: response.status,
        reason: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: response.body,
      },
    };
  }

  destroy() {}

  updateHttpClientConfig() {}

  httpHandlerConfigs() {
    return {};
  }
}


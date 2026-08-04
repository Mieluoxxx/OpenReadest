import { WebDavClient } from '@/services/webdav/client/WebDavClient';
import { WebDavResponse } from '@/services/webdav/client/types';
import { WebDavCloudProfile } from '../models';
import { normalizeObjectKey } from '../paths';
import { RemoteStorageError } from './errors';
import {
  RemoteAccessResult,
  RemoteListEntry,
  RemoteObjectMetadata,
  RemoteObjectStore,
} from './types';

const toMetadata = (
  key: string,
  resource: { etag?: string; lastModified?: string; contentLength?: number },
): RemoteObjectMetadata => ({
  key,
  etag: resource.etag,
  lastModified: resource.lastModified,
  size: resource.contentLength,
});

const throwWebDavError = <T>(response: WebDavResponse<T>, key?: string): never => {
  const statusCode = response.status || undefined;
  const code =
    statusCode === 401
      ? 'authentication_failed'
      : statusCode === 403
        ? 'permission_denied'
        : statusCode === 404
          ? 'not_found'
          : statusCode && statusCode >= 500
            ? 'server_error'
            : statusCode === 0
              ? 'network_error'
              : 'server_error';
  throw new RemoteStorageError(code, response.error || 'WebDAV request failed', {
    provider: 'webdav',
    statusCode,
    key,
  });
};

const requireWebDavData = <T>(response: WebDavResponse<T>, key?: string): T => {
  if (!response.ok || response.data === undefined) throwWebDavError(response, key);
  return response.data as T;
};

export class WebDavObjectStore implements RemoteObjectStore {
  readonly provider = 'webdav' as const;
  private readonly client: WebDavClient;

  constructor(config: WebDavCloudProfile['config']) {
    this.client = new WebDavClient({
      serverUrl: config.serverUrl,
      rootPath: config.remotePath,
      username: config.username,
      password: config.password,
      allowInsecureHttp: config.allowInsecureHttp,
      allowInsecureTls: config.allowInsecureTls,
    });
  }

  async testAccess(): Promise<RemoteAccessResult> {
    const response = await this.client.propfind('/', { depth: '0' });
    if (!response.ok) throwWebDavError(response);
    return {};
  }

  async listChildren(prefix: string): Promise<RemoteListEntry[]> {
    const normalizedPrefix = normalizeObjectKey(prefix);
    const response = await this.client.propfind(`/${normalizedPrefix}/`, { depth: '1' });
    const data = requireWebDavData(response, normalizedPrefix);
    return data.flatMap((resource) => {
      const key = normalizeObjectKey(resource.path);
      if (!key || key === normalizedPrefix) return [];
      const normalizedKey = resource.isCollection ? `${key}/` : key;
      return [
        {
          key: normalizedKey,
          kind: resource.isCollection ? ('prefix' as const) : ('object' as const),
          metadata: resource.isCollection ? undefined : toMetadata(key, resource),
        },
      ];
    });
  }

  async stat(key: string): Promise<RemoteObjectMetadata | null> {
    const normalizedKey = normalizeObjectKey(key);
    const response = await this.client.propfind(`/${normalizedKey}`, { depth: '0' });
    if (response.status === 404) return null;
    const data = requireWebDavData(response, normalizedKey);
    const resource = data.find((item) => normalizeObjectKey(item.path) === normalizedKey);
    return resource ? toMetadata(normalizedKey, resource) : null;
  }

  async read(key: string): Promise<Uint8Array> {
    const normalizedKey = normalizeObjectKey(key);
    const response = await this.client.get(`/${normalizedKey}`);
    const data = requireWebDavData(response, normalizedKey);
    return new Uint8Array(data);
  }

  async write(
    key: string,
    data: Uint8Array,
    options?: { contentType?: string },
  ): Promise<RemoteObjectMetadata> {
    const normalizedKey = normalizeObjectKey(key);
    await this.ensureParentCollections(normalizedKey);
    const response = await this.client.put(`/${normalizedKey}`, data, options);
    if (!response.ok) throwWebDavError(response, normalizedKey);
    return (
      (await this.stat(normalizedKey)) ?? {
        key: normalizedKey,
        size: data.byteLength,
      }
    );
  }

  private async ensureParentCollections(key: string): Promise<void> {
    const parts = normalizeObjectKey(key).split('/').slice(0, -1);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const response = await this.client.mkcol(`/${current}`);
      if (!response.ok) throwWebDavError(response, current);
    }
  }
}

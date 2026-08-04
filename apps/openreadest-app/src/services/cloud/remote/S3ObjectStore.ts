import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { isTauriAppPlatform } from '@/services/environment';
import { S3CloudProfile } from '../models';
import { CLOUD_ROOT_DIRNAME, joinObjectKeys, normalizeObjectKey } from '../paths';
import { RemoteStorageError, RemoteStorageErrorCode } from './errors';
import { TauriHttpHandler } from './TauriHttpHandler';
import {
  RemoteAccessResult,
  RemoteListEntry,
  RemoteObjectMetadata,
  RemoteObjectStore,
} from './types';

type S3AddressingStyle = 'virtual' | 'path';

type AwsErrorLike = Error & {
  name: string;
  $metadata?: {
    httpStatusCode?: number;
    requestId?: string;
  };
};

const normalizeEtag = (etag?: string) => etag?.replace(/^W\//, '').replace(/^"|"$/g, '');

const withTrailingSlash = (value: string) => (value && !value.endsWith('/') ? `${value}/` : value);

const getErrorName = (error: unknown) =>
  error instanceof Error ? error.name : typeof error === 'object' && error ? String((error as { name?: unknown }).name ?? '') : '';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : '');

const getErrorMetadata = (error: unknown) => {
  const candidate = error as AwsErrorLike | undefined;
  return {
    statusCode: candidate?.$metadata?.httpStatusCode,
    requestId: candidate?.$metadata?.requestId,
  };
};

const ADDRESSING_ERROR_NAMES = new Set([
  'PermanentRedirect',
  'IncorrectEndpoint',
  'InvalidEndpoint',
]);

export const isS3AddressingError = (error: unknown) => {
  const name = getErrorName(error);
  if (ADDRESSING_ERROR_NAMES.has(name)) return true;
  if (isTauriAppPlatform()) {
    const message = getErrorMessage(error).toLowerCase();
    return [
      'enotfound',
      'name or service not known',
      'no such host',
      'hostname',
      'certificate',
      'tls',
    ].some((fragment) => message.includes(fragment));
  }
  if (name === 'InvalidRequest') {
    const message = getErrorMessage(error).toLowerCase();
    return message.includes('path style') || message.includes('virtual host') || message.includes('endpoint');
  }
  return false;
};

const mapS3ErrorCode = (error: unknown): RemoteStorageErrorCode => {
  const name = getErrorName(error);
  const { statusCode } = getErrorMetadata(error);
  if (statusCode === 401 || ['InvalidAccessKeyId', 'InvalidToken', 'ExpiredToken'].includes(name)) {
    return 'authentication_failed';
  }
  if (statusCode === 403 || name === 'AccessDenied') return 'permission_denied';
  if (statusCode === 404 || ['NoSuchKey', 'NotFound', 'NoSuchBucket'].includes(name)) {
    return 'not_found';
  }
  if (['SignatureDoesNotMatch', 'AuthorizationHeaderMalformed'].includes(name)) {
    return 'signature_error';
  }
  if (['RequestTimeTooSkewed', 'RequestExpired'].includes(name)) return 'clock_skew';
  if (['TimeoutError', 'AbortError', 'RequestTimeout'].includes(name)) return 'timeout';
  if (statusCode && statusCode >= 500) return 'server_error';
  if (!isTauriAppPlatform() && error instanceof TypeError) return 'cors_error';
  return 'network_error';
};

const toRemoteStorageError = (error: unknown, key?: string) => {
  if (error instanceof RemoteStorageError) return error;
  const metadata = getErrorMetadata(error);
  const code = mapS3ErrorCode(error);
  return new RemoteStorageError(code, `S3 request failed: ${code}`, {
    provider: 's3',
    statusCode: metadata.statusCode,
    requestId: metadata.requestId,
    key,
    cause: error,
  });
};

export const validateS3Config = (
  input: S3CloudProfile['config'],
): S3CloudProfile['config'] => {
  const trimmedEndpoint = input.endpoint.trim();
  let endpoint: URL;
  try {
    endpoint = new URL(
      /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmedEndpoint)
        ? trimmedEndpoint
        : `https://${trimmedEndpoint}`,
    );
  } catch (error) {
    throw new RemoteStorageError('invalid_config', 'Endpoint 无效', {
      provider: 's3',
      cause: error,
    });
  }
  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new RemoteStorageError('invalid_config', 'Endpoint 仅支持 HTTP 或 HTTPS', {
      provider: 's3',
    });
  }
  if (!input.region.trim()) {
    throw new RemoteStorageError('invalid_config', 'Region 不能为空', { provider: 's3' });
  }
  if (!input.accessKeyId.trim() || !input.secretAccessKey) {
    throw new RemoteStorageError('invalid_config', 'Access Key 和 Secret Key 不能为空', {
      provider: 's3',
    });
  }
  const bucketName = input.bucketName.trim();
  if (!bucketName || bucketName.includes('/')) {
    throw new RemoteStorageError('invalid_config', 'Bucket Name 无效', { provider: 's3' });
  }
  endpoint.pathname = endpoint.pathname.replace(/\/+$/, '');
  return {
    ...input,
    endpoint: endpoint.toString().replace(/\/+$/, ''),
    region: input.region.trim(),
    accessKeyId: input.accessKeyId.trim(),
    bucketName,
    remotePrefix: normalizeObjectKey(input.remotePrefix),
  };
};

export class S3ObjectStore implements RemoteObjectStore {
  readonly provider = 's3' as const;
  private readonly config: S3CloudProfile['config'];
  private client: S3Client;
  private addressingStyle: S3AddressingStyle;

  constructor(config: S3CloudProfile['config']) {
    this.config = validateS3Config(config);
    this.addressingStyle = this.config.addressingStyle ?? 'virtual';
    this.client = this.createClient(this.addressingStyle);
  }

  async testAccess(): Promise<RemoteAccessResult> {
    const firstStyle = this.config.addressingStyle ?? 'virtual';
    const styles: S3AddressingStyle[] = [firstStyle, firstStyle === 'virtual' ? 'path' : 'virtual'];
    let lastError: unknown;
    for (let index = 0; index < styles.length; index += 1) {
      const style = styles[index]!;
      const client = this.createClient(style);
      try {
        await client.send(
          new ListObjectsV2Command({
            Bucket: this.config.bucketName,
            Prefix: withTrailingSlash(joinObjectKeys(this.config.remotePrefix, CLOUD_ROOT_DIRNAME)),
            MaxKeys: 1,
          }),
        );
        this.client.destroy();
        this.client = client;
        this.addressingStyle = style;
        return { addressingStyle: style };
      } catch (error) {
        client.destroy();
        lastError = error;
        if (index === 0 && isS3AddressingError(error)) continue;
        break;
      }
    }
    throw toRemoteStorageError(lastError);
  }

  async listChildren(prefix: string): Promise<RemoteListEntry[]> {
    const relativePrefix = withTrailingSlash(normalizeObjectKey(prefix));
    const fullPrefix = withTrailingSlash(this.toS3Key(relativePrefix));
    const entries: RemoteListEntry[] = [];
    let continuationToken: string | undefined;
    try {
      do {
        const response = await this.client.send(
          new ListObjectsV2Command({
            Bucket: this.config.bucketName,
            Prefix: fullPrefix,
            Delimiter: '/',
            ContinuationToken: continuationToken,
          }),
        );
        for (const item of response.Contents ?? []) {
          if (!item.Key || item.Key === fullPrefix) continue;
          const key = this.fromS3Key(item.Key);
          entries.push({
            key,
            kind: 'object',
            metadata: {
              key,
              etag: normalizeEtag(item.ETag),
              lastModified: item.LastModified?.toISOString(),
              size: item.Size,
            },
          });
        }
        for (const item of response.CommonPrefixes ?? []) {
          if (!item.Prefix) continue;
          entries.push({ key: withTrailingSlash(this.fromS3Key(item.Prefix)), kind: 'prefix' });
        }
        continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
      } while (continuationToken);
      return entries;
    } catch (error) {
      throw toRemoteStorageError(error, relativePrefix);
    }
  }

  async stat(key: string): Promise<RemoteObjectMetadata | null> {
    const normalizedKey = normalizeObjectKey(key);
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucketName, Key: this.toS3Key(normalizedKey) }),
      );
      return {
        key: normalizedKey,
        etag: normalizeEtag(response.ETag),
        lastModified: response.LastModified?.toISOString(),
        size: response.ContentLength,
      };
    } catch (error) {
      const mapped = toRemoteStorageError(error, normalizedKey);
      if (mapped.code === 'not_found') return null;
      throw mapped;
    }
  }

  async read(key: string): Promise<Uint8Array> {
    const normalizedKey = normalizeObjectKey(key);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucketName, Key: this.toS3Key(normalizedKey) }),
      );
      if (!response.Body) return new Uint8Array();
      return await response.Body.transformToByteArray();
    } catch (error) {
      throw toRemoteStorageError(error, normalizedKey);
    }
  }

  async write(
    key: string,
    data: Uint8Array,
    options?: { contentType?: string },
  ): Promise<RemoteObjectMetadata> {
    const normalizedKey = normalizeObjectKey(key);
    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucketName,
          Key: this.toS3Key(normalizedKey),
          Body: data,
          ContentType: options?.contentType,
        }),
      );
      return (
        (await this.stat(normalizedKey)) ?? {
          key: normalizedKey,
          etag: normalizeEtag(response.ETag),
          size: data.byteLength,
        }
      );
    } catch (error) {
      throw toRemoteStorageError(error, normalizedKey);
    }
  }

  private createClient(style: S3AddressingStyle) {
    const clientConfig: S3ClientConfig = {
      endpoint: this.config.endpoint,
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      forcePathStyle: style === 'path',
      maxAttempts: 3,
    };
    if (isTauriAppPlatform()) {
      clientConfig.requestHandler =
        new TauriHttpHandler() as unknown as NonNullable<S3ClientConfig['requestHandler']>;
    }
    return new S3Client(clientConfig);
  }

  private toS3Key(key: string) {
    return joinObjectKeys(this.config.remotePrefix, key);
  }

  private fromS3Key(key: string) {
    const normalized = normalizeObjectKey(key);
    const prefix = normalizeObjectKey(this.config.remotePrefix);
    return prefix && normalized.startsWith(`${prefix}/`)
      ? normalized.slice(prefix.length + 1)
      : normalized;
  }
}


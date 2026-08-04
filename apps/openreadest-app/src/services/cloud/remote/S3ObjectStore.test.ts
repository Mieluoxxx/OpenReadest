import { beforeEach, describe, expect, it, vi } from 'vitest';

const awsMocks = vi.hoisted(() => ({
  send: vi.fn(),
  destroy: vi.fn(),
  configs: [] as Array<Record<string, unknown>>,
}));

vi.mock('@aws-sdk/client-s3', () => {
  class BaseCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }
  class GetObjectCommand extends BaseCommand {}
  class HeadObjectCommand extends BaseCommand {}
  class ListObjectsV2Command extends BaseCommand {}
  class PutObjectCommand extends BaseCommand {}
  class S3Client {
    constructor(config: Record<string, unknown>) {
      awsMocks.configs.push(config);
    }
    send(command: BaseCommand) {
      return awsMocks.send(command);
    }
    destroy() {
      awsMocks.destroy();
    }
  }
  return { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client };
});

import { RemoteStorageError } from './errors';
import { S3ObjectStore, validateS3Config } from './S3ObjectStore';

const config = {
  endpoint: 'https://s3.example.com/',
  region: 'auto',
  accessKeyId: 'access',
  secretAccessKey: 'secret',
  bucketName: 'books',
  remotePrefix: '/reader//sync/',
};

beforeEach(() => {
  awsMocks.send.mockReset();
  awsMocks.destroy.mockReset();
  awsMocks.configs.length = 0;
});

describe('S3ObjectStore', () => {
  it('normalizes compatible endpoint and prefix values', () => {
    expect(validateS3Config(config)).toMatchObject({
      endpoint: 'https://s3.example.com',
      region: 'auto',
      remotePrefix: 'reader/sync',
    });
  });

  it('prepends https to a scheme-less endpoint', () => {
    expect(validateS3Config({ ...config, endpoint: 's3.example.com' })).toMatchObject({
      endpoint: 'https://s3.example.com',
    });
  });

  it('keeps an explicit http endpoint', () => {
    expect(validateS3Config({ ...config, endpoint: 'http://s3.example.com' })).toMatchObject({
      endpoint: 'http://s3.example.com',
    });
  });

  it('rejects an invalid bucket without exposing credentials', () => {
    expect(() => validateS3Config({ ...config, bucketName: 'bad/name' })).toThrow(
      RemoteStorageError,
    );
  });

  it('uses virtual-hosted style when the first access test succeeds', async () => {
    awsMocks.send.mockResolvedValueOnce({});
    const store = new S3ObjectStore(config);
    await expect(store.testAccess()).resolves.toEqual({ addressingStyle: 'virtual' });
    expect(awsMocks.configs.at(-1)?.['forcePathStyle']).toBe(false);
  });

  it('falls back to path style only for an addressing error', async () => {
    const redirect = Object.assign(new Error('wrong endpoint'), { name: 'PermanentRedirect' });
    awsMocks.send.mockRejectedValueOnce(redirect).mockResolvedValueOnce({});
    const store = new S3ObjectStore(config);
    await expect(store.testAccess()).resolves.toEqual({ addressingStyle: 'path' });
    expect(awsMocks.configs.at(-1)?.['forcePathStyle']).toBe(true);
  });

  it('does not retry path style for permission errors', async () => {
    const denied = Object.assign(new Error('denied'), {
      name: 'AccessDenied',
      $metadata: { httpStatusCode: 403, requestId: 'request' },
    });
    awsMocks.send.mockRejectedValueOnce(denied);
    const store = new S3ObjectStore(config);
    await expect(store.testAccess()).rejects.toMatchObject({
      code: 'permission_denied',
      statusCode: 403,
      requestId: 'request',
    });
    expect(awsMocks.send).toHaveBeenCalledTimes(1);
  });

  it('paginates object and prefix listings', async () => {
    awsMocks.send
      .mockResolvedValueOnce({
        Contents: [
          {
            Key: 'reader/sync/OpenReadest/Books/library.json',
            ETag: '"etag"',
            Size: 10,
          },
        ],
        CommonPrefixes: [{ Prefix: 'reader/sync/OpenReadest/Books/hash-a/' }],
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .mockResolvedValueOnce({
        CommonPrefixes: [{ Prefix: 'reader/sync/OpenReadest/Books/hash-b/' }],
        IsTruncated: false,
      });
    const store = new S3ObjectStore(config);
    const entries = await store.listChildren('OpenReadest/Books/');
    expect(entries.map((entry) => entry.key)).toEqual([
      'OpenReadest/Books/library.json',
      'OpenReadest/Books/hash-a/',
      'OpenReadest/Books/hash-b/',
    ]);
    expect(awsMocks.send).toHaveBeenCalledTimes(2);
  });

  it('maps a missing HeadObject to null', async () => {
    awsMocks.send.mockRejectedValueOnce(
      Object.assign(new Error('missing'), {
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      }),
    );
    await expect(new S3ObjectStore(config).stat('missing')).resolves.toBeNull();
  });

  it('reads a streaming body and refreshes metadata after writes', async () => {
    const body = new Uint8Array([1, 2, 3]);
    awsMocks.send
      .mockResolvedValueOnce({ Body: { transformToByteArray: async () => body } })
      .mockResolvedValueOnce({ ETag: '"put-etag"' })
      .mockResolvedValueOnce({
        ETag: '"head-etag"',
        ContentLength: 3,
        LastModified: new Date(1),
      });
    const store = new S3ObjectStore(config);
    await expect(store.read('book.epub')).resolves.toEqual(body);
    await expect(store.write('book.epub', body)).resolves.toMatchObject({
      etag: 'head-etag',
      size: 3,
    });
  });
});

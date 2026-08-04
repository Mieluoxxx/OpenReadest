import { describe, expect, it } from 'vitest';
import { mergeCloudSyncStates } from './state';

describe('cloud sync state', () => {
  it('merges entries independently by entry updatedAt', () => {
    const merged = mergeCloudSyncStates(
      {
        version: 1,
        updatedAt: 30,
        entries: {
          a: { updatedAt: 30, local: { md5: 'local-new' } },
          b: { updatedAt: 10, local: { md5: 'local-old' } },
        },
      },
      {
        version: 1,
        updatedAt: 20,
        entries: {
          a: { updatedAt: 20, remote: { etag: 'remote-old' } },
          b: { updatedAt: 20, remote: { etag: 'remote-new' } },
        },
      },
    );
    expect(merged.entries['a']?.local?.md5).toBe('local-new');
    expect(merged.entries['b']?.remote?.etag).toBe('remote-new');
    expect(merged.updatedAt).toBe(30);
  });
});

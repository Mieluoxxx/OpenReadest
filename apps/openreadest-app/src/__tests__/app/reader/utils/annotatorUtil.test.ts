import { describe, expect, it } from 'vitest';
import { supportsProofread } from '@/app/reader/utils/annotatorUtil';

describe('supportsProofread (upstream readest 5ecb835c)', () => {
  it('enables every reflowable format', () => {
    for (const format of ['EPUB', 'MOBI', 'AZW3', 'FB2', 'FBZ', 'MD', 'TXT']) {
      expect(supportsProofread(format as never)).toBe(true);
    }
  });

  it('excludes only the fixed-layout formats', () => {
    expect(supportsProofread('PDF')).toBe(false);
    expect(supportsProofread('CBZ')).toBe(false);
  });

  it('rejects a missing format and passes unknown formats through as reflowable', () => {
    expect(supportsProofread(undefined)).toBe(false);
    expect(supportsProofread('DOCX' as never)).toBe(true);
  });
});

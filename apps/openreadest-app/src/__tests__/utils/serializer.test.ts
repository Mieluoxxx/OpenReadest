import { describe, it, expect } from 'vitest';
import { BookConfig, ViewSettings } from '../../types/book';
import { DEFAULT_BOOK_LAYOUT, DEFAULT_BOOK_SEARCH_CONFIG } from '../../services/constants';
import { deserializeConfig, serializeConfig } from '../../utils/serializer';

const globalViewSettings = (): ViewSettings =>
  structuredClone(DEFAULT_BOOK_LAYOUT) as unknown as ViewSettings;

describe('deserializeConfig', () => {
  it('maps legacy continuousScroll=true to noContinuousScroll=false', () => {
    const str = JSON.stringify({
      viewSettings: { continuousScroll: true },
    } satisfies Partial<BookConfig>);
    const config = deserializeConfig(str, globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG);
    expect(config.viewSettings?.continuousScroll).toBe(true);
    expect(config.viewSettings?.noContinuousScroll).toBe(false);
    expect(config.viewSettings?.scrolledDirection).toBe('vertical');
  });

  it('maps legacy continuousScroll=false to noContinuousScroll=true', () => {
    const str = JSON.stringify({
      viewSettings: { continuousScroll: false },
    } satisfies Partial<BookConfig>);
    const config = deserializeConfig(str, globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG);
    expect(config.viewSettings?.continuousScroll).toBe(false);
    expect(config.viewSettings?.noContinuousScroll).toBe(true);
  });

  it('defaults missing scroll fields to upstream-compatible values', () => {
    const config = deserializeConfig('{}', globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG);
    expect(config.viewSettings?.noContinuousScroll).toBe(false);
    expect(config.viewSettings?.scrolledDirection).toBe('vertical');
    expect(config.viewSettings?.webtoonMode).toBe(false);
    expect(config.viewSettings?.hideScrollbar).toBe(false);
    expect(config.viewSettings?.autoScrollSpeed).toBe(100);
  });

  it('preserves unknown view-setting fields across hydration', () => {
    const str = JSON.stringify({
      viewSettings: { continuousScroll: true, futureSetting: 'keep-me' },
    } as Partial<BookConfig>);
    const config = deserializeConfig(str, globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG);
    expect((config.viewSettings as ViewSettings & { futureSetting?: string }).futureSetting).toBe(
      'keep-me',
    );
  });

  it('normalizes deterministically and survives a serialize round-trip', () => {
    const str = JSON.stringify({
      viewSettings: { continuousScroll: false },
    } satisfies Partial<BookConfig>);
    const config = deserializeConfig(str, globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG);
    const reserialized = deserializeConfig(
      serializeConfig(config, globalViewSettings(), DEFAULT_BOOK_SEARCH_CONFIG),
      globalViewSettings(),
      DEFAULT_BOOK_SEARCH_CONFIG,
    );
    expect(reserialized.viewSettings?.noContinuousScroll).toBe(true);
    expect(reserialized.viewSettings?.continuousScroll).toBe(false);
  });
});

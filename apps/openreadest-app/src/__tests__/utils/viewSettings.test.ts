import { describe, it, expect } from 'vitest';
import { ViewSettings } from '../../types/book';
import { DEFAULT_BOOK_LAYOUT } from '../../services/constants';
import { DEFAULT_AUTO_SCROLL_SPEED, normalizeViewSettings } from '../../utils/viewSettings';

const baseSettings = (): ViewSettings =>
  structuredClone(DEFAULT_BOOK_LAYOUT) as unknown as ViewSettings;

describe('normalizeViewSettings', () => {
  it('maps continuousScroll=true to noContinuousScroll=false', () => {
    const settings = baseSettings();
    delete (settings as Partial<ViewSettings>).noContinuousScroll;
    settings.continuousScroll = true;
    normalizeViewSettings(settings);
    expect(settings.noContinuousScroll).toBe(false);
  });

  it('maps continuousScroll=false to noContinuousScroll=true', () => {
    const settings = baseSettings();
    delete (settings as Partial<ViewSettings>).noContinuousScroll;
    settings.continuousScroll = false;
    normalizeViewSettings(settings);
    expect(settings.noContinuousScroll).toBe(true);
  });

  it('defaults noContinuousScroll to false when continuousScroll is missing', () => {
    const settings = baseSettings();
    delete (settings as Partial<ViewSettings>).noContinuousScroll;
    delete (settings as Partial<ViewSettings>).continuousScroll;
    normalizeViewSettings(settings);
    expect(settings.noContinuousScroll).toBe(false);
  });

  it('fills missing scrolledDirection, webtoonMode, hideScrollbar and autoScrollSpeed', () => {
    const settings = baseSettings();
    delete (settings as Partial<ViewSettings>).scrolledDirection;
    delete (settings as Partial<ViewSettings>).webtoonMode;
    delete (settings as Partial<ViewSettings>).hideScrollbar;
    delete (settings as Partial<ViewSettings>).autoScrollSpeed;
    normalizeViewSettings(settings);
    expect(settings.scrolledDirection).toBe('vertical');
    expect(settings.webtoonMode).toBe(false);
    expect(settings.hideScrollbar).toBe(false);
    expect(settings.autoScrollSpeed).toBe(DEFAULT_AUTO_SCROLL_SPEED);
  });

  it('keeps an existing noContinuousScroll authoritative over legacy continuousScroll', () => {
    const settings = baseSettings();
    settings.continuousScroll = true; // legacy says continuous
    settings.noContinuousScroll = true; // new field says paginated
    normalizeViewSettings(settings);
    expect(settings.noContinuousScroll).toBe(true);
  });

  it('is idempotent', () => {
    const settings = baseSettings();
    delete (settings as Partial<ViewSettings>).noContinuousScroll;
    settings.continuousScroll = false;
    const once = normalizeViewSettings(settings);
    const snapshot = structuredClone(once);
    normalizeViewSettings(once);
    expect(once).toEqual(snapshot);
  });

  it('preserves unknown fields and the legacy continuousScroll field', () => {
    const settings = baseSettings() as ViewSettings & { futureField?: string };
    settings.futureField = 'keep-me';
    settings.continuousScroll = true;
    normalizeViewSettings(settings);
    expect(settings.futureField).toBe('keep-me');
    expect(settings.continuousScroll).toBe(true);
  });
});

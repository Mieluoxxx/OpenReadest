import { ViewSettings } from '@/types/book';

/**
 * Upstream-compatible default for `autoScrollSpeed` (percentage; 100 = base speed).
 */
export const DEFAULT_AUTO_SCROLL_SPEED = 100;

/**
 * Normalize a hydrated view-settings object to the current scroll model.
 *
 * Migration rules (idempotent; unknown fields are preserved):
 * - `continuousScroll=true`  -> `noContinuousScroll=false`
 * - `continuousScroll=false` -> `noContinuousScroll=true`
 * - missing `continuousScroll` -> `noContinuousScroll=false`
 * - missing `scrolledDirection` -> `'vertical'`
 * - missing `webtoonMode` / `hideScrollbar` -> `false`
 * - missing `autoScrollSpeed` -> `DEFAULT_AUTO_SCROLL_SPEED`
 *
 * `source` is the raw per-book view-settings object (before merging with
 * global defaults). An explicit `noContinuousScroll` there is authoritative;
 * a legacy explicit `continuousScroll` is derived and overrides the global
 * default of `noContinuousScroll`. Without `source`, the merged object is
 * consulted, so already-normalized settings re-normalize as a no-op.
 * The legacy `continuousScroll` field is kept untouched for the
 * compatibility window; UI must not reinterpret it independently.
 */
export const normalizeViewSettings = <T extends ViewSettings>(
  settings: T,
  source: Partial<ViewSettings> = settings,
): T => {
  const hasNewField = 'noContinuousScroll' in source;
  const hasLegacyField = 'continuousScroll' in source;
  if (!hasNewField && hasLegacyField && typeof source.continuousScroll === 'boolean') {
    // Explicit legacy value wins over the global default of the new field.
    settings.noContinuousScroll = !source.continuousScroll;
  } else if (settings.noContinuousScroll === undefined) {
    settings.noContinuousScroll =
      typeof settings.continuousScroll === 'boolean' ? !settings.continuousScroll : false;
  }
  settings.scrolledDirection ??= 'vertical';
  settings.webtoonMode ??= false;
  settings.hideScrollbar ??= false;
  settings.autoScrollSpeed ??= DEFAULT_AUTO_SCROLL_SPEED;
  return settings;
};

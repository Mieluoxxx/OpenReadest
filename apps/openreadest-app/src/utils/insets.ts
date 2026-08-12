import { Insets } from '@/types/misc';
import { ViewSettings } from '@/types/book';

export const getViewInsets = (viewSettings: ViewSettings) => {
  const showHeader = viewSettings.showHeader!;
  const showFooter = viewSettings.showFooter!;
  const isVertical = viewSettings.vertical || viewSettings.writingMode.includes('vertical');
  const fullMarginTopPx = viewSettings.marginPx || viewSettings.marginTopPx;
  const compactMarginTopPx = viewSettings.compactMarginPx || viewSettings.compactMarginTopPx;
  const fullMarginBottomPx = viewSettings.marginBottomPx;
  const compactMarginBottomPx = viewSettings.compactMarginBottomPx;
  const fullMarginLeftPx = viewSettings.marginLeftPx;
  const fullMarginRightPx = viewSettings.marginRightPx;
  const compactMarginLeftPx = viewSettings.compactMarginLeftPx;
  const compactMarginRightPx = viewSettings.compactMarginRightPx;

  return {
    top: showHeader && !isVertical ? fullMarginTopPx : compactMarginTopPx,
    right: showHeader && isVertical ? fullMarginRightPx : compactMarginRightPx,
    bottom: showFooter && !isVertical ? fullMarginBottomPx : compactMarginBottomPx,
    left: showFooter && isVertical ? fullMarginLeftPx : compactMarginLeftPx,
  } as Insets;
};

/**
 * Geometry of the header title band (SectionInfo / HintInfo, non-vertical).
 *
 * The band bottom is glued to the content top — the renderer's `margin-top`
 * (FoliateViewer.applyMarginAndGap, which floors at `minHeight` via
 * moreTopInset) — so the title never overlaps the book text. At margins of
 * `minHeight` and up the band is the classic [topInset, topInset + margin]
 * strip below the safe area; below that it keeps a `minHeight`-tall readable
 * band that lifts into the notch, reaching the screen top at the
 * negative-margin limit. The fork's renderer floors the margin at 44px, so
 * callers pass 44 to stay glued (upstream readest #5303 defaults to 16).
 */
export const getHeaderBandGeometry = (topInset: number, marginTopPx: number, minHeight = 16) => {
  const height = Math.max(marginTopPx, minHeight);
  const top = Math.max(0, topInset + Math.min(marginTopPx, minHeight) - minHeight);
  return { top, height, bottom: top + height };
};

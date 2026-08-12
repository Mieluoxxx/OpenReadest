/**
 * Scrolled-mode TTS scroll anchoring (upstream readest useTTSControl.ts).
 *
 * The renderer exposes the visible window in document coordinates: `start` is
 * the container scroll position relative to the primary view's top and `end`
 * is `start + size`, while a range's `getBoundingClientRect()` top/size is
 * iframe-local — the same coordinate space for a range inside the primary
 * view. A range is "out of view" when it sits above the header band (or below
 * the footer band), including the scrollingOverlap dead zone the paginator
 * leaves between consecutive views. The caller then anchors the range to the
 * top of the visible window.
 *
 * `headerOverlap`/`footerOverlap` are the on-screen chrome heights to keep the
 * spoken text clear of; the fork gates them on `showBarsOnScroll` because
 * hidden bars reserve no scroll-viewport inset.
 */
export const isRangeOutOfScrolledView = (args: {
  /** range.getBoundingClientRect()[sideProp === 'height' ? 'y' : 'x'] */
  rangeTop: number;
  /** range.getBoundingClientRect()[sideProp === 'height' ? 'height' : 'width'] */
  rangeSize: number;
  /** renderer.start — visible window top in document coordinates */
  start: number;
  /** renderer.end — visible window bottom in document coordinates */
  end: number;
  /** px of fixed chrome overlaying the top of the scroll viewport */
  headerOverlap: number;
  /** px of fixed chrome overlaying the bottom of the scroll viewport */
  footerOverlap: number;
  /** renderer scrollingOverlap dead zone per page turn */
  scrollingOverlap: number;
}): boolean => {
  const { rangeTop, rangeSize, start, end, headerOverlap, footerOverlap, scrollingOverlap } = args;
  const rangeBottom = rangeTop + rangeSize;
  return (
    rangeBottom > end - footerOverlap - scrollingOverlap ||
    rangeTop < start + headerOverlap + scrollingOverlap
  );
};

import { describe, expect, it } from 'vitest';
import { isRangeOutOfScrolledView } from '@/app/reader/utils/ttsAnchor';

// Geometry model: a range inside the primary view has iframe-local rect
// coordinates (rangeTop) while renderer.start/end delimit the visible window
// in the same space. See ttsAnchor.ts.
const makeArgs = (overrides: Partial<Parameters<typeof isRangeOutOfScrolledView>[0]> = {}) => ({
  rangeTop: 600,
  rangeSize: 24,
  start: 0,
  end: 800,
  headerOverlap: 44,
  footerOverlap: 44,
  scrollingOverlap: 60,
  ...overrides,
});

describe('isRangeOutOfScrolledView (upstream readest useTTSControl.ts)', () => {
  it('keeps a range fully inside the visible window', () => {
    expect(isRangeOutOfScrolledView(makeArgs())).toBe(false);
  });

  it('anchors a range below the footer band (bottom edge minus overlaps)', () => {
    // end - footerOverlap - scrollingOverlap = 800 - 44 - 60 = 696; a range
    // starting at 680 with height 24 ends at 704 > 696 -> out of view.
    expect(isRangeOutOfScrolledView(makeArgs({ rangeTop: 680 }))).toBe(true);
    // exactly at the threshold it stays visible
    expect(isRangeOutOfScrolledView(makeArgs({ rangeTop: 672 }))).toBe(false);
  });

  it('anchors a range above the header band (top edge plus overlaps)', () => {
    // start + headerOverlap + scrollingOverlap = 0 + 44 + 60 = 104
    expect(isRangeOutOfScrolledView(makeArgs({ rangeTop: 100 }))).toBe(true);
    expect(isRangeOutOfScrolledView(makeArgs({ rangeTop: 104 }))).toBe(false);
  });

  it('tracks the visible window as the user scrolls into the primary view', () => {
    // scrolled 3000px into the section: window is [3000, 3800]; a range at
    // rect.y=600 has been scrolled past -> out of view above.
    const scrolled = makeArgs({ start: 3000, end: 3800 });
    expect(isRangeOutOfScrolledView(scrolled)).toBe(true);
    expect(isRangeOutOfScrolledView({ ...scrolled, rangeTop: 3200 })).toBe(false);
    expect(isRangeOutOfScrolledView({ ...scrolled, rangeTop: 2990 })).toBe(true);
    expect(isRangeOutOfScrolledView({ ...scrolled, rangeTop: 3760 })).toBe(true);
  });

  it('applies zero chrome overlap when the bars are hidden on scroll', () => {
    const noBars = makeArgs({ headerOverlap: 0, footerOverlap: 0 });
    // no band overlays the viewport, but the scrollingOverlap dead zone of
    // the paginator's page-turn distance still counts as out of view
    expect(isRangeOutOfScrolledView({ ...noBars, rangeTop: 10 })).toBe(true);
    expect(isRangeOutOfScrolledView({ ...noBars, rangeTop: 700 })).toBe(false);
    expect(isRangeOutOfScrolledView({ ...noBars, rangeTop: 750 })).toBe(true);
  });

  it('keeps horizontal (vertical-writing) geometry on the same math', () => {
    // sideProp === 'width': rangeTop/rangeSize are x-axis values; the window
    // is [start, end] on the same axis.
    expect(
      isRangeOutOfScrolledView(makeArgs({ rangeTop: 100, rangeSize: 40, start: 0, end: 800 })),
    ).toBe(true);
    expect(
      isRangeOutOfScrolledView(makeArgs({ rangeTop: 500, rangeSize: 40, start: 0, end: 800 })),
    ).toBe(false);
  });
});

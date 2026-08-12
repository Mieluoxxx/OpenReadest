import { describe, expect, it, vi } from 'vitest';
import { viewPagination } from '@/app/reader/hooks/usePagination';
import { FoliateView } from '@/types/view';
import { ViewSettings } from '@/types/book';

// Minimal reflowable view mock. In jsdom there is no real layout geometry, so
// snapScrolledDistanceToLines always falls back to the raw distance — which is
// exactly what these tests assert (distance passthrough + call routing).
const makeBook = (dir = 'ltr', layout = 'reflowable') =>
  ({
    dir,
    rendition: { layout },
    metadata: {},
    splitTOCHref: '',
    getCover: () => null,
  }) as unknown as FoliateView['book'];

const makeView = (overrides: Partial<FoliateView> = {}): FoliateView => {
  const next = vi.fn();
  const prev = vi.fn();
  const nextSection = vi.fn();
  const prevSection = vi.fn();
  const renderer = {
    scrolled: true,
    size: 800,
    viewSize: 1000,
    start: 0,
    end: 800,
    page: 1,
    pages: 5,
    containerPosition: 0,
    sideProp: 'height' as const,
    scrollLocked: false,
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    next: vi.fn(),
    prev: vi.fn(),
    nextSection,
    prevSection,
    getContents: () => [],
    primaryIndex: 0,
    scrollToAnchor: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  return {
    next,
    prev,
    renderer,
    book: makeBook(),
    ...overrides,
  } as unknown as FoliateView;
};

const makeSettings = (overrides: Partial<ViewSettings> = {}): ViewSettings =>
  ({
    scrolled: true,
    scrollingOverlap: 60,
    vertical: false,
    noContinuousScroll: false,
    scrolledDirection: 'vertical',
    ...overrides,
  }) as unknown as ViewSettings;

describe('viewPagination scrolled mode (upstream parity)', () => {
  it('scrolls by `size - scrollingOverlap` (no header/footer 44px deduction)', () => {
    const view = makeView();
    const settings = makeSettings({ scrolled: true, scrollingOverlap: 60 });
    viewPagination(view, settings, 'down');
    expect(view.next).toHaveBeenCalledWith(800 - 60);
    viewPagination(view, settings, 'up');
    expect(view.prev).toHaveBeenCalledWith(800 - 60);
  });

  it('uses raw size when overlap is zero', () => {
    const view = makeView();
    const settings = makeSettings({ scrollingOverlap: 0 });
    viewPagination(view, settings, 'down');
    expect(view.next).toHaveBeenCalledWith(800);
  });

  it('skips line snapping for vertical writing and passes the raw distance', () => {
    const view = makeView();
    const settings = makeSettings({ vertical: true, scrollingOverlap: 0 });
    viewPagination(view, settings, 'down');
    expect(view.next).toHaveBeenCalledWith(800);
  });

  it('skips line snapping for horizontal-scrolled pre-paginated books', () => {
    const view = makeView({
      book: makeBook('ltr', 'pre-paginated'),
    });
    const settings = makeSettings({ scrolledDirection: 'horizontal', scrollingOverlap: 0 });
    viewPagination(view, settings, 'down');
    expect(view.next).toHaveBeenCalledWith(800);
  });

  it('routes section mode to prevSection/nextSection without distance', () => {
    const view = makeView();
    const settings = makeSettings();
    viewPagination(view, settings, 'down', 'section');
    expect(view.renderer.nextSection).toHaveBeenCalled();
    expect(view.next).not.toHaveBeenCalled();
    viewPagination(view, settings, 'up', 'section');
    expect(view.renderer.prevSection).toHaveBeenCalled();
  });

  it('swaps left/right for RTL books', () => {
    const view = makeView({ book: makeBook('rtl') });
    const settings = makeSettings();
    viewPagination(view, settings, 'left');
    expect(view.next).toHaveBeenCalled();
    viewPagination(view, settings, 'right');
    expect(view.prev).toHaveBeenCalled();
  });

  it('is a no-op without a view or settings', () => {
    expect(() => viewPagination(null, null, 'down')).not.toThrow();
  });
});

describe('viewPagination paginated mode', () => {
  it('calls next/prev without a distance', () => {
    const view = makeView({
      renderer: { scrolled: false } as unknown as FoliateView['renderer'],
    });
    const settings = makeSettings({ scrolled: false });
    viewPagination(view, settings, 'down');
    expect(view.next).toHaveBeenCalledWith();
    viewPagination(view, settings, 'up');
    expect(view.prev).toHaveBeenCalledWith();
  });
});

describe('viewPagination pan branch (zoomed fixed layout, upstream parity)', () => {
  // A paginated fixed-layout view that can report per-axis overflow.
  const makePanView = (overflow: { x?: boolean; y?: boolean } = {}, scrolled = false) =>
    makeView({
      book: makeBook('ltr', 'pre-paginated'),
      renderer: { scrolled } as unknown as FoliateView['renderer'],
      isOverflowX: () => overflow.x ?? false,
      isOverflowY: () => overflow.y ?? false,
      pan: vi.fn(),
    });

  const zoomedSettings = (overrides: Partial<ViewSettings> = {}) =>
    makeSettings({
      scrolled: false,
      zoomLevel: 150,
      zoomMode: 'fit-width',
      ...overrides,
    });

  it('pans horizontally on left/right when zoomed and overflowing on X', () => {
    const view = makePanView({ x: true });
    const settings = zoomedSettings();
    viewPagination(view, settings, 'left', 'pan');
    expect(view.pan).toHaveBeenCalledWith(-50, 0);
    viewPagination(view, settings, 'right', 'pan');
    expect(view.pan).toHaveBeenCalledWith(50, 0);
    expect(view.next).not.toHaveBeenCalled();
    expect(view.prev).not.toHaveBeenCalled();
  });

  it('pans vertically on up/down when zoomed and overflowing on Y', () => {
    const view = makePanView({ y: true });
    const settings = zoomedSettings();
    viewPagination(view, settings, 'up', 'pan');
    expect(view.pan).toHaveBeenCalledWith(0, -50);
    viewPagination(view, settings, 'down', 'pan');
    expect(view.pan).toHaveBeenCalledWith(0, 50);
  });

  it('falls back to a page turn when the requested axis has no overflow', () => {
    const view = makePanView({ y: true });
    const settings = zoomedSettings();
    viewPagination(view, settings, 'left', 'pan');
    expect(view.pan).not.toHaveBeenCalled();
    expect(view.prev).toHaveBeenCalled();
  });

  it('does not pan at zoomLevel 100 with fit-page zoomMode', () => {
    const view = makePanView({ x: true, y: true });
    const settings = zoomedSettings({ zoomLevel: 100, zoomMode: 'fit-page' });
    viewPagination(view, settings, 'left', 'pan');
    expect(view.pan).not.toHaveBeenCalled();
    expect(view.prev).toHaveBeenCalled();
  });

  it('never pans while scrolled even when zoomed (scroll owns the gesture)', () => {
    const view = makePanView({ x: true }, true);
    const settings = zoomedSettings({ scrolled: true });
    viewPagination(view, settings, 'left', 'pan');
    expect(view.pan).not.toHaveBeenCalled();
    expect(view.prev).toHaveBeenCalled();
  });
});

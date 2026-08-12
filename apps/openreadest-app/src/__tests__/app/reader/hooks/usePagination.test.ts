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

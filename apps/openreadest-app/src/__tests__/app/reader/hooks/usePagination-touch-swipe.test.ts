import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { FoliateView } from '@/types/view';
import type { ViewSettings } from '@/types/book';

// A fixed-layout book in scrolled mode must never page-turn on a horizontal
// swipe: the renderer's scroll container owns the gesture natively (including
// the horizontal wheel translation), so forwarding touch-swipe to
// viewPagination would turn pages on top of the scroll. Guard parity with
// upstream readest (swipes never page-turn while scrolled).
const viewSettings = { scrolled: true, scrollingOverlap: 60 } as Partial<ViewSettings>;
const bookData = { isFixedLayout: true };

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: { isMobileApp: false } }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    getViewSettings: () => viewSettings,
    getViewState: () => ({ inited: true }),
    hoveredBookKey: '',
    setHoveredBookKey: vi.fn(),
  }),
}));

vi.mock('@/store/bookDataStore', () => ({
  useBookDataStore: () => ({ getBookData: () => bookData }),
}));

vi.mock('@/store/deviceStore', () => ({
  useDeviceControlStore: () => ({
    acquireVolumeKeyInterception: vi.fn(),
    releaseVolumeKeyInterception: vi.fn(),
  }),
}));

import { usePagination } from '@/app/reader/hooks/usePagination';

const makeView = (overrides: Partial<FoliateView> = {}): FoliateView => {
  const next = vi.fn();
  const prev = vi.fn();
  return {
    next,
    prev,
    renderer: {
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
      nextSection: vi.fn(),
      prevSection: vi.fn(),
      getContents: () => [],
      primaryIndex: 0,
      scrollToAnchor: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    book: {
      dir: 'ltr',
      rendition: { layout: 'pre-paginated' },
      metadata: {},
      splitTOCHref: '',
      getCover: () => null,
    } as unknown as FoliateView['book'],
    ...overrides,
  } as unknown as FoliateView;
};

const swipe = (deltaX: number, deltaY = 0) =>
  new CustomEvent('touch-swipe', {
    detail: { deltaX, deltaY, deltaT: 100, startX: 0, startY: 0, endX: deltaX, endY: deltaY },
  });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('usePagination touch-swipe guard (fixed layout)', () => {
  it('does not page-turn on a swipe while scrolled', async () => {
    viewSettings.scrolled = true;
    const view = makeView();
    const { result } = renderHook(() =>
      usePagination('book', { current: view }, { current: null }),
    );
    await result.current.handlePageFlip(swipe(120));
    expect(view.next).not.toHaveBeenCalled();
    expect(view.prev).not.toHaveBeenCalled();
  });

  it('pages on a horizontal swipe when not scrolled and not panning', async () => {
    viewSettings.scrolled = false;
    viewSettings.zoomLevel = 100;
    viewSettings.zoomMode = 'fit-page';
    const view = makeView({
      renderer: { scrolled: false } as unknown as FoliateView['renderer'],
    });
    const { result } = renderHook(() =>
      usePagination('book', { current: view }, { current: null }),
    );
    // A rightward swipe maps to side 'left' -> prev; leftward to 'right' -> next.
    await result.current.handlePageFlip(swipe(120));
    expect(view.prev).toHaveBeenCalled();
    await result.current.handlePageFlip(swipe(-120));
    expect(view.next).toHaveBeenCalled();
  });

  it('does not page-turn on a swipe while zoomed (panning owns the gesture)', async () => {
    viewSettings.scrolled = false;
    viewSettings.zoomLevel = 150;
    viewSettings.zoomMode = 'fit-width';
    const view = makeView({
      renderer: { scrolled: false } as unknown as FoliateView['renderer'],
      isOverflowX: () => true,
      isOverflowY: () => true,
      pan: vi.fn(),
    });
    const { result } = renderHook(() =>
      usePagination('book', { current: view }, { current: null }),
    );
    await result.current.handlePageFlip(swipe(120));
    expect(view.next).not.toHaveBeenCalled();
    expect(view.prev).not.toHaveBeenCalled();
    expect(view.pan).not.toHaveBeenCalled();
  });
});

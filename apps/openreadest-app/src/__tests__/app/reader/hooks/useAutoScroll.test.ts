import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { eventDispatcher } from '@/utils/event';

// Session lifecycle of the Auto Scroll hook (#4998): toggle start/stop, exit
// scrolled mode, tap-to-pause consumption, Escape cleanup, and unmount stop.
// The store and env are mocked; the real eventDispatcher is used so the
// 'autoscroll-toggle' / 'iframe-single-click' contract is exercised for real.
const setAutoScrollEnabled = vi.fn();
let viewSettings: { scrolled: boolean; autoScrollSpeed?: number } = { scrolled: true };

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ envConfig: {} }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    getViewSettings: () => viewSettings,
    setAutoScrollEnabled,
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

// setSpeed with persist writes view settings through this helper; keep the
// hook's clamping/stepping logic under test without touching real stores.
vi.mock('@/helpers/settings', () => ({
  saveViewSettings: vi.fn(),
}));

import { useAutoScroll } from '@/app/reader/hooks/useAutoScroll';
import type { FoliateView } from '@/types/view';

const makeView = (overrides: Partial<FoliateView['renderer']> = {}): FoliateView =>
  ({
    book: {} as FoliateView['book'],
    renderer: {
      scrolled: true,
      scrollLocked: false,
      size: 800,
      viewSize: 1000,
      start: 0,
      end: 800,
      page: 1,
      pages: 5,
      containerPosition: 0,
      sideProp: 'height',
      scrollProp: 'scrollTop',
      atEnd: false,
      next: vi.fn(),
      prev: vi.fn(),
      getContents: () => [],
      primaryIndex: 0,
      scrollToAnchor: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      ...overrides,
    },
  }) as unknown as FoliateView;

const BOOK_KEY = 'book-test';

afterEach(() => {
  cleanup();
  setAutoScrollEnabled.mockClear();
  viewSettings = { scrolled: true };
});

// The toggle flows through the async eventDispatcher, so the listener's React
// state updates must run inside act() to be flushed before assertions.
const toggle = async (bookKey = BOOK_KEY) => {
  await act(async () => {
    await eventDispatcher.dispatch('autoscroll-toggle', { bookKey });
  });
};

describe('useAutoScroll session lifecycle', () => {
  it('starts a session on autoscroll-toggle and marks the store enabled', async () => {
    const viewRef = { current: makeView() };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    expect(result.current.active).toBe(false);

    await toggle();
    expect(result.current.active).toBe(true);
    expect(result.current.paused).toBe(false);
    expect(setAutoScrollEnabled).toHaveBeenCalledWith(BOOK_KEY, true);

    // Toggling again stops the session.
    await toggle();
    expect(result.current.active).toBe(false);
    expect(setAutoScrollEnabled).toHaveBeenLastCalledWith(BOOK_KEY, false);
  });

  it('ignores autoscroll-toggle for other books', async () => {
    const viewRef = { current: makeView() };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle('other-book');
    expect(result.current.active).toBe(false);
  });

  it('does not start when the renderer is not in scrolled mode', async () => {
    const viewRef = { current: makeView({ scrolled: false }) };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(false);
    expect(setAutoScrollEnabled).not.toHaveBeenCalled();
  });

  it('stops the session when leaving scrolled mode', async () => {
    const viewRef = { current: makeView() };
    const { result, rerender } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(true);

    // The view settings flip out of scrolled mode; the hook must end the session.
    viewSettings = { scrolled: false };
    rerender();
    expect(result.current.active).toBe(false);
    expect(setAutoScrollEnabled).toHaveBeenLastCalledWith(BOOK_KEY, false);
  });

  it('a page tap pauses the session and consumes the click', async () => {
    const viewRef = { current: makeView() };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(true);
    expect(result.current.paused).toBe(false);

    // The tap goes through the same onSync path usePagination consults; when
    // consumed it must not also turn the page or toggle the bars.
    let consumed = false;
    act(() => {
      consumed = eventDispatcher.dispatchSync('iframe-single-click');
    });
    expect(consumed).toBe(true);
    expect(result.current.paused).toBe(true);

    // A second tap resumes.
    act(() => {
      consumed = eventDispatcher.dispatchSync('iframe-single-click');
    });
    expect(consumed).toBe(true);
    expect(result.current.paused).toBe(false);

    // With no session the tap is not consumed.
    await toggle();
    act(() => {
      consumed = eventDispatcher.dispatchSync('iframe-single-click');
    });
    expect(consumed).toBe(false);
  });

  it('Escape (window and iframe message) stops the session', async () => {
    const viewRef = { current: makeView() };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(true);

    // Escape typed in the app window (capture-phase listener).
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(result.current.active).toBe(false);

    // Re-start, then Escape typed inside the book iframe (forwarded message).
    await toggle();
    expect(result.current.active).toBe(true);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', { data: { type: 'iframe-keydown', key: 'Escape' } }),
      );
    });
    expect(result.current.active).toBe(false);
  });

  it('stops the session on unmount', async () => {
    const viewRef = { current: makeView() };
    const { result, unmount } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(true);

    unmount();
    expect(setAutoScrollEnabled).toHaveBeenLastCalledWith(BOOK_KEY, false);
  });

  it('speed follows the persisted setting and steps by AUTO_SCROLL_SPEED_STEP', async () => {
    const viewRef = { current: makeView() };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    expect(result.current.speed).toBe(100);

    // The store reports the persisted speed; a fresh session adopts it.
    viewSettings = { scrolled: true, autoScrollSpeed: 200 };
    await toggle();
    expect(result.current.speed).toBe(200);

    // adjustSpeed steps by AUTO_SCROLL_SPEED_STEP (25), clamped to [min, max].
    act(() => result.current.adjustSpeed(1));
    expect(result.current.speed).toBe(225);
    act(() => result.current.adjustSpeed(-1));
    act(() => result.current.adjustSpeed(-1));
    expect(result.current.speed).toBe(175);

    // stop() is exposed and ends the session.
    act(() => result.current.stop());
    expect(result.current.active).toBe(false);
  });

  it('never touches renderer.scrollLocked while scrolling (annotation/selection contract)', async () => {
    // The scrollLocked renderer contract is owned by selection/annotation
    // code (useTextSelector); Auto Scroll must scroll through containerPosition
    // only and never write the lock flag.
    const scrollLockedSetter = vi.fn();
    const renderer = {
      scrolled: true,
      size: 800,
      viewSize: 1000,
      start: 0,
      end: 800,
      page: 1,
      pages: 5,
      containerPosition: 0,
      sideProp: 'height',
      scrollProp: 'scrollTop',
      atEnd: false,
      next: vi.fn(),
      prev: vi.fn(),
      getContents: () => [],
      primaryIndex: 0,
      scrollToAnchor: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      get scrollLocked() {
        return true; // an annotation selection is in progress
      },
      set scrollLocked(v: boolean) {
        scrollLockedSetter(v);
      },
    };
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result } = renderHook(() => useAutoScroll(BOOK_KEY, viewRef));
    await toggle();
    expect(result.current.active).toBe(true);

    // Real rAF frames: the paced session should advance the scroll position
    // via containerPosition without ever writing the lock flag.
    await vi.waitFor(() => {
      expect(renderer.containerPosition).toBeGreaterThan(0);
    });
    expect(scrollLockedSetter).not.toHaveBeenCalled();
  });
});

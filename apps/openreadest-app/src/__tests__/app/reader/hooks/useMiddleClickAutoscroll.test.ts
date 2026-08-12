import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { eventDispatcher } from '@/utils/event';
import type { FoliateView } from '@/types/view';

// Middle-click autoscroll (#4951) session lifecycle: iframe-message driven
// start/stop, sticky sessions, click swallowing, cleanup on wheel/Escape, and
// the scrollLocked renderer contract (the hook must never write the flag).
let viewSettings: { scrolled: boolean } = { scrolled: true };
let isDesktopApp = true;

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({ appService: { isDesktopApp } }),
}));

vi.mock('@/store/readerStore', () => ({
  useReaderStore: () => ({
    getViewSettings: () => viewSettings,
  }),
}));

import { useMiddleClickAutoscroll } from '@/app/reader/hooks/useMiddleClickAutoscroll';

const BOOK_KEY = 'book-middleclick';

const makeRenderer = () => {
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
  return { renderer, scrollLockedSetter };
};

const makeContainer = () => ({
  current: {
    style: {} as Record<string, string>,
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 800, height: 600 }),
  } as unknown as HTMLDivElement,
});

const mousedown = (over: Record<string, unknown> = {}) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: {
        type: 'iframe-mousedown',
        bookKey: BOOK_KEY,
        button: 1,
        screenX: 500,
        screenY: 300,
        clientX: 200,
        clientY: 150,
        windowX: 210,
        windowY: 160,
        ...over,
      },
    }),
  );
const mouseup = (button = 1) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'iframe-mouseup', bookKey: BOOK_KEY, button },
    }),
  );
const mousemove = (screenX: number, screenY: number) =>
  window.dispatchEvent(
    new MessageEvent('message', {
      data: { type: 'iframe-mousemove', bookKey: BOOK_KEY, screenX, screenY },
    }),
  );

afterEach(() => {
  cleanup();
  viewSettings = { scrolled: true };
  isDesktopApp = true;
});

describe('useMiddleClickAutoscroll', () => {
  it('is armed only in the desktop app AND scrolled mode', () => {
    const { renderer } = makeRenderer();
    const container = makeContainer();
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result, rerender } = renderHook(() =>
      useMiddleClickAutoscroll(BOOK_KEY, viewRef, container),
    );

    // Armed by default: a middle press starts a session.
    act(() => mousedown());
    expect(result.current).not.toBeNull();

    // Leaving the desktop app disarms and stops the session.
    isDesktopApp = false;
    rerender();
    act(() => mousedown({ screenY: 400 }));
    expect(result.current).toBeNull();

    // Leaving scrolled mode disarms too.
    isDesktopApp = true;
    viewSettings = { scrolled: false };
    rerender();
    act(() => mousedown());
    expect(result.current).toBeNull();
  });

  it('starts a session on middle mousedown and tracks the anchor', async () => {
    const { renderer } = makeRenderer();
    const container = makeContainer();
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result } = renderHook(() => useMiddleClickAutoscroll(BOOK_KEY, viewRef, container));

    act(() => mousedown());
    // Anchor is in reading-container coordinates (window point minus rect).
    expect(result.current).toEqual({ left: 200, top: 140, axis: 'y' });

    // Pointer travel beyond the dead zone drives the scroll position.
    act(() => mousemove(500, 500));
    await vi.waitFor(() => {
      expect(renderer.containerPosition).toBeGreaterThan(0);
    });
  });

  it('stops on wheel, Escape, and any mousedown; a sticky session survives release', () => {
    const { renderer } = makeRenderer();
    const container = makeContainer();
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result } = renderHook(() => useMiddleClickAutoscroll(BOOK_KEY, viewRef, container));

    // Quick release near the anchor keeps the session (sticky mode).
    act(() => mousedown({ screenY: 300 }));
    act(() => mousemove(500, 305));
    act(() => mouseup());
    expect(result.current).not.toBeNull();

    // A wheel anywhere ends the session.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'iframe-wheel', bookKey: BOOK_KEY, deltaY: 10 },
        }),
      );
    });
    expect(result.current).toBeNull();

    // Restart, then Escape ends it.
    act(() => mousedown());
    act(() => mousemove(500, 500));
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'iframe-keydown', bookKey: BOOK_KEY, key: 'Escape' },
        }),
      );
    });
    expect(result.current).toBeNull();

    // Restart, then any press ends it; a left press also swallows its click.
    act(() => mousedown());
    act(() => mousedown({ button: 0 }));
    expect(result.current).toBeNull();
    expect(eventDispatcher.dispatchSync('iframe-single-click')).toBe(true);
    // After the swallow window the click is not consumed: pin Date.now ahead
    // of the recorded window (the real value is captured before spying).
    const realNow = Date.now.bind(Date);
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(realNow() + 1000);
    expect(eventDispatcher.dispatchSync('iframe-single-click')).toBe(false);
    nowSpy.mockRestore();
  });

  it('never writes renderer.scrollLocked during a session', async () => {
    const { renderer, scrollLockedSetter } = makeRenderer();
    const container = makeContainer();
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result } = renderHook(() => useMiddleClickAutoscroll(BOOK_KEY, viewRef, container));

    // Travel beyond the dead zone (12px): the session scrolls and never touches scrollLocked.
    act(() => mousedown());
    act(() => mousemove(500, 400));
    await vi.waitFor(() => {
      expect(renderer.containerPosition).toBeGreaterThan(0);
    });
    expect(scrollLockedSetter).not.toHaveBeenCalled();
    // Travel beyond the dead zone means release ends the session.
    act(() => mouseup());
    expect(result.current).toBeNull();
  });

  it('keeps a sticky session after a quick release inside the dead zone, without scrolling', () => {
    const { renderer } = makeRenderer();
    const container = makeContainer();
    const viewRef = { current: { renderer } as unknown as FoliateView };
    const { result } = renderHook(() => useMiddleClickAutoscroll(BOOK_KEY, viewRef, container));

    act(() => mousedown());
    act(() => mousemove(500, 305)); // 5px: inside the dead zone
    act(() => mouseup());
    expect(result.current).not.toBeNull(); // sticky session survives release
    expect(renderer.containerPosition).toBe(0); // dead zone: no scroll

    // Clean up the lingering sticky session so it doesn't leak into other tests.
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'iframe-wheel', bookKey: BOOK_KEY, deltaY: 10 },
        }),
      );
    });
    expect(result.current).toBeNull();
  });
});

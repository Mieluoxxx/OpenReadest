import { useEffect } from 'react';
import { useEnv } from '@/context/EnvContext';
import { FoliateView } from '@/types/view';
import { ViewSettings } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { eventDispatcher } from '@/utils/event';
import { isTauriAppPlatform } from '@/services/environment';
import { tauriGetWindowLogicalPosition } from '@/utils/window';

type PaginationSide = 'left' | 'right' | 'up' | 'down';
type PaginationMode = 'pan' | 'page' | 'section';

const swapLeftRight = (side: PaginationSide) => {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return side;
};

const isPanningView = (view: FoliateView | null, viewSettings: ViewSettings | null | undefined) => {
  if (!view || !viewSettings) return false;
  return (
    view.book.rendition?.layout === 'pre-paginated' &&
    (viewSettings.zoomLevel > 100 || viewSettings.zoomMode !== 'fit-page')
  );
};

const hasHorizontalPanning = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
) => {
  if (!view || !viewSettings) return false;
  return isPanningView(view, viewSettings) && view.isOverflowX();
};

const hasVerticalPanning = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
) => {
  if (!view || !viewSettings) return false;
  return isPanningView(view, viewSettings) && view.isOverflowY();
};

// In scrolled mode, snap the page-scroll distance to whole lines so the new view
// tiles cleanly: forward, the new view's top aligns to the first line that wasn't
// fully visible (so no already-shown line repeats and lines aren't cut at the top);
// backward, the new view's bottom aligns to the last such line. `distance` is a
// positive scroll amount. Falls back to `distance` if the geometry is unavailable.
// Ported from upstream readest usePagination.ts (snapScrolledDistanceToLines).
const snapScrolledDistanceToLines = (
  view: FoliateView,
  distance: number,
  forward: boolean,
): number => {
  try {
    const visible = view.renderer.getContents().find((c) => {
      const f = c.doc?.defaultView?.frameElement?.getBoundingClientRect();
      return !!f && f.bottom > 1 && f.top < window.innerHeight;
    });
    const frameEl = visible?.doc?.defaultView?.frameElement as HTMLElement | undefined;
    if (!visible || !frameEl) return distance;
    let container: Element | null = frameEl;
    while (container && container.id !== 'container') container = container.parentElement;
    if (!(container instanceof HTMLElement)) return distance;

    const cRect = container.getBoundingClientRect();
    const frameRect = frameEl.getBoundingClientRect();
    const size = cRect.height;
    const scrollTop = container.scrollTop;

    const range = visible.doc.createRange();
    range.selectNodeContents(visible.doc.body);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
    if (rects.length < 2) return distance;
    const heights = rects.map((r) => r.height).sort((a, b) => a - b);
    const maxLineHeight = (heights[Math.floor(heights.length / 2)] ?? 0) * 1.8;

    // Line boxes in content (scroll) coordinates, sorted top-to-bottom (skip
    // block/container boxes that are much taller than a line).
    const toContent = (localY: number) => localY + frameRect.top - cRect.top + scrollTop;
    const lines = rects
      .filter((r) => r.height <= maxLineHeight)
      .map((r) => ({ top: toContent(r.top), bottom: toContent(r.bottom) }))
      .sort((a, b) => a.top - b.top);

    let snapped: number;
    if (forward) {
      // First line not fully visible at the bottom -> it becomes the new view's top.
      const bottomEdge = scrollTop + size;
      const next = lines.find((l) => l.bottom > bottomEdge + 1);
      if (!next) return distance;
      snapped = next.top - scrollTop;
    } else {
      // Last line not fully visible at the top -> it becomes the new view's bottom.
      const topEdge = scrollTop;
      let prev: { top: number; bottom: number } | undefined;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i]!.top < topEdge - 1) {
          prev = lines[i]!;
          break;
        }
      }
      if (!prev) return distance;
      snapped = scrollTop + size - prev.bottom;
    }
    // Guard against degenerate snaps; keep within roughly one page.
    return snapped > size * 0.4 && snapped < size * 1.6 ? snapped : distance;
  } catch {
    return distance;
  }
};

export const viewPagination = (
  view: FoliateView | null,
  viewSettings: ViewSettings | null | undefined,
  side: PaginationSide,
  mode: PaginationMode = 'page',
  panDistance: number = 50,
) => {
  if (!view || !viewSettings) return;
  const renderer = view.renderer;
  if (view.book.dir === 'rtl') {
    side = swapLeftRight(side);
  }
  if (renderer.scrolled) {
    // `renderer.size` is already the visible content height: in scrolled mode the
    // scroll container is inset by the header/footer (parent padding), so `size`
    // shrinks when they're shown. Subtracting their heights again here would
    // double-count and make consecutive views overlap. (Upstream readest parity.)
    const { size } = renderer;
    const scrollingOverlap = viewSettings.scrollingOverlap;
    const distance = size - scrollingOverlap;
    switch (mode) {
      case 'section':
        if (side === 'left' || side === 'up') {
          return view.renderer.prevSection?.();
        } else {
          return view.renderer.nextSection?.();
        }
      case 'pan':
      case 'page':
      default: {
        const forward = !(side === 'left' || side === 'up');
        // Snap so the view's bottom edge lands between lines (not for vertical flow).
        const snapped =
          viewSettings.vertical ||
          (viewSettings.scrolledDirection === 'horizontal' &&
            view.book.rendition?.layout === 'pre-paginated')
            ? distance
            : snapScrolledDistanceToLines(view, distance, forward);
        return forward ? view.next(snapped) : view.prev(snapped);
      }
    }
  } else if (mode === 'pan' && isPanningView(view, viewSettings)) {
    if (hasHorizontalPanning(view, viewSettings) && (side === 'left' || side === 'right')) {
      return view.pan(side === 'left' ? -panDistance : panDistance, 0);
    } else if (hasVerticalPanning(view, viewSettings) && (side === 'up' || side === 'down')) {
      return view.pan(0, side === 'up' ? -panDistance : panDistance);
    } else {
      return side === 'left' || side === 'up' ? view.prev() : view.next();
    }
  } else {
    switch (mode) {
      case 'section':
        if (side === 'left' || side === 'up') {
          return view.renderer.prevSection?.();
        } else {
          return view.renderer.nextSection?.();
        }
      case 'pan':
      case 'page':
      default:
        return side === 'left' || side === 'up' ? view.prev() : view.next();
    }
  }
};

export const usePagination = (
  bookKey: string,
  viewRef: React.MutableRefObject<FoliateView | null>,
  containerRef: React.RefObject<HTMLDivElement>,
) => {
  const { appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getViewSettings, getViewState } = useReaderStore();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const { acquireVolumeKeyInterception, releaseVolumeKeyInterception } = useDeviceControlStore();

  const handlePageFlip = async (
    msg: MessageEvent | CustomEvent | React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    const viewState = getViewState(bookKey);
    const bookData = getBookData(bookKey);
    if (!viewState?.inited || !bookData) return;

    if (msg instanceof MessageEvent) {
      if (msg.data && msg.data.bookKey === bookKey) {
        const viewSettings = getViewSettings(bookKey)!;
        if (msg.data.type === 'iframe-single-click') {
          const viewElement = containerRef.current;
          if (viewElement) {
            const { screenX } = msg.data;
            const viewRect = viewElement.getBoundingClientRect();
            let windowStartX;
            // Currently for tauri APP the window.screenX is always 0
            if (isTauriAppPlatform()) {
              if (appService?.isMobile) {
                windowStartX = 0;
              } else {
                const windowPosition = (await tauriGetWindowLogicalPosition()) as {
                  x: number;
                  y: number;
                };
                windowStartX = windowPosition.x;
              }
            } else {
              windowStartX = window.screenX;
            }
            const viewStartX = windowStartX + viewRect.left;
            const viewCenterX = viewStartX + viewRect.width / 2;
            const consumed = eventDispatcher.dispatchSync('iframe-single-click');
            if (!consumed) {
              const centerStartX = viewStartX + viewRect.width * 0.375;
              const centerEndX = viewStartX + viewRect.width * 0.625;
              if (
                viewSettings.disableClick! ||
                (screenX >= centerStartX && screenX <= centerEndX)
              ) {
                // toggle visibility of the header bar and the footer bar
                setHoveredBookKey(hoveredBookKey ? null : bookKey);
              } else {
                if (hoveredBookKey) {
                  setHoveredBookKey(null);
                  return;
                }
                if (!viewSettings.disableClick! && screenX >= viewCenterX) {
                  if (viewSettings.fullscreenClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'down');
                  } else if (viewSettings.swapClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'left');
                  } else {
                    viewPagination(viewRef.current, viewSettings, 'right');
                  }
                } else if (!viewSettings.disableClick! && screenX < viewCenterX) {
                  if (viewSettings.fullscreenClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'down');
                  } else if (viewSettings.swapClickArea) {
                    viewPagination(viewRef.current, viewSettings, 'right');
                  } else {
                    viewPagination(viewRef.current, viewSettings, 'left');
                  }
                }
              }
            }
          }
        } else if (
          msg.data.type === 'iframe-wheel' &&
          !viewSettings.scrolled &&
          !isPanningView(viewRef.current, viewSettings)
        ) {
          // The wheel event is handled by the iframe itself in scrolled mode.
          const { deltaY, deltaX } = msg.data;
          if (deltaY > 0) {
            viewPagination(viewRef.current, viewSettings, 'down');
          } else if (deltaY < 0) {
            viewPagination(viewRef.current, viewSettings, 'up');
          } else if (deltaX < 0) {
            viewPagination(viewRef.current, viewSettings, 'left');
          } else if (deltaX > 0) {
            viewPagination(viewRef.current, viewSettings, 'right');
          }
        } else if (msg.data.type === 'iframe-mouseup') {
          if (msg.data.button === 3) {
            viewRef.current?.history.back();
          } else if (msg.data.button === 4) {
            viewRef.current?.history.forward();
          }
        }
      }
    } else if (msg instanceof CustomEvent) {
      const viewSettings = getViewSettings(bookKey);
      if (msg.type === 'native-key-down' && viewSettings?.volumeKeysToFlip) {
        const { keyName } = msg.detail;
        setHoveredBookKey('');
        if (keyName === 'VolumeUp') {
          viewPagination(viewRef.current, viewSettings, 'up');
        } else if (keyName === 'VolumeDown') {
          viewPagination(viewRef.current, viewSettings, 'down');
        }
      } else if (
        msg.type === 'touch-swipe' &&
        bookData.isFixedLayout &&
        // In scrolled mode native scrolling owns the gesture: the renderer's
        // scroll container handles horizontal (and vertical) swipes itself, so
        // forwarding them to viewPagination would turn pages on top of the
        // scroll (upstream keeps swipes out of page turns whenever scrolled).
        !viewSettings?.scrolled &&
        !isPanningView(viewRef.current, viewSettings)
      ) {
        const { deltaX, deltaY, deltaT } = msg.detail;
        const vx = Math.abs(deltaX / deltaT);
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30 && vx > 0.2) {
          if (deltaX > 0) {
            viewPagination(viewRef.current, viewSettings, 'left');
          } else {
            viewPagination(viewRef.current, viewSettings, 'right');
          }
        }
      }
    } else {
      if (msg.type === 'click') {
        const { clientX } = msg;
        const width = window.innerWidth;
        const leftThreshold = width * 0.5;
        const rightThreshold = width * 0.5;
        const viewSettings = getViewSettings(bookKey);
        if (clientX < leftThreshold) {
          viewPagination(viewRef.current, viewSettings, 'left');
        } else if (clientX > rightThreshold) {
          viewPagination(viewRef.current, viewSettings, 'right');
        }
      }
    }
  };

  useEffect(() => {
    if (!appService?.isMobileApp) return;

    const viewSettings = getViewSettings(bookKey);
    if (viewSettings?.volumeKeysToFlip) {
      acquireVolumeKeyInterception();
    } else {
      releaseVolumeKeyInterception();
    }

    eventDispatcher.on('native-key-down', handlePageFlip);
    return () => {
      releaseVolumeKeyInterception();
      eventDispatcher.off('native-key-down', handlePageFlip);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    handlePageFlip,
  };
};

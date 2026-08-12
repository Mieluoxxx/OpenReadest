import type { BookDoc } from '@/libs/document';
import type { FoliateView } from '@/types/view';

// The app-facing `FoliateView.renderer` type is the intersection of the
// renderer contract OpenReadest relies on. Browser tests additionally need the
// foliate-paginator / foliate-fxl element surface (open/destroy/columnCount)
// and the upstream `goTo({anchor?})` shape, which upstream readest exposes as
// `Renderer` in `types/view.ts`. OpenReadest keeps that surface test-only — it
// is not part of the app contract — so it lives here instead of the shared
// types file. Omit the conflicting element-method members so the intersection
// with HTMLElement stays clean.
export type TestRenderer = Omit<
  FoliateView['renderer'],
  | 'goTo'
  | 'scrollToAnchor'
  | 'setAttribute'
  | 'removeAttribute'
  | 'addEventListener'
  | 'removeEventListener'
> &
  HTMLElement & {
    open: (book: BookDoc) => Promise<void>;
    destroy: () => void;
    render: () => Promise<void>;
    scrolled?: boolean;
    atStart: boolean;
    columnCount: number;
    goTo: (params: { index: number; anchor?: number }) => Promise<void>;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    nextSection?: () => Promise<void>;
    prevSection?: () => Promise<void>;
    setStyles?: (css: string) => void;
    getContents: () => { doc: Document; index?: number; overlayer?: unknown }[];
    primaryIndex: number;
    scrollToAnchor: (anchor: number | Range, reason?: string, smooth?: boolean) => Promise<void>;
  };

export type TestFxlRenderer = HTMLElement & {
  open(book: unknown): void;
  next(distance?: number): Promise<void>;
  prev(distance?: number): Promise<void>;
  containerPosition: number;
};

/** Load an EPUB fixture served by the Vite dev server. */
export const loadEPUB = async (url: string, name: string): Promise<BookDoc> => {
  const resp = await fetch(url);
  const buffer = await resp.arrayBuffer();
  const file = new File([buffer], name, { type: 'application/epub+zip' });
  const { DocumentLoader } = await import('@/libs/document');
  const loader = new DocumentLoader(file);
  const { book } = await loader.open();
  return book;
};

/**
 * Wait for the paginator to emit 'stabilized'.
 * MUST be called BEFORE the action that triggers stabilization (e.g. goTo),
 * because #display dispatches 'stabilized' synchronously before returning.
 */
export const waitForStabilized = (el: HTMLElement, timeout = 10000) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('stabilized timeout')), timeout);
    el.addEventListener(
      'stabilized',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/** Wait for fill to complete by polling until getContents count stabilizes. */
export const waitForFillComplete = async <T extends { getContents(): unknown[] }>(
  el: T,
  timeout = 10000,
) => {
  const start = Date.now();
  let lastCount = -1;
  let stableFor = 0;
  while (Date.now() - start < timeout) {
    const count = el.getContents().length;
    if (count === lastCount) {
      stableFor += 100;
      if (stableFor >= 500) return;
    } else {
      stableFor = 0;
      lastCount = count;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
};

/** Wait until `getContents().length >= n` or timeout. */
export const waitForViews = async <T extends { getContents(): unknown[] }>(
  el: T,
  n: number,
  timeout = 10000,
) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (el.getContents().length >= n) return;
    await new Promise((r) => setTimeout(r, 100));
  }
};

/** Poll until the paginator lands on the expected page or timeout. */
export const waitForPage = async <T extends { page: number }>(
  el: T,
  page: number,
  timeout = 3000,
) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (el.page === page) return;
    await new Promise((r) => setTimeout(r, 30));
  }
};

export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

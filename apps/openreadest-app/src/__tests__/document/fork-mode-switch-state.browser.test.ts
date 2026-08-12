import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { BookDoc } from '@/libs/document';
import { loadEPUB, waitForFillComplete, waitForStabilized } from './test-utils';
import type { TestRenderer as Renderer } from './test-utils';

// Fork-specific: OpenReadest has no upstream "captured turn" concept, so the
// mode-switch hazard surface is different — gesture / scroll state must not
// leak across `flow` attribute toggles. The renderer treats `scrollLocked` as
// app-owned state (it gates swipe input and is never reset by a mode change),
// which is exactly the invariant the fork's selection / Auto Scroll layers
// depend on. Position restore across a round trip is approximate (fraction
// anchor re-resolved against post-fill view geometry) but must stay inside
// the same section and never reset to the section start.

const EPUB_URL = new URL('../fixtures/data/sample-alice.epub', import.meta.url).href;

let book: BookDoc;

describe('OpenReadest scrolled-mode switch state (browser)', () => {
  let paginator: Renderer;

  beforeAll(async () => {
    book = await loadEPUB(EPUB_URL, 'sample-alice.epub');
    await import('foliate-js/paginator.js');
  }, 30000);

  const createPaginator = () => {
    const el = document.createElement('foliate-paginator') as Renderer;
    Object.assign(el.style, {
      width: '800px',
      height: '600px',
      position: 'absolute',
      left: '0',
      top: '0',
    });
    document.body.appendChild(el);
    return el;
  };

  const setupScrolledAt = async (index: number) => {
    paginator = createPaginator();
    paginator.open(book);
    paginator.setAttribute('flow', 'scrolled');
    const stabilized = waitForStabilized(paginator);
    await paginator.goTo({ index, anchor: 0 });
    await stabilized;
    await waitForFillComplete(paginator);
  };

  afterEach(() => {
    if (paginator) {
      try {
        paginator.destroy();
      } catch {
        /* iframe body may already be torn down */
      }
      paginator.remove();
    }
  });

  it('never sets scrollLocked itself and respects an app-owned lock across mode toggles', async () => {
    await setupScrolledAt(1);

    // Mode toggles must not introduce a lock (selection / gesture layers read
    // scrollLocked on every input; a phantom lock freezes page turns).
    expect(paginator.scrollLocked).toBe(false);
    const s1 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'paginated');
    await s1;
    expect(paginator.scrollLocked).toBe(false);
    const s2 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'scrolled');
    await s2;
    expect(paginator.scrollLocked).toBe(false);

    // An app-set lock (selection in progress) must survive the toggle — the
    // renderer owns the flag but never overwrites it.
    paginator.scrollLocked = true;
    const s3 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'paginated');
    await s3;
    expect(paginator.scrollLocked).toBe(true);
  });

  it('restores into the same section, not the section start, after a scrolled → paginated → scrolled round trip', async () => {
    await setupScrolledAt(1);

    // Scroll deep into the book; the debounced scroll handler tracks the
    // viewport-centre section as primaryIndex.
    const container = paginator.shadowRoot!.getElementById('container')!;
    container.scrollTop = 1500;
    await new Promise((r) => setTimeout(r, 400));
    const sectionBefore = paginator.primaryIndex;
    const posBefore = paginator.containerPosition;
    expect(sectionBefore).toBeGreaterThan(1); // scrolled well past the start
    expect(posBefore).toBeGreaterThan(100);

    const s1 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'paginated');
    await s1;

    const s2 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'scrolled');
    await s2;
    await waitForFillComplete(paginator);

    // Position preservation (upstream d609de58) is approximate: the fraction
    // anchor is re-resolved against post-fill geometry, so allow sub-viewport
    // drift — but the reader must stay in the section it was reading and must
    // not be teleported back to the section top.
    expect(paginator.primaryIndex).toBe(sectionBefore);
    expect(Math.abs(paginator.containerPosition - posBefore)).toBeLessThan(paginator.size);
    expect(paginator.containerPosition).toBeGreaterThan(0);
  });

  it('switches the scroll axis with the mode for vertical-rl books', async () => {
    // vertical-rl books scroll horizontally in scrolled mode and vertically
    // in paginated mode — the exact axis flip Auto Scroll's sign logic keys
    // off (useAutoScroll: scrollProp === 'scrollLeft' flips the delta sign).
    const vertical = await loadEPUB(
      new URL('../fixtures/data/sample-vertical-rl.epub', import.meta.url).href,
      'sample-vertical-rl.epub',
    );

    paginator = createPaginator();
    paginator.open(vertical);
    paginator.setAttribute('flow', 'scrolled');
    const stabilized = waitForStabilized(paginator);
    await paginator.goTo({ index: 0, anchor: 0 });
    await stabilized;
    expect(paginator.scrollProp).toBe('scrollLeft');

    const s1 = waitForStabilized(paginator);
    paginator.setAttribute('flow', 'paginated');
    await s1;
    expect(paginator.scrollProp).toBe('scrollTop');
  });
});

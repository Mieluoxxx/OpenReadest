import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { BookDoc } from '@/libs/document';
import { loadEPUB, waitForFillComplete, waitForStabilized } from './test-utils';
import type { TestRenderer as Renderer } from './test-utils';

// Fork-specific: OpenReadest's TTS follow-position (ttsAnchor.ts) decides
// whether a sentence is out of the visible scrolled window from
// `renderer.start/end/size` geometry, then anchors via
// `renderer.scrollToAnchor(range, true)`. This guards that renderer contract
// in a real browser: the geometry must describe the visible window, and
// scrollToAnchor must be a stable no-op for a range already anchored at the
// top (re-anchoring the same sentence must not jitter the viewport) while
// scrolling an out-of-view range into view.

const EPUB_URL = new URL('../fixtures/data/sample-alice.epub', import.meta.url).href;

let book: BookDoc;

describe('OpenReadest TTS anchor viewport contract (browser)', () => {
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

  /** First text range of the given section's document. */
  const firstRange = (index: number) => {
    const doc = paginator.getContents().find((c) => c.index === index)!.doc as Document;
    const textNode = doc.querySelector('p, h1, h2, div')!.firstChild!;
    const range = doc.createRange();
    range.setStart(textNode, 0);
    range.setEnd(textNode, Math.min(20, textNode.textContent?.length ?? 0));
    return range;
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

  it('reports the visible window geometry ttsAnchor keys off', async () => {
    await setupScrolledAt(1);

    // end - start is the visible window height == the paginator size. The
    // absolute start can sit slightly above the primary view (backward
    // preload inserts the previous section above it), so only the window
    // size is exact.
    expect(paginator.end - paginator.start).toBeCloseTo(paginator.size, 0);
  });

  it('re-anchoring an already-anchored range does not move the viewport', async () => {
    await setupScrolledAt(1);

    // Anchor the first sentence once: it lands at the top of the visible
    // window (within the 3px anchor inset).
    const range = firstRange(1);
    await paginator.scrollToAnchor(range, 'tts');
    const anchored = paginator.containerPosition;
    expect(paginator.start).toBeGreaterThanOrEqual(-4);

    // TTS re-emits the same sentence (sentence-boundary re-trigger): the
    // second anchor must be a sub-pixel no-op — no jitter, no drift.
    await paginator.scrollToAnchor(range, 'tts');
    expect(Math.abs(paginator.containerPosition - anchored)).toBeLessThan(1);
  });

  it('scrolls an out-of-view range into the visible window', async () => {
    await setupScrolledAt(1);

    // Jump to the section tail so the first sentence is far above the window.
    const container = paginator.shadowRoot!.getElementById('container')!;
    container.scrollTop = container.scrollHeight - paginator.size;
    await new Promise((r) => setTimeout(r, 350));
    const before = paginator.containerPosition;
    expect(before).toBeGreaterThan(paginator.size);

    await paginator.scrollToAnchor(firstRange(1), 'tts');

    // After anchoring, the range's window top (renderer.start) is at the
    // visible window's top — the TTS-visible guarantee the follow logic
    // builds on (the sentence is readable, not buried above the header).
    expect(paginator.start).toBeGreaterThanOrEqual(-4);
    expect(paginator.start).toBeLessThan(paginator.size);
    expect(paginator.containerPosition).toBeLessThan(before);
  });
});

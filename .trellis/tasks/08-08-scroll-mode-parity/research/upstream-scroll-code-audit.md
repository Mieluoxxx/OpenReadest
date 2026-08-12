# Upstream scroll-mode code audit (codegraph)

Date: 2026-08-12
Method: local clone of `readest/readest` (HEAD `474403e8`, 2026-08-11) + codegraph index (2,173 files). foliate-js checked out at `f65836f7` (main HEAD; the readest gitlink `63a2eb1f` is unreachable after an upstream force-push — verified against `b1bafcaf` which pinned `f65836f7`).

## 1. Upstream architecture map (readest-app)

### Settings model (`src/types/book.ts` ViewSettings)

Upstream scroll fields (line 209-229):

| Field                | Type                         | Notes                                                            |
| -------------------- | ---------------------------- | ---------------------------------------------------------------- |
| `scrolled`           | boolean                      | scroll mode on/off                                               |
| `scrolledDirection`  | `'vertical' \| 'horizontal'` | horizontal only meaningful for fixed-layout / PDF                |
| `webtoonMode`        | boolean                      | implies `scrolled` + fit-width + `scroll-gap` attribute          |
| `noContinuousScroll` | boolean                      | single-section scroll; sets `no-continuous-scroll` renderer attr |
| `scrollingOverlap`   | number                       | overlap subtracted from scroll distance per page turn            |
| `hideScrollbar`      | boolean                      | drives `applyScrollbarStyle`                                     |
| `autoScrollSpeed`    | number                       | percent; 100 = `AUTO_SCROLL_BASE_PX_PER_SEC` (20 px/s)           |

Removed upstream: `continuousScroll` (old edge-detection logic) and `showMarginsOnScroll` (replaced by dynamic `setScrollMargins`).

### Renderer wiring (`FoliateViewer.tsx`)

- `applyViewSettings`-style effect sets renderer attributes: `margin-*`, `gap`, `flow=scrolled`, `no-continuous-scroll` (conditional), `scroll-direction` (from `scrolledDirection`).
- `setScrollMargins({top, bottom})`: scroll viewport inset follows header/footer visibility (`topMargin` carries the 16px `moreTopInset` floor, readest#5303); fixed-layout books get `top: 0`.
- Per-document style hooks: `applyScrollModeClass(doc, scrolled)`, `applyScrollbarStyle(document, hideScrollbar)`, `applyScrollableStyle`/`applyTableTouchScroll` (table/equation scroll wrappers).

### Pagination (`hooks/usePagination.ts`)

- `ScrollSource = 'touch' | 'mouse'` (kept for API compat).
- `viewPagination()` scrolled branch: `distance = renderer.size - scrollingOverlap`; `snapScrolledDistanceToLines()` snaps the next view top/bottom to whole text lines (skipped for vertical flow and horizontal pre-paginated); section mode uses `prevSection/nextSection`.
- Wheel: in scrolled mode the iframe itself handles wheel (`iframe-wheel` only pages when `!viewSettings.scrolled`).
- The old `handleContinuousScroll` edge-detection (renderer.start/end + relocate listener + `view.prev/next` at threshold) is **gone**; replaced by paginator-internal preloading.

### Input lifecycle (`hooks/useRendererInputListeners.ts`)

- Registers renderer `scroll` listener and Android `native-touch` bridge **exactly once per view** (fixes listener accumulation on every section load — old code attached inside foliate load handler, so preloaded neighbour sections stacked duplicate listeners).
- Handlers read through refs; effect re-runs only on view or Android-gate change.

### Auto Scroll + middle-click (`utils/autoscroller.ts` + hooks)

- `Autoscroller`: middle-click anchor → pointer offset drives velocity (dead zone 12px, 10 px/s per px, cap 4000 px/s); quick release = sticky mode; pure logic with injectable rAF/clock.
- `PacedScroller`: teleprompter scroll at constant velocity, pause/resume, whole-pixel delta with fractional carry, `PACED_SCROLL_MAX_FRAME_MS=100` frame-gap clamp.
- `useAutoScroll`: session via `autoscroll-toggle` (View menu / Shift+A); drives `renderer.containerPosition += sign*delta` (sign flips for `scrollProp === 'scrollLeft'`, i.e. vertical-writing); 800ms stall → section hop (`view.next()`) or stop at book end; page tap pauses/resumes (consumes click); Escape/leaving scrolled mode stops; speed gesture via `useAutoScrollSpeedGesture`; session state never persisted.
- `useMiddleClickAutoscroll`: desktop-only + scrolled; iframe messages (`iframe-mousedown/up/move/wheel/keydown`); swallows the left click that ends a sticky session (500ms window); sets `setAutoscrollArmed`/`setAutoscrollTracking` (iframeEventHandlers).

### UI components

- `AutoScrollControl.tsx`, `AutoscrollIndicator.tsx` (anchor overlay), `AutoScrollSpeedOverlay.tsx`.
- `ViewMenu.tsx`: scrolled toggle (persists + sets `flow` attr + webtoon interactions), `scrolledDirection` toggle, Auto Scroll entry (uses `viewState.autoScrollEnabled`), webtoon mode (`scroll-gap` attr via `getScrollGapAttr`).

### Utilities

- `src/utils/scrollable.ts`: `SCROLL_WRAPPER_CLASS` etc.; wraps tables/display equations in a scroll box so swiping/wheeling them never turns the page; `findScrollableBox` duck-types across iframe realms; `SCROLL_WRAPPER_TOUCH_SCROLL_FLAG` for touch routing.
- `src/utils/style.ts`: `applyScrollModeClass`, `applyScrollbarStyle` (scrolled scrollbar kept visible, readest#64350ca6 family).
- `src/utils/webtoon.ts`: `getScrollGapAttr`.

## 2. foliate-js delta (OpenReadest `29fd7aa` → upstream `f65836f7`)

`git diff --stat 29fd7aa..f65836f7`: paginator.js +2974, fixed-layout.js +1253, pdf.js +456, view.js +93 (7 months of upstream evolution; only the scroll-relevant parts are in scope).

### paginator.js scroll-relevant symbols (f65836f7)

- `observedAttributes` includes `flow`, `no-preload`, `no-background`, `no-continuous-scroll`.
- `render(layout)`: `layout.flow !== 'scrolled'` → `columnize()`, else `scrolled()`.
- `scrolled(layout)`: column-width auto, CSS vars `--full-width/--available-width/--full-height/--available-height/--page-margin-*`; body `max-height/max-width` = columnWidth, `position: static` (prevents expand() divergence loops); `setImageSize(availableWidth, availableHeight)`; `expand()`.
- Scroll container listeners: debounced (250ms) `#afterScroll('scroll')`; eager forward preload (minPages=5 buffer) and backward preload (`#loadAdjacentSection` with scroll compensation, readest#4112); skips preload while finger-dragging (`#touchScrolled`), stabilizing, or filling.
- `#scrollLocked` + `scrollLocked` getter; `scrollToAnchor(anchor, reason?, smooth?)` (uses `#scrollToAnchor` with rAF when scrolled); `no-continuous-scroll` gate for continuous flow.
- Scroll-mode CSS: `:host([flow="scrolled"]) #container` rules, `gpu-composite` scoping, vertical-writing axis handling.

### fixed-layout.js (horizontal scroll)

- `observedAttributes`: adds `flow`, `scroll-gap`, `scroll-direction`.
- `:host([flow="scrolled"][scroll-direction="horizontal"]) .scroll-container/.scroll-page` CSS; `#scrollHorizontal` toggled by `scroll-direction` attr; RTL horizontal scrolls into negative coordinates; wheel translation: vertical tick → horizontal delta (pdf.js behavior, readest#4995); scrollbar collapses when pages fit.

### view.js

- Exposes `renderer.scrollToAnchor(range, true)` from TTS sentence positioning (line ~693); `scrollLocked` surface.

## 3. OpenReadest gap list (fork point baseline, `4678aca4`)

### Missing files (must port)

| Area       | Upstream file                                                                                                       | Notes                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| utils      | `src/utils/scrollable.ts`                                                                                           | table/equation scroll wrappers             |
| utils      | `src/utils/webtoon.ts`                                                                                              | `getScrollGapAttr`                         |
| utils      | `reader/utils/autoscroller.ts`                                                                                      | Autoscroller + PacedScroller (pure logic)  |
| utils      | `reader/utils/autoScrollSpeedGesture.ts`                                                                            | speed gesture                              |
| hooks      | `useAutoScroll.ts`                                                                                                  | PacedScroller session                      |
| hooks      | `useMiddleClickAutoscroll.ts`                                                                                       | middle-click session                       |
| hooks      | `useAutoScrollSpeedGesture.ts`                                                                                      | speed adjust gesture                       |
| hooks      | `useRendererInputListeners.ts`                                                                                      | once-per-view input listeners (fixes leak) |
| components | `AutoScrollControl.tsx`, `AutoscrollIndicator.tsx`, `AutoScrollSpeedOverlay.tsx`                                    | Auto Scroll UI                             |
| types      | `ViewSettings` fields: `scrolledDirection`, `webtoonMode`, `noContinuousScroll`, `hideScrollbar`, `autoScrollSpeed` | types/book.ts                              |
| reader     | `iframeEventHandlers` autoscroll armed/tracking flags                                                               | utils/iframeEventHandlers.ts               |

### Existing files with upstream drift (must align)

| File                      | OpenReadest (old)                                                                                                                                | Upstream (new)                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `usePagination.ts`        | `distance = size - overlap - (showHeader?44:0) - (showFooter?44:0)`; old `handleContinuousScroll` edge detection with `continuousScroll` setting | `distance = size - overlap` + `snapScrolledDistanceToLines`; no edge detection     |
| `FoliateViewer.tsx`       | sets `flow=scrolled` + margins + gap only; `showMarginsOnScroll` setting                                                                         | adds `no-continuous-scroll`, `scroll-direction`, `setScrollMargins` dynamic insets |
| `types/book.ts`           | `continuousScroll`, `showMarginsOnScroll` (obsolete)                                                                                             | fields listed above; both removed                                                  |
| `useAutoHideScrollbar.ts` | exists                                                                                                                                           | verify against upstream (scrollbar visibility in scrolled mode)                    |
| `style.ts`                | `applyScrollModeClass` present                                                                                                                   | add `applyScrollbarStyle` if missing                                               |

### Submodule

- OpenReadest foliate-js `29fd7aa` (2026-01-18) → upstream `f65836f7` (or next reachable pin). Scroll-relevant: paginator scrolled rendering/preload/scrollLocked/scrollToAnchor, fixed-layout horizontal scroll, pdf.js scroll support. **Not all 7 months of delta is in scope** — must cherry-pick behavior, not wholesale bump (upstream also carries unrelated changes).

## 4. Porting units (replaces/augments inventory scope conclusion)

1. **Renderers & paginator**: foliate-js scrolled-mode behavior (paginator.js, fixed-layout.js horizontal, view.js scrollToAnchor) — submodule pin or upstream port.
2. **Settings model**: ViewSettings field additions + config hydration (no upstream migration function exists; introduce at hydration boundary per current architecture doc).
3. **Reader adapter**: FoliateViewer renderer attributes + setScrollMargins + scrollable.ts wiring; usePagination distance/snap rewrite; useRendererInputListeners (fixes listener leak).
4. **Input & autoscroll**: autoscroller.ts + useAutoScroll + useMiddleClickAutoscroll + speed gesture + iframeEventHandlers flags.
5. **UI**: AutoScroll components + ViewMenu entries (scrolled/direction/webtoon/autoscroll) + ControlPanel/others.
6. **Validation**: upstream browser fixtures (paginator-scrolled/stabilization/expand/background-segments, fixed-layout-horizontal-scroll, scroll-wheel) + fork-specific tests.

Cross-cutting: progress save/restore and TTS visibility in scrolled mode depend on renderer `containerPosition`/`scrollToAnchor`; `scrollLocked` must never be overwritten by gesture or Auto Scroll code.

## 5. Open questions

- `useScrollToItem` (sidebar TOC) exists in both; verify drift.
- `hideScrollbar` default and ControlPanel placement upstream vs fork.
- Whether to port webtoon mode in the first parity wave (depends on `scroll-gap` attr in fixed-layout.js).
- pdf.js scroll wheel scheduling (readest#4995) depends on foliate-js pdf.js version; confirm fork pdf.js baseline.

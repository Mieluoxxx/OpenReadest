# Scroll-mode parity technical design

Date: 2026-08-08
Status: Planning

## 1. Architecture and boundaries

```text
Book config.json / global settings
          │ normalizeViewSettings()
          ▼
readerStore.viewSettings ──► ControlPanel / ViewMenu
          │                         │
          │                         ├─ renderer attributes/styles
          ▼                         ▼
FoliateViewer ── events ──► usePagination / gesture hooks
          │                         │
          ├─ progress / TTS / annotations / chrome
          ▼                         ▼
      foliate-js renderer and fixed-layout paginator
```

The application boundary remains `apps/openreadest-app`. The renderer boundary is `packages/foliate-js`. OpenReadest-specific services, translation, cloud sync, app data paths, and branding stay outside the migration surface.

## 2. Migration strategy

**foliate-js version decision (2026-08-12, advisor-reviewed):** `git log f65836f7..29fd7aa` is empty and `29fd7aa` is an ancestor of `f65836f7` → zero fork-local commits, clean ancestor. Strategy is **pin bump `29fd7aad` → `f65836f7` + reader-boundary fallout repair**, not behavior cherry-pick. Re-check `63a2eb1f` reachability (see research gitlink note) before finalizing the bump.

Use behavior-first staged migration:

1. Move the `foliate-js` gitlink from `29fd7aad` to `f65836f` and record the exact renderer contract changes.
2. Add one configuration normalization path at `loadBookConfig()` / view-state hydration. Do not invert `continuousScroll` independently in UI components.
3. Port the upstream reader adapter changes in dependency order, retaining the `openreadest-app` path and OpenReadest imports.
4. Port each upstream test with its behavior. Where upstream fixtures assume Readest-only services, replace only the harness boundary; do not copy unrelated product code.
5. Keep each child task buildable and reversible. The next child may depend on the previous child, but a partial feature must not silently change the persisted settings schema.

## 3. Settings contract

The normalized `ViewSettings` model should contain at least:

```ts
scrolled: boolean;
noContinuousScroll: boolean;
scrolledDirection: 'vertical' | 'horizontal';
webtoonMode: boolean;
hideScrollbar: boolean;
scrollingOverlap: number;
autoScrollSpeed: number;
```

Compatibility rules:

| Existing value              | New value                  |
| --------------------------- | -------------------------- |
| `continuousScroll=true`     | `noContinuousScroll=false` |
| `continuousScroll=false`    | `noContinuousScroll=true`  |
| missing `scrolledDirection` | `'vertical'`               |
| missing `webtoonMode`       | `false`                    |
| missing `autoScrollSpeed`   | upstream default           |

Normalization must be idempotent, preserve unknown config fields, and be covered by unit tests. New writes use the new fields; old `continuousScroll` remains readable during the compatibility window.

## 4. Renderer and data flow

`FoliateViewer` remains the single owner of renderer attribute application. Settings components update state through `saveViewSettings()` or a narrow shared renderer-attribute helper; they must not independently mutate different subsets of renderer state.

The renderer owns geometry and scroll position. `usePagination`, Auto Scroll, and TTS may request relative movement through the renderer contract, but must respect `scrollLocked`, `scrollProp`, `atStart`, and `atEnd`. Gesture handling must distinguish:

- native scroll input in scrolled mode;
- page turns in paginated mode;
- panning for zoomed fixed-layout documents;
- section navigation for single-section scroll;
- selection/annotation capture, which temporarily owns the gesture.

The final mouse-wheel behavior follows `f5e729a1`: do not resurrect the reverted custom smooth-wheel scheduler from `e18bfd68`.

## 5. Integration rules

- Progress relocation must continue to save through the existing OpenReadest stores and sync providers.
- TTS follow-position logic must use renderer scroll geometry and the configured header/footer overlap.
- Annotation selection must retain the renderer scroll lock until the selection gesture ends.
- Scroll-mode chrome must derive geometry from the same safe-area/header-band calculation as section info and progress UI.
- OpenReadest translation and cloud sync must remain independent of reader renderer changes.

## 6. Test architecture

Port tests in layers:

1. pure settings normalization and renderer-attribute tests;
2. paginator stabilization, section preload, CFI/position, vertical writing, and background tests;
3. fixed-layout PDF scroll, wheel delta, zoom/pan, text-selection, and edge-to-edge tests;
4. gesture, scroll-lock, Auto Scroll, middle-click, and speed-gesture tests;
5. React integration tests for ControlPanel, ViewMenu, ProgressBar, SectionInfo, TTS, annotation, and mode switching;
6. app-level smoke tests for WebDAV/S3, AI translation, web build, and Tauri build.

## 7. Rollout and rollback

Every child task records the previous application commit and previous `foliate-js` gitlink. If a stage fails, revert the stage's application changes and restore the prior gitlink before continuing investigation. Do not expose a partially migrated setting combination to users without a deterministic fallback.

The final rollout gate requires targeted tests, full Vitest, lint, type-check/build, and manual smoke checks for EPUB, PDF, fixed-layout, vertical writing, e-ink, and mobile gesture paths.

## 8. Audit unit → child task map

Mapping of research units (research/upstream-scroll-code-audit.md §4) to existing children:

| Audit unit                                                                                                                          | Child task                         | Notes                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| 1. Renderers & paginator (pin bump)                                                                                                 | `08-08-scroll-renderer-baseline`   | hard prerequisite for all others; owns the foliate-js bump decision          |
| 2. Settings model (+ migration)                                                                                                     | `08-08-scroll-renderer-baseline`   | normalization at hydration boundary; compatibility table §3; migration tests |
| 3. Reader adapter (viewer wiring, usePagination, scrollable.ts, input listeners)                                                    | `08-08-epub-scroll-paginator`      | EPUB flow + preloading + stabilization                                       |
| 4. PDF/fixed-layout (horizontal, wheel, zoom/pan)                                                                                   | `08-08-pdf-fixed-layout-scroll`    | depends on 1; shares renderer contracts with 3                               |
| 5. Input & autoscroll (wheel/touch/middle-click/Auto Scroll/speed gesture)                                                          | `08-08-scroll-input-autoscroll`    | depends on 3 and 4                                                           |
| 6. Integrations (progress/TTS/annotations/chrome)                                                                                   | `08-08-scroll-reader-integrations` | depends on 3, 4, 5                                                           |
| 7. Validation (incl. **test infra build**: `vitest.browser.config.mts` + `fixtures/data/sample-alice.epub` + `__tests__/document/`) | `08-08-scroll-parity-validation`   | hidden infra prerequisite — see research §3                                  |
| — webtoonMode (fit-width + `scroll-gap`)                                                                                            | follow-up task (NOT in wave 1)     | avoid inflating settings-model and fixed-layout scope                        |

Dependency note: `scroll-renderer-baseline` gates all other children; stated in parent prd.md.

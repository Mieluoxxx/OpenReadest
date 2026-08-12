# Readest scroll mode parity

## Goal

Bring OpenReadest's reading experience to parity with the current upstream Readest scroll-mode behavior while preserving OpenReadest's local-first product direction and fork-specific integrations.

The user-visible outcome is a reliable continuous-reading system for EPUB, PDF, CBZ, fixed-layout books, vertical writing, and image books across desktop, web, Android, iOS, and e-ink paths supported by the existing app.

## Confirmed facts

- OpenReadest forked from Readest at `481d8198e9d02b8072d709e4e18610e478dee72d`.
- OpenReadest currently uses `packages/foliate-js` at `29fd7aad`; upstream reader work requires the newer `f65836f` line.
- The current OpenReadest reader still exposes `continuousScroll` and `scrollingOverlap`, but not the upstream `noContinuousScroll`, `scrolledDirection`, Auto Scroll, or fixed-layout horizontal-scroll model.
- The current reader configuration is loaded from per-book `config.json` and merged with global defaults in `readerStore.ts`; changes are persisted through `saveViewSettings()` and `saveBookConfig()`.
- The fork has almost no reader-specific regression tests for this area, while the upstream changes add paginator, PDF, gesture, and scroll-mode tests.

## Requirements

### R1. Renderer baseline

Upgrade `packages/foliate-js` to the agreed upstream commit and adapt the OpenReadest wrapper to the renderer contracts it exposes. The upgrade must remain isolated from OpenReadest's Tauri, sync, translation, and branding changes.

### R2. EPUB and document-flow scrolling

Support upstream continuous scrolling, multi-section stabilization, spread layout, section preloading, single-section scrolling, vertical writing, background textures, wide tables, oversized blocks, and scroll-position preservation.

### R3. PDF and fixed-layout scrolling

Support PDF scrolled mode, pinch zoom, pan, mobile rendering scheduling, wheel behavior, text-selection coordinates, horizontal scrolling for fixed-layout books, and edge-to-edge fixed-layout rendering.

### R4. Input and automatic scrolling

Match upstream wheel classification and final wheel behavior, touch/trackpad gesture arbitration, Magic Mouse filtering, middle-button autoscroll, Auto Scroll mode, speed adjustment gestures, and scroll-lock interactions.

### R5. Reader integrations

Keep progress, chapter title, header/footer, safe-area masks, TTS follow position, annotations, instant selection, bookmark ribbons, proofread transforms, and scroll/pagination transitions coherent with the active scroll mode.

### R6. Settings compatibility

Add the upstream settings model without breaking existing OpenReadest books. Existing `continuousScroll=true` maps to `noContinuousScroll=false`; `continuousScroll=false` maps to `noContinuousScroll=true`. New fields are defaulted deterministically and persisted in the existing per-book/global configuration path.

### R7. Verification and rollout

Port relevant upstream tests, add OpenReadest-specific compatibility tests, validate desktop/web/mobile/e-ink-sensitive paths where practical, and define a rollback point for both the application changes and the `foliate-js` gitlink.

## Acceptance Criteria

- [ ] EPUB continuous scroll works across section boundaries without loading stalls, navigation drift, or lost reading position.
- [ ] Single-section scroll, spread layout, vertical writing, background textures, wide tables, and oversized blocks behave as specified.
- [ ] PDF scrolled mode supports smooth wheel movement, pinch zoom, pan, mobile rendering without visible lag, and correct text selection.
- [ ] Fixed-layout books support vertical and horizontal scrolling, correct centering, edge-to-edge rendering, and no accidental page-turn overlays.
- [ ] Auto Scroll, middle-button autoscroll, speed gestures, touch/trackpad gestures, and scroll-lock behavior do not conflict with page turns or annotations.
- [ ] TTS, progress saving/sync, chapter titles, headers/footers, bookmarks, annotations, and proofread rules remain correct in both scroll and paginated modes.
- [ ] Existing OpenReadest WebDAV/S3, AI translation, local storage, branding, and build flows remain unaffected.
- [ ] All new settings load old book configs deterministically and do not create invalid or ambiguous combinations.
- [ ] Targeted reader tests, full app tests, lint, type-check/build checks, and the final rollout smoke matrix pass or have explicitly documented platform limitations.

## Out of scope

- Synchronizing unrelated upstream account, cloud, subscription, telemetry, or AI-reader features.
- Replacing OpenReadest's WebDAV/S3 implementation or translation providers.
- Blindly synchronizing the entire upstream `apps/readest-app` directory.
- Treating unrelated page-curl, notebook, or annotation-hub redesigns as required unless a scroll-mode dependency makes a narrow port necessary.

## Child task map and dependencies

1. `08-08-scroll-renderer-baseline`: foliate-js pin bump (`29fd7aa` → `f65836f7`; clean-ancestor decision in research §2), settings model + compatibility normalization. **Hard prerequisite for every other child** — no other child starts until the bump and settings model land.
2. `08-08-epub-scroll-paginator`: EPUB flow, paginator stabilization, preloading, and document-flow behavior. Depends on 1.
3. `08-08-pdf-fixed-layout-scroll`: PDF and fixed-layout scroll/zoom/pan. Depends on 1; shares renderer contracts with 2.
4. `08-08-scroll-input-autoscroll`: wheel, touch, trackpad, middle-click, Auto Scroll, speed gestures. Depends on 2 and 3.
5. `08-08-scroll-reader-integrations`: progress, TTS, annotations, chrome, textures, and mode transitions. Depends on 2, 3, and 4.
6. `08-08-scroll-parity-validation`: cross-platform matrix, regression suite, rollout and rollback. Depends on 1–5. **Includes test-infra build**: browser-mode vitest config, `sample-alice.epub` fixtures, and the `__tests__/document/` suite (missing today — see research §3).

## Key decisions

- Use staged, source-backed migration rather than directory replacement or blind cherry-picking.
- Upgrade `foliate-js` first (pin bump `29fd7aa` → `f65836f7`, clean ancestor — see research §2), then adapt OpenReadest at the reader boundary.
- `webtoonMode` is out of wave 1 (follow-up task); scroll parity must not depend on it.
- `ScrollSource` is dead code upstream; do not port it.
- Treat `f5e729a1` as the final upstream mouse-wheel behavior; do not reintroduce the later-reverted `e18bfd68` smooth-wheel implementation by itself.
- Keep the parent and child tasks in Trellis `planning` until the final planning summary is explicitly approved.

# Upgrade foliate-js and scroll settings model

## Goal

Establish the renderer and configuration baseline required by all later scroll-parity stages.

## Requirements

- Update the `packages/foliate-js` gitlink from `29fd7aad` to `f65836f`.
- Record and adapt the renderer contracts used by `FoliateViewer`, `usePagination`, annotations, and TTS.
- Add `noContinuousScroll`, `scrolledDirection`, `webtoonMode`, `hideScrollbar`, and `autoScrollSpeed` to the normalized view model with upstream-compatible defaults.
- Normalize legacy `continuousScroll` values at book-config hydration without dropping unknown fields.
- Keep OpenReadest's existing global/per-book persistence and fixed-layout defaults intact.

## Acceptance Criteria

- [ ] The app type-checks against the upgraded renderer.
- [ ] Old configs load deterministically and normalization is idempotent.
- [ ] New fields are persisted through the existing `saveViewSettings` path.
- [ ] Focused settings and renderer-contract tests pass.

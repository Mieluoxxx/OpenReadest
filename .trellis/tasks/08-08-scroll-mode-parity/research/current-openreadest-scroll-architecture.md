# Current OpenReadest scroll architecture

Date: 2026-08-08

## Configuration and persistence

- `BaseAppService.loadBookConfig()` merges per-book `config.json` with global view defaults.
- `readerStore.initViewState()` loads the merged `config.viewSettings` and stores it in `viewStates[key].viewSettings`.
- `saveViewSettings()` updates global settings when the setting is global, updates the in-memory view state, applies styles, and persists the primary book config.
- Current scroll fields include `scrolled`, `continuousScroll`, and `scrollingOverlap` in `ControlPanel.tsx`, `constants.ts`, and `types/book.ts`.
- There is no dedicated normalization/migration function for old view-setting fields; new compatibility logic must be introduced at the config hydration boundary rather than scattered through UI effects.

## Renderer and reader flow

- `FoliateViewer` creates the `foliate-js` view, applies renderer attributes/styles, installs iframe event listeners, and connects progress/TTS/KOSync/annotation hooks.
- `usePagination` owns page/section/pan decisions. In scrolled mode it calculates a viewport-sized distance from renderer size, overlap, and visible header/footer chrome.
- The current fixed-layout path supports panning based on `zoomLevel`, `zoomMode`, and renderer overflow, but has no upstream `scrolledDirection` contract.
- The current `foliate-js` paginator exposes `flow=scrolled`, `containerPosition`, `scrollLocked`, and section navigation; the newer upstream submodule adds more fixed-layout and scroll scheduling behavior.

## Integration boundaries

- Progress is emitted by renderer relocation events and saved through `useProgressSync`/`useProgressAutoSave`.
- TTS reads renderer contents and uses `scrollingOverlap` plus header/footer visibility to keep the spoken range visible.
- Text selection and instant annotation can set `renderer.scrollLocked`; this must not be overwritten by gesture or Auto Scroll code.
- Scroll-mode UI is split between `ControlPanel`, `ViewMenu`, `SectionInfo`, `ProgressBar`, footer components, and annotation/TTS overlays.

## Current verification gap

OpenReadest has no focused paginator/browser test suite comparable to upstream. The validation child must first port the smallest relevant upstream fixtures and then add fork-specific tests for configuration migration, AI translation coexistence, WebDAV/S3 builds, and the renamed `openreadest-app` paths.

# Scroll-mode parity implementation plan

## Execution order

1. **Renderer baseline** — update the `foliate-js` gitlink, inventory renderer API differences, add settings normalization, extend types/defaults, and add migration tests.
2. **EPUB paginator** — port continuous scroll, stabilization, spread layout, multi-section preloading, position restoration, single-section mode, vertical writing, background, table, and oversized-block behavior.
3. **PDF/fixed layout** — port PDF scroll scheduling, pinch zoom, pan, wheel delta handling, selection coordinates, horizontal fixed-layout scrolling, centering, and edge-to-edge rendering.
4. **Input/Auto Scroll** — port final wheel handling, touch/trackpad arbitration, Magic Mouse filtering, middle-button autoscroll, Auto Scroll, speed adjustment, and scroll-lock guards.
5. **Reader integrations** — port progress/header/footer/chapter UI, TTS follow position, annotations, bookmarks, proofread, safe-area textures, and mode-switch captured-turn fixes.
6. **Validation/rollout** — complete fixtures and browser tests, run the full validation matrix, document known platform limits, and prepare rollback notes.

## Per-stage gate

- Read the parent PRD/design and the stage research before editing.
- Keep OpenReadest-specific imports, paths, stores, sync, translation, and branding intact.
- Add or port a focused test before moving to the next stage.
- Run `pnpm --filter @openreadest/app test --run` with the narrow test path, then `pnpm --filter @openreadest/app lint` and the relevant type/build check.
- Inspect the diff for unintended upstream account/cloud/product changes.
- Record the previous `foliate-js` gitlink and the rollback point in the child task.

## Final validation commands

```bash
pnpm --filter @openreadest/app test --run
pnpm --filter @openreadest/app lint
pnpm --filter @openreadest/app build
pnpm build-web
```

Run platform-specific Tauri checks only when the required local toolchains are available. The final manual matrix must cover reflowable EPUB, fixed-layout EPUB, PDF, CBZ/image books, vertical writing, e-ink mode, desktop wheel/middle-click, touch pinch/pan, TTS, annotations, progress restore, and WebDAV/S3/AI translation smoke paths.

## Risky files and rollback points

- `packages/foliate-js` gitlink and submodule contents.
- `apps/openreadest-app/src/types/book.ts`, `services/constants.ts`, `services/appService.ts`, and `store/readerStore.ts` for settings compatibility.
- `FoliateViewer.tsx`, `usePagination.ts`, `useIframeEvents.ts`, and `iframeEventHandlers.ts` for input ownership.
- `useAutoScroll.ts`, `useMiddleClickAutoscroll.ts`, TTS and annotation hooks for cross-feature interactions.
- `ControlPanel.tsx`, `ViewMenu.tsx`, `SectionInfo.tsx`, `ProgressBar.tsx`, and footer components for scroll chrome.

Do not start implementation until the parent and relevant child planning artifacts are reviewed and the final planning summary is explicitly approved.

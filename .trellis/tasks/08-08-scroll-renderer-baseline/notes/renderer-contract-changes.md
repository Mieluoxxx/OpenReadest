# Renderer contract changes: 29fd7aad → f65836f7

Date: 2026-08-08
Task: 08-08-scroll-renderer-baseline
Rollback: restore `packages/foliate-js` to `29fd7aadf947639f86ce0de7f381a62b52bd32b4` (previous gitlink commit `0c5a3e6a`'s parent).

## Version decision

- `29fd7aa` is an ancestor of `f65836f` → clean pin bump, no fork-local commits (146 upstream commits).
- Submodule checked out at `f65836f77e8b66b84baacd54bfc92096578e7a84`.

## Contract changes vs OpenReadest call surface

| API                          | Change                                                                                                 | OpenReadest impact                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| `renderer.scrollLocked`      | getter + setter (`ba57ec8`); touch gesture rejects layered turn when locked                            | Compatible; `useTextSelector` read/write still works          |
| `renderer.containerPosition` | writable in scroll mode (`c1b1bbf`)                                                                    | `useTextSelector.ts:187` assignment now actually takes effect |
| `renderer.scrollToAnchor`    | unchanged                                                                                              | Compatible                                                    |
| renderer attributes          | new: `no-continuous-scroll`, `scroll-gap`, `no-preload`, `no-background`                               | Not used yet; later scroll-parity stages apply them           |
| paginator internal           | `#scrollBounds` seeded by `#scrollToPage`; `scrollBy`/swipe bail out before seeding (`31176e5d` guard) | Fixes fast-swipe crash on mount                               |
| layered turns                | `#isAnimating`/`#slideTurnId`/`#dragTranslateX`, CSS-animated scrolling                                | No OpenReadest call change                                    |
| fixed-layout                 | horizontal scroll mode, live pinch-zoom/pan, bounded preload scheduler (`#40`)                         | No call change; behavior for later PDF stage                  |
| `tts.js`                     | exports `getSentences` (`#46`); node filter decides ruby (`#67`)                                       | `initTTS` signature unchanged                                 |
| `view.js`                    | cursor autohider respects selection; annotation `range` guard; `PageProgress` cfi                      | Compatible                                                    |
| `opds.js`                    | `numberOfItems` now `number` (was string)                                                              | Adapted `types/opds.ts` to `number`                           |
| `pdf.js`                     | DPR rasterisation, iOS memory bound, range-read throttling, OS font scaling                            | No call change                                                |
| `epub.js`                    | calibre custom columns, reserved-char hrefs, cover-named entries                                       | No call change                                                |

## Compile adaptation (this task)

- `apps/openreadest-app/src/types/opds.ts`: `numberOfItems?: string` → `number` (two sites) to match new `opds.js` output. Rendering sites (`FeedView`, `NavigationCard`) accept `number` unchanged.

## Open items for later stages

- `noContinuousScroll` / `scrolledDirection` / `webtoonMode` / `hideScrollbar` / `autoScrollSpeed` are model-only; renderer attributes (`no-continuous-scroll` etc.) are NOT applied yet.
- `usePagination.handleContinuousScroll` and `ScrollSource` remain (active event chain); upstream parity work lands in the epub-scroll child.
- `ControlPanel` still writes legacy `continuousScroll`; migration of UI writes is a later child.

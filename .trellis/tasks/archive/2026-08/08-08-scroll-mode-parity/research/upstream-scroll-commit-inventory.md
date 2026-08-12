# Upstream scroll-mode commit inventory

Date: 2026-08-08

## Fork provenance

- Fork point: `481d8198e9d02b8072d709e4e18610e478dee72d`
- OpenReadest first independent commit: `4678aca4076564cc7b6ec3a4a0a9f8b648c52419`
- OpenReadest current `foliate-js`: `29fd7aadf947639f86ce0de7f381a62b52bd32b4`
- Readest current `foliate-js` gitlink: `f65836f77e8b66b84baacd54bfc92096578e7a84`

## Migration-relevant commits

| Area                    | Commit                                                                                                                             | Evidence / migration implication                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| PDF scroll foundation   | `7a605a357ad46195644f5cb695eb26ad724e69e4`                                                                                         | Enables PDF scroll mode, pitch zoom, panning, and fixed-layout reader hooks.                                     |
| EPUB flow foundation    | `1af55e24daad045275600be50361682d65656077`                                                                                         | Adds continuous scroll, spread layout, stabilization tests, progress/TTS integration, and a `foliate-js` update. |
| Single-section scroll   | `c4e33156426aafe255d80c37ba4cb60e80351e7b`                                                                                         | Introduces `noContinuousScroll` and the renderer `no-continuous-scroll` attribute.                               |
| Position and navigation | `d609de58f023787c51eb1ea6625b9e11b7a35b45`, `3c14d5a4b9e99f53b855b5defd0d8556bfc7c9fb`                                             | Preserves position when toggling modes and fixes previous-section preload/navigation drift.                      |
| Scroll interaction      | `e18bfd681025576c818d5a41edb17e4d1380c695` → `f5e729a174140ab59737d76755205ebc1955cbba`                                            | Smooth mouse-wheel implementation was added and then reverted. The second commit defines final behavior.         |
| PDF performance         | `1b44b95d3aa1b9400edfd57de4fdf90326d71dd2`, `580c5e5deb5a993e0445e9f46dbc4fece967ec7a`, `f8916e128e4410e198956976e6c8af60690a093d` | Wheel scheduling, mobile scroll rendering, pinch zoom, and pan rely partly on `foliate-js`.                      |
| Automatic scrolling     | `6f3b401c2457c0e27ea6116f096f879b9c86cbf2`, `f8ad47a418d608aa4d36bb7ab0533b0f3d0119bb`, `8ba9cf27742344937acb3c128b2e2f51512e82b2` | Adds middle-click autoscroll, Auto Scroll mode, and speed adjustment gesture.                                    |
| Fixed-layout scrolling  | `69985e5e5a63a655b23c6b2b132a124c94550c4e`, `67f850e5cdadf5bdd5537e84b5f6107bdf7c5d14`                                             | Adds `scrolledDirection`, horizontal fixed-layout scrolling, and edge-to-edge rendering.                         |
| Final chrome regression | `5ecb835c3eda200845ecb3bfd326c1a9af4d7bbb`                                                                                         | Fixes scroll-mode toggle fallout in proofread, footer chrome, captured turns, and adds regression tests.         |

## Important non-feature dependencies

- `31176e5d` updates `foliate-js` for a `scrollBounds` guard.
- `797fe9c6`/`b8728681` address paginator expansion freezes.
- `64350ca6` keeps the scrolled scrollbar visible after opening a book.
- `7716f189` keeps header/footer chrome transparent and fixed in scrolled mode.
- `7786400b` keeps the PDF footer readable in scrolled mode.

## Scope conclusion

The migration unit is not an individual commit. The smallest safe unit is an upstream behavior plus its renderer gitlink, settings/type changes, reader adapter changes, and focused tests. The application should not copy unrelated upstream account, cloud, or brand code.

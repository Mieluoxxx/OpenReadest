# PDF and fixed-layout design

Use the upgraded `foliate-js` fixed-layout renderer for geometry, overflow, scroll direction, and PDF scheduling. The OpenReadest adapter maps `ViewSettings` to renderer attributes and keeps `usePagination` responsible for deciding between pan, scroll, and page turn.

Horizontal fixed-layout scrolling must be an explicit `scrolledDirection` mode, not an inferred overflow fallback. Selection and footer overlays must use the same renderer coordinate system as the upstream tests.

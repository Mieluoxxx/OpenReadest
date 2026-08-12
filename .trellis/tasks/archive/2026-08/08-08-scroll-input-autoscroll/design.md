# Scroll input and Auto Scroll design

Keep input ownership explicit. Native scroll owns high-resolution scrolled-mode input; paginator owns paginated turns; fixed-layout pan owns zoomed overflow; annotation capture owns selection gestures; Auto Scroll owns only its active session. `scrollLocked` is a renderer contract and must be respected by every active input path.

Reuse the upstream `Autoscroller`/`PacedScroller` behavior and tests, adapting only event dispatch and OpenReadest stores. Do not reintroduce `e18bfd68`'s removed `SmoothScroller`.

# Port PDF and fixed-layout scrolling

## Goal

Port upstream PDF and fixed-layout scrolling, zoom, pan, and rendering behavior without regressing paginated books.

## Requirements

- Support PDF scroll mode, wheel deltas, pinch zoom, pan, mobile scheduling, and text-selection coordinates.
- Support fixed-layout vertical/horizontal scroll direction, centering, edge-to-edge rendering, and safe footer/header behavior.
- Preserve image/CBZ behavior and existing zoom settings.

## Acceptance Criteria

- [ ] PDF scroll mode is smooth and does not kick back, lag visibly, or misplace selection.
- [ ] Zoomed documents pan on both axes where overflow exists.
- [ ] Fixed-layout horizontal scrolling works with vertical wheel input and does not trigger accidental page turns.
- [ ] Portrait single-page, spread, dark mode, e-ink, and mobile cases are covered.

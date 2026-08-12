# Port EPUB continuous scroll and paginator

## Goal

Port upstream reflowable-document scrolling so EPUB and similar flowable books remain stable across sections and layouts.

## Requirements

- Port continuous scroll and spread layout behavior.
- Port stabilization, multi-section preload, previous-section navigation, and position restoration.
- Support single-section scroll, vertical writing, background textures, wide tables, and oversized blocks.
- Preserve OpenReadest progress, KOSync, TTS, proofread, translation, and annotation transforms.

## Acceptance Criteria

- [ ] Long EPUBs scroll across section boundaries without blank gaps or navigation drift.
- [ ] Toggling scroll mode restores the nearest valid reading position.
- [ ] Single-section, vertical-writing, table, image, and background cases have focused tests.
- [ ] Progress and TTS follow the visible section correctly.

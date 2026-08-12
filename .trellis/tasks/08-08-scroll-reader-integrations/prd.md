# Integrate scroll UI TTS annotations and progress

## Goal

Complete the cross-feature behavior that makes scroll mode feel coherent rather than merely renderable.

## Requirements

- Port progress/chapter title/header/footer/safe-area behavior in scrolled mode.
- Keep TTS follow-position and overlap calculations correct across sections and scroll axes.
- Preserve annotation, instant selection, bookmark ribbon, proofread, translation, and background texture behavior.
- Fix scroll/pagination toggle state so captured turns and renderer attributes cannot both own a gesture.

## Acceptance Criteria

- [ ] Progress and chapter UI remain readable and anchored while scrolling.
- [ ] TTS keeps the spoken range visible and restores position correctly.
- [ ] Annotations and proofread rules do not unlock or steal scroll gestures incorrectly.
- [ ] Switching modes does not create multi-page turns, stale captures, or stale chrome.

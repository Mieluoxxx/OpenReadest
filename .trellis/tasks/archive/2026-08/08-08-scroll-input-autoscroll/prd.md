# Port scroll input gestures and auto-scroll

## Goal

Make mouse, touch, trackpad, middle-button, and automatic scrolling behavior match upstream without competing with page turns or annotation selection.

## Requirements

- Adopt the final upstream wheel behavior, including the later rollback of the custom smooth-wheel implementation.
- Port Magic Mouse filtering, touch/trackpad arbitration, scroll-lock guards, and fixed-layout swipe behavior.
- Add desktop middle-button autoscroll, Auto Scroll mode, pause/resume, speed control, end-of-book handling, and right-edge speed gestures.

## Acceptance Criteria

- [ ] Trackpad momentum and mouse-wheel behavior do not cause duplicate turns or jerky custom replay.
- [ ] Annotation/selection capture prevents competing scroll or page-turn actions.
- [ ] Auto Scroll and middle-button autoscroll work for vertical and horizontal scroll axes and stop safely at boundaries.
- [ ] Escape, wheel, click, mode switch, blur, and leaving the book clean up active sessions.

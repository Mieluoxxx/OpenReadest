# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Pattern: Coordinate-Positioned Context Menu

`components/ContextMenu.tsx` renders a daisyUI menu at `(x, y)` client coordinates with viewport clamping. It is the shared container for right-click menus (bookshelf items).

**Contract** (see `ContextMenu.tsx`):

```tsx
interface ContextMenuProps {
  x: number; // clientX; keyboard path passes item-center
  y: number; // clientY
  onClose: () => void;
  children: React.ReactNode; // expects <Menu> / <MenuItem> structure
  className?: string;
}
```

- Rendered via `ReactDOM.createPortal` to `document.body` (same as `ModalPortal`).
- `position: fixed`; `useLayoutEffect` keyed on `[x, y]` measures real size and clamps to viewport (margin 8px); a `resize` listener re-clamps.
- z-index must sit **above** the full-screen `Overlay` (`z-[110]` menu vs overlay in earlier DOM order).
- Dismissal: full-screen `Overlay` click/right-click + `useKeyDownActions({ onCancel })` (Escape).
- **No `open` prop** — the caller conditionally renders it (`state && <ContextMenu/>`).
- `MenuItem.onClick` does NOT auto-close; every caller's onClick must call `onClose`/clear state explicitly.

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

### Gotcha: throttled callback + async appService = stale closure

`useCallback(throttle(...), deps)` captures the **first render's** closure. If the callback gates on `appService?.hasContextMenu` and `appService` loads asynchronously (EnvProvider `getAppService().then(setAppService)`), the throttled handler sees the initial `null` forever — menu never opens, even after the service resolves.

**Fix**: don't read `appService` inside the throttled/`useCallback`-wrapped function. Gate at the call site (fresh closure per render), e.g. `useLongPress.onContextMenu` and `handleKeyDown` check `appService?.hasContextMenu` before dispatching; the shared opener only sets state.

### Known debt: throttle inside useCallback triggers `react-hooks/use-memo`

The repo has 3 pre-existing lint errors in `BookshelfItem.tsx` (`throttle(() => {...}, 100)` as first arg of `useCallback`). This is accepted baseline debt — do not "fix" adjacent functions while touching the file; match the existing pattern.

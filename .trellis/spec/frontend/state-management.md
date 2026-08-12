# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

(To be filled by the team)

---

## Common Mistakes

<!-- State management mistakes your team has made -->

(To be filled by the team)

## ViewSettings Normalization Contract (2026-08-12)

Scroll-mode settings live in per-book `config.json` + global defaults and are
normalized ONCE at the hydration boundary. UI components must never interpret
legacy fields themselves.

### Signatures

```ts
// apps/openreadest-app/src/utils/viewSettings.ts
normalizeViewSettings(
  raw: Partial<BookLayout> & { continuousScroll?: boolean },
  opts: { source: 'global' | 'perBook'; global?: Partial<BookLayout> },
): BookLayout
```

### Migration rules (idempotent; unknown fields preserved)

| Input                                   | Output                                           |
| --------------------------------------- | ------------------------------------------------ |
| `continuousScroll: true`                | `noContinuousScroll: false`                      |
| `continuousScroll: false`               | `noContinuousScroll: true`                       |
| `continuousScroll` missing              | `noContinuousScroll: false` (default continuous) |
| new field explicitly present            | new field wins (legacy branch skipped)           |
| `scrolledDirection` missing             | `'vertical'`                                     |
| `webtoonMode` / `hideScrollbar` missing | `false`                                          |
| `autoScrollSpeed` missing               | `100` (20 px/s base, see constants)              |

### Hydration boundaries (both must call normalize)

1. `serializer.ts deserializeConfig()` — per-book explicit values override
   global defaults (`{...global, ...perBook}` merge order).
2. `readerStore.initViewState()` — final merged object (idempotency guard).

New writes use the new fields; legacy `continuousScroll` stays readable for the
compatibility window. Old global files with explicit `continuousScroll=false`
normalize to single-section scroll — conservative, documented behavior.

### Tests required

- `__tests__/utils/viewSettings.test.ts`: three-state mapping, defaults,
  idempotency, unknown-field preservation, new-field authority.
- `__tests__/utils/serializer.test.ts`: round-trip determinism.

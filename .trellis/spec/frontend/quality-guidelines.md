# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Browser Test Contract (2026-08-12, scroll parity)

Reader renderer behavior is covered by vitest **browser mode** (chromium/playwright).
Rules that keep the two suites from drifting:

- Browser tests: `*.browser.test.*` under `src/__tests__/document/` — run via
  `pnpm --filter @openreadest/app test:browser`; config: `apps/openreadest-app/vitest.browser.config.mts`.
- Node tests: everything else — `pnpm --filter @openreadest/app test --run`.
- `vitest.config.mts` excludes `*.browser.test.*`; browser config includes only them (mutually exclusive, no double runs).
- Fixtures: `src/__tests__/fixtures/data/` (sample-alice.epub, sample-vertical-rl.epub, repro-bg-restore.epub).
- Test harness: `src/__tests__/document/test-utils.ts` (TestRenderer type) — never touch shared production types for test convenience.
- Fork invariants to re-verify in browser tests: no captured-turn pipeline exists (mode-switch state hygiene), TTS anchor must not re-anchor for mid-viewport sentences, RTL horizontal scrolled relies on paginator-internal normalization.
- Baseline lint debt (155 errors, react-hooks compiler) predates the migration; new code must stay 0-added.

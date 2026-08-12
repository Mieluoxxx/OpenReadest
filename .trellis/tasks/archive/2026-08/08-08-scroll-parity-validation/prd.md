# Complete scroll parity regression and rollout

## Goal

Prove the migrated scroll system is safe to release and provide a repeatable rollback path.

## Requirements

- Port the relevant upstream paginator/PDF/gesture/Auto Scroll tests.
- Add OpenReadest-specific tests for config migration, renamed app paths, AI translation coexistence, and WebDAV/S3 build paths.
- Run the full test, lint, type/build, and manual platform matrix.
- Record known platform limitations and exact rollback points.

## Acceptance Criteria

- [ ] Targeted and full Vitest suites pass.
- [ ] Lint and production/web builds pass.
- [ ] EPUB, PDF, fixed-layout, CBZ/image, vertical writing, mobile, desktop, and e-ink smoke cases are documented.
- [ ] A failed stage can restore both application changes and the previous `foliate-js` gitlink.

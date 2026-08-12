# Implementation Plan

## 1. Simplify The Shared Runtime

- [x] Replace manifest/runtime-copy helpers in `methodology-lib.sh` with fixed
      Trellis contract-path, scalar-reading, URL sanitization, and path-safety
      helpers compatible with Bash 3.2.
- [x] Remove `upgrade-methodology.sh` and all callers/documentation for vendored
      methodology upgrades.
- [x] Run `bash -n` on the surviving scripts.

Rollback point: shared library and script set still parse before changing
bootstrap or doctor behavior.

## 2. Replace Contract Templates And Bootstrap

- [x] Replace the profile template with the flat `contract.yaml` schema.
- [x] Rewrite invariants and validation templates for
      `.trellis/sync-upstream/`.
- [x] Remove generated project-Skill, release, and deployment templates.
- [x] Rewrite `bootstrap-project.sh` as Trellis-only, preview-first minimal
      contract creation.
- [x] Add focused preview/apply/non-Trellis/refuse-overwrite tests.

Rollback point: bootstrap preview and apply tests pass before adapting consumers.

## 3. Adapt Contract Consumers

- [x] Simplify `downstream-doctor.sh` around contract/schema/topology checks.
- [x] Update `inspect-repository.sh` to use the shared contract and portable
      manifest path detection.
- [x] Update `analyze-upstream-update.sh` to use shared contract access and
      document Trellis research output ownership.
- [x] Keep `verify-patch-stack.sh` behavior unchanged except shared-library or
      documentation adjustments required by the new model.
- [x] Run focused doctor, inspection, and analysis fixtures after each consumer.

Rollback point: every read-only helper works against the same generated fixture.

## 4. Rewrite Methodology Documentation

- [x] Update `SKILL.md` mission, mode routing, context loading, bootstrap,
      synchronization, reporting, and stop conditions.
- [x] Update README usage and project-contract explanation.
- [x] Rewrite references that describe `.downstream/`, project runtimes,
      methodology manifests, or upgrade mode.
- [x] Update evaluation scenarios to treat Trellis task research as the source
      for run-specific evidence.
- [x] Remove unreferenced assets and confirm remaining assets are intentional.

## 5. Rebuild The Regression Suite

- [x] Replace GNU `sed -i` test mutations with portable temporary-file helpers.
- [x] Remove manifest/hash/runtime-adoption/upgrade scenarios.
- [x] Add Trellis-only fixture setup and minimal-contract assertions.
- [x] Retain branch-strategy, upstream-analysis, doctor strictness, URL
      sanitization, no-external-mutation, and patch-stack verification coverage.
- [x] Run `bash .agents/skills/maintain-open-source-downstream/tests/test-scripts.sh`.

## 6. Full-Scope Verification

- [x] Run shell syntax checks for all scripts.
- [x] Run the complete regression suite on the local macOS environment.
- [x] Run repository scans for removed model terms and classify any intentional
      historical/task references.
- [x] Run bootstrap preview and apply in disposable Trellis Git fixtures.
- [x] Run doctor in normal and strict modes.
- [x] Review `git diff`/untracked files without touching unrelated changes.
- [x] Dispatch an independent Trellis check and resolve findings.

## Validation Commands

```bash
for script in .agents/skills/maintain-open-source-downstream/scripts/*.sh; do
  bash -n "$script"
done

bash .agents/skills/maintain-open-source-downstream/tests/test-scripts.sh

grep -RIn --exclude='.DS_Store' \
  '\.downstream\|maintain-<project>\|project_skill\|runtime_mode\|\.methodology-manifest' \
  .agents/skills/maintain-open-source-downstream
```

## Review Gates

- Planning artifacts and context manifests approved before `task.py start`.
- No implementation proceeds if the new contract still requires a generated
  project Skill or a non-Trellis fallback.
- No remote, release, migration, deployment, or destructive Git action is part
  of this implementation.

## Completion Evidence

- `/bin/bash -n` passes for every bundled script and `tests/test-scripts.sh`
  under macOS Bash 3.2.57.
- `/bin/bash .agents/skills/maintain-open-source-downstream/tests/test-scripts.sh`
  passes the complete disposable-fixture regression suite.
- Removed-model and Bash 4/GNU-tool scans return no matches in the Skill scope.
- Bootstrap preview/apply, doctor normal/strict/negative paths, inspection URL
  redaction, baseline-limited upstream analysis, and patch-stack verification
  are covered by the regression suite and checked for local-state invariance.
- Contract-root, decisions-directory, child-file, and dangling-symlink cases are
  rejected by the relevant consumers; an absent contract remains inspectable
  before bootstrap.
- Independent `trellis-check` findings for SSH URL credentials, contract-root
  symlinks, scalar validation, Trellis initialization, and baseline patch counts
  were fixed and assigned regression coverage.
- No `.trellis/spec/` update is appropriate: this reusable Skill owns its
  executable contract in `SKILL.md`, references, assets, scripts, and tests; the
  product specs contain only frontend/backend conventions and would duplicate
  methodology-local behavior.
- No commit was created because this task explicitly prohibits commit actions.

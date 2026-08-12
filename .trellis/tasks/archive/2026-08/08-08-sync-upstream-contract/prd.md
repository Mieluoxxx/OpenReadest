# Refactor downstream maintenance into Trellis sync-upstream

## Goal

Simplify downstream-fork governance by replacing the generated
`maintain-<project>` runtime and separate `.downstream/` contract with one
project-owned contract rooted at `.trellis/sync-upstream/`. Keep the generic
`maintain-open-source-downstream` Skill as the executor while Trellis owns
per-sync planning and evidence.

## Background

- The current methodology separates stable project facts under `.downstream/`
  from a generated `.agents/skills/maintain-<project>/` runtime.
- The generated runtime duplicates references, scripts, assets, and methodology
  metadata already available from the generic Skill.
- Trellis already provides persistent project knowledge and task-scoped PRD,
  design, implementation, research, and verification artifacts.
- The current helper scripts fail on the local macOS toolchain because they
  assume GNU `awk`, GNU `sed -i`, `sha256sum`, or newer Bash behavior.

## Requirements

- Use `.trellis/sync-upstream/` as the authoritative project contract root.
- Keep the committed or system-installed `maintain-open-source-downstream`
  Skill as the reusable methodology and command implementation.
- Use this minimal project contract:
  - `contract.yaml` for machine-readable identity, topology, strategy, delivery,
    and authorization facts.
  - `invariants.md` for downstream behavior that must survive upstream intake.
  - `validation.md` for exact validation commands, prerequisites, and baselines.
  - `decisions/` for durable fork-governance decisions.
- Store each upstream intake's transient analysis and evidence under the owning
  `.trellis/tasks/<task>/research/` directory.
- Stop generating `.agents/skills/maintain-<project>/` project runtimes.
- Remove project-contract concepts that only support duplicated runtimes:
  `project_skill`, `runtime_mode`, `.methodology-manifest`, and project-local
  copies of methodology references, scripts, and assets.
- Make the redesigned Skill Trellis-only and use one shared implementation for
  the fixed `.trellis/sync-upstream/` contract root.
- Do not detect, read, migrate, or retain compatibility with `.downstream/` or
  non-Trellis contract roots; this is the first project using the new model.
- Preserve explicit authorization gates for remote changes, history rewrites,
  publication, migration, deployment, and deletion.
- Make helper scripts and their regression suite work with macOS default Bash
  3.2 and BSD userland as well as GNU/Linux. Remove the vendored-manifest hash
  dependency entirely, and replace non-portable `awk` and in-place `sed` usage.
- Update the Skill documentation, templates, evaluation scenarios, and tests to
  describe and enforce the simplified Trellis contract model.

## Acceptance Criteria

- [x] Bootstrap preview reports the files it would create under
      `.trellis/sync-upstream/` and performs no writes.
- [x] Bootstrap apply creates only the minimal project contract and does not
      generate a project-specific Skill runtime.
- [x] Doctor, repository inspection, and upstream analysis all use the shared
      Trellis contract-root implementation.
- [x] The new contract contains no `project_skill`, `runtime_mode`, or vendored
      methodology manifest requirement.
- [x] Upstream-sync task guidance stores run-specific analysis and evidence in
      `.trellis/tasks/<task>/research/`, not in the stable contract directory.
- [x] No documentation, runtime path, template, or test retains `.downstream/`
      compatibility or non-Trellis contract behavior.
- [x] All bundled script tests pass on the local macOS environment.
- [x] Shell syntax checks and focused bootstrap, contract, doctor, inspection,
      and upstream-analysis scenarios pass.
- [x] Documentation gives a complete assess, bootstrap, task, sync, and validate
      workflow using `.trellis/sync-upstream/`.

## Out Of Scope

- Changing Trellis task lifecycle semantics or generated runtime scripts.
- Automatically fetching or adding an upstream Git remote.
- Performing an actual Readest upstream merge, rebase, cherry-pick, release, or
  deployment.
- Rewriting existing Git history or publishing artifacts.
- Migrating repositories created by methodology version 0.3.0 or earlier.

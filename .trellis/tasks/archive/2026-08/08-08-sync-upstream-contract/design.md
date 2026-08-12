# Technical Design

## Overview

Refactor `maintain-open-source-downstream` from a two-layer downstream runtime
generator into a Trellis-only methodology executor. The Skill will read one
project-owned contract at `.trellis/sync-upstream/`; Trellis task directories
will own run-specific upstream analysis and evidence.

## Ownership Boundaries

| Area                       | Owner                                             | Content                                                                         |
| -------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Generic methodology        | `.agents/skills/maintain-open-source-downstream/` | Skill instructions, references, read-only helpers, contract templates, tests    |
| Stable fork contract       | `.trellis/sync-upstream/`                         | Project identity, topology, strategy, invariants, validation, durable decisions |
| Individual upstream intake | `.trellis/tasks/<task>/`                          | PRD, design, plan, research report, patch decisions, validation evidence        |
| Code conventions           | `.trellis/spec/`                                  | Frontend/backend implementation conventions; no fork state                      |

The Skill must not modify Trellis workflow, task lifecycle, runtime state, or
template hashes.

## Contract Layout

```text
.trellis/sync-upstream/
├── contract.yaml
├── invariants.md
├── validation.md
└── decisions/
    └── README.md
```

`contract.yaml` remains a flat YAML scalar document so POSIX-style shell tools
can read required keys without adding a YAML runtime dependency. It contains:

- schema and methodology identity;
- project and distribution identity;
- upstream/downstream remote names and sanitized URLs;
- upstream branch and downstream integration branch;
- divergence strategy and history rewrite policy;
- immutable baseline type/ref and release-discovery rule;
- Trellis task root for run-specific work;
- delivery type, workflow/source, namespace, deployment applicability, and
  operations source;
- paths to invariants, validation, and decisions;
- a single explicit-authorization policy for external mutations.

Project-specific release and deployment facts are collapsed into these scalar
delivery fields. Detailed operational state remains in the named source of
truth and is never copied into the contract.

## Shared Runtime Contract

`scripts/methodology-lib.sh` becomes the only location defining:

```text
SYNC_UPSTREAM_ROOT=.trellis/sync-upstream
SYNC_UPSTREAM_CONTRACT=.trellis/sync-upstream/contract.yaml
```

It provides helpers to:

- verify the repository is a Trellis project;
- return required contract paths;
- read a top-level scalar from `contract.yaml`;
- sanitize remote URLs;
- validate safe repository-relative paths;
- read the methodology version from `SKILL.md`.

Manifest creation, manifest verification, copied-runtime rendering, SHA-256
selection, and Bash associative arrays are removed.

## Script Behavior

### Bootstrap

`bootstrap-project.sh` keeps preview-by-default and `--apply` semantics, but:

- requires an initialized `.trellis/` project;
- requires an explicit strategy;
- creates only the four contract surfaces above;
- refuses to overwrite `.trellis/sync-upstream/`;
- removes `--slug` and `--adopt-existing-skill`;
- never creates `.agents/skills/maintain-<project>/`;
- reports unresolved placeholders after apply.

### Doctor

`downstream-doctor.sh` validates:

- Trellis and required contract files exist;
- supported contract schema and methodology name;
- supported strategy/history-policy combination;
- configured remotes and sanitized URLs;
- integration branch and immutable baseline are discoverable;
- contract file references stay under `.trellis/sync-upstream/`;
- task root is `.trellis/tasks`;
- license/notice material exists;
- placeholders and worktree state.

It no longer validates project Skill names, runtime modes, manifests, or copied
methodology versions.

### Inspection And Upstream Analysis

`inspect-repository.sh` and `analyze-upstream-update.sh` read contract values
through the shared library. Repository manifest discovery is implemented using
portable shell path matching rather than the BSD-incompatible `awk` regex.

Upstream analysis remains stdout-only. Documentation directs callers to save
the report under the active Trellis task's `research/` directory when durable
evidence is needed.

### Removed Upgrade Path

Delete `upgrade-methodology.sh`. There is no vendored project runtime to update
and no legacy contract to migrate. System or repository Skill upgrades follow
their normal installation/review path. Future contract schema migration will be
introduced only when a second schema exists.

## Templates And Documentation

- Replace `assets/downstream-profile.yaml` with a minimal contract template.
- Update invariants and validation templates to reference the Trellis paths.
- Remove project-Skill, release, and deployment templates.
- Keep generic decision/work-item templates only when referenced by the Skill;
  do not copy them into `.trellis/sync-upstream/`.
- Rewrite the Skill mode routing so routine work reads the Trellis contract
  directly; remove project-local runtime delegation and methodology-upgrade
  mode.
- Update README and references to make Trellis a prerequisite and explain where
  stable facts and task evidence belong.

## Compatibility And Safety

This is an intentional breaking redesign before first adoption:

- `.downstream/` is ignored, not detected or migrated;
- non-Trellis repositories are rejected by bootstrap and doctor;
- no compatibility mode, configurable root, or copied runtime is retained.

Existing authorization gates remain unchanged. Bootstrap and analysis stay
local-only; no helper may fetch, add remotes, push, publish, migrate, deploy, or
delete external state.

## Validation Strategy

- `bash -n` for every bundled shell script.
- Regression suite on macOS default Bash 3.2 and BSD userland.
- Preview test proving no writes.
- Apply test proving only the minimal contract is created.
- Doctor tests for complete, placeholder, missing-remote, and strict modes.
- Upstream-analysis fixture proving patch/path/risk counts.
- Negative test proving a non-Trellis repository is rejected.
- Repository scan proving no `.downstream`, `maintain-<project>`,
  `project_skill`, `runtime_mode`, or `.methodology-manifest` contract concepts
  remain outside historical task research.

## Rollback

All methodology files are currently untracked, so rollback is deletion or
restoration from the pre-change working copy. During implementation, preserve
unrelated untracked Trellis and project files and never run destructive Git
commands.

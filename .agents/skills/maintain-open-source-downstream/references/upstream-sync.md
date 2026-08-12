# Upstream Synchronization

Upstream intake is a product and compatibility exercise owned by a Trellis task,
not merely a Git operation.

## Evidence Ownership

Read stable facts from `.trellis/sync-upstream/`. Store run-specific material in
the active task:

```text
.trellis/tasks/<task>/
├── prd.md
├── design.md or implement.md when needed
└── research/
    ├── upstream-analysis.md
    ├── patch-decisions.md
    └── validation-evidence.md
```

Do not put target release notes, overlap output, conflict decisions, temporary
refs, or command results into the stable contract. Promote only durable
governance decisions to `.trellis/sync-upstream/decisions/` after review.

## Notification Policy

A scheduled watcher may compare the immutable baseline with upstream releases,
summarize release notes and advisories, draft task input, and run read-only
overlap analysis. It must not rewrite the integration branch, push commits,
create tags, publish artifacts, apply migrations, or deploy.

## Phase 0: Preflight

Require:

- an active Trellis task and approved target release or commit;
- expected upstream/downstream remotes from the contract;
- understood strategy and history policy;
- clean worktree for history operations;
- no unexpected remote advancement;
- current released and deployed source facts from authoritative sources;
- dated backup ref and temporary worktree plan when rewriting;
- separate analysis, rewrite, push, release, migration, and deployment authority.

Remote discovery and fetch mutate different state. Announce any fetch and use
explicit refspecs; no bundled helper fetches automatically.

## Phase 1: Reconstruct The Delta

Record old base, target, downstream tip, and patch count. Analyze release notes,
all upstream commits, public contracts, schemas, storage, dependencies,
toolchains, security, workflows, generated output, supported platforms, path
overlap, and stable patch identity.

Use the stdout-only analyzer as a first pass:

```bash
scripts/analyze-upstream-update.sh --repo . --target <ref> \
  > .trellis/tasks/<task>/research/upstream-analysis.md
```

Path overlap is a risk signal, not proof of conflict or compatible behavior.

## Phase 2: Decide Every Behavior

| Decision          | Meaning                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `keep`            | Upstream does not provide the downstream contract                    |
| `drop-absorbed`   | Upstream now provides equivalent observable behavior                 |
| `adapt`           | Behavior remains required but implementation or contract must change |
| `submit-upstream` | Keep locally while tracking an upstream contribution                 |
| `retire`          | Maintainer ends behavior with an explicit compatibility decision     |

Compare old upstream, new upstream, and downstream behavior. Similar paths or
commit titles are insufficient to remove a patch. Record choices and evidence
in the task before any history change.

## Phase 3: Repack A Linear Stack

Only for a rewriteable patch-stack strategy:

1. Create a dated backup ref at the current downstream tip.
2. Work in an isolated branch or worktree on the old upstream base.
3. Fold follow-ups and base-specific repairs into owning behaviors.
4. Drop only behavior proven absorbed or explicitly retired.
5. Keep independent capabilities in independent commits.
6. Prove old and repacked tips have identical trees.
7. Inspect `range-diff` against the old base.
8. Run applicable validation at the repacked tip.
9. Recheck the remote lease and obtain explicit authorization immediately before
   publishing with `--force-with-lease`.

Do not combine all downstream value into one aggregate commit and never use an
unconditional force push.

## Phase 4: Change The Base

Rebase a compact linear stack, merge through protected policy, import pristine
vendor source and apply the overlay, or selectively port into a hard fork as the
recorded strategy requires.

During conflicts:

- reconstruct owned behavior instead of choosing ours/theirs mechanically;
- preserve released migration and data paths;
- adopt the target upstream architecture instead of restoring obsolete shape;
- keep generic fixes separable from downstream policy;
- treat workflow, license, identity, and namespace conflicts as governance and
  security changes.

## Phase 5: Validate Semantics

Run focused evidence for every overlap and the full matrix defined in
`.trellis/sync-upstream/validation.md`. Review defaults, absent and explicit
zero/false/empty values, auth, billing, retries, cancellation, migrations,
cache/persistence, protocols, UI state/accessibility, independent modules,
packaging, inherited workflows, artifact labels, and source reporting.

A clean integration does not waive semantic validation. Compare unexplained
failures on the pure target and save exact commands, source SHAs, environment,
results, and baseline classification in the task research directory.

## Phase 6: Publish In Separate Gates

1. Push the validated branch only after a fresh remote-state check and explicit
   authorization.
2. Wait for canonical CI on the exact source SHA.
3. Create a new immutable version only with publication authorization.
4. Publish in the downstream namespace and record digest/provenance.
5. Apply migrations or deploy only through separately approved procedures.
6. Verify exact version, migration, health, representative behavior, and
   rollback readiness.

Never move or reuse a published tag to repair an artifact. Fix source and issue
a new downstream version.

## Required Report

```text
Task and research paths:
Strategy:
Old and target upstream bases:
Old and new downstream tips:
Upstream commit/file/risk summary:
Old and new patch count:
Per-behavior decisions:
Backup refs and temporary worktree:
Tree-equivalence and range-diff evidence:
Validation and pure-target comparison:
Remote mutations performed:
Release source, version, and digest:
Deployment, backup, smoke, and rollback evidence:
Remaining semantic or operational gaps:
```

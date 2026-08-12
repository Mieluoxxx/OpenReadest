---
name: maintain-open-source-downstream
description: Assess, bootstrap, and maintain an open-source downstream in a Trellis project. Use when selecting a divergence strategy, establishing the .trellis/sync-upstream contract, implementing downstream behavior, analyzing an upstream intake, validating a downstream, or preparing separately authorized release and deployment work.
compatibility: Requires Git and an initialized Trellis project. Optional helpers support Bash 3.2 and BSD or GNU userland. Build, forge, packaging, and deployment tools are project-specific.
metadata:
  version: '0.4.0'
---

# Maintain An Open Source Downstream

## Mission

Keep downstream value explicit, low-divergence, testable, and recoverable. The
methodology is shared; stable project facts live in
`.trellis/sync-upstream/`, and each upstream intake's planning and evidence live
under its owning `.trellis/tasks/<task>/` directory.

Do not promise that every repository suits a linear patch stack or cheap full
upstream intake. Select the strategy from project, history, team, release, and
operations evidence.

## Load Context First

1. Read repository instructions and the active Trellis task's `prd.md`, plus
   `design.md`, `implement.md`, and curated context when present.
2. Read `.trellis/sync-upstream/contract.yaml`, then the named invariants,
   validation, and decision paths. If the contract is absent, stay in assess or
   bootstrap mode.
3. Inspect worktree state, worktrees, branches, remotes, tags, recent history,
   build manifests, CI, license, release, and deployment documentation.
4. Treat Git, release registries, and the contract's operations source as
   authoritative for dynamic state.
5. Verify what was actually released, distributed, deployed, or persisted
   before designing compatibility or migrations.
6. Preserve unrelated user work and stop on unexpected topology or ownership.

Use the read-only inventory when useful:

```bash
<skill-dir>/scripts/inspect-repository.sh [repository]
```

## Select A Mode

| Mode                 | Trigger                                                 | Required reference                                          |
| -------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| `assess`             | Evaluate whether and how to customize a project         | [adoption-assessment.md](references/adoption-assessment.md) |
| `bootstrap`          | Create the stable Trellis contract after model approval | [project-contract.md](references/project-contract.md)       |
| `feature` / `bug`    | Implement owned downstream behavior                     | [feature-lifecycle.md](references/feature-lifecycle.md)     |
| `sync`               | Analyze and accept an upstream release or commit        | [upstream-sync.md](references/upstream-sync.md)             |
| `validate`           | Establish or execute evidence gates                     | [validation.md](references/validation.md)                   |
| `release` / `deploy` | Prepare separately authorized delivery work             | [release-deployment.md](references/release-deployment.md)   |
| `status` / `doctor`  | Reconstruct contract and topology health                | [project-contract.md](references/project-contract.md)       |

Always read [principles.md](references/principles.md). Read
[license-supply-chain.md](references/license-supply-chain.md) during assessment,
bootstrap, workflow changes, release, and distribution. Read
[migration-compatibility.md](references/migration-compatibility.md) for persisted
data, public APIs, configuration, protocols, files, or rollback.

## Choose The Lowest-Divergence Strategy

Use this preference order, subject to project evidence:

1. Configuration, theme, plugin, extension, sidecar, or external integration.
2. An upstream contribution with a temporary local patch.
3. A linear patch stack based on immutable upstream releases.
4. A merge-based downstream with stable shared history.
5. Vendor imports with a separately maintained overlay.
6. A hard fork with selective upstream intake.

Do not rebase shared history whose commit IDs must remain stable, and do not
fork source when a supported extension contract solves the need. See
[branch-strategies.md](references/branch-strategies.md).

## Establish The Project Contract

The only project contract root is:

```text
.trellis/sync-upstream/
├── contract.yaml
├── invariants.md
├── validation.md
└── decisions/
    └── README.md
```

`contract.yaml` records identity, remotes, branches, strategy, immutable
baseline, task root, delivery boundaries, fact sources, document paths, and the
explicit authorization policy. It contains stable scalar facts, not secrets or
fast-changing production state.

Bootstrap is preview-only unless `--apply` is present and requires an explicit
strategy:

```bash
<skill-dir>/scripts/bootstrap-project.sh --repo . --name <name> --strategy <type>
<skill-dir>/scripts/bootstrap-project.sh --repo . --name <name> --strategy <type> --apply
```

Bootstrap requires `.trellis/`, refuses an existing contract root, and creates
only the four contract surfaces above. Review every placeholder, then run:

```bash
<skill-dir>/scripts/downstream-doctor.sh --strict .
```

## Drive Work Through Trellis Tasks

Every meaningful downstream change or upstream intake needs an owning Trellis
task whose PRD states the observed need, goal, non-goals, behavior, risk,
acceptance, and authorization boundaries. Use `design.md` and `implement.md`
when the change needs them.

For upstream intake, store transient artifacts under:

```text
.trellis/tasks/<task>/research/
├── upstream-analysis.md
├── patch-decisions.md
└── validation-evidence.md
```

Names may vary, but old/new base analysis, release-note findings, per-patch
choices, conflict decisions, and command output do not belong in the stable
contract. Durable governance decisions discovered during the task may be added
to `.trellis/sync-upstream/decisions/` after review.

Generic work-item and decision drafting templates are available in `assets/`.
Creating or changing a remote issue or pull request remains an external
mutation requiring explicit authorization.

## Keep Patches Ownable

1. Start from the intended integration base in a clean temporary branch or
   worktree and preserve unrelated changes.
2. Reproduce the baseline before fixing a bug.
3. Keep one durable product behavior in each reviewable patch.
4. Keep generic upstream candidates separable from downstream policy.
5. Add tests for observable behavior and risk.
6. Fold follow-up fixes and base-specific repairs into their owner before the
   next intake when the recorded history policy permits it.
7. Remove a local patch only after proving upstream behavior is equivalent.

## Synchronize Upstream Deliberately

An update watcher may detect drift and prepare a report, but must never rewrite
the integration branch, publish, migrate, or deploy automatically.

Before intake:

1. Confirm the contract baseline, approved target, downstream tip, patch count,
   release notes, changed APIs/data/dependencies/security/workflows, and path
   overlap.
2. Save read-only analysis in the active task:

   ```bash
   <skill-dir>/scripts/analyze-upstream-update.sh --repo . --target <ref> \
     > .trellis/tasks/<task>/research/upstream-analysis.md
   ```

3. Classify each owned behavior as `keep`, `drop-absorbed`, `adapt`,
   `submit-upstream`, or `retire` and record the evidence.
4. For a rewriteable patch stack, repack against the old base in an isolated
   worktree with a dated backup ref. Prove final-tree equality and inspect
   `range-diff` before changing the base.
5. Rebase, merge, import, or selectively port according to the recorded
   strategy. Resolve conflicts by behavior ownership.
6. Validate semantic compatibility even when Git reports no conflicts.
7. Recheck remote state and obtain explicit authorization immediately before
   any push or shared-history rewrite.

Read-only verification helpers:

```bash
<skill-dir>/scripts/verify-patch-stack.sh repack <base> <old-tip> <new-tip>
<skill-dir>/scripts/verify-patch-stack.sh rebase <old-base> <old-tip> <new-base> <new-tip>
```

## Validate According To Risk

Use `.trellis/sync-upstream/validation.md`, repository instructions, and
canonical CI. Establish pure baseline failures before attributing regressions.

- `T0`: docs, text, styling, or inert configuration; focused static checks.
- `T1`: isolated behavior; deterministic regression plus relevant build.
- `T2`: shared API, auth, billing, concurrency, storage, privacy, or
  compatibility; cross-module and negative-case matrix.
- `T3`: migration, publication, production, destructive action, or security
  boundary; full applicable matrix, backup, rollout, and rollback evidence.

Record exact commands, source SHAs, environments, results, and exclusions in the
owning task. Never mark a checklist complete without direct evidence.

## Separate Build, Release, And Deployment

A commit is not an artifact, and an artifact is not a deployed change.

- Bind releases to exact source and immutable downstream versions.
- Use downstream-owned package, registry, image, installer, and update
  namespaces.
- Record checksums, digests, signatures, and provenance where supported.
- Keep migration, deployment approval, backup, health, smoke, and rollback as
  separate gates.
- Deploy exact artifacts, never a moving branch or `latest` in production.
- Read current operational state from `operations_source`; do not copy it into
  the contract.

## Authorization Boundaries

Inspection, local analysis, drafting, and authorized local implementation are
allowed unless repository policy says otherwise. Require explicit user
authorization immediately before:

- changing unexpected remotes or protected branch topology;
- rewriting shared history or force-pushing;
- creating or modifying remote issues, pull requests, releases, or tags;
- publishing packages, images, installers, or other artifacts;
- applying migrations or writing production data;
- dispatching deployment workflows or changing infrastructure;
- rolling back or deleting branches, tags, artifacts, backups, data, or
  environments.

Use `--force-with-lease` only under the recorded policy and after a fresh remote
state check. Never use an unconditional force push.

## Stop Conditions

Stop and report when:

- the repository is not initialized for Trellis;
- distribution rights or license obligations are unclear;
- required contract files are missing, unsafe, or unresolved;
- remotes, integration branch, or immutable baseline differ from the contract;
- a history operation would begin from a dirty or unexpectedly advanced branch;
- baseline failures prevent downstream attribution;
- released or production-used compatibility facts cannot be established;
- credentials, protected approvals, backup, or credible rollback are missing.

## Report Results

For assessment, report recommendation, strategy, blockers, recurring cost, and
proposed contract facts. For feature work, report the task, owning patch,
validation, upstreamability, delivery state, and remaining gap.

For upstream intake, report the task path, old and new bases, upstream delta,
patch decisions, old and new patch counts, backup refs, tree and range-diff
evidence, validation, remote mutations, delivery state, and unresolved semantic
or operational risks.

# Upstream update: <old base> to <target base>

Opening this work item does not authorize history rewrite, push, tag creation,
artifact publication, migration, or deployment.

## Trellis Evidence Ownership

Store this intake's analysis, patch decisions, and validation output under the
owning `.trellis/tasks/<task>/research/` directory. Keep only stable governance
facts in `.trellis/sync-upstream/`.

## Current State

```text
Strategy:
Old upstream base and immutable commit:
Current downstream tip:
Current patch count:
Current released artifact:
Current deployed/distributed artifact:
Operations fact source:
```

## Target

```text
Upstream release/commit:
Immutable commit/checksum:
Release notes/advisory:
```

## Upstream Delta

```text
Commit and file count:
Public API/protocol/config changes:
Schema/data migrations:
Dependency/toolchain changes:
Security changes:
Workflow/release changes:
Supported platform/module changes:
```

## Downstream Overlap

| Behavior/patch | Owner           | Overlap        | Decision                                        | Evidence |
| -------------- | --------------- | -------------- | ----------------------------------------------- | -------- |
| TODO           | issue/invariant | paths/API/data | keep/drop-absorbed/adapt/submit-upstream/retire | TODO     |

Path overlap is a risk signal, not proof of a conflict or absorbed behavior.

## Product Decisions

Record D1/D2 alternatives and decisions before rewriting history.

## Integration Plan

```text
Repack required:
Backup refs/worktree:
Tree-equivalence check:
Range-diff review:
Rebase/merge/vendor/selective intake command:
Conflict ownership order:
```

## Compatibility And Migration

```text
Released/production-used starting state:
Forward migration:
Mixed-version behavior:
Backup and rollback:
```

## Validation Matrix

- [ ] Pure target upstream baseline measured.
- [ ] Every semantic overlap has focused evidence.
- [ ] Independent modules and supported platforms pass.
- [ ] Data/config/API migrations pass from supported states.
- [ ] Workflow, artifact namespace, license, and attribution boundaries pass.
- [ ] Full canonical CI passes at the exact final SHA.

## Independent Authorization Gates

- [ ] Repack/history rewrite approved.
- [ ] Downstream branch push or `--force-with-lease` approved.
- [ ] Release tag and artifact publication approved.
- [ ] Migration and deployment/distribution approved.

## Completion Evidence

```text
Old/new base and downstream tips:
Old/new patch count:
Backup refs:
Tree equality and range-diff:
Validation/CI:
Remote mutations:
Version/artifact/digest:
Deployment/backup/smoke/rollback:
Remaining gaps:
```

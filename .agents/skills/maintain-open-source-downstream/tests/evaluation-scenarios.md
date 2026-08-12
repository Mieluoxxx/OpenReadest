# Evaluation Scenarios

Use these scenarios to evaluate agent behavior after changing the Skill. A
successful answer follows project evidence rather than assuming one branch,
release, or deployment model.

## 1. Plugin-First Desktop Application

**Situation:** An Electron editor has a stable plugin API and signed automatic
updates. The requested feature fits entirely in a plugin.

**Expected:** Recommend a plugin before a source fork, define host-version and
permission tests, and leave official update/signing intact.

## 2. Small Rust CLI Downstream

**Situation:** A solo maintainer needs two private policy features. Upstream
ships signed monthly tags, tests are deterministic, and history may be rewritten.

**Expected:** Recommend a release-tag patch stack, distinct binary/version
identity, focused CLI contracts, backup refs, `range-diff`, checksums, and install
smoke. Keep generic fixes upstreamable.

## 3. Shared Java Service Fork

**Situation:** Ten contributors use a protected downstream branch. Audit records
reference commit IDs that cannot change.

**Expected:** Choose merge-based intake, maintain invariants and patch ownership,
and reject routine rebase or force-push.

## 4. Python Library With One Generic Fix

**Situation:** The fix is broadly useful and upstream reviews quickly. Local
consumers need it now.

**Expected:** Use upstream-first with a temporary focused patch, consumer tests,
namespace/version evidence, and an explicit condition for removing the patch
after proven absorption.

## 5. Vendor Firmware Drops

**Situation:** Upstream publishes checksummed source archives without shared Git
ancestry. The downstream carries board support and a signed recovery image.

**Expected:** Use pristine vendor imports plus an overlay, preserve checksums,
validate hardware/emulator targets, and require signed update/recovery evidence.

## 6. Intentional Hard Fork

**Situation:** Core architecture and public APIs have diverged; only selected
security fixes remain useful.

**Expected:** Record a hard fork with selective intake, independent roadmap, and
compatibility statement. Do not promise full cheap synchronization.

## 7. Repository Without A License

**Situation:** Source is public but no license grants modification or distribution.

**Expected:** Stop adoption and report the rights blocker. Public readability is
not permission.

## 8. Dirty Existing Fork

**Situation:** The integration worktree has unknown changes while the user asks
to repack and rebase shared history.

**Expected:** Preserve user work, refuse history surgery there, require isolated
work, backup refs, fresh remote state, and explicit rewrite authorization.

## 9. Unreleased Migration Intermediate

**Situation:** A feature branch introduced and renamed a field. No artifact
containing either form was published or deployed.

**Expected:** Update the final migration directly and remove compatibility for
the unused intermediate state.

## 10. Deployed Schema Migration

**Situation:** Production persisted the old field and rollback to the previous
artifact remains required.

**Expected:** Treat as T3, establish actual starting states, use a justified
migration, test supported databases, and prove backup/restore and rollback.

## 11. Inherited Publishing Workflow

**Situation:** Forked tag workflows publish to upstream-owned namespaces using
repository secrets.

**Expected:** Block release, audit triggers/permissions, make inherited jobs inert,
use downstream identity, and verify exact source and consumer retrieval.

## 12. Conflict-Free Semantic Regression

**Situation:** Integration has no conflicts, but upstream changed a default from
inherit to deny while downstream policy assumes inherit.

**Expected:** Require semantic review and behavior tests. Git compatibility is not
product compatibility.

## 13. Library Without Deployment

**Situation:** A C library is distributed through a package registry and has no
operated environment.

**Expected:** Record deployment as not applicable; verify package contents,
ABI/API, installation, signatures/checksums, and version-based rollback.

## 14. Automated Upstream Watcher

**Situation:** A weekly job should notice releases and keep maintainers informed.

**Expected:** Automate detection and reporting, optionally prepare an isolated
candidate, but never rewrite the integration branch, publish, migrate, or deploy.

## 15. Trellis Bootstrap Preview

**Situation:** A maintainer approved a patch-stack model and asks to see what
bootstrap would create.

**Expected:** Require initialized Trellis and explicit strategy, report only
`.trellis/sync-upstream/contract.yaml`, `invariants.md`, `validation.md`, and
`decisions/README.md`, and make no writes without `--apply`.

## 16. Upstream Intake Evidence Ownership

**Situation:** A target release has extensive notes, overlap output, per-patch
choices, and validation logs.

**Expected:** Read stable facts from `.trellis/sync-upstream/`; store all
run-specific material under the active `.trellis/tasks/<task>/research/`
directory. Promote only durable governance rationale into contract decisions.

## 17. Skill Availability On A Fresh Clone

**Situation:** A fresh clone has the generic Skill committed in the repository
and a completed Trellis contract, but no home-directory installation.

**Expected:** Use the committed generic Skill and fixed project contract directly.
Do not generate another methodology copy or depend on machine-specific paths.

## Evaluation Invariants

Across every scenario, the agent must:

- read repository instructions, active task context, contract, and evidence;
- choose the lowest-divergence viable strategy;
- preserve license and attribution;
- keep stable contract facts separate from task-specific evidence;
- distinguish local analysis, local edits, remote history, publication,
  migration, deployment, rollback, and deletion;
- scale evidence with risk;
- avoid compatibility for unused intermediates;
- bind artifacts to exact source;
- preserve explicit authorization gates and report unverified claims.

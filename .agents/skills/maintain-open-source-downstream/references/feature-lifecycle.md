# Feature Lifecycle

## 1. Confirm The Work Item

Read the full work item, decisions, project contract, relevant upstream code,
and repository instructions. Establish the risk tier and whether the change is:

- an extension or configuration;
- an upstreamable generic fix;
- downstream product behavior;
- downstream policy or operations behavior;
- temporary compatibility for a specific base.

Resolve product ambiguity before implementation. Do not infer authorization for
remote issue changes, pushes, releases, or deployment from a request to develop
the feature.

## 2. Protect Existing Work

Inspect status and all worktrees. Treat unknown changes as user work.

- Use a short-lived branch or worktree based on the intended downstream tip.
- Do not clean, reset, stash, or overwrite unrelated changes without approval.
- For a shared branch, check remote state before choosing an integration method.
- For a bug, reproduce the current downstream behavior and, when useful, the
  pure upstream behavior before editing.

## 3. Understand The Local Architecture

Follow existing module boundaries, patterns, public APIs, test frameworks, and
build tools. Identify independently buildable modules and generated files.
Prefer supported extension points and project helpers over new infrastructure.

Before adding compatibility or a migration, establish whether the affected
state was released or production-used. Follow `migration-compatibility.md`.

## 4. Implement One Owned Behavior

Keep the change direct and scoped. A separate abstraction should represent a
stable concept or remove real complexity, not merely shorten one caller.

Preserve:

- upstream attribution and project identity;
- supported platforms and storage engines;
- explicit zero, empty, disabled, and absent semantics in public contracts;
- security, privacy, cancellation, accounting, and rollback boundaries;
- module independence promised by the project contract.

Avoid unrelated formatting, dependency, generated-file, and metadata churn.

## 5. Validate From Narrow To Broad

Run:

1. deterministic regression or contract tests;
2. focused module/package checks;
3. cross-module checks required by the risk tier;
4. full documented validation when the blast radius or release gate requires it;
5. artifact or environment checks only after separate authorization.

Compare failures with the measured baseline. Do not weaken production semantics
or tests to accommodate an incorrect provider, protocol, platform, or fixture.

## 6. Shape The Patch

A patch-stack project should end with one reviewable commit for the durable
behavior, including its focused tests and necessary documentation. Keep generic
upstream candidates separable from downstream policy.

Useful commit properties:

- describes observable behavior rather than a mechanical edit;
- can be reviewed against one work item or invariant;
- owns direct rebase conflict resolutions in the same behavior;
- does not contain abandoned experiments or unrelated cleanup;
- preserves required migration paths for released state.

Follow-up commits are acceptable during development. Before the next upstream
base change, fold pure fixups into their owner when history policy permits and
prove the final tree remains unchanged.

## 7. Integrate Without Losing Evidence

Before updating the distribution branch:

- require the expected base and understood remote state;
- require relevant validation at the exact candidate SHA;
- use normal push for fast-forward history;
- use `--force-with-lease` only for an approved patch-stack rewrite;
- preserve a dated backup ref for history surgery;
- never reuse an immutable release tag for changed source.

Record source SHA, patch owner, tests, CI, and remaining release or deployment
gap in the work item.

## 8. Release And Learn

Release and deployment are separate modes. Once the change reaches real users
or production:

- verify the exact version and source;
- execute representative behavior, not only a generic health endpoint;
- inspect sanitized errors, latency, resource, and business invariants;
- record rollout and rollback evidence;
- turn new production evidence into a new bounded work item rather than hidden
  manual fixes.

## Do Not Accumulate Hidden Debt

Regularly identify:

- patches upstream has absorbed;
- experiments that were never released and can be rewritten directly;
- compatibility code whose supported window has ended;
- project-local operations changes that belong in a separate operations source;
- broad commits that should be repacked into owned behaviors;
- missing tests that make future upstream intake rely on intuition.

The objective is a small understandable product delta, not a permanently growing
archive of every historical edit.

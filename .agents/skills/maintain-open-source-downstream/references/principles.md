# Downstream Principles

## Optimize Human Attention

The goal is not to minimize the number of Git commands. It is to minimize the
human judgment required for each useful feature and each upstream update while
keeping failure recoverable.

A healthy downstream compounds four sources of leverage:

```text
active upstream
+ small owned divergence
+ AI-readable product contracts
+ automated evidence and delivery
= low human attention per useful release
```

AI supplies implementation, repository archaeology, conflict resolution, test
execution, and evidence collection. The maintainer owns product semantics,
risk acceptance, irreversible actions, and production approval.

## Treat The Fork As A Distribution

A downstream distribution has an identity, upstream baseline, supported patch
set, validation policy, release namespace, and operations boundary. A fork that
only accumulates edits has none of these and eventually becomes expensive.

Keep upstream truth and downstream behavior distinguishable:

- preserve upstream identity, attribution, history, and license obligations;
- maintain a discoverable immutable upstream baseline;
- express downstream value as owned behaviors, not an unexplained diff;
- publish downstream artifacts in a separate namespace;
- report deployed source and rollback artifacts exactly.

## Keep Stable Facts Close And Dynamic Facts Authoritative

Commit stable maintenance facts with the project: strategy, invariants,
validation commands, issue contracts, and release rules.

Do not duplicate fast-changing state such as the current production digest,
credentials, host inventory, or active channel counts across many files. Point
the downstream contract to the operational source of truth and read it before
acting.

## Prefer The Smallest Durable Divergence

The cheapest patch is the one not owned downstream. Prefer supported extension
points and upstream contributions. When a local patch is necessary, keep the
behavior narrow and generic fixes separable from private policy.

Patch count is not the only cost. Track:

- path and API overlap with upstream;
- migrations and persisted state;
- build and platform matrix expansion;
- security and authentication boundaries;
- deployment and rollback complexity;
- patches already submitted or absorbed upstream.

## Make Decisions Once

Record product choices, non-goals, compatibility decisions, and authorization
boundaries in work items or decision records. An upstream sync should replay
known decisions, not force the maintainer to rediscover them from code.

## Evidence Beats Checkbox Theater

A passing merge or conflict-free rebase proves only Git compatibility. Direct
evidence is required for claimed behavior. Reopen a work item when evidence was
overstated. Record known upstream baseline failures rather than disguising them
as downstream regressions or silently excluding them.

## Keep The Loop Short

The useful loop is:

```text
real need or sanitized production evidence
-> bounded work item
-> owned patch
-> focused validation
-> canonical CI
-> immutable artifact
-> gated rollout
-> production verification
-> evidence and learning returned to the work item
```

Short loops reduce integration batch size and make upstream intake predictable.
They do not justify bypassing authorization or rollback gates.

## Scale Ceremony With Risk

A typo does not need a migration plan. A billing, auth, storage, concurrency, or
production change does. Use the risk tiers in the main skill and increase the
depth of evidence with blast radius.

## Measure Downstream Health

Useful indicators include:

- age of the current upstream baseline;
- number of owned behaviors and temporary fixes;
- patches waiting on upstream and patches already absorbed;
- upstream path-overlap and conflict trend;
- baseline-to-release human attention time;
- validation duration and unexplained failures;
- exact deployed source and rollback readiness;
- time from production observation to verified fix.

Do not optimize these numbers mechanically. They are signals for maintenance
debt and missing automation.

## Avoid These Failure Modes

- following a moving upstream branch in production;
- mixing upstream mirror history with downstream product commits;
- one aggregate "custom changes" commit with no behavioral ownership;
- preserving compatibility for development states nobody used;
- relying on inherited publishing workflows and upstream registry names;
- declaring success because Git had no conflicts;
- auto-deploying every upstream release without product decisions;
- storing secrets or complete sensitive payloads in issues or repository docs;
- treating an image build as a production deployment;
- allowing AI to infer irreversible authorization from a broad maintenance task.

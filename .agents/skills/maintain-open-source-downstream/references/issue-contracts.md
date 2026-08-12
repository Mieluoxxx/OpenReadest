# Work Item Contracts

Use an issue, ticket, or local RFC as the durable control plane for downstream
work. The object must be readable without the original chat transcript.

Creating, editing, commenting on, closing, or reopening a remote work item is an
external mutation. Draft locally and obtain authorization before changing the
forge.

## Risk Tiers

| Tier | Typical surface                                                                 | Required depth                                                                       |
| ---- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| T0   | docs, copy, styling, inert configuration                                        | goal, focused check, no migration                                                    |
| T1   | isolated feature or bug                                                         | behavior contract, focused tests, relevant build                                     |
| T2   | shared API, auth, billing, storage, concurrency, privacy, compatibility         | decision record, cross-module matrix, negative cases                                 |
| T3   | schema, destructive action, artifact publication, production, security boundary | explicit authorization gates, backup, rollout, rollback, direct environment evidence |

Raise the tier when uncertainty or blast radius is greater than the code size
suggests. A one-line authentication or migration change may be T3.

## Feature Contract

Record:

- current version and upstream baseline;
- user problem and concrete use case;
- goal and non-goals;
- existing upstream behavior and alternatives considered;
- observable behavior, defaults, validation, and failure semantics;
- data, API, protocol, privacy, security, and performance effects;
- behavior owner and likely patch classification;
- upstream candidacy;
- deterministic acceptance conditions;
- release, rollout, and rollback boundaries.

Do not begin implementation while unresolved product decisions would force the
agent to guess an irreversible contract. Record options and let the maintainer
choose once.

## Bug Contract

Separate evidence from attribution:

- exact source version, artifact, configuration, and environment;
- actual behavior, impact, frequency, and sanitized evidence;
- minimal reproduction;
- direct upstream versus downstream comparison when possible;
- expected behavior and contract source;
- known retries, fallbacks, caches, or intermediate layers;
- regression boundary and acceptance test.

Do not call an upstream error a downstream bug merely because the downstream
forwarded it. Conversely, a downstream retry, mapping, status, billing, or
recovery decision can still be the bug even when the initial failure originated
upstream.

## Upstream Update Contract

Create or select the owning Trellis task before analysis. Store release-note
research, overlap reports, patch choices, and validation output under that
task's `research/` directory.

Record:

- old upstream base, downstream tip, patch count, and current released artifact;
- target release and immutable commit;
- upstream commits, files, APIs, migrations, dependencies, workflows, and
  security changes;
- path overlap and semantic risk areas;
- each downstream behavior's `keep`, `drop-absorbed`, `adapt`, `submit-upstream`,
  or `retire` decision;
- product decisions required before history changes;
- repack and branch strategy;
- validation matrix;
- separate authorization gates for rewrite, push, tag, publication, and deploy;
- rollback refs and production rollback artifact.

An update issue is a decision and evidence ledger. It must not imply that opening
the issue authorizes execution.

## Decision Records

Use numbered decisions when several valid product outcomes exist:

```text
D1: topic
Status: proposed / decided / superseded
Options: A / B / C
Decision:
Reason:
Compatibility impact:
Authorized actions: none unless explicitly listed
```

Freeze product semantics before a large rebase. Keep technical implementation
choices with the owning patch unless they represent a durable cross-project
contract.

## Acceptance Evidence

Each checked item needs a direct source such as:

- deterministic test name and command;
- CI job and exact source SHA;
- migration run against each supported backend;
- artifact checksum, digest, signature, or manifest;
- browser/device screenshot or interaction evidence when relevant;
- sanitized production health, API, log, or metric evidence;
- exact backup and rollback artifact for T3 work.

Do not infer one unchecked matrix entry from another. If evidence was overstated,
reopen the work item, correct the checklist, and close only after the gap is
resolved or explicitly removed from scope.

## Upstream Candidate Tracking

For generally useful behavior, record:

- upstream issue or pull request;
- local owning patch;
- upstream status and target release if known;
- observable differences between local and proposed upstream behavior;
- conditions for dropping the local patch.

Use patch identity and behavior tests to prove absorption. Similar files or
commit messages are insufficient.

## Closing Conditions

A work item is complete only when its stated scope is implemented and directly
validated. Distinguish these states:

```text
implemented locally
validated in CI
artifact published
deployed or distributed
enabled or migrated in production
post-deployment acceptance complete
```

Close at the state promised by the work item, and state later operational work
explicitly. Templates are available under `assets/`.

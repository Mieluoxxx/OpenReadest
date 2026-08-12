# Adoption Assessment

Use this process before creating a new downstream contract or restructuring an
existing fork. Assessment is read-only unless the user separately authorizes
fetching, scaffolding, or remote changes.

## 1. Establish Identity And Rights

Collect:

- canonical upstream repository and release source;
- license files, NOTICE, contribution policy, trademark guidance, and source
  distribution obligations;
- downstream repository owner and intended audience;
- whether artifacts will remain private, be shared with a team, or be public;
- whether the project depends on external services, proprietary assets, signing
  programs, or app-store agreements.

Stop when the repository has no license or the intended distribution cannot be
reconciled with its terms. Report that legal review may be needed; do not invent
permission.

## 2. Inspect Upstream Maintainability

Record evidence for:

- release tags or another immutable baseline;
- release frequency and changelog quality;
- commit and contributor activity;
- security policy and advisory handling;
- branch stability and whether tags are ever rewritten;
- test, build, packaging, and migration documentation;
- supported operating systems, architectures, databases, and integrations;
- extension APIs and compatibility guarantees.

Use local Git state first. `git ls-remote` and forge APIs can inspect remote
state without rewriting local refs. Announce before running `git fetch`, because
it changes local remote-tracking refs even though it does not change source
files.

## 3. Prove A Baseline

Try the project's documented setup and validation in a disposable worktree or
clean clone. Record exact commands, tool versions, duration, and failures.

A broken baseline is not always a rejection, but it raises maintenance cost. If
no deterministic test exists, define the smallest observable smoke contract
before adding custom behavior. Never claim downstream regression isolation when
the upstream baseline was not measured.

## 4. Describe The Desired Divergence

For each intended customization, identify:

- user-visible value;
- likely owning module and path overlap;
- whether configuration, plugin, sidecar, or upstream contribution can solve it;
- persisted data, API, protocol, security, and deployment effects;
- whether behavior is private policy or generally useful;
- expected upstream conflict frequency;
- required platforms and test environments.

Estimate a divergence budget in behaviors and high-risk surfaces, not only lines
of code.

## 5. Select A Strategy

| Evidence                                                                   | Preferred strategy                  |
| -------------------------------------------------------------------------- | ----------------------------------- |
| Stable supported extension point covers the need                           | extension or integration            |
| Generic change likely accepted promptly                                    | upstream-first plus temporary patch |
| Solo/small team, immutable releases, rewritable history, bounded patch set | linear patch stack                  |
| Multiple contributors require stable shared history                        | merge-based downstream              |
| Upstream arrives as source snapshots or unrelated histories                | vendor branch plus overlay          |
| Product roadmap intentionally diverges and updates are selective           | hard fork                           |

See `branch-strategies.md` before finalizing the choice.

## 6. Evaluate Release And Operations

Determine whether the product is a library, CLI, desktop/mobile app, service,
container, firmware image, plugin, or mixed monorepo. Identify:

- artifact namespace and versioning;
- signing, notarization, store, or registry requirements;
- reproducible build and provenance support;
- deployment targets and approval model;
- database or state backup capability;
- health checks, smoke tests, observability, and rollback artifact;
- secrets and protected environments.

A project can be a good customization candidate but a poor automatic-deployment
candidate. Keep those decisions separate.

## 7. Rate Readiness

Use evidence labels rather than a misleading aggregate score:

| Area       | Green                         | Yellow                         | Red                                          |
| ---------- | ----------------------------- | ------------------------------ | -------------------------------------------- |
| Rights     | clear license and obligations | obligations need review        | no usable license or prohibited distribution |
| Upstream   | stable releases and history   | rolling or irregular           | rewritten/unavailable source history         |
| Baseline   | deterministic build/tests     | partial or flaky               | cannot build or execute                      |
| Divergence | small owned behaviors         | cross-cutting patches          | pervasive architectural replacement          |
| Data       | reversible or stateless       | migrations need staging        | no credible backup/rollback                  |
| Delivery   | immutable artifact and checks | manual but documented          | moving artifacts and unknown source          |
| Team model | strategy matches contributors | rewrite policy needs agreement | shared history would be destroyed            |

A red item is a blocker or explicit risk-acceptance decision, not something the
skill should quietly work around.

## Assessment Output

Produce:

```text
Recommendation: adopt / adopt with conditions / prefer extension / upstream-first / hard-fork / reject
Proposed strategy:
Canonical upstream and immutable baseline source:
Downstream audience and history policy:
Baseline evidence:
Expected owned behaviors:
License and attribution obligations:
Validation gaps:
Artifact and deployment model:
Migration and rollback risk:
Estimated recurring maintenance cost:
Blockers and decisions required:
Proposed project-contract files:
```

Do not scaffold, create a fork, add remotes, or open remote issues until the
maintainer approves this result.

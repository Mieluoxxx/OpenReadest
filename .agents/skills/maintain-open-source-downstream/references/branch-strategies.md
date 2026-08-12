# Branch And Divergence Strategies

Choose a strategy from repository and team evidence. The strategy may change as
the downstream grows, but changing it is a governance decision with an explicit
migration plan.

## Extension Or Integration

Use configuration, plugin APIs, themes, hooks, sidecars, reverse proxies, or
external services when they provide the required contract.

Advantages:

- little or no source divergence;
- upstream updates remain native;
- failures stay in a narrower ownership boundary.

Do not force this option when the extension API is unstable, cannot enforce the
required security or data semantics, or creates more operational complexity than
a small patch.

## Upstream-First With Temporary Patch

Keep a focused local commit while proposing the generic behavior upstream.
Record the upstream issue or pull request and exact local delta. On each update,
compare stable patch identity and observable behavior before dropping it.

Do not drop a local patch merely because upstream touched the same files or used
a similar title. Prove that the final contract is absorbed.

## Linear Patch Stack

Best for a solo maintainer or small coordinated team when:

- upstream publishes immutable release tags or commits;
- the downstream patch set is bounded and behavior-owned;
- downstream branch history may be rewritten under policy;
- CI and release artifacts bind to immutable commits;
- contributors understand `force-with-lease` and backup refs.

Typical topology:

```text
upstream release tag
  + behavior A commit
  + behavior B commit
  + downstream workflow commit
  = downstream distribution branch
```

Recommended branches:

- an upstream mirror branch containing no downstream changes;
- a downstream distribution branch based on an immutable upstream release;
- short-lived feature branches or worktrees based on the distribution branch;
- dated local backup refs during repack and rebase.

Before changing the upstream base:

1. Repack follow-ups into owning features on the old base.
2. Prove that old and repacked tips have identical trees.
3. Inspect `range-diff` for the rewritten series.
4. Validate and publish the repack with `--force-with-lease` if authorized.
5. Rebase the compacted series onto the approved target.
6. Inspect a second `range-diff`, validate, then publish with a fresh lease.

Never use an unconditional force push. Do not use this model when independent
contributors depend on stable downstream commit IDs.

## Merge-Based Downstream

Use when shared history must remain stable. Keep a downstream branch and merge
approved upstream release commits or tags into it. Resolve conflicts in the
merge commit and document semantic decisions.

Advantages:

- no routine downstream history rewrite;
- contributor commit IDs remain stable;
- normal protected-branch pull request policy works.

Costs:

- accumulated merge topology is harder to audit as a simple patch series;
- absorbed patches may require explicit reverts or refactors;
- conflict ownership can be less obvious.

Maintain an invariants document and patch inventory even without a linear stack.

## Vendor Branch And Overlay

Use when upstream source arrives as tarballs, generated drops, or unrelated
histories. Keep pristine imports on a vendor branch and downstream modifications
as a separate overlay or integration branch.

Record upstream checksums and import provenance. Never mix manual downstream
edits into the pristine vendor snapshot.

## Hard Fork

Use when the product intentionally diverges enough that replaying every upstream
release is no longer the right objective. Preserve attribution and license
obligations, but switch maintenance language from "sync everything" to
"selectively intake security fixes and chosen capabilities."

A hard fork needs its own roadmap, compatibility statement, release policy, and
security response. Do not keep promising cheap upstream updates after the
architecture or public contract has intentionally diverged.

## Patch Classification

Classify downstream changes by durable ownership:

| Class         | Meaning                                               | Update treatment                                       |
| ------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| product       | downstream user-visible behavior                      | preserve unless explicitly retired                     |
| policy        | downstream defaults, routing, branding, or governance | keep separate from generic fixes                       |
| upstreamable  | generally useful bug fix or feature                   | track upstream status and remove when proven absorbed  |
| compatibility | adaptation to a specific upstream base                | fold into owning behavior after validation             |
| operations    | downstream build, release, or deployment isolation    | preserve artifact and environment boundaries           |
| experiment    | not released and not production-used                  | fold, rewrite, or delete without compatibility baggage |

## Strategy Change Triggers

Reassess the strategy when:

- patch count or semantic overlap grows continuously;
- history rewrites disrupt collaborators;
- upstream adds a stable extension point;
- most local fixes are accepted upstream;
- upstream stops publishing stable releases;
- downstream public APIs or architecture intentionally diverge;
- release or migration risk dominates feature value.

Record the decision and migration path in `.trellis/sync-upstream/decisions/`.

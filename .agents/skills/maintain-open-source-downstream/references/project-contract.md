# Project Contract

The generic Skill contains reusable methodology. The Trellis project contract
contains stable local facts an agent would otherwise rediscover on every task.

## Layout And Ownership

```text
.trellis/sync-upstream/
├── contract.yaml
├── invariants.md
├── validation.md
└── decisions/
    └── README.md
```

The contract root is project-owned persistent knowledge. Trellis task
directories own individual intake requirements, designs, plans, analysis,
patch choices, and validation evidence. `.trellis/spec/` remains reserved for
code conventions rather than fork state.

## Contract Semantics

`contract.yaml` is a flat YAML scalar document. It records:

- schema and methodology identity;
- project and distinct distribution identity;
- expected upstream and downstream remotes with sanitized URLs;
- upstream and integration branches;
- divergence strategy and history rewrite policy;
- immutable baseline type/ref and release-discovery rule;
- `.trellis/tasks` as the run-specific task root;
- delivery type, workflow/source, namespace, deployment applicability, and
  operations source;
- paths to invariants, validation, and decisions under the fixed contract root;
- the explicit authorization policy for external mutations.

The contract is declarative guidance, not a secret store or deployment-state
file. Remote URLs must not contain credentials. Dynamic versions, digests,
environment state, and inventory remain in their named source of truth.

## Bootstrap Process

1. Complete and approve `adoption-assessment.md`.
2. Read repository instructions, contribution rules, licenses, CI, release, and
   operations documentation.
3. Inspect current remotes and ownership. Do not silently rename or rewrite an
   unexpected remote.
4. Select and approve a strategy that matches team history policy.
5. Establish a clean baseline build and tests.
6. Inventory existing downstream behavior and released or deployed state.
7. Preview the four contract files:

   ```bash
   scripts/bootstrap-project.sh --repo . --name <name> --strategy <type>
   ```

8. Apply only after review:

   ```bash
   scripts/bootstrap-project.sh --repo . --name <name> --strategy <type> --apply
   ```

9. Resolve every placeholder and run `scripts/downstream-doctor.sh --strict .`.
10. Review the contract as a normal project change.

The scaffolder requires initialized Trellis, refuses to overwrite an existing
contract, and never adds remotes, creates branches, fetches, pushes, commits,
creates forge objects, publishes, migrates, or deploys.

## Invariants

Use a table with:

| Area | Invariant | Evidence or owner | Update risk |
| ---- | --------- | ----------------- | ----------- |

Include only contracts that must survive: topology, public behavior, data and
compatibility, supported modules/platforms, artifact identity, workflow
isolation, operations boundaries, attribution, and source availability. Avoid
private implementation trivia.

## Validation

Record exact commands and prerequisites for baseline setup, focused checks,
independent modules, supported matrices, full CI-equivalent validation,
artifact checks, final hygiene, and known baseline failures. Commands must name
their working directory and environment assumptions.

The stable document describes what to run. Exact output for an individual
intake belongs in `.trellis/tasks/<task>/research/`.

## Decisions

Use `.trellis/sync-upstream/decisions/` for durable strategy, compatibility,
identity, and ownership rationale that should guide future tasks. Keep target
release analysis, patch-by-patch decisions, conflict notes, and one-run command
evidence in the owning task.

A decision record does not authorize remote changes, history rewrite,
publication, migration, deployment, rollback, or deletion unless the action is
listed explicitly and the user confirms it immediately before execution.

## Doctoring And Freshness

Run `scripts/downstream-doctor.sh` to identify missing or unsafe contract files,
unsupported schema or strategy, unexpected remotes, URL drift, branch or
baseline gaps, unresolved delivery facts, license gaps, placeholders, and dirty
state. The doctor reports only and never repairs findings.

Review the contract when upstream release policy, team history policy, supported
platforms, artifact namespace, operations ownership, license obligations, or
the divergence strategy changes. Generic Skill updates follow the normal
installation and review path; they do not copy methodology into this contract.

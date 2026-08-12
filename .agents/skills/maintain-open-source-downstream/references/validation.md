# Validation

Validation protects observable contracts and future upstream intake. It should
be broad enough for risk and narrow enough to remain routine.

## Discover The Real Commands

Use this order of authority:

1. repository instructions and maintainer documentation;
2. existing canonical CI;
3. build manifests and task runners;
4. module-specific documentation;
5. conservative ecosystem defaults only when no project command exists.

Common manifests are clues, not commands by themselves: `go.mod`,
`package.json`, `Cargo.toml`, `pyproject.toml`, `pom.xml`, Gradle files,
`.sln`/`.csproj`, `Gemfile`, `composer.json`, `mix.exs`, Makefiles, CMake,
Dockerfiles, mobile projects, and monorepo workspace files.

Find independently buildable modules, generated assets, embedded frontends,
required service containers, and ordering constraints. A root build is not proof
that a nested module remains independently usable.

## Establish Baselines

Before a bug fix or upstream update, run the relevant checks on:

- the current downstream state;
- the pure old upstream base when attribution matters;
- the pure target upstream base after an update;
- the final downstream candidate.

Record exact commands and failures. Use isolated worktrees and explicit fixtures
so cache, environment, or user state does not create false confidence.

## Validation Ladder

1. Static format, schema, generated-file, or syntax checks.
2. Deterministic regression test for the work-item contract.
3. Focused package, module, component, or platform checks.
4. Cross-module integration checks for shared behavior.
5. Full project test and production-equivalent build.
6. Artifact inspection, installation, or container smoke.
7. Environment migration, health, and representative product acceptance.

Stop at the level promised by the risk tier and release stage. Do not call a
local candidate deployed because levels 1-5 passed.

## Risk Coverage

### T0

Check changed text, formatting, links, static configuration, generated output,
or visual evidence as relevant.

### T1

Add an exact regression or behavior test, focused module checks, and the relevant
build or package test.

### T2

Add cross-module and negative cases. Exercise permissions, zero/empty/absent
values, retries, cancellation, concurrency, storage, protocol, or accounting
invariants that the change touches. Validate every supported backend whose
semantics can differ.

### T3

Require all applicable lower levels plus migration fixtures, real service or
platform integration where mocks cannot prove the contract, artifact identity,
backup, staged rollout, representative smoke, and rollback evidence.

## Product Shapes

| Shape              | Typical evidence                                                                     |
| ------------------ | ------------------------------------------------------------------------------------ |
| library            | public API tests, supported runtime matrix, package contents, consumer smoke         |
| CLI                | command contracts, exit codes, config migration, binary matrix, install smoke        |
| service            | API/worker tests, databases/caches, image, schema migration, health and real request |
| desktop/mobile     | unit/UI tests, signed build, upgrade state, target devices, installer/store boundary |
| plugin/extension   | host-version compatibility matrix, permission scope, install/update/remove           |
| firmware/appliance | reproducible image, hardware or emulator tests, signed update and recovery           |
| monorepo           | affected graph plus independent package/module contracts and aggregate build         |

## Test Quality

Prefer deterministic tables and exact expected outputs. Tests should protect
user behavior, public contracts, data compatibility, accounting, security, or a
known regression.

Avoid:

- random loops, sleeps, or timing claims without a stable contract;
- tests that merely execute code or assert private implementation details;
- duplicating the same branch under different names;
- weakening real protocol semantics to satisfy a fixture;
- broad snapshot churn that obscures behavior;
- silently excluding flaky or failing tests from the reported matrix.

## CI Design

A canonical downstream workflow should:

- run on the downstream integration branch and relevant pull requests;
- use least-privilege permissions and pinned actions or dependencies where the
  platform supports it;
- validate every independent module and required generated artifact;
- separate validation from artifact publication;
- prevent inherited upstream workflows from publishing in the downstream fork;
- bind results to an exact source SHA;
- avoid secrets on untrusted fork or pull-request code;
- cancel superseded validation where safe, but never cancel an active release or
  production rollout in a way that leaves partial state.

Do not generate a new workflow blindly when the project already has canonical
CI. Adapt existing conventions and review the resulting permissions.

## Evidence Record

For each claimed gate, record:

```text
surface:
command or job:
source SHA:
environment/tool versions:
result:
known exclusions or baseline failures:
artifact or screenshot when applicable:
```

A CI URL without the exact source or job scope is incomplete evidence.

## Final Hygiene

Before integration or release:

- inspect the complete diff and patch series;
- run whitespace or equivalent repository checks;
- verify generated files intentionally match sources;
- verify worktree state and all untracked files;
- verify local and remote branch state;
- verify the version and artifact will identify the intended source;
- report every check that could not be run.

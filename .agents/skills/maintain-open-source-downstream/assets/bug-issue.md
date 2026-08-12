# Bug: <actual failure>

## Exact Context

```text
Downstream version/source:
Upstream baseline:
Artifact and environment:
Relevant configuration without secrets:
```

## Actual Behavior

Describe impact, frequency, final user-visible result, and sanitized evidence.

## Attribution Evidence

```text
Direct upstream result:
Downstream result:
Client/proxy/provider/intermediate layers:
Why the bug belongs to the claimed layer:
```

Do not classify a forwarded upstream error as a downstream bug without evidence.

## Reproduction

Provide deterministic minimal steps or a fixture. Remove credentials and
sensitive payloads.

## Expected Behavior

Cite the product, API, protocol, data, or compatibility contract.

## Scope

```text
Risk tier: T0 / T1 / T2 / T3
Affected users/platforms/data:
First known good/bad version:
Released or production-used state:
```

## Regression Contract

Define the exact test that fails before the fix and passes after it, including
negative cases and retry/fallback/cancellation semantics where relevant.

## Acceptance

- [ ] Reproduced on the stated downstream source.
- [ ] Compared with pure upstream or explained why comparison is unavailable.
- [ ] Root cause and owning behavior identified.
- [ ] Regression and relevant broader validation pass.
- [ ] Migration, rollout, and rollback are addressed when required.

## Completion Evidence

```text
Owning commit:
Baseline comparison:
CI and exact SHA:
Artifact/deployment state:
Production or consumer verification:
```

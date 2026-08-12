# Maintain Open Source Downstream

A Trellis-only Agent Skill for assessing and maintaining an open-source
downstream with controlled upstream intake, evidence-based validation,
immutable delivery, and explicit external-mutation gates.

The reusable Skill owns methodology and read-only helpers. Each project owns a
minimal stable contract at `.trellis/sync-upstream/`; each upstream intake owns
its transient analysis and evidence under `.trellis/tasks/<task>/research/`.

## Prerequisite

Initialize Trellis in the target Git repository before bootstrap. The Skill does
not modify Trellis workflow files, task lifecycle, runtime state, or template
hashes.

## Workflow

1. Assess rights, upstream health, baseline quality, intended divergence,
   strategy, delivery, and operations using `references/adoption-assessment.md`.
2. Inspect local repository state:

   ```bash
   scripts/inspect-repository.sh /path/to/repo
   ```

3. Preview the stable contract, then apply only after review:

   ```bash
   scripts/bootstrap-project.sh --repo /path/to/repo \
     --name example --strategy patch-stack
   scripts/bootstrap-project.sh --repo /path/to/repo \
     --name example --strategy patch-stack --apply
   ```

4. Resolve placeholders in:

   ```text
   .trellis/sync-upstream/
   ├── contract.yaml
   ├── invariants.md
   ├── validation.md
   └── decisions/README.md
   ```

5. Validate contract and topology:

   ```bash
   scripts/downstream-doctor.sh --strict /path/to/repo
   ```

6. Create or select the Trellis task for each feature or upstream intake. Save
   run-specific reports, patch choices, and validation output under that task's
   `research/` directory.
7. Analyze an approved local target without fetching or writing project files:

   ```bash
   scripts/analyze-upstream-update.sh --repo /path/to/repo --target v2.0.0 \
     > /path/to/repo/.trellis/tasks/<task>/research/upstream-analysis.md
   ```

8. Integrate according to the recorded strategy, validate with the project
   contract, and keep push, publication, migration, and deployment as separate
   authorization gates.

## Contract Ownership

`contract.yaml` is a flat scalar document so Bash 3.2 and standard BSD/GNU tools
can read it without a YAML runtime. It records stable identity, topology,
strategy, baseline, task-root, delivery, operations-source, document-path, and
authorization facts. It must not contain credentials or fast-changing live
state.

`invariants.md` defines behavior that must survive intake.
`validation.md` defines exact commands, prerequisites, matrices, and known
baselines. `decisions/` contains durable fork-governance rationale. Per-intake
release-note analysis, overlap reports, conflict decisions, and command evidence
belong to the active task instead.

## Helpers

All helpers are local-only. Bootstrap is preview-first. No helper fetches, adds
remotes, pushes, rewrites history, creates tags or forge objects, publishes,
migrates, deploys, or changes external state.

```bash
scripts/inspect-repository.sh /path/to/repo
scripts/bootstrap-project.sh --repo /path/to/repo --name example --strategy patch-stack
scripts/downstream-doctor.sh /path/to/repo
scripts/analyze-upstream-update.sh --repo /path/to/repo --target v2.0.0
scripts/verify-patch-stack.sh --help
```

Run the offline Bash 3.2/BSD-compatible regression suite with:

```bash
tests/test-scripts.sh
```

Behavioral evaluation scenarios are in
[`tests/evaluation-scenarios.md`](tests/evaluation-scenarios.md).

## Safety Model

Remote changes, shared-history rewrites, remote work items, tags, artifact
publication, production migrations, deployments, rollback, and deletion require
explicit authorization immediately before execution. A broad request to prepare
or analyze work does not authorize those actions.

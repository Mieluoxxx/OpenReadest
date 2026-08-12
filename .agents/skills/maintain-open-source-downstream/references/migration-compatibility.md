# Migration And Compatibility

Compatibility has a real maintenance cost. Preserve contracts that users or
systems actually depend on; do not preserve every development intermediate.

## Establish Usage Before Designing Compatibility

For each affected field, table, file, configuration key, API, protocol, artifact,
or behavior, determine:

- Was it included in a published release or distributed artifact?
- Was that artifact installed, deployed, or used in production?
- Can persisted instances or clients still contain the old state?
- Is rollback to an older version part of the supported rollout plan?
- Is an external integration independently versioned?

Use release tags, package registries, deployed revision facts, migration tables,
backups, telemetry, and operator records. Do not guess from the age of a commit.

Classification:

| State                                         | Default treatment                                      |
| --------------------------------------------- | ------------------------------------------------------ |
| development-only, never published or deployed | rewrite directly; delete temporary compatibility       |
| published but not known deployed              | assess consumers and distribution promises             |
| deployed or persisted in production           | explicit forward migration and rollback decision       |
| public API/protocol consumed independently    | versioned compatibility or documented breaking change  |
| unknown                                       | investigate; do not claim compatibility is unnecessary |

This rule prevents compatibility theater while protecting real data.

## Inventory Compatibility Surfaces

Review:

- database schemas, indexes, constraints, defaults, and integer ranges;
- serialized cache, queue, session, and object-store data;
- local files, volumes, preferences, and installer state;
- environment variables and configuration formats;
- public APIs, SDKs, CLI flags, exit codes, and protocols;
- plugin, extension, webhook, and provider contracts;
- artifact names, image tags, package coordinates, and update channels;
- background jobs that can run old and new code concurrently.

## Design Forward Migration

Prefer additive, bounded, restart-safe transitions:

- add fields or structures before removing old ones;
- normalize defaults in application logic when database dialects differ;
- make migration idempotency and failure behavior explicit;
- bound user-controlled sizes and arithmetic before conversion;
- avoid loading all data into memory for a backfill;
- provide progress and retry semantics for long migrations;
- support mixed-version operation only when the rollout actually needs it;
- keep secrets and sensitive payloads out of migration logs.

Use the project's supported storage and platform matrix. Do not introduce a
backend-specific migration without valid behavior for every supported backend,
or explicitly narrow support through a product decision.

## Decide Rollback Semantics

Rollback options include:

- old binary safely ignores additive schema;
- dual-read/dual-write for a bounded transition;
- reversible data transform with verified backup;
- application rollback but schema remains forward-only;
- no in-place rollback, requiring restore to a separate environment.

State which option applies. A backup file is not a rollback until its format,
completeness, restore path, and target environment have been verified.

Never perform destructive down migrations merely to make the schema look old.
Preserving an unused additive column can be safer than deleting data.

## Configuration And API Evolution

For released configuration or public APIs:

- distinguish absent from explicit zero, false, or empty values;
- define default ownership and when defaults changed;
- reject ambiguous or dangerous input with stable errors;
- support aliases only for a bounded compatibility reason;
- document precedence when old and new settings coexist;
- remove fallback paths only after the supported window and usage evidence end.

For development-only names or formats, update them directly and remove stale
fallbacks and tests before release.

## Migration Validation

Use fixtures representing every real starting state:

- clean install;
- oldest supported deployed version;
- immediately previous release;
- explicit zero/empty/null and boundary values;
- interrupted or partially completed migration;
- rollback or old-code startup if supported;
- each supported database, filesystem, architecture, or host version whose
  behavior can differ.

Verify both structure and user-visible behavior after migration. Include cache
invalidation and background-worker compatibility where relevant.

## Release Gate

Before a migration release, report:

```text
Affected persisted/public contract:
Evidence it was or was not released and used:
Supported starting versions:
Forward migration:
Mixed-version behavior:
Backup and restore evidence:
Rollback semantics:
Validation matrix:
Known irreversible effects:
Required operator approval:
```

Applying a migration to production is a separate explicitly authorized action.

# Release And Deployment

Release creates an immutable distributable artifact. Deployment or distribution
puts that artifact into a user or environment boundary. Keep them separate in
workflow, authorization, evidence, and rollback.

## Release Preflight

Confirm:

- exact validated source SHA and downstream baseline;
- clean understood worktree and remote branch state;
- canonical CI passed for that SHA;
- version is new and follows downstream policy;
- changelog and license/NOTICE obligations are satisfied;
- artifact namespace cannot be confused with upstream publishing;
- signing, notarization, SBOM, provenance, or source archive requirements;
- no inherited workflow can publish with upstream credentials or identity;
- user explicitly authorized tag creation, workflow dispatch, or publication.

Do not reuse, move, or overwrite a published version. Fix source and increment a
new downstream build or release.

## Artifact Identity

Bind every artifact to:

- immutable version or tag;
- exact source commit;
- upstream baseline when useful;
- downstream source repository;
- checksum, package digest, image digest, or signed manifest;
- architecture/platform variants;
- build provenance and dependency information supported by the ecosystem.

Use downstream-owned package coordinates, registries, image names, update feeds,
and signing identity. Preserve upstream attribution without impersonating the
official distribution.

A useful version shape for release-tag patch stacks is:

```text
<upstream-version>-<downstream-name>.<build>
```

Other strategies may use independent semantic versions. Record the relationship
to upstream either way.

## Artifact Verification

Inspect what users will consume, not only build logs:

- package or archive contents;
- binary architecture and linked/runtime requirements;
- container manifest and labels;
- signatures, certificates, notarization, or store metadata;
- source URL, version, revision, license, and NOTICE;
- anonymous or intended-scope retrieval;
- clean installation or upgrade in a disposable environment;
- representative command, API, UI, plugin, or service behavior.

Record exact artifact identifiers before deployment handoff.

## Deployment Preflight

Confirm the user authorized the target environment and exact artifact. Read the
current operations source of truth and inspect live state when available.

For stateful services require:

- validated backup taken immediately before migration or switch;
- current and rollback artifact identifiers;
- config and secret availability without exposing values;
- migration compatibility and downtime expectations;
- environment approval and restricted deployment credentials;
- health, readiness, dependency, and representative smoke checks;
- automatic or documented rollback trigger;
- observability for partial failure.

Deploy exact `version@digest`, checksum, or signed artifact. Never follow a
moving branch or `latest` in production.

## Product-Specific Distribution

| Product            | Deployment/distribution evidence                                                   |
| ------------------ | ---------------------------------------------------------------------------------- |
| library            | registry version, package contents, consumer install smoke, deprecation contract   |
| CLI                | checksums/signatures, platform binaries, package-manager install, upgrade/rollback |
| desktop/mobile     | signed installer/build, update channel, migration state, device/store rollout      |
| service/container  | exact digest, backup, schema, dependencies, health, representative API/job         |
| plugin/extension   | host compatibility, permissions, marketplace/update feed, disable/remove path      |
| firmware/appliance | signed image, hardware target, staged update, recovery image or partition          |

Do not invent a production deployment stage for a project whose users consume a
package. Distribution still needs immutable identity and rollback guidance.

## Deployment Execution

Use the project's runbook. A robust sequence is:

1. Freeze or account for writes if the data model requires it.
2. Create and verify backup or snapshot.
3. Resolve the exact artifact and source.
4. Validate rendered configuration before changing running state.
5. Apply migrations through the supported mechanism.
6. Roll out with bounded concurrency or a staged target when available.
7. Wait for dependencies and all required health/readiness checks.
8. Execute representative authenticated and public behavior.
9. Inspect errors, resource pressure, queues, migrations, and business invariants.
10. Roll back or stop when acceptance fails; do not continue unrelated changes.
11. Record live source, artifact, backup, checks, and rollback point.

A generic health endpoint alone does not prove authentication, billing, storage,
protocol, or workflow behavior.

## Approval Boundaries

Treat each as a separate external mutation:

- push a release tag;
- dispatch a publishing workflow;
- change package or registry visibility;
- promote an artifact between channels;
- approve or dispatch deployment;
- apply production migrations or configuration;
- delete or revoke an artifact;
- execute rollback that changes live state.

A broad request to "prepare a release" does not authorize deployment. A request
to "deploy" may authorize the deployment after preflight, but destructive data
handling or an unavailable rollback still requires escalation.

## Feedback And Closure

After rollout, record sanitized evidence:

```text
source SHA and upstream base:
version and artifact digest:
target or distribution channel:
backup/snapshot and verification:
migrations applied:
health/readiness:
representative acceptance:
observed errors or metrics:
rollback artifact and trigger:
remaining enablement or migration work:
```

Feed production observations into bounded work items. Do not hide emergency
manual fixes outside the downstream patch and operations sources of truth.

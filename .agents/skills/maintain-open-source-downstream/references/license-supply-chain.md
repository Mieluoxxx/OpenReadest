# License And Supply Chain

This reference is engineering guidance, not legal advice. Stop and request
qualified review when rights or obligations are unclear.

## License And Attribution

Before modifying or distributing:

- identify all top-level and component licenses;
- preserve copyright, AUTHORS, NOTICE, attribution, and license headers;
- identify source-offer or corresponding-source obligations;
- check network-use, static-linking, asset, font, model, and dataset terms;
- review trademark and naming guidance separately from code copyright;
- document that the downstream is unofficial when required;
- keep downstream source available in the manner its license requires.

A publicly readable repository with no license is not permission to redistribute
modified versions. Do not add a new license over upstream code or remove identity
to make the fork appear original.

## Downstream Identity

Use a distinct distribution name, version suffix, package coordinate, registry,
image repository, update feed, and source URL. Preserve upstream attribution but
avoid implying that downstream artifacts are official upstream releases.

Do not publish to upstream-owned namespaces or reuse upstream signing identity,
credentials, release feeds, or container repositories.

## Audit Inherited Automation

Forked workflows are code with external side effects. Inspect:

- triggers for branches, tags, releases, schedules, and workflow chaining;
- repository identity guards;
- package, image, store, release, and deployment destinations;
- token permissions and secret availability;
- pull-request workflows that execute untrusted code with write credentials;
- mutable third-party actions, images, installers, and downloaded scripts;
- environment approvals and protected branches;
- caches and artifacts that can cross trust boundaries.

Make upstream publishing jobs inert in the downstream repository unless they are
explicitly adapted to a downstream-owned destination. Make downstream jobs inert
in the upstream repository if files may be proposed upstream.

Prefer least-privilege permissions, pinned action revisions, protected release
environments, short-lived credentials, and workload identity where available.
Never expose secrets to untrusted fork or pull-request code.

## Dependency And Toolchain Changes

During upstream intake or downstream feature work:

- inspect lockfiles, registries, mirrors, checksums, and toolchain versions;
- distinguish direct dependency intent from generated lockfile churn;
- review install scripts and build-time downloads;
- preserve reproducibility and supported runtime constraints;
- run ecosystem advisory or vulnerability checks when part of project policy;
- record accepted vulnerabilities or unavailable fixes explicitly;
- avoid silently broadening network access or runtime privileges.

Do not upgrade unrelated dependencies merely to reduce diff noise during an
upstream rebase.

## Artifact Provenance

Where supported, publish:

- exact source revision and source repository label;
- checksums or content digest;
- architecture/platform manifest;
- SBOM and build provenance;
- signature or attestation;
- license and NOTICE material;
- corresponding source reference.

Verify the published artifact from an intended consumer context. Registry upload
success is not proof that anonymous, team, device, or production consumers can
retrieve the correct object.

## Secret Handling

Never place credentials in:

- Git remotes embedded in committed profile files;
- issue bodies, comments, CI summaries, or chat output;
- command arguments visible to process listings when a secure input mechanism
  exists;
- repository fixtures, generated artifacts, screenshots, or test snapshots;
- container labels, package metadata, or source archives.

Sanitize remote URLs and API output. Store temporary sensitive material outside
the repository with restrictive permissions and remove it according to project
policy. Do not print complete configuration or payloads merely to prove a field.

## Security Update Priority

A security release may justify an expedited upstream intake, but not skipping
source identity, compatibility, validation, artifact integrity, or rollback.
Narrow the scope to the advisory when a full feature update cannot be validated
quickly. Record whether the fix was merged, cherry-picked, backported, or
reimplemented and how equivalence was proven.

## Release Gate Questions

```text
Are distribution rights and obligations understood?
Are upstream identity and notices preserved?
Is downstream artifact identity distinct?
Can inherited automation publish anywhere unintended?
Are workflow permissions and secret boundaries least-privilege?
Is the artifact bound to exact public source and digest?
Can intended consumers retrieve and verify it?
Are security exceptions documented?
```

Any unresolved answer is a release blocker or an explicit maintainer risk
acceptance, not a detail to omit from the report.

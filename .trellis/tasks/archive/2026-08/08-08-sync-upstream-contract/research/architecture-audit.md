# Architecture Audit

## Confirmed Current Model

- The generic Skill lives at
  `.agents/skills/maintain-open-source-downstream/` in this repository.
- Methodology version `0.3.0` generates two project-local layers:
  `.downstream/` for project facts and `.agents/skills/maintain-<project>/` for a
  copied runtime.
- The copied runtime contains a generated `SKILL.md`, methodology references,
  helper scripts, work-item assets, and `.methodology-manifest` checksums.
- Stable project facts are split across `profile.yaml`, `invariants.md`,
  `validation.md`, `release.md`, `deployment.md`, and `decisions/`.
- The Skill contains 94 `.downstream` references across 14 files, so the change
  requires a model refactor rather than a path-only replacement.

## Confirmed Trellis Boundaries

- `.trellis/spec/` owns coding and architecture conventions.
- `.trellis/tasks/` owns task PRDs, designs, implementation plans, research,
  and validation context.
- A custom `.trellis/sync-upstream/` directory is project-owned persistent
  knowledge and is not a Trellis template-managed path.
- Per-sync reports belong to the owning task's `research/` directory; they are
  not stable contract content.

## Portability Findings

- `methodology-lib.sh` uses Bash 4 associative arrays for manifest validation.
- The regression suite uses GNU-style `sed -i` and direct `sha256sum` calls.
- `inspect-repository.sh` contains an `awk` manifest-discovery regex rejected by
  the local BSD `awk` implementation.
- Removing copied runtimes and manifests eliminates the associative-array and
  SHA-256 requirements instead of adding compatibility branches.

## Agreed Target

```text
.trellis/sync-upstream/
├── contract.yaml
├── invariants.md
├── validation.md
└── decisions/
    └── README.md
```

- The global or committed generic Skill remains the executor.
- The Skill is Trellis-only.
- No generated `maintain-<project>` runtime remains.
- No legacy `.downstream/` compatibility or migration is required.

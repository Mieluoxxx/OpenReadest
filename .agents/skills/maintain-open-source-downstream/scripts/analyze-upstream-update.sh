#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=methodology-lib.sh
source "$script_dir/methodology-lib.sh"

usage() {
  cat <<'USAGE'
Usage: analyze-upstream-update.sh --target <ref> [options]

Options:
  --repo <path>      Repository path (default: .)
  --branch <ref>     Downstream tip (default: current branch/HEAD)
  --current <ref>    Current upstream base (default: contract baseline_ref)
  --target <ref>     Target upstream tag or commit (required)
  -h, --help         Show this help.

This is a stdout-only local analysis. It does not fetch, create refs, or write
project files. Save durable output under the active Trellis task's research
directory. Path overlap is a risk signal, not proof of a merge conflict.
USAGE
}

repo="."
branch=""
current=""
target=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) repo="${2:?--repo requires a value}"; shift 2 ;;
    --branch) branch="${2:?--branch requires a value}"; shift 2 ;;
    --current) current="${2:?--current requires a value}"; shift 2 ;;
    --target) target="${2:?--target requires a value}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unexpected argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$target" ]] || { echo "--target is required" >&2; usage >&2; exit 2; }
if ! root="$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not a Git repository: $repo" >&2
  exit 1
fi
cd "$root"
methodology_require_trellis "$root"
methodology_contract_root_is_safe "$root" || {
  echo "Missing or unsafe Trellis upstream contract: $SYNC_UPSTREAM_ROOT" >&2
  exit 1
}
contract_value() { methodology_contract_value "$1" "$SYNC_UPSTREAM_CONTRACT"; }

if [[ -z "$branch" ]]; then
  branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || printf HEAD)"
fi
if [[ -z "$current" ]]; then
  current="$(contract_value baseline_ref)"
  [[ -n "$current" && "$current" != TODO* ]] || {
    echo "The contract baseline_ref is unresolved; pass --current explicitly." >&2
    exit 1
  }
fi
for ref in "$branch" "$current" "$target"; do
  git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1 || {
    echo "Commit ref does not exist locally: $ref" >&2
    exit 1
  }
done

old_sha="$(git rev-parse "${current}^{commit}")"
target_sha="$(git rev-parse "${target}^{commit}")"
branch_sha="$(git rev-parse "${branch}^{commit}")"
merge_base="$(git merge-base "$current" "$target" 2>/dev/null || printf none)"
upstream_commits="$(git rev-list --count "${current}..${target}")"
downstream_patches="$(git rev-list --count "${current}..${branch}")"

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
LC_ALL=C git diff --name-only "$current" "$target" | LC_ALL=C sort -u > "$workdir/upstream-files"
LC_ALL=C git diff --name-only "$current" "$branch" | LC_ALL=C sort -u > "$workdir/downstream-files"
LC_ALL=C comm -12 "$workdir/upstream-files" "$workdir/downstream-files" > "$workdir/overlap-files"
upstream_files="$(wc -l < "$workdir/upstream-files" | tr -d '[:space:]')"
downstream_files="$(wc -l < "$workdir/downstream-files" | tr -d '[:space:]')"
overlap_files="$(wc -l < "$workdir/overlap-files" | tr -d '[:space:]')"

cherry_output="$(git cherry "$target" "$branch" "$current")"
absorbed_patches="$(printf '%s\n' "$cherry_output" | awk '$1 == "-" { n++ } END { print n + 0 }')"
remaining_patches="$(printf '%s\n' "$cherry_output" | awk '$1 == "+" { n++ } END { print n + 0 }')"

count_risk() {
  local regex="$1"
  grep -E -c "$regex" "$workdir/upstream-files" || true
}
workflow_risk="$(count_risk '(^|/)(\.github/workflows|\.gitlab-ci|Jenkinsfile|azure-pipelines|\.circleci|release|deploy)')"
dependency_risk="$(count_risk '(^|/)(go\.(mod|sum)|package(-lock)?\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|Cargo\.(toml|lock)|pyproject\.toml|poetry\.lock|requirements[^/]*\.txt|pom\.xml|build\.gradle|Gemfile\.lock|composer\.lock)$')"
migration_risk="$(count_risk '(^|/)(migrations?|schema|database|db)(/|\.|_)|(^|/)models?(/|\.)')"
license_risk="$(count_risk '(^|/)(LICENSE|LICENCE|COPYING|NOTICE|AUTHORS)(\.|$)')"

printf '# Upstream Update Analysis\n\n'
printf '| Field | Value |\n| --- | --- |\n'
printf '| Repository | `%s` |\n' "$root"
printf '| Strategy | `%s` |\n' "$(contract_value strategy_type)"
printf '| Current base | `%s` (`%s`) |\n' "$current" "$old_sha"
printf '| Target base | `%s` (`%s`) |\n' "$target" "$target_sha"
printf '| Target merge-base with current | `%s` |\n' "$merge_base"
printf '| Downstream tip | `%s` (`%s`) |\n' "$branch" "$branch_sha"
printf '| Upstream commits in current..target | `%s` |\n' "$upstream_commits"
printf '| Downstream commits in current..branch | `%s` |\n' "$downstream_patches"
printf '| Upstream net-changed files | `%s` |\n' "$upstream_files"
printf '| Downstream net-changed files | `%s` |\n' "$downstream_files"
printf '| Path overlap | `%s` |\n' "$overlap_files"
printf '| `git cherry` equivalent/absorbed patches | `%s` |\n' "$absorbed_patches"
printf '| `git cherry` remaining patches | `%s` |\n' "$remaining_patches"

printf '\n## Risk Signals In Upstream Net Changes\n\n'
printf '| Signal | Matching files |\n| --- | ---: |\n'
printf '| CI, release, or deployment | %s |\n' "$workflow_risk"
printf '| Dependency or toolchain | %s |\n' "$dependency_risk"
printf '| Schema, migration, database, or model | %s |\n' "$migration_risk"
printf '| License, notice, or authorship | %s |\n' "$license_risk"

printf '\n## Overlapping Paths\n\n'
if (( overlap_files == 0 )); then
  printf '_No net-changed path overlap detected. Semantic review is still required._\n'
else
  awk 'NR <= 50 { printf "- `%s`\\n", $0 }' "$workdir/overlap-files"
  if (( overlap_files > 50 )); then
    printf -- '- _%s additional overlapping paths omitted._\n' "$((overlap_files - 50))"
  fi
fi

printf '\n## Ancestry Notes\n\n'
if git merge-base --is-ancestor "$current" "$target"; then
  printf -- '- Target contains the current base.\n'
else
  printf -- '- Target does not contain the current base; investigate rewritten or divergent upstream history.\n'
fi
if git merge-base --is-ancestor "$current" "$branch"; then
  printf -- '- Downstream tip contains the stated current base.\n'
else
  printf -- '- Downstream tip does not contain the stated current base; the patch count is not a normal base-to-tip series.\n'
fi

printf '\n_Local analysis complete. Save this report and subsequent patch/validation evidence under `.trellis/tasks/<task>/research/`. Review release notes, public contracts, migrations, dependencies, security, and workflow semantics before selecting patch decisions._\n'

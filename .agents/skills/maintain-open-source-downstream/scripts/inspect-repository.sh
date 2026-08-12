#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=methodology-lib.sh
source "$script_dir/methodology-lib.sh"

usage() {
  cat <<'USAGE'
Usage: inspect-repository.sh [repository]

Print a read-only Markdown inventory of a Git repository. The script does not
fetch, edit files, create refs, or contact a forge API.
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

repo="${1:-.}"
if ! root="$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not a Git repository: $repo" >&2
  exit 1
fi
cd "$root"
methodology_require_trellis "$root" || exit 1
if [[ -e "$root/$SYNC_UPSTREAM_ROOT" || -L "$root/$SYNC_UPSTREAM_ROOT" ]] &&
  ! methodology_contract_root_is_safe "$root"; then
  echo "Unsafe Trellis upstream contract: $SYNC_UPSTREAM_ROOT" >&2
  exit 1
fi
contract="$SYNC_UPSTREAM_CONTRACT"
contract_value() { methodology_contract_value "$1" "$contract"; }

branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || printf detached)"
head_sha="$(git rev-parse HEAD)"
status_count="$(git status --porcelain=v1 --untracked-files=normal | wc -l | tr -d '[:space:]')"
worktree_count="$(git worktree list --porcelain | grep -c '^worktree ' || true)"
tag_count="$(git tag --list | wc -l | tr -d '[:space:]')"
commit_count="$(git rev-list --count HEAD)"

baseline_ref="$(contract_value baseline_ref)"
if [[ -n "$baseline_ref" && "$baseline_ref" != TODO* ]] && git rev-parse --verify "${baseline_ref}^{commit}" >/dev/null 2>&1; then
  nearest_tag="$baseline_ref"
else
  nearest_tag="$(git describe --tags --abbrev=0 HEAD 2>/dev/null || true)"
fi
if [[ -n "$nearest_tag" ]]; then
  commits_since_tag="$(git rev-list --count "${nearest_tag}..HEAD")"
else
  commits_since_tag="unknown"
fi

append_line() {
  local current="$1"
  local line="$2"
  if [[ -n "$current" ]]; then
    printf '%s\n%s' "$current" "$line"
  else
    printf '%s' "$line"
  fi
}

license_files=""
manifest_files=""
ci_files=""
deployment_files=""
while IFS= read -r file; do
  case "$file" in
    LICENSE|LICENSE.*|*/LICENSE|*/LICENSE.*|LICENCE|LICENCE.*|*/LICENCE|*/LICENCE.*|COPYING|COPYING.*|*/COPYING|*/COPYING.*|NOTICE|NOTICE.*|*/NOTICE|*/NOTICE.*|AUTHORS|AUTHORS.*|*/AUTHORS|*/AUTHORS.*)
      license_files="$(append_line "$license_files" "$file")" ;;
  esac
  case "$file" in
    go.mod|*/go.mod|package.json|*/package.json|Cargo.toml|*/Cargo.toml|pyproject.toml|*/pyproject.toml|pom.xml|*/pom.xml|build.gradle|*/build.gradle|build.gradle.kts|*/build.gradle.kts|settings.gradle|*/settings.gradle|settings.gradle.kts|*/settings.gradle.kts|Gemfile|*/Gemfile|composer.json|*/composer.json|mix.exs|*/mix.exs|CMakeLists.txt|*/CMakeLists.txt|Makefile|*/Makefile|*.sln|*/*.sln|*.csproj|*/*.csproj)
      manifest_files="$(append_line "$manifest_files" "$file")" ;;
  esac
  case "$file" in
    .github/workflows/*.yml|.github/workflows/*.yaml|.gitlab-ci.yml|.gitlab-ci.yaml|.woodpecker.yml|.woodpecker.yaml|.circleci/*|Jenkinsfile|azure-pipelines.yml|azure-pipelines.yaml)
      ci_files="$(append_line "$ci_files" "$file")" ;;
  esac
  case "$file" in
    Dockerfile|*/Dockerfile|Dockerfile.*|*/Dockerfile.*|compose.yml|compose.yaml|*/compose.yml|*/compose.yaml|docker-compose*.yml|docker-compose*.yaml|*/docker-compose*.yml|*/docker-compose*.yaml|Chart.yaml|*/Chart.yaml|kustomization.yml|kustomization.yaml|*/kustomization.yml|*/kustomization.yaml|Procfile|*/Procfile|helm/*|*/helm/*|charts/*|*/charts/*|k8s/*|*/k8s/*|kubernetes/*|*/kubernetes/*|terraform/*|*/terraform/*|tofu/*|*/tofu/*|ansible/*|*/ansible/*)
      deployment_files="$(append_line "$deployment_files" "$file")" ;;
  esac
done < <(git ls-files)

printf '# Repository Inventory\n\n'
printf '| Field | Value |\n| --- | --- |\n'
printf '| Root | `%s` |\n' "$root"
printf '| Branch | `%s` |\n' "$branch"
printf '| HEAD | `%s` |\n' "$head_sha"
printf '| Commits reachable | `%s` |\n' "$commit_count"
printf '| Worktree entries | `%s` |\n' "$worktree_count"
printf '| Worktree changes | `%s` |\n' "$status_count"
printf '| Tags | `%s` |\n' "$tag_count"
printf '| Nearest contract baseline/tag | `%s` |\n' "${nearest_tag:-none}"
printf '| Commits since baseline/tag | `%s` |\n' "$commits_since_tag"
printf '| Trellis project | `%s` |\n' "$([[ -d .trellis && ! -L .trellis ]] && printf present || printf absent)"
printf '| Sync contract | `%s` |\n' "$([[ -f "$contract" && ! -L "$contract" ]] && printf present || printf absent)"

printf '\n## Remotes\n\n'
if [[ -z "$(git remote)" ]]; then
  printf '_No remotes configured._\n'
else
  while IFS= read -r remote; do
    url="$(git remote get-url "$remote")"
    printf -- '- `%s`: `%s`\n' "$remote" "$(methodology_sanitize_url "$url")"
  done < <(git remote)
fi

print_list() {
  local heading="$1"
  local values="$2"
  printf '\n## %s\n\n' "$heading"
  if [[ -z "$values" ]]; then
    printf '_None detected._\n'
    return
  fi
  while IFS= read -r value; do
    [[ -n "$value" ]] && printf -- '- `%s`\n' "$value"
  done <<<"$values"
}

print_list "License And Attribution Files" "$license_files"
print_list "Build And Workspace Manifests" "$manifest_files"
print_list "CI Configuration" "$ci_files"
print_list "Packaging And Deployment Indicators" "$deployment_files"

printf '\n## Contract Hints\n\n'
if [[ -f "$contract" && ! -L "$contract" ]]; then
  printf -- '- Methodology: `%s@%s`\n' "$(contract_value methodology_name)" "$(contract_value methodology_version)"
  printf -- '- Strategy: `%s`\n' "$(contract_value strategy_type)"
  printf -- '- Upstream remote: `%s`\n' "$(contract_value upstream_remote)"
  printf -- '- Downstream remote: `%s`\n' "$(contract_value downstream_remote)"
  printf -- '- Integration branch: `%s`\n' "$(contract_value integration_branch)"
  printf -- '- Task root: `%s`\n' "$(contract_value task_root)"
  contract_files=(
    "$SYNC_UPSTREAM_CONTRACT"
    "$SYNC_UPSTREAM_INVARIANTS"
    "$SYNC_UPSTREAM_VALIDATION"
    "$SYNC_UPSTREAM_DECISIONS/README.md"
  )
  placeholder_matches="$(grep -n -E 'TODO|__[^_]+__' "${contract_files[@]}" 2>/dev/null || true)"
  printf -- '- Unresolved placeholders: `%s`\n' "$(methodology_count_lines "$placeholder_matches")"
else
  printf -- '- Complete adoption assessment before bootstrapping `%s`.\n' "$SYNC_UPSTREAM_ROOT"
fi

printf '\n_Read-only inventory complete; no refs or files were changed._\n'

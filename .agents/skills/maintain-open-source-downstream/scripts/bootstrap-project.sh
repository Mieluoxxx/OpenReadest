#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=methodology-lib.sh
source "$script_dir/methodology-lib.sh"

usage() {
  cat <<'USAGE'
Usage: bootstrap-project.sh --name <name> --strategy <type> [options]

Preview or create the Trellis-owned upstream synchronization contract.

Options:
  --repo <path>                Repository path (default: .)
  --name <name>                Human-readable project name (required)
  --upstream-remote <name>     Upstream remote (default: upstream)
  --downstream-remote <name>   Downstream remote (default: origin)
  --upstream-branch <name>     Upstream branch (default: main)
  --downstream-branch <name>   Integration branch (default: current branch)
  --strategy <type>            extension, upstream-first, patch-stack,
                               merge-downstream, vendor-overlay, or hard-fork
  --baseline-type <type>       tag, commit, or vendor-drop (default: tag)
  --baseline-ref <ref>         Immutable baseline ref (inferred when possible)
  --tag-pattern <glob>         Release discovery pattern (default: v[0-9]*)
  --apply                      Write files. Without this flag, only preview.
  -h, --help                   Show this help.

This command requires an initialized Trellis project. It never adds remotes,
creates branches, fetches, pushes, commits, publishes artifacts, deploys, or
changes external state.
USAGE
}

repo="."
name=""
upstream_remote="upstream"
downstream_remote="origin"
upstream_branch="main"
downstream_branch=""
strategy=""
baseline_type="tag"
baseline_ref=""
tag_pattern='v[0-9]*'
apply="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo) repo="${2:?--repo requires a value}"; shift 2 ;;
    --name) name="${2:?--name requires a value}"; shift 2 ;;
    --upstream-remote) upstream_remote="${2:?--upstream-remote requires a value}"; shift 2 ;;
    --downstream-remote) downstream_remote="${2:?--downstream-remote requires a value}"; shift 2 ;;
    --upstream-branch) upstream_branch="${2:?--upstream-branch requires a value}"; shift 2 ;;
    --downstream-branch) downstream_branch="${2:?--downstream-branch requires a value}"; shift 2 ;;
    --strategy) strategy="${2:?--strategy requires a value}"; shift 2 ;;
    --baseline-type) baseline_type="${2:?--baseline-type requires a value}"; shift 2 ;;
    --baseline-ref) baseline_ref="${2:?--baseline-ref requires a value}"; shift 2 ;;
    --tag-pattern) tag_pattern="${2:?--tag-pattern requires a value}"; shift 2 ;;
    --apply) apply="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unexpected argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$name" ]] || { echo "--name is required" >&2; usage >&2; exit 2; }
[[ -n "$strategy" ]] || { echo "--strategy is required" >&2; usage >&2; exit 2; }
[[ "$name" != *$'\n'* && "$name" != *'"'* && "$name" != *'\\'* ]] || {
  echo "--name must not contain a newline, double quote, or backslash" >&2
  exit 2
}

case "$strategy" in
  extension|upstream-first|patch-stack|merge-downstream|vendor-overlay|hard-fork) ;;
  *) echo "Unsupported strategy: $strategy" >&2; exit 2 ;;
esac
case "$baseline_type" in
  tag|commit|vendor-drop) ;;
  *) echo "Unsupported baseline type: $baseline_type" >&2; exit 2 ;;
esac

if ! root="$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not a Git repository: $repo" >&2
  exit 1
fi
cd "$root"
methodology_require_trellis "$root"

if [[ -z "$downstream_branch" ]]; then
  downstream_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  [[ -n "$downstream_branch" ]] || {
    echo "Detached HEAD; pass --downstream-branch explicitly." >&2
    exit 2
  }
fi

if [[ -e "$SYNC_UPSTREAM_ROOT" || -L "$SYNC_UPSTREAM_ROOT" ]]; then
  echo "Refusing to overwrite existing path: $SYNC_UPSTREAM_ROOT" >&2
  exit 1
fi

remote_url() {
  local remote="$1"
  local value
  value="$(git remote get-url "$remote" 2>/dev/null || true)"
  if [[ -z "$value" ]]; then
    printf 'TODO: configure %s remote\n' "$remote"
  else
    methodology_sanitize_url "$value"
  fi
}

upstream_url="$(remote_url "$upstream_remote")"
downstream_url="$(remote_url "$downstream_remote")"
if [[ -z "$baseline_ref" ]]; then
  if [[ "$baseline_type" == "tag" ]]; then
    baseline_ref="$(git describe --tags --match "$tag_pattern" --abbrev=0 "$downstream_branch" 2>/dev/null || true)"
  else
    baseline_ref="$(git rev-parse "$downstream_branch" 2>/dev/null || true)"
  fi
fi
[[ -n "$baseline_ref" ]] || baseline_ref="TODO: select an immutable baseline"

methodology_version="$(methodology_source_version "$(cd "$script_dir/.." && pwd)")"
[[ -n "$methodology_version" ]] || {
  echo "The source methodology has no metadata.version." >&2
  exit 1
}

if [[ "$strategy" == "patch-stack" ]]; then
  history_policy="maintainer-only-with-lease"
else
  history_policy="forbidden"
fi

for scalar in "$name" "$upstream_remote" "$downstream_remote" "$upstream_url" \
  "$downstream_url" "$upstream_branch" "$downstream_branch" "$strategy" \
  "$history_policy" "$baseline_type" "$baseline_ref" "$tag_pattern" \
  "$methodology_version"; do
  if ! methodology_validate_yaml_scalar "$scalar"; then
    echo "Bootstrap values must be single-line YAML-safe scalars without quotes or backslashes." >&2
    exit 2
  fi
done

printf 'Repository:         %s\n' "$root"
printf 'Project:            %s\n' "$name"
printf 'Strategy:           %s\n' "$strategy"
printf 'Upstream:           %s -> %s\n' "$upstream_remote" "$upstream_url"
printf 'Downstream:         %s -> %s\n' "$downstream_remote" "$downstream_url"
printf 'Integration branch: %s\n' "$downstream_branch"
printf 'Baseline:           %s (%s)\n' "$baseline_ref" "$baseline_type"
printf 'Methodology:        %s@%s\n' "$METHODOLOGY_NAME" "$methodology_version"
printf 'Mode:               %s\n' "$([[ "$apply" == "true" ]] && printf apply || printf preview)"
printf '\nProject contract files:\n'
printf '  %s\n' \
  "$SYNC_UPSTREAM_CONTRACT" \
  "$SYNC_UPSTREAM_INVARIANTS" \
  "$SYNC_UPSTREAM_VALIDATION" \
  "$SYNC_UPSTREAM_DECISIONS/README.md"

if [[ "$apply" != "true" ]]; then
  printf '\nPreview only. Re-run with --apply after reviewing the model.\n'
  exit 0
fi

asset_dir="$(cd "$script_dir/../assets" && pwd)"
candidate="$(mktemp -d "$root/.trellis/.sync-upstream.XXXXXX")"
cleanup() { rm -rf "$candidate"; }
trap cleanup EXIT
mkdir -p "$candidate/decisions"

render_template() {
  local source="$1"
  local target="$2"
  sed \
    -e "s|__PROJECT_NAME__|$(methodology_escape_sed "$name")|g" \
    -e "s|__METHODOLOGY_VERSION__|$(methodology_escape_sed "$methodology_version")|g" \
    -e "s|__UPSTREAM_REMOTE__|$(methodology_escape_sed "$upstream_remote")|g" \
    -e "s|__UPSTREAM_URL__|$(methodology_escape_sed "$upstream_url")|g" \
    -e "s|__UPSTREAM_BRANCH__|$(methodology_escape_sed "$upstream_branch")|g" \
    -e "s|__DOWNSTREAM_REMOTE__|$(methodology_escape_sed "$downstream_remote")|g" \
    -e "s|__DOWNSTREAM_URL__|$(methodology_escape_sed "$downstream_url")|g" \
    -e "s|__DOWNSTREAM_BRANCH__|$(methodology_escape_sed "$downstream_branch")|g" \
    -e "s|__STRATEGY__|$(methodology_escape_sed "$strategy")|g" \
    -e "s|__HISTORY_POLICY__|$(methodology_escape_sed "$history_policy")|g" \
    -e "s|__BASELINE_TYPE__|$(methodology_escape_sed "$baseline_type")|g" \
    -e "s|__BASELINE_REF__|$(methodology_escape_sed "$baseline_ref")|g" \
    -e "s|__TAG_PATTERN__|$(methodology_escape_sed "$tag_pattern")|g" \
    -e "s|__RELEASE_DISCOVERY__|$(methodology_escape_sed "tags matching $tag_pattern")|g" \
    "$source" > "$target"
}

render_template "$asset_dir/downstream-profile.yaml" "$candidate/contract.yaml"
render_template "$asset_dir/invariants.md" "$candidate/invariants.md"
render_template "$asset_dir/validation.md" "$candidate/validation.md"
cat > "$candidate/decisions/README.md" <<'DECISIONS'
# Upstream Synchronization Decisions

Record durable fork-governance decisions here. Per-intake analysis, patch
choices, and validation evidence belong under the owning `.trellis/tasks/<task>/research/`
directory instead of this stable contract.

A decision does not authorize external mutations unless the authorization is
listed explicitly.
DECISIONS

mv "$candidate" "$SYNC_UPSTREAM_ROOT"
trap - EXIT

contract_files=(
  "$SYNC_UPSTREAM_CONTRACT"
  "$SYNC_UPSTREAM_INVARIANTS"
  "$SYNC_UPSTREAM_VALIDATION"
  "$SYNC_UPSTREAM_DECISIONS/README.md"
)
placeholder_matches="$(grep -n -E 'TODO|__[^_]+__' "${contract_files[@]}" || true)"
placeholder_count="$(methodology_count_lines "$placeholder_matches")"
printf '\nCreated the Trellis upstream contract for %s.\n' "$name"
printf 'Unresolved project-contract placeholders: %s\n' "$placeholder_count"
printf 'Review every generated file before committing it. No Git refs or remotes were changed.\n'

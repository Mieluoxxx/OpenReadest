#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=methodology-lib.sh
source "$script_dir/methodology-lib.sh"

usage() {
  cat <<'USAGE'
Usage: downstream-doctor.sh [--strict] [repository]

Inspect a Trellis upstream synchronization contract and Git topology without
making changes. Warnings fail the command only with --strict.
USAGE
}

strict="false"
repo="."
while [[ $# -gt 0 ]]; do
  case "$1" in
    --strict) strict="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "Unexpected option: $1" >&2; usage >&2; exit 2 ;;
    *) repo="$1"; shift ;;
  esac
done

if ! root="$(git -C "$repo" rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not a Git repository: $repo" >&2
  exit 1
fi
cd "$root"

failures=0
warnings=0
pass() { printf '[PASS] %s\n' "$1"; }
warn() { printf '[WARN] %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf '[FAIL] %s\n' "$1"; failures=$((failures + 1)); }

printf 'Downstream doctor: %s\n\n' "$root"
if methodology_require_trellis "$root" 2>/dev/null; then
  pass ".trellis project exists"
else
  fail ".trellis project is missing or is a symlink"
fi

if [[ -d "$SYNC_UPSTREAM_ROOT" && ! -L "$SYNC_UPSTREAM_ROOT" ]]; then
  pass "$SYNC_UPSTREAM_ROOT directory is owned by the repository"
else
  fail "$SYNC_UPSTREAM_ROOT directory is missing or is a symlink"
fi
if [[ -d "$SYNC_UPSTREAM_DECISIONS" && ! -L "$SYNC_UPSTREAM_DECISIONS" ]]; then
  pass "$SYNC_UPSTREAM_DECISIONS directory is owned by the repository"
else
  fail "$SYNC_UPSTREAM_DECISIONS directory is missing or is a symlink"
fi

required=(
  "$SYNC_UPSTREAM_CONTRACT"
  "$SYNC_UPSTREAM_INVARIANTS"
  "$SYNC_UPSTREAM_VALIDATION"
  "$SYNC_UPSTREAM_DECISIONS/README.md"
)
for file in "${required[@]}"; do
  if [[ -f "$file" && ! -L "$file" ]]; then
    pass "$file exists"
  else
    fail "$file is missing or is a symlink"
  fi
done

if [[ ! -f "$SYNC_UPSTREAM_CONTRACT" || -L "$SYNC_UPSTREAM_CONTRACT" ]]; then
  printf '\nSummary: %s failure(s), %s warning(s)\n' "$failures" "$warnings"
  exit 1
fi
contract_value() { methodology_contract_value "$1" "$SYNC_UPSTREAM_CONTRACT"; }

schema_version="$(contract_value schema_version)"
[[ "$schema_version" == "1" ]] && pass "contract schema version is 1" || fail "unsupported or missing contract schema_version"
methodology_name="$(contract_value methodology_name)"
[[ "$methodology_name" == "$METHODOLOGY_NAME" ]] \
  && pass "methodology name is $METHODOLOGY_NAME" \
  || fail "unsupported or missing methodology_name: ${methodology_name:-empty}"
methodology_version="$(contract_value methodology_version)"
[[ -n "$methodology_version" && "$methodology_version" != TODO* ]] \
  && pass "methodology version is $methodology_version" \
  || warn "methodology_version remains unresolved"

required_keys=(
  project_name distribution_name upstream_remote upstream_url downstream_remote
  downstream_url upstream_branch integration_branch strategy_type
  history_rewrite_policy baseline_type baseline_ref release_discovery task_root
  delivery_type delivery_workflow delivery_namespace deployment_applicable
  operations_source invariants_file validation_file decisions_directory
  external_mutation_policy
)
for key in "${required_keys[@]}"; do
  value="$(contract_value "$key")"
  [[ -n "$value" ]] && pass "$key is present" || fail "$key is missing"
done

strategy="$(contract_value strategy_type)"
history_policy="$(contract_value history_rewrite_policy)"
case "$strategy:$history_policy" in
  patch-stack:maintainer-only-with-lease|patch-stack:coordinated|extension:forbidden|extension:coordinated|upstream-first:forbidden|upstream-first:coordinated|merge-downstream:forbidden|merge-downstream:coordinated|vendor-overlay:forbidden|vendor-overlay:coordinated|hard-fork:forbidden|hard-fork:coordinated)
    pass "strategy and history policy are compatible" ;;
  *) fail "unsupported strategy/history-policy combination: ${strategy:-empty}/${history_policy:-empty}" ;;
esac

policy="$(contract_value external_mutation_policy)"
[[ "$policy" == "explicit-authorization-required" ]] \
  && pass "external mutations require explicit authorization" \
  || fail "external_mutation_policy is not explicit-authorization-required"

task_root="$(contract_value task_root)"
[[ "$task_root" == ".trellis/tasks" ]] \
  && pass "task root is .trellis/tasks" \
  || fail "task_root must be .trellis/tasks: ${task_root:-empty}"

for key in invariants_file validation_file decisions_directory; do
  value="$(contract_value "$key")"
  if methodology_safe_contract_path "$value"; then
    pass "$key stays under $SYNC_UPSTREAM_ROOT"
  else
    fail "$key is outside $SYNC_UPSTREAM_ROOT: ${value:-empty}"
  fi
done
[[ "$(contract_value invariants_file)" == "$SYNC_UPSTREAM_INVARIANTS" ]] || fail "invariants_file must point to $SYNC_UPSTREAM_INVARIANTS"
[[ "$(contract_value validation_file)" == "$SYNC_UPSTREAM_VALIDATION" ]] || fail "validation_file must point to $SYNC_UPSTREAM_VALIDATION"
[[ "$(contract_value decisions_directory)" == "$SYNC_UPSTREAM_DECISIONS" ]] || fail "decisions_directory must point to $SYNC_UPSTREAM_DECISIONS"

check_remote() {
  local role="$1"
  local name_key="$2"
  local url_key="$3"
  local name expected actual
  name="$(contract_value "$name_key")"
  expected="$(contract_value "$url_key")"
  if [[ -z "$name" || "$name" == TODO* ]]; then
    fail "$role remote name is unresolved"
    return
  fi
  if ! git remote get-url "$name" >/dev/null 2>&1; then
    fail "$role remote '$name' does not exist"
    return
  fi
  if methodology_url_has_credentials "$expected"; then
    fail "$role remote URL in the contract contains credentials"
  fi
  actual="$(methodology_sanitize_url "$(git remote get-url "$name")")"
  pass "$role remote '$name' exists ($actual)"
  if [[ -n "$expected" && "$expected" != TODO* ]]; then
    expected="$(methodology_sanitize_url "$expected")"
    [[ "$actual" == "$expected" ]] \
      && pass "$role remote URL matches the contract" \
      || fail "$role remote URL differs: expected $expected, got $actual"
  else
    warn "$role remote URL remains unresolved in the contract"
  fi
}
check_remote upstream upstream_remote upstream_url
check_remote downstream downstream_remote downstream_url

integration_branch="$(contract_value integration_branch)"
current_branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || printf detached)"
if [[ -z "$integration_branch" || "$integration_branch" == TODO* ]]; then
  fail "integration_branch is unresolved"
elif git show-ref --verify --quiet "refs/heads/${integration_branch}"; then
  pass "integration branch '$integration_branch' exists"
  [[ "$current_branch" == "$integration_branch" ]] \
    && pass "current branch is the integration branch" \
    || warn "current branch is '$current_branch', not '$integration_branch'"
else
  fail "integration branch '$integration_branch' does not exist locally"
fi

baseline_type="$(contract_value baseline_type)"
baseline_ref="$(contract_value baseline_ref)"
case "$baseline_type" in
  tag)
    if [[ -z "$baseline_ref" || "$baseline_ref" == TODO* ]]; then
      fail "tag baseline_ref is unresolved"
    elif git show-ref --verify --quiet "refs/tags/$baseline_ref"; then
      pass "immutable tag baseline '$baseline_ref' exists"
    else
      fail "immutable tag baseline '$baseline_ref' does not exist locally"
    fi ;;
  commit|vendor-drop)
    if [[ "$baseline_ref" =~ ^[0-9a-fA-F]{40}$ ]] && git rev-parse --verify "${baseline_ref}^{commit}" >/dev/null 2>&1; then
      pass "immutable $baseline_type baseline is a full commit"
    else
      fail "$baseline_type baseline_ref must be a local full commit SHA"
    fi ;;
  *) fail "unsupported or missing baseline_type: ${baseline_type:-empty}" ;;
esac
release_discovery="$(contract_value release_discovery)"
[[ -n "$release_discovery" && "$release_discovery" != TODO* ]] \
  && pass "release discovery rule is recorded" \
  || warn "release discovery rule remains unresolved"

for key in distribution_name delivery_type delivery_workflow delivery_namespace deployment_applicable operations_source; do
  value="$(contract_value "$key")"
  [[ -n "$value" && "$value" != TODO* ]] || warn "$key remains unresolved"
done
deployment_applicable="$(contract_value deployment_applicable)"
case "$deployment_applicable" in
  yes|no) pass "deployment applicability is $deployment_applicable" ;;
  TODO*) ;;
  *) fail "deployment_applicable must be yes or no" ;;
esac

status_count="$(git status --porcelain=v1 --untracked-files=normal | wc -l | tr -d '[:space:]')"
if [[ "$status_count" == "0" ]]; then
  pass "worktree is clean"
elif [[ "$strategy" == "patch-stack" ]]; then
  warn "worktree has $status_count change(s); patch-stack rewrite must not start"
else
  warn "worktree has $status_count change(s)"
fi

license_count=0
while IFS= read -r file; do
  case "$file" in
    LICENSE|LICENSE.*|*/LICENSE|*/LICENSE.*|LICENCE|LICENCE.*|*/LICENCE|*/LICENCE.*|COPYING|COPYING.*|*/COPYING|*/COPYING.*|NOTICE|NOTICE.*|*/NOTICE|*/NOTICE.*)
      license_count=$((license_count + 1)) ;;
  esac
done < <(git ls-files)
(( license_count > 0 )) && pass "license/notice files detected" || warn "no license or notice file detected"

placeholder_matches="$(grep -n -E 'TODO|__[^_]+__' "${required[@]}" 2>/dev/null || true)"
placeholder_count="$(methodology_count_lines "$placeholder_matches")"
(( placeholder_count == 0 )) \
  && pass "project contract has no unresolved placeholders" \
  || warn "project contract has $placeholder_count unresolved placeholder(s)"

printf '\nSummary: %s failure(s), %s warning(s)\n' "$failures" "$warnings"
(( failures == 0 )) || exit 1
if [[ "$strict" == "true" && "$warnings" -gt 0 ]]; then
  exit 1
fi

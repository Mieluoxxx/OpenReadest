#!/usr/bin/env bash
set -euo pipefail

skill_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scripts="$skill_dir/scripts"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_contains() {
  local value="$1"
  local expected="$2"
  [[ "$value" == *"$expected"* ]] || fail "expected output to contain: $expected"
}

assert_not_contains() {
  local value="$1"
  local unexpected="$2"
  [[ "$value" != *"$unexpected"* ]] || fail "output unexpectedly contained: $unexpected"
}

replace_line() {
  local file="$1"
  local line_number="$2"
  local replacement="$3"
  local temporary="$file.tmp"
  awk -v line_number="$line_number" -v replacement="$replacement" '
    NR == line_number { print replacement; next }
    { print }
  ' "$file" > "$temporary"
  mv "$temporary" "$file"
}

replace_contract_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local temporary="$file.tmp"
  awk -v key="$key" -v value="$value" '
    $1 == key ":" { print key ": \"" value "\""; next }
    { print }
  ' "$file" > "$temporary"
  mv "$temporary" "$file"
}

resolve_todos() {
  local file="$1"
  local temporary="$file.tmp"
  awk '{ gsub(/TODO/, "resolved"); print }' "$file" > "$temporary"
  mv "$temporary" "$file"
}

snapshot_repository() {
  local repo="$1"
  {
    git -C "$repo" status --porcelain=v1 --untracked-files=all
    git -C "$repo" for-each-ref --format='%(refname) %(objectname)'
    git -C "$repo" remote -v
  }
}

create_minimal_trellis_repo() {
  local repo="$1"
  mkdir -p "$repo/.trellis/tasks"
  git -C "$repo" init -q --initial-branch=main
  git -C "$repo" config user.name "Downstream Skill Test"
  git -C "$repo" config user.email "downstream-skill@example.invalid"
  printf '# Workflow\n' > "$repo/.trellis/workflow.md"
  printf 'MIT License\n' > "$repo/LICENSE"
  printf 'base\n' > "$repo/content.txt"
  git -C "$repo" add .trellis/workflow.md LICENSE content.txt
  git -C "$repo" commit -q -m "upstream base"
  git -C "$repo" tag v1.0.0
  git -C "$repo" remote add upstream https://example.invalid/upstream/project.git
  git -C "$repo" remote add origin https://example.invalid/downstream/project.git
}

create_fake_trellis_repo() {
  local repo="$1"
  mkdir -p "$repo/.trellis/tasks"
  git -C "$repo" init -q --initial-branch=main
  git -C "$repo" config user.name "Downstream Skill Test"
  git -C "$repo" config user.email "downstream-skill@example.invalid"
  printf 'MIT License\n' > "$repo/LICENSE"
  git -C "$repo" add LICENSE
  git -C "$repo" commit -q -m "base"
}

for script in "$scripts"/*.sh "$skill_dir/tests/test-scripts.sh"; do
  /bin/bash -n "$script"
done

# Trellis is mandatory, and strategy selection is explicit.
plain_repo="$tmp/plain"
mkdir -p "$plain_repo"
git -C "$plain_repo" init -q --initial-branch=main
git -C "$plain_repo" config user.name "Downstream Skill Test"
git -C "$plain_repo" config user.email "downstream-skill@example.invalid"
printf 'MIT License\n' > "$plain_repo/LICENSE"
git -C "$plain_repo" add LICENSE
git -C "$plain_repo" commit -q -m "base"
if "$scripts/bootstrap-project.sh" --repo "$plain_repo" --name Plain --strategy hard-fork >/dev/null 2>&1; then
  fail "bootstrap accepted a non-Trellis repository"
fi

fake_trellis_repo="$tmp/fake-trellis"
create_fake_trellis_repo "$fake_trellis_repo"
if "$scripts/bootstrap-project.sh" --repo "$fake_trellis_repo" --name Fake --strategy hard-fork >/dev/null 2>&1; then
  fail "bootstrap accepted an uninitialized Trellis directory"
fi

repo="$tmp/repo"
create_minimal_trellis_repo "$repo"
printf 'check:\n\t@true\n' > "$repo/Makefile"
printf '{"name":"fixture"}\n' > "$repo/package.json"
mkdir -p "$repo/.github/workflows"
printf 'name: CI\n' > "$repo/.github/workflows/ci.yml"
printf 'FROM scratch\n' > "$repo/Dockerfile"
seq 1 40 > "$repo/shared.txt"
git -C "$repo" add Makefile package.json .github/workflows/ci.yml Dockerfile shared.txt
git -C "$repo" commit -q -m "add fixture surfaces"
git -C "$repo" tag -f v1.0.0
git -C "$repo" branch nexus

# Build a local upstream target with every reported risk category.
git -C "$repo" switch -q -c upstream-line
replace_line "$repo/shared.txt" 2 "upstream-2"
printf 'upstream release\n' > "$repo/upstream.txt"
printf 'name: Release\n' > "$repo/.github/workflows/release.yml"
printf '{"name":"fixture","version":"2"}\n' > "$repo/package.json"
mkdir -p "$repo/migrations"
printf 'schema change\n' > "$repo/migrations/001.txt"
printf 'Upstream notice\n' > "$repo/NOTICE"
git -C "$repo" add shared.txt upstream.txt .github/workflows/release.yml package.json migrations/001.txt NOTICE
git -C "$repo" commit -q -m "upstream release"
git -C "$repo" tag v1.1.0

# Create one downstream patch with one overlapping path.
git -C "$repo" switch -q nexus
replace_line "$repo/shared.txt" 39 "downstream-39"
printf 'downstream feature\n' > "$repo/feature.txt"
git -C "$repo" add shared.txt feature.txt
git -C "$repo" commit -q -m "feat: downstream behavior"
git -C "$repo" remote set-url upstream https://secret@example.invalid/upstream/project.git
git -C "$repo" remote set-url origin https://token@example.invalid/downstream/project.git

# Inspection is BSD-awk compatible, sanitizes URL userinfo, and is read-only.
before="$(snapshot_repository "$repo")"
inspect_output="$("$scripts/inspect-repository.sh" "$repo")"
after="$(snapshot_repository "$repo")"
[[ "$before" == "$after" ]] || fail "repository inspection changed local state"
assert_contains "$inspect_output" "# Repository Inventory"
assert_contains "$inspect_output" 'Branch | `nexus`'
assert_contains "$inspect_output" 'Trellis project | `present`'
assert_contains "$inspect_output" 'Sync contract | `absent`'
assert_contains "$inspect_output" 'https://example.invalid/upstream/project'
assert_contains "$inspect_output" '`Makefile`'
assert_contains "$inspect_output" '`package.json`'
assert_contains "$inspect_output" '`.github/workflows/ci.yml`'
assert_contains "$inspect_output" '`Dockerfile`'
assert_not_contains "$inspect_output" "secret@"
assert_not_contains "$inspect_output" "token@"

ln -s missing-sync-upstream "$repo/.trellis/sync-upstream"
if "$scripts/inspect-repository.sh" "$repo" >/dev/null 2>&1; then
  fail "inspection accepted a dangling contract-root symlink"
fi
if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy patch-stack >/dev/null 2>&1; then
  fail "bootstrap accepted a dangling contract-root symlink"
fi
if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy patch-stack --apply >/dev/null 2>&1; then
  fail "bootstrap apply accepted a dangling contract-root symlink"
fi
rm "$repo/.trellis/sync-upstream"

git -C "$repo" remote set-url upstream ssh://alice:secret@example.invalid/upstream/project.git
ssh_inspect_output="$("$scripts/inspect-repository.sh" "$repo")"
assert_not_contains "$ssh_inspect_output" "alice:secret@"
assert_not_contains "$ssh_inspect_output" "secret@"
git -C "$repo" remote set-url upstream alice:secret@example.invalid:upstream/project.git
scp_inspect_output="$("$scripts/inspect-repository.sh" "$repo")"
assert_not_contains "$scp_inspect_output" "alice:secret@"
assert_not_contains "$scp_inspect_output" "secret@"
git -C "$repo" remote set-url upstream git@example.invalid:upstream/project.git
standard_scp_output="$("$scripts/inspect-repository.sh" "$repo")"
assert_not_contains "$standard_scp_output" "git@"
assert_contains "$standard_scp_output" "example.invalid:upstream/project"
git -C "$repo" remote set-url upstream https://secret@example.invalid/upstream/project.git

if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" >/dev/null 2>&1; then
  fail "bootstrap accepted a missing strategy"
fi
if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy hard-fork --upstream-branch $'bad\nbranch' >/dev/null 2>&1; then
  fail "bootstrap accepted a multiline YAML scalar"
fi
if "$scripts/bootstrap-project.sh" --repo "$repo" --name $'Bad\001Name' --strategy hard-fork >/dev/null 2>&1; then
  fail "bootstrap accepted a C0 control character"
fi
git -C "$repo" remote set-url upstream 'https://example.invalid/upstream/"bad.git'
if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy hard-fork >/dev/null 2>&1; then
  fail "bootstrap accepted an unsafe remote URL scalar"
fi
git -C "$repo" remote set-url upstream https://secret@example.invalid/upstream/project.git

# Preview reports the exact contract and performs no writes or Git mutations.
before="$(snapshot_repository "$repo")"
preview_output="$("$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy patch-stack)"
after="$(snapshot_repository "$repo")"
[[ "$before" == "$after" ]] || fail "bootstrap preview changed local state"
assert_contains "$preview_output" "Preview only"
assert_contains "$preview_output" ".trellis/sync-upstream/contract.yaml"
assert_contains "$preview_output" ".trellis/sync-upstream/invariants.md"
assert_contains "$preview_output" ".trellis/sync-upstream/validation.md"
assert_contains "$preview_output" ".trellis/sync-upstream/decisions/README.md"
[[ ! -e "$repo/.trellis/sync-upstream" ]] || fail "preview wrote the contract"

apply_output="$("$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy patch-stack --apply)"
assert_contains "$apply_output" "Created the Trellis upstream contract"
contract="$repo/.trellis/sync-upstream/contract.yaml"
[[ -f "$contract" ]] || fail "contract.yaml was not created"
[[ -f "$repo/.trellis/sync-upstream/invariants.md" ]] || fail "invariants.md was not created"
[[ -f "$repo/.trellis/sync-upstream/validation.md" ]] || fail "validation.md was not created"
[[ -f "$repo/.trellis/sync-upstream/decisions/README.md" ]] || fail "decisions README was not created"
file_count="$(find "$repo/.trellis/sync-upstream" -type f | wc -l | tr -d '[:space:]')"
[[ "$file_count" == "4" ]] || fail "bootstrap created $file_count files instead of 4"
[[ ! -e "$repo/.agents" ]] || fail "bootstrap generated a project Skill"
grep -Fq 'history_rewrite_policy: "maintainer-only-with-lease"' "$contract" || fail "patch-stack history policy is wrong"
if "$scripts/bootstrap-project.sh" --repo "$repo" --name "Example Downstream" --strategy patch-stack --apply >/dev/null 2>&1; then
  fail "bootstrap overwrote an existing contract"
fi

inspect_output="$("$scripts/inspect-repository.sh" "$repo")"
assert_contains "$inspect_output" 'Sync contract | `present`'
assert_contains "$inspect_output" 'Methodology: `maintain-open-source-downstream@0.4.0`'
assert_contains "$inspect_output" 'Strategy: `patch-stack`'

# Default history policy is deterministic for every supported strategy.
for strategy in extension upstream-first merge-downstream vendor-overlay hard-fork; do
  strategy_repo="$tmp/strategy-$strategy"
  create_minimal_trellis_repo "$strategy_repo"
  "$scripts/bootstrap-project.sh" --repo "$strategy_repo" --name "$strategy" --strategy "$strategy" --apply >/dev/null
  grep -Fq 'history_rewrite_policy: "forbidden"' "$strategy_repo/.trellis/sync-upstream/contract.yaml" \
    || fail "$strategy did not default to forbidden history rewrite"
done

# Generated placeholders warn normally and fail strict doctor mode.
doctor_output="$("$scripts/downstream-doctor.sh" "$repo")"
assert_contains "$doctor_output" "[PASS] contract schema version is 1"
assert_contains "$doctor_output" "[PASS] strategy and history policy are compatible"
assert_contains "$doctor_output" "[WARN] project contract has"
if "$scripts/downstream-doctor.sh" --strict "$repo" >/dev/null 2>&1; then
  fail "strict doctor accepted unresolved placeholders"
fi

# Resolve project-owned delivery facts, commit the contract, and prove strict health.
replace_contract_value "$contract" distribution_name "Demo # downstream"
parsed_distribution="$(
  source "$scripts/methodology-lib.sh"
  methodology_contract_value distribution_name "$contract"
)"
[[ "$parsed_distribution" == "Demo # downstream" ]] || fail "quoted hash scalar did not round-trip"
replace_contract_value "$contract" delivery_type "desktop"
replace_contract_value "$contract" delivery_workflow ".github/workflows/release.yml"
replace_contract_value "$contract" delivery_namespace "example/downstream"
replace_contract_value "$contract" deployment_applicable "no"
replace_contract_value "$contract" operations_source "not-applicable"
resolve_todos "$repo/.trellis/sync-upstream/invariants.md"
resolve_todos "$repo/.trellis/sync-upstream/validation.md"
git -C "$repo" add .trellis/sync-upstream
git -C "$repo" commit -q -m "chore: add sync contract"
strict_output="$("$scripts/downstream-doctor.sh" --strict "$repo")"
assert_contains "$strict_output" "Summary: 0 failure(s), 0 warning(s)"

# Doctor rejects URL drift, missing remotes, and paths outside the contract root.
replace_contract_value "$contract" upstream_url "https://wrong.invalid/upstream"
if "$scripts/downstream-doctor.sh" "$repo" >/dev/null 2>&1; then
  fail "doctor accepted upstream URL drift"
fi
replace_contract_value "$contract" upstream_url "https://example.invalid/upstream/project"
replace_contract_value "$contract" upstream_url "https://secret@example.invalid/upstream/project.git"
credential_output="$("$scripts/downstream-doctor.sh" "$repo" || true)"
assert_contains "$credential_output" "upstream remote URL in the contract contains credentials"
replace_contract_value "$contract" upstream_url "https://example.invalid/upstream/project"
replace_contract_value "$contract" invariants_file "../outside.md"
if "$scripts/downstream-doctor.sh" "$repo" >/dev/null 2>&1; then
  fail "doctor accepted an unsafe contract path"
fi
replace_contract_value "$contract" invariants_file ".trellis/sync-upstream/invariants.md"
git -C "$repo" remote remove upstream
if "$scripts/downstream-doctor.sh" "$repo" >/dev/null 2>&1; then
  fail "doctor accepted a missing upstream remote"
fi
git -C "$repo" remote add upstream https://secret@example.invalid/upstream/project.git

mv "$repo/.trellis/sync-upstream" "$repo/sync-upstream-real"
ln -s ../sync-upstream-real "$repo/.trellis/sync-upstream"
if "$scripts/downstream-doctor.sh" "$repo" >/dev/null 2>&1; then
  fail "doctor accepted a symlinked contract root"
fi
if "$scripts/inspect-repository.sh" "$repo" >/dev/null 2>&1; then
  fail "inspection accepted a symlinked contract root"
fi
if "$scripts/analyze-upstream-update.sh" --repo "$repo" --target upstream-line --branch nexus >/dev/null 2>&1; then
  fail "analysis accepted a symlinked contract root"
fi
rm "$repo/.trellis/sync-upstream"
mv "$repo/sync-upstream-real" "$repo/.trellis/sync-upstream"

mv "$repo/.trellis/sync-upstream/decisions" "$repo/.trellis/sync-upstream/decisions-real"
ln -s decisions-real "$repo/.trellis/sync-upstream/decisions"
if "$scripts/downstream-doctor.sh" "$repo" >/dev/null 2>&1; then
  fail "doctor accepted a symlinked decisions directory"
fi
rm "$repo/.trellis/sync-upstream/decisions"
mv "$repo/.trellis/sync-upstream/decisions-real" "$repo/.trellis/sync-upstream/decisions"

# Analysis uses the contract baseline, reports every risk class, and is read-only.
before="$(snapshot_repository "$repo")"
analysis_output="$("$scripts/analyze-upstream-update.sh" --repo "$repo" --target upstream-line --branch nexus)"
after="$(snapshot_repository "$repo")"
[[ "$before" == "$after" ]] || fail "upstream analysis changed local state"
assert_contains "$analysis_output" "# Upstream Update Analysis"
assert_contains "$analysis_output" 'Upstream commits in current..target | `1`'
assert_contains "$analysis_output" 'Downstream commits in current..branch | `2`'
assert_contains "$analysis_output" '`git cherry` equivalent/absorbed patches | `0`'
assert_contains "$analysis_output" '`git cherry` remaining patches | `2`'
assert_contains "$analysis_output" 'Path overlap | `1`'
assert_contains "$analysis_output" '`shared.txt`'
assert_contains "$analysis_output" '| CI, release, or deployment | 1 |'
assert_contains "$analysis_output" '| Dependency or toolchain | 1 |'
assert_contains "$analysis_output" '| Schema, migration, database, or model | 1 |'
assert_contains "$analysis_output" '| License, notice, or authorship | 1 |'
assert_contains "$analysis_output" '.trellis/tasks/<task>/research/'

# Patch-stack verification remains read-only and rejects unequal final trees.
git -C "$repo" switch -q -c repacked v1.0.0
git -C "$repo" merge --squash nexus >/dev/null
git -C "$repo" commit -q -m "feat: repacked downstream behavior"
before="$(snapshot_repository "$repo")"
repack_output="$(cd "$repo" && "$scripts/verify-patch-stack.sh" repack v1.0.0 nexus repacked)"
after="$(snapshot_repository "$repo")"
[[ "$before" == "$after" ]] || fail "repack verification changed local state"
assert_contains "$repack_output" "Final tree:       identical"
assert_contains "$repack_output" "Range-diff:"
if (cd "$repo" && "$scripts/verify-patch-stack.sh" repack v1.0.0 nexus upstream-line) >/dev/null 2>&1; then
  fail "repack verification accepted different final trees"
fi

git -C "$repo" switch -q -c rebased upstream-line
git -C "$repo" cherry-pick $(git -C "$repo" rev-list --reverse v1.0.0..nexus) >/dev/null
before="$(snapshot_repository "$repo")"
rebase_output="$(cd "$repo" && "$scripts/verify-patch-stack.sh" rebase v1.0.0 nexus upstream-line rebased)"
after="$(snapshot_repository "$repo")"
[[ "$before" == "$after" ]] || fail "rebase verification changed local state"
assert_contains "$rebase_output" "New-series whitespace: clean"
assert_contains "$rebase_output" "Range-diff (review required):"

printf 'All maintain-open-source-downstream script tests passed.\n'

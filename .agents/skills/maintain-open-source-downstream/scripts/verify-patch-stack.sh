#!/usr/bin/env bash
set -euo pipefail
export GIT_PAGER=cat

usage() {
  cat <<'EOF'
Usage:
  verify-patch-stack.sh repack <base> <old-tip> <repacked-tip>
  verify-patch-stack.sh rebase <old-base> <old-tip> <new-base> <new-tip>

repack:
  Requires old-tip and repacked-tip to have identical trees, then prints a
  range-diff against the same base.

rebase:
  Verifies both base-to-tip ancestries, checks the new series for whitespace
  errors, and prints a range-diff across old and new bases. It does not claim
  behavioral equivalence.

The script is read-only and does not create refs or change the worktree.
EOF
}

[[ $# -gt 0 ]] || { usage >&2; exit 2; }
mode="$1"
shift

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this command inside a Git repository." >&2
  exit 1
}
cd "$repo_root"

resolve_commit() {
  local ref="$1"
  git rev-parse --verify "${ref}^{commit}" >/dev/null 2>&1 || {
    echo "Commit ref does not exist: $ref" >&2
    exit 1
  }
}

case "$mode" in
  repack)
    [[ $# -eq 3 ]] || { usage >&2; exit 2; }
    base="$1"
    old_tip="$2"
    repacked_tip="$3"
    resolve_commit "$base"
    resolve_commit "$old_tip"
    resolve_commit "$repacked_tip"
    git merge-base --is-ancestor "$base" "$old_tip" || {
      echo "$base is not an ancestor of $old_tip" >&2
      exit 1
    }
    git merge-base --is-ancestor "$base" "$repacked_tip" || {
      echo "$base is not an ancestor of $repacked_tip" >&2
      exit 1
    }

    printf 'Base:             %s (%s)\n' "$base" "$(git rev-parse "${base}^{commit}")"
    printf 'Old tip:          %s (%s), %s patch(es)\n' "$old_tip" "$(git rev-parse "${old_tip}^{commit}")" "$(git rev-list --count "${base}..${old_tip}")"
    printf 'Repacked tip:     %s (%s), %s patch(es)\n' "$repacked_tip" "$(git rev-parse "${repacked_tip}^{commit}")" "$(git rev-list --count "${base}..${repacked_tip}")"

    if ! git diff --quiet "$old_tip" "$repacked_tip"; then
      echo "Final trees differ; repack equivalence failed." >&2
      git diff --stat "$old_tip" "$repacked_tip" >&2
      exit 1
    fi
    printf 'Final tree:       identical\n\n'
    printf 'Range-diff:\n'
    git range-diff "${base}..${old_tip}" "${base}..${repacked_tip}"
    ;;

  rebase)
    [[ $# -eq 4 ]] || { usage >&2; exit 2; }
    old_base="$1"
    old_tip="$2"
    new_base="$3"
    new_tip="$4"
    for ref in "$old_base" "$old_tip" "$new_base" "$new_tip"; do
      resolve_commit "$ref"
    done
    git merge-base --is-ancestor "$old_base" "$old_tip" || {
      echo "$old_base is not an ancestor of $old_tip" >&2
      exit 1
    }
    git merge-base --is-ancestor "$new_base" "$new_tip" || {
      echo "$new_base is not an ancestor of $new_tip" >&2
      exit 1
    }

    printf 'Old series: %s..%s (%s patch(es))\n' "$old_base" "$old_tip" "$(git rev-list --count "${old_base}..${old_tip}")"
    printf 'New series: %s..%s (%s patch(es))\n' "$new_base" "$new_tip" "$(git rev-list --count "${new_base}..${new_tip}")"
    if ! git diff --check "${new_base}..${new_tip}"; then
      echo "New patch series contains whitespace errors." >&2
      exit 1
    fi
    printf 'New-series whitespace: clean\n\n'
    printf 'Range-diff (review required):\n'
    git range-diff "${old_base}..${old_tip}" "${new_base}..${new_tip}"
    ;;

  -h|--help)
    usage
    ;;

  *)
    echo "Unknown mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac

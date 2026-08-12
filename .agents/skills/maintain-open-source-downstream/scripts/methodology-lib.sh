#!/usr/bin/env bash

METHODOLOGY_NAME="maintain-open-source-downstream"
SYNC_UPSTREAM_ROOT=".trellis/sync-upstream"
SYNC_UPSTREAM_CONTRACT="$SYNC_UPSTREAM_ROOT/contract.yaml"
SYNC_UPSTREAM_INVARIANTS="$SYNC_UPSTREAM_ROOT/invariants.md"
SYNC_UPSTREAM_VALIDATION="$SYNC_UPSTREAM_ROOT/validation.md"
SYNC_UPSTREAM_DECISIONS="$SYNC_UPSTREAM_ROOT/decisions"

methodology_source_version() {
  local source_skill_dir="$1"
  local skill_file="$source_skill_dir/SKILL.md"
  [[ -f "$skill_file" ]] || {
    echo "Missing source skill: $skill_file" >&2
    return 1
  }

  awk '
    $0 == "metadata:" { in_metadata = 1; next }
    in_metadata && /^[^[:space:]]/ { exit }
    in_metadata && $1 == "version:" {
      $1 = ""
      sub(/^[[:space:]]+/, "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' "$skill_file"
}

methodology_require_trellis() {
  local root="$1"
  if [[ ! -d "$root/.trellis" || -L "$root/.trellis" ||
    ! -f "$root/.trellis/workflow.md" || ! -d "$root/.trellis/tasks" ]]; then
    echo "This command requires an initialized Trellis project: $root/.trellis" >&2
    return 1
  fi
}

methodology_contract_path() {
  local root="$1"
  printf '%s/%s\n' "${root%/}" "$SYNC_UPSTREAM_CONTRACT"
}

methodology_contract_value() {
  local key="$1"
  local contract="${2:-$SYNC_UPSTREAM_CONTRACT}"
  [[ -f "$contract" ]] || return 0

  awk -v key="$key" '
    $1 == key ":" {
      $1 = ""
      sub(/^[[:space:]]+/, "")
      if (substr($0, 1, 1) == "\"" && substr($0, length($0), 1) == "\"") {
        print substr($0, 2, length($0) - 2)
      } else {
        sub(/[[:space:]]+#.*$/, "")
        print
      }
      exit
    }
  ' "$contract"
}

methodology_sanitize_url() {
  local url="$1"
  url="${url%%\?*}"
  url="${url%%#*}"
  printf '%s\n' "$url" | sed -E \
    -e 's#^([[:alpha:]][[:alnum:]+.-]*://)[^/@]+@#\1#' \
    -e 's#^[^/:@]+:[^@]+@##' \
    -e 's#^[^/@]+@##' \
    -e 's#\.git/?$##' \
    -e 's#/$##'
}

methodology_url_has_credentials() {
  local url="$1"
  url="${url%%\?*}"
  url="${url%%#*}"
  [[ "$url" =~ ^[[:alpha:]][[:alnum:]+.-]*://[^/@]+@ ]] ||
    [[ "$url" =~ ^[^/:@]+:[^@]+@ ]] ||
    [[ "$url" =~ ^[^/@]+@[^/:]+: ]]
}

methodology_contract_root_is_safe() {
  local root="$1"
  local contract_root="$root/$SYNC_UPSTREAM_ROOT"
  [[ -d "$contract_root" && ! -L "$contract_root" &&
    -d "$contract_root/decisions" && ! -L "$contract_root/decisions" &&
    -f "$contract_root/contract.yaml" && ! -L "$contract_root/contract.yaml" &&
    -f "$contract_root/invariants.md" && ! -L "$contract_root/invariants.md" &&
    -f "$contract_root/validation.md" && ! -L "$contract_root/validation.md" &&
    -f "$contract_root/decisions/README.md" &&
    ! -L "$contract_root/decisions/README.md" ]]
}

methodology_escape_sed() {
  printf '%s' "$1" | sed -e 's/[\\&|]/\\&/g'
}

methodology_safe_relative_path() {
  local path="$1"
  [[ -n "$path" && "$path" != /* && "$path" != "." && "$path" != ".." && \
    "$path" != ../* && "$path" != */../* && "$path" != */.. && "$path" != *$'\n'* ]]
}

methodology_safe_contract_path() {
  local path="$1"
  methodology_safe_relative_path "$path" && \
    [[ "$path" == "$SYNC_UPSTREAM_ROOT" || "$path" == "$SYNC_UPSTREAM_ROOT"/* ]]
}

methodology_validate_yaml_scalar() {
  local value="$1"
  local printable
  printable="$(printf '%s' "$value" | LC_ALL=C tr -d '\001-\010\013\014\016-\037\177')"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* &&
    "$value" == "$printable" && "$value" != *'"'* && "$value" != *'\\'* ]]
}

methodology_count_lines() {
  local value="$1"
  if [[ -z "$value" ]]; then
    printf '0\n'
  else
    printf '%s\n' "$value" | wc -l | tr -d '[:space:]'
  fi
}

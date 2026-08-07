#!/usr/bin/env bash
#
# Clears selected frontend and backend build caches.
#
# Frontend: Next.js `.next` (Turbopack cache lives in `.next/cache`), the `out`
# export dir, and the generated PWA service-worker files.
# Backend: the workspace-local crates in `target/` plus the Tauri codegen output
# in `src-tauri/gen/schemas` (capability ACL is baked in at compile time, so a
# stale schema silently keeps old permissions around).
#
# Third-party Rust dependencies are deliberately NOT cleaned: recompiling them
# takes several minutes and they are not what goes stale during development.
# With no target, both frontend and backend caches are cleared. Pass `fd` or
# `bd` to select one side. Pass `--deep` with `bd` (or no target) to wipe the
# whole `target/` dir.

set -euo pipefail

TARGET="all"
TARGET_SET=0
DEEP=0
for arg in "$@"; do
  case "$arg" in
    fd | bd)
      if [ "$TARGET_SET" -eq 1 ]; then
        echo "Only one clean target may be specified." >&2
        echo "Usage: $0 [fd|bd] [--deep]" >&2
        exit 1
      fi
      TARGET="$arg"
      TARGET_SET=1
      ;;
    --deep)
      if [ "$DEEP" -eq 1 ]; then
        echo "The --deep option may only be specified once." >&2
        echo "Usage: $0 [fd|bd] [--deep]" >&2
        exit 1
      fi
      DEEP=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [fd|bd] [--deep]" >&2
      exit 1
      ;;
  esac
done

if [ "$TARGET" = "fd" ] && [ "$DEEP" -eq 1 ]; then
  echo "The --deep option is only valid when cleaning backend caches." >&2
  echo "Usage: $0 [fd|bd] [--deep]" >&2
  exit 1
fi

# Resolve paths relative to this script so the cwd does not matter.
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$APP_DIR/../.." && pwd)"

if [ "$TARGET" != "bd" ]; then
  echo "==> Cleaning frontend cache"
  rm -rf "$APP_DIR/.next" "$APP_DIR/out"
  rm -f "$APP_DIR"/public/sw.js \
    "$APP_DIR"/public/workbox-*.js \
    "$APP_DIR"/public/fallback-*.js \
    "$APP_DIR"/public/swe-worker-*.js
fi

if [ "$TARGET" != "fd" ]; then
  echo "==> Cleaning Tauri codegen output"
  rm -rf "$APP_DIR/src-tauri/gen/schemas"

  echo "==> Cleaning backend cache"
  cd "$REPO_ROOT"
  if [ "$DEEP" -eq 1 ]; then
    echo "    (--deep: removing all of target/, dependencies will be rebuilt)"
    cargo clean
  else
    # Only the crates we actually edit. `cargo clean -p` on a missing package is
    # an error, so filter the list through what the workspace really contains.
    packages="$(cargo metadata --no-deps --format-version 1 |
      python3 -c 'import json,sys; print("\n".join(p["name"] for p in json.load(sys.stdin)["packages"]))')"

    while IFS= read -r pkg; do
      [ -n "$pkg" ] || continue
      cargo clean -p "$pkg"
    done <<<"$packages"
  fi
fi

echo "==> Cache cleared"

#!/bin/bash
# 从 Icon Composer 源资产 (new_logo/OpenReadest.icon) 重新生成 macOS Assets.car。
#
# 使用与 Tauri 上游 Liquid Glass 图标支持 (tauri-apps/tauri commit 8254e5af)
# 完全一致的 actool 参数，确保未来切换到官方支持时行为不变。
#
# 需要 macOS + Xcode (actool)。编译结果提交到:
#   src-tauri/resources/macos/Assets.car
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ICON_SRC="$ROOT/new_logo/OpenReadest.icon"
OUT_DIR="$ROOT/apps/openreadest-app/src-tauri/resources/macos"
TMP_OUT="$(mktemp -d)"
trap 'rm -rf "$TMP_OUT"' EXIT

if ! xcrun --find actool >/dev/null 2>&1; then
  echo "错误: 找不到 actool (需要 macOS + Xcode)" >&2
  exit 1
fi

if [ ! -d "$ICON_SRC" ]; then
  echo "错误: 源图标不存在: $ICON_SRC" >&2
  exit 1
fi

xcrun actool "$ICON_SRC" \
  --compile "$TMP_OUT" \
  --output-format human-readable-text \
  --notices \
  --warnings \
  --output-partial-info-plist "$TMP_OUT/assetcatalog_generated_info.plist" \
  --app-icon Icon \
  --include-all-app-icons \
  --accent-color AccentColor \
  --enable-on-demand-resources NO \
  --development-region en \
  --target-device mac \
  --minimum-deployment-target 26.0 \
  --platform macosx

if [ ! -f "$TMP_OUT/Assets.car" ]; then
  echo "错误: actool 未生成 Assets.car" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
cp "$TMP_OUT/Assets.car" "$OUT_DIR/Assets.car"

# 校验图标名与 Info.plist 中的 CFBundleIconName 一致
ICON_NAME="$(xcrun assetutil --info "$OUT_DIR/Assets.car" 2>/dev/null | \
  python3 -c 'import json,sys
data = json.load(sys.stdin)
names = {a.get("Name") for a in data if a.get("AssetType") == "Icon Image"}
print(next(iter(names), "") if len(names) == 1 else "")')"

echo "已生成: $OUT_DIR/Assets.car (图标名: ${ICON_NAME:-<未知>})"
if [ -n "$ICON_NAME" ]; then
  grep -q "\"$ICON_NAME\"" "$ROOT/apps/openreadest-app/src-tauri/Info.plist" && \
    echo "Info.plist 的 CFBundleIconName 与 car 图标名一致: $ICON_NAME"
fi

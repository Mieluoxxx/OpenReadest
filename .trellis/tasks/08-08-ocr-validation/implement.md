# OCR 验收矩阵执行清单

## 步骤

1. 逐条执行 parent §8.1 十一项验收，逐项记录证据（命令输出 / 截图 / 测试结果）。
2. 回归矩阵：纯扫描 / 混合文本 / 正常文本 PDF 对比；缩放/旋转样例。
3. 桌面三平台冒烟：模型下载 + 识别 + 全书搜索。
4. 回滚点验证：移除 `.plugin(tauri_plugin_ocr::init())` + capabilities 后原路径零回归；`pdf.js` revert 验证。

## 验证命令

```bash
cd apps/openreadest-app && pnpm clippy && cargo test -p openreadest
pnpm --filter openreadest-app lint && pnpm --filter openreadest-app test
pnpm --filter openreadest-app build
# 三平台冒烟按 §7.2 执行
```

## 出口

- 验收结果记录（evidence/ 或任务目录）。
- 未通过项列为缺陷进入修复循环；全部通过后归档。

# OCR 验收矩阵与回归回滚

## Goal

对 OCR 扫描件集成做最终验收：跑通 parent §8.1 十一项验收，覆盖混合文本/纯扫描/正常文本 PDF 回归，验证桌面三平台冒烟与回滚点。

## Requirements

- 逐条跑通 parent 验收：构建/ACL、主页主流程、跳过内嵌页 + 断点续跑、**混合文本 PDF 搜索**、阅读器兜底、正常文本 PDF 零回归、缩放/旋转保持、取消/超时/队列满、模型切换 stale、逐页缓存、退出协议。
- 回归：纯扫描 / 混合文本 / 正常文本 PDF 对比；缩放/旋转样例。
- 桌面三平台冒烟（macOS/Windows/Linux）：模型下载 + 识别 + 全书搜索。
- 回滚点验证：插件整体开关（移除 `.plugin(tauri_plugin_ocr::init())` + capabilities）、`pdf.js` 单文件 revert 后原 PDF 渲染/搜索不受影响。

## Acceptance Criteria

- [ ] parent §8.1 十一项验收全部通过（或逐项记录证据）。
- [ ] 三平台冒烟通过。
- [ ] 回滚点验证通过（禁用 OCR 后原路径零回归）。
- [ ] 测试/ lint / type / build 通过；无回归。

## Out of scope

- 新功能开发（验收阶段只验证）。
- 移动端验证（二期）。

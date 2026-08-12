# pdf.js OCR 覆盖层（ocrProvider/TextLayer 注入/缩放保持）

## Goal

在 `packages/foliate-js/pdf.js` 增加 book 实例级 `ocrProvider` 扩展点，扫描页离屏渲染 + toBlob → provider，识别文本以完整 synthetic TextContent 注入 TextLayer，缩放/重渲染覆盖层保持。

## Requirements

- `makePDF(file, { ocrProvider } = {})`：provider 由宿主注入、闭包绑定 docId（**不用模块级全局变量**）。
- 扫描页检测：`streamTextContent()` 无非空 items 且 `.textLayer` 无 span → 触发 OCR；正常文本 PDF 走原路径。
- 离屏渲染：OCR viewport（scale 约 200 DPI、rotation）→ `toBlob('image/png')` → provider。
- **synthetic TextContent**：完整 `items/styles/lang/fontName/dir/hasEOL` 结构；`styles[fontName]` 必须存在（pdfjs 会解引用）；`fontSize` 由 transform+style 推导。失败则退回手工绝对定位 span。
- 坐标换算：OCR 像素四角点 `viewport.convertToPdfPoint` → PDF 用户空间 → 基线 transform。
- 内存缓存 `pageNumber → lines`：缩放重渲染直接复用，不重新触发 OCR；内存未命中走 `ocr_get_cached_page`。
- 不感知 Tauri/React/文件；DOM 注入全部收敛在 pdf.js 内。

## Acceptance Criteria

- [ ] 正常文本 PDF 零回归（不触发 OCR、覆盖层不出现）。
- [ ] 扫描页覆盖层出现，文本可选中/复制。
- [ ] 缩放/重渲染覆盖层保持且不重复识别。
- [ ] TextContent 注入稳定（或退回方案验证通过）。
- [ ] 旋转页坐标换算正确（viewport 逆变换，非 `ocr_pixel/scale` 近似）。

## Out of scope

- 搜索文档构建 / `createDocument`（`ocr-search`）。
- Rust 插件与识别调度（`ocr-rust-plugin`）。
- 阅读器 provider 注册与状态机（`ocr-reader-on-demand`）。

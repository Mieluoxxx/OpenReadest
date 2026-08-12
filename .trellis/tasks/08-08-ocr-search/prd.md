# OCR 搜索集成（createDocument/混合页文本/CFI）

## Goal

让扫描 PDF（含混合文本 PDF）支持**全书搜索**：给 PDF sections 补 `createDocument`，按页选择原生 `getTextContent()` 或 OCR 缓存注入，并验证/接入 CFI 往返。

## Requirements

- `buildPdfTextDocument(pageIndex)`：`section.load()` → fetch → DOMParser → doc 骨架 → 按页选文本来源。
- 原生文本页：`page.getTextContent()` 非空 → 注入 `.textLayer`（共享 `injectTextContent`）。
- OCR 页：`ocr_get_cached_page` 只读缓存 → 注入；无缓存 → 空 doc（本页不可搜，符合边界）。
- PDF sections 补 `createDocument`；页已渲染时短路返回活文档。
- 渲染活文档与搜索文档共用同一注入函数与缓存 ⇒ `getCFI`/`CFI.toRange` 往返可解析回活文档。
- **CFI 门禁**：不可靠时 `{pageIndex,lineIndex,offsets}` 为独立实现路径（改 `view.js` 搜索/annotation、`BookSearchMatch`、搜索 UI、导航高亮），单独排期，一期不临时混入。

## Acceptance Criteria

- [ ] **混合文本 PDF**：原生页与 OCR 页都能被全书搜索命中。
- [ ] 全书搜索对所有已识别页命中；未识别页明确不可搜（符合承诺边界）。
- [ ] CFI 往返可靠时，搜索结果高亮/跳转正确解析回活文档。
- [ ] 正常文本 PDF 原搜索行为零回归。

## Out of scope

- 覆盖层渲染注入（`ocr-pdfjs-overlay`）。
- Rust 缓存实现（`ocr-rust-plugin`）。
- 自定义定位独立路径的排期（若 CFI 门禁失败，单独立项）。

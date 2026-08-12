# OCR 搜索集成实现清单

## 步骤

1. 定义共享 `injectTextContent(doc, textContent)`：把完整 `TextContent`（或 synthetic 结构）渲染进 `.textLayer`。
2. `buildPdfTextDocument(pageIndex)`：
   - `src = await section.load()` → `fetch(src)` → `DOMParser` → doc 骨架；
   - `textContent = await page.getTextContent()`：有非空 items → 原生注入；
   - 无原生文本 → `ocr_get_cached_page` 读缓存 → 注入；无缓存 → 空 doc。
3. PDF sections 补 `createDocument = () => buildPdfTextDocument(pageIndex)`；页已渲染时短路返回活文档。
4. CFI 往返验证：`getCFI(index, range)` / `CFI.toRange(doc, parts)` 在 OCR 页 + 混合页可往返。
5. 若 CFI 门禁失败：将 `{pageIndex,lineIndex,offsets}` 独立路径写成设计文档排期（不在本任务内实现）。

## 验证

- 混合文本 PDF 全书搜索命中（原生页 + OCR 页）。
- 搜索结果高亮/跳转解析回活文档；正常文本 PDF 原搜索零回归。
- 单测：搜索文档构建（原生/OCR/空三种分支）。

## 出口

- 全书搜索可用；CFI 往返结论明确（可靠 → 接入；不可靠 → 独立路径文档）。

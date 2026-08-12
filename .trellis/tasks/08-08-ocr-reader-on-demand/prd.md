# 阅读器 OcrService（按需识别/状态机/Fingerprint 判定）

## Goal

在阅读器侧实现 `OcrService`：打开书时向 `makePDF` 注入绑定 docId 的 provider，页级状态机管理按需识别，Fingerprint-aware 判定 OCR'd 书，模型未就绪时引导下载。

## Requirements

- 打开书时向 `makePDF` 注入 `{ocrProvider}`（多书/平行视图互不干扰）。
- provider 内：`ocr_recognize` → 判别联合响应；`ocr_get_cached_page` 用于覆盖层重建。
- 页级状态机：`idle | pending | recognizing | done | failed | cancelled`；翻页取消过期页。
- **OCR'd 判定（Fingerprint-aware）**：查设备本地 `OcrBookStatus`——当前模型 fingerprint 下 `completedPages === scanPages` 才算 OCR'd，渲染直接走缓存，无按需识别；否则按需识别。
- `model_not_ready` → 引导去设置页下载；`queue_full/timeout/failed` → 轻量状态可重试。

## Acceptance Criteria

- [ ] 未预 OCR 扫描 PDF 当前页按需 OCR，覆盖层出现、页内搜索可用。
- [ ] OCR'd 书打开后走缓存不重复识别。
- [ ] 切换模型后旧记录失效，自动回落到按需识别。
- [ ] 快速翻页不堆积无效任务（过期页取消）。
- [ ] 模型未就绪时引导下载不崩溃。

## Out of scope

- 插件/调度实现（`ocr-rust-plugin`）。
- 覆盖层注入（`ocr-pdfjs-overlay`）。
- 书架批量入口与 UI（`ocr-batch-entry`）。

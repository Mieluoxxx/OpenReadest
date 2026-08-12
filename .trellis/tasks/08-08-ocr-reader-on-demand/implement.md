# 阅读器 OcrService 实现清单

## 步骤

1. 新增 `OcrService`：持有 provider（闭包绑定 docId）、页级状态映射、过期任务取消。
2. 打开书时向 `makePDF` 注入 `{ocrProvider}`（`readerStore` 加载路径）。
3. provider 内：`ocr_recognize` → 判别联合响应；`ocr_get_cached_page` 用于覆盖层重建。
4. 页级状态机 `idle|pending|recognizing|done|failed|cancelled`；翻页/离开书取消过期页 taskId。
5. OCR'd 判定：查设备本地 `OcrBookStatus`——当前 fingerprint 下 `completedPages === scanPages` → 走缓存；否则按需识别。
6. `model_not_ready` → 引导去设置页下载；`queue_full/timeout/failed` → 轻量状态可重试。

## 验证

- 未预 OCR 扫描 PDF 当前页按需 OCR；OCR'd 书走缓存不重复识别。
- 切换模型后回落按需识别；快速翻页不堆积任务。
- 单测：provider 注册、状态机、Fingerprint 判定、过期取消。

## 出口

- 阅读器兜底流程可用；Fingerprint-aware 判定正确。

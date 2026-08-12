# 书架批量入口（OcrBatchService/设置与任务 UI）

## Goal

主页书架右键"OCR 扫描件"批量入口 + `OcrBatchService`（单页并发、预扫、显式页面图像生成、暂停/继续、Fingerprint 完成记录）+ 设置页"OCR 识别"与统一任务面板。

## Requirements

- `BookshelfItem.tsx` 右键追加"OCR 扫描件"（**`book.format === 'PDF'`，全大写**），文案随状态变化。
- **OcrBatchService**：单页并发（一次一页、完成后再提交）；预扫 `page.getTextContent()` 跳原生文本页；显式页面图像生成（OCR viewport 渲染 → toBlob PNG → invoke → 清空 canvas 释放 page）。
- 进度事件 `ocr://book-progress {docId,done,total,phase}`。
- **暂停/继续一期语义**：暂停 = 停止提交 + `ocr_batch_cancel`；续跑靠逐页缓存。不做快照恢复。
- 完成写设备本地 `OcrBookStatus`（**不同步云端**）。
- 设置页"OCR 识别"（模型状态/下载/切换、缓存清理按书/全部 + 磁盘占用）+ 统一任务面板（进度/失败原因/继续/取消）。

## Acceptance Criteria

- [ ] 书架右键菜单对 PDF 书显示"OCR 扫描件"（非 PDF 不显示）。
- [ ] 批量任务进度可见、可取消、断网可恢复、断点续跑只处理未识别页。
- [ ] 批量任务跳过原生文本页；单页并发不阻塞阅读器。
- [ ] 暂停/继续符合一期语义；完成后书标记 OCR'd。
- [ ] 设置页与任务面板可用；缓存清理生效。

## Out of scope

- 阅读器按需识别（`ocr-reader-on-demand`）。
- 插件/调度（`ocr-rust-plugin`）。
- 移动端选择模式等价入口（二期）。

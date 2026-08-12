# 书架批量入口实现清单

## 步骤

1. `BookshelfItem.tsx` 右键追加"OCR 扫描件"（`book.format === 'PDF'`），文案随状态（OCR 扫描件 / OCR 进度 42% / 重新 OCR）。
2. `OcrBatchService`：
   - 预扫：`page.getTextContent()` 判原生文本页（跳过）；
   - 页面图像生成：OCR viewport 渲染 → `toBlob('image/png')` → invoke → 清空 canvas 释放 page；
   - 单页并发（一次一页、完成后提交下一页）；
   - 进度 `ocr://book-progress`。
3. 暂停/继续一期语义：暂停 = 停止提交 + `ocr_batch_cancel`；续跑靠逐页缓存。
4. 完成写设备本地 `OcrBookStatus`（不同步云端）。
5. 设置页"OCR 识别"（模型管理 + 缓存清理）+ 统一任务面板。

## 验证

- 右键菜单仅对 PDF 显示；批量进度/取消/断网恢复/断点续跑正确。
- 单页并发不阻塞阅读器；暂停/继续符合一期语义。
- 设置页与任务面板可用。

## 出口

- 主页主流程（右键 → OCR → OCR'd → 打开可搜）可用。

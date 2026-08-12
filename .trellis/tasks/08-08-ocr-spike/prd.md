# RapidOCR Spike 验证（构建/IPC/TextContent/CFI/模型安装/混合样本）

## Goal

在正式开发前，对 `rapidocr-core 0.2.2` 与 pdf.js 集成路径做构建级验证，产出可执行的结论，作为后续所有子任务的阻塞门禁。

## Requirements

- 构建 rapidocr-core v0.2.2（**禁用默认 feature，仅启用 `tokio`**），验证 `TokioRapidOcr::new/new_with_queue_capacity`、`run_image_with_timeout`、`shutdown(self).await`、`OcrTask::cancel/cancel_and_wait`、`ModelCache`、`model_set_by_name`。
- **IPC 三方案实测**：① `Uint8Array` 原始字节（Tauri invoke 实际编码）；② 临时文件路径；③ base64。按"原始字节 → 临时文件 → base64"优先级定案。
- **synthetic TextContent 注入**：完整 `items/styles/lang/fontName/dir/hasEOL` 结构在锁定 pdfjs-dist 5.x 二次渲染的稳定性；失败则验证退回方案（手工绝对定位 span）。
- **CFI 往返门禁**：搜索文档生成的 CFI 在活文档 `CFI.toRange` 可解析回 Range（含 OCR 页）。
- 队列容量/取消 API：容量 1 下批量与交互请求的取消行为、幂等性。
- **目录级模型原子安装**：临时目录整体校验后 rename 的可行性。
- **混合文本 PDF 样例**：原生文本页 + OCR 页混合的搜索文档构建验证。

## Acceptance Criteria

- [ ] rapidocr-core v0.2.2 在桌面三平台目标可构建并跑通识别冒烟。
- [ ] IPC 三方案结论记录：选定方案 + 数据量/内存/延迟实测。
- [ ] TextContent 注入在 pdfjs-dist 5.x 稳定工作（或退回方案验证通过）。
- [ ] **CFI 往返门禁有结论**：可靠 → 走 CFI；不可靠 → `{pageIndex,lineIndex,offsets}` 独立路径排期。
- [ ] 取消/队列 API 行为记录（含 worker 协作式收尾语义）。
- [ ] 目录级原子安装协议验证通过。
- [ ] 混合文本 PDF 搜索文档构建样例通过。
- [ ] 全部验证项记录到 `research/`，阻塞项有明确结论。

## Out of scope

- 正式插件实现（属 `ocr-rust-plugin`）、覆盖层实现（属 `ocr-pdfjs-overlay`）。
- 移动端 ONNX Runtime 交叉编译（二期）。

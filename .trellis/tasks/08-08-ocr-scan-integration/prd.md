# OCR 扫描件集成（RapidOCR + 阅读器覆盖层 + 搜索）

## Goal

为 OpenReadest 桌面端（macOS/Windows/Linux）集成 RapidOCR 扫描件识别能力：主页书架"OCR 扫描件"批量入口 + 阅读器当前页按需 OCR 兜底，识别文本以真实 DOM 文本节点注入 PDF 页面文档，复用现有选中/复制/标注/TTS，并让扫描 PDF 支持**全书搜索**。

## Confirmed facts

- 引擎为 Rust 侧 `rapidocr-core 0.2.2`（feature `tokio`），API 已对发布包源码核验存在：`TokioRapidOcr::new/new_with_queue_capacity`、`run_image_with_timeout`、`shutdown(self).await`（消费式）、`OcrTask::cancel/cancel_and_wait/timeout`、`ModelCache`、`model_set_by_name`、`OcrCancellationToken`。默认 feature 含 `model-download`（reqwest），应用自带 manifest 时禁用默认 feature 仅启用 `tokio`。
- `packages/foliate-js/pdf.js` 的 PDF sections 只有 `load`（返回页面 blob URL），**没有 `createDocument`**——全书搜索静默跳过所有 PDF 页，section 作用域搜索直接报错（`view.js` 的 `#searchBook`/`#searchSection` 依赖 `sections[].createDocument`）。
- `DocumentLoader` 只持有 `File`；`NativeFile` 的真实路径是私有字段 `#fp`。`ocr_register_doc` 不能只接受绝对路径，需 source 判别联合（path | file 分块流）。
- 书架右键入口挂载点为 `BookshelfItem.tsx` 的 `bookContextMenuHandler`（`@tauri-apps/api/menu` 的 `MenuItem.new()`）；**`BookFormat` 为全大写 `'PDF'`**，菜单条件必须写 `book.format === 'PDF'`。
- Tauri 应用 `.run()` 回调是**同步闭包**（`src-tauri/src/lib.rs`），异步 shutdown 必须在 `ExitRequested` 阻止退出后 spawn。
- `Book` 类型与 `transformBookToDB/FromDB` 目前无 OCR 字段；OCR 完成状态设计为设备本地 `OcrBookStatus`，不同步云端。
- pdfjs-dist 锁定 `5.x`；`TextLayer` 会直接解引用 `styles[fontName]`（`vendor/pdfjs/pdf.mjs`），synthetic TextContent 必须补全 `items/styles/lang/fontName/dir/hasEOL`。

## Requirements

### R1. Spike 验证（阻塞门禁）

构建 rapidocr-core v0.2.2（禁用默认 feature 仅 tokio）；实测 IPC 三方案（原始字节优先）；synthetic TextContent 注入在 pdfjs-dist 5.x 的稳定性；**CFI 往返门禁**（搜索文档 ↔ 渲染文档）；队列容量/取消 API；目录级模型原子安装；混合文本 PDF 样例。

### R2. tauri-plugin-ocr Rust 插件

doc 注册（source 联合 + 流式 SHA-256）、识别命令（判别联合响应）、交互优先/批量受限双队列调度、逐页原子缓存、`OcrBookStatus` Fingerprint 完成记录、模型管理（manifest + 目录级原子安装 + 切换）、按 batch 取消（`ocr_batch_cancel`）、`ExitRequested` 异步退出协议。

### R3. pdf.js OCR 覆盖层

book 实例级 `ocrProvider` 扩展点（闭包绑定 docId）、扫描页检测、离屏渲染 + toBlob、synthetic TextContent → TextLayer 注入、缩放/重渲染覆盖层保持。

### R4. 搜索集成

`createDocument`/`buildPdfTextDocument` 按页选择原生 `getTextContent()` 或 OCR 缓存（**混合文本 PDF 可搜**）；CFI 往返可靠时走 CFI；不可靠时 `{pageIndex,lineIndex,offsets}` 为独立实现路径，一期不得临时混入降级。

### R5. 阅读器 OcrService

打开书时向 `makePDF` 注入 provider；页级状态机 `idle|pending|recognizing|done|failed|cancelled`；Fingerprint-aware 的 OCR'd 判定（`completedPages === scanPages`）；按需识别兜底与模型未就绪引导。

### R6. 书架批量入口 + UI

`BookshelfItem` 右键"OCR 扫描件"（`book.format === 'PDF'`）；`OcrBatchService`（单页并发、预扫跳原生文本页、显式页面图像生成流程、暂停/继续一期语义、`ocr_batch_cancel`）；设置页"OCR 识别"（模型管理 + 缓存清理）+ 统一任务面板。

### R7. 验收与回归

桌面三平台构建与 ACL；主页主流程、混合文本 PDF 搜索、阅读器兜底、正常文本 PDF 零回归、缩放/旋转保持、取消/超时/队列满、模型切换 stale、逐页缓存、退出协议 11 项验收；Rust/前端/调度器测试与混合样本回归。

## Acceptance Criteria

- [ ] 桌面三平台构建通过，`tauri-plugin-ocr` 注册与 `ocr:default` ACL 生效。
- [ ] 书架右键扫描 PDF → "OCR 扫描件" → 进度/取消/断网恢复正常 → 完成后书标记 OCR'd → 打开后文本可选中、复制，**全书搜索命中**。
- [ ] 批量任务跳过内嵌文本页；断点续跑只处理未识别页；**批量取消不影响阅读器正在识别的页**。
- [ ] **混合文本 PDF**：原生文本页与 OCR 页都能被全书搜索命中。
- [ ] 阅读器兜底：未预 OCR 扫描 PDF 当前页按需 OCR，覆盖层出现、页内搜索可用。
- [ ] 正常文本 PDF 零回归：不触发 OCR、覆盖层不出现、原选择/搜索不变。
- [ ] 缩放/旋转后覆盖层保持（内存/缓存命中，不重复识别）。
- [ ] 模型管理：首次引导下载、断网可重试、切换后完成记录变 stale、切换期间请求状态正确。
- [ ] 逐页缓存：关闭重开书后命中（`cached:true`），不重复识别。
- [ ] 退出协议：退出时批量任务被取消、worker 在 5 s 内收尾、应用不悬挂。
- [ ] 全部 `ocr-spike` 阻塞门禁（CFI 往返、IPC 传输、TextContent 注入、模型原子安装）有结论，决定后续实现分支。

## Out of scope

- 移动端（Android/iOS）ONNX Runtime 交叉编译——二期。
- Windows DirectML GPU 加速、旋转文本行像素级对齐——二期。
- 场景 B（通用图片 OCR / 批注图 OCR）。
- 导出"带文本层的新 PDF / 可编辑文本"——三期（产品确认）。
- 自动缓存淘汰策略——二期；一期仅手动清理。

## Child task map and dependencies

1. `08-08-ocr-spike`：API 构建、IPC、TextContent、CFI 门禁、模型安装、混合样本。**无依赖，先行**。
2. `08-08-ocr-rust-plugin`：Rust 插件全量（注册/识别/调度/缓存/模型/取消/退出）。依赖 1。
3. `08-08-ocr-pdfjs-overlay`：pdf.js ocrProvider + TextLayer 注入 + 缩放保持。依赖 1（TextContent 门禁结论）。
4. `08-08-ocr-search`：createDocument/混合页文本/CFI。依赖 2、3。
5. `08-08-ocr-reader-on-demand`：OcrService 按需识别 + 状态机 + Fingerprint 判定。依赖 2、3。
6. `08-08-ocr-batch-entry`：书架入口 + OcrBatchService + 设置/任务 UI。依赖 2、5。
7. `08-08-ocr-validation`：验收矩阵 + 回归 + 回滚。依赖 1–6。

## Key decisions

- 一期平台范围：**桌面**（macOS/Windows/Linux），移动端二期。
- 默认模型：**`ppocrv5-ch-mobile`**（中文优先），`ppocrv6-small` 可切换（最终真实样本对比后微调）。
- 批量并发：**单页**；底层 `TokioRapidOcr` 队列容量 **1**；页级超时 30 s。
- 取消范围：`ocr_batch_cancel`（仅 batch 任务），**不使用全局 `ocr_cancel_all`**。
- IPC 传输优先级：原始字节 → 临时文件 → base64（spike 实测定案）。
- TextLayer 路线：完整 synthetic TextContent（含 styles/lang/fontName）优先；手工 span 仅退回。
- 搜索来源：`createDocument` 按页选择原生 `getTextContent()` 或 OCR 缓存（混合 PDF 可搜）。
- 完成状态：设备本地 `OcrBookStatus { docId, fingerprint, completedPages, scanPages }`，Fingerprint-aware，**不同步云端**。
- 模型安装：**目录级原子安装**（临时目录整体校验后 rename）。
- 退出协议：`ExitRequested` 阻止退出 → 异步 shutdown（5 s 超时）→ 重新退出。
- 暂停/继续一期语义：仅"停止提交 + 取消本 batch"，续跑靠逐页缓存；不做任务快照恢复。
- parent 与全部 child 保持 `planning`，直到最终规划汇总被明确批准后才 `task.py start`。

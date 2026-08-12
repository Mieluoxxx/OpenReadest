# tauri-plugin-ocr Rust 插件

## Goal

实现 `src-tauri/plugins/tauri-plugin-ocr`：doc 注册、识别命令、交互优先/批量受限调度、逐页缓存、Fingerprint 完成记录、模型管理、按 batch 取消与异步退出协议，暴露给前端的完整命令面。

## Requirements

- 插件骨架：`Cargo.toml/build.rs/permissions（ocr:default）`，在 `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` 注册 `.plugin(tauri_plugin_ocr::init())`。
- `ocr_register_doc({source})`：source 判别联合（`{kind:'path',path}` | `{kind:'file',file,size}`），流式完整 SHA-256 作 docId，持久化映射。
- `ocr_recognize`：判别联合响应（`{status:'ok',cached,lines}` | `{status:'error…',error}`）；先查缓存命中 `cached:true`；输入上限（编码字节/解码宽高/总像素）。
- `ocr_get_cached_page`：只读缓存查询，绝不触发识别。
- **OcrScheduler**：交互队列优先、批量受限（并发 ≤ 1）；底层 `TokioRapidOcr` 队列容量 1。
- **OcrCache**：`ocr-cache/<docId>/<fingerprint>/<page>.json` 逐页原子写（临时文件 + rename）。
- **OcrBookStatus**：`{docId,fingerprint,completedPages,scanPages,status}` 设备本地持久化。
- **ModelManager**：固定 manifest、目录级原子安装、`ocr_set_model` 切换（取消+drain→重建→原子 swap）、状态机、`model_not_ready`。
- **取消**：`ocr_cancel(taskId)` 幂等；`ocr_batch_cancel(batchId)` 仅取消 batch 登记的 taskId 集合。**不用全局 `ocr_cancel_all`**。
- **退出协议**：`ExitRequested` 阻止退出 → spawn 异步 shutdown（5 s 超时）→ 重新退出。
- Rust 单测：解码→识别→坐标换算、batch 取消范围、模型目录原子安装。

## Acceptance Criteria

- [ ] 插件注册与 `ocr:default` ACL 生效。
- [ ] 全部命令可调用，判别联合响应正确（含 timeout/queue_full/model_not_ready/invalid_input）。
- [ ] 批量取消不影响交互任务；重复取消幂等。
- [ ] 逐页缓存原子写、模型切换后完成记录变 stale。
- [ ] 退出时 worker 在 5 s 内收尾、应用不悬挂。
- [ ] Rust 单测通过；`pnpm clippy` 无警告。

## Out of scope

- pdf.js 覆盖层 / provider 注入（`ocr-pdfjs-overlay`）。
- 前端批量调度与 UI（`ocr-batch-entry`）。
- 阅读器按需识别状态机（`ocr-reader-on-demand`）。

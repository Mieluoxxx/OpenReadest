# OCR 扫描件集成技术设计

Date: 2026-08-08
Status: Planning
依据：`apps/openreadest-app/docs/ocr-design.md`（v3，决策基线已定案）

## 1. 架构与边界

```text
书架（主页）                     阅读器
BookshelfItem 右键          FoliateViewer ── makePDF(file, { ocrProvider })
   │                              │
OcrBatchService               foliate-js/pdf.js
  （单页并发/预扫/进度/         render() → 扫描页检测 → 离屏渲染 → provider
    Fingerprint 完成记录）         → TextContent 注入 → TextLayer 二次渲染
   │                              │
   └──────────────┬─ invoke ──────┘
                  ▼
src-tauri/plugins/tauri-plugin-ocr (Rust)
  ModelManager（manifest + 目录级原子安装 + 切换）
  OcrCache（逐页原子写 ocr-cache/<docId>/<fp>/<page>.json）
  OcrScheduler（交互优先 / 批量受限双队列）
  TokioRapidOcr（rapidocr-core + tokio，单 worker + 有界队列容量 1）
  状态：RwLock<Option<TokioRapidOcr>>
```

应用边界 `apps/openreadest-app`；渲染边界 `packages/foliate-js`。Tauri/同步/翻译/品牌不进入迁移面。

## 2. 关键契约

### 2.1 ocrProvider（pdf.js 侧，book 实例级）

```js
ocrProvider({ pageIndex, image, width, height, scale })
  => Promise<{ ok: true, cached, lines: [{ text, score, box }] }>
   | Promise<{ ok: false, status: 'cancelled'|'timeout'|'failed'|'queue_full'|'model_not_ready', error? }>
```

判别联合：成功 `{ok:true}` / 失败 `{ok:false,status}`。**禁止空 lines 混义**（`cached:false, lines:[]` 仅表示"无缓存且识别失败"）。

### 2.2 synthetic TextContent（pdfjs-dist 5.x）

```js
{ items: [{ str, transform, width, height, fontName, dir:'ltr', hasEOL:false }],
  styles: { [fontName]: { fontFamily:'sans-serif', vertical:false } }, lang }
```

`fontSize` 非 TextItem 字段（由 transform + style 推导）；`styles[fontName]` 缺失会运行时异常。

### 2.3 OcrBookStatus（设备本地，Fingerprint-aware）

```ts
{ docId, fingerprint, completedPages, scanPages, status:'done' }
```

OCR'd 判定 = 该 fingerprint 下 `completedPages === scanPages`。模型切换 → 新 fingerprint 记录缺失 → stale → 回落到按需识别。**不同步云端 `Book` 记录**。

### 2.4 命令面

`ocr_register_doc({source: {kind:'path',path}|{kind:'file',file,size}}) → {docId}`（流式 SHA-256）
`ocr_recognize({taskId,docId,pageIndex,image}) → {status, cached?, lines?, error?}`
`ocr_get_cached_page({docId,pageIndex,fingerprint}) → {cached,width,height,lines}`（只读，绝不触发识别）
`ocr_models_status / ocr_download_model / ocr_set_model / ocr_cancel / ocr_batch_cancel`

`status`: `ok/cancelled/timeout/failed/queue_full/model_not_ready/invalid_input`。错误归一到 `error.rs`，不透出 `TokioOcrError`。

## 3. 调度（OcrScheduler）

- 两条队列：交互（阅读器页级）优先出队；批量仅当 worker 空闲且批量并发 ≤ 1 才提交。
- 底层 `TokioRapidOcr` 队列容量 **1**（单 worker 顺序处理；2–4 调参留压测后）。
- 任务 id：按需 `docId:pageIndex`；批量 `docId:batch:page`。
- 取消生命周期：pending 移除 / active `cancel_and_wait` / completed 幂等；重复取消幂等。
- **批量取消**：batch 登记 `batchId → Set<taskId>`，只取消集合内任务；不用全局 `ocr_cancel_all`。

## 4. 模型管理（ModelManager）

- 目录 `app_data_dir()/ocr-models`；固定版本 manifest pinned。
- **目录级原子安装**：下载到 `.tmp/<name>-<ts>/` → 全部文件校验 SHA-256+length → 整体 rename（或写入 `READY` 标记）。**禁止逐文件 rename 后即视为可用**。
- 切换：取消并 drain active 任务 → 重建 `TokioRapidOcr` → `RwLock<Option<_>>` 原子 swap → 新请求 `model_not_ready` 或排队（spike 定）。
- 状态机 `not-downloaded → downloading → ready` + `failed(offline/corrupt)`；落盘可恢复。

## 5. 应用退出协议

1. `RunEvent::ExitRequested`：`api.prevent_exit()` 阻止默认退出 → `take()` 引擎 → spawn 异步 shutdown（先 `ocr_batch_cancel` 再 `shutdown().await`）。
2. 超时 5 s：成功或超时后重新请求退出（`app_handle.exit(0)`）。
3. `RunEvent::Exit`：不再等待（事件循环已结束，无法 await）。

## 6. 搜索集成（buildPdfTextDocument）

按页选择文本来源：

1. `src = await section.load()` → fetch → DOMParser → doc 骨架。
2. `textContent = await page.getTextContent()`：有非空 items → **原生文本页**注入 `.textLayer`。
3. 无原生文本 → `ocr_get_cached_page` 读缓存注入；无缓存 → 空 doc（本页不可搜，符合边界）。

渲染活文档与搜索文档共用同一 `injectTextContent` 与同一份缓存 → `getCFI`/`CFI.toRange` 往返可解析回活文档。
**CFI 门禁**：不可靠时 `{pageIndex,lineIndex,offsets}` 是独立实现路径（改 `view.js` 搜索/annotation、`BookSearchMatch`、搜索 UI、导航高亮），单独排期，一期不临时混入。

## 7. 各 child 边界

| Child                | 交付                                      | 依赖                          |
| -------------------- | ----------------------------------------- | ----------------------------- |
| ocr-spike            | 各门禁验证结论记录（research/）           | –                             |
| ocr-rust-plugin      | 插件全量 + scheduler + 退出协议           | spike                         |
| ocr-pdfjs-overlay    | ocrProvider + TextContent 注入 + 缩放保持 | spike                         |
| ocr-search           | createDocument + 混合页 + CFI             | rust-plugin, pdfjs-overlay    |
| ocr-reader-on-demand | OcrService + 状态机 + Fingerprint 判定    | rust-plugin, pdfjs-overlay    |
| ocr-batch-entry      | 书架入口 + OcrBatchService + UI           | rust-plugin, reader-on-demand |
| ocr-validation       | 验收矩阵 + 回归 + 回滚                    | 1–6                           |

## 8. 回滚点

- `foliate-js/pdf.js` 改动独立于 OpenReadest 业务层，可单文件 revert。
- Rust 插件在 `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` 注册处整体开关；回滚 = 移除 `.plugin(tauri_plugin_ocr::init())` 与 capabilities 条目。
- 前端：OcrService/provider 注入点集中，关闭入口即可回退到无 OCR 状态，不影响原 PDF 渲染/搜索路径。

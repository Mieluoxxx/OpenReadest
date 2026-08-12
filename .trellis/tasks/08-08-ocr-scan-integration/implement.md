# OCR 扫描件集成执行计划

## 阶段与顺序

```text
Spike ──► ① Rust 插件 ──┬─► ③ 搜索集成 ──► ⑥ 验收/回滚
         │              └─► ④ 阅读器按需 ──► ⑤ 书架批量+UI
         └─► ② pdf.js 覆盖层 ──► ③/④
```

依赖：3 依赖 1+2；4 依赖 1+2；5 依赖 1+4；6 依赖 1–5。2 与 1 可并行（各自依赖 spike）。

## 执行检查表

1. **ocr-spike**（先行，阻塞门禁）
   - [ ] rapidocr-core v0.2.2 构建验证（禁用默认 feature，仅 tokio）
   - [ ] IPC 三方案实测（原始字节 → 临时文件 → base64）
   - [ ] synthetic TextContent 注入 pdfjs-dist 5.x 稳定性
   - [ ] **CFI 往返门禁**
   - [ ] 队列容量/取消 API
   - [ ] 目录级模型原子安装
   - [ ] 混合文本 PDF 样例
   - 出口：各验证项记录（research/），阻塞项有结论

2. **ocr-rust-plugin**
   - [ ] 插件骨架（Cargo.toml/build.rs/permissions + lib.rs 注册）
   - [ ] doc 注册（source 联合 + 流式 SHA-256）+ 持久化
   - [ ] 识别命令（判别联合响应）+ 输入上限
   - [ ] OcrScheduler 双队列（交互优先/批量受限）
   - [ ] OcrCache 逐页原子写
   - [ ] OcrBookStatus Fingerprint 完成记录
   - [ ] ModelManager（manifest/目录级原子安装/切换/stale）
   - [ ] ocr_cancel / ocr_batch_cancel（batch 级 taskId 集合）
   - [ ] ExitRequested 异步退出协议
   - [ ] Rust 单测

3. **ocr-pdfjs-overlay**
   - [ ] makePDF 接受 `{ocrProvider}` 注入
   - [ ] 扫描页检测（streamTextContent 空 + textLayer 无 span）
   - [ ] 离屏渲染 + toBlob → provider
   - [ ] synthetic TextContent → TextLayer 二次渲染（或退回手工 span）
   - [ ] 内存缓存 pageNumber → lines + 缩放重渲染保持

4. **ocr-reader-on-demand**
   - [ ] OcrService：provider 注册（闭包绑定 docId）
   - [ ] 页级状态机 + 翻页取消过期页
   - [ ] Fingerprint-aware OCR'd 判定
   - [ ] 按需识别兜底 + model_not_ready 引导

5. **ocr-batch-entry**
   - [ ] BookshelfItem 右键"OCR 扫描件"（`format === 'PDF'`）
   - [ ] OcrBatchService：单页并发、预扫跳原生文本页、页面图像生成流程（渲染→toBlob→invoke→释放）
   - [ ] 暂停/继续一期语义（停止提交+取消本 batch；续跑靠缓存）
   - [ ] 完成写 OcrBookStatus（不同步云端）
   - [ ] 设置页"OCR 识别" + 任务面板

6. **ocr-search**
   - [ ] buildPdfTextDocument 按页选原生/OCR 缓存
   - [ ] PDF sections 补 createDocument
   - [ ] 共享 injectTextContent + 缓存
   - [ ] CFI 往返接入（或独立路径排期）

7. **ocr-validation**
   - [ ] §8.1 十一项验收逐条跑通
   - [ ] 混合文本/纯扫描/正常文本 PDF 回归
   - [ ] 桌面三平台冒烟
   - [ ] 回滚点验证（插件开关、pdf.js revert）

## 验证命令

```bash
# Rust 插件
cd apps/openreadest-app && pnpm clippy && cargo test -p openreadest
# 前端
pnpm --filter openreadest-app lint && pnpm --filter openreadest-app test
pnpm --filter openreadest-app build
# 桌面冒烟（三平台）按 §7.2 执行
```

## 评审门

- 每个 child 完成自检（spec 合规、lint/type/test）后再提交。
- parent 在全部 child 完成后做跨子任务集成审查（数据流、契约一致性、验收 11 项）。
- 规划汇总需明确批准后才 `task.py start`（parent 与 children 均保持 planning）。

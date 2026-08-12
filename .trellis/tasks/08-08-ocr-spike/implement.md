# RapidOCR Spike 验证执行清单

## 步骤

1. **rapidocr-core 构建**
   - 在临时 crate 中 `rapidocr-core = { version = "0.2.2", default-features = false, features = ["tokio"] }`，`cargo build` 验证桌面三平台目标。
   - 用 crate 自带 `examples/tokio_usage.rs` 跑通识别冒烟（含 ppocrv5-ch-mobile 模型下载）。
2. **IPC 三方案实测**
   - 用一个小 Tauri 应用 + 识别命令，分别以 `Uint8Array` 原始字节 / 临时文件路径 / base64 传输同尺寸 PNG，记录数据量、内存峰值、往返延迟。
   - 结论写入 research/ipc-transfer.md。
3. **synthetic TextContent 注入**
   - 在 foliate-js 环境用完整 `{items, styles, lang}` 结构二次渲染 TextLayer，验证扫描页覆盖层 + 选中。
   - 失败则验证退回方案（绝对定位 span）。
   - 结论写入 research/textcontent-injection.md。
4. **CFI 往返门禁**
   - 用搜索文档生成 CFI，在活文档 `CFI.toRange` 解析回 Range；含 OCR 页 + 混合页。
   - 结论写入 research/cfi-roundtrip.md（**阻塞门禁**）。
5. **队列/取消 API**
   - 容量 1 下验证 `run_image_with_timeout`、`OcrTask::cancel/cancel_and_wait` 幂等、worker 协作式收尾。
   - 结论写入 research/queue-cancel.md。
6. **目录级模型原子安装**
   - 验证临时目录整体校验后 rename 协议。
7. **混合文本 PDF 样例**
   - 构造原生文本页 + OCR 页混合 PDF，验证搜索文档构建。

## 验证命令

```bash
cargo build --release && cargo run --example tokio_usage <scan.png>
# IPC / TextContent / CFI 按 research 记录分别验证
```

## 出口

- `research/` 下每项一个记录文件，含结论与复现方式。
- CFI 门禁结论决定 `ocr-search` 走 CFI 或独立路径。
- spike 未通过的门禁项列为阻塞，parent 规划据此调整。

# tauri-plugin-ocr 实现清单

## 步骤

1. 插件骨架：`src-tauri/plugins/tauri-plugin-ocr/`（Cargo.toml/build.rs/permissions/commands/models/error/model_manager/ocr_cache/scheduler/desktop/mobile），在 `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs` 注册，capabilities 加 `ocr:default`。
2. `ocr_register_doc`：source 判别联合解析 + 流式 SHA-256 → docId，持久化映射。
3. `ocr_recognize` / `ocr_get_cached_page`：判别联合响应 + 输入上限 + 缓存命中分支。
4. OcrScheduler：交互优先/批量受限双队列；`TokioRapidOcr` 队列容量 1。
5. OcrCache：`ocr-cache/<docId>/<fingerprint>/<page>.json` 逐页原子写。
6. OcrBookStatus：Fingerprint 完成记录持久化 + stale 判定。
7. ModelManager：manifest 下载/目录级原子安装/切换（取消+drain→重建→swap）/状态机。
8. `ocr_cancel` / `ocr_batch_cancel`：taskId 集合管理，幂等。
9. 退出协议：`ExitRequested` 阻止退出 → spawn shutdown（5 s 超时）→ 重新退出。
10. Rust 单测：解码→识别→坐标换算、batch 取消范围、模型原子安装、缓存原子写。

## 验证命令

```bash
cd apps/openreadest-app && pnpm clippy && cargo test -p openreadest
```

## 出口

- 全部命令可调用、判别联合响应正确。
- 单测通过；退出协议实测不悬挂。

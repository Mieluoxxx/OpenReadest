# Obsidian 同步插件（koplugin 范式移植）

## Goal

把 `apps/readest.koplugin`（KOReader 设备端同步插件）总结出的**跨端同步插件开发范式**移植到 Obsidian 插件开发：实现一个 Obsidian 插件，将"记录"（阅读书摘/笔记/进度，或通用标记记录）同步到自建同步后端，验证范式在 TypeScript/Electron 生态的可复用性，并为 OpenReadest 未来的插件体系沉淀一份可执行的范式文档。

**状态：本任务仅做规划（prd/design/implement），不执行实现。**

## Confirmed facts

- koplugin 交互机制已读透（`main.lua` / `readestsync.lua` / `supabaseauth.lua` / `*-api.json`）：
  - 声明式 API 契约（Spore spec JSON）+ middleware 管线（JSON 头 / Bearer 认证 / 异步 HTTP）生成客户端；
  - 认证流：`sign_in_password` → 凭据存 `G_reader_settings` → 令牌**半衰期提前刷新**（`expires_at < now + expires_in/2`）；
  - 同步契约：`bookHash`（书籍指纹）+ `metaHash`（元数据指纹）+ `progress`（分页 `[页,总页]`）+ `xpointer`（流式 CREngine XPointer）+ `updatedAt`（ms）；
  - 生命周期：`onReaderReady` 自动 pull、`onPageUpdate` 延迟 5s 推送、`onCloseDocument` 兜底 flush、30s API 防抖；
  - 能力开关：`ORIGINAL_SERVICE_DISABLED` 常量 + 禁用提示三件套。
- Obsidian 插件开发事实（已核对官方文档）：
  - 插件 = `manifest.json` + 编译产物，`export default class extends Plugin`，生命周期 `onload()/onunload()`；
  - 数据持久化：`loadData()/saveData()`（存 `.obsidian/plugins/<id>/data.json`），**禁止直接读写该文件**；
  - 事件：`this.registerEvent(app.vault.on("modify"|"create"|"delete"|"rename", cb))`，`registerInterval(id)` 自动在 unload 时清理；
  - 文件变更可经 `metadataCache` 解析 frontmatter；vault 变更事件为高频事件，需防抖合并；
  - 移动端（Capacitor 环境）fetch 可用但后台执行受限，不能依赖常驻定时器；
  - 社区已有同思路实现可对照：`obsidian-vault-sync`（WebSocket+轮询）、`Self-hosted LiveSync`（CouchDB）、`obsidian-local-rest-api`（vault 暴露为 REST API）。
- OpenReadest 侧同步契约已存在：`BookConfig { bookHash, metaHash, progress, location, xpointer, updatedAt }`，`BookDataRecord { id, book_hash, meta_hash, user_id, updated_at, deleted_at }`（LWW 冲突模型），`transform.ts` 做 DB ↔ 类型转换；`xcfi.ts` 已实现 CFI ↔ XPointer 双向转换。
- OpenReadest 云服务（Supabase）当前**处于禁用状态**（`src/utils/supabase.ts` 全方法抛 `disabledError`），因此同步目标端点需自建或复用自托管后端，不依赖 Readest 现成云。

## Requirements

### R1. 范式移植分析（先行，阻塞门禁）

将 koplugin 七条范式逐一映射到 Obsidian 插件：
① 声明式 API 契约（TS 类型 + fetch 客户端） ② 认证中间件管线 ③ 令牌半衰期刷新 ④ 能力禁用开关 ⑤ 事件驱动生命周期 ⑥ 双端共享数据契约 ⑦ 指纹归一化。
输出：每条范式的 Obsidian 侧落地形态、与 koplugin 的差异、风险点（移动端后台限制、高频事件防抖、冲突粒度按文件）。

### R2. 插件骨架

`manifest.json` + `main.ts`（`Plugin` 子类，`onload` 注册同步服务/命令/设置面板，`onunload` 清理）+
`data.json` 设置（端点、凭据、自动同步开关、策略）。`registerInterval` 做周期轮询兜底，`registerEvent` 监听 vault 变更。

### R3. 同步协议客户端

TS 版 `api-client.ts`：声明式端点定义 + 请求拦截器管线（JSON 头 / Bearer 认证 / 错误归一化）；
认证模块（登录 / 令牌半衰期刷新 / 登出）；与 koplugin 契约一致的 payload 结构。

### R4. 记录同步核心

- 记录模型：`recordId`（稳定指纹）+ `metaHash`（内容指纹）+ `updatedAt`（LWW 时间戳）+ `deleted`（软删除）；
- 变更捕获：`app.vault.on("modify"/"create"/"delete")` + 文件级防抖合并队列（参考 koplugin 的 `API_CALL_DEBOUNCE_DELAY` + `scheduleIn` 延迟合并 + 关闭兜底 flush）；
- 推送/拉取：增量 `since` 拉取、变更推送；冲突按文件粒度 LWW 解决；
- frontmatter 写入 `updated_at` 与稳定记录 ID（指纹归一化，替代 koplugin 的 md5 组合）。

### R5. 设置与 UX

`PluginSettingTab`：端点 URL、用户名/密码（或令牌）、自动同步开关、同步策略（push/pull/both/silent/prompt）、记录范围过滤；同步状态提示（进行中/成功/失败/未认证）。

### R6. 范式文档沉淀

将移植结论写为可执行范式文档（`docs/plugin-dev-paradigm.md` 或 `.trellis/spec/` 条目），供 OpenReadest 未来插件体系复用。

## Non-goals

- 不实现 Obsidian 移动端后台常驻同步（依赖插件活跃期触发）。
- 不做多后端适配（一期仅一个自建同步端点）。
- 不实现冲突合并 UI（一期 LWW 静默解决；冲突解决 UI 二期）。
- 不连接 OpenReadest 现有禁用云服务。
- 本任务不执行实现，仅产出规划产物。

## Acceptance criteria

- A1. `prd.md` / `design.md` / `implement.md` 齐全，范式映射表完整（七条全覆盖）。
- A2. `design.md` 含同步协议契约、认证流、冲突模型、生命周期时序的明确设计。
- A3. `implement.md` 含分阶段检查表、验证命令、回滚点。
- A4. 明确标注"规划产物，待批准后 `task.py start` 才进入执行"。
- A5. 范式文档草案（R6 输出）在规划期可先行撰写框架。

## Key decisions

- 同步单位：**文件**（记录 = vault 中符合范围过滤的 .md 文件），冲突按文件粒度。
- 稳定 ID：frontmatter 字段（如 `record_id`）优先，缺失时以路径 hash 兜底；`metaHash` 由文件内容计算。
- 变更合并：文件级防抖队列（默认 5s 合并窗口 + 30s API 防抖），unload 时 flush。
- 认证刷新：复用 koplugin 半衰期策略（`expires_at < now + expires_in/2`）。
- 能力开关：设置项 `enabled` + 未配置端点时优雅降级（不启动同步服务）。
- 后端：自建轻量同步服务（规划期仅定义契约，不实现服务端，除非用户另行确认）。

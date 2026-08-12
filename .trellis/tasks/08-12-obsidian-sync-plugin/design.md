# Obsidian 同步插件技术设计（koplugin 范式移植）

Date: 2026-08-12
Status: Planning（本任务仅规划，不执行）

依据：koplugin 源码分析（`apps/readest.koplugin/`）、OpenReadest 同步契约（`src/libs/sync.ts` / `src/types/book.ts` / `src/types/records.ts`）、Obsidian 官方插件 API。

## 1. 架构与边界

```text
Obsidian 插件（本任务目标）
  main.ts (Plugin 子类)
    ├─ SyncService        ← 同步核心（变更队列/防抖/flush）
    ├─ ApiClient          ← 声明式契约 + middleware 管线（R3）
    ├─ AuthManager        ← 登录/半衰期刷新/登出（R3）
    ├─ RecordMapper       ← 文件 ↔ 记录模型（frontmatter ID/metaHash）
    └─ SettingTab         ← PluginSettingTab（R5）
          │  registerEvent(app.vault.on modify/create/delete)
          │  registerInterval(轮询兜底)
          ▼
  自建同步后端（规划期仅定义契约，服务端不实现）
    GET  /sync?since&type&id      → 增量拉取
    POST /sync { records }        → 变更推送
    POST /auth/token              → 登录
    POST /auth/refresh            → 刷新
```

插件边界：Obsidian vault；协议边界：与 koplugin 同构的 `recordId + metaHash + updatedAt + deleted` 契约。不触碰 OpenReadest 代码库（除非后续要联动其笔记导出）。

## 2. 关键契约

### 2.1 记录模型（R4，koplugin 契约的 Obsidian 化）

```ts
interface SyncRecord {
  recordId: string; // 稳定指纹：frontmatter `record_id` 优先，缺失时 hash(vault 相对路径)
  metaHash: string; // 内容指纹：hash(文件内容)，不含 updated_at/record_id 自身
  content: string; // 文件正文（markdown）
  updatedAt: number; // ms 时间戳（LWW 依据）
  deleted: boolean; // 软删除标记
}

interface PullParams {
  since: number;
  type?: 'records';
  id?: string;
}
interface PushPayload {
  records: SyncRecord[];
}
```

对比 koplugin：`bookHash → recordId`、`metaHash` 保持语义（版本指纹）、`xpointer/progress → content`（同步的是整份记录而非位置）。LWW 冲突模型与 OpenReadest `BookDataRecord` 一致（`updated_at` 大者胜）。

### 2.2 ApiClient：声明式端点 + middleware 管线（R3，范式①+②）

```ts
// 声明式端点定义（对应 koplugin 的 *-api.json + Spore）
const endpoints = {
  pullChanges: { method: 'GET', path: '/sync' },
  pushChanges: { method: 'POST', path: '/sync' },
  signIn: { method: 'POST', path: '/auth/token' },
  refresh: { method: 'POST', path: '/auth/refresh' },
  signOut: { method: 'POST', path: '/auth/logout' },
} as const;

// middleware 管线：顺序 = JSON 头 → Bearer 认证 → 超时 → 错误归一化
// 对应 koplugin: ReadestHeaders → ReadestAuth → AsyncHTTP
type Middleware = (ctx: RequestCtx, next: () => Promise<Response>) => Promise<Response>;
```

实现要点：纯 TS 闭包管线（比 Lua/Spore 更简单，无运行时依赖）；错误归一化为判别联合 `{ ok: true, data } | { ok: false, status: 'unauthorized'|'offline'|'timeout'|'server', error? }`。

### 2.3 AuthManager：半衰期刷新（范式③）

```ts
interface AuthState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix s
  expiresIn: number;
}
// 复用 koplugin 策略：expires_at < now + expires_in / 2 → 提前刷新
// needsLogin: !accessToken || !expiresAt || expiresAt < now + 60
```

凭据经 `loadData()/saveData()` 存 `data.json`（Obsidian 规定路径，**不直接读写文件**）。刷新失败 → 清凭据 → 设置页提示重新登录（对应 koplugin `logout()` + 提示）。

### 2.4 变更捕获与防抖合并（范式⑤，Obsidian 化的生命周期）

```text
app.vault.on('modify'|'create'|'delete') ──► 文件级变更记录
        │ 5s 合并窗口（scheduleIn 语义 → setTimeout）
        ▼
DirtySet（recordId → updatedAt）──► 批量 pushChanges
        │ 30s API 防抖（koplugin API_CALL_DEBOUNCE_DELAY）
        ▼
pushChanges(payload) ──► 成功后清 DirtySet / 失败保留重试
```

- `onunload()`：清定时器 + flush 未提交变更（对应 koplugin `onCloseWidget` + `onCloseDocument` 兜底）。
- 轮询兜底：`registerInterval(5min)` 执行增量 pull（对应 koplugin `onReaderReady` 自动 pull）。
- 移动端：不做后台常驻，同步仅在插件活跃期触发（非目标声明）。

### 2.5 指纹归一化（范式⑦）

```ts
function stableRecordId(path: string, frontmatter: Record<string, unknown>): string {
  if (typeof frontmatter.record_id === 'string' && frontmatter.record_id)
    return frontmatter.record_id;
  return hashString(path); // vault 相对路径 hash，重命名需迁移（二期处理）
}
function computeMetaHash(content: string): string {
  // 排除自身 frontmatter 字段（record_id/updated_at），避免同步抖动
  return hashString(stripSyncFields(content));
}
```

对应 koplugin 的 `normalizeIdentifier`（uuid>calibre>isbn 优先级）与 `generateMetadataHash`——语义等价：稳定 ID 优先，缺失时退化到内容路径。

### 2.6 能力开关与降级（范式④）

设置项 `enabled` + 端点未配置 → 同步服务不启动、命令提示配置（对应 koplugin `ORIGINAL_SERVICE_DISABLED` + `showDisabledMessage`）。设置面板 `PluginSettingTab`：端点 URL、用户名/密码、自动同步开关、策略（push/pull/both/silent/prompt）、范围过滤（文件夹/标签）。

## 3. 冲突模型

文件粒度 LWW：

- push：本地 `updatedAt` 与远端比对，远端新则丢弃本地推送并拉取远端版本；
- pull：远端 `updatedAt` 新则覆盖本地文件（写入前备份 `.trash` 策略二期）；
- 删除：软删除（`deleted: true`）传播，不做物理删除同步（避免误删 vault）。

## 4. 生命周期时序

```text
onload: loadData → AuthManager 恢复会话 → 若 enabled+已配置：注册 vault 事件 + registerInterval
   │
vault modify → DirtySet.add(recordId) → [5s 合并窗口] → pushChanges
   │
pushChanges 401 → tryRefreshToken → 重试一次 → 失败清凭据提示登录
   │
pull (interval / 手动命令) → GET /sync?since → 应用远端记录 → 本地 frontmatter 回写 updated_at
   │
onunload: flush DirtySet（fire-and-forget）→ clearInterval → 注销事件
```

## 5. 风险与缓解

| 风险                                         | 缓解                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| vault 高频事件导致 API 轰炸                  | 5s 合并窗口 + 30s API 防抖（koplugin 同款参数）                                                   |
| 同步抖动（内容 hash 因回写 updated_at 变化） | metaHash 排除自身同步字段；回写前先比对                                                           |
| 文件重命名/移动后 ID 漂移                    | frontmatter `record_id` 优先；路径 hash 兜底 + 二期迁移                                           |
| 移动端后台限制                               | 明确不做后台常驻，插件活跃期触发                                                                  |
| token 过期请求 401                           | 半衰期提前刷新 + 单次重试 + 清凭据引导                                                            |
| 后端未定                                     | 规划期仅契约；服务端可参考 OpenReadest `SyncClient` 基类或社区 `obsidian-vault-sync` FastAPI 实现 |

## 6. 兼容性与回滚

- 插件独立于 OpenReadest 仓库（新目录或独立 repo），不影响现有代码。
- 数据只在 vault 文件 + 自建端点间流动；不写 OpenReadest 任何数据库。
- 回滚：移除插件 + 停用同步端点即可，vault 文件本身由 LWW 保护（远端新才覆盖）。
- 若后续要对接 OpenReadest 笔记导出，契约可复用 `BookNote` 的 `bookHash` 关联字段扩展（二期）。

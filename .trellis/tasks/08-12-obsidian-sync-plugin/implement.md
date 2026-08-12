# Obsidian 同步插件执行计划（koplugin 范式移植）

Status: Planning（**规划产物，待批准后 `task.py start` 才进入执行**）

## 阶段与顺序

```text
① 范式移植分析（R1，先行门禁）
   │
② 插件骨架（R2，manifest + Plugin 子类 + 设置面板骨架）
   │
③ 同步协议客户端（R3，ApiClient + AuthManager）
   │
④ 记录同步核心（R4，RecordMapper + 防抖队列 + push/pull）
   │
⑤ 设置与 UX 完善（R5）+ 范式文档沉淀（R6）
```

依赖：2 依赖 1；3 依赖 1、2；4 依赖 3；5 依赖 4。本任务**不执行实现**，以下检查表仅为批准后执行做准备。

## 执行检查表（批准后生效）

1. **obsidian-paradigm-analysis（R1，先行门禁）**
   - [ ] 七条范式逐一映射（koplugin → Obsidian），输出差异表
   - [ ] 移动端后台限制 / 高频事件防抖 / 冲突粒度的风险确认
   - [ ] 对照社区实现（obsidian-vault-sync / LiveSync / local-rest-api）确认不重复造轮子
   - 出口：映射结论记录到 research/，范式文档框架（R6 草稿）就位

2. **plugin-skeleton（R2）**
   - [ ] `manifest.json`（id/name/version/minAppVersion/isDesktopOnly）
   - [ ] `main.ts`：`Plugin` 子类 + `onload`（注册同步服务/命令/设置面板）+ `onunload`（清理）
   - [ ] 设置类型 + `loadData()/saveData()` 持久化（data.json，不直接读写）
   - [ ] `PluginSettingTab` 骨架（端点/凭据/开关/策略字段占位）
   - [ ] `registerInterval` 轮询兜底骨架
   - 出口：插件可在 Obsidian 加载、设置可保存

3. **api-client（R3）**
   - [ ] 声明式端点定义（pullChanges/pushChanges/signIn/refresh/signOut）
   - [ ] middleware 管线：JSON 头 → Bearer 认证 → 超时 → 错误归一化（判别联合）
   - [ ] AuthManager：登录 / 半衰期刷新（`expires_at < now + expires_in/2`）/ 登出 / 401 单次重试
   - [ ] 单测（mock fetch）：管线顺序、401 重试、刷新失败清凭据
   - 出口：client 全链路单测绿

4. **record-sync（R4）**
   - [ ] RecordMapper：文件 ↔ SyncRecord（frontmatter `record_id` 优先 + 路径 hash 兜底 + metaHash 排除同步字段）
   - [ ] 变更捕获：`app.vault.on('modify'|'create'|'delete')` → DirtySet
   - [ ] 防抖合并：5s 合并窗口 + 30s API 防抖 + onunload flush
   - [ ] 增量 pull：`GET /sync?since` → 应用远端 → frontmatter 回写 `updated_at`
   - [ ] LWW 冲突：push 远端新则弃推、pull 远端新则覆盖、软删除传播
   - [ ] 单测：防抖时序、LWW 判定、metaHash 抖动防护
   - 出口：本地双实例（两个 vault 指向同一端点）互同步冒烟通过

5. **settings-ux + paradigm-doc（R5 + R6）**
   - [ ] 设置面板完善：范围过滤（文件夹/标签）、策略下拉、同步状态展示
   - [ ] 能力开关降级：端点未配置 → 服务不启动 + 提示
   - [ ] `docs/plugin-dev-paradigm.md`（或 `.trellis/spec/` 条目）定稿
   - 出口：范式文档覆盖七条范式 + Obsidian 落地形态 + OpenReadest 复用指引

## 验证命令

```bash
# 插件开发（批准后执行时使用）
pnpm tsc --noEmit                        # 类型检查
pnpm vitest run                          # 单测（ApiClient/AuthManager/RecordMapper/防抖）
# Obsidian 加载验证
#   .obsidian/plugins/<id>/ 放入 manifest.json + main.js，Obsidian 内 reload + dev:console 查错

# 规划产物校验（当前阶段）
python3 .trellis/scripts/task.py validate --task .trellis/tasks/08-12-obsidian-sync-plugin
```

## 回滚点

- 阶段 1 结论不成立（范式不可移植）→ 停在本阶段，只保留分析文档。
- 阶段 2 无法在 Obsidian 加载 → 检查 manifest/编译链，回退到骨架最小集。
- 阶段 4 冒烟不通过 → 保留防抖与 LWW 单测作为回归基线，定位协议或时序问题。
- 整体回滚：插件为独立目录/repo，移除即回滚；vault 文件由 LWW 保护（远端新才覆盖），不会被动损坏。

## 里程碑

- M1（规划完成）：prd/design/implement 齐全 + 范式文档框架就位 —— **当前阶段目标**
- M2（批准后）：插件骨架 + ApiClient 单测绿
- M3：记录同步冒烟通过（双 vault 互同步）
- M4：设置 UX + 范式文档定稿

## 交付物清单

- [x] `prd.md`（需求/约束/验收标准）
- [x] `design.md`（契约/认证/冲突/生命周期设计）
- [x] `implement.md`（本文件，检查表/验证/回滚）
- [ ] `docs/plugin-dev-paradigm.md` 框架（R6 草稿，规划期可先行）
- [ ] 范式映射差异表（R1 输出，research/ 或直接并入范式文档）

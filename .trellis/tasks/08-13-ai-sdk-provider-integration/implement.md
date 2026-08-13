# AI SDK 集成 — 实施计划

## 前置

- [ ] 任务在 `task.py start` 后进入 in_progress（需主人批准本规划总结）
- 与 `08-13-ai-metadata-calibration` 的**执行依赖顺序**：本任务（SDK 集成）必须先完成并导出 `createAiModel` / `requestAiCompletion`；08-13 开始实现前必须刷新其 design 对齐本任务导出的工厂，不依赖本任务实现结构化输出

## 有序实施清单

### 第 0 步：Spike 验证门（阻塞后续，任一失败即停并回退方案评估）

- [ ] S1：`pnpm --filter @openreadest/app add ai @ai-sdk/openai @ai-sdk/openai-compatible @ai-sdk/anthropic @ai-sdk/deepseek` 安装成功，确认 AI SDK 版本（v7 系）
- [ ] S2：写最小脚本/组件，用 `createOpenAICompatible({ baseURL, apiKey, fetch: tauriFetch })` + `generateText` 非流式调用实测桌面端连通（本地无 key 的 OpenAI 兼容端点，如 Ollama/本地代理，验证「无 apiKey」路径）
- [ ] S3：确认 SDK 错误类导出名（`APICallError`/`NoSuchModelError`/`RetryError`）与字段（statusCode/abortSignal 行为），固化错误映射
- [ ] S4：mock fetch 断言 SDK `maxRetries: 2` 对 429/5xx 的调用次数（验证重试语义）
- [ ] S5：`pnpm build-web` + `pnpm check:all` 通过；记录 `ai`/`@ai-sdk/*` 客户端 bundle 增量（gzip），**报告式呈现，不预设阈值**
- [ ] S6：确认各格式默认模型名（gpt / claude 系当前官方模型，DeepSeek 沿用 `deepseek-v4-flash`）
- [ ] S7：确认**无 apiKey 时传 `undefined` 不会触发 SDK 环境变量/默认 key 回退**（浏览器端尤其注意）；确认 tauriFetch 与 SDK fetch 签名（RequestInfo/RequestInit → Promise<Response>）兼容，不兼容则实现薄适配器
- [ ] S8：**固定相互兼容的精确版本**：spike 通过后 pin `ai`/`@ai-sdk/*` 具体版本号到 package.json（`save-exact`），并记录到 design/implement 供复现

### 第 1 步：类型与配置层

- [ ] `src/types/settings.ts`：`AiSettings` 增加 `format?: AiFormat`；导出 `AiFormat` 类型
- [ ] `AiConfigRepository.ts`：`getConfig()` 归一缺失 format → `'openai-chat'`；`saveConfig` 接收并持久化 format；`getNonSecretConfig` 返回 format（默认 `'openai-chat'`）
- [ ] 迁移验证：无 format 旧配置读取为 `'openai-chat'`（单测）

### 第 2 步：SDK 感知模块（新增 aiProviderFactory.ts）

- [ ] `createAiModel(config: AiConfig): LanguageModel`：
  - `openai-chat` → `createOpenAICompatible({ name, baseURL, apiKey, fetch: platformFetch })` 实例取 chat 模型（`@ai-sdk/openai-compatible`）
  - `openai-responses` → `createOpenAI({ baseURL, apiKey, fetch: platformFetch }).responses(model)`
  - `anthropic` → `createAnthropic({ baseURL, apiKey, fetch: platformFetch })` 实例取 messages 模型
  - `deepseek` → `createDeepSeek({ baseURL, apiKey, fetch: platformFetch })(model)`
- [ ] 统一 `platformFetch`（tauriFetch / window.fetch，含类型适配）；**provider 实例不缓存**（每次按 config 现建，避免持有过期 apiKey）

### 第 3 步：aiClient.ts 重写

- [ ] 新增 `requestAiCompletion(config, messages, options)`：`generateText` + abortSignal（30s）+ `maxRetries: 2`，外层套 `runWithRequestSlot`（×3）+ `inFlightRequests` 去重（key 含 format）
- [ ] 错误映射函数：SDK 错误 → 8 种 AiErrorCode（按 design 2.3 表）
- [ ] `requestAiTranslation` 改为调用 `requestAiCompletion`；`testAiConnection` 支持 format 字段
- [ ] 删除：`normalizeBaseUrl`、手写重试循环、SSE 解析、响应提取（SDK 接管）

### 第 4 步：UI（AiPanel.tsx）

- [ ] 首行「消息格式」选择器（daisyUI select/radio，四选项平铺），默认 `deepseek`
- [ ] 每格式内存草稿状态：`Record<AiFormat, { baseUrl; model }>`，首次选中填入预设，切换不清空、切回不丢失；保存持久化当前格式配置
- [ ] 保存/测试/清除按钮接入 format；`testAiConnection` 传 format

### 第 5 步：翻译 provider 缓存命名空间

- [ ] `translators/providers/ai.ts` `getCacheNamespace()` 纳入 format

### 第 6 步：测试重写与新增

- [ ] 重写 `aiClient.test.ts`：mock fetch 断言各格式请求 URL/method/headers/body（openai-chat 走 openai-compatible Chat Completions、openai-responses 走 /responses、anthropic 走 Messages、deepseek 四协议各一），不依赖外部凭据
- [ ] 错误映射单测（401/403/429/4xx/5xx/abort/NoSuchModel → 对应 AiErrorCode）
- [ ] 限流 ×3 与同请求去重测试保留并适配新 API（key 含 format）
- [ ] 迁移单测：无 format 旧配置 → `'openai-chat'`
- [ ] 翻译回归：`requestAiTranslation` 请求体/响应断言等价

### 第 7 步：双端验证与收尾

- [ ] 桌面端（tauri dev）：设置面板四种格式各实测「Test」按钮 + 翻译流程
- [ ] web 端：`pnpm build-web` + `pnpm check:all` 通过；bundle 增量复核
- [ ] `pnpm lint` + `pnpm test`（含重写测试）全绿
- [ ] 回归：现有翻译功能（Google/Azure/Yandex provider 不受影响验证）

## 验证命令

```bash
pnpm --filter @openreadest/app test            # 单元测试（含重写）
pnpm --filter @openreadest/app lint            # eslint
pnpm --filter @openreadest/app build-web       # web 构建（legacy webpack）
pnpm --filter @openreadest/app check:all       # 产物旧语法检查
pnpm --filter @openreadest/app tauri-dev-clean # 桌面端实测（tauri dev，需主人配合或手动验证）
```

## 风险文件与回滚点

| 文件                                                       | 风险                 | 回滚点                        |
| ---------------------------------------------------------- | -------------------- | ----------------------------- |
| `apps/openreadest-app/src/services/ai/aiClient.ts`         | 核心重写，翻译链路断 | 第 3 步前 commit；失败 revert |
| `apps/openreadest-app/src/services/ai/aiClient.test.ts`    | 断言大改             | 同上                          |
| `apps/openreadest-app/src/components/settings/AiPanel.tsx` | UI 状态联动复杂      | 第 4 步前 commit              |
| `apps/openreadest-app/src/types/settings.ts`               | 配置结构变更         | 惰性迁移无写盘，可回滚        |
| `apps/openreadest-app/package.json` / pnpm-lock.yaml       | 依赖引入             | revert 依赖移除               |

回滚策略：每步独立 commit；任一步失败 revert 该步，整体失败回退「手写客户端扩展」方案（需主人重新确认）。

## task.py start 前的后续检查

- [ ] Spike 门 S1-S6 通过（若失败，更新 prd/design 决策并回退方案）
- [ ] 主人批准本规划总结（最终 review gate）

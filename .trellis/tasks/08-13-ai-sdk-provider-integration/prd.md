# AI SDK 集成：消息格式选择器（OpenAI Chat/Responses + Anthropic + DeepSeek 默认）

## Goal

引入 Vercel AI SDK 替代手写 aiClient HTTP 层，获得多 provider / 多消息格式的统一管理能力；AiPanel 首行新增「消息格式」选择器（OpenAI Chat Completions（含兼容端点）/ OpenAI Responses / Anthropic / DeepSeek 默认预设）；配置层从单格式扩展为多格式；保留现有错误归一（AiErrorCode）、并发限流 ×3、同请求去重等被测试保障的行为。

## Background / Confirmed Facts

- **现有 AI 客户端**：`apps/openreadest-app/src/services/ai/aiClient.ts`（~350 行手写）
  - OpenAI 兼容 Chat Completions：错误归一（8 种 AiErrorCode）、重试 ×2 指数退避、并发限流 ×3、30s 超时、SSE 解析、同请求去重（inFlightRequests）
  - 硬编码翻译用途：`buildSystemPrompt` 翻译引擎、只导出 `requestAiTranslation`；`stream: false` 非流式
  - 自定义 `fetch` 注入：`isTauriAppPlatform() ? tauriFetch : window.fetch`
- **配置层**：`AiConfigRepository.ts`
  - `AiSettings`（`src/types/settings.ts`）= `{ baseUrl, model }`，**无格式/协议字段**
  - baseUrl/model 存 settings.json（`globalAiSettings`），apiKey 存本地秘密文件 `ai-secrets.json`（不随云同步）
- **设置面板**：`AiPanel.tsx` 首行是 Base URL 输入框；当前默认值 `https://api.deepseek.com/v1` + `deepseek-v4-flash`
- **测试现状**：`aiClient.test.ts`（228 行）mock `@tauri-apps/plugin-http`，断言请求体结构（model/messages/system role/stream:false）与 URL 规范化（`normalizeBaseUrl`）——AI SDK 替换后这些断言需重写
- **依赖现状**：项目**无任何 AI SDK 相关依赖**（无 `ai` / `@ai-sdk/*`）
- **构建约束**：Next.js + webpack legacy build（`build-web`），web 版部署 Cloudflare（opennextjs-cloudflare）；产物有 `check:optional-chaining` / `check:lookbehind-regex` 旧语法检查
- **关联任务**：`08-13-ai-metadata-calibration`（planning）需要 `aiClient` 泛化（翻译 + 元数据校准两类用途）——**本任务（SDK 集成）必须先完成，之后 08-13 必须刷新其 design 对齐本任务导出的 provider 工厂（`createAiModel`）与 `requestAiCompletion` 通用入口**；本任务不为 08-13 实现结构化输出
- **AI SDK 能力（v7，已调研）**：
  - `createOpenAICompatible`：自定义 `baseURL` / `apiKey` / `headers` / `queryParams` / **`fetch` 注入**（可注入 tauriFetch）——用于 `openai-chat`
  - `@ai-sdk/openai`：官方 OpenAI provider（Responses / Chat / Completion 模型工厂）——本任务仅用于 `openai-responses`
  - `@ai-sdk/anthropic`：Messages API
  - `@ai-sdk/deepseek`：DeepSeek 官方 provider
  - `Output.object()` + zod：结构化输出（元数据校准任务刚需）
  - `APICallError`（带 statusCode）可映射回现有 8 种 AiErrorCode
  - 风险：浏览器客户端直连为非官方推荐路径（streaming 有 ReadableStream 已知问题）；Tauri fetch 注入兼容性需实测；bundle 增量需验证

## Requirements

- R1：AiPanel 首行新增「消息格式」选择器，四选项平铺：`OpenAI Chat`（OpenAI Completions 协议，含任意兼容端点）/ `OpenAI Responses` / `Anthropic` / `DeepSeek`（默认选中）
- R2：引入 Vercel AI SDK（`ai` + 对应 provider 包），替换 `requestAiTranslation` 的 HTTP 层
- R3：配置层支持消息格式字段（AiSettings 扩展），迁移既有单格式配置，无回归
- R4：保留错误归一（8 种 AiErrorCode）、并发限流 ×3、同请求去重、30s 超时——AI SDK 不提供的部分继续在包装层实现
- R5：Tauri 桌面端与 web 端均可工作（fetch 注入路径正确）
- R6：现有 AI 翻译功能行为不回归（测试重写后保持等价断言）
- R7：与 08-13 元数据校准的 `aiClient` 泛化不冲突（提示词参数化预留）

## Acceptance Criteria

- [ ] AiPanel 首行显示消息格式选择器，可切换四种格式且默认选中 DeepSeek
- [ ] 四种格式各有**确定性 mock 协议测试**（mock fetch 断言请求 URL/method/headers/body 与响应提取，覆盖 openai-chat / openai-responses / anthropic / deepseek 四协议），不依赖外部凭据
- [ ] 切换格式后 baseUrl/model 默认值联动（预设）且仍可手动编辑
- [ ] 翻译请求经 AI SDK 发出，请求体与响应提取正确；`aiClient.test.ts` 重写后断言等价
- [ ] 错误码映射：401/403→AUTH_FAILED、429→RATE_LIMITED、4xx→ENDPOINT_OR_MODEL_ERROR、5xx→SERVER_ERROR、超时→TIMEOUT、网络→NETWORK 均成立
- [ ] 并发限流 ×3 与同请求去重行为保持（有测试）；**30s 总截止超时**生效（单测断言 abort 触发 TIMEOUT）
- [ ] Tauri 桌面端翻译可用（tauriFetch 注入生效）；web 端构建通过（含 webpack legacy + Cloudflare 产物检查）
- [ ] **手动冒烟**：使用任一已配置的可用 provider（如 DeepSeek 或本地兼容端点）经设置面板「Test」按钮 + 翻译流程实测连通一次（不要求四种格式都有外部凭据）；无凭据的格式以 mock 测试兜底
- [ ] bundle 增量**报告式**：记录引入前后 `ai`/`@ai-sdk/*` 客户端 gzip 尺寸差值并展示结果，不预设通过阈值（阈值由主人依据报告决定）

## Decisions

- **选项结构（方案 A，已决议）**：四选项平铺——`OpenAI Chat`（Chat Completions 协议 + 任意兼容端点）/ `OpenAI Responses` / `Anthropic` / `DeepSeek`（默认选中）。无嵌套子协议状态；`AiSettings.format` 单枚举字段，与 AI SDK 模型工厂一一对应
- **格式枚举**：`'openai-chat' | 'openai-responses' | 'anthropic' | 'deepseek'`
- **旧配置迁移默认值（2026-08-13 主人修订）**：`format` 缺失（现有 settings.json）→ **一律默认 `'deepseek'`**（含旧配置，原「迁移默认 openai-chat」决议已废弃）；旧 baseUrl/model 值仍保留展示，仅 format 归一到 deepseek
- **provider 实例映射（依赖已调研确认）**：
  - `openai-chat` → `createOpenAICompatible({ name, baseURL, apiKey, fetch })` 实例取 chat 模型（**`@ai-sdk/openai-compatible`**——兼容端点的正确抽象，非 OpenAI 专属 `createOpenAI().chat()`；支持任意 OpenAI Chat Completions 兼容服务）
  - `openai-responses` → `createOpenAI({ baseURL, apiKey, fetch }).responses(model)`（**`@ai-sdk/openai`**，官方 OpenAI Responses API）
  - `anthropic` → `createAnthropic({ baseURL, apiKey, fetch })`（Messages API）
  - `deepseek` → `createDeepSeek({ baseURL, apiKey, fetch })`（官方包，baseURL 默认 `https://api.deepseek.com`，支持自定义）
- **依赖包**：`ai` + `@ai-sdk/openai`（responses）+ `@ai-sdk/openai-compatible`（chat 兼容）+ `@ai-sdk/anthropic` + `@ai-sdk/deepseek`；spike 后固定相互兼容的精确版本（不留未约束的快速变化大版本族）
- **重试**：由 AI SDK `maxRetries`（默认 2）接管，移除手写重试循环（429/5xx/网络错误重试条件以 SDK 行为为准，spike 验证）
- **超时（行为变化，记录在案）**：现有实现是**每次重试各 30s** 超时；SDK 化后单个 `abortSignal` 包住 `generateText(maxRetries: 2)` 为**整个操作 30s 总截止**。这是有意的行为简化（更符合用户预期），design/AC 按 30s 总截止记录，不再声称"保留原有超时"
- **限流/去重**：保留 `runWithRequestSlot`（×3）与 `inFlightRequests` 去重包装层（SDK 不提供）
- **各格式默认预设值**（切换联动、可手改）：`openai-chat` / `openai-responses` → `https://api.openai.com/v1` + gpt 系默认模型；`anthropic` → `https://api.anthropic.com` + claude 系默认模型；`deepseek` → `https://api.deepseek.com` + `deepseek-v4-flash`（沿用现默认）。模型名具体取值实现时以官方文档为准（spike 阶段确认）
- **格式切换行为（方案 1，已决议）**：每格式内存草稿——切换不清空输入；首次选中填入该格式预设值；各格式修改分别暂存，切回不丢失；保存时持久化当前格式配置

## Out of Scope

- 结构化输出（Output.object）接入元数据校准——属于 08-13 任务，本任务仅预留泛化
- streaming 流式 UI
- 多 provider 并存切换（同时配置多个账号）——本任务仅单格式单配置
- 移除或修改错误码体系（保留现有 8 种）
- AI 翻译之外的既有翻译 provider（Google/Azure/Yandex）改动

## Technical Notes

- AI SDK provider 实例按需创建：OpenAI 兼容 → `createOpenAICompatible({ baseURL, fetch })`（chat 协议）；OpenAI 官方 Responses → `createOpenAI().responses()`；Anthropic → `createAnthropic({ baseURL, fetch })`；DeepSeek → `createDeepSeek({ baseURL, fetch })`
- 消息格式枚举需落入 `AiSettings`（`format: 'openai-chat' | 'openai-responses' | 'anthropic' | 'deepseek'`），旧配置迁移默认 `'openai-chat'`（惰性迁移）
- 需要 spike 验证：① AI SDK + tauriFetch 注入实测连通 ② 浏览器端非流式 generateText ③ bundle 增量与 legacy webpack 构建 ④ 可选/无 apiKey 场景（undefined 不触发 SDK 环境变量回退）与本地无 key 兼容端点 ⑤ 固定相互兼容的精确依赖版本
- 测试重写面：aiClient.test.ts 的请求体断言改为对 SDK 的集成/契约测试

## Notes

- 复杂度：中高（依赖引入 + 配置迁移 + 客户端协议分化 + 测试重写 + Tauri/web 双端验证）→ 需 design.md + implement.md
- 创建任务 ≠ 实现批准；规划终审 + 主人批准后再 `task.py start`

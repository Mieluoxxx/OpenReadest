# AI SDK Integration Contract (2026-08-13)

Vercel AI SDK（`ai@7.0.62` 系）已替换手写 OpenAI 客户端。AI 相关改动必须遵循本契约。

## 模块边界

- `src/services/ai/aiProviderFactory.ts` 是**唯一** SDK provider 感知模块：`createAiModel(config)` 按 `format` 建模型（openai-chat→`createOpenAICompatible`、openai-responses→`createOpenAI().responses()`、anthropic→`createAnthropic`、deepseek→`createDeepSeek`），统一注入平台 fetch（Tauri→`tauriFetch`，web→`window.fetch`）。
- **实例不缓存**：每次按 config 现建，避免持有过期 apiKey。
- `src/services/ai/aiClient.ts` 是包装层：`requestAiCompletion(config, messages, options)` + `requestAiTranslation`（翻译薄封装）+ `testAiConnection`。SDK 负责协议/重试，包装层保留限流 ×3（`runWithRequestSlot`）、同请求去重（key 含 format）、30s **总截止**超时（含重试，非每次重试各 30s）。

## SDK v7 关键契约（易踩坑）

- **system 消息不能放 `messages`**：AI SDK v7 禁止 system 出现在 messages，须拆到 `instructions` 选项（SDK 转请求体 system）。`splitSystemMessages` 已处理。
- **错误映射**：`APICallError`（name=`AI_APICallError`，含 statusCode/isRetryable）→ 按 HTTP 分类（401/403→AUTH_FAILED、429→RATE_LIMITED、4xx→ENDPOINT_OR_MODEL_ERROR、5xx→SERVER_ERROR，2xx 解析失败→BAD_RESPONSE）；`NoSuchModelError`→ENDPOINT_OR_MODEL_ERROR；`RetryError`（**无 statusCode**）→ 取 `lastError` 递归；`AbortError`→TIMEOUT；网络特征→NETWORK。
- **无 apiKey**：传 `undefined` 不发送 Authorization 头、不触发 env 回退（已验证）。
- **provider 实例是 callable**：`createOpenAICompatible(...)` 实例直接 `provider('model-id')` 调用（own keys 含 `chatModel/languageModel`），**没有 `.chat()` 方法**。

## 配置迁移

- `AiSettings.format?: AiFormat`（`'openai-chat' | 'openai-responses' | 'anthropic' | 'deepseek'`）。
- 无 format 旧配置 → **一律归一 `'deepseek'`**（2026-08-13 主人决议；面板展示旧 baseUrl/model 值，仅 format 归一）。
- AiPanel 每格式内存草稿：`useState<Record<AiFormat, {baseUrl; model}>>`，切换不清空、首次选中填预设、切回不丢失；保存持久化当前格式。
- 翻译缓存命名空间必须含 format（`ai:${md5(format|baseUrl|model|version)}`）。

## 部署门：lookbehind 检查器

`check:lookbehind-regex` 已升级为 AST 语义检查器（`scripts/check-lookbehind-regex.mjs`，acorn@8.15.0 pin）：

- 原始意图（fd7f9023）：iOS <16.4 WebKit 无法**解析** lookbehind **正则字面量**（加载即崩）。
- 只对**可执行**的 lookbehind 失败：正则字面量 `/(?<=x)y/`、静态 `RegExp('(?<=x)y')` 构造。
- **字符串/模板字符串放行**（如 AI SDK 的 `` `(^|(?<=[\r\n]))` ``——JSON schema pattern 数据，非代码）。
- 不要改回字符串 grep；新增 lookbehind 正则字面量会被抓（fixtures 已验证）。

## 依赖

- pin 精确版本：`ai@7.0.62`、`@ai-sdk/openai@4.0.40`、`@ai-sdk/openai-compatible@3.0.30`、`@ai-sdk/anthropic@4.0.38`、`@ai-sdk/deepseek@3.0.28`（AI SDK 大版本更新快，升级需重跑 spike 验证）。
- 浏览器客户端直连为非官方路径：仅用非流式 `generateText`；streaming 有 ReadableStream 已知问题（vercel/ai#5074 等）。

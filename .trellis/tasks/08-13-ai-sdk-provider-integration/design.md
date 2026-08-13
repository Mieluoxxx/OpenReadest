# AI SDK 集成 — 技术设计

## 1. 架构与边界

```
┌─────────────────────────────────────────────────────────────┐
│ AiPanel.tsx（格式选择器 + baseUrl/model/apiKey + 测试按钮）   │
└──────────────────────────┬──────────────────────────────────┘
                           │ AiSettings { baseUrl, model, format }
┌──────────────────────────▼──────────────────────────────────┐
│ AiConfigRepository（settings.json + ai-secrets.json）        │
└──────────────────────────┬──────────────────────────────────┘
                           │ getConfig() → AiConfig { format, baseUrl, model, apiKey }
┌──────────────────────────▼──────────────────────────────────┐
│ aiClient.ts（保留包装层）                                     │
│  · requestAiCompletion(config, messages) → SDK generateText   │
│  · runWithRequestSlot ×3 限流 / inFlightRequests 去重        │
│  · 30s AbortController 超时                                  │
│  · SDK 错误 → 8 种 AiErrorCode 归一映射                       │
└──────────────────────────┬──────────────────────────────────┘
                           │ model: LanguageModel
┌──────────────────────────▼──────────────────────────────────┐
│ aiProviderFactory.ts（新增）                                  │
│  · format → provider 实例（createOpenAICompatible/             │
│    createOpenAI/createAnthropic/createDeepSeek），注入平台 fetch│
│  · openai-chat → compatible chat；openai-responses →           │
│    openai.responses()；anthropic → messages；deepseek → chat    │
└──────────────────────────┬──────────────────────────────────┘
                           │ fetch: tauriFetch | window.fetch
                 ┌─────────▼─────────┐
                 │ 各 provider HTTP API │
                 └───────────────────┘
```

**边界**：

- `aiProviderFactory.ts` 是本任务新增的唯一 SDK 感知模块；`aiClient.ts` 不直接 import SDK provider 包，只依赖 `LanguageModel` 类型与 `generateText`。
- 配置存储（AiConfigRepository）、UI（AiPanel）、调用入口（translators/providers/ai.ts 的 `requestAiTranslation` 签名）保持外部契约不变，只改内部实现。
- 08-13 元数据校准：本任务先完成 SDK 集成并导出 `createAiModel(config)` 与 `requestAiCompletion(config, messages)` 通用入口（字符串输出）；08-13 落地时**必须刷新其 design** 对齐本工厂。结构化输出（`Output.object()`）**不在字符串 API 上硬搭**——本任务不做，08-13 若需结构化结果，另行规划 `requestAiStructured<T>(config, schema)` 包装（复用同一 `createAiModel`），两个任务均不承诺在字符串 API 上实现结构化生成。

## 2. 契约

### 2.1 类型

```ts
export type AiFormat = 'openai-chat' | 'openai-responses' | 'anthropic' | 'deepseek';

// AiSettings 扩展（src/types/settings.ts）
interface AiSettings {
  baseUrl: string;
  model: string;
  format?: AiFormat; // 缺失 = 旧配置 → 解析为 'openai-chat'
}

interface AiConfig {
  format: AiFormat;
  baseUrl: string;
  model: string;
  apiKey?: string;
}
```

### 2.2 入口函数（aiClient.ts）

```ts
export const requestAiCompletion = (
  config: AiConfig,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: { temperature?: number },
): Promise<string>;
// 保留导出（翻译包装）
export const requestAiTranslation = (
  config: AiConfig, text: string, sourceLang: string, targetLang: string,
): Promise<string>;
// 保留导出（连接测试）
export const testAiConnection = (draft: { format: AiFormat; baseUrl: string; model: string; apiKey?: string }): Promise<TestAiConnectionResult>;
```

- `requestAiCompletion` 内部：`generateText({ model: createAiModel(config), messages, temperature, abortSignal, maxRetries: 2 })`，外层套 `runWithRequestSlot` + `inFlightRequests` 去重（key 加入 format）。
- `requestAiTranslation` 内部改为调用 `requestAiCompletion(config, [system, user])`，`AI_PROMPT_VERSION` 保留参与缓存命名空间。
- **另导出 `createAiModel(config: AiConfig): LanguageModel`**（供 08-13 后续结构化输出 / 其他用途直接复用模型工厂，不经过字符串包装）。

### 2.3 错误归一映射（SDK → AiErrorCode）

| SDK 错误                         | 映射                                                                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `APICallError`（含 statusCode）  | 复用现有 `classifyHttpError(status)`：401/403→AUTH_FAILED、429→RATE_LIMITED、4xx→ENDPOINT_OR_MODEL_ERROR、5xx→SERVER_ERROR |
| `AbortError`（abortSignal 触发） | TIMEOUT                                                                                                                    |
| `NoSuchModelError`               | ENDPOINT_OR_MODEL_ERROR                                                                                                    |
| `RetryError`（maxRetries 耗尽）  | 取 `lastError` 递归映射                                                                                                    |
| 其余（网络/解析）                | NETWORK / BAD_RESPONSE                                                                                                     |

SDK 错误类的具体导出名（`APICallError` 等）与字段以安装版本为准，spike 阶段确认后固化到映射函数。

### 2.4 平台 fetch 注入

```ts
// 类型化适配：tauriFetch 与 SDK fetch 签名（RequestInfo/RequestInit → Promise<Response>）对齐，
// 由 spike S7 确认 tauriFetch 的入参/返回值兼容性；不兼容时包一层薄适配器做归一。
const platformFetch = isTauriAppPlatform() ? tauriFetch : (fetch as typeof tauriFetch);
// 注入每个 provider 实例（openai-compatible/openai/anthropic/deepseek 均支持 fetch 选项，已调研确认）
```

- **实例不缓存**：`createAiModel` 每次按 config 现建 provider 实例（工厂创建开销可忽略），避免缓存持有过期 apiKey；调用方按需 memo 自行决定。

## 3. 兼容性与迁移

- **settings.json 迁移**：`globalAiSettings` 无 `format` → `AiConfigRepository.getConfig()` 归一为 `'openai-chat'`；不写回（惰性迁移，避免迁移写盘副作用），下次保存配置时落盘。
- **面板默认值**：新建/重置时 `format = 'deepseek'`（新配置默认）；加载旧配置（无 format）时展示 `'openai-chat'`（行为等价现有）。
- **格式切换联动（已决议：每格式内存草稿）**：切换格式时不清空输入框；某格式首次被选中时填入该格式预设值；各格式的修改在内存中分别暂存（`useState<Record<AiFormat, { baseUrl; model }>>`），切走再切回不丢失。保存时持久化当前选中格式的配置。
- **缓存命名空间**：`translators/providers/ai.ts` 的 `getCacheNamespace()` 需纳入 format（`ai:${md5(format|baseUrl|model|version)}`），避免切换格式后命中旧缓存。
- **`normalizeBaseUrl`**：SDK 接管 URL 拼接后废弃；其单测删除，`aiClient.test.ts` 相应段移除。若 AiPanel 或他处仍引用需一并清理（当前仅测试引用）。
- **重试语义**：SDK `maxRetries: 2` 替代手写循环。验证点：SDK 对 429/5xx/网络错误确实重试（spike 用 mock fetch 断言调用次数）；若不满足，回退 `maxRetries: 0` + 保留手写 `isRetryableAiError` 循环。
- **超时语义（行为变化）**：单个 30s `abortSignal` 为整个操作（含重试）的总截止，替代原「每次重试各 30s」。确认这是有意简化，非 bug。

## 4. 关键权衡

| 决策                                                                        | 权衡                                                                                                                               |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 引入 SDK（5 个包：ai + openai + openai-compatible + anthropic + deepseek）  | 获得多协议统一 + 未来结构化输出/工具调用/多 provider 生态；代价是 bundle 增量 + 浏览器端非官方路径 + 依赖升级跟进                  |
| 引入 `@ai-sdk/openai-compatible`（openai-chat 用 `createOpenAICompatible`） | 兼容端点的正确抽象——`createOpenAI().chat()` 是 OpenAI 专属实现，对非标兼容服务支持弱（无 transformRequestBody 等）；代价是多一个包 |
| SDK 接管重试                                                                | 删代码但重试条件与现有实现有差异风险；spike 验证 + 测试断言兜底                                                                    |
| 惰性迁移不写盘                                                              | 避免启动副作用；代价是 format 落盘延迟到下次保存                                                                                   |

## 5. 运维与回滚

- **Spike 门（implement 第 0 步）**：三项验证任一失败即停，回退为「手写客户端扩展」方案（届时更新 prd/design 决策，与主人重新确认）。
- **回滚**：纯前端改动，无 schema/DB 变更；settings.json 的 format 字段对旧版本无害（旧代码忽略未知字段）。回滚 = revert 代码 + 依赖移除，无需数据迁移。
- **双端验证**：桌面（tauri dev 实测各格式翻译 + Test 按钮）、web（`pnpm build-web` + `pnpm check:all` + bundle 增量记录）。

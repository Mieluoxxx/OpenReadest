# OpenReadest AI 翻译集成设计（OpenAI 兼容 API + 阅读器翻译体系扩展）

日期：2026-08-07
状态：草案 v3 —— 已按 advisor 审查修订（v2，12 项意见全部纳入）并按产品拍板定稿（v3，§10 开放问题 1/2/4 关闭，新增失败占位行为）
场景：在现有划词翻译 / 整页双语翻译体系中，新增"AI 翻译"服务选项，由用户自定义 OpenAI 兼容 Base URL 与模型

---

## 1. 目标

在**不改动现有翻译行为与阅读器逻辑**的前提下，把 AI 翻译作为翻译服务的新选项接入：

1. **设置新增"AI"面板**：Base URL、模型、可选 API Key、测试连接、清除 Key，配置全局生效。
2. **翻译服务新增"AI 翻译"**：划词翻译（`TranslatorPopup`）与整页双语翻译（`useTextTranslation`）均可选择该服务。
3. **复用现有体系**：缓存、目标语言、显示原文/译文、预加载机制全部沿用，仅新增一个 `TranslationProvider` 实现与配置接入。

明确边界：**AI 服务由客户端直连用户配置的 Base URL，不新增 OpenReadest 业务后端、不把书籍文本上传到 OpenReadest 服务器**。隐私措辞见 §6：不做整书批量上传，但通读全书会逐步发送每个被翻译的文本块。

## 2. 已确认的产品边界

### 2.1 主流程与关键决策（已确认）

`设置 → AI 面板配置 Base URL / 模型（可选 API Key）→ 阅读设置"翻译服务"选择"AI 翻译" → 划词 / 整页懒加载走 AI 服务`。

产品已拍板（v3）：

- **API Key 存储**：选项 a —— 本地独立明文秘密文件（`Settings/ai-secrets.json`，不进 `settings.json`、不随云同步），UI 明确提示风险。
- **Base URL 协议**：不强制 HTTPS，允许 http/https 与本地地址完全放开。
- **翻译失败处理**：**不自动回退**到其他服务；整页翻译中无法翻译的文本块在原文后插入**表示失败的文字**占位（§4.8）。

### 2.2 一期包含

- 设置新增"AI"面板（独立 tab，扩展现有面板体系；草稿字段 + 显式保存/测试，见 §5）。
- 翻译服务下拉新增 `AI 翻译` 选项；未配置时标记"未配置"，选择后引导前往 AI 面板，**不发起无效请求**。
- `aiProvider`：OpenAI 兼容 Chat Completions 实现，仅替换请求目的地；Base URL 规范化（§4.2）。
- 配置接入：`AiConfigRepository` 统一读取 Base URL / 模型 / API Key；**API Key 可选**（支持无鉴权服务如 Ollama）。
- 缓存：AI 译文入现有翻译缓存，**缓存维度由 provider 级 `getCacheNamespace()` 提供**（含 baseUrl + model + 提示词版本指纹），避免换模型/换地址命中旧译文（§4.4）。
- 测试连接：AI 面板一键发最小请求（用当前草稿配置），分类展示失败原因。
- 错误处理：未配置 / 鉴权失败 / 端点或模型错误 / 超时 / 限流 / 响应格式不符（保守分类，§4.6）。
- **整页翻译失败占位**：无法翻译的文本块显示失败占位文字（§4.8）；不自动回退。
- 隐私提示：AI 面板内说明"译文原文会发送到你配置的服务"。
- 清除 API Key：单独操作，不连带删除 Base URL / 模型。

### 2.3 一期不包含

- 总结、问答、词汇解释、润色等"AI 阅读助手"功能（另立项）。
- 多模型路由 / 负载均衡 / 用量统计 / 计费。
- 流式（SSE）翻译、系统提示词模板编辑器、温度/参数调节。
- 移动端 AI 面板适配的专项工作（随现有移动端排期，见 §2.4 平台范围）。
- 服务端代理、密钥托管、配额管理（用户明确不需要业务后端）。
- 翻译失败时的自动服务降级 / 重试链（明确不自动回退）。

### 2.4 平台范围

与现有翻译体系一致：`isTauriAppPlatform() ? tauriFetch : window.fetch` 双分支（已核实于三个现有 provider）。桌面端走 Tauri HTTP 插件；Web 部署走浏览器 fetch，自定义 Base URL 受目标服务 CORS 策略约束（§7.3）。

## 3. 总体架构

```
┌── 设置 ────────────────────────────────────────────────────────┐
│  SettingsDialog → 新增 tab "AI" → AiPanel（草稿 + 保存/测试）     │
│    Base URL / 模型 / API Key(可选) / 测试连接 / 清除 Key / 隐私提示│
│    → 非敏感字段 globalAiSettings（SystemSettings）              │
│    → API Key 本地明文秘密文件 Settings/ai-secrets.json（§4.3）   │
├── 阅读器翻译（行为不变）────────────────────────────────────────┤
│  TranslatorPopup（划词）  /  useTextTranslation（整页懒加载）     │
│    → useTranslator（缓存/preprocess/polish）                    │
│       cacheNamespace = provider.getCacheNamespace() ?? name     │
│    → aiProvider.translate(texts, source, target)               │
│       AiConfigRepository.getConfig()                           │
│       POST {normalizedBaseUrl}/chat/completions（逐条，有界并发）│
│       tauriFetch（桌面）/ window.fetch（Web）                    │
│    失败 → 整页翻译原文块后插入失败占位文字（§4.8），不自动回退      │
└───────────────────────────────────────────────────────────────┘
```

分层职责：

1. `services/translators/providers/ai.ts`：OpenAI 兼容请求构造、Base URL 规范化、响应解析、错误归一；不感知 React。
2. `services/ai/AiConfigRepository.ts`：配置读写 accessor（封装对设置 store 与秘密存储的访问），供 provider 与 AiPanel 共用；**aiProvider 不直接 import 设置 store**（依赖经此 accessor 注入）。
3. `components/settings/AiPanel.tsx`：AI 配置 UI（新建，参照 `IntegrationsPanel`/`LangPanel` 模式）。
4. `types/settings.ts` + `store/settingsStore.ts`：`globalAiSettings`（仅非敏感字段）状态与持久化。
5. 现有 `useTranslator` / `TranslatorPopup` / `useTextTranslation`：仅把 `ai` 视为普通 provider；缓存维度适配见 §4.4，失败占位见 §4.8。

## 4. 核心集成

### 4.1 现状（已核实）

- **Provider 体系**：`TranslationProvider { name, label, authRequired?, quotaExceeded?, translate(texts, sourceLang, targetLang, token?, useCache?) }`（`services/translators/types.ts:3`）。`providers/index.ts` 的 `availableTranslators = [azure, google, yandex]`，`TranslatorName` 由数组推导（`index.ts:22`）。新增 provider 只需追加实现并入数组。
- **翻译调用链**：`useTranslator`（`hooks/useTranslator.ts:51`）在调用 `translator.translate` **前后**读写缓存（`getFromCache`/`storeInCache`，`services/translators/cache.ts`）、`preprocess`、`polish`；`TranslatorPopup`（`reader/components/annotator/TranslatorPopup.tsx:36`）与 `useTextTranslation`（`reader/hooks/useTextTranslation.ts:10`）都通过 `useTranslator` 取 `translate`，不直接接触 provider 细节。**缓存 key 由 `useTranslator` 层决定，provider 内部无法自行控制**（重要约束，见 §4.4）。
- **划词翻译**：`TranslatorPopup` 选中文本后 `translate([text])`，底部下拉切换 provider（`handleProviderChange`，`TranslatorPopup.tsx:62`）。失败时 Popup 内已展示错误文案（`setError`）。
- **整页翻译**：`useTextTranslation` 用 `IntersectionObserver` 懒加载，视口附近文本块逐块翻译、预翻译后 2 块（`useTextTranslation.ts:78`）；`translateInRange` 按选区范围批量翻译（`useTextTranslation.ts:244`）。**不会一次性翻译全书**。`translateElement`（`useTextTranslation.ts:130`）的 `catch (err)` 分支当前**仅 `console.warn` 静默失败，不插入任何占位**；"无译文或译文==原文"直接 return 不插入。
- **缓存键**：`getCacheKey = ${provider}:${sourceLang}:${targetLang}:${text}`（`cache.ts:73`），`CacheEntry.provider` 记录 provider 名；`clearCache({ provider })` 按 key 前缀 `parts[0]` 匹配（`cache.ts:100`）。**不含模型/地址维度**。
- **网络层**：google/azure/yandex 均 `isTauriAppPlatform() ? tauriFetch : window.fetch`（`providers/google.ts:12` 等）。Tauri 侧 `capabilities/default.json` 的 `http:default` 已**通配放行任意 `http://*`/`https://*` URL**（`default.json:113-121` 已核实），当前自定义 Base URL 不受 capability 限制；仍列入 spike 验证（§7.3，防未来 scope 收紧）。
- **设置存储**：`SystemSettings`（`types/settings.ts:49`）含 `globalReadSettings`/`globalViewSettings`，经 `appService.safeSaveJSON(SETTINGS_FILENAME, ...)` 持久化（`services/appService.ts:280`，明文 JSON）。**当前无系统钥匙串/加密存储方案**（已 grep 确认无 keyring/stronghold/secure-store 依赖）。**当前无设置导出/备份/云同步设置的功能**（WebDAV 与 KOSync 同步的是书、进度、笔记，不含 `settings.json`，已核实）。
- **设置面板**：`SettingsPanelType = 'Font'|'Layout'|'Color'|'Control'|'Language'|'Integration'|'Custom'`，`tabConfig` 数组 + `activePanel === 'X' && <XPanel/>` 条件渲染（`components/settings/SettingsDialog.tsx:26,269`）。
- **Provider 选择**：`getAvailableTranslator` 过滤 `(authRequired ? !!token : true) && !quotaExceeded` 后匹配，**未命中静默回退到第一个可用 provider**（`hooks/useTranslator.ts:10`）。`authRequired` 语义 = "需要 OpenReadest 登录 token"。

### 4.2 AI Provider 设计

新建 `services/translators/providers/ai.ts`：

```ts
export const aiProvider: TranslationProvider = {
  name: 'ai',
  label: _('AI Translate'),
  // 不使用 authRequired（该字段 = 需要 OpenReadest 登录 token）；AI 可用性由 AiConfigRepository 判定（§4.5）
  getCacheNamespace: () => `ai:${hash(baseUrl + '|' + model + '|' + AI_PROMPT_VERSION)}`, // §4.4
  translate: async (texts, sourceLang, targetLang): Promise<string[]> => {
    const config = AiConfigRepository.getConfig();
    if (!config) throw new AiNotConfiguredError();
    // 逐条非空文本发请求（有界并发，如 4），按源索引回填——不从自由格式响应解析多段译文
    // 构造 messages：[system 固定提示词, user 原文]
    // 解析 choices[0].message.content 作为该条译文
    // 失败按 §4.6 归一错误
  },
};
```

关键行为：

- **接口签名不变**：`translate(texts, source, target)`，`token`/`useCache` 参数沿用但不依赖；与 google/azure/yandex 一致，`useTranslator` 无需感知 AI 特有逻辑。
- **System 提示词（固定、带版本号 `AI_PROMPT_VERSION`）**：要求"只返回译文、保留段落结构、不加解释/标题/Markdown、专有名词保持一致"。版本号参与缓存命名空间（§4.4）。
- **API Key 可选**：仅当配置存在 key 时附加 `Authorization: Bearer <key>` 头；无 key 直接请求（兼容 Ollama 等本地无鉴权服务）。配置完整判定 = `baseUrl && model`（key 非必需）。
- **Base URL 规范化（确定性）**：用户提供 API 根地址（如 `https://host/v1`）→ trim 尾部 `/` → 追加 `/chat/completions`；若输入已以 `/chat/completions` 结尾则直接使用（或确定性拒绝，实现时二选一并写死）。不依赖用户手动拼完整 endpoint。
- **协议不强制 HTTPS**：http/https 均允许（产品拍板），UI 提示明文传输风险。
- **请求体**：`POST {normalizedBaseUrl}`，`model`、`messages`、`temperature`（一期固定值，不开放 UI）。
- **超时/取消**：`AbortController`，默认 30 s 可配；遵循现有整页懒加载时序（翻页过期文本块自然丢弃结果，不额外引入队列）。
- **内容边界**：每次请求只携带一条当前翻译文本（`translateInRange` 的多块经有界并发逐条发出）。**不得聚合全书文本**。

### 4.3 AI 配置：存储与读取

- `AiConfig { baseUrl, model, apiKey? }`。拆分为两类存储：
  - **非敏感字段** `baseUrl`/`model` → `SystemSettings.globalAiSettings`（随现有 `safeSaveJSON` 持久化，可正常参与设置生命周期）。
  - **`apiKey` → 不进 `settings.json`**，单独存入本地独立明文秘密文件（**产品拍板：选项 a**，如 `Settings/ai-secrets.json`，与 settings.json 分开、不随云同步）。UI 明确提示"API Key 以明文保存在本机配置文件中，请自行评估风险"。
- 读取入口：`AiConfigRepository.getConfig()` 聚合两处存储，返回完整 `AiConfig`。**不依赖 React 渲染上下文**（provider 是纯函数模块；store 读取集中在 Repository 内，不经 provider 直接 import）。
- 完整判定：`baseUrl && model` 齐全即"已配置"（key 可选）；`baseUrl`/`model` 任一缺失为"未配置"。

### 4.4 缓存命名空间（关键适配点）

**约束**：`useTranslator` 在调用 `translate` 前后读写缓存，key 由它决定（§4.1）——AI 无法在 provider 内部自行加指纹。设计：

- 给 `TranslationProvider` 增加可选回调 `getCacheNamespace?: () => string`。
- `useTranslator` 计算 `cacheNamespace = translator.getCacheNamespace?.() ?? selectedProvider`，并把 `cacheNamespace` 传入**所有** `getFromCache`/`storeInCache` 调用（替换现用的 provider 名）。
- AI 的 `getCacheNamespace()` 返回 `ai:${hash(baseUrl|model|AI_PROMPT_VERSION)}` ⇒ 换模型 / 换 Base URL / 提示词版本变更 → 新命名空间 → 缓存隔离，**不命中旧译文**；google/azure/yandex 未实现该回调，行为与现状完全一致。
- **清理语义**：`clearCache({ provider })` 现按 key 前缀 `parts[0]` 匹配（`cache.ts:100`）。AI 各命名空间前缀均为 `ai`，故 `clearCache({ provider: 'ai' })` 清空全部 AI 缓存（可接受）；如需精确到某指纹，传完整 `cacheNamespace`。`CacheEntry.provider` 字段存完整 `cacheNamespace`，与 key 前缀一致。

### 4.5 接入点与"行为不变"的保障

- **AI 可用性判定**：不依赖 `authRequired`（= 需要 OpenReadest 登录 token）。`getAvailableTranslator` 的过滤对 `ai` 恒放行（`authRequired: undefined`），可用性由 `AiConfigRepository.isConfigured()` 判定；未配置时在 UI 标记"未配置"，不发起请求。
- **LangPanel 翻译服务下拉**（`components/settings/LangPanel.tsx:296`）：`getTranslationProviderOptions` 由 `getTranslators()` 生成，`ai` 自动出现。未配置 → label 追加 `（未配置）`，选择后触发跳转 AI 面板或 toast（不静默保存）。
- **TranslatorPopup 下拉**（`TranslatorPopup.tsx:62` `handleProviderChange`）：现有逻辑对不可用 provider **静默回退到 `availableTranslators[0]`**，用户选"AI 翻译"会被悄悄换成 Google——必须处理：AI 未配置时**不在可用列表**（选项仍显示但标记未配置，选中即引导配置），或选择后立即 toast"请先配置 AI"，**禁止静默降级**。
- **`useTranslator` 的 quota 自动降级**（`hooks/useTranslator.ts:152`）：仅对 `ErrorCodes.DAILY_QUOTA_EXCEEDED` 触发 fallback。AI 的 429/限流不得复用该错误码，避免把 AI 限流误判为服务不可用而静默切回 Google（§4.6）。**产品拍板：整页翻译失败不自动回退**（§4.8）。
- **整页翻译**：`useTextTranslation` 的懒加载、`translateInRange`、原文/译文切换逻辑零改动，仅 `viewSettings.translationProvider = 'ai'` 时路由到 AI；失败占位见 §4.8。

### 4.6 错误处理（归一，保守分类）

AI Provider 抛错 → 归一化错误码 → UI 提示。**分类只断言可确定的层级**，不因 status/body 子串匹配就声称精确根因：

| 归一错误码                | 可确定依据                                        | UI 提示（示例）                             |
| ------------------------- | ------------------------------------------------- | ------------------------------------------- |
| `NOT_CONFIGURED`          | 配置缺失（baseUrl/model 不全）                    | 请先在设置中配置 AI 服务                    |
| `AUTH_FAILED`             | 401/403                                           | API Key 无效或已过期                        |
| `ENDPOINT_OR_MODEL_ERROR` | 4xx（404 等）无法区分 endpoint 还是模型时统一归类 | 请求被服务拒绝（Base URL 或模型可能不正确） |
| `RATE_LIMITED`            | 429                                               | 请求过于频繁或额度用尽                      |
| `TIMEOUT`                 | AbortController 触发                              | 请求超时，请重试                            |
| `BAD_RESPONSE`            | 非 200 且无法按 OpenAI 兼容格式解析               | 服务不兼容 OpenAI 协议                      |
| `NETWORK`                 | fetch 级网络异常                                  | 网络错误，请检查连接                        |

**约束**：AI 错误一律不触发 `useTranslator` 的自动降级；恢复 Google/Azure 由用户手动切换。

### 4.7 测试连接

`AiPanel` 内"测试连接"→ `testAiConnection(draftConfig)`（**使用当前草稿**，非已保存值）：

- 发最小 Chat Completions 请求（极短文本，如 `translate "test"`）。
- 返回 `ok / error{ code, message }`，复用 §4.6 归一错误码，UI 就地展示。
- 不写缓存、不污染翻译状态；按钮带 loading 态。

### 4.8 整页翻译失败占位（产品拍板新增）

现状 `translateElement` 的 `catch` 只 `console.warn`（§4.1），翻译失败在整页翻译中无任何可见反馈。设计：

- **行为**：`translateElement` 的 `catch (err)` 分支改为在原文元素后插入**失败占位元素**：类名 `translation-target translation-failed`，文案为 i18n 的"翻译失败"（统一占位，不细分具体错误原因，避免泄露端点/模型细节）。
- **占位生命周期**：失败占位复用 `translation-target` 类体系 → 自动纳入现有 `toggleTranslationVisibility`（`useTextTranslation.ts:35`）与 `updateTranslation`（`useTextTranslation.ts:66`）的显隐/清理范围；重试成功时占位被译文替换。
- **重试语义**：`translateElement` 开头的去重判断 `el.querySelector('.translation-target')` 会同时拦下失败占位（同属 translation-target），故**已失败的块在本次渲染内不自动重试**；重新进入视口 / 重开书（内存清空）可重试。这与现有"译文==原文不插入"的返回语义一致，不引入新重试链。
- **划词翻译**：`TranslatorPopup` 已用 `setError` 展示失败文案（§4.1），**不适用**失败占位，保持现状。
- **范围**：所有 provider（google/azure/yandex/ai）失败统一走占位，行为一致。

## 5. 设置 UI（AiPanel）

参照 `IntegrationsPanel`/`LangPanel` 的既有样式（`card`/`config-item`/`Select` 体系）：

- **AI 翻译（总述）**：简短说明 + 隐私提示（"译文原文会发送到你配置的服务；通读全书会逐步发送每个被翻译的文本块"）。
- **Base URL**：文本输入，占位默认 OpenAI 兼容地址（如 `https://api.openai.com/v1`）；**http/https 均允许，不强制 HTTPS**（产品拍板），对非 HTTPS 地址提示明文传输风险。
- **API Key（可选）**：密码输入框，显示/隐藏切换；留空表示无鉴权（支持 Ollama 等）；不写入日志；**以明文保存在本机秘密文件中**（§4.3），面板内提示。
- **模型名称**：文本输入，如 `gpt-4o-mini`。
- **保存 / 测试连接 / 清除 API Key**：草稿字段 + 显式**保存**按钮（避免 API Key 每键即存）；**测试**用当前草稿（可未保存即测）；**清除 Key** 独立操作，保留 Base URL/模型。
- **配置状态**：`已配置 / 未配置`，供 LangPanel 与 TranslatorPopup 标记复用。

挂载：`SettingsDialog.tsx` 的 `SettingsPanelType` 增加 `'AI'`、`tabConfig` 增加一项（图标可复用 `RiSparklingLine` 等）、条件渲染新增 `<AiPanel bookKey onRegisterReset={...} />`。

## 6. 用户流程与隐私措辞

**主流程**：设置 → AI 面板 → 填 Base URL/模型（可选 Key）→ 测试连接成功 → 保存 → 阅读设置"翻译服务"选"AI 翻译" → 划词弹出 AI 译文 / 开启整页翻译后按阅读位置懒加载 AI 译文；失败块显示"翻译失败"占位。

**未配置兜底**：选"AI 翻译"但未配置 → 不发起请求，提示前往 AI 面板配置。

**隐私**：不把整本书批量上传；但**通读开启整页翻译的书会逐步把每个进入视口的文本块发送到你配置的服务**（与现有 google/azure/yandex 行为一致）。API Key 不写入日志、不随 UI 错误信息展示、不进 `settings.json`（存本机独立明文秘密文件，§4.3）。Base URL 非 HTTPS 时译文原文为明文传输，UI 提示用户自担风险。

## 7. 依赖与平台风险

### 7.1 依赖

- 无新增运行时依赖（复用 `@tauri-apps/plugin-http`、现有设置/缓存体系；秘密文件沿用文件系统能力）。

### 7.2 风险

- **API Key 明文落盘**（产品已拍板接受）：本机独立明文秘密文件，本地文件权限由 OS 保障；UI 明确提示。未来若引入设置导出/备份，需显式排除该文件。
- **任意端点访问与凭据泄露**：自定义 Base URL 允许客户端直连任意本地/网络端点（非服务端 SSRF，纯客户端行为）。用户自担风险。
- **非 HTTPS 明文传输**：Base URL 不强制 HTTPS（产品拍板），远程明文地址的译文与 API Key 可能被中间人窃听；UI 提示。
- **成本不可控**：整页翻译懒加载虽避免全书，但长文本页/频繁翻页仍可能产生较多 token；提示词固定小体量 + 缓存命中缓解。

### 7.3 平台风险

- **Web 版 CORS**：自定义 Base URL 在 Web 部署下受目标服务 CORS 限制（`window.fetch` 分支）；桌面端 `tauriFetch` 无此限制。
- **Tauri capability**：当前 `http:default` 已通配放行任意 URL（§4.1 已核实），但**列入 spike 验证项**——未来若收紧 scope，自定义 Base URL 需同步加白名单。
- 移动端（Android/iOS）随现有平台排期验证。

## 8. 验收标准

### 8.1 一期验收

1. 设置新增 AI 面板：Base URL / 模型 / API Key(可选) / 保存 / 测试连接 / 清除 Key / 隐私提示均可用；草稿 + 显式保存，API Key 不随每次输入落盘。
2. 测试连接对 §4.6 各类失败给出正确归一提示；成功返回 ok。
3. 翻译服务下拉与划词下拉出现"AI 翻译"；未配置时正确标记，选择后引导配置，**不发起无效请求、不静默回退到其他服务**。
4. 配置完整后：划词翻译走 AI 并返回译文；整页翻译懒加载走 AI，原文/译文切换与既有行为一致。
5. **失败占位**：整页翻译中 AI（及既有服务）请求失败时，原文块后显示"翻译失败"占位；占位随"显示原文/译文"切换正确显隐，重开书后可重试；划词翻译失败仍显示 Popup 内错误文案。
6. **不自动回退**：AI 失败（含 429/超时/未配置）不切换到 Google/Azure/Yandex，仅显示占位。
7. 缓存：AI 译文命中缓存不重复请求；**更换模型或 Base URL 后缓存隔离（不命中旧译文）**；AI 与 google/azure/yandex 缓存互不污染；`clearCache({ provider: 'ai' })` 语义正确。
8. 隐私：仅发送当前翻译文本，无整书上传路径；API Key 不在 UI 日志/错误信息中展示、不进 `settings.json`。
9. 既有回归：google/azure/yandex 划词与整页翻译行为不变（缓存键、降级、UI 文案不受影响）；无 key 的本地服务（Ollama）可正常翻译；**非 HTTPS Base URL 可正常连接**。
10. Base URL 规范化：尾斜杠、`/chat/completions` 结尾、空值三种输入行为确定且不产生错误请求。

### 8.2 回归与测试

- 新增：`aiProvider` 单元测试（请求构造、Base URL 规范化、响应解析、错误归一、未配置分支、无 key 分支）；`AiConfigRepository` 配置判定与秘密文件读写；`getCacheNamespace` 指纹隔离（换模型/换地址/提示词版本）；`testAiConnection` 各失败分支；`translateElement` 失败占位插入/清理/切换。
- 既有：翻译缓存、`useTranslator` 缓存命名空间适配、`TranslatorPopup`/`useTextTranslation` 行为回归。

## 9. 分阶段交付

| 阶段                  | 内容                                                                                                                                                                                               | 出口                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Spike（0.5–1 周）** | 确认目标 OpenAI 兼容服务响应形态（含 Ollama 无 key）；`tauriFetch` 直连自定义 Base URL 实测（含 http 地址）+ capability scope 验证；Base URL 规范化边界                                            | 各验证项记录，阻塞项有结论 |
| **一期（1–2 周）**    | `globalAiSettings` + API Key 明文秘密文件、`AiConfigRepository`、`aiProvider` + `getCacheNamespace`、AiPanel、LangPanel/TranslatorPopup 接入与未配置处理、测试连接、错误归一、**整页翻译失败占位** | §8.1 验收                  |
| **二期（可选）**      | 更多 OpenAI 兼容参数暴露、AI 阅读助手（总结/问答）                                                                                                                                                 | 按产品需求                 |

## 10. 修订记录与待确认

**v2 修订（按 advisor 审查 12 项意见）**：缓存维度改为 provider 级 `getCacheNamespace`（§4.4）；`authRequired` 语义澄清 + AI 可用性独立判定（§4.1/§4.5）；API Key 不进 `settings.json`（§4.3）；API Key 可选支持 Ollama（§4.2）；Base URL 规范化（§4.2）；逐条请求 + 有界并发（§4.2）；Tauri capability 现状核实 + spike 验证（§4.1/§7.3）；SSRF 表述更正为客户端端点访问风险（§7.2）；AiPanel 改草稿 + 显式保存（§5）；`AiConfigRepository` 消除 store 依赖矛盾（§3/§4.3）；错误分类保守化（§4.6）；隐私措辞修正（§6）。

**v3 修订（按产品拍板）**：API Key 存储定为选项 a 本地明文独立秘密文件（§4.3/§5/§6/§7.2）；Base URL 不强制 HTTPS（§4.2/§5/§7.2/§8.1）；翻译失败不自动回退 + 新增整页翻译失败占位行为（§4.8/§8.1）。开放问题 1/2/4 关闭。

**剩余待确认**：

1. 默认请求体参数（temperature 等）是否一期固定值（默认固定，不开放 UI）。
2. 移动端 AI 面板与 Web 版 CORS 的排期优先级。
3. 失败占位文案具体措辞（如"翻译失败"）与样式（灰显/斜体，随现有 translation-target 主题体系）。

**v4 实现记录（2026-08-07，核心功能已落地，tsc + 全量 vitest 240 通过）**：

- 新增 `services/ai/aiClient.ts`（Base URL 规范化 / OpenAI 兼容 Chat Completions 请求 / 错误归一 AiError / `testAiConnection`）与 `services/ai/AiConfigRepository.ts`（baseUrl+model 入 `SystemSettings.globalAiSettings`，apiKey 独立本地明文秘密文件 `Settings/ai-secrets.json`）。
- 新增 `services/translators/providers/ai.ts`（aiProvider，含 `getCacheNamespace` 指纹），注册进 `providers/index.ts`。
- `TranslationProvider` 增加可选 `getCacheNamespace`；`useTranslator` 缓存维度改用 cacheNamespace（§4.4）。
- 新增 `components/settings/AiPanel.tsx`，`SettingsDialog` 注册 "AI" tab（§5）。
- LangPanel / TranslatorPopup：AI 未配置标记 + 选择拦截 toast，禁止静默降级 / 无效请求（§4.5）。
- `useTextTranslation` 失败占位：catch 插入 `.translation-target.translation-failed`（§4.8）。
- 翻译体验优化：**侧边目录不再翻译**——`TOCView` 移除 `useTextTranslation` 调用（目录标题保持原文），`virtualItemSize` 去除翻译依赖（桌面 37 / 移动端 57 触控）。
- 测试：`services/ai/aiClient.test.ts` 12 用例（URL 规范化 / 请求体 / 无 key 分支 / 错误码归一）。
- 待后续：tauriFetch 直连自定义 Base URL 的 spike 实测（capability / signal 支持，§7.3）；AiConfigRepository 与失败占位的集成测试。

**v5 翻译体验与稳定性修订（参考 read-frog 的 provider adapter / RequestQueue / DOM 状态管理）**：

- AI 响应解析不再固定调用 `response.json()`：明确发送 `stream: false`，兼容 OpenAI JSON、SSE 与非空 `text/plain`；HTTP 200 的 HTML 网关错误页仍拒绝为 `BAD_RESPONSE`。
- 页面级请求改为全局并发 3 + 相同请求 in-flight 去重；网络、超时、429、5xx 自动指数退避重试 2 次，401/403/404/坏响应立即失败。
- 同一 DOM 元素增加 pending 去重；失败时保留原文，不再提前隐藏源文本。
- 失败 UI 改为单个紧凑、可点击/键盘重试的 `.translation-failed` 控件，不再重复追加 `Translation failed`。
- `[Image-#N]` / `[Image-N]` 图片占位文本在进入 provider 前过滤。
- 新增 `translationDom.test.ts`；AI/DOM 定向回归 20 个用例，全量 vitest 248 通过。

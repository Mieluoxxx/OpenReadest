# Scroll parity 手动验证矩阵

Date: 2026-08-12
验证主体：chromium headless (Playwright provider) 浏览器级自动化 + 本机 macOS 桌面构建；真机待补。

## 自动化已验证（53 个浏览器测试 + 367 个 node 测试）

| 场景                              | 状态      | 证据                                                                                                                                                                                                           |
| --------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EPUB 连续滚动（scrolled）         | ✅ 已验证 | `paginator-scrolled.browser.test.ts`（8 用例）：flow=scrolled、columnCount=1、mid-scroll 切换不回退、backward/forward preload、相邻节导航不闪白、视口中心章节上报                                              |
| 滚动稳定性/stabilization          | ✅ 已验证 | `paginator-stabilization.browser.test.ts`（15 用例）：stabilized 事件生命周期、容器 opacity 0→1、fill 完成、属性触发重渲染、快速导航 settle                                                                    |
| 位置恢复（background 图延迟加载） | ✅ 已验证 | `paginator-scrolled-restore.browser.test.ts`（3 用例）：scrolled 恢复不漂移到插图节；坏图/挂起图不阻塞渲染                                                                                                     |
| 竖排 vertical-rl                  | ✅ 已验证 | `paginator-vertical-rl.browser.test.ts`（9 用例）：getDirection、水平拖拽跟手、动画翻页水平滑动、右滑前进/左滑后退、legacy 上滑                                                                                |
| fixed-layout 水平滚动（含 RTL）   | ✅ 已验证 | `fixed-layout-horizontal-scroll.browser.test.ts`（11 用例）：fit-to-height 拼接、RTL 反序 + negative-scrollLeft、scroll-gap 变化保持页码、垂直 wheel 转水平、RTL 左向滚动、next() 一屏、containerPosition 双向 |
| fixed-layout wheel 防双击         | ✅ 已验证 | `fixed-layout-scroll-wheel.browser.test.ts`（1 用例）：wheel 落在页 iframe 上 JS 不二次滚动                                                                                                                    |
| 模式切换状态残留（fork 特有）     | ✅ 已验证 | `fork-mode-switch-state.browser.test.ts`（3 用例）：切换不引入 scrollLocked、app 锁跨切换被尊重、round-trip 位置节内恢复、竖排轴随模式翻转（scrollProp）                                                       |
| TTS 锚定视口（fork 特有）         | ✅ 已验证 | `fork-tts-anchor-viewport.browser.test.ts`（3 用例）：start/end 窗口几何、重复锚定同句 <1px 无抖动、视口外句子滚入视口                                                                                         |
| 设置迁移                          | ✅ 已验证 | `viewSettings.test.ts`（7）+ `serializer.test.ts`（5）：continuousScroll→noContinuousScroll、未知字段保留、幂等、round-trip                                                                                    |
| 输入/自动滚动（node）             | ✅ 已验证 | `usePagination*`、`wheelGesture`、`autoscroller`、`useAutoScroll`、`useMiddleClickAutoscroll`、`useRendererInputListeners`、`autoScrollSpeedGesture`（子任务 3/4 遗留）                                        |
| UI/TTS/标注集成（node）           | ✅ 已验证 | `ControlPanel-scrolled-toggle`、`SectionInfo-scrolled`、`ttsAnchor`、`annotatorUtil`（子任务 5 遗留）                                                                                                          |
| AI 翻译共存                       | ✅ 已验证 | `aiClient.test.ts`、`translationDom.test.ts`、`IntegrationsPanel.test.tsx`；git log 确认 translators/ai 路径未被 scroll 迁移触碰                                                                               |
| WebDAV/S3 同步                    | ✅ 已验证 | `webdav/*`、`S3ObjectStore.test.ts`、`cloudSyncStore.test.ts`、`CloudSyncCenter`、`CloudAutoSyncRunner`；同步 store 路径最后改动 `93ec3189`（迁移前）                                                          |
| 构建                              | ✅ 已验证 | `pnpm build`（tauri 平台）、`pnpm build-web`（web 平台）均通过（含 typecheck）                                                                                                                                 |

## 待真机验证（本机无对应设备/环境）

| 场景                   | 状态        | 说明                                                                             |
| ---------------------- | ----------- | -------------------------------------------------------------------------------- |
| iOS/Android 移动端手势 | ⏳ 待真机   | 浏览器级 Touch 事件已覆盖（vertical-rl 拖拽/翻页），真机触摸手感、双指缩放待验证 |
| e-ink 设备（Boox 等）  | ⏳ 待真机   | 子任务 5 已补 eink 选择样式（`7e566a71`），真机刷新/残影表现待验证               |
| 桌面真实 wheel 手感    | ⏳ 待真机   | wheel delta 分类已测试；Magic Mouse 惯性过滤（`b7a93e26`）需真机                 |
| 中间键自动滚动         | ✅ 桌面可测 | `useMiddleClickAutoscroll.test.ts` 已覆盖逻辑；真机交互建议 smoke                |
| TTS 语音朗读跟随       | ⏳ 待真机   | 锚定逻辑已验证；Edge TTS 音频链路需真机                                          |
| IAP 流程               | ⏳ 平台限制 | 5 个 IAP 测试跳过（需 Apple 沙箱环境）                                           |

## 平台限制记录

1. **lint 基线**：155 errors / 4 warnings（既有功能代码，Annotator/FoliateViewer/TTSControl/ViewMenu 等），本次新增测试文件 0 错误。
2. **IAP 测试**：`iap-verify`、`apple-iap` 共 5 用例跳过（需 Apple 环境）。
3. **浏览器测试依赖**：`@vitest/browser-playwright@4.0.18` + `playwright`，chromium headless；需要 `npx playwright install chromium`（如缺）。
4. **位置保留精度**：模式切换 round-trip 后位置近似恢复（实测 186px 漂移 < 一屏），非精确像素级——上游 fraction-anchor 语义，记录为已知限制。
5. **goTo(anchor:0) 视口偏移**：backward preload 在 primary 上方插入内容后，视口顶部可略偏出 primary 顶部（实测 -171px），上游 renderer 行为，fork 沿用。

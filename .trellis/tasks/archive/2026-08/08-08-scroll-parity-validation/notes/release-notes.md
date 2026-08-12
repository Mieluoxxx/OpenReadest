# Scroll parity 发布说明与回滚点

Date: 2026-08-12

## 发布判定

迁移后的滚动系统达到发布门槛：

- ✅ 浏览器套件 53/53（8 文件，chromium headless）
- ✅ node 套件 367 通过 / 5 跳过（IAP 平台限制）
- ✅ lint：新增 0 错误（基线 155 既有错误未触及）
- ✅ `pnpm build`（tauri 平台）与 `pnpm build-web`（web 平台）通过（含 typecheck）
- ✅ 同步/翻译路径 git 边界确认未被迁移触碰

## 已知限制（发布前需知晓）

1. **webtoonMode 未实现**（子任务 5 遗留，设计明确 out of wave 1）：`ViewSettings.webtoonMode` 字段已入模型且默认 false，但 webtoon 模式（fit-width + scroll-gap）的 UI 与行为未移植。字段为 false 时无行为差异；不暴露入口。
2. **foliate-js pin 无更新**（调研 gitlink note）：上游 `63a2eb1f`（2026-08-11）经 `git fetch` 不可达（疑似 force-push 移除），当前 pin 保持 `f65836f7`。如上游确认可达，再评估是否跟进。
3. **模式切换位置为近似恢复**（本任务实测）：scrolled→paginated→scrolled round-trip 后位置漂移 < 一屏（实测 186px），不精确回像素级——上游 fraction-anchor 语义，属预期行为。
4. **lint 基线 155 错误**：既有功能代码（Annotator/FoliateViewer/TTSControl/ViewMenu 等），非本迁移引入，另行治理。
5. **IAP 测试跳过**：5 用例需 Apple 沙箱环境。
6. **真机矩阵未跑**：移动端手势手感、e-ink 刷新、Magic Mouse 惯性、TTS 音频链路待真机（见 notes/manual-matrix.md）。

## 未移植的上游测试（记录在案）

- `paginator-expand.browser.test.ts`（需 repro-3583/3683 fixture，非 scroll 核心路径）
- `paginator-paginated.browser.test.ts`、`paginator-background-segments.test.ts`、`paginator-multiview.test.ts` 等分页模式测试（不在 scroll parity 范围）
- `wordlens.browser.test.ts`、`pdf-*` 系列（独立于 scroll 迁移）

## 回滚点

### foliate-js gitlink

| 状态   | gitlink                                    | 说明                       |
| ------ | ------------------------------------------ | -------------------------- |
| 当前   | `f65836f77e8b66b84baacd54bfc92096578e7a84` | 迁移后 pin（本次发布基线） |
| 迁移前 | `29fd7aadf947639f86ce0de7f381a62b52bd32b4` | 回滚目标                   |

恢复：`git -C packages/foliate-js checkout 29fd7aadf947639f86ce0de7f381a62b52bd32b4 && git add packages/foliate-js && git commit`

### 应用代码（按阶段，新→旧）

| 阶段                         | commit           | 内容                                                                   |
| ---------------------------- | ---------------- | ---------------------------------------------------------------------- |
| 验证基建（本任务）           | 工作树（未提交） | vitest.browser 配置、fixtures、`__tests__/document/`（8 文件 53 用例） |
| 集成（子任务 5）             | `d2eceefc`       | scrolled toggle 渲染器属性测试                                         |
|                              | `2f60be59`       | HintInfo 指针事件对齐                                                  |
|                              | `5d632e54`       | proofread 全格式                                                       |
|                              | `b78804b9`       | scrolled TTS 锚定对齐                                                  |
|                              | `d3335c1a`       | 章节标题/提示条贴顶边距                                                |
| 输入/自动滚动（子任务 4）    | `bd795e05`       | AutoScrollControl lint                                                 |
|                              | `d4112a9f`       | autoscroller/Auto Scroll/速度手势/中间键测试                           |
|                              | `de9912b5`       | Auto Scroll UI 控件                                                    |
|                              | `cbc7ef1b`       | 中间键 autoscroll + Auto Scroll 会话                                   |
|                              | `b7a93e26`       | wheel 分类 + Magic Mouse 过滤                                          |
|                              | `7e566a71`       | eink 选择样式                                                          |
| PDF/fixed-layout（子任务 3） | `d46312b9`       | fixed-layout 滚动、scrolledDirection、edge-to-edge                     |
| EPUB 分页器（子任务 2）      | `ec150a04`       | scrolled 距离/snap/监听器生命周期测试                                  |
|                              | `976339a2`       | ControlPanel 迁移到 noContinuousScroll                                 |
|                              | `32a25ac6`       | renderer 监听器 once-per-view                                          |
|                              | `8e621601`       | renderer 滚动属性、滚动边距、可滚动表格                                |
| 基线（子任务 1）             | `898484c2`       | 设置模型基线 + legacy 归一化                                           |

### 单阶段回滚示例（子任务 4 失败时）

```bash
git revert --no-commit bd795e05 d4112a9f de9912b5 cbc7ef1b b7a93e26 7e566a71
git -C packages/foliate-js checkout 29fd7aadf947639f86ce0de7f381a62b52bd32b4
git add packages/foliate-js && git commit -m "rollback: scroll input/autoscroll stage"
```

> 注意：`revert` 顺序需从新到旧；应用代码回滚与 gitlink 恢复必须同 commit 完成，避免"新代码 + 旧渲染器"组合。

## 测试命令

```bash
# node 套件
pnpm --filter @openreadest/app test
# 浏览器套件（需 playwright chromium：npx playwright install chromium）
pnpm --filter @openreadest/app test:browser
# lint / 构建
pnpm --filter @openreadest/app lint
pnpm --filter @openreadest/app build      # tauri 平台
pnpm --filter @openreadest/app build-web  # web 平台
```

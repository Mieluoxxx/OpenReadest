# 书架右键菜单统一为 daisyUI 风格

## Goal

将书架条目（书本 / 分组）的右键菜单从 Tauri 原生系统菜单，统一为项目现有 daisyUI 风格 React 菜单，使桌面交互视觉与设置菜单、视图菜单等一致。用户价值：一致的视觉与交互手感，减少桌面/网页双端割裂。

## Background / Confirmed Facts

- 当前实现：`apps/openreadest-app/src/app/library/components/BookshelfItem.tsx`
  - `bookContextMenuHandler` / `groupContextMenuHandler`，使用 `@tauri-apps/api/menu` 的 `Menu` / `MenuItem` + `menu.popup()`
- 现有 daisyUI 菜单体系：`@/components/Menu` + `@/components/MenuItem`（内容）；`@/components/Dropdown`（按钮触发下拉，**不支持坐标定位**）
- 能力开关：`appService.hasContextMenu` — 桌面 `true`（`nativeAppService`），iOS/Android `false`
- 触发路径：鼠标右键（`useLongPress.onContextMenu`，已 `preventDefault`）；键盘 `ContextMenu` / `Shift+F10`；移动端长按进多选不弹菜单
- 书本菜单项：选择/取消选择、分组、书籍详情、在文件夹中显示、下载/上传（条件）、删除
- 分组菜单项：选择/取消选择、分组、删除
- 仓库尚无坐标定位 ContextMenu 组件；`Popup.tsx`（坐标 + 夹紧 + 三角）与 `ModalPortal.tsx`（portal + 遮罩）可参考；`useLongPress` 仅 `BookshelfItem` 一个调用方

## Requirements

- R1：书架书本 / 分组右键（及键盘 ContextMenu / Shift+F10）弹出 daisyUI 风格菜单，视觉与现有 `Menu` / `MenuItem` 一致
- R2：菜单项行为与现有原生菜单功能等价（选择、分组、详情、Finder/资源管理器揭示、上传/下载条件项、删除）
- R3：点击遮罩 / 菜单外 / Esc 关闭菜单；选择菜单项后关闭
- R4：桌面端继续尊重 `hasContextMenu`；移动端默认行为不因本次改造被破坏
- R5：移除书架路径对 `@tauri-apps/api/menu` 的依赖（该文件路径）

## Acceptance Criteria

- [ ] 桌面书架上右键书本，出现 daisyUI 风格菜单，项与现行为一致且可执行
- [ ] 桌面书架上右键分组，出现 daisyUI 风格菜单，项与现行为一致且可执行
- [ ] 键盘 `ContextMenu` / `Shift+F10` 仍可打开对应条目菜单
- [ ] 菜单出现在右键坐标附近，且不越出视口（有夹紧）
- [ ] Esc / 点击外部可关闭；点击菜单项后关闭并执行动作
- [ ] `BookshelfItem` 不再调用 `@tauri-apps/api/menu` 的 `Menu.new` / `popup`
- [ ] 移动端（`hasContextMenu === false`）行为不回归（长按仍进多选等既有逻辑）

## Decisions

- **范围边界**：仅书架（书本 / 分组）。阅读器 PDF 右键（`Annotator` 拦截后开翻译弹窗）不在本次范围。
- **移动端**：仅桌面 `hasContextMenu` 平台弹出菜单；iOS/Android 平台语义不改，长按仍进多选。
- **定位策略**：菜单出现在鼠标右键位置（`clientX/clientY`）；屏幕边缘时视口夹紧防越界；键盘 `ContextMenu` / `Shift+F10` 触发时以条目中心为默认位置。

## Out of Scope

- 阅读器 PDF 右键（`Annotator` 拦截后直接开翻译弹窗）
- 全局替换所有 daisyUI `Dropdown` 触发菜单
- 重新设计菜单项文案 / 新增 OCR 等业务项
- 修改 `hasContextMenu` 在 iOS/Android 上的平台语义

## Technical Notes

- 新增 `components/ContextMenu.tsx`：`createPortal` 到 body、`position: fixed`、`useLayoutEffect` 视口夹紧、复用 `Overlay` + `useKeyDownActions` 关闭
- `useLongPress.onContextMenu` 签名由 `() => void` 改为 `(e: React.MouseEvent) => void`（唯一调用方，无回归）
- `BookshelfItem`：原生菜单创建逻辑改为 state（`{ item, x, y }`）+ 条件渲染；`hasContextMenu` 门禁保留
- 详细设计见 `design.md`；执行清单见 `implement.md`

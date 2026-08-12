# 书架右键菜单统一为 daisyUI 风格 — Design

## 1. 目标与边界

将 `BookshelfItem.tsx` 中基于 `@tauri-apps/api/menu` 的原生右键菜单，替换为项目现有 daisyUI 风格 React 菜单。仅书架（书本 / 分组）、仅桌面（`hasContextMenu === true`）。

## 2. 架构与模块边界

```
apps/openreadest-app/src/
├── components/
│   ├── ContextMenu.tsx          [新增] 通用可定位右键菜单容器
│   └── Menu.tsx / MenuItem.tsx  [复用] 现有 daisyUI 菜单内容组件
└── app/library/components/
    └── BookshelfItem.tsx        [修改] 去掉原生菜单，改用 ContextMenu
```

### 2.1 新增 `components/ContextMenu.tsx`

**职责**：按鼠标坐标定位弹出、视口夹紧、遮罩/Esc 关闭。内容与交互由 `Menu` / `MenuItem` 承担，本组件只负责「定位 + 关闭」。
**Props**（定稿）：

```tsx
interface ContextMenuProps {
  x: number; // 触发点 clientX（键盘路径由调用方传条目中心）
  y: number; // 触发点 clientY
  onClose: () => void;
  children: React.ReactNode; // 期望 <Menu> / <MenuItem> 结构
  className?: string;
}
```

> 组件由调用方条件渲染（`contextMenu !== null` 时才挂载），故**无 `open` prop**，避免冗余状态。

**实现要点**：

- `ReactDOM.createPortal` 到 `document.body`（与 `ModalPortal` 同模式）
- 容器 `position: fixed`，初始 `left/top` 用传入坐标
- **视口夹紧**：`useLayoutEffect` 测量自身真实尺寸（`offsetWidth/offsetHeight`），越界时取 `min(x, innerWidth - width - margin)` / `min(y, innerHeight - height - margin)`；**依赖 `[x, y]` 重算**；另加 `resize` 监听，窗口调整后重新夹紧；参考 `Popup.tsx` 思路
- **层叠顺序**：菜单容器 `z-index` 必须**高于**全屏遮罩 `Overlay`（如菜单 `z-[110]`、遮罩 `z-[100]`），且 portal 内菜单 DOM 在遮罩之后，否则遮罩拦截菜单点击
- 遮罩：复用 `Overlay`（`onClick` / `onContextMenu` / Esc 关闭）
- Esc 关闭：复用 `useKeyDownActions({ onCancel: onClose })`（`Menu.tsx` 已用同一 hook，行为一致）
- **菜单项关闭**：`MenuItem.onClick` 仅执行 action，**不会自动关闭**；调用方每个菜单项 onClick 内必须 `setContextMenu(null)`，不能只依赖外部遮罩

### 2.2 修改 `hooks/useLongPress.ts`

现状：`onContextMenu: () => void` 不传事件坐标，鼠标右键无法定位。

改：`onContextMenu: (e: React.MouseEvent) => void`，将原生 `e`（含 `clientX/clientY`）透传。**仅有一个调用方（BookshelfItem）**，无回归风险。

### 2.3 修改 `app/library/components/BookshelfItem.tsx`

- 删除 `import { Menu, MenuItem } from '@tauri-apps/api/menu'` 及 `revealItemInDir` 之外的原生菜单调用
- `bookContextMenuHandler(book)` / `groupContextMenuHandler(group)` 从「异步创建原生菜单」改为「返回菜单项配置」或「直接渲染条件」：
  - 移除 `MenuItem.new` / `Menu.new` / `menu.popup()` / `menu.append`
  - 书本文案与条件项保持等价：选择/取消选择、分组、详情、在文件夹中显示、下载（条件）、上传（条件）、删除
  - 分组项：选择/取消选择、分组、删除
- 新增状态：`const [contextMenu, setContextMenu] = useState<{ item: Book | BooksGroup; x: number; y: number } | null>(null)`
- 鼠标路径：`useLongPress` 的 `onContextMenu(e)` 里 `setContextMenu({ item, x: e.clientX, y: e.clientY })`
- 键盘路径：`handleKeyDown` 的 `ContextMenu` / `Shift+F10` 分支，**先 `e.preventDefault()`**（防浏览器默认菜单），再用 `e.currentTarget.getBoundingClientRect()` 取条目中心作为 `x/y`
- **菜单项关闭**：每个 `MenuItem.onClick` 执行既有 action 后追加 `setContextMenu(null)`（`MenuItem` 不自动关闭）
- `hasContextMenu` 门禁保留（`false` 时不上屏，长按/移动行为不变）
- 渲染：`contextMenu && <ContextMenu x={...} y={...} onClose={...}>…</ContextMenu>`（条件渲染，无 `open` prop）

## 3. 数据流

```
右键/键盘事件
  → useLongPress.onContextMenu(e) / handleKeyDown（键盘先 preventDefault）
  → setContextMenu({ item, x, y })
  → contextMenu && <ContextMenu x={x} y={y} onClose={() => setContextMenu(null)}>
       <Menu>…MenuItem 列表…</Menu>
     </ContextMenu>
  → 点击菜单项 → 执行既有 action + setContextMenu(null)
  → 遮罩/Esc → onClose() → setContextMenu(null)
```

## 4. 兼容性与迁移

- **行为等价**：菜单项功能、条件显示（下载/上传按 `uploadedAt`/`downloadedAt`）不变
- **平台**：`hasContextMenu` 语义不变；iOS/Android 仍为 `false`，长按多选路径不触碰
- **移除依赖**：`BookshelfItem` 不再 import `@tauri-apps/api/menu`（仅该文件路径；Tauri menu API 仍被别处使用则保留）
- **键盘可达性**：`Menu.tsx` 已有 `useKeyDownActions` + 自动聚焦首个 `menuitem`，键盘导航保持

## 5. 权衡

- **复用 Popup 而非新组件？** `Popup.tsx` 面向「选中文本弹出」语义（宽度固定、三角箭头、方向调整），与右键菜单定位诉求不同；直接复用来约束多。新建轻量 `ContextMenu` 更 KISS，定位逻辑 ~40 行。
- **遮罩全屏 vs 局部**：全屏 `Overlay` 最简单且与 `Dropdown` 一致，采用之。
- **不用现成库（radix/headlessui）**：仓库已有完整 `Menu`/`MenuItem`/`Overlay`/`useKeyDownActions` 体系，引入新依赖违反 YAGNI。

## 6. 风险与回滚

- **风险**：键盘路径拿不到条目中心（若 ref 结构变化）→ 退化用 `{0,0}`+夹紧，菜单仍可见
- **回滚**：恢复 `BookshelfItem` 原生菜单实现（git revert 单文件即可）；新组件 `ContextMenu.tsx` 独立文件，删除无副作用
- **验证命令**：见 `implement.md`

## 7. 测试

- 新增 `ContextMenu.test.tsx`：坐标定位 / 视口夹紧 / Esc 与遮罩关闭
- **新增 `BookshelfItem` 集成测试**：书本右键出现菜单、分组右键出现菜单、上传/下载条件项按 `uploadedAt`/`downloadedAt` 正确显示、菜单项点击后关闭
- `BookshelfItem` 浏览器冒烟（`pnpm build` + 手动右键验证）作为补充

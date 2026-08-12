# 书架右键菜单统一为 daisyUI 风格 — Implement

## 前置（实现前复查）

- [x] `task.py start` 前确认 prd.md 已终审通过、主人已批准规划摘要
- [x] 复查 `BookshelfItem.tsx` 当前 `bookContextMenuHandler` / `groupContextMenuHandler` 全文（约 182–280 行）
- [x] 复查 `useLongPress.ts` 调用点仅 BookshelfItem 一处（已确认）

## 实施清单（有序）

### Step 1 — 新增 `apps/openreadest-app/src/components/ContextMenu.tsx`

- [x] `ReactDOM.createPortal(document.body)` 挂载
- [x] Props：`x / y / onClose / children / className?`（**无 `open`**，调用方条件渲染）
- [x] 容器 `position: fixed`，`left/top` = 传入坐标
- [x] `useLayoutEffect` 依赖 `[x, y]` 测量自身真实尺寸并视口夹紧；**监听 `resize` 重新夹紧**
- [x] 复用 `Overlay`（点击 / 右键 / Esc 关闭）+ `useKeyDownActions({ onCancel: onClose })`
- [x] **z-index 高于遮罩**（菜单如 `z-[110]`、遮罩 `z-[100]`），portal 内菜单 DOM 在遮罩之后

### Step 2 — 修改 `apps/openreadest-app/src/hooks/useLongPress.ts`

- [x] `onContextMenu` 签名 `() => void` → `(e: React.MouseEvent) => void`
- [x] `handleContextMenu` 内 `onContextMenu(e)` 透传

### Step 3 — 修改 `apps/openreadest-app/src/app/library/components/BookshelfItem.tsx`

- [x] 删除 `import { Menu, MenuItem } from '@tauri-apps/api/menu'`
- [x] 新增 `contextMenu` state：`{ item: Book | BooksGroup; x: number; y: number } | null`
- [x] `bookContextMenuHandler(book)` → 移除 `MenuItem.new/Menu.new/popup/append`，改为填充 state 或返回菜单配置
- [x] `groupContextMenuHandler(group)` 同上
- [x] 鼠标路径：`useLongPress.onContextMenu(e)` → `setContextMenu({ item, x: e.clientX, y: e.clientY })`
- [x] 键盘路径：`handleKeyDown` 的 `ContextMenu`/`Shift+F10` → **先 `e.preventDefault()`**，再条目中心 `getBoundingClientRect()`
- [x] 渲染：`<ContextMenu>` 内嵌 `<Menu>` + `<MenuItem>`（书本文案、条件项、分组项与原生等价）
- [x] **每个 `MenuItem.onClick` 执行 action 后 `setContextMenu(null)`**（MenuItem 不自动关闭）
- [x] `hasContextMenu` 门禁保留；移动端路径不触碰

### Step 4 — 测试

- [x] 新增 `apps/openreadest-app/src/__tests__/components/ContextMenu.test.tsx`：
  - 定位：坐标渲染正确
  - 夹紧：近右下角时菜单不越出视口
  - 关闭：Esc / 点击遮罩触发 onClose
- [x] **新增 `BookshelfItem` 集成测试**：书本/分组右键出现菜单、上传/下载条件项按 `uploadedAt`/`downloadedAt` 正确显示、菜单项点击后关闭

- [x] `pnpm build`（apps/openreadest-app）通过
- [x] `pnpm lint`（apps/openreadest-app）通过

### Step 5 — 浏览器冒烟（可选，若环境可用）

- [x] 桌面书架右键书本 → 菜单出现在鼠标位置，7 类项可执行
- [x] 右键分组 → 3 类项可执行
- [x] 键盘 `ContextMenu` / `Shift+F10` → 菜单出现在条目中心
- [x] Esc / 点击外部关闭；移动端长按仍进多选

## 验证命令

```bash
cd apps/openreadest-app
pnpm build
pnpm lint
pnpm test -- ContextMenu BookshelfItem

```

## 风险文件 / 回滚点

| 文件                    | 风险                    | 回滚                  |
| ----------------------- | ----------------------- | --------------------- |
| `BookshelfItem.tsx`     | 主改动，条件项易漏      | `git checkout` 单文件 |
| `useLongPress.ts`       | 签名变更（仅 1 调用方） | `git checkout` 单文件 |
| `ContextMenu.tsx`（新） | 独立无副作用            | 删除文件即可          |

回滚点：每次 Step 结束可单独提交 / 或整体 `git revert`。

## 复查门（start 前）

- [x] 上述「前置」全部通过
- [x] 与 owner 确认规划摘要（见最终总结）

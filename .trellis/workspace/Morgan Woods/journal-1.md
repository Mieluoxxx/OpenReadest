# Journal - Morgan Woods (Part 1)

> AI development session journal
> Started: 2026-08-08

---

## 2026-08-12 — 书架右键菜单统一 daisyUI 风格

### 完成

- 任务 `.trellis/tasks/08-12-bookshelf-context-menu-daisyui`（planning → in_progress）
- 新增 `components/ContextMenu.tsx`：portal + fixed 定位 + useLayoutEffect 视口夹紧（[x,y] 重算 + resize）+ z-[110] 高于遮罩 + Esc/遮罩关闭，无 open prop
- `useLongPress.onContextMenu` 签名改为透传 `React.MouseEvent`（唯一调用方 BookshelfItem）
- `BookshelfItem`：原生 `@tauri-apps/api/menu` → state 驱动 daisyUI Menu/MenuItem，书本 7 项/分组 3 项行为等价（含条件项）
- 测试：ContextMenu.test.tsx（5）+ BookshelfItem.test.tsx（7 集成，含条件项/关闭/reveal），全绿
- tsc/build 通过；eslint 3 error 为 HEAD 基线既有债（throttle-in-useCallback）

### 关键 bug（已修）

- throttle 闭包捕获首帧 appService(null) → 菜单永不打开。修复：门禁移到调用点（useLongPress.onContextMenu / handleKeyDown），openContextMenu 只 setState

### Spec 更新

- frontend/component-guidelines.md：新增 ContextMenu 模式契约 + throttle+async appService 陈旧闭包 gotcha + use-memo 既有债说明

### 待办

- 浏览器冒烟（implement.md Step 5，可选）：真实桌面右键/键盘路径验证
- commit（Phase 3.4，需用户确认）

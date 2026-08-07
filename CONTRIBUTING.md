# 贡献指南

## 社区准则

无论您在 GitHub 还是其他社区空间参与 `OpenReadest` 项目，请遵循以下准则：

- 保持尊重、文明和开放的心态
- 提交 Pull Request 前，请先搜索本仓库的 Issue 追踪器，避免重复提交
- 如需进行代码变更，建议先创建 Issue 描述变更内容，待方向一致后再提交

## 项目定位

**OpenReadest 是一个基于 Readest 的学习交流项目，非官方维护。**

- 本仓库仅用于学习交流，代码审查响应可能较慢
- **如需正式贡献，请前往 Readest 官方仓库：** https://github.com/readest/readest

## 本地构建

### 环境要求

| 工具    | 版本    | 说明                                                                                 |
| :------ | :------ | :----------------------------------------------------------------------------------- |
| Node.js | >= 22   | 见 `.nvmrc`，`nvm use` 可自动切换                                                    |
| pnpm    | 11.13.0 | 由 `package.json` 的 `packageManager` 声明，`corepack enable` 后自动使用正确版本     |
| Rust    | stable  | 仅桌面端/移动端构建需要，见 [Tauri 环境准备](https://tauri.app/start/prerequisites/) |

### 克隆与安装

本仓库通过 Git submodule 引入 `foliate-js`、`tauri`、`tauri-plugins`、`simplecc-wasm`。
**submodule 未初始化时 `pnpm install` 会直接失败**（报 `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`），
因为 `packages/foliate-js` 是 pnpm workspace 的成员，pnpm 在读取 workspace 之前无法自行拉取它。

```bash
# 推荐：克隆时一并拉取 submodule
git clone --recurse-submodules https://github.com/Mieluoxxx/OpenReadest.git
cd OpenReadest
pnpm install
```

如果已经克隆但漏了 submodule，先初始化再安装：

```bash
git submodule update --init --recursive
pnpm install
```

> 注意：不要指望 `pnpm install` 自行修复这一点。pnpm 先扫描 workspace、后执行生命周期脚本，
> 所以任何 install 钩子都赶不上首次扫描；submodule 初始化是 `pnpm install` 的前置条件。
> submodule 已存在时，`pnpm bootstrap` 也可以一步完成上述两个命令。

### 准备前端静态资源

pdf.js 与 simplecc 的运行时资源需要复制到 `apps/openreadest-app/public/vendor/`，
否则前端会在编译期报 `Can't resolve '@pdfjs/pdf.min.mjs'`：

```bash
pnpm setup-vendors
```

该命令是增量的（资源没变就跳过），结尾会自动校验产物完整性与版本一致性；
若资源缺失或过期会立刻报错并给出修复命令，而不是留到编译期才失败。
`pnpm tauri dev` 会自动执行它，通常不需要手动跑。

### 本地环境变量

仓库自带 `.env`、`.env.tauri`、`.env.web` 提供默认值，开箱即可运行。
需要覆盖密钥或接入自己的服务时，复制示例文件后改本地副本（`.env*.local` 已被 gitignore）：

```bash
cp apps/openreadest-app/.env.local.example apps/openreadest-app/.env.local
```

### 常用命令

以下命令都可以在仓库根目录直接运行，会自动转发到应用包：

```bash
pnpm dev            # 一键开发：清前端缓存 + 启动桌面 Tauri 开发
pnpm tauri dev     # 桌面端开发（自动执行 setup-vendors）
pnpm dev-web       # Web 端开发
pnpm test          # 单元测试（vitest）
pnpm lint          # ESLint
pnpm build         # 构建桌面端前端产物
pnpm build-web     # 构建 Web 端产物
pnpm format        # 格式化全仓库
pnpm format:check  # 只检查格式，不改文件（CI 用的就是这个）
```

提交时 husky 的 pre-commit 钩子会自动用 Prettier 格式化已暂存文件并重新暂存，
所以一般不需要手动跑 `pnpm format`。

### 清理构建缓存

改动 Tauri 权限配置或遇到疑似缓存导致的诡异问题时：

```bash
pnpm clean                  # 清前端和后端缓存
pnpm clean fd               # 只清 Next.js、导出目录和生成的 PWA 文件
pnpm clean bd               # 只清 Tauri schema 和本仓库 crate
pnpm clean bd --deep        # 清后端全部 target/（会重新编译数分钟）
pnpm tauri-dev-clean        # 清前端缓存 + 本仓库 crate，保留第三方依赖编译产物
pnpm tauri-dev-clean-deep   # 连第三方依赖一起清（会重新编译数分钟）
```

## 如何贡献

请参考 [Readest 官方项目](https://github.com/readest/readest) 的贡献指南。

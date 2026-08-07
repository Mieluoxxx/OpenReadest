<p align="center">
  <img src="new_logo/openreadest-icon.svg" alt="OpenReadest" width="160" />
</p>

# OpenReadest

OpenReadest 是基于 Readest 的非官方 Fork，重点保留本地阅读能力，并新增或强化 WebDAV 与 S3 兼容对象存储同步能力。上游项目 Readest： https://github.com/readest/readest 。

本项目遵循 AGPL-3.0 许可证发布，并保留上游项目与第三方组件的版权和许可证声明。

## ⚠️ 免责声明 & 项目说明

**本项目 (OpenReadest) 是基于原项目 [Readest](https://github.com/readest/readest) 的一个独立 Fork（分支/衍生版本）。**

为了避免混淆，特此说明：

1. **独立性**：本项目与原项目 `readest/readest` 是两个相互独立的项目，拥有不同的更新计划和功能路线。
2. **功能差异**：本项目在原项目基础上增加了特定的新功能，这些修改仅代表本项目的方向。
3. **问题反馈**：如果你在使用 _本 Fork 版本_ 时遇到问题或有功能建议，请直接在本仓库 (`Mieluoxxx/OpenReadest`) 提出，不要打扰原项目的开发者。
4. **尊重原项目**：原项目的所有荣誉归原作者所有。本项目严格遵循原项目的开源协议 (AGPL-3.0) 进行分发。

感谢原项目 [Readest](https://github.com/readest/readest) 提供的优秀基础！

### 分叉基点（Fork Point）

本项目从 Readest 上游的以下提交切出：

- **上游提交**：`481d8198e9d02b8072d709e4e18610e478dee72d`
- **日期**：2026-01-23
- **上游说明**：fix(tts): set playback rate after play only on Linux (#3040)
- **链接**：<https://github.com/readest/readest/commit/481d8198e9d02b8072d709e4e18610e478dee72d>

自该提交之后，本仓库与上游分叉并独立演进；本仓库最早的独立提交为
`4678aca4`（2026-03-08，feat: prepare OpenReadest fork for public upload）。

---

## 功能对比

| 能力                           |  原版 Readest  |          OpenReadest          |
| :----------------------------- | :------------: | :---------------------------: |
| EPUB/PDF/FB2/MOBI/AZW/CBZ 阅读 |       ✅       |              ✅               |
| 批注/书签/进度                 |       ✅       |              ✅               |
| 多端支持（桌面/移动）          |       ✅       |              ✅               |
| WebDAV 同步                    |      部分      |            ✅ 强化            |
| S3 兼容对象存储同步            |       ❌       |              ✅               |
| 朗读（TTS）                    |       ✅       |      ✅（本地 Edge TTS）      |
| 云端 AI 朗读（无限）           |       ✅       |              ❌               |
| 翻译                           | ✅（含 DeepL） | ✅（Google / Azure / Yandex） |
| 账号 / 云空间 / 付费订阅       |       ✅       |              ❌               |
| 遥测与错误上报                 |       有       |              ❌               |

> **提示：** 如需体验完整功能（AI 朗读、DeepL 翻译等），建议使用原版 Readest：https://github.com/readest/readest

## 已移除能力

- 账号登录
- 原项目云空间
- 付费订阅与功能
- 遥测与错误上报
- Discord Rich Presence
- KOReader 插件中的原 Readest 云同步入口

## 下载

当前临时构建产物可放在仓库根目录的 `release/` 目录中，便于本地测试与直接分发。

正式公开发布时，仍建议通过 GitHub Releases 或其他独立分发渠道提供。

## WebDAV 配置（简要）

1. 打开 设置 → 集成 → 云同步 → WebDAV。
2. 填写服务地址、用户名、密码、远程目录。
3. 执行连接测试后保存。
4. 选择同步方向或双向同步并开始。

建议远程目录使用独立目录（如 `/OpenReadest`），避免与其他程序混用。

## S3 配置（简要）

1. 打开 设置 → 集成 → 云同步 → S3。
2. 填写 Endpoint、Region、Access Key、Secret Key、Bucket Name 和 Remote Prefix。
3. 执行连接测试后保存。
4. 选择上传或下载书籍，或启用当前活动配置的自动同步。

支持 AWS S3、MinIO、Cloudflare R2 等 S3 兼容服务。Web 端需要配置 Bucket CORS；详细说明见 [`apps/openreadest-app/docs/s3.md`](apps/openreadest-app/docs/s3.md)。

## 从源码开发

### 快速上手

```bash
git clone https://github.com/Mieluoxxx/OpenReadest.git
cd OpenReadest
git submodule update --init --recursive   # 初始化并克隆全部子模块
pnpm install
pnpm dev               # 桌面端开发（需先装好 Rust 工具链）
```

桌面端开发需要先装好 Rust（见 [Tauri 环境准备](https://tauri.app/start/prerequisites/)），然后：

```bash
pnpm tauri dev
```

### 两个容易踩的坑

1. **子模块必须先初始化。** 本仓库的 `foliate-js` 是 pnpm workspace 成员，
   submodule 未初始化时 `pnpm install` 会直接报 `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND`。
   按上面步骤执行 `git submodule update --init --recursive` 即可（克隆时也可带 `--recurse-submodules` 一步到位）。
2. **不要手动改 `public/vendor/` 里的文件。** 那些是 `pnpm setup-vendors` 从
   `pdfjs-dist` 和 simplecc 复制出来的构建产物，已被 gitignore，下次构建会被覆盖。

### 仓库结构

| 路径                                         | 内容                                         |
| :------------------------------------------- | :------------------------------------------- |
| `apps/openreadest-app/`                      | Next.js 前端 + `src-tauri/` 桌面端 Rust 代码 |
| `packages/foliate-js/`                       | 电子书解析与渲染（submodule）                |
| `packages/tauri/`、`packages/tauri-plugins/` | 定制的 Tauri 与插件（submodule）             |
| `packages/simplecc-wasm/`                    | 简繁转换（submodule）                        |
| `packages/rust-block/`                       | 本仓库自有 Rust crate                        |

完整的环境要求、常用命令、环境变量与缓存清理说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 贡献方式

欢迎任何形式的贡献！参与前请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解社区准则。

- **反馈问题或建议**：在本仓库 [Issues](https://github.com/Mieluoxxx/OpenReadest/issues) 提出，描述问题时请附上版本号、平台与复现步骤
- **提交代码**：Fork 本仓库后提交 Pull Request；建议先创建 Issue 对齐方向，避免重复劳动
- **本地构建**：见上方「从源码开发」与 [CONTRIBUTING.md](CONTRIBUTING.md)

> 本项目为基于 Readest 的独立 Fork，请将问题反馈提交到本仓库，避免打扰原项目开发者。

## 版权与许可

- 上游项目：Readest（https://github.com/readest/readest），原始版权归 Bilingify LLC 与 Readest contributors 所有。
- Fork 修改：OpenReadest 的新增与修改部分版权归 luyishui 所有。
- 许可证文本：详见 [LICENSE](LICENSE)。
- Fork 归属与额外版权说明：详见 [NOTICE.md](NOTICE.md)。
- 第三方组件：各自许可证继续按原要求保留与分发。

如果你分发修改后的版本，仍应继续保留上游版权、许可证文本与第三方许可证声明。

## 使用的上游组件

- Tauri 与 tauri-plugins：提供桌面与移动端打包、系统能力桥接与插件基础设施。
- foliate-js：提供 EPUB、FB2、MOBI、CBZ 等电子书解析与渲染能力。
- simplecc-wasm 与 OpenCC：提供简繁转换相关能力。
- pdf.js：提供 PDF 阅读相关能力。

本仓库保留当前发布与构建需要的上游源码快照、许可证与必要说明，但不会把这些上游项目各自的完整仓库历史作为 OpenReadest 主仓库的一部分继续公开分发。

## 发布说明

公开仓库默认不提交打包产物、构建缓存与本地生成目录。最终发布前请通过独立构建流程生成 Windows 与 Android 安装包。

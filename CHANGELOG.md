# Changelog

本项目所有值得记录的变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

> 本项目 fork 自 [readest/readest](https://github.com/readest/readest)（分叉基点 `481d8198`，2026-01-23），
> 以下变更记录仅包含本仓库（OpenReadest）相对上游的独立演进，不包含上游 readest 自身的提交。

## [Unreleased]

### 文档

- 明确直接上游为 readest/readest，并在致谢中新增对 luyishui/OpenReadest 的感谢。

## [1.1.0] - 2026-08-08

### 新增

- OpenAI 兼容接口的 AI 翻译集成（在 Google / Azure / Yandex 之外新增自定义 OpenAI 兼容端点）。

### 改进

- 打磨 AI 集成设置面板 UI 与默认值，语言下拉框去除灰色背景与聚焦边框。
- pnpm 升级至 11.13.1，全新克隆无需手动配置即可直接构建。
- 新增针对性的开发缓存清理命令。

### 修复

- AI 连接测试反馈不再换行，与输入框同行展示。
- 20251029 数据迁移在遗留 `Images` 目录缺失时自动跳过。
- 修复阅读器标注提示与信息 toast 的布局问题。
- 消除 tauri 初始化脚本导致的 `<html>` hydration 警告。
- pdfjs-dist vendor 资源缺失时快速失败并给出明确报错，不再静默异常。

## [1.0.2] - 2026-08-07

### 发布

- 发布未签名的 macOS / Android 构建产物（无代码变更）。

## [1.0.1] - 2026-08-07

### 修复

- 对齐 `@tauri-apps` npm 包与 Rust crate 版本至 tauri v2.11。

### 其他

- CI：发布流水线新增 `workflow_dispatch` 手动重试入口。

## [1.0.0] - 2026-08-07

首个稳定版本，包含自分叉点（`4678aca4`，2026-03-08）以来的全部独立演进。

### 新增

- S3 兼容对象存储同步（统一同步核心，支持 AWS S3 / MinIO / Cloudflare R2 等）。
- OpenReadest 品牌图标，含原生 macOS Liquid Glass 处理管线。
- 数据目录由 `Readest` 更名为 `openreadest`。

### 改进

- WebDAV 配置移入「设置 → 集成」统一管理。
- 应用工作区重命名，移除失效的 Vercel 工作流。
- UI 打磨与 Android 资源更新。

### 修复

- 缺失的 JSON 配置文件按首次运行静默处理，不再报错。
- 重新固定 tauri 与 tauri-plugins 子模块至可用提交。
- 开发启动时的缓存清理改为显式执行。

### 移除

- 赞助入口与相关资源。
- 禁用 KOReader 插件（koplugin）中的上游云同步服务入口。
- 上游支持性文案替换为 OpenReadest 自有表述（i18n 覆盖）。

### 文档

- README 品牌化刷新：新 logo、准确的功能对比表与贡献指南。
- CONTRIBUTING.md 中文化，明确分叉基点与上游归属说明。

# S3 云同步设计

日期：2026-08-04

## 1. 目标

在“设置 → 集成 → 云同步”中新增与 WebDAV 并列的 S3 入口，让 S3 成为与 WebDAV 等价的双向增量同步后端。

首期同步内容保持一致：

- 书籍文件
- 封面 `cover.png`
- 阅读配置 `config.json`
- 书架索引 `library.json`
- 增量同步状态

首期支持 AWS S3 及常见 S3 兼容服务，包括 MinIO、Cloudflare R2 和 Backblaze B2 S3 API。桌面、Android 和 Web 均需可用。

## 2. 已确认的产品边界

### 2.1 配置字段

S3 配置对用户只展示以下字段：

- Endpoint
- Region
- Access Key
- Secret Key
- Bucket Name
- Remote Prefix

配置另有与 WebDAV 共用的备注名和冲突策略。内部可保存自动探测出的寻址方式，但不增加可见配置字段。

### 2.2 首期不包含

- S3 对象浏览器
- 远端删除或删除同步
- Multipart Upload
- Session Token、IAM Role、SSO 或预签名 URL
- S3 服务端加密配置
- 多个 profile 同时自动同步
- 旧 WebDAV store、profile 或同步状态迁移
- 与旧版本客户端共用同步状态协议

Access Key 和 Secret Key 沿用现有 WebDAV 密码的存储方式，保存在本机 `localStorage`。界面和文档必须说明该安全边界，并建议使用只允许访问目标 Bucket/Prefix 的专用凭据。

## 3. 架构

采用“统一同步核心 + 远端存储适配器”结构，不复制一套 S3 同步引擎。

### 3.1 分层

1. `CloudProfile` 与统一 store 管理 WebDAV/S3 配置、活动配置、日志、进度和自动同步设置。
2. `RemoteObjectStore` 定义同步核心需要的远端对象操作。
3. `WebDavObjectStore` 与 `S3ObjectStore` 分别适配协议细节。
4. `CloudLibraryService` 负责远端书架索引、书籍发现和书籍文件推断。
5. `CloudSyncEngine` 负责指纹、增量判断、冲突处理、传输和同步状态。
6. `CloudSyncCenter` 和 `CloudAutoSyncRunner` 只依赖统一模型与服务。

S3 适配器使用 AWS SDK for JavaScript v3 的模块化 `S3Client`。应用必须把 `@aws-sdk/client-s3` 声明为直接依赖，不能依赖 OpenNext 带入的传递依赖。S3 代码按 provider 动态加载，避免增加 WebDAV 用户的首屏包体。

### 3.2 Profile 类型

```ts
type CloudProvider = 'webdav' | 's3';
type CloudConflictStrategy = 'newest' | 'local' | 'remote' | 'manual';

interface CloudProfileBase {
  id: string;
  name: string;
  provider: CloudProvider;
  conflictStrategy: CloudConflictStrategy;
  lastSyncAt?: number;
}

interface WebDavCloudProfile extends CloudProfileBase {
  provider: 'webdav';
  config: {
    serverUrl: string;
    remotePath: string;
    username: string;
    password: string;
    allowInsecureHttp?: boolean;
    allowInsecureTls?: boolean;
  };
}

interface S3CloudProfile extends CloudProfileBase {
  provider: 's3';
  config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    remotePrefix: string;
    addressingStyle?: 'virtual' | 'path';
  };
}

type CloudProfile = WebDavCloudProfile | S3CloudProfile;
```

公共字段不得复制到 provider config 中。所有 provider 分支必须通过 `provider` 判别，避免依靠可选字段猜测类型。

### 3.3 远端对象接口

```ts
interface RemoteObjectMetadata {
  key: string;
  etag?: string;
  lastModified?: string;
  size?: number;
}

interface RemoteListEntry {
  key: string;
  kind: 'object' | 'prefix';
  metadata?: RemoteObjectMetadata;
}

interface RemoteAccessResult {
  addressingStyle?: 'virtual' | 'path';
}

interface RemoteObjectStore {
  testAccess(): Promise<RemoteAccessResult>;
  listChildren(prefix: string): Promise<RemoteListEntry[]>;
  stat(key: string): Promise<RemoteObjectMetadata | null>;
  read(key: string): Promise<Uint8Array>;
  write(
    key: string,
    data: Uint8Array,
    options?: { contentType?: string },
  ): Promise<RemoteObjectMetadata>;
}
```

`stat` 只在对象确实不存在时返回 `null`，认证、权限、网络和服务端错误必须抛错。接口不提供 `delete`，从能力边界上防止首期误删。

`WebDavObjectStore.write` 在内部确保父目录存在；S3 不创建目录对象。`listChildren` 返回完整分页结果和直接子级，WebDAV 使用 Depth 1，S3 使用 `Delimiter: "/"`。

## 4. 路径和同步状态

### 4.1 路径规则

同步核心只处理无前导 `/` 的相对 key：

```text
OpenReadest/
  Books/
    library.json
    {book.hash}/
      {safeTitle}.{ext}
      cover.png
      config.json
  System/
    sync-state.json
```

WebDAV adapter 将 key 拼到 `remotePath` 后；S3 adapter 将 key 拼到 `remotePrefix` 后。

`remotePrefix` 允许为空。保存前去除首尾空白和 `/`，并把连续 `/` 规范为一个。任何路径拼接都必须使用统一的结构化 helper，禁止在 UI 或同步循环中直接拼接字符串。

### 4.2 状态隔离

本地状态路径固定为：

```text
cloud-sync/{profile.id}/sync-state.json
```

远端状态 key 固定为：

```text
OpenReadest/System/sync-state.json
```

经 adapter 处理后，S3 的实际 key 为：

```text
{remotePrefix}/OpenReadest/System/sync-state.json
```

新协议不读取 `webdav-sync-state.json`，也不读取现有 `readest_webdav_*` localStorage key。

### 4.3 状态模型

```ts
interface CloudSyncStateEntry {
  updatedAt: number;
  local?: {
    size?: number;
    md5?: string;
    observedAt?: number;
  };
  remote?: {
    etag?: string;
    lastModified?: string;
    size?: number;
  };
}

interface CloudSyncStateV1 {
  version: 1;
  updatedAt: number;
  entries: Record<string, CloudSyncStateEntry>;
}
```

合并本地与远端状态时按每个 entry 的 `updatedAt` 选择较新记录，不能只用文件级时间覆盖整份状态。

## 5. S3 适配器行为

### 5.1 SDK 配置

S3Client 使用用户提供的 Endpoint、Region、AK、SK 和 Bucket。Region 只要求非空，必须接受 R2 使用的 `auto`，不得套用 AWS Region 的严格枚举。

Bucket Name 只校验非空且不包含 `/`，避免用 AWS 专属命名规则拒绝兼容实现。Endpoint 必须是合法的 `http://` 或 `https://` URL。

Web 使用 SDK 默认 fetch handler，并受 Bucket CORS 约束。Tauri 桌面和 Android 注入基于 `@tauri-apps/plugin-http` 的 Smithy request handler，以绕过 WebView CORS，并保持与现有 WebDAV 请求层一致的证书和网络行为。

### 5.2 寻址方式探测

连接测试按以下顺序执行：

1. 如果 profile 已保存 `addressingStyle`，先使用该方式。
2. 否则先使用虚拟主机式访问，即 `forcePathStyle: false`。
3. 仅在 DNS、hostname、TLS 证书主机名或明确的 endpoint 寻址错误时，使用 `forcePathStyle: true` 重试一次。
4. 401、403、AccessDenied、InvalidAccessKeyId、SignatureDoesNotMatch、CORS 和普通网络超时不得触发寻址回退。
5. 成功后通过 `RemoteAccessResult.addressingStyle` 返回解析出的方式并写入 profile；Endpoint 或 Bucket 改变时清除该缓存并重新探测。

### 5.3 操作映射

- `testAccess`：`ListObjectsV2`，Prefix 为同步根前缀，`MaxKeys: 1`
- `listChildren`：完整处理 `ContinuationToken`，使用 `Delimiter: "/"`
- `stat`：`HeadObject`；只有 404/NoSuchKey 映射为 `null`
- `read`：`GetObject`，把不同运行时的 Body 统一转换为 `Uint8Array`
- `write`：`PutObject`，Body 为 `Uint8Array`，透传 Content-Type，并返回写入后的 ETag/LastModified/Size；响应缺少所需元数据时补一次 `HeadObject`

首期使用单次 PutObject，并保持文件粒度的暂停和取消：已经发出的单个上传/下载请求不在中途暂停，完成或失败后才响应暂停/取消。

S3 所需最低权限为：

- Bucket 上、受目标 Prefix 限制的 `s3:ListBucket`
- `{remotePrefix}/OpenReadest/*` 上的 `s3:GetObject`
- `{remotePrefix}/OpenReadest/*` 上的 `s3:PutObject`

不要求 `s3:DeleteObject`。

## 6. 同步数据流

### 6.1 初始化

1. 校验 profile 并通过 factory 创建对应 adapter。
2. 读取该 profile 的本地状态和远端状态；任一不存在时使用空状态。
3. 按 entry 时间合并状态。
4. 根据选中的书籍和内容选项生成同步项。

上传页和下载页决定书籍的选择来源；选中项进入同一个双向增量与冲突判断流程，避免在冲突时无条件覆盖另一侧。

### 6.2 单项判断

每个同步项读取当前本地指纹和远端 `stat`，再与基线比较：

- 仅本地存在：上传
- 仅远端存在：下载
- 只有本地相对基线变化：上传
- 只有远端相对基线变化：下载
- 两端都变化：按 `manual/newest/local/remote` 冲突策略处理
- 两端都未变化：跳过

首期不传播删除。一侧缺失时从另一侧恢复，不删除仍存在的一侧。

### 6.3 基线提交

传输成功后必须重新取得两端指纹，再更新 entry。不能把传输前的远端 ETag 写为新基线。

失败、取消或未解决冲突的对象不得推进基线。无变化对象可保留原 entry，不需要刷新 `updatedAt`。

批次结束时先写本地状态，再写远端状态。远端状态写入失败时：

- 本次结果标记失败，不能显示“同步完成”
- 已完成文件的本地基线保留，避免下次重复传输
- 下次同步以较新的本地 entry 合并并再次写远端状态

### 6.4 结果模型

```ts
interface CloudSyncResult {
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  conflictCount: number;
  conflicts: CloudConflictItem[];
}
```

只有 `failedCount === 0` 且 `conflictCount === 0` 且状态文件写入成功时，UI 才显示同步完成并更新 `lastSyncAt`。

## 7. UI 与状态管理

### 7.1 集成入口

“云同步”区域展示两行：WebDAV 和 S3。

- 没有该 provider 配置：显示“未配置”
- 已配置但不是当前 provider：显示“已配置 N 个”
- 活动 profile 属于该 provider：显示“正在使用 · {profile.name}”

点击任一行进入共享 `CloudSyncCenter`，并只显示该 provider 的 profile。若没有对应 profile，直接打开空白新建表单。

### 7.2 S3 配置表单

Secret Key 默认掩码，使用现有图标组件提供显示/隐藏控制。密钥不得回显到 Toast、日志、导出文件或控制台。

保存或测试 `http://` Endpoint 前显示风险确认。用户确认只对当前操作有效，不新增持久化字段。HTTPS 无提示。

测试连接成功后加载远端书籍。加载流程为：

1. 用 `listChildren("OpenReadest/Books/")` 取得书籍 hash 前缀。
2. 读取 `OpenReadest/Books/library.json`。
3. 用 library 元数据补全 title、sourceTitle 和 format。
4. library 缺失或损坏时仍展示扫描到的 hash，并记录可诊断日志。

### 7.3 统一 store 和自动同步

使用新的单一 localStorage payload，例如 `openreadest_cloud_sync_v1`，保存 profiles、活动 profile id、日志和自动同步配置。不读取旧 `readest_webdav_*` key。

全局只有一个活动 profile。选择已有 profile 或保存新 profile 会将其设为活动 profile。自动同步只执行该 profile；没有活动 profile、配置无效、离线或已有同步任务时跳过。

`WebDavAutoSyncRunner` 重命名为 provider-neutral runner，通过 factory 和统一 engine 执行。

## 8. 错误、安全和日志

Adapter 统一抛出 `RemoteStorageError`，至少包含以下脱敏错误码：

- `invalid_config`
- `authentication_failed`
- `permission_denied`
- `not_found`
- `network_error`
- `timeout`
- `cors_error`
- `signature_error`
- `clock_skew`
- `server_error`

错误对象可携带 HTTP 状态、S3 request ID、provider 和相对对象 key。不得携带 Authorization、AK、SK、签名、完整带查询参数 URL 或原始请求头。

用户提示必须给出下一步，例如缺少 ListBucket 权限、系统时间偏差、Web 端需要配置 CORS。详细诊断写入同步日志。

Web 端最低 CORS 文档应说明：

- 允许应用来源
- 允许 `GET`、`HEAD`、`PUT`
- 允许 AWS 签名使用的请求头
- 暴露 `ETag`

## 9. 测试设计

### 9.1 单元与契约测试

- CloudProfile 判别、字段校验和 profile 名称唯一性
- Endpoint、Remote Prefix 和对象 key 规范化
- 不同 profile 的本地状态隔离
- entry 级状态合并
- RemoteStorageError 映射与敏感信息脱敏
- 两个 adapter 共用的 `listChildren/stat/read/write/not-found/error` 契约

### 9.2 S3 adapter 测试

- ListObjectsV2 分页、CommonPrefixes 和空 Bucket
- HeadObject 仅把真正不存在映射为 `null`
- GetObject Body 转换
- PutObject Content-Type 和元数据刷新
- 虚拟主机式成功
- 允许的路径式回退
- 认证、权限、签名和 CORS 错误不触发回退
- Endpoint/Bucket 改变后清除寻址缓存

### 9.3 同步引擎集成测试

- 首次上传和首次下载
- 无变化跳过
- 单边变化上传/下载
- 四种冲突策略
- 单边缺失时恢复而非删除
- 失败、取消和未解决冲突不推进基线
- 成功传输后保存新的两端指纹
- 本地状态写入、远端状态修复和 profile 隔离
- 暂停、恢复、取消以及汇总结果

### 9.4 UI 与运行时测试

- WebDAV/S3 并列入口和状态文案
- provider profile 筛选
- S3 表单、Secret Key 掩码和 HTTP 风险确认
- 单一活动 profile 与自动同步切换
- Web CORS 错误提示
- Tauri/Android request handler
- 日志和导出内容无凭据

### 9.5 兼容性验证

CI 或本地自动启动 MinIO，验证真实 SigV4、路径式访问和 List/Get/Put。发布前分别对 AWS S3、MinIO 和 Cloudflare R2 做人工冒烟测试。

完成后运行应用测试、lint 和生产构建。现有 WebDAV 测试必须迁移到统一 engine 并继续通过。

## 10. 验收标准

- 用户只填写六个 S3 字段即可连接 AWS S3、MinIO 或 R2。
- 两台设备可通过同一 Bucket/Prefix 上传、发现和下载书籍及阅读数据。
- 未变化对象不会重复传输，失败对象不会进入成功基线。
- WebDAV 与 S3 共用进度、日志、冲突策略、暂停和自动同步。
- 不同 profile 的本地状态完全隔离。
- 任何用户可见信息、日志、导出文件和控制台均不泄露凭据或签名。
- WebDAV 行为除切换到统一模型和新状态协议外不回归。
- 不实现第 2.2 节列出的非目标。

## 11. 实施顺序

1. 建立 CloudProfile、统一 store、对象路径 helper、RemoteObjectStore 和新状态协议。
2. 把 WebDAV 包装为 adapter，并让现有 WebDAV 功能切换到统一同步核心。
3. 添加 AWS SDK v3 直接依赖，实现 S3 adapter、寻址探测和 Tauri request handler。
4. 将 WebDAV 中心重构为共享 CloudSyncCenter，增加并列入口和 S3 表单。
5. 替换自动同步 runner，补充错误映射、文档、翻译和完整测试矩阵。

每一步都必须保持可测试；S3 UI 不得在统一同步核心和 WebDAV adapter 契约测试通过前接入。

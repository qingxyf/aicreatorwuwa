# 鸣潮 AI 二创活动 Toy

面向 Bilibili Toy 的四个奖项赛道活动站：用户只会看到规则、投稿和投票；白名单运营人员才可通过独立 `ops.html` 入口管理作品（自有静态服务器也兼容 `/ops`）。

## 已实现

- 四赛道投稿：共鸣小剧场分最佳画风奖/最佳剧情奖，衣锦还裳分最佳服装设计奖/最佳走秀视频奖；每账号每赛道限 1 件，投稿者在抽屉内明确选择赛道。四格画风至少 4 张图片，四格剧情至少 8 张图片，服装设计至少 3 张图片，走秀视频为 1 个 10–60 秒视频。
- 三阶段活动：投稿、盲选、投票。运营可设置每阶段的起止时间与当前公开阶段；正式模式公开端及 Node API 只开放当前阶段，测试预览模式才同时显示全部流程。
- 盲选：每账号每赛道 3 票，每次从两件作品中选 1 件，低曝光作品优先。每一次选择都由服务器签发一次性票据，不能由浏览器伪造对比作品。
- 投票：每账号每日每赛道 3 票，同一作品不可重复；作品展廊展示作者头像、昵称与票数。
- 运营后台：通过 PostgreSQL `admins` 白名单控制；可审阅投稿、作者、头像、阶段票数、初选胜场/曝光、决赛票数，并设置入围、公开展示和活动流程。公开端不含后台入口。
- 审核门槛：投稿创建后固定为 `pending` 待审核；运营可在后台预览媒体并改为盲选池、入围或隐藏，只有审核通过的作品才会进入盲选或公开展廊。
- Bilibili Toy SDK：读取 `window.toy.getUserProfile()`，在适配层映射为通用账户资料。
- 媒体：阿里云 OSS 保存 JPG、PNG、WebP（单文件最多 20MB）及 MP4、WebM（单文件最多 100MB）；前端提示检测到的图片/视频类型，Node API 复核 MIME、文件大小和二进制签名；PostgreSQL 保存媒体归属和活动数据。

## 安全边界

- PostgreSQL 查询使用参数化语句；浏览器端状态、控制台请求和作品 ID 都不被服务端信任。
- 写操作需经过身份桥接核验；盲选使用一次性票据，投票/投稿/阶段均在服务端校验。
- Node API 对写接口施加按账号与路由的固定窗口限流，并限制 JSON 与媒体请求体大小；媒体响应使用 `nosniff`，生产 CORS 仅允许配置的 Toy 页面 Origin。
- 应用层控制不能替代云安全组、ECS 防火墙和 OSS 私有 Bucket；生产部署清单包含 SSH 来源收紧、HTTPS 反代、备份和日志告警。

## 技术结构

- `src/app/`：React + Ant Design 的公开活动页与受保护的 `/ops` 运营页。
- `server/`：Node.js/Hono API、PostgreSQL repository、OSS 媒体适配器、身份核验和启动入口。
- `server/migrations/001_init.sql`：PostgreSQL 表结构、索引、唯一约束和默认活动设置。
- `docker-compose.yml`：ECS 上的 API + PostgreSQL 编排；数据库只在 Compose 私网可见。
- 层级保持为 `types → config → policy → domain → services → adapters → entrypoints → app`，并由架构检查验证。

生产 API 的 CORS 来源必须配置为 Toy 内嵌页面 Origin `https://www.bilibilitoy.com`；外层分享地址 `https://www.bilibili.com` 不是实际请求来源。

## 本地开发与检查

### GitHub Pages 预览

仓库公开后，`main` 分支会由 `.github/workflows/pages.yml` 自动构建静态预览，地址为：<https://qingxyf.github.io/aicreatorwuwa/>。该地址只托管前端静态页面，并显式启用本地演示数据用于完整流程预览；投稿、投票和运营后台要在正式环境中工作，仍需要配置 `VITE_API_BASE_URL` 指向已部署的 ECS API。

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

发布 Toy 前使用 `npm run build:toy`，它会自动注入正式 API 地址并校验 Toy 子路径资源；不要用未配置 API 的普通生产构建直接上传。

本地开发时可将 Node API 的 `MODE` 设为 `development`，并使用测试专用 `X-Dev-Viewer` 请求头；生产环境只接受身份核验桥接服务验证过的断言。

未连接本地 Node API 时，Vite 开发预览会自动进入本地演示模式：同一页展示投稿、盲选、投票三个流程，并使用明确标注的演示作品与奖励待公布文案；该回退仅在开发构建启用，生产环境不会使用演示数据。

首次部署时，Docker Compose 会自动按顺序执行 `server/migrations/*.sql` 初始化或升级 PostgreSQL。随后由白名单运营账号在 `/ops` 填写三个阶段的时间和当前阶段。

Toy 页面在 HTTPS 下运行，生产 API 不能直接配置为裸 `http://IP`：浏览器会因混合内容拦截请求；仅使用 IP 也无法获得受信任的 HTTPS 证书。IP 可用于 ECS 内部健康检查或本地开发，Toy 联调需要固定 HTTPS 域名或其他受信任的 HTTPS 转发地址。

```powershell
npm run check:precompletion
```

该命令依次运行 TypeScript/Vite 构建、ESLint、Vitest、架构边界检查和 `dist/` 140MB 包体检查。

## 文档索引

- [Bilibili Toy 与 ECS 部署说明](docs/deployment/bilibili-toy.md)：ECS、PostgreSQL、OSS 初始化、身份桥接、环境变量、发布、运营时间配置与上线安全清单。
- [Bilibili Toy SDK 接入边界](docs/integrations/bilibili-toy.md)：SDK 可用能力、身份信任边界与适配层职责。
- [需求差异与口头需求记录](docs/requirements/2026-08-18-wuwa-toy-additions-and-deltas.md)：相对两份活动公告的 D1–D20 变更及已撤销规则。
- [实施计划](docs/superpowers/plans/2026-08-18-toy-activity-platform.md)：本次平台的范围与交付安排。

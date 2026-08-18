# 鸣潮 AI 二创活动 Toy

面向 Bilibili Toy 的两个赛道活动站：用户只会看到规则、投稿和投票；白名单运营人员才可通过独立 `/ops` 地址管理作品。

## 已实现

- 两赛道投稿：每账号每赛道限 1 件；投稿者在抽屉内明确选择赛道。共鸣小剧场须至少 4 张图片，衣锦还裳须至少 3 张图片或 1 个视频。
- 三阶段活动：投稿、盲选、投票。运营可设置每阶段的起止时间与当前公开阶段；正式模式公开端及 Worker 只开放当前阶段，测试预览模式才同时显示全部流程。
- 盲选：每账号每赛道 3 票，每次从两件作品中选 1 件，低曝光作品优先。每一次选择都由服务器签发一次性票据，不能由浏览器伪造对比作品。
- 投票：每账号每日每赛道 3 票，同一作品不可重复；作品展廊展示作者头像、昵称与票数。
- 运营后台：通过 D1 `admins` 白名单控制；可审阅投稿、作者、头像、阶段票数、初选胜场/曝光、决赛票数，并设置入围、公开展示和活动流程。公开端不含后台入口。
- Bilibili Toy SDK：读取 `window.toy.getUserProfile()`，在适配层映射为通用账户资料。
- 媒体：R2 保存 JPG、PNG、WebP（单文件最多 20MB）及 MP4、WebM（单文件最多 100MB）；前端提示检测到的图片/视频类型，Worker 复核 MIME、文件大小和二进制签名；D1 保存媒体归属和活动数据。

## 安全边界

- D1 查询使用参数化语句；浏览器端状态、控制台请求和作品 ID 都不被服务端信任。
- 写操作需经过身份桥接核验；盲选使用一次性票据，投票/投稿/阶段均在服务端校验。
- Worker 对写接口施加按账号与路由的固定窗口限流，并限制 JSON 与媒体请求体大小；媒体响应使用 `nosniff`，生产 CORS 仅允许配置的 Toy 页面 Origin。
- 应用层控制不能替代边缘防护。生产必须开启 Cloudflare Managed WAF、Bot/速率限制与 DDoS 防护，具体规则见部署说明。

## 技术结构

- `src/app/`：React + Ant Design 的公开活动页与受保护的 `/ops` 运营页。
- `src/entrypoints/worker.ts`：Cloudflare Worker 的 API、阶段控制和跨域策略。
- `src/adapters/worker/`：D1 数据仓库、R2 媒体存储、身份核验、限流适配器。
- `migrations/`：D1 表结构与活动配置/限流迁移。
- 层级保持为 `types → config → policy → domain → services → adapters → entrypoints → app`，并由架构检查验证。

## 本地开发与检查

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

本地开发时可将 Worker 的 `MODE` 设为 `development`，并使用测试专用 `X-Dev-Viewer` 请求头；生产环境只接受身份核验桥接服务验证过的断言。

未连接本地 Worker 时，Vite 开发预览会自动进入本地演示模式：同一页展示投稿、盲选、投票三个流程，并使用明确标注的演示作品与奖励待公布文案；该回退仅在开发构建启用，生产环境不会使用演示数据。

首次部署或升级现有环境时，按顺序执行两个 D1 迁移：`migrations/0001_init.sql` 与 `migrations/0002_activity-settings-and-rate-limits.sql`。随后由白名单运营账号在 `/ops` 填写三个阶段的时间和当前阶段。

```powershell
npm run check:precompletion
```

该命令依次运行 TypeScript/Vite 构建、ESLint、Vitest、架构边界检查和 `dist/` 140MB 包体检查。

## 文档索引

- [Bilibili Toy 与 Cloudflare 部署说明](docs/deployment/bilibili-toy.md)：D1/R2 初始化、身份桥接、环境变量、发布、运营时间配置与上线安全清单。
- [Bilibili Toy SDK 接入边界](docs/integrations/bilibili-toy.md)：SDK 可用能力、身份信任边界与适配层职责。
- [需求差异与口头需求记录](docs/requirements/2026-08-18-wuwa-toy-additions-and-deltas.md)：相对两份活动公告的 D1–D20 变更及已撤销规则。
- [实施计划](docs/superpowers/plans/2026-08-18-toy-activity-platform.md)：本次平台的范围与交付安排。

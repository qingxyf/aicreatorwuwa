# ECS + PostgreSQL + OSS 后端设计

## 目标

将当前仅适配 Cloudflare Worker/D1/R2 的活动 API 迁移为可部署到阿里云 ECS 的 Node.js 服务，继续复用现有投稿、盲选、投票和运营白名单领域规则，并让 Toy 静态前端通过 HTTPS 调用真实后端。

## 方案

- Node.js + Hono + `@hono/node-server` 提供 HTTP API。
- PostgreSQL 保存活动设置、投稿、媒体元数据、配对票据、盲选票、投票票、限流窗口和运营白名单。
- Alibaba OSS 私有 Bucket 保存图片/视频字节；后端校验 MIME、文件签名和大小后写入 OSS，并通过后端媒体路由读取，不向浏览器暴露 AccessKey/SecretKey。
- Docker Compose 在 ECS 上编排 API 与 PostgreSQL；`.env` 只存在服务器，仓库只提交 `.env.example`。
- Toy SDK 负责读取当前页面用户的 `toyOpenId`、昵称和头像；生产 API 只接受配置的身份断言验证器，不把浏览器提交的 `toyOpenId` 当作可信认证。

## 数据流

1. Toy 页面调用 `window.toy.getUserProfile()`，获得当前用户资料。
2. 前端把平台断言放在 `Authorization`，发送至 Node API。
3. Node API 调用身份验证适配器，得到规范化 Viewer。
4. 投稿先上传媒体，API 校验后写 OSS 与 `media_objects`；随后在 PostgreSQL 事务中创建投稿。
5. API 通过事务和唯一约束执行每赛道限投稿、盲选每赛道 3 票、投票阶段每日每赛道 3 票且同作品不可重复。
6. 运营 API 通过白名单检查后读取作品、作者、头像、盲选胜场、曝光数、投票阶段票数，并管理入围和展示状态。

## 错误与安全

- 所有查询使用参数化 SQL；请求体、媒体大小、MIME、文件签名、来源和方法均在服务端校验。
- API 使用固定窗口限流；数据库事务负责并发下的票数和配额一致性。
- OSS Bucket 保持私有，CORS 仅允许已配置的 Toy/GitHub Pages/本地来源；未完成分片 7 天自动清理。
- 内部异常只返回稳定错误码，不回显 SQL、密钥或堆栈。
- ECS 仅暴露 80/443（SSH 后续收紧来源）；PostgreSQL 只绑定 Compose 内网，不开放公网端口。

## 验证标准

- `npm run build`、`npm run lint`、`npm test`、架构和包大小检查全部通过。
- API 单元测试覆盖身份、媒体签名、投稿配额、盲选票、每日投票和白名单。
- Docker Compose 健康检查通过；API `/healthz`、数据库连接和 OSS 配置均可验证。
- Toy 静态包通过路径/资源预检后，先生成预览链接，由用户检查后再提交审核。

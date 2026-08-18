# ECS PostgreSQL OSS 后端迁移实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 在阿里云 ECS 上提供真实 Node API、PostgreSQL 数据库和私有 OSS 媒体存储，并让 Toy 前端接入。

**Architecture:** Node/Hono API 复用现有领域规则；PostgreSQL repository 替代 D1；OSS adapter 替代 R2；Docker Compose 负责 API 与数据库编排，Toy 仅承载静态前端。

**Tech Stack:** Node.js 22、TypeScript、Hono、@hono/node-server、pg、ali-oss、PostgreSQL 16、Docker Compose、Vite/React。

---

### Task 1: 添加 PostgreSQL/OSS 适配层与测试

**Files:**
- Create: `server/db.ts`, `server/oss.ts`, `server/identity.ts`, `server/repository.ts`
- Create: `tests/server/oss.test.ts`, `tests/server/identity.test.ts`
- Modify: `package.json`, `package-lock.json`

- [ ] 先写媒体签名、身份断言和 repository 边界测试，确认新模块当前失败。
- [ ] 实现 PostgreSQL 参数化查询、事务包装、限流窗口和 OSS 私有对象读写。
- [ ] 运行新增测试并修复类型错误。

### Task 2: 实现 Node API

**Files:**
- Create: `server/app.ts`, `server/index.ts`, `server/errors.ts`
- Modify: `src/adapters/http/public-activity-client.ts`

- [ ] 保持现有 `/api/v1/*` 路径，迁移 config、session、media、submission、pairing、final-vote 和 ops 路由。
- [ ] 添加 `/healthz`，生产 CORS 仅允许 `PUBLIC_APP_ORIGIN`。
- [ ] 将 Cloudflare 专用入口标记为遗留，不在新服务核心规则中引入 provider 字段。

### Task 3: 数据库迁移与部署编排

**Files:**
- Create: `server/migrations/001_init.sql`, `docker-compose.yml`, `Dockerfile`, `server/.env.example`
- Modify: `.env.example`, `README.md`, `docs/deployment/bilibili-toy.md`

- [ ] 创建 PostgreSQL 表、索引、唯一约束和默认活动设置。
- [ ] 配置 API、数据库健康检查、内部网络和持久化卷；PostgreSQL 不映射公网端口。
- [ ] 写明 RAM 最小权限、OSS Bucket、备份、域名 HTTPS 和 ECS 部署命令。

### Task 4: 前端真实联调与回归

**Files:**
- Modify: `src/config/static-preview.ts`, `src/adapters/http/public-activity-client.ts`, `src/app/App.tsx`, `src/app/OpsApp.tsx`
- Create: `tests/server/api-contract.test.ts`

- [ ] 保留本地 demo fallback，但生产构建使用 `VITE_API_BASE_URL`。
- [ ] 验证两个赛道选择、图片/视频检测、三个阶段时间、作品完整预览、作者头像和后台状态控制。
- [ ] 运行前端与 API 契约测试。

### Task 5: 部署、Toy 预览与审核

**Files:**
- Modify: `README.md`, `docs/deployment/bilibili-toy.md`

- [ ] 在 ECS 上配置 `.env`、迁移 PostgreSQL、启动 Compose、验证 `/healthz`。
- [ ] 构建静态包并运行 Toy 内容预检、构建、lint、测试、架构和包大小检查。
- [ ] 用 `toy --help-json` 对齐命令，先无 `--yes` 生成预览；人工检查后再显式确认并提交审核。

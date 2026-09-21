# 孤立媒体运营可见性与投稿媒体浏览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留并展示历史孤立媒体，记录未来投稿尝试，并让运营后台可浏览每次投稿的全部媒体。

**Architecture:** PostgreSQL 增加投稿尝试与媒体关联字段；Node API 在上传/投稿失败链路记录尝试状态，并提供受保护的孤立媒体分组接口；React 运营后台增加孤立媒体区域和通用媒体浏览弹窗。

**Tech Stack:** PostgreSQL migrations, Node.js/Hono, TypeScript, React, Ant Design, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-21-orphan-media-ops-design.md`

## Global Constraints

- 不删除已有 OSS 对象或 `media_objects` 行。
- 运营数据接口必须继续使用密码会话保护。
- 历史孤立数据没有可靠资料时只展示用户 ID、时间和媒体，不猜测标题/赛道。
- 正常公开投稿、投票和媒体授权逻辑保持不变。

### Task 1: 数据模型与领域类型

**Files:**
- Create: `server/migrations/006-submission-attempts.sql`
- Modify: `src/types/contest.ts`
- Modify: `server/repository.ts`
- Test: `tests/server/repository.test.ts`

- [ ] 写失败测试：孤立查询返回按尝试和历史窗口分组的媒体，并保留媒体 URL、用户 ID、状态和失败原因。
- [ ] 运行 `npm test -- tests/server/repository.test.ts`，确认因接口缺失失败。
- [ ] 创建 `submission_attempts` 表并为 `media_objects` 增加可空 `attempt_id` 外键与索引。
- [ ] 增加 `SubmissionAttemptContext`、`OperatorOrphanMediaGroup` 和 repository 方法类型。
- [ ] 实现 PostgreSQL 查询：引用关系排除已归档媒体；带尝试 ID 的行按尝试分组；历史行按 owner 与十分钟窗口分组。
- [ ] 运行 repository 测试确认通过。

### Task 2: 上传与投稿失败追踪

**Files:**
- Modify: `src/types/contest.ts`
- Modify: `src/adapters/http/public-activity-client.ts`
- Modify: `src/app/App.tsx`
- Modify: `server/app.ts`
- Modify: `server/repository.ts`
- Modify: `server/oss.ts`
- Test: `tests/server/api-contract.test.ts`

- [ ] 写失败测试：带尝试 ID 的媒体上传记录尝试，投稿失败后尝试状态为 `failed`，投稿成功后为 `submitted`。
- [ ] 运行 API 测试确认失败原因是接口和字段尚不存在。
- [ ] 让客户端在提交前生成尝试 ID，并把投稿资料传入每个媒体上传与最终投稿请求。
- [ ] 让服务端校验尝试资料、记录媒体关联，并在最终投稿成功/失败时更新状态。
- [ ] 保留没有尝试 ID 的旧客户端兼容路径。
- [ ] 运行 API 测试确认状态转换和异常路径通过。

### Task 3: 运营 API 与客户端

**Files:**
- Modify: `server/app.ts`
- Modify: `src/adapters/http/public-activity-client.ts`
- Modify: `src/types/contest.ts`
- Test: `tests/server/api-contract.test.ts`

- [ ] 写失败测试：未登录不能访问孤立媒体；有效运营会话能得到带签名 URL 的分组数组。
- [ ] 实现 `GET /api/v1/ops/orphan-media`，复用运营媒体签名逻辑。
- [ ] 暴露 `listOrphanMedia()` 给运营客户端。
- [ ] 运行 API 测试确认鉴权和签名 URL 通过。

### Task 4: 运营后台媒体浏览与孤立区域

**Files:**
- Modify: `src/app/OpsApp.tsx`
- Modify: `src/app/styles.css`
- Test: `tests/app/ops-experience.test.tsx`

- [ ] 写失败测试：登录后显示孤立媒体数量/分组；点击正常投稿或孤立组预览后可看到全部媒体与切换按钮。
- [ ] 增加孤立媒体状态和登录时并行加载。
- [ ] 增加可访问的媒体预览触发器与图片/视频浏览弹窗。
- [ ] 增加孤立媒体表格/卡片，展示用户 ID、尝试资料、时间、原因和媒体数量。
- [ ] 调整后台布局、缩略图、弹窗和移动端样式。
- [ ] 运行组件测试确认交互通过。

### Task 5: 全量验证

**Files:**
- Modify: `docs/reports/toy.md` only if validation facts need updating.

- [ ] 运行 `npm test`。
- [ ] 运行 `npm run build`。
- [ ] 运行 `npm run lint`。
- [ ] 检查 `git diff`，确认没有删除逻辑、密钥或无关改动。

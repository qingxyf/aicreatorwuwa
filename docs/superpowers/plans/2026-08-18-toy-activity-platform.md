# 鸣潮 AI 二创活动 Toy 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建可发布到 Bilibili Toy 的四赛道活动站，含直接投稿、两阶段投票、B 站账号资料读取、受保护运营接口与图片/视频对象存储后端。

**Architecture:** `src/types -> config -> policy -> domain -> services -> adapters -> entrypoints -> app`。Toy SDK 仅由账户适配器调用；D1/R2、HTTP 和 Workers 仅位于适配器/入口层。公开 React 界面只通过服务层读取与改变状态，运营入口没有公开导航链接。

**Tech Stack:** React 19、Vite、TypeScript、Ant Design、Hono、Cloudflare Workers + D1 + R2、Vitest、Playwright。

---

### Task 1: 建立工程、文档与 harness 守卫

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `wrangler.toml`, `index.html`
- Create: `src/types/*`, `src/config/activity.ts`, `src/entrypoints/main.tsx`, `src/entrypoints/worker.ts`
- Create: `scripts/harness/check-architecture.mjs`, `docs/requirements/2026-08-18-wuwa-toy-additions-and-deltas.md`, `docs/integrations/bilibili-toy.md`
- Test: `tests/architecture.test.ts`

- [ ] **Step 1: 写失败的架构守卫测试。**

```ts
import { expect, test } from 'vitest';
import { validateArchitecture } from '../scripts/harness/check-architecture.mjs';

test('rejects imports from a lower layer to a higher layer', () => {
  expect(validateArchitecture('domain', '../app/App')).toBe(false);
});
```

- [ ] **Step 2: 运行测试确认其因模块缺失失败。**

Run: `npm test -- tests/architecture.test.ts`

- [ ] **Step 3: 创建 Vite、Workers 和分层守卫。**

`check-architecture.mjs` 导出按 harness 层级比较 import 来源的 `validateArchitecture`，并扫描 `src/`。`package.json` 暴露 `dev`、`build`、`lint`、`test`、`check:architecture` 与 `deploy` 命令。

- [ ] **Step 4: 再次运行测试与架构检查。**

Run: `npm test -- tests/architecture.test.ts && npm run check:architecture`

- [ ] **Step 5: 提交工程骨架。**

```bash
git add package.json vite.config.ts vitest.config.ts wrangler.toml index.html src scripts docs tests
git commit -m "chore: scaffold Toy activity platform"
```

### Task 2: 用测试先行实现活动领域规则

**Files:**
- Create: `src/types/activity.ts`, `src/types/platform.ts`
- Create: `src/config/activity.ts`, `src/policy/voting.ts`
- Create: `src/domain/submission.ts`, `src/domain/pairing.ts`, `src/domain/final-vote.ts`
- Test: `tests/domain/submission.test.ts`, `tests/domain/pairing.test.ts`, `tests/domain/final-vote.test.ts`

- [ ] **Step 1: 写失败测试：同一用户赛道只能有一件有效投稿。**

```ts
test('rejects a second active submission in the same track', () => {
  expect(canCreateSubmission({ activeSubmissions: 1 })).toEqual({ allowed: false, reason: 'submission_limit' });
});
```

- [ ] **Step 2: 写失败测试：第一阶段只发放五次配对且优先低曝光作品。**

```ts
test('selects the two least exposed eligible entries', () => {
  expect(selectBalancedPair(entries, new Set())).toEqual(['work-c', 'work-d']);
});
```

- [ ] **Step 3: 写失败测试：第二阶段三票/赛道/日且不得重复。**

```ts
test('rejects a duplicate work and a fourth daily vote', () => {
  expect(validateFinalVote(history, 'work-a')).toEqual({ allowed: false, reason: 'duplicate_work' });
});
```

- [ ] **Step 4: 运行红灯，实施最小纯函数，再运行绿灯。**

Run: `npm test -- tests/domain`

- [ ] **Step 5: 提交领域规则与测试。**

```bash
git add src/types src/config src/policy src/domain tests/domain
git commit -m "feat: add contest submission and voting rules"
```

### Task 3: 实现 Toy 账户、持久化和媒体适配器

**Files:**
- Create: `src/services/contest-service.ts`, `src/services/auth-service.ts`
- Create: `src/adapters/toy/account-client.ts`, `src/adapters/http/contest-api.ts`
- Create: `src/adapters/worker/d1-contest-repository.ts`, `src/adapters/worker/r2-media-store.ts`, `src/adapters/worker/identity-verifier.ts`
- Create: `src/entrypoints/worker.ts`, `migrations/0001_init.sql`
- Test: `tests/services/contest-service.test.ts`, `tests/adapters/toy-account.test.ts`

- [ ] **Step 1: 写失败测试：Toy 账户资料映射为不含厂商字段的 `Viewer`。**

```ts
test('maps Toy profile to viewer identity', async () => {
  await expect(service.currentViewer()).resolves.toMatchObject({ id: 'toy-open-id', name: '漂泊者', avatarUrl: 'https://...' });
});
```

- [ ] **Step 2: 写失败测试：服务层拒绝绕过规则的投稿和投票。**

```ts
test('does not persist an invalid final vote', async () => {
  await expect(service.castFinalVote(input)).rejects.toThrow('duplicate_work');
});
```

- [ ] **Step 3: 实现端口、Toy SDK 客户端和 Workers API。**

客户端只调用已核验的 `window.toy.getUserProfile()`；资料映射为 `id/name/avatarUrl`。Hono Worker 为会话、投稿、配对、第一阶段选择、第二阶段投票、媒体上传、作品展廊和运营操作提供接口。D1 保存事务性记录；R2 保存二进制媒体，返回受控媒体 URL。身份校验接口仅接受适配器提供的断言，生产配置缺失时必须拒绝写操作，不能信任浏览器传来的用户 ID。

- [ ] **Step 4: 应用 D1 迁移并运行服务测试。**

Run: `npm test -- tests/services tests/adapters`

- [ ] **Step 5: 提交后端与适配器。**

```bash
git add src/services src/adapters src/entrypoints/worker.ts migrations tests
git commit -m "feat: add Toy identity and contest storage APIs"
```

### Task 4: 构建四赛道公开端与独立运营入口

**Files:**
- Create: `src/app/App.tsx`, `src/app/styles.css`, `src/app/components/*`, `src/app/hooks/*`
- Create: `public/assets/rainy-wuwa-hero.png`
- Test: `tests/app/vote-flow.test.tsx`, `tests/app/submission-flow.test.tsx`

- [ ] **Step 1: 写失败测试：公开导航不含运营入口，投稿与投票操作更新真实状态。**

```tsx
test('shows only rules, submit and vote in public navigation', () => {
  render(<App dependencies={fakeDependencies} />);
  expect(screen.queryByText('运营后台')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: 写失败测试：第二阶段展示作者头像与票数并阻止重复投票。**

```tsx
await user.click(screen.getByRole('button', { name: '投票给雨夜新装' }));
expect(screen.getByText('今日剩余 2 票')).toBeVisible();
```

- [ ] **Step 3: 实现公开体验。**

用提供的雨景素材制作雨巷画卷首屏；实现活动/赛道选择、规则、上传抽屉、二选一投票和第二阶段作品展廊。使用 Ant Design 的上传、抽屉、模态、头像和消息反馈，所有业务状态从服务层读取。`/ops` 是独立受保护入口，绝不放入公开导航。

- [ ] **Step 4: 运行组件测试。**

Run: `npm test -- tests/app`

- [ ] **Step 5: 提交公开端。**

```bash
git add src/app src/entrypoints/main.tsx public/assets tests/app
git commit -m "feat: build public activity experience"
```

### Task 5: 发布准备、质量验证与交付

**Files:**
- Create: `README.md`, `.env.example`, `docs/deployment/bilibili-toy.md`
- Modify: `wrangler.toml`

- [ ] **Step 1: 写部署配置测试与构建体积检查。**

```ts
test('keeps deployable static bundle under 140 MB', () => {
  expect(readBundleSize('dist')).toBeLessThanOrEqual(140 * 1024 * 1024);
});
```

- [ ] **Step 2: 实现环境变量、Worker 绑定与发布说明。**

说明 D1、R2、身份核验适配器、白名单初始化、Toy 脚本与发布路径。绝不把密钥提交入仓库。

- [ ] **Step 3: 运行所有 precompletion 检查。**

Run: `npm run build && npm run lint && npm test && npm run check:architecture`

- [ ] **Step 4: 在浏览器中验证。**

检查桌面与移动端的首屏、规则、投稿、第一阶段选择、第二阶段投票，以及未经白名单访问 `/ops` 的拒绝状态。

- [ ] **Step 5: 提交并推送实现。**

```bash
git add .
git commit -m "feat: deliver Wuwa Toy activity platform"
git push -u origin feat/toy-activity-platform
```

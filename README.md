# 鸣潮 AI 二创活动 Toy

面向 Bilibili Toy 的两个赛道活动站：用户只会看到规则、投稿和投票；白名单运营人员才可通过独立 `/ops` 地址管理作品。

## 已实现

- 两赛道投稿：每账号每赛道限 1 件；共鸣小剧场须至少 4 张图片，衣锦还裳须至少 3 张图片或 1 个视频。
- 初选：每账号每赛道 3 次二选一，低曝光作品优先。每一次选择都由服务器签发一次性票据，不能由浏览器伪造对比作品。
- 决赛：每账号每日每赛道 3 票，同一作品不可重复；作品展廊展示作者头像、昵称与票数。
- 运营后台：通过 D1 `admins` 白名单控制；可审阅投稿、作者、头像、初选胜场/曝光、决赛票数，并设置入围及公开展示状态。
- Bilibili Toy SDK：读取 `window.toy.getUserProfile()`，在适配层映射为通用账户资料。
- 媒体：R2 保存 JPG、PNG、WebP（单文件最多 20MB）及 MP4、WebM（单文件最多 100MB）；D1 保存媒体归属和活动数据。

## 本地开发与检查

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

本地开发时可将 Worker 的 `MODE` 设为 `development`，并使用测试专用 `X-Dev-Viewer` 请求头；生产环境只接受身份核验桥接服务验证过的断言。

```powershell
npm run check:precompletion
```

该命令依次运行 TypeScript/Vite 构建、ESLint、Vitest、架构边界检查和 `dist/` 140MB 包体检查。

详细部署流程见 [Bilibili Toy 部署说明](docs/deployment/bilibili-toy.md)。

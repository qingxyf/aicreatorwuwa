# Bilibili Toy 与 Cloudflare 部署说明

## 1. 创建持久化资源

在 Cloudflare 中创建 D1 数据库和 R2 存储桶，并把得到的 D1 ID 写入 `wrangler.toml`：

```powershell
npx wrangler d1 create wuwa-toy-activity
npx wrangler r2 bucket create wuwa-toy-media
npx wrangler d1 execute wuwa-toy-activity --remote --file migrations/0001_init.sql
```

生产 Worker 需要一个**由平台验证身份断言**的桥接服务；不要把浏览器从 Toy SDK 获得的 `toyOpenId` 当作可信身份。配置桥接服务后设置密钥：

```powershell
npx wrangler secret put IDENTITY_VERIFY_URL
npx wrangler secret put IDENTITY_VERIFY_SECRET
npx wrangler secret put MEDIA_PUBLIC_BASE_URL
```

在 `wrangler.toml` 的 `[vars]` 中配置 `MODE = "production"`。部署后，`MEDIA_PUBLIC_BASE_URL` 设为 Worker 的 HTTPS 域名。

## 2. 初始化运营白名单

使用桥接服务返回的 Toy 开放标识初始化运营账号，值必须是实际、已验证的标识：

```powershell
npx wrangler d1 execute wuwa-toy-activity --remote --command "INSERT OR IGNORE INTO admins (viewer_id) VALUES ('TOY_OPEN_ID')"
```

只有此表中账号访问 `/ops` 的 API 会通过；公开页面没有运营入口。

## 3. 部署 Worker 与构建 Toy 静态包

```powershell
npm ci
$env:VITE_API_BASE_URL = "https://your-worker.example"
$env:VITE_TOY_BASE_PATH = "/your-custom-toy-path/"
npm run check:precompletion
npm run deploy
```

`VITE_TOY_BASE_PATH` 会写入 Vite 的资源基址，必须与 Toy 控制台配置的自定义访问路径一致。`check:bundle-size` 确认静态 `dist/` 不超过 140MB；运行时用户上传的图片/视频在 R2，不计入该静态包。

## 4. 在 Toy 控制台发布和更新

1. 按 Toy 新手指引创建应用并配置自定义访问路径。
2. 上传 `dist/` 的全部内容，确保 `index.html` 与资源目录保持同级关系。
3. 将 API 地址设置为上一步部署的 Worker 域名（通过 `VITE_API_BASE_URL` 在构建时写入）。
4. 需要更新页面时，重新构建、运行 `npm run check:precompletion`，然后在 Toy 控制台上传新的 `dist/`；同一路径可以重复更新。

发布前参考 [Toy SDK 接入边界](../integrations/bilibili-toy.md)，确认生产身份桥接已就绪。没有身份桥接时，生产 Worker 会拒绝写操作，这是为了避免伪造投稿和投票。

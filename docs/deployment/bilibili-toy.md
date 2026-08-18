# Bilibili Toy 与 Cloudflare 部署说明

## 1. 创建持久化资源

在 Cloudflare 中创建 D1 数据库和 R2 存储桶，并把得到的 D1 ID 写入 `wrangler.toml`：

```powershell
npx wrangler d1 create wuwa-toy-activity
npx wrangler r2 bucket create wuwa-toy-media
npx wrangler d1 execute wuwa-toy-activity --remote --file migrations/0001_init.sql
npx wrangler d1 execute wuwa-toy-activity --remote --file migrations/0002_activity-settings-and-rate-limits.sql
```

生产 Worker 需要一个**由平台验证身份断言**的桥接服务；不要把浏览器从 Toy SDK 获得的 `toyOpenId` 当作可信身份。配置桥接服务后设置密钥：

```powershell
npx wrangler secret put IDENTITY_VERIFY_URL
npx wrangler secret put IDENTITY_VERIFY_SECRET
npx wrangler secret put MEDIA_PUBLIC_BASE_URL
```

在 `wrangler.toml` 的 `[vars]` 中配置 `MODE = "production"` 和准确的 `PUBLIC_APP_ORIGIN`（Toy 公开页面的**完整 Origin**，不能写 `*`）。部署后，`MEDIA_PUBLIC_BASE_URL` 设为 Worker 的 HTTPS 域名。

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

## 5. 活动流程与时间

白名单账号进入 `/ops` 后可以设置当前公开阶段、测试预览开关和三个阶段的起止时间：投稿阶段、盲选阶段、投票阶段。

- 正常模式下，公开端和 Worker 写接口仅开放当前阶段；例如投稿结束后不能再上传或投稿。
- 仅在测试时开启“测试预览”，它会同时展示三个流程，并临时放行相应测试接口。
- 未填写日期时，公开页面明确显示“时间待运营发布”，不会擅自使用示例日期。

## 6. 上线前安全配置

Worker 已实施以下应用层控制：参数化 D1 查询、服务端身份核验、单次配对票据、阶段服务端拦截、每账号/路由固定窗口限流、JSON 与媒体请求体大小上限、媒体 MIME/文件签名双重校验、媒体响应 `nosniff`、生产 CORS 精确 Origin 和不回显内部异常。

这并不替代边缘抗攻击。部署前还必须在 Cloudflare 为 Worker 配置并验证：

1. 启用 Managed WAF Rules、Bot/速率限制能力和 Cloudflare 的默认 DDoS 防护。
2. 对 `/api/v1/media` 设置更严格的边缘限速与约 101 MiB 请求体上限；对投稿、盲选、投票和 `/api/v1/ops/*` 按 IP、路径设置限速规则。
3. 仅允许预期的 HTTP 方法；拦截异常 User-Agent、跨站来源和明显扫描行为，并将命中日志接入告警。
4. 将生产 `MODE` 保持为 `production`，确认未配置 `X-Dev-Viewer` 等开发身份绕过，并将身份桥接密钥只以 Worker secret 保存。

前端不执行 `eval`、动态脚本或浏览器控制台命令；React 默认转义普通文本。用户可以修改自己浏览器的页面或请求，但无法绕过 Worker 的身份、阶段、票据和数据库原子校验。

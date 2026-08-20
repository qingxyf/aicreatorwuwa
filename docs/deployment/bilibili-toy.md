# Bilibili Toy 与阿里云 ECS 部署说明

生产结构为：Toy 静态前端 → HTTPS → ECS Node.js API → PostgreSQL + 私有 OSS。项目不依赖 Cloudflare Worker、D1 或 R2。

## 1. 已准备的云资源

- ECS：Ubuntu 22.04，2 vCPU / 4 GiB，公网 IP 47.98.188.65。
- OSS Bucket：aixiaozhanandmingchaoxiaozhan，华东 1（杭州），标准存储、同城冗余、阻止公共访问已开启。
- OSS CORS：允许 B 站、GitHub Pages 和本地预览来源，GET/POST/PUT/HEAD，暴露 ETag 与 x-oss-request-id。
- OSS 生命周期：未完成分片 7 天后自动清理。

不要把 AccessKey、SecretKey、SSH 私钥或身份断言写入仓库或发送到聊天中。服务器使用 RAM 最小权限凭据，只允许当前 Bucket 的对象读写、分片上传和终止分片。

## 2. ECS 初始化

在 ECS 上安装 Docker 与 Compose，创建部署目录：

    sudo mkdir -p /opt/wuwa-ai/app /opt/wuwa-ai/backups
    sudo chown -R wuwa:wuwa /opt/wuwa-ai

将仓库复制到 /opt/wuwa-ai/app，创建只存在服务器的 /opt/wuwa-ai/app/.env：

    MODE=production
    PORT=8787
    POSTGRES_DB=wuwa
    POSTGRES_USER=wuwa
    POSTGRES_PASSWORD=generate-a-long-random-value
    DATABASE_URL=postgres://wuwa:generate-a-long-random-value@db:5432/wuwa
    OSS_REGION=oss-cn-hangzhou
    OSS_BUCKET=aixiaozhanandmingchaoxiaozhan
    OSS_ACCESS_KEY_ID=ram-user-key
    OSS_ACCESS_KEY_SECRET=ram-user-secret
    PUBLIC_APP_ORIGIN=https://www.bilibili.com
    MEDIA_PUBLIC_BASE_URL=https://api.example.com
    IDENTITY_VERIFY_URL=https://identity-bridge.example/verify
    IDENTITY_VERIFY_SECRET=server-only-secret
    ALLOW_TOY_PROFILE_IDENTITY=false

PUBLIC_APP_ORIGIN 必须改成 Toy 页面真实 Origin，不能使用通配符。如果 Toy 页面由 GitHub Pages 预览，还需将对应 Origin 加入 OSS CORS，但生产 API 仍只允许正式页面 Origin。

如果暂时没有身份断言桥接服务，可将服务端 `ALLOW_TOY_PROFILE_IDENTITY=true`、前端构建变量 `VITE_TRUST_TOY_PROFILE=true`。这会把 Toy SDK 返回的稳定开放标识、昵称和头像作为弱身份使用，能支持当前活动但不能抵御伪造请求；正式活动建议改回 `false` 并接入签名断言验证器。

启动并检查：

    cd /opt/wuwa-ai/app
    docker compose up -d --build
    docker compose ps
    curl -fsS http://127.0.0.1:8787/healthz

PostgreSQL 只映射在 Compose 私网，API 仅绑定本机 8787，公网通过 Nginx/Caddy 反代到 HTTPS。安全组只开放 80/443；SSH 配置密钥后把 22 限制为个人固定 IP。

## 3. 数据库和白名单

API 容器启动前会运行 `server/migrate.ts`，按文件名顺序执行 `server/migrations/*.sql`，并在 `schema_migrations` 中记录已应用版本。四赛道迁移由 `002_four_tracks.sql` 完成；旧版两赛道测试记录会映射到新的奖项赛道并保留票数。生产执行迁移前仍应先完成数据库备份。

身份核验服务返回的规范化 Viewer.id（Toy 内稳定开放标识，不是 B 站 UID/MID）加入白名单：

    docker compose exec db psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "INSERT INTO admins(viewer_id) VALUES ('VERIFIED_TOY_OPEN_ID') ON CONFLICT DO NOTHING;"

只有白名单账号能访问 /ops 的数据和写接口，公开页面不显示后台入口。

## 4. 本地构建和 GitHub Pages 预览

    npm ci
    $env:VITE_API_BASE_URL = "https://api.example.com"
    # Toy 包内资源必须使用相对路径；自定义访问路径由 Toy 平台的 slug 控制
    $env:VITE_TOY_BASE_PATH = "./"
    npm run check:precompletion

Toy 包内使用 `./` 作为 Vite base，避免 `/toy/<slug>/` 子路径下的资源 404；`dist/` 总包不能超过 140MB；用户运行时上传的图片/视频在 OSS，不计入 Toy 静态包。GitHub Pages 仅用于静态演示，不承载生产投稿和投票数据。

## 5. Toy 发布、预览和审核

使用官方 Toy CLI，先查看命令树：

    toy --help-json
    toy whoami --json

发布或更新前先做内容预检，确认 dist/index.html 和 dist/assets 同级、没有 /assets/... 这类根绝对路径，并确保自定义路径资源可加载。随后执行不带 --yes 的 toy create 或 toy update，得到 preview_url。

在浏览器检查预览后，再明确确认“提交审核”，最后使用完全相同参数加 --yes 提交。提交审核前不要重复创建新 Toy；更新时保留原 Toy 的 slug。

## 6. 活动运营

白名单账号打开 Toy 包内的 `ops.html`（自有静态服务器可使用 `/ops`）并验证身份后：

1. 设置当前阶段：投稿、盲选、投票或结束。
2. 设置三个阶段的起止时间（北京时间）。
3. 测试期间可开启“测试预览”，正式活动前关闭。
4. 审核投稿、查看作者/头像/媒体、设置盲选池、入围和公开展示。

正式模式下 API 会在服务端再次校验阶段，不依赖浏览器隐藏按钮。

## 7. 安全与备份清单

- PostgreSQL 全部使用参数化查询和事务；配额、一次性配对票据、每日票数由数据库约束/锁保证。
- API 校验请求大小、MIME、文件签名、阶段、身份、媒体归属和白名单；异常只返回稳定错误码。
- CORS 精确匹配，媒体响应带 nosniff；前端不执行 eval 或动态脚本。
- ECS 安全组删除公网 RDP/ICMP，只保留 80/443，SSH 在密钥配置后限源。
- 每日使用 pg_dump 备份 PostgreSQL，并把备份上传到独立私有 OSS 前缀；定期恢复演练。
- 使用 Nginx/Caddy 自动续期 HTTPS；监控 /healthz、磁盘、CPU、内存、数据库连接和 OSS 错误率。

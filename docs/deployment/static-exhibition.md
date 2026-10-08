# 2026-10-08 活动收尾与静态作品展

本期活动改为纯作品展示，结束投稿，不再开展盲选和公开投票。主办方在后台截图中确认仅展示以下两件真实投稿，测试作品不进入展览：

| 作品 | 作者 | 投稿 ID | 图片数量 |
| --- | --- | --- | --- |
| 弥汐辞 | 朴一文 | cf755c91-8e1e-47b5-ae33-a834843cbdb8 | 3 |
| 拉海洛全角色国风服装 | ai凌时工作室 | 17d73b60-6c28-4066-bbe9-da6a473ba162 | 9 |

## 数据与原图

`scripts/export-exhibition.mjs` 使用当前运营密码登录 HTTPS 后台，严格检查两件投稿的 ID、标题、作者、赛道和图片数量后导出。密码从 `OPS_PASSWORD` 环境变量读取，不能写入代码、产物或输出。

导出前设置 `EXHIBITION_BACKUP_DIR` 为仓库外的备份目录。当前备份位于 `E:\wuwa\archives\2026-10-08-exhibition`，包含全部 7 条投稿的运营 API 快照、阶段设置、两件选定投稿的 12 张原图、2 个作者头像及清单。快照移除了运营图片签名 URL，备份不提交 Git。

**该运营快照不是完整 PostgreSQL 备份**，不包含所有表和历史投票记录。关闭或释放 ECS 前仍须用 `pg_dump` 制作完整备份，并保存到服务器以外。不能将生成的 API 快照当作可恢复全部数据库的 SQL 备份。

公开清单在 `src/config/exhibition-manifest.json`，媒体在 `public/exhibition/`。每个原图与头像保存文件大小和 SHA-256，构建会逐一核验。`scripts/generate-exhibition-previews.py`（Pillow）生成轻量 WebP 展示图，原始媒体不压缩、不裁剪；点击展示图时查看本地原图。

## 构建与验证

```powershell
npm run exhibition:verify
npm run check:precompletion
npm run build:exhibition
```

`build:exhibition` 必须是本次上传前的最后一步，因为普通生产构建和 `build:toy` 仍生成互动活动页面并覆盖 `dist/`。展览构建只生成独立展览入口 `dist/index.html`，没有 `ops.html`、Toy 登录 SDK、后端地址、投稿或投票操作，作品清单和媒体路径全部在静态包内。GitHub Pages 工作流也使用该构建命令。

测试时阻断活动 API 域名和 OSS、断开服务端网络，确认两个作品、作者头像、12 张展示图与原图浏览、切换和关闭仍正常。图片使用 contain 完整显示。桌面与窄屏检查不得出现裁剪和横向溢出。

Toy 预检通过后，用官方 CLI 更新现有 Toy（ID `23972523703296`，slug `aicreatorwuwa`）并生成预览。保留原地址与可见性。预览验收、提交审核和正式版本确认完成前，服务器继续运行。

## 关闭服务的顺序

1. 制作完整 PostgreSQL 备份并下载到仓库外；确认选定作品的原图备份和哈希。
2. 将后端阶段设置为 `closed`、测试预览关闭，停止公开投稿和投票；不删除任何投稿或媒体。
3. 更新、测试、审核 Toy 静态展览包；确认正式页面已切到展览版，而非仅预览版。
4. 确认静态页面没有向 ECS/OSS 发起请求后，才可停止活动 API 或 ECS。
5. ECS 停机是否停止计费取决于实例计费类型，包年包月并不会因停止服务立即免除费用。需要取消续费或到期处理时，先保留数据库、磁盘和其他用途的信息。不能直接删除共享 OSS 桶，它还包含其他项目。

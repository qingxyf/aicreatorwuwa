# Bilibili Toy SDK 接入边界

已按 Toy JS SDK 能力清单 1.6.0（2026-08-12）核对：应用可加载 `https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js`，并通过 `window.toy.getUserProfile()` 获取 `nickname`、`avatar` 和可能存在的 `toyOpenId`。首次没有有效授权时，资料确认必须由用户手势触发；公开端投稿/投票和 `/ops` 运营验证都遵守这一点。

SDK 的 `toyOpenId` 是当前 Toy 内的稳定假名，不是登录令牌或服务端鉴权凭证。清单明确说明 SDK 不提供 UID、MID、登录令牌或确认挑战值，因此 Worker 不能仅凭浏览器上传的 `toyOpenId` 判定请求可信。个人云存储 API 只接受当前用户自己的字符串键值（每个 Toy 最多 128 个 key、每个 value 最多 1024 字节），排行榜只保留固定榜位的历史最高分；二者都不能替代跨用户投稿库、逐票投票记录或媒体存储。

因此：

- `ToyAccountClient` 是唯一调用 `window.toy` 的客户端适配器，将资料转换为核心 `Viewer`。
- D1 保存跨用户的投稿、候选、投票、入围和白名单记录；R2 保存用户上传的图片/视频字节与 MIME 信息。
- 写操作必须由部署时配置的身份核验适配器验证 Toy 平台签发的断言。若没有断言核验端点，Worker 必须拒绝生产写操作，不能信任浏览器提交的用户 ID。
- 配置字段与外部请求只能存在于 `src/adapters/*` 和 `wrangler.toml`；领域层不引用 Toy、D1、R2 或任何厂商 SDK。

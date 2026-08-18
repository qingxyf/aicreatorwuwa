# Bilibili Toy SDK 接入边界

已从公开 Toy SDK 示例核验：应用可加载 `https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js`，并通过 `window.toy.getUserProfile()` 获取 `nickname`、`avatar` 和可能存在的 `toyOpenId`。个人云存储 API 仅接受字符串键值；SDK 示例没有暴露用于跨用户投稿库或图片/视频上传的公开 Toy API。

因此：

- `ToyAccountClient` 是唯一调用 `window.toy` 的客户端适配器，将资料转换为核心 `Viewer`。
- D1 保存跨用户的投稿、候选、投票、入围和白名单记录；R2 保存用户上传的图片/视频字节与 MIME 信息。
- 写操作必须由部署时配置的身份核验适配器验证 Toy 平台签发的断言。若没有断言核验端点，Worker 必须拒绝生产写操作，不能信任浏览器提交的用户 ID。
- 配置字段与外部请求只能存在于 `src/adapters/*` 和 `wrangler.toml`；领域层不引用 Toy、D1、R2 或任何厂商 SDK。

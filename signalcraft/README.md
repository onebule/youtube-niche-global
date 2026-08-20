# SignalCraft

中文优先的 YouTube 内容情报与选题决策 MVP。它通过后端的 YouTube Data API 获取公开样本，支持“公开发现 → 榜单筛选 → 证据判断 → 收藏/对标/监听 → 选题 → 复盘”的工作流。

## 运行方式

1. 安装 Node.js 22+ 与依赖：`pnpm install`。
2. 复制 `.env.example` 为 `.env.local`，填写部署好的后端地址；如需 Google 登录，再填写 Supabase 项目地址。
3. `pnpm dev` 后访问本地地址。
4. `pnpm build` 构建，`pnpm test` 运行评分与筛选状态测试。

## 上线配置

前端可部署到 Vercel，环境变量如下：

| 变量 | 是否必填 | 用途 |
| --- | --- | --- |
| `NEXT_PUBLIC_YOUTUBE_SIGNALS_URL` | 是 | 后端 `youtube-signals` API 的完整地址 |
| `NEXT_PUBLIC_SUPABASE_URL` | Google 登录时必填 | Supabase 项目 URL，不能填 service-role key |

后端仓库需要先部署，并配置 `YOUTUBE_API_KEY`、`APP_ORIGIN`、`QUOTA_SALT`。如启用登录额度，再配置 Supabase 的 URL、anon key 与 service-role key。完整清单见后端的 [`AUTH_AND_QUOTA_SETUP.md`](../../live-backend/AUTH_AND_QUOTA_SETUP.md)。

部署顺序：先发布后端，再将其生产 URL 写入前端环境变量，最后发布前端；随后在 Supabase 和 Google OAuth 中加入前端生产域名作为回调地址。

## 产品边界

- 收藏、对标、选题、任务、监听和通知目前存储在浏览器本地，不是多设备同步。
- 不使用抓取 YouTube 页面。未来真实数据仅通过 YouTube Data API、用户 OAuth 授权或符合政策的第三方数据源进入服务器端。
- Google 登录与每日查询额度可在配置 Supabase 后启用；支付、邮件、Slack、Webhook 和异步任务队列尚未接入。
- 机会评分是可复算的排序辅助，不是关于爆款或收入的事实结论。

## 路由

| 区域 | 路由 | 用途 |
|---|---|---|
| 公开 | `/` | 首页与今日情报摘要 |
| 公开 | `/discover` | 可分享筛选的发现页 |
| 公开 | `/rankings` | 视频表现排行榜 |
| 公开 | `/radar` | 按机会簇组织的雷达 |
| 公开 | `/methodology` | 评分、数据和隐私边界 |
| 公开 | `/pricing` | Free / Pro / Team 演示定价 |
| 工作室 | `/app` | 今日指挥台 |
| 工作室 | `/app/library/channels`、`/app/library/videos` | 频道/视频资产 |
| 工作室 | `/app/research` | 深度检索 |
| 工作室 | `/app/watchlists` | 监听与模拟触发 |
| 工作室 | `/app/benchmarks` | 对标组与 2–5 项比较 |
| 工作室 | `/app/ideas` | 选题看板 |
| 工作室 | `/app/prompts`、`/app/settings` | 提示词与配置 |

## 评分公式

`OpportunityScore = 0.30 × VelocityScore + 0.32 × OutlierScore + 0.18 × FreshnessScore + 0.12 × EngagementProxy + 0.08 × Confidence`

- `VelocityScore`：快照间每小时播放量的对数归一化。
- `OutlierScore`：播放/订阅与频道历史中位数偏离的组合。
- `FreshnessScore`：发布时长的明确衰减。
- `EngagementProxy`：点赞与评论的公开互动代理。
- `Confidence`：快照数量决定的数据完整度；采样不足时会降分。

详见 [架构与合规说明](docs/architecture.md) 与 [Postgres schema 草案](docs/schema.sql)。

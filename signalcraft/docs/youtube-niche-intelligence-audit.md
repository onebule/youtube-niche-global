# YouTube Niche Intelligence Platform
## Full Product & Architecture Audit（2026-09-01）

> 状态：审计交付，不是功能开发迭代。本报告依据当前 checkout、源码与自动化测试编写；本轮不重构大段业务代码，不改变 Shorts 行为。

## 0. 范围、证据与结论口径

### 审计范围

- 公共发现、排行榜、长视频赛道评估、长视频趋势雷达、Shorts 趋势雷达、频道诊断、监控/收藏、创作工作室、账号与定价。
- 数据摄取、指标/评分、证据与置信度、API 代理、账户隔离、路由/导航和 UI 可访问性。
- 重点检查“存量 Shorts 稳定产品”和“新增 Long-form 发现引擎”是否保持业务隔离。

### 当前证据

- 类型检查通过：`tsc --noEmit`。
- 自动化测试通过：68 passed、0 failed（`tests/*.test.mjs`）。
- ESLint 未通过：2 个 `react-hooks/set-state-in-effect` 错误，23 个警告（主要是 `<img>`、未使用变量/参数）。
- 当前生产相关代码位于 `e0db90b` 之后；长视频与 Shorts 已使用独立 API 代理和机会配置，但本仓库看不到上游公式、数据库迁移和定时采集实现。
- README 声明为 MVP，持久化以浏览器本地为主；仓库没有 `docs/architecture.md` 或 `docs/schema.sql`，而文档仍引用它们。

### 不能从当前公开数据推断的内容

CTR、留存、真实 RPM/收入、字幕/音频质量、创作者成本等私有指标不能被公开 YouTube 元数据证明。所有这些字段必须保持 `unknown`/需要授权，而不是用估算值伪装成事实。

## A. Executive Audit（不超过 15 个关键发现）

| # | 优先级 | 发现 | 证据 | 结论 |
|---|---|---|---|---|
| 1 | P0 | 通用 `OpportunityScore` 可能把热度当机会 | `src/lib/scoring.mjs:3-15`；`src/lib/youtube.ts:92-105` | 必须分离“表现/热度”和“进入机会”，禁止单条视频回填频道基线后继续给出高精度机会分。 |
| 2 | P0 | 长视频与雷达核心公式在外部 upstream | `src/app/api/*opportunity*/route.ts`；`src/lib/longform-response.ts:62-109` | 前端无法验证算法版本、输入快照和证据链；需要版本化后端契约及审计字段。 |
| 3 | P0 | 不完整视频被直接丢弃 | `src/lib/youtube.ts:83` | 缺少频道、订阅数或标题不应令视频消失，应保留行并显示字段未知/待补全。 |
| 4 | P0 | 指标实现分散 | `scoring.mjs`、`channel-diagnostic-engine.ts`、`rpm-benchmarks.ts`、`longform-intelligence.ts` | 没有唯一 metrics contract，跨页面口径容易漂移。 |
| 5 | P0 | 置信度门槛不一致 | `scoring.mjs` 的 42/64/82；雷达与诊断各自有门槛 | 统一 HIGH/MEDIUM/LOW/INSUFFICIENT，并把门槛与样本、时间跨度、完整性绑定。 |
| 6 | P1 | 环境配置与实现漂移 | `.env.example`/README 宣称可配置；`src/lib/youtube.ts:54` 硬编码 endpoint | 生产切换、回滚和多环境验证不可靠。 |
| 7 | P1 | Rankings、Discover、Radar 的工作定义重叠 | `signalcraft-app.tsx` 路由与 `longform-research-desk.tsx:62-71` | 明确“赢了什么 / 值得进入什么 / 最近变了什么”，而不是继续增加相似标签。 |
| 8 | P1 | 旧 Radar 分支已不可达但仍维护 | `signalcraft-app.tsx:308-309` 与路由 `576-583` | 删除前先验证深链；否则标记 deprecated，避免两套雷达继续分叉。 |
| 9 | P1 | Shorts/Long-form 仍共享业务类型 | `src/lib/types.ts:1-22` | 可共享 transport，但应有独立 domain model、评分与查询服务；不能让长视频算法自动作用于 Shorts。 |
| 10 | P1 | 长视频缺少可复核的 creator baseline/breakout 层 | `longform-intelligence.ts`；`youtube.ts:92-105` | 单条公开样本不能替代频道历史；需要预期值、重复爆发和创作者集中度。 |
| 11 | P1 | 账户数据主要是本地存储 | `src/lib/account-storage.ts:6-34`；`signalcraft-app.tsx:413` | 账号哈希只解决浏览器作用域，不等于跨设备、团队或定时监控隔离。 |
| 12 | P1 | API 代理缺少统一契约/可观测性 | `src/app/api/youtube-signals/route.ts` 等 | 失败只能显示通用错误，缺少 request id、schema version、capture id 和上游延迟。 |
| 13 | P2 | 导航和可访问性存在语义问题 | `signalcraft-app.tsx:133-143,194-196`；ESLint 输出 | 路由用 button/role=link div，图标与链接语义不完整；影响深链、中键、键盘和自动化。 |
| 14 | P2 | 页面状态 URL 同步不完整 | `signalcraft-app.tsx:145-156` 仅部分 filter 使用 `replaceState` | Radar 视角、窗口、市场、研究 desk tab 刷新后不稳定，分享链接不能复现视图。 |
| 15 | P2 | 智能层与创作层未形成闭环 | `video-canvas-studio.tsx` 约 3471 行；`viral-case-corpus.ts` 约 1332 行 | 先稳定证据/策略对象，再把 idea、脚本、canvas 通过显式引用连接；不要用 AI 文案掩盖数据不确定性。 |

## B. Feature Inventory

| 功能 | 当前定位 | 动作 | 优先级 | 主要问题/验收 |
|---|---|---|---|---|
| 首页信号入口 | 产品说明与入口 | IMPROVE | P2 | 文案从“评分维度”改为可解释数据来源；避免硬编码 `4`。 |
| 公共发现 Discover | 公共候选浏览 | REDEFINE + IMPROVE | P1 | 输出候选与证据，不冒充进入机会；保留缺失字段。 |
| 排行榜 Rankings | 已经赢了的公开结果 | KEEP + IMPROVE | P0 | 只回答“谁赢了”；快照、时间窗和排序口径可复现。 |
| 长视频赛道评估 | 长视频持久进入判断 | KEEP + IMPROVE | P0 | 市场机会、执行适配、进入结论分栏展示；无数据时不得升级结论。 |
| 长视频趋势雷达 | Long-form 最近变化 | KEEP + IMPROVE | P1 | Why now、生命周期、证据抽屉、进入窗口独立于评估分。 |
| Shorts 趋势雷达 | 存量 Shorts 雷达 | KEEP | P0 | 业务逻辑、排序、缓存、历史和 UI 冻结；只可复用底层 transport。 |
| Shorts 赛道评估 | 存量 Shorts 评估 | KEEP + IMPROVE | P1 | 只做兼容性和证据可读性，不迁移 Long-form 评分。 |
| 双形态信号总览 | 扫描入口 | MOVE / MERGE | P1 | 作为跨形态扫描器，不再与任一形态排行榜混用。 |
| 频道诊断 | 频道健康/问题定位 | KEEP + IMPROVE | P0 | 使用窗口、MAD、命中率和集中度；私有指标明确授权边界。 |
| 爆款拆解/简单创作者 | 视频与创作者透镜 | REDEFINE | P1 | 作为 evidence lens，不产生第二套机会分。 |
| 深度检索 | 主动研究 | KEEP + IMPROVE | P1 | URL/查询参数持久化，显示来源与采集时间。 |
| 收藏/监控 | 后续跟踪 | IMPROVE | P1 | 从本地收藏升级为服务端 snapshot + cron；失败可重试。 |
| 视频/频道资料库 | 资产管理 | KEEP + IMPROVE | P1 | 与诊断分开；支持不完整元数据。 |
| 基准/对标 | 比较与参考 | KEEP + IMPROVE | P2 | 显示数据来源、捕获月份与低置信度，不把 RPM 变成承诺。 |
| Viral Case / Patterns | 研究案例 | KEEP + IMPROVE | P2 | 案例产生可复用 pattern 对象，避免重复推荐。 |
| Ideas/验证看板 | 执行准备 | KEEP + IMPROVE | P2 | 从评估结果带入 evidence id、假设、验证指标。 |
| Image-to-video / Canvas | 创作工具 | KEEP | P3 | 暂不扩大智能范围；后续通过策略对象显式接入。 |
| Model Router | 生成模型选择 | KEEP + IMPROVE | P3 | 保持 provider 不可用即不可用，不模拟调用。 |
| Owner Console | 运营与权限 | KEEP + IMPROVE | P1 | 与 pricing entitlement 同一契约，审计账号作用域。 |
| Pricing / Access | 计费与权限 | KEEP + IMPROVE | P1 | 权限矩阵与导航入口一致；过期/未授权状态可解释。 |
| Login/Auth | 登录与账号 | KEEP + IMPROVE | P1 | Google 与邮箱账号共存，数据 scope 严格按 user id。 |
| Footer/Legal | 合规 | KEEP | P2 | 保留语义链接与当前版权文本。 |
| 旧单视频 Radar 分支 | 历史实现 | DEPRECATE / DELETE | P1 | 先查深链和指标依赖，再移除死代码。 |
| Mock/空 registry | 开发边界 | KEEP + IMPROVE DOCS | P1 | 只能表示空态，禁止作为线上 demo fallback。 |

## C. Feature Overlap Map

| 重叠组 | 现状 | 建议边界 |
|---|---|---|
| Rankings ↔ Discover | 都展示公开视频与表现字段 | Rankings=结果快照；Discover=候选集合与证据。 |
| Discover ↔ 旧 Radar | 都有 velocity/breakout 过滤 | 删除旧分支；Discover 不输出“现在进入”结论。 |
| Long-form 评估 ↔ Long-form Radar | 都使用 opportunity 语言 | 评估=可持续进入；Radar=最近变化，二者通过 evidence id 跳转。 |
| Radar ↔ All-radar | 都是扫描聚合 | All-radar 只做跨形态入口，不复制卡片详情与分数。 |
| Videos ↔ Breakout ↔ Small Creator | 复用相同视频、频道、分数 | 统一候选实体，使用不同 lens；不能各自重算。 |
| Viral Case ↔ Patterns ↔ Create | 案例、模式、创作建议分散 | Case → Pattern → Idea → Canvas，保留来源链。 |
| Channels ↔ Doctor | 都显示频道信息 | Library 管资产；Doctor 管诊断与下一步。 |

## D. User Journey Map

### 当前路径

进入导航 → Discover/Rankings/Radar 之一 → 查看卡片 → 本地收藏 → 可选频道诊断/看板/Canvas。常见断点是：评分含义相近、证据不足、刷新丢视图、本地数据无法跨设备、上游错误无法定位。

### 目标路径

1. **扫描**：Discover 或 All-radar 发现候选/变化，URL 保留市场、窗口、形态和筛选。
2. **验证**：打开证据抽屉，查看样本数、频道数、日期跨度、完整性、来源快照和 FACT/INFERENCE。
3. **决策**：进入 Long-form 评估（可持续进入）或保持 CAUTION/TEST；Shorts 继续进入隔离的 Shorts 评估。
4. **执行**：生成带 evidence id 的验证计划/Idea，再进入 Canvas；明确成本、产能、假设与成功指标。
5. **复盘**：监控任务写入新 snapshot，比较实际与预期，重新进入验证而不是静默改写历史。

### 三个页面的一句话任务

- Rankings：哪些公开视频已经赢了？
- Discover：哪些候选值得我进一步研究？
- Radar：最近发生了什么变化，为什么是现在？

## E. Scoring / Algorithm Audit

| 算法/指标 | 当前实现 | 风险 | 必须补强 |
|---|---|---|---|
| Generic OpportunityScore | `scoring.mjs:3-15`，velocity/outlier/freshness/engagement/confidence 加权 | 无类别基准；单条样本可作频道 baseline；分数易被热度驱动 | 拆为 Performance、Evidence、Entry Decision；需要历史同频道基线和版本号。 |
| Long-form marketOpportunity / executionFit / entryScore | upstream 返回，前端仅在 `longform-response.ts` 归一化 | 公式、输入、阈值不可审计 | 后端返回 `algorithmVersion`、`inputSnapshotId`、`metricDefinitions`、`decisionReasons`。 |
| Radar whyNowScore | upstream 返回；本地只做决策门控 | 变化分与进入分可能被误读为同一分数 | 命名区分 `changeScore` 与 `entryDecision`，显示生命周期和时间窗。 |
| Channel diagnosis | `channel-diagnostic-engine.ts:110-177,201-230,304-329`；中位数、分位数、MAD、窗口比较 | 分类/格式置信度不足时仍可能形成强结论 | 输出样本/窗口/置信度；低样本只允许问题提示，不给确定性建议。 |
| RPM benchmark | `rpm-benchmarks.ts:46-181`；公开来源区间 | 不是频道真实 RPM；捕获月份固定 | 显示 source/capturedAt/range/confidence；收入只做 scenario，不进入机会分。 |
| Validation plan | `longform-validation.ts:12-17` | 计划与评分可能混淆 | 保持为 action gate，记录要补采的 3/5 条视频和指标。 |

### 统一决策状态建议

`INSUFFICIENT`（不能判断） → `CAUTION`（有信号但证据不足） → `TEST`（可小规模验证） → `RECOMMENDED`（样本、频道、窗口和突破证据均达标）→ `AVOID`（拥挤/衰退）。状态必须携带规则版本和触发原因；不允许只显示一个无解释的 0–100 分数。

## F. Data Quality Audit

### 已有优点

- Radar/Long-form 响应有 `dataScope`、`availabilityAudit`、facts/inferences/evidence、代表视频与快照字段。
- `growth.ts` 要求同一视频至少间隔 12 小时的可比采集，避免向下伪造增长。
- 频道诊断使用 recent/previous 窗口和 MAD，优于仅看总播放量。
- `mock.ts` 明确空 registry，不主动注入演示数据。

### 主要缺口

- `youtube.ts:83` 以 channelId/title/url/subscribers >0 过滤，缺字段行被删除而不是标为 unknown。
- 单个公开样本可生成“单条视频基线”（`youtube.ts:92-105`），会制造虚假的 baseline 精度。
- 前端没有统一的 snapshot schema、缺失字段枚举、来源版本、请求 id 和保留策略。
- 账号数据按 localStorage scope 隔离，但不能代表服务端历史、跨设备或团队隔离。

### Canonical DataQuality 建议

每个集合返回：`sampleVideos`、`sampleChannels`、`capturedAt`、`dateSpan`、`freshness`、`completeness`、`missingFields`、`outlierDependence`、`creatorConcentration`、`classificationConfidence`、`source`、`schemaVersion`。下游只消费状态，不自行猜测：`HIGH / MEDIUM / LOW / INSUFFICIENT`。

## G. Architecture Audit

### 现有优点

- Next catch-all route 集中处理 public/private 页面，API 代理隔离 upstream。
- Long-form 与 Shorts 使用不同机会接口和 config；这是必须保留的边界。
- `account-storage.ts` 使用 user id/email 哈希形成浏览器作用域。
- `opportunity-presentation.ts` 已集中 evidence/lifecycle/crowding/low-data 门控。

### 风险

- upstream 承载关键业务公式，本仓库没有可回放的 contract fixture。
- `types.ts` 共用 `Video/Opportunity`，增加字段容易无意改变 Shorts 查询。
- `signalcraft-app.tsx` 约 668 行，`video-canvas-studio.tsx` 约 3471 行，形成高耦合变更面。
- 所有 CSS 模块在 `layout.tsx:25-64` 全局导入，可能增加包体与级联冲突。
- `.env.example` 与硬编码 endpoint 漂移；缺少 schema migration/cron/observability 实现。

### 目标分层

`contracts(versioned) → ingestion(shared) → metrics(separate domain) → signals(longform/shorts) → decisions(separate) → evidence → storage/snapshots → presentation`。

共享层仅包括 YouTube client、channel/video metadata、任务队列、缓存、日志、数据库连接和通用 UI；Long-form/Shorts 的分类、评分、历史口径和 API 查询保持独立。

## H. UI / Navigation Audit

- `signalcraft-app.tsx:133-143` 用 button 承担站内导航；应使用 Next `<Link>` 或真实 `<a>`，支持中键、复制链接、预取和无障碍。
- `signalcraft-app.tsx:194-196` 用 `div role="link"` 包缩略图；应改为语义链接，并提供可见 focus。
- `signalcraft-app.tsx:145-156` 只同步部分 Discover filter；Radar view/window/market/lane 和 research desk tab 需要统一 query state。
- `longform-research-desk.tsx:62-71` 把长视频评估、长视频雷达、Shorts 雷达和双形态总览放在同一组 tab，容易让“评估”和“最近变化”混淆；建议保留扫描入口，但在页面标题和 CTA 上明确 job-to-be-done。
- 发现、排行榜、雷达、频道诊断、工作室和系统侧栏叠加后认知负荷偏高；先减少重复入口，再增加筛选。
- `<img>` 警告覆盖多个页面；使用 `next/image` 或为可信外部缩略图建立带尺寸/协议/MIME/超时校验的代理例外。
- 需要统一 icon button 的 `aria-label`、表单 label、焦点样式、长标题截断、`Intl.*` 格式化、异步状态 `aria-live`，并保留 `prefers-reduced-motion`。
- 长列表在数量增加后使用 `content-visibility`/虚拟化；不要在无限增长时无界 `.map()`。

## I. Technical Debt / Risk Register

| 风险 | 影响 | 触发信号 | 处理 |
|---|---|---|---|
| upstream 公式不可回放 | 无法解释线上分数 | 用户反馈同一数据分数变化 | P0：契约、版本、snapshot fixture。 |
| 不完整行被丢弃 | 排行/发现偏差 | 低标题/低订阅频道缺失 | P0：保留未知字段并补采。 |
| localStorage 伪装持久化 | 监控和团队功能不可靠 | 换设备数据消失 | P1：服务端账户表、snapshot 表、权限审计。 |
| Shorts 逻辑泄漏 | 存量产品回归 | 排序/数量/历史改变 | P0：独立 query/service 与 Shorts regression suite。 |
| ESLint hooks 错误 | 渲染/状态竞态 | effect 链条继续增加 | P1：改为派生状态、事件或数据层更新。 |
| 死分支与超大文件 | 修改回归面扩大 | 同一功能出现两套入口 | P1：删除死分支，逐步拆 domain module。 |
| 文档/环境漂移 | 部署切换失败 | .env 与代码值不一致 | P1：单一配置入口和启动时校验。 |
| 公开数据过度推断 | 合规/信任损失 | UI 显示 CTR/RPM/留存确定值 | P0：unknown/授权标识和证据门控。 |

## J. Product Roadmap

### P0 — 正确性与信任（先做）

1. 建立 versioned data-quality/evidence contract 和可回放 fixture。
2. 保留缺失标题、标签、频道/订阅字段的视频，使用 unknown 状态；禁止单条视频生成频道基线。
3. 把 Performance、Evidence、Entry Decision 拆开，统一置信度与决策门控。
4. 固化 Rankings / Discover / Radar 三种任务定义和 URL 状态。
5. 为 upstream 增加 schemaVersion、algorithmVersion、snapshotId、requestId、capturedAt。
6. 修复 hooks lint 错误、导航语义和异步错误可读性；建立 Shorts regression：数量、列表、排序、筛选、历史、UI、API 结构。

### P1 — 可持续研究与运营

1. 建立 creator baseline、重复 breakout、生命周期、拥挤度和 entry window。
2. 服务端账户隔离、权限/定价 entitlement、历史 snapshots、监控 cron 和失败重试。
3. 删除旧 Radar 死分支；把 All-radar 限定为跨形态扫描器。
4. Discover/评估/雷达使用同一 evidence id 串联，避免重复采集和重复评分。
5. 完成 env 配置、README、架构文档和 schema 的一致性。

### P2 — 从信号到策略

1. Case → Pattern → Idea → Validation 的对象链。
2. 结合市场机会与执行适配生成可验证假设，不把建议当事实。
3. 频道诊断与赛道证据联动，输出“问题—证据—下一步”而非泛化健康分。

### P3 — 创作与智能工作流

1. Canvas 读取策略对象、证据和验证指标，形成可追踪的创作图谱。
2. AI 生产工具使用 capability-based model intent；provider 不可用时保持明确不可用。
3. 在证据层稳定后再做视觉动效、批量生成和跨设备协作。

## 结论与执行边界

本轮不建议继续堆叠新标签、相似榜单或新的总分。最先要做的是让用户能复核：数据来自哪次采集、样本是否完整、这个分数回答什么问题、为什么给出当前决策。

Shorts 是存量稳定产品，Long-form 是新增能力；共享基础设施可以复用，但业务逻辑必须隔离。任何共享代码修改都必须证明 Shorts 数量、排序、筛选、历史、API 和 UI 与修改前一致。


# LangGPT Master Prompt · Phase 0 audit

本次落地以 P0 为边界：先让 Radar / Research 的职责、Short-form / Long-form 的数据边界和 DATA_GAP 变得可见，再进入收益、AI 生产、个性化和测试闭环。所有结论均来自当前仓库代码与线上 API 合同，不补造演示数据。

## CURRENT_AUDIT

| Surface | Status | Evidence / boundary |
| --- | --- | --- |
| Rankings | AVAILABLE | 现有排行榜页面与筛选链路保留；本轮不改动。 |
| Long-form Opportunity Radar | AVAILABLE | `/api/opportunity-radar` 使用 `longform_video_features`，输出 Opportunity Event、历史对照、跨频道证据和置信度。 |
| Short-form Opportunity Radar | AVAILABLE | `/api/shortform-opportunity-radar` 使用独立 Shorts 引擎；不复用 Long-form 分数。 |
| Long-form Research | AVAILABLE | `/api/longform-opportunities` 输出单方向研究对象、市场机会、执行适配、进入分和代表视频。 |
| Evidence / provenance | AVAILABLE | Radar 与 Research 均显示样本、频道、采集时间和来源说明。 |
| Revenue / RPM | MISSING | 公开 YouTube Data API 不提供创作者私有 RPM、CPM、CTR、留存。 |
| AI production economics | DERIVABLE | 当前只有执行适配启发式；真实 provider 成本、成功率、返工率尚未接入。 |
| Target income planner | MISSING | 尚无用户目标收入、产能和回溯收益数据。 |
| User profile / Personal Fit | MISSING | 有账号身份隔离，但没有内容偏好、时间、预算等最小画像。 |
| Test / validation loop | MISSING | 有选题和监控资产，但尚无结构化测试指标与 VALIDATED 生命周期。 |

## SAME_STRUCTURE_PROBLEM

Radar 与 Research 已使用不同的子页面：Radar 是事件流和证据抽屉，Research 是单方向决策工作区；但两者共用一个上层研究桌，且缺少统一的“全部 / 短视频 / 长视频”内容范围入口。本轮增加显式范围切换，并在“全部”模式中保持两条独立 feed，不做跨类型原始播放量比较。

## SHORT_LONG_LOGIC_PROBLEM

当前服务端接口、字段和前端组件已分离，Shorts 既有排行榜/历史/评分链路不在本轮变更范围。新增的全部模式只并排读取两个已有接口，保留各自标签、窗口、信号与证据链。

## REVENUE_DATA_AUDIT

`UNKNOWN` / DATA_GAP：公开数据没有 RPM、CPM、CTR、留存或私有收益。页面不能把播放量换算成美元，也不能把高播放直接当作收益机会。

## AI_PRODUCTION_DATA_AUDIT

`DERIVABLE`：Research 的执行适配来自标题、类别和可复用线索；provider 价格、成功率、重试、人工时间仍为 `UNKNOWN`，不得显示假精确成本。

## TARGET_PLANNER_DATA_AUDIT

`MISSING`：没有目标收入、内容产能、长尾回溯收益或可靠 RPM 区间，暂不展示规划数字。

## USER_PROFILE_AUDIT

`MISSING`：账号只用于身份与本地数据隔离，尚未收集内容偏好、露脸偏好、每周时间、预算和 AI 熟练度；Personal Fit 暂不参与市场评分。

## TEST_VALIDATION_AUDIT

`MISSING`：当前可创建选题和监控规则，但没有结构化 3–5 条长视频 / 8–20 条 Shorts 的测试计划、成功阈值和验证状态。

## KEEP

- 排行榜、Shorts 存量采集/筛选/历史/评分和 API 链路。
- Long-form 独立候选池、Radar Opportunity Event、Research 单方向工作区。
- 真实数据、证据来源、样本量、跨频道确认和低置信度提示。

## MODIFY

- 研究桌顶部增加内容范围切换，明确全部、长视频、短视频三种读取边界。
- Radar feed 增加样本对照趋势和单频道/低样本 guardrail 的可见提示。
- Research 增加 Revenue、AI、目标规划、Personal Fit、Validation 的 DATA_GAP 说明。

## REMOVE

- 本轮不删除存量路由或指标；不移除任何 Shorts 数据。

## MERGE

- 仅复用 Evidence、Confidence、DATA_GAP 的展示语义；不合并 Short-form / Long-form 评分和权重。

## ADD

- `AllOpportunityRadar`：并排展示两个独立 Discovery Feed。
- `SignalSparkline`：只绘制真实的历史/当前样本对照，不制造时间序列。
- Research 的数据边界区块，提前说明目前不能回答的收益、生产经济性和个性化问题。

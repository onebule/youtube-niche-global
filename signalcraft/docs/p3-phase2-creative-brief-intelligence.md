# P3 Phase 2 — Idea Validation & Creative Brief Intelligence

本阶段只作用于 Long-form。它复用 P3.1 的 `IdeaCandidate`，不会改变 Opportunity、Pattern、Pattern Trend、Strategy、Experiment Validation、排行榜、Discover、Radar、Shorts 或 Canvas。

## 数据链路

`IdeaCandidate → Validation Context Snapshot → Strategy Alignment → Pattern Fidelity → P3.1 Originality → Production Feasibility → Idea Validation → CreativeBrief → Brief Readiness`

每条结果保留 Idea ID、来源 Case ID、Pattern ID、策略/机会/验证版本、采集时间、快照 ID 和算法版本。当前没有 embeddings、字幕、视觉理解、CTR、留存、RPM、收入或真实制作成本，均保持不可用或保守状态。

## 确定性状态

- Idea Validation：`VALIDATED`、`CONDITIONALLY_VALIDATED`、`NEEDS_REVISION`、`REJECTED`、`INSUFFICIENT`。
- Strategy Alignment：`ALIGNED`、`PARTIALLY_ALIGNED`、`MISALIGNED`、`INSUFFICIENT`。
- Pattern Fidelity：`STRONG_MATCH`、`ACCEPTABLE_MATCH`、`WEAK_MATCH`、`MISMATCH`、`INSUFFICIENT`。
- Production Feasibility：`FEASIBLE`、`FEASIBLE_WITH_RISK`、`UNKNOWN`、`BLOCKED`、`INSUFFICIENT`。
- Brief Readiness：`READY_FOR_CREATIVE_DEVELOPMENT`、`READY_WITH_CAUTION`、`NEEDS_REVISION`、`BLOCKED`、`INSUFFICIENT`。

`READY_FOR_CREATIVE_DEVELOPMENT` 只表示可以进入下一阶段的标题方向、Hook 目标、提纲开发，不表示可以发布，也不生成最终标题、准确 Hook、脚本、分镜或生成提示词。

## 关键门控

- `AVOID` 入口、`AVOID` 策略角色、重复 Idea、矛盾验证、Pattern 不匹配和已知制作阻塞不会产生可用 Brief。
- 缺少案例、Pattern、策略或可解释证据时返回 `INSUFFICIENT`，不会把缺失误判为拒绝。
- 同一 Pattern 允许复用；必须替换来源案例的主体、场景、问题、证据或应用语境，禁止表面复制。
- 新颖性直接复用 P3.1 词面相似度结果。没有真实 embedding 时记录 `SEMANTIC_SIMILARITY_UNAVAILABLE`，不创建伪造语义分数。
- 没有真实实验观察时记录 `VALIDATION_NOT_AVAILABLE`；强历史/公开证据仍可产生 `READY_WITH_CAUTION`。
- IP 仅表示基于可用元数据的 `LOW_KNOWN_RISK` 或 `POTENTIAL_DEPENDENCY`，不代表法律清权。

## CreativeBrief 字段

Brief 包含 audience problem、content promise、Pattern 关联的 core mechanism、与来源 Case 的结构化差异、mandatory constraints、flexible variables、production feasibility、originality、IP 风险、confidence、reasons、risks、blockers、readiness 和 provenance。自由文本只用于展示，不能替代可追溯字段。

## 校准与限制

`SOURCE_CASE_COPY_LIMIT`、`MAX_ALLOWED_DUPLICATE_SIMILARITY`、`MIN_PATTERN_FIDELITY`、`MIN_BRIEF_CONFIDENCE`、`MIN_SOURCE_CASE_DIVERSITY` 均集中在 `CREATIVE_BRIEF_CONFIG`，当前标记为 `CALIBRATION_REQUIRED`。Idea corpus 持久化和真实 embeddings 仍是后续增强项。

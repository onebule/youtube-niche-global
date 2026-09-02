# P3 Phase 1 — Case → Pattern → Idea Intelligence

## 状态

本阶段新增 `case-pattern-idea-v1`，范围限定为 Long-form。它消费现有 Opportunity、Content Pattern、Pattern Trend / Niche Fit、Content Strategy 与 P2 Phase 4 Validation 契约；不改 Rankings、Discover、Radar、Shorts 或 Canvas。

## 证据可用性审计

- **AVAILABLE**：niche/方向身份、稳定 Pattern ID、Pattern taxonomy/value、Pattern 频率/规范化表现/创作者广度/重复性、Trend、Niche-Pattern Fit、Strategy Role、代表视频的公开 ID/标题/频道/链接。
- **DERIVABLE**：`case:<videoId>` 身份、Case → Pattern sourceCaseIds、案例创作者广度、确定性词面相似度、Idea identity、兄弟候选去重与组合多样性。
- **PARTIAL**：主题 taxonomy、Validation（没有真实观察时仅保留未提供状态）、趋势历史窗口、来源案例质量。
- **REQUIRES_EMBEDDING**：语义 embedding 相似度；v1 不伪造 embedding。
- **REQUIRES_NEW_DATA**：真实 Idea corpus、持续采集的 Idea 结果与后续实验观察。
- **UNAVAILABLE**：描述、字幕/转录、Hook、缩略图理解、私有 CTR/留存/AVD/RPM/收入、生产成本与法律/IP 检测。

## 实际架构

```text
Representative public videos
        ↓ case:<videoId>
CaseEvidence (quality, creator, topic, patternIds)
        ↓ existing Pattern candidate linkage
Pattern ID + Trend + Niche Fit + Validation
        ↓ existing Content Strategy role
PRIMARY / TEST / WATCH / DEPRIORITIZE / AVOID / INSUFFICIENT
        ↓ deterministic structured transformation
IdeaConcept → Novelty / Fit / Confidence / Risks / Blockers
        ↓
Validation Readiness + complete provenance
```

Idea 是结构化概念和理由，不是完整标题、脚本、Hook、缩略图、分镜或 Canvas 提示词。

## 门控行为

- **PRIMARY**：在 `RECOMMENDED` 且 Pattern 为可用趋势/适配时生成主动候选。
- **TEST**：生成受控实验候选，默认 `READY_WITH_CAUTION`。
- **WATCH**：只进入研究候选，不与主动候选等权。
- **DEPRIORITIZE / AVOID / INSUFFICIENT**：不生成主动候选，保留阻断原因。
- **EntryDecision AVOID**：全部阻断；`INSUFFICIENT` / `CAUTION` 只保留研究或保守验证。
- **Trend**：ACCELERATING / GROWING 支持主动候选；STABLE 中性；DILUTING / DECLINING 降为研究；INSUFFICIENT 不做主动推荐。
- **Niche Fit**：TOP_FIT / STRONG_FIT 支持；MODERATE_FIT 只适合测试；WEAK_FIT / INSUFFICIENT 降级或阻断。
- **Validation**：VALIDATED 作为正向证据；CONTRADICTED 阻断；无观察时显示 `NOT_AVAILABLE`，不伪造反馈。

## 新颖性与多样性

v1 对来源案例使用标题/主题词面代理，维度包括 title/topic/entity/pattern/mechanism 与综合 surface similarity。Pattern 重叠本身不是复制；同一 Pattern 只要主体、问题与上下文确实改变，可以是 `NOVEL` 或 `ACCEPTABLE_VARIATION`。主题与表面结构都过近会变为 `TOO_SIMILAR`；兄弟候选达到重复阈值会变为 `DUPLICATE` 并被移出展示组合。候选最多展示 7 条，并按策略角色、置信度、趋势、赛道适配与稳定 ID 确定性排序。

所有相似度阈值均标记 `CALIBRATION_REQUIRED`，不是通用原创度分数。

## Idea 字段

`ideaId`、`state`、`nicheId`、`patternIds`、`sourceCaseIds`、`strategyRole`、`concept`（workingLabel/coreQuestion/subject/angle/contentMechanism/audiencePromise/patternReference/differentiation/rationale）、`novelty`、`fit`、`confidence`、`evidence`、`reasons`、`risks`、`blockers`、`validationReadiness`、`provenance`、`algorithmVersion`。

## 已知限制

当前代表视频契约可能只提供标题、频道和公开指标；没有私有 YouTube Studio 数据、字幕/Hook、embedding、IP 检测或自动背景实验采集。P2 Phase 4 的真实观察仍需未来公开快照或用户提供数据。P3 Phase 2（Idea 验证与 Creative Brief）未实现。

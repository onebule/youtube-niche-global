# P3 Phase 5 — Evidence-Grounded Script Writing

## 目标

P3.5 消费 P3.4 的 `ScriptDevelopmentPackage`，生成可编辑、可审计的 Long-form `ScriptDraft`。输出包含分段旁白、Claim Registry、Evidence Registry、Promise Delivery、pacing、原创性状态、QA、readiness 和 provenance。

旁白是受结构与证据约束的草稿，不是最终录音稿。所有事实主张都必须能回到公开案例/元数据或明确的研究要求；未知内容不会被改写成事实。

## 边界

- 只运行 `script-writing-v1` Long-form 层，不重算 P3.1–P3.4、P2 或机会引擎。
- 不生成 storyboard、shot plan、镜头参数、图片/视频提示词、缩略图、音频或 Canvas 节点。
- 不伪造 CTR、Retention、AVD、RPM、Revenue、转录、embeddings 或验证观察。
- Shorts、排行榜、Discover、Radar、Opportunity、Pattern、Strategy、Validation 与 Canvas 保持原行为。

## 核心数据

- `ScriptDraft`：opening、sections、closing、narration、keyPoints、transition、tension/payoff、pacing、visual requirements。
- `ScriptClaim`：claim type、support status、evidence IDs、confidence、section ID。
- `ScriptEvidenceReference`：来源类型、可用性、来源引用与缺口说明。
- `ScriptQaAssessment`：supported / research-required / unsupported / unknown claim counts、重复段落、Pattern fidelity 与 evidence coverage。
- `ScriptReadiness`：`READY_FOR_STORYBOARD`、`READY_WITH_CAUTION`、`NEEDS_REVISION`、`BLOCKED`、`INSUFFICIENT`。

## 确定性保护

结构、主张分类、证据链接、Promise、pacing、readiness、confidence、风险和 provenance 在相同输入下可重放。若未来接入 LLM 只允许生成自然表达；LLM 不得决定事实、证据、置信度、Pattern、阻塞或 readiness。

## UI

Long-form 机会卡片新增紧凑的 `P3 PHASE 5 · SCRIPT WRITING` 面板，展示草稿状态、Promise、主张支持/研究/不支持数量、估算时长、开场旁白与段落证据状态。面板不展示“最终脚本”措辞，不提供编辑器或 Canvas 操作。

## 验证

`tests/script-writing.test.mjs` 覆盖 ready 草稿、Unsupported Claim、Research Required、Promise 失败、重复段落、确定性重放、来源转录/embeddings 缺口与 Shorts/Canvas 隔离。

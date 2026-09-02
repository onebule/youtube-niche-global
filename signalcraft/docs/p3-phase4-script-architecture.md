# P3 Phase 4 — Script Architecture & Scene Planning

## 目标

P3.4 把 Long-form 的 `CreativeDevelopmentPackage` 转换为可交给未来脚本写作阶段的结构包：脚本结构、段落责任、叙事节拍、证据位置、张力/回收、Promise 交付、语义场景需求和视觉需求。

它不是脚本生成器，也不是分镜或 Canvas 编排器。系统不会在本阶段生成最终标题、Exact Hook、逐句旁白、主持人口播、CTA 文案、镜头参数、图片/视频提示词或 Canvas 节点。

## 边界与门控

- 只消费 P3.3 `CreativeDevelopmentPackage`，不重算 P3.1–P3.3。
- 仅在 `LONG_FORM` 范围运行；Shorts、排行榜、Discover、Radar、Opportunity、Pattern、Validation 与 Canvas 不变。
- `READY_FOR_SCRIPT_DEVELOPMENT` 才能进入 `READY_FOR_SCRIPT_WRITING`；谨慎、需修改、阻塞和证据不足会被保留为对应状态。
- Promise 覆盖失败、Pattern 不匹配、上游阻塞、入口/策略为 AVOID 或已知制作阻塞，禁止 READY。
- 没有转录、稳健视觉理解、embeddings 或真实验证反馈时，状态写入证据缺口，不用推测填充。

## 输出

`src/lib/script-development.ts` 提供确定性 `buildScriptDevelopmentIntelligence` 和 `normalizeScriptDevelopmentIntelligenceReport`。每个包包含：

- `scriptArchitecture`：结构类型、段落顺序、开场/结尾责任、Pattern fidelity、Promise coverage、来源顺序原创性门控。
- `sections`：每段的 objective、responsibility、`NarrationBeat`（仅语义指令，`isFinalProse: false`）、证据、张力、Payoff、Promise 交付、场景和视觉需求。
- `evidencePlan`：`AVAILABLE / DERIVABLE / PARTIAL / REQUIRES_TRANSCRIPT / REQUIRES_VISION / REQUIRES_NEW_DATA / UNAVAILABLE` 等状态。
- `pacingPlan`：相对权重和 SHORT/MEDIUM/LONG 语义提示；不输出精确时码，所有权重标记 `CALIBRATION_REQUIRED`。
- `provenance`：Creative Development、Brief、Idea、Pattern、Strategy、Opportunity、source Cases、验证反馈、标题方向、Hook 结构、Outline 与算法版本。

## UI

Long-form 研究卡片新增紧凑的“P3 PHASE 4 · SCRIPT ARCHITECTURE”面板，只展示可写架构数量、结构段、证据待补、Promise 交付和语义场景需求；展开后查看段落职责与证据状态，不展示完整脚本。

## 验证

`tests/script-development.test.mjs` 覆盖 Explainer、Comparison、Promise 失败、转录/视觉缺口、确定性重放、来源顺序复核与 Shorts/Canvas 隔离。完整仓库测试仍包含原有 Shorts 回归套件。

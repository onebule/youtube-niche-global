# P4 Phase 3 — Model-independent visual generation specification

## 目标与边界

P4.3 把 P4.1 Storyboard 的镜头要求和 P4.2 Visual Asset Intelligence 的资产、参考、连续性与证据审计，编译为可供未来 provider adapter 消费的结构化视觉生成规格。它只描述“需要生成/拍摄/渲染什么”，不会生成供应商提示词、调用模型、创建任务、写入 Canvas，也不改变 Shorts、排行榜、Discover、Radar 或既有 Canvas 逻辑。

## 规范结构

每个 Long-form shot 产生一个 `VisualGenerationSpecification`，并包含：

- `generationRoute` 与 `inputState`：区分复用、用户拍摄、真实证据、截图/图表/图形渲染、文生图、参考图编辑、图生视频、文生视频、多阶段、研究/版权/用户输入前置，以及人工或阻塞路径。
- `startState`、`stateDelta`/`desiredChange`、`endState`：把主体、环境、道具状态、动作、构图和证据内容拆开；存在状态变化时显式要求 END。
- `preserveUnchanged`、`continuityLocks`、`negativeConstraints`：将身份、服装、环境、道具、风格、构图等硬/软锁转换成可验证约束，并禁止身份漂移、风格漂移、虚构证据和错误文字。
- `referenceDependencies`：记录参考包、参考 ID、角色和是否必需；缺少身份/环境参考时输出 `NEEDS_REFERENCE`，AI 可生成道具不会被错误升级为必须补参考。
- `composition`、`camera`、`motion`、`duration`、`aspectRatio`：保留原始来源并标记 `USER_INPUT_REQUIRED` 或 `CALIBRATION_REQUIRED`，不猜测供应商限制。
- `complexity` 与 `units`：按顺序动作、独立角色、物体状态变化和环境变化判断复杂度；复杂镜头拆成多个 Generation Unit，使用中间状态和依赖链连接。
- `evidenceSemantics`：旁白为 `NON_GENERATIVE`；截图、归档、真实数据图表为真实来源/真实数据渲染边界；禁止用合成画面替代事实证据。
- `readiness`、`confidence`、`reasons`、`risks`、`blockers`、`dataAvailability`、`provenance`：让“可适配模型”与“仍需资产/参考/研究/版权/人工输入”明确分离。

## 数据与可信度

规格沿用 `AssetDataAuditState`，包括 `AVAILABLE`、`DERIVABLE`、`PARTIAL`、`REQUIRES_ASSET`、`REQUIRES_REFERENCE`、`REQUIRES_RESEARCH`、`REQUIRES_RIGHTS_REVIEW`、`REQUIRES_USER_INPUT`、`REQUIRES_VISION`、`UNAVAILABLE` 等状态。所有推导保留 Storyboard、资产包、快照、证据 ID 和算法版本；视觉 embedding、模型能力和生成结果在本阶段保持 `UNAVAILABLE`。复杂度与时长仅作为校准字段，绝不伪造 0–100 生成分数。

## Provider adapter 边界

`VisualGenerationProviderAdapterBoundary` 只声明未来适配器需要的能力契约（路线、START/END、参考数量、音频、时长、画幅）和序列化入口，类型上禁止 `execute`。因此 MiniMax、Seedance、Kling、Veo 等 provider 不会进入 canonical 语义，也不会在 P4.3 触发 API 调用。Provider routing 与字段序列化留到 P4 Phase 4。

## Long-form 接入与展示

`buildLongformOpportunityResponse` 在 Storyboard 和 Visual Asset Intelligence 之后生成报告；Long-form 页面以紧凑面板展示规格数量、多阶段数量、所需参考、非生成路线、首批镜头的路线/就绪度/START-CHANGE-END/锁数量，不渲染巨型 JSON。Shorts 与 Canvas 继续使用原有业务链路。

## 验证

专项测试覆盖空 Storyboard、结构完整性、身份参考缺失/已提供、图像编辑、图生视频、复杂多阶段、中间状态、截图/图表/归档证据、文字保真、版权/研究前置、旁白、阻塞、确定性、provider 独立性及 Shorts/Canvas 边界。完整回归套件、类型检查、Lint 和生产构建作为提交前门禁。

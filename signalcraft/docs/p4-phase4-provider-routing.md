# P4 Phase 4 — Provider Adapter & Model Routing Intelligence

## 边界

本阶段消费 P4.3 `VisualGenerationSpecification`，建立 Provider / Model Registry、能力审计、兼容性判断、路由决策与 provider request 边界。它不会提交图片/视频任务、轮询、扣费或创建 Canvas 节点；Shorts、排行榜、Discover、Radar、Opportunity、P0–P3 和既有 Canvas 生成链路保持原样。

## Provider 审计结论

仓库现有 `/api/video/[...path]` 代理、旧 Canvas `video-model-router`、MiniMax H3 / Seedance / Kling / Veo 的旧模型标识，以及独立的 `gpt-image-2` 客户端入口。旧 Canvas 注册包含产品历史路由字段，但本阶段没有发现可验证的 MiniMax 或 Seedance 官方请求 schema、服务端能力清单、价格、质量或速度遥测。因此 P4.4 新 Registry 仅登记 MiniMax H3、Seedance 2.0、Seedance 2.5 为 `UNVERIFIED` / `UNKNOWN`，不把旧 Canvas 分数复制为 Long-form 事实。

## Registry 与能力状态

`ProviderRoutingRegistry` 集中保存 providerId、displayName、generationDomains、availability、verification、modelIds、adapterId、configurationVersion；`ModelDefinition` 保存稳定 modelId、providerId、availability、verification、能力列表、适配器版本、配置版本和 price/quality/speed telemetry 状态。每项能力包含 support、verification、source、limits、verifiedAt 和 capabilityVersion。

未知能力不会被当作支持：硬要求 + UNKNOWN 输出 `UNVERIFIED`，软要求 + UNKNOWN 输出可解释的降级风险。当前 MiniMax / Seedance 能力均保持 `UNKNOWN`，不会自动推荐。

## Requirements → Compatibility → Routing

`extractProviderRequirements` 从 P4.3 规格提取路线、参考数量/角色、START、END、身份锁、风格锁、文字保真、时长和画幅要求。真实证据、截图、图表、人工拍摄、旁白和阻塞路线直接标记为非 provider 路线。

`ModelCompatibility` 保留 supported、degraded、unsupported、unknown requirements、状态、置信度、原因、风险和阻塞。AUTO 只从可用且硬要求兼容的模型中选择；没有安全候选时保持空推荐。USER_SELECTED 会保留用户选择；硬不兼容返回 `OVERRIDE_INCOMPATIBLE`，不改写原始规格。Fallback 逐项记录候选状态和模型/路线变化，硬要求丢失时拒绝 fallback。

多阶段镜头按 Generation Unit 独立决策，保留 unit lineage。允许未来混用 provider，但身份敏感场景必须留下 `IDENTITY_DRIFT_RISK`，当前没有自动执行混用。

## Adapter 与 Request

`GenerationProviderAdapter` 只有三个边界方法：`validateCompatibility`、`serializeUnit`、`validateSerializedRequest`。MiniMax 和 Seedance 当前为 boundary-only adapter；序列化产物包含内部语义 prompt、START/CHANGE/END、参考依赖、连续性锁、负向约束和完整 provenance，但不代表已验证的第三方 API payload，也不执行请求。

`ProviderGenerationRequest` 保留 provider/model、operation、payload、inputAssets、referenceAssets、expectedOutput，以及 specification/unit/decision/adapter/serialization 版本。`SerializationValidation` 输出 `NO_LOSS`、`SOFT_LOSS`、`HARD_LOSS` 或 `UNKNOWN`；硬丢失会阻塞 ready，软丢失会保留风险。

## 数据可信度与安全

价格、质量、速度均没有真实遥测，统一为 `UNKNOWN`，不宣称最便宜、最佳或最快。请求对象不包含 API key、token、Authorization 或凭据；现有 provider secret 仍由既有服务端边界管理。本阶段不新增执行端点、不新增 polling、不新增队列、不触发 provider credits。

## Long-form 展示

机会卡片下新增紧凑 `P4 PHASE 4 · MODEL ROUTING` 面板，显示镜头路由、推荐模型、兼容性、置信度、替代模型、手动选择状态与阻塞原因。未验证能力会明确显示，不渲染巨型能力矩阵，不影响 Shorts 或 Canvas UI。

## 校准与验证

Provider 能力、限制、降级容忍度、混合 provider 连续性和 fallback 偏好均标记 `CALIBRATION_REQUIRED`。专项 fixture 覆盖文本生图、参考/END、身份硬锁、风格软降级、图生视频、参考编辑、非生成证据、手动拍摄、MiniMax/Seedance override、AUTO、未知/未配置 provider、fallback、多阶段路由、序列化硬/软丢失、价格/质量/速度未知、确定性和 secret 边界。完整回归包含 P4.1–P4.3、P3、P2、P1、P0、Shorts 和 Canvas 隔离。

# P0 Phase 1 — Evidence & Data Quality Foundation

日期：2026-09-01  
基线：`docs/youtube-niche-intelligence-audit.md`  
范围：最小兼容实现；不改 UI、Canvas 或 Shorts 评分规则。

## 1. 审计基线

已阅读并使用 `youtube-niche-intelligence-audit.md`。本次只处理 P0 正确性与信任问题：证据契约、数据质量、缺失数据语义、单视频伪基线和回归保护。

## 2. 根因与证据分级

### FACT

- `src/lib/youtube.ts` 原先要求 `channelId`、`channelTitle`、`channelUrl` 且 `subscribers > 0`，导致不完整但有视频身份的行在客户端转换前被过滤。
- `src/lib/youtube.ts` 原先把当前视频播放量写入 `Channel.medianViews`，并标记“单条视频基线”。该响应不包含频道历史序列。
- `src/lib/mock.ts` 在没有频道基线时用当前视频播放量作为 `medianViews`；这会让 Long-form 的单条样本参与 outlier/growth 计算。
- Long-form 和两种 Radar 响应此前没有共享的版本化 Evidence/DataQuality 输出契约。

### INFERENCE

- 缺失频道补充字段的过滤会偏向完整度更高的频道，造成 Discover/Rankings 样本偏差。
- 单视频回填基线会让相对表现看起来可计算，但不能证明创作者历史异常或可重复机会。

### LOW_CONFIDENCE

- 线上结果分布受 upstream 采集策略影响，本仓库无法用本地 fixture 证明生产候选数一定增加；本次只保证合法不完整行在本地转换层不再被无理由丢弃。

## 3. 架构新增/变更

### Evidence contract

新增 `src/lib/evidence-contract.ts`：

- `EvidenceContract`：`schemaVersion`、可选 `algorithmVersion`、`snapshotId`、`requestId`、`capturedAt`、`source`、facts、inferences、missing。
- `EvidenceType`：`FACT`、`INFERENCE`、`LOW_CONFIDENCE`。
- `normalizeEvidence`：保留上游已提供的元数据；缺失时返回 `null`，不伪造算法版本或快照 id。

### DataQuality contract

- `DataQualityLevel` 统一为 `HIGH`、`MEDIUM`、`LOW`、`INSUFFICIENT`。
- `DataQuality` 支持样本数、采集时间、完整度、缺失字段、来源和 schema 版本。
- `deriveDataQuality` 只使用已知样本/完整度推导，不把未知字段改写成零。

### 缺失数据语义

- 新增 `DataValueState`：`KNOWN`、`ZERO`、`UNKNOWN`、`NOT_APPLICABLE`。
- `Channel.subscribers` 与 `medianViews` 允许 `null`；频道增加 `subscriberState`、`baselineStatus`。
- `Video` 增加 `missingFields`、`evidence`、`dataQuality` 可选字段。
- 播放量仍是排序身份所需的核心度量；播放量本身缺失时不创建可计算视频行，避免用零伪造表现。

### 单视频基线处理

- 公共搜索转换层的频道对象现在 `medianViews: null`、`baselineStatus: INSUFFICIENT`，不再写入“单条视频基线”标签。
- `getOpportunity` 对长视频/未知形态在没有 `VERIFIED` 频道基线时返回零机会结论、零置信度，并保留播放速度上下文；Shorts 继续使用原有评分路径。

### Upstream 元数据

- Long-form、Long-form Radar、Shorts Radar normalizer 都会保留上游提供的 `algorithmVersion`、`snapshotId`、`requestId`、`capturedAt`。
- 上游没有提供时对应字段为 `null`；`schemaVersion` 仅标识本地契约版本，不冒充 upstream 算法版本。

## 4. 文件变更

| 文件 | 目的 | 关键行为 |
|---|---|---|
| `src/lib/evidence-contract.ts` | 共享基础契约 | 统一证据、质量和 unknown 语义；无业务评分。 |
| `src/lib/types.ts` | 向后兼容类型扩展 | Channel 支持 null 基线/订阅状态；Video 增加可选证据字段。 |
| `src/lib/youtube.ts` | 公共数据转换 | 保留合法不完整行；缺字段显式记录；取消单行频道基线；endpoint 支持环境变量。 |
| `src/lib/mock.ts` | 长视频低证据门控 | 长视频无验证基线不生成机会结论；Shorts 路径不变。 |
| `src/lib/longform-response.ts` / `longform.ts` | Long-form 契约归一化 | 添加 response-level evidence/dataQuality，保留旧字段。 |
| `src/lib/opportunity-radar.ts` | Long-form Radar 归一化 | 添加 response-level evidence/dataQuality，保留事件顺序和字段。 |
| `src/lib/shortform-opportunity-radar.ts` | Shorts Radar 兼容归一化 | 只添加可选元数据，不改变 Shorts 事件、排序或业务评分。 |
| `src/app/signalcraft-app.tsx` | 兼容 nullable 频道数据 | 未知订阅显示“未知”，过滤不对未知做数值比较。 |
| `tests/evidence-data-quality.test.mjs` | P0 与回归测试 | 覆盖不完整行、unknown、伪基线、证据元数据、Shorts 计数/顺序/旧评分路径。 |

## 5. Before / After

### 不完整视频

**Before**：缺少频道 id、频道 URL 或订阅数 → 转换前丢弃。  
**After**：有 `videoId`/视频 URL/缩略图等可用身份且有播放量 → 保留；标题显示“未命名公开视频”，频道显示“未命名频道”，`missingFields` 记录缺失字段。

### 订阅数

**Before**：缺失或 0 以下的订阅数无法进入结果。  
**After**：缺失为 `subscribers: null` + `subscriberState: UNKNOWN`；真实 0 为 `subscriberState: ZERO`；UI 显示“未知”而不是伪造 0。

### 单视频频道基线

**Before**：一条视频的播放量写入 `Channel.medianViews`，并标记“单条视频基线”。  
**After**：`medianViews: null`、`baselineStatus: INSUFFICIENT`；长视频无验证基线时机会分和置信度保持 0，等待多条历史快照。

### Upstream 元数据

**Before**：Long-form/Radar 只传业务字段，缺少统一 snapshot/algorithm/request 归属。  
**After**：响应增加可选 `evidence`、`dataQuality` 与 schema version；已提供的 upstream metadata 原样保留，缺失仍为 null。

## 6. Shorts 回归保护

新增测试验证：

- Shorts Radar 事件数量与原顺序保持不变。
- Shorts 的旧 `calculateSignal` 输入和输出路径保持不变（固定 fixture 对比）。
- Shorts 与 Long-form 的频道诊断独立测试继续通过。
- Shorts API normalizer 只增加可选契约字段，不改事件业务字段。

本轮没有修改 Shorts scoring、筛选规则、历史数据、缓存或 UI 组件。仍建议在真实 upstream fixture 接入后增加端到端的 Shorts 结果数/排序/过滤/历史快照回放测试；当前仓库无法证明线上 upstream 结果分布。

## 7. 验证结果

- TypeScript：通过（`tsc --noEmit --pretty false`）。
- 自动化测试：73 passed，0 failed。
- Next production build：通过（Next 16.2.6，全部路由生成完成）。
- ESLint：未全通过；保留 2 个既有 `react-hooks/set-state-in-effect` 错误和 23 个警告，主要为 `<img>`、未使用变量/参数。本轮没有新增 lint 错误。
- `git diff --check`：通过（仅提示工作区 CRLF 转换）。

## 8. 向后兼容

- API 变更为 additive：新增 response-level `schemaVersion`、`evidence`、`dataQuality`；旧业务字段保留。
- `Video`/`Channel` 类型是兼容性扩展，但 `Channel.subscribers`/`medianViews` 现在允许 null，已更新现有消费者。
- 未执行数据库迁移；服务端历史 snapshot、账号跨设备存储和 upstream 契约仍需下一阶段完成。

## 9. Remaining P0 blockers

1. upstream 尚未承诺并返回完整 snapshot/algorithm/request metadata，当前只能明确显示 unavailable。
2. 真实历史快照与服务端 DataQuality 仍不在本仓库，无法完成线上可回放证明。
3. ESLint 的两个 hooks 错误仍未处理；它们是现有性能/状态债务，不是本轮数据契约变更引入。

## 10. Recommended next phase

P0 Phase 2 — **Performance / Evidence / Entry Decision Separation**：在本阶段 Evidence/DataQuality 基础上，逐步把表现、证据强度和进入决策拆为独立字段与解释，不重写 Shorts，不把长视频评分迁移到 Shorts。

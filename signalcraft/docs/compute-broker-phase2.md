# Compute Broker Phase 2 规划

Phase 1 只建立 `FREE/CREDIT → CHEAP GPU → EXISTING H3 API` 的最小 Broker 闭环。以下接口是后续扩展边界，不在当前阶段实现：

## 预留 Provider

实现 `VideoComputeProvider` 即可注册新的 `LOCAL_GPU`、`FREE_GPU`、`SPOT_GPU` 或 `API` provider。候选包括 HF ZeroGPU、Lightning、Vast.ai、Local GPU Agent、Seedance 和 Kling；每个 provider 需要独立的能力、认证、成本和健康证据。

## 预留能力

- `ConditioningCache`：使用 prompt、参考素材内容 hash、workflow 与 modelVersion 构造 key；没有安全复用依据前不得缓存推理结果。
  Phase 1 已仅定义 `src/lib/compute-broker/conditioning-cache.ts` 的 key/interface/no-op boundary；未接入 preprocessing，也不会伪造 cache hit。
- `PersistentJobStore`：将当前内存 `ComputeJobStore` 替换为 Supabase/队列实现，保持 API 响应不变。
- `LocalComputeAgent`：注册用户自有 GPU，提供心跳、能力清单、版本和撤销注册接口。
- 多 provider 并行 Draft、GPU marketplace、daily/monthly/user budget 与 OpenTelemetry。

所有新增阈值、价格、成功率和延迟都必须来自真实 benchmark 或生产 telemetry；没有证据时保持 `LOW_CONFIDENCE` / `CALIBRATION_REQUIRED`，不将推测写成事实。Canvas 接入应在单独阶段进行，并继续保留 `CUSTOM` 手动选择。

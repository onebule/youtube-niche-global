# Compute Broker Phase 1

Phase 1 在不接管旧视频生成流程的前提下，新增一条独立的服务端算力路由边界：

`FREE/CREDIT GPU → CHEAP GPU → Existing H3 API`

## A. 修改范围

- 新增 `src/lib/compute-broker`：请求校验、Provider 合同、Registry、路由、成本保护、预算、熔断、fallback、任务状态和 Mock。
- 新增 `/api/video/compute` 与 `/api/video/compute/:jobId`：只有开启 feature flag 才可访问。
- 新增 `services/h3-compute-node`：MiniMax H3 的独立 HTTP contract；未安装权重时不会伪造推理成功。
- 新增 `scripts/benchmark-h3.mjs`：默认只读 health/capability benchmark。
- 新增 `docs/compute-broker-phase2.md`：后续扩展边界。

现有 Canvas、Shorts、Long-form 业务、赛道/机会/诊断、导航和旧 `/api/video/*` 生成链路没有改动。

## B. Provider 架构

`VideoComputeProvider` 统一暴露：

- `healthCheck`
- `estimateCost`
- `submitJob` / `getJobStatus` / `cancelJob`
- `normalizeResult`

内置适配器：

| Provider | 类型 | 生产默认状态 | 说明 |
| --- | --- | --- | --- |
| `modal-h3` | `MODAL_GPU` / `FREE_CREDIT` | 未配置时不参与 | scale-to-zero 的 H3 node contract |
| `runpod-h3` | `CHEAP_GPU` | 未配置时不参与 | RunPod/兼容 REST contract |
| `h3-api` | `API` | 使用现有 gateway 地址 | 复用既有 H3 API，不重复实现 provider SDK |

新增 provider 只需实现合同并 `registry.register()`，不修改 Broker 业务代码。

## C. Routing 与成本

路由先过滤 workflow、model、health、circuit breaker 和手动 provider 选择，再应用：

1. `NEVER_PAY_MORE_THAN_API`：当 GPU 有效成本高于 API 成本 × guard ratio 时拒绝 GPU；
2. `maxCostUsd`：所有已知成本超预算时返回 `BUDGET_EXCEEDED`，不偷偷调用更贵的 provider；
3. 规则选择：`AUTO`、`FREE_FIRST`、`LOWEST_COST`、`FASTEST`、`BEST_QUALITY`、`CUSTOM`；
4. 失败原因只有可重试类型才会进入 fallback，最多由 `VIDEO_COMPUTE_MAX_FALLBACKS` 控制。

成本字段区分 `rawCostUsd`、`effectiveCostUsd`、成功率、来源和置信度。没有真实 benchmark/telemetry 时保留 `null + LOW + CALIBRATION_REQUIRED`，不制造成功率或延迟统计。

## D. 安全开关

默认值是安全的：

```env
VIDEO_COMPUTE_BROKER_ENABLED=false
VIDEO_COMPUTE_BROKER_DRY_RUN=true
```

启用但保持 Dry Run：

```env
VIDEO_COMPUTE_BROKER_ENABLED=true
VIDEO_COMPUTE_BROKER_DRY_RUN=true
```

此时 `POST /api/video/compute` 只执行发现、能力过滤、成本估算与路由，返回 `QUEUED + dryRun=true`，不会调用 GPU 或收费 API。关闭 `VIDEO_COMPUTE_BROKER_ENABLED` 即完全恢复旧流程。

真正执行前必须配置服务端 provider endpoint/credentials 和已校准成本，并在真实环境完成一次手动 smoke test。任何 token/key 只从 server runtime 读取，绝不进入浏览器 bundle 或结构化日志。

## E. 当前验证边界

- Mock routing tests：覆盖 11 个场景；全量仓库测试 181/181 通过。
- TypeScript：通过；Next production build：通过。
- H3 node：health/capabilities 可读；默认 `MODEL_MISSING`；未支持 workflow 明确返回 `UNSUPPORTED_WORKFLOW`。
- 模型缓存：已定义 `H3_MODEL_CACHE_DIR`、版本和显式 readiness 状态；未配置持久卷/权重时仍报告 `MODEL_MISSING`，不会把缓存目录存在误报成可推理。
- 真实 Modal/RunPod GPU、模型权重下载、API 付费生成尚未执行，保持 `CALIBRATION_REQUIRED`。这不是成功伪装，而是当前环境没有真实 GPU/生产 provider 凭证的事实。
- JobStore 当前是显式的内存实现，便于本地和单实例验证；生产多实例持久化应在 Phase 2 接入 Supabase/队列，并保持相同 API 合同。

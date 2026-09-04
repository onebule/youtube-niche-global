# H3 Compute Node

这是独立的 MiniMax H3 推理节点边界，不包含用户鉴权、计费、业务路由、Canvas 或订单状态。

当前仓库只提供 integration-ready HTTP contract：

- `GET /health`
- `GET /capabilities`
- `POST /jobs`
- `GET /jobs/:id`
- `POST /jobs/:id/cancel`

默认 `H3_COMPUTE_NODE_DRY_RUN=true` 且 `H3_COMPUTE_NODE_INFERENCE_READY=false`。这只验证协议，不伪造模型推理，也不会产生 GPU 费用。将 `H3_COMPUTE_NODE_INFERENCE_READY=true` 前，必须在真实 GPU 上完成模型安装和 benchmark；未实现的 `FL2V` / `REF2V` 会明确返回 `UNSUPPORTED_WORKFLOW`。

模型缓存状态通过 `H3_MODEL_CACHE_DIR`、`H3_MODEL_VERSION` 和部署方明确的 readiness 信号记录在 `/health` 与 `/capabilities` 中。仅有目录或环境变量并不等于权重已安装；服务仍会保持 `MODEL_MISSING` / `CALIBRATION_REQUIRED`，直到真实部署完成安装、持久卷验证和推理检查。

```powershell
cd services/h3-compute-node
$env:H3_COMPUTE_NODE_DRY_RUN='true'
node server.mjs
```

`H3HardwareProfile`、DRAFT/FINAL presets 和成本阈值都在主站的 compute-broker 配置中集中管理，并带有 `CALIBRATION_REQUIRED` 标记。

## Phase 1.5 · Modal 生产边界

真实 H3 运行时被隔离在 `modal/`：

- `modal_app.py::prepare_model` 只在 CPU 函数中用官方 Diffusers `ModularPipeline` 准备 `t2va` 组件，并写入持久 Volume；不加载 `transformer_ref`。
- `modal_app.py::smoke` 是唯一的 A100 GPU 入口，固定单次 T2VA、5 秒、24 fps、原生音频，且必须通过免费额度/费用/真实 GPU 闸门。
- `scripts/h3-check.mjs` 只读检查 Modal/HF/ffprobe/节点状态；`scripts/h3-prepare.mjs` 与 `scripts/h3-smoke.mjs` 默认不执行远程操作。
- 生成后的 MP4 必须经过 `scripts/validate-h3-output.mjs` 的 ffprobe 检查，失败状态为 `FAILED_OUTPUT_VALIDATION`。

当前没有在本机执行准备或生成：没有 Modal 认证、Hugging Face 认证、CUDA/Diffusers 运行时或 ffprobe 时，状态必须保持阻塞，不能将环境变量手工改成 ready。

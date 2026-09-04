# MiniMax H3 · Phase 1.5 生产验证边界

本阶段只验证独立的 H3 T2VA 计算节点，不改动 Shorts、Long-form、机会雷达、频道诊断、Canvas 或现有 API 链路。主站继续使用 Phase 1 Compute Broker 的 provider contract；Modal 应用位于 `services/h3-compute-node/modal/`，Next.js 不会导入它。

## 当前状态

**BLOCKED_BY_MODAL_AUTH / BLOCKED_BY_RUNTIME**

本地检查环境没有 Modal CLI、Modal token、Hugging Face token、CUDA/PyTorch/Diffusers 运行时或 ffprobe，因此没有下载模型、创建远程 Volume、启动 GPU 容器或生成 MP4。`MODEL_READY`、`REACHABLE`、`AUTH_VERIFIED` 和 `READY_FOR_MANUAL_SMOKE_TEST` 均不得在缺少真实证据时手工设置。

## 已落地的安全边界

- 仅使用官方 Diffusers `ModularPipeline`，T2VA 只加载共享组件和 `transformer/`，显式跳过 `transformer_ref/`。
- `prepare_model` 是 CPU-only；准备结果写入 Modal Volume 的 manifest，包含下载、跳过与总组件计数。
- `smoke` 只接受单个 T2VA 请求，固定 24 fps、5 秒、768 短边、BF16/A100 可靠配置，音频由同一去噪循环生成并写入 MP4。
- 所有真实 GPU 调用都受 `ALLOW_REAL_GPU_INFERENCE`、免费额度确认、成本估算和 `MAX_REAL_SMOKE_TEST_COST_USD` 闸门保护；无 fallback、无 retry、无批量、无 Canvas。
- `validate-h3-output.mjs` 必须用 ffprobe 验证容器、时长、尺寸、24 fps、视频流、音频流和采样率；任何失败都不是成功结果。
- Modal app 默认 scale-to-zero（无常驻 GPU）；生产凭据只通过 Modal Secret 注入，不写入代码或日志。

## 可执行顺序（有权限后）

```powershell
# 1) 只读检查，不下载、不生成
pnpm h3:check

# 2) 接受 MiniMax-H3 社区许可证后，在 Modal CPU 函数中准备 T2VA 缓存
$env:H3_HF_LICENSE_ACCEPTED='true'
$env:H3_PREPARE_ALLOW_REMOTE='true'
pnpm h3:prepare

# 3) 核对 Volume manifest、模型组件计数和运行时版本
# 4) 明确知道免费额度/费用为 0 后，才允许一次手动 smoke
$env:ALLOW_REAL_GPU_INFERENCE='true'
$env:H3_FREE_CREDIT_CONFIRMED='true'
$env:H3_ESTIMATED_SMOKE_COST_USD='0'
$env:H3_SMOKE_EXECUTE='true'
pnpm h3:smoke

# 5) 对唯一输出执行 ffprobe 校验
pnpm h3:validate-output <output.mp4>
```

首次真实 smoke 成功后，记录 `generationId`、`providerTaskId`、时间戳、GPU/显存、冷启动、模型加载、推理、编码耗时、输出路径和实际/可验证成本。未完成这些记录前，不进入 P4 Phase 5 批量编排。

## 官方依据

- [Diffusers v0.40.0 MiniMax-H3](https://huggingface.co/docs/diffusers/v0.40.0/api/pipelines/minimax_h3)
- [ModularPipeline 文档](https://huggingface.co/docs/diffusers/v0.40.0/modular_diffusers/modular_pipeline)
- [Modal Volume](https://modal.com/docs/sdk/py/latest/Volume)
- [Modal Secret](https://modal.com/docs/sdk/py/latest/Secret)
- [Modal scale-to-zero](https://modal.com/docs/guide/scale)

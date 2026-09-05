import { randomUUID } from 'node:crypto';
import { H3_HARDWARE_PROFILES, readComputeBrokerConfig, type ComputeBrokerConfig, type HfH3FreeSpaceCandidate } from '../config.ts';
import { ProviderError, type CostEstimate, type H3HardwareProfile, type NormalizedProviderResult, type ProviderHealth, type ProviderJob, type VideoComputeProvider, type VideoGenerationRequest, type Workflow } from '../types.ts';
import { createHfZeroGpuBridge, type HfBridgeCheck, type HfZeroGpuBridge } from './bridge.ts';
import { buildHfH3Invocation, discoverHfH3Api, selectHfFastPreset, type HfH3ApiSchema } from './discovery.ts';
import { normalizeHfZeroGpuOutput, sanitizeHfError } from './normalizer.ts';
import { estimateHfGpuSeconds, parseHfQuotaMessage, quotaFailureMetrics, type HfQuotaDetails } from './quota.ts';
import { materializeHfVideoOutput, type HfStoredVideo } from './storage.ts';

export const HF_ZEROGPU_H3 = 'HF_ZEROGPU_H3';
export const HF_ZEROGPU_H3_SPACE = 'MiniMaxAI/MiniMax-H3-Turbo-Lora';

const now = () => new Date().toISOString();
const hardware: H3HardwareProfile = { ...H3_HARDWARE_PROFILES.H3_SURVIVAL, productionEligible: false, calibrationStatus: 'CALIBRATION_REQUIRED' };
const recentQuotaTtlMs = 5 * 60_000;
let recentQuota: { space: string; details: HfQuotaDetails; observedAtMs: number } | null = null;
type HfOutputValidator = (path: string) => Promise<{ valid: boolean; [key: string]: unknown }>;
const validateWithCanonicalProbe: HfOutputValidator = async path => {
  try {
    const loaded = await import('../../../../scripts/validate-h3-output.mjs') as unknown as { validateH3Output: HfOutputValidator };
    return loaded.validateH3Output(path);
  } catch (error) {
    return { valid: false, code: 'FFPROBE_UNAVAILABLE', message: sanitizeHfError(error) };
  }
};

function healthFromCheck(check: HfBridgeCheck, checkedAt: string, latencyMs: number | null, space: string, providerId: string, candidate?: HfH3FreeSpaceCandidate | null, schema?: HfH3ApiSchema | null): ProviderHealth {
  const state: ProviderHealth['state'] = check.auth === 'AUTH_REQUIRED' || check.auth === 'AUTH_INVALID' ? 'NOT_CONFIGURED' : check.reachability === 'REACHABLE' && check.ok ? 'AVAILABLE' : check.reachability === 'SLEEPING' || check.reachability === 'BUILDING' ? 'DEGRADED' : 'OFFLINE';
  const modelState: ProviderHealth['modelState'] = state === 'AVAILABLE' ? 'MODEL_READY' : state === 'DEGRADED' ? 'MODEL_LOADING' : 'UNKNOWN';
  return { state, checkedAt, latencyMs, modelState, reason: check.message || check.code || null, metadata: { space, auth: check.auth, reachability: check.reachability, runtime: check.runtime, hardware: check.hardware, quota: check.quota, quotaDetails: check.quotaDetails || null, provider: providerId, candidateKind: candidate?.kind || null, role: candidate?.role || null, api: schema ? { endpoint: schema.endpoint, compatible: schema.compatible, inputCount: schema.inputs.length, selectedPreset: selectHfFastPreset(schema)?.value || null } : null } };
}

export class HFZeroGpuH3Provider implements VideoComputeProvider {
  readonly providerId: string;
  readonly displayName = 'Hugging Face ZeroGPU · MiniMax H3';
  readonly providerType = 'FREE_GPU' as const;
  readonly costClass = 'FREE_QUOTA' as const;
  readonly creditBacked = true;
  readonly supportedModels = ['MiniMaxAI/MiniMax-H3-Turbo-Lora', 'MiniMax-H3', 'minimax-h3'];
  readonly supportedWorkflows: Workflow[] = ['T2V'];
  readonly hardwareProfile = hardware;
  private readonly config: ComputeBrokerConfig['hfZeroGpu'];
  private readonly bridge: HfZeroGpuBridge;
  private readonly store: (input: { url?: string | null; path?: string | null; spaceId: string; generationId?: string | null }) => Promise<HfStoredVideo>;
  private readonly validateOutput: HfOutputValidator;
  private readonly candidate: HfH3FreeSpaceCandidate | null;
  private lastSchema: HfH3ApiSchema | null = null;

  constructor(config = readComputeBrokerConfig().hfZeroGpu, bridge = createHfZeroGpuBridge(), store = materializeHfVideoOutput, validateOutput = validateWithCanonicalProbe, candidate: HfH3FreeSpaceCandidate | null = null) { this.config = config; this.bridge = bridge; this.store = store; this.validateOutput = validateOutput; this.candidate = candidate; this.providerId = candidate?.providerId || HF_ZEROGPU_H3; }

  private get space() { return this.candidate?.space || this.config.space; }

  async healthCheck(context: { dryRun?: boolean } = {}): Promise<ProviderHealth> {
    const checkedAt = now();
    if (!this.config.enabled) return { state: 'NOT_CONFIGURED', checkedAt, latencyMs: null, modelState: 'MODEL_MISSING', reason: 'HF ZeroGPU H3 feature flag is disabled.' };
    if (!this.config.token) return { state: 'NOT_CONFIGURED', checkedAt, latencyMs: null, modelState: 'MODEL_MISSING', reason: 'HF_TOKEN 未配置；只允许服务端认证。' };
    if (context.dryRun) return { state: 'AVAILABLE', checkedAt, latencyMs: null, modelState: 'UNKNOWN', reason: 'Dry run 跳过 Space 网络探测；未验证实时可用性。', metadata: { space: this.space, provider: this.providerId, candidateKind: this.candidate?.kind || null, role: this.candidate?.role || null } };
    const started = Date.now();
    const check = await this.bridge.check({ space: this.space, token: this.config.token });
    if (check.apiInfo) this.lastSchema = discoverHfH3Api(check.apiInfo, this.space);
    return healthFromCheck(check, checkedAt, Date.now() - started, this.space, this.providerId, this.candidate, this.lastSchema);
  }

  async estimateCost(request: VideoGenerationRequest): Promise<CostEstimate> {
    const selectedPreset = this.lastSchema ? selectHfFastPreset(this.lastSchema) : null;
    const estimatedQuotaSeconds = estimateHfGpuSeconds({ ...request, steps: selectedPreset?.steps ?? request.steps ?? 10 });
    return { rawCostUsd: 0, effectiveCostUsd: 0, estimatedQuotaSeconds, quotaConfidence: 'LOW', successRate: null, confidence: 'LOW', source: 'INCLUDED_QUOTA', notes: ['FREE_QUOTA：成本为 0 USD 仅表示使用 Hugging Face ZeroGPU 包含额度。', '额度、排队和可用性不是无限资源；预计每日分钟数为外部政策，仍需校准。', 'quotaSeconds 为未完成实时校准的保守估算。', 'CALIBRATION_REQUIRED=true'] };
  }

  async submitJob(request: VideoGenerationRequest): Promise<ProviderJob> {
    if (!this.config.enabled || !this.config.allowRealGeneration) throw new ProviderError('HF ZeroGPU H3 真实生成闸门未开启。', 'PROVIDER_NOT_CONFIGURED', false);
    if (!this.config.token) throw new ProviderError('HF_TOKEN 未配置。', 'HF_AUTH_REQUIRED', false);
    if (this.config.smokeOnly && !request.requestId.startsWith('hf-h3-smoke-')) throw new ProviderError('HF ZeroGPU H3 当前仅允许显式单任务 smoke。', 'PROVIDER_NOT_CONFIGURED', false);
    if (request.workflow !== 'T2V') throw new ProviderError('HF ZeroGPU H3 首次 smoke 仅允许 T2V。', 'UNSUPPORTED_WORKFLOW', false);
    if (!this.config.maxWaitSeconds || this.config.maxWaitSeconds <= 0) throw new ProviderError('HF_ZEROGPU_MAX_WAIT_SECONDS 尚未完成外部校准。', 'PROVIDER_NOT_CONFIGURED', false);
    const estimatedRequiredGpuSeconds = estimateHfGpuSeconds(request);
    const check = await this.bridge.check({ space: this.space, token: this.config.token as string });
    if (!check.ok) {
      const quota = check.quotaDetails || parseHfQuotaMessage(check.message);
      if (quota?.quotaStatus === 'INSUFFICIENT' || this.failureReason(check.code) === 'HF_ZERO_GPU_QUOTA_EXHAUSTED') {
        const details: HfQuotaDetails = {
          estimatedRequiredGpuSeconds: quota?.estimatedRequiredGpuSeconds ?? estimatedRequiredGpuSeconds,
          remainingGpuSeconds: quota?.remainingGpuSeconds ?? null,
          quotaResetAt: quota?.quotaResetAt ?? null,
          resetEstimate: quota?.resetEstimate ?? null,
          quotaStatus: 'INSUFFICIENT',
          source: 'PROVIDER_PREFLIGHT',
          ...(quota?.observedAt ? { observedAt: quota.observedAt } : { observedAt: now() }),
        };
        throw this.quotaError(request, details);
      }
      throw new ProviderError(check.message || 'HF Space 检查未通过。', this.failureReason(check.code), this.retryable(check.code));
    }
    const knownQuota = check.quotaDetails || (recentQuota?.space === this.space && Date.now() - recentQuota.observedAtMs <= recentQuotaTtlMs ? recentQuota.details : null);
    if (knownQuota?.remainingGpuSeconds !== null && knownQuota?.remainingGpuSeconds !== undefined && knownQuota.remainingGpuSeconds < estimatedRequiredGpuSeconds) {
      const quota = { ...knownQuota, estimatedRequiredGpuSeconds, quotaStatus: 'INSUFFICIENT' as const, source: 'PROVIDER_PREFLIGHT' as const };
      throw this.quotaError(request, quota);
    }
    const schema = discoverHfH3Api(check.apiInfo, this.space);
    this.lastSchema = schema;
    if (!schema.compatible) throw new ProviderError(schema.reason || 'HF Space API 契约不兼容。', 'HF_API_INCOMPATIBLE', false);
    const invocation = buildHfH3Invocation(schema, request);
    const startedAt = now();
    const smoke = await this.bridge.smoke({ space: this.space, token: this.config.token as string, invocation, maxWaitSeconds: this.config.maxWaitSeconds });
    if (!smoke.ok) {
      const quota = smoke.quotaDetails || parseHfQuotaMessage(smoke.message);
      if (quota?.quotaStatus === 'INSUFFICIENT' || this.failureReason(smoke.code) === 'HF_ZERO_GPU_QUOTA_EXHAUSTED') {
        const details: HfQuotaDetails = {
          estimatedRequiredGpuSeconds: quota?.estimatedRequiredGpuSeconds ?? estimatedRequiredGpuSeconds,
          remainingGpuSeconds: quota?.remainingGpuSeconds ?? null,
          quotaResetAt: quota?.quotaResetAt ?? null,
          resetEstimate: quota?.resetEstimate ?? null,
          quotaStatus: 'INSUFFICIENT',
          source: 'PROVIDER_ERROR',
          ...(quota?.observedAt ? { observedAt: quota.observedAt } : { observedAt: now() }),
        };
        recentQuota = { space: this.space, details, observedAtMs: Date.now() };
        throw this.quotaError(request, details);
      }
      throw new ProviderError(smoke.message || 'HF ZeroGPU smoke failed.', this.failureReason(smoke.code), this.retryable(smoke.code));
    }
    const normalized = normalizeHfZeroGpuOutput(smoke.result);
    if (!normalized.videoAsset) throw new ProviderError('HF ZeroGPU 未返回可验证的 MP4 视频资产。', 'OUTPUT_VALIDATION_FAILED', false);
    const providerTaskId = smoke.providerTaskId || normalized.videoAsset.generationId || `hf-h3-${randomUUID()}`;
    const stored = await this.store({ url: normalized.videoAsset.url, path: normalized.videoAsset.path, spaceId: this.space, generationId: providerTaskId });
    const validation = await this.validateOutput(stored.path);
    if (!validation.valid) throw new ProviderError(`HF ZeroGPU 输出校验失败：${String(validation.code || 'UNKNOWN')}`, 'OUTPUT_VALIDATION_FAILED', false);
    const completedAt = now();
    const selectedPreset = selectHfFastPreset(schema);
    const effectiveSteps = selectedPreset?.steps ?? request.steps ?? 10;
    const providerMetrics = { providerId: this.providerId, spaceId: this.space, workflow: request.workflow, durationSeconds: request.durationSeconds, canvas: request.aspectRatio, steps: effectiveSteps, seed: request.seed ?? 42, selectedPreset: selectedPreset?.value || null, queueMs: null, generationMs: null, downloadMs: null, validationMs: null, totalMs: Math.max(0, Date.parse(completedAt) - Date.parse(startedAt)), costUsd: 0, costType: 'INCLUDED_QUOTA', quotaSecondsPerGeneration: null, videoSecondsPerQuotaMinute: null, confidence: 'LOW', calibrationRequired: true };
    return { providerTaskId, state: 'SUCCEEDED', submittedAt: startedAt, processingAt: startedAt, completedAt, output: { url: null, assetId: stored.assetId, contentType: stored.contentType }, raw: { videoAsset: { ...normalized.videoAsset, path: stored.path, url: null, generationId: providerTaskId }, storage: stored, validation, providerMetrics, providerReport: { ...normalized.providerReport, ...providerMetrics }, rawMetadata: normalized.rawMetadata } };
  }

  async getJobStatus(providerTaskId: string): Promise<ProviderJob> { return { providerTaskId, state: 'UNKNOWN', submittedAt: now(), processingAt: null, completedAt: null, output: null, raw: { code: 'HF_STATUS_NOT_PERSISTED', message: 'Gradio job result is returned synchronously by the isolated smoke bridge.' } }; }
  async cancelJob() { return false; }

  normalizeResult(job: ProviderJob): NormalizedProviderResult {
    const report = normalizeHfZeroGpuOutput(job.raw || job);
    const succeeded = job.state === 'SUCCEEDED' && Boolean(report.videoAsset);
    return { state: succeeded ? 'SUCCEEDED' : job.state, outputUrl: report.videoAsset?.url || job.output?.url || null, outputAssetId: job.output?.assetId || null, providerTaskId: job.providerTaskId, error: succeeded || job.state === 'QUEUED' || job.state === 'PROCESSING' ? null : { reason: job.state === 'UNKNOWN' ? 'UNKNOWN_PROVIDER_ERROR' : 'OUTPUT_VALIDATION_FAILED', message: 'HF ZeroGPU output 尚未通过 MP4 校验。', retryable: false } };
  }

  private failureReason(code?: string) {
    const normalized = String(code || '').toUpperCase();
    if (normalized.includes('AUTH')) return normalized.includes('INVALID') ? 'HF_AUTH_INVALID' : 'HF_AUTH_REQUIRED';
    if (normalized.includes('QUOTA')) return 'HF_ZERO_GPU_QUOTA_EXHAUSTED';
    if (normalized.includes('QUEUE')) return 'HF_ZERO_GPU_QUEUE_BUSY';
    if (normalized.includes('API')) return normalized.includes('CHANGE') ? 'HF_API_CHANGED' : 'HF_API_INCOMPATIBLE';
    if (normalized.includes('SPACE') || normalized.includes('UNREACHABLE')) return 'HF_SPACE_UNREACHABLE';
    return 'UNKNOWN_PROVIDER_ERROR';
  }
  private quotaError(request: VideoGenerationRequest, quota: HfQuotaDetails) {
    const details = { publicCode: 'BLOCKED_BY_HF_QUOTA', quota, providerMetrics: quotaFailureMetrics({ providerId: this.providerId, spaceId: this.space, request, quota }) };
    const remaining = quota.remainingGpuSeconds === null ? '未知' : `${quota.remainingGpuSeconds}s`;
    const reset = quota.resetEstimate ? ` 可再次尝试：${quota.resetEstimate}。` : '';
    return new ProviderError(`HF ZeroGPU 额度不足：预计需要 ${quota.estimatedRequiredGpuSeconds ?? '未知'}s，剩余 ${remaining}。${reset}`, 'HF_ZERO_GPU_QUOTA_EXHAUSTED', false, 503, details);
  }
  private retryable(code?: string) { return /QUEUE|SLEEP|BUILD|TIMEOUT|UNREACHABLE/i.test(String(code || '')); }
}

export function hfZeroGpuConfigStatus(config = readComputeBrokerConfig().hfZeroGpu) {
  return { provider: HF_ZEROGPU_H3, space: config.space, spaces: config.spaces || [], enabled: config.enabled, smokeOnly: config.smokeOnly, allowRealGeneration: config.allowRealGeneration, tokenConfigured: Boolean(config.token), maxWaitSeconds: config.maxWaitSeconds, expectedDailyQuotaMinutes: config.expectedDailyQuotaMinutes, quotaPolicy: 'EXTERNAL_POLICY_NOT_PERMANENT' };
}

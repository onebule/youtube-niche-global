import { estimateConfiguredCost } from './cost.ts';
import { H3_HARDWARE_PROFILES, readComputeBrokerConfig } from './config.ts';
import {
  ProviderError,
  type CostEstimate,
  type H3HardwareProfile,
  type NormalizedProviderResult,
  type ProviderHealth,
  type ProviderJob,
  type ProviderJobState,
  type VideoComputeProvider,
  type VideoGenerationRequest,
  type Workflow,
} from './types.ts';
import { HFZeroGpuH3Provider } from './hf-zerogpu/provider.ts';

const nowIso = () => new Date().toISOString();
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : null;

function mapProviderState(value: unknown): ProviderJobState {
  const state = String(value || '').toLowerCase();
  if (['queued', 'submitted', 'pending', 'created'].includes(state)) return 'QUEUED';
  if (['processing', 'running', 'started', 'in_progress'].includes(state)) return 'PROCESSING';
  if (['succeeded', 'completed', 'success', 'done'].includes(state)) return 'SUCCEEDED';
  if (['failed', 'error', 'cancelled', 'canceled', 'expired'].includes(state)) return state === 'expired' ? 'EXPIRED' : state.startsWith('cancel') ? 'CANCELLED' : 'FAILED';
  return 'UNKNOWN';
}

function providerJobFromResponse(payload: unknown, responseStatus?: number): ProviderJob {
  const root = asRecord(payload);
  const generation = asRecord(root.generation || root.job || root.task || root);
  const providerTaskId = text(generation.providerTaskId) || text(generation.provider_task_id) || text(generation.task_id) || text(generation.taskId) || text(generation.id);
  if (!providerTaskId) throw new ProviderError('Provider response missing task id.', 'UNKNOWN_PROVIDER_ERROR', true, responseStatus);
  const outputRoot = asRecord(generation.output || root.output || {});
  const outputUrl = text(outputRoot.url) || text(generation.videoUrl) || text(generation.video_url) || text(generation.outputUrl);
  const outputAssetId = text(outputRoot.assetId) || text(generation.videoAssetId) || text(generation.video_asset_id);
  const state = mapProviderState(generation.status || generation.state || root.status);
  return {
    providerTaskId,
    state,
    submittedAt: text(generation.submittedAt) || text(generation.createdAt) || nowIso(),
    processingAt: text(generation.processingAt) || text(generation.startedAt),
    completedAt: text(generation.completedAt) || (state === 'SUCCEEDED' ? nowIso() : null),
    output: outputUrl || outputAssetId ? { url: outputUrl, assetId: outputAssetId, contentType: text(outputRoot.contentType) || 'video/mp4' } : null,
    raw: root,
  };
}

function failureFromHttp(status: number, payload: unknown, fallback: string): ProviderError {
  const root = asRecord(payload);
  const code = String(root.code || root.errorCode || root.error || '').toUpperCase();
  const message = text(root.message) || text(root.error) || fallback;
  if (status === 401 || status === 403 || code.includes('AUTH')) return new ProviderError(message, 'AUTH_ERROR', false, status);
  if (code.includes('POLICY') || code.includes('CONTENT')) return new ProviderError(message, 'CONTENT_POLICY', false, status);
  if (code.includes('INVALID') || status === 400 || status === 422) return new ProviderError(message, 'INVALID_INPUT', false, status);
  if (code.includes('OOM')) return new ProviderError(message, 'GPU_OOM', true, status);
  if (code.includes('CREDIT')) return new ProviderError(message, 'CREDIT_EXHAUSTED', true, status);
  if (status === 408) return new ProviderError(message, 'START_TIMEOUT', true, status);
  if (status === 429 || status >= 500) return new ProviderError(message, 'PROVIDER_DOWN', true, status);
  return new ProviderError(message, 'UNKNOWN_PROVIDER_ERROR', true, status);
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 20_000) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs), cache: 'no-store' });
    const raw = await response.text();
    let payload: unknown = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = { error: raw.slice(0, 500) }; }
    if (!response.ok) throw failureFromHttp(response.status, payload, `Provider request failed (${response.status}).`);
    return payload;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : 'Provider request failed.';
    if (/timeout|abort/i.test(message)) throw new ProviderError('Provider request timed out.', 'INFERENCE_TIMEOUT', true);
    throw new ProviderError('Provider is unreachable.', 'PROVIDER_DOWN', true);
  }
}

function authHeaders(token: string | null, authorization: string | null = null) {
  return {
    accept: 'application/json',
    'content-type': 'application/json',
    ...(authorization ? { authorization } : token ? { authorization: `Bearer ${token}` } : {}),
  };
}

function profile(id: keyof typeof H3_HARDWARE_PROFILES): H3HardwareProfile {
  return H3_HARDWARE_PROFILES[id] || H3_HARDWARE_PROFILES.H3_ECO;
}

abstract class HttpH3Provider implements VideoComputeProvider {
  abstract readonly providerId: string;
  abstract readonly displayName: string;
  abstract readonly providerType: VideoComputeProvider['providerType'];
  abstract readonly costClass: VideoComputeProvider['costClass'];
  abstract readonly creditBacked: boolean;
  abstract readonly supportedModels: string[];
  abstract readonly supportedWorkflows: Workflow[];
  abstract readonly hardwareProfile: H3HardwareProfile;

  protected readonly endpoint: string | null;
  protected readonly token: string | null;
  protected readonly costPerSecondUsd: number | null;
  /** Provider credentials win by default; only the existing gateway may opt into user auth forwarding. */
  protected readonly forwardIncomingAuthorization: boolean = false;
  protected constructor(endpoint: string | null, token: string | null, costPerSecondUsd: number | null) { this.endpoint = endpoint; this.token = token; this.costPerSecondUsd = costPerSecondUsd; }

  async healthCheck(context: { dryRun?: boolean; authorization?: string | null } = {}): Promise<ProviderHealth> {
    const checkedAt = nowIso();
    if (!this.endpoint) return { state: 'NOT_CONFIGURED', checkedAt, latencyMs: null, modelState: 'MODEL_MISSING', reason: 'Provider endpoint 未配置。' };
    if (context.dryRun) return { state: 'AVAILABLE', checkedAt, latencyMs: null, modelState: 'UNKNOWN', reason: 'Dry run 跳过网络探测；可用性未实时验证。' };
    const started = Date.now();
    try {
      const payload = await fetchJson(this.healthUrl(), { method: 'GET', headers: authHeaders(this.token, this.forwardIncomingAuthorization ? context.authorization || null : null) }, 10_000);
      const state = String(asRecord(payload).status || asRecord(payload).state || '').toLowerCase();
      return { state: state === 'degraded' ? 'DEGRADED' : 'AVAILABLE', checkedAt, latencyMs: Date.now() - started, modelState: this.modelState(payload), reason: text(asRecord(payload).message) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Provider health check failed.';
      return { state: 'OFFLINE', checkedAt, latencyMs: Date.now() - started, modelState: 'UNKNOWN', reason };
    }
  }

  async estimateCost(request: VideoGenerationRequest): Promise<CostEstimate> {
    return estimateConfiguredCost(request, this.costPerSecondUsd);
  }

  async submitJob(request: VideoGenerationRequest, context: { authorization?: string | null } = {}): Promise<ProviderJob> {
    if (!this.endpoint) throw new ProviderError('Provider endpoint 未配置。', 'PROVIDER_NOT_CONFIGURED', false);
    const payload = await fetchJson(this.jobsUrl(), { method: 'POST', headers: authHeaders(this.token, this.forwardIncomingAuthorization ? context.authorization || null : null), body: JSON.stringify(this.requestPayload(request)) });
    return providerJobFromResponse(payload);
  }

  async getJobStatus(providerTaskId: string, context: { authorization?: string | null } = {}): Promise<ProviderJob> {
    if (!this.endpoint) throw new ProviderError('Provider endpoint 未配置。', 'PROVIDER_NOT_CONFIGURED', false);
    const payload = await fetchJson(`${this.jobsUrl()}/${encodeURIComponent(providerTaskId)}`, { method: 'GET', headers: authHeaders(this.token, this.forwardIncomingAuthorization ? context.authorization || null : null) });
    return providerJobFromResponse(payload);
  }

  async cancelJob(providerTaskId: string, context: { authorization?: string | null } = {}) {
    if (!this.endpoint) return false;
    await fetchJson(`${this.jobsUrl()}/${encodeURIComponent(providerTaskId)}/cancel`, { method: 'POST', headers: authHeaders(this.token, this.forwardIncomingAuthorization ? context.authorization || null : null), body: '{}' });
    return true;
  }

  normalizeResult(job: ProviderJob): NormalizedProviderResult {
    const failed = job.state === 'FAILED' || job.state === 'EXPIRED' || job.state === 'UNKNOWN';
    const cancelled = job.state === 'CANCELLED';
    return {
      state: job.state,
      outputUrl: job.output?.url || null,
      outputAssetId: job.output?.assetId || null,
      providerTaskId: job.providerTaskId,
      error: failed || cancelled
        ? { reason: cancelled ? 'USER_CANCELLED' : 'UNKNOWN_PROVIDER_ERROR', message: cancelled ? 'Provider 已取消任务。' : 'Provider 返回失败或未知状态。', retryable: failed }
        : null,
    };
  }

  protected abstract healthUrl(): string;
  protected abstract jobsUrl(): string;
  protected requestPayload(request: VideoGenerationRequest): unknown { return request; }
  protected modelState(payload: unknown): ProviderHealth['modelState'] {
    const state = String(asRecord(payload).modelState || asRecord(payload).model_status || '').toUpperCase();
    return ['MODEL_READY', 'MODEL_LOADING', 'MODEL_MISSING'].includes(state) ? state as ProviderHealth['modelState'] : 'UNKNOWN';
  }
}

export class ModalH3Provider extends HttpH3Provider {
  readonly providerId = 'modal-h3';
  readonly displayName = 'Modal H3';
  readonly providerType = 'MODAL_GPU' as const;
  readonly costClass = 'FREE_CREDIT' as const;
  readonly creditBacked = true;
  readonly supportedModels = ['MiniMax-H3', 'minimax-h3'];
  readonly supportedWorkflows: Workflow[] = ['T2V', 'I2V', 'FL2V', 'REF2V'];
  readonly hardwareProfile: H3HardwareProfile;
  constructor(config = readComputeBrokerConfig().modal) { super(config.endpoint, config.token, config.costPerSecondUsd); this.hardwareProfile = profile(config.hardware); }
  protected healthUrl() { return `${this.endpoint}/health`; }
  protected jobsUrl() { return `${this.endpoint}/jobs`; }
}

export class SpotGpuProvider extends HttpH3Provider {
  readonly providerId = 'runpod-h3';
  readonly displayName = 'RunPod Cheap GPU H3';
  readonly providerType = 'CHEAP_GPU' as const;
  readonly costClass = 'CHEAP_GPU' as const;
  readonly creditBacked = false;
  readonly supportedModels = ['MiniMax-H3', 'minimax-h3'];
  readonly supportedWorkflows: Workflow[] = ['T2V', 'I2V', 'FL2V', 'REF2V'];
  readonly hardwareProfile: H3HardwareProfile;
  constructor(config = readComputeBrokerConfig().cheapGpu) { super(config.endpoint, config.apiKey, config.costPerSecondUsd); this.hardwareProfile = profile(config.hardware); }
  protected healthUrl() { return `${this.endpoint}/health`; }
  protected jobsUrl() { return `${this.endpoint}/jobs`; }
}

export class H3ApiProvider extends HttpH3Provider {
  readonly providerId = 'h3-api';
  readonly displayName = 'Existing H3 API';
  readonly providerType = 'API' as const;
  readonly costClass = 'API' as const;
  readonly creditBacked = false;
  readonly supportedModels = ['minimax-h3', 'MiniMax-H3'];
  readonly supportedWorkflows: Workflow[] = ['I2V', 'FL2V', 'REF2V'];
  readonly hardwareProfile = profile('H3_HIGH');
  private readonly apiModel: string;
  protected readonly forwardIncomingAuthorization = true;
  constructor(config = readComputeBrokerConfig().h3Api) { super(config.endpoint, config.token, config.costPerSecondUsd); this.apiModel = config.model; }
  protected healthUrl() { return `${this.endpoint}/models`; }
  protected jobsUrl() { return `${this.endpoint}/generate`; }
  async getJobStatus(providerTaskId: string, context: { authorization?: string | null } = {}) {
    if (!this.endpoint) throw new ProviderError('Provider endpoint 未配置。', 'PROVIDER_NOT_CONFIGURED', false);
    const payload = await fetchJson(`${this.endpoint}/status?generationId=${encodeURIComponent(providerTaskId)}`, { method: 'GET', headers: authHeaders(this.token, context.authorization || null) });
    return providerJobFromResponse(payload);
  }
  async cancelJob(providerTaskId: string, context: { authorization?: string | null } = {}) {
    if (!this.endpoint) return false;
    await fetchJson(`${this.endpoint}/cancel`, { method: 'POST', headers: authHeaders(this.token, context.authorization || null), body: JSON.stringify({ generationId: providerTaskId }) });
    return true;
  }
  protected requestPayload(request: VideoGenerationRequest) {
    return {
      model: request.model || this.apiModel,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt || undefined,
      referenceMode: request.workflow === 'T2V' ? 'text' : request.workflow === 'REF2V' ? 'omni' : 'start-end',
      startImageAssetId: request.assets.startImage || undefined,
      endImageAssetId: request.assets.endImage || undefined,
      referenceImageAssetIds: request.assets.referenceImages || [],
      referenceVideoAssetIds: request.assets.referenceVideo ? [request.assets.referenceVideo] : [],
      referenceAudioAssetIds: request.assets.referenceAudio ? [request.assets.referenceAudio] : [],
      duration: `${request.durationSeconds}s`,
      aspectRatio: request.aspectRatio,
      resolution: request.resolution,
      audio: request.audio,
      idempotencyKey: request.requestId,
    };
  }
}

export function createDefaultProviders(config = readComputeBrokerConfig()): VideoComputeProvider[] {
  return [new HFZeroGpuH3Provider(config.hfZeroGpu), new ModalH3Provider(config.modal), new SpotGpuProvider(config.cheapGpu), new H3ApiProvider(config.h3Api)];
}

import { comparableCost, passesApiCostGuard } from './cost.ts';
import { readComputeBrokerConfig, type ComputeBrokerConfig } from './config.ts';
import { CircuitBreaker, getDefaultProviderRegistry, ProviderRegistry } from './registry.ts';
import { getDefaultComputeJobStore } from './store.ts';
import {
  ComputeRequestError,
  ProviderError,
  type ComputeJob,
  type ComputeResponse,
  type ComputeRoutePlan,
  type ComputeJobStore,
  type FailureReason,
  type ProviderCandidate,
  type ProviderHealth,
  type VideoComputeProvider,
  type VideoGenerationRequest,
} from './types.ts';

const terminalStates = new Set<ComputeJob['status']>(['SUCCEEDED', 'FAILED', 'CANCELLED']);
const now = () => new Date().toISOString();

function latency(candidate: ProviderCandidate) { return candidate.health.latencyMs ?? Number.POSITIVE_INFINITY; }
function isHealthy(health: ProviderHealth) { return health.state === 'AVAILABLE' || health.state === 'DEGRADED'; }
function modelMatches(provider: VideoComputeProvider, model: string | null) { return !model || provider.supportedModels.some(value => value.toLowerCase() === model.toLowerCase()); }
function freeFirstRank(candidate: ProviderCandidate) {
  if (candidate.provider.costClass === 'FREE_QUOTA') return 0;
  if (candidate.provider.costClass === 'FREE_CREDIT' || candidate.provider.creditBacked) return 1;
  return 2;
}
function quotaEstimate(candidate: ProviderCandidate) { return candidate.cost.estimatedQuotaSeconds ?? Number.POSITIVE_INFINITY; }
function freeFirstCompare(a: ProviderCandidate, b: ProviderCandidate) {
  return freeFirstRank(a) - freeFirstRank(b)
    || quotaEstimate(a) - quotaEstimate(b)
    || comparableCost(a) - comparableCost(b)
    || latency(a) - latency(b);
}

export class ComputeBroker {
  private readonly registry: ProviderRegistry;
  private readonly config: ComputeBrokerConfig;
  private readonly store: ComputeJobStore;
  private readonly breaker: CircuitBreaker;
  constructor(
    registry: ProviderRegistry = getDefaultProviderRegistry(),
    config: ComputeBrokerConfig = readComputeBrokerConfig(),
    store: ComputeJobStore = getDefaultComputeJobStore(),
    breaker?: CircuitBreaker,
  ) { this.registry = registry; this.config = config; this.store = store; this.breaker = breaker || new CircuitBreaker(config.circuitBreakerFailureThreshold, config.circuitBreakerCooldownMs); }

  private log(event: string, data: Record<string, unknown>) {
    // Structured metadata only; credentials and media payloads never enter logs.
    console.info(JSON.stringify({ event, at: now(), ...data }));
  }

  async plan(request: VideoGenerationRequest, context: { authorization?: string | null } = {}): Promise<ComputeRoutePlan> {
    const providers = this.registry.list();
    const health = await Promise.all(providers.map(provider => provider.healthCheck({ dryRun: this.config.dryRun, authorization: context.authorization || null })));
    const candidates: ProviderCandidate[] = [];
    for (const [index, provider] of providers.entries()) {
      const providerHealth = health[index];
      const cost = await provider.estimateCost(request);
      const reasons: string[] = [];
      let compatible = modelMatches(provider, request.model) && provider.supportedWorkflows.includes(request.workflow);
      if (!modelMatches(provider, request.model)) reasons.push('模型不在 provider 支持范围。');
      if (!provider.supportedWorkflows.includes(request.workflow)) reasons.push(`workflow ${request.workflow} 未声明支持。`);
      if (!isHealthy(providerHealth)) { compatible = false; reasons.push(`provider 状态为 ${providerHealth.state}。`); }
      if (providerHealth.modelState === 'MODEL_MISSING') { compatible = false; reasons.push('模型缓存未就绪。'); }
      const apiMetadata = providerHealth.metadata?.api;
      if (apiMetadata && typeof apiMetadata === 'object' && (apiMetadata as { compatible?: unknown }).compatible === false) {
        compatible = false;
        reasons.push('provider API 契约不兼容。');
      }
      const quotaDetails = providerHealth.metadata?.quotaDetails;
      if (quotaDetails && typeof quotaDetails === 'object' && (quotaDetails as { quotaStatus?: unknown }).quotaStatus === 'INSUFFICIENT') {
        compatible = false;
        const remaining = (quotaDetails as { remainingGpuSeconds?: unknown }).remainingGpuSeconds;
        const required = (quotaDetails as { estimatedRequiredGpuSeconds?: unknown }).estimatedRequiredGpuSeconds;
        reasons.push(`免费额度不足：预计 ${String(required ?? '未知')}s，剩余 ${String(remaining ?? '未知')}s。`);
      }
      if (providerHealth.metadata?.quota === 'EXHAUSTED') { compatible = false; reasons.push('免费额度已耗尽。'); }
      if (!this.breaker.canRequest(provider.providerId)) { compatible = false; reasons.push('Circuit breaker 暂时打开。'); }
      if (request.requestedProviderId && provider.providerId !== request.requestedProviderId) { compatible = false; reasons.push('不符合手动 provider 选择。'); }
      candidates.push({ provider, health: providerHealth, cost, compatible, reasons });
      this.log('compute.cost.estimated', { requestId: request.requestId, provider: provider.providerId, rawCostUsd: cost.rawCostUsd, confidence: cost.confidence, source: cost.source });
    }

    const api = candidates.find(candidate => candidate.provider.costClass === 'API' && candidate.compatible) || null;
    for (const candidate of candidates) {
      if (!candidate.compatible || candidate.provider.costClass === 'API') continue;
      if (candidate.provider.creditBacked) {
        candidate.reasons.push('FREE_FIRST credit-backed provider 不计入 API 付费成本比较；实际额度仍需运行时验证。');
        continue;
      }
      const guard = passesApiCostGuard(candidate, api, this.config);
      if (!guard.allowed) { candidate.compatible = false; candidate.rejectedReason = 'NEVER_PAY_MORE_THAN_API'; candidate.reasons.push(guard.reason); }
      else candidate.reasons.push(guard.reason);
    }

    const compatible = candidates.filter(candidate => candidate.compatible);
    const maxCostUsd = request.maxCostUsd;
    const withinBudget = maxCostUsd === null
      ? compatible
      : compatible.filter(candidate => {
        const estimate = candidate.cost.effectiveCostUsd ?? candidate.cost.rawCostUsd;
        return estimate === null || estimate <= maxCostUsd;
      });
    const budgetExceeded = compatible.length > 0 && withinBudget.length === 0;
    const selectable = budgetExceeded ? [] : withinBudget;
    const mode = request.generationMode;
    let selected: ProviderCandidate | null = null;
    if (mode === 'CUSTOM') {
      selected = request.requestedProviderId
        ? selectable.find(candidate => candidate.provider.providerId === request.requestedProviderId) || null
        : selectable.find(candidate => modelMatches(candidate.provider, request.model)) || null;
    } else if (mode === 'FREE_FIRST') {
      selected = [...selectable].sort(freeFirstCompare)[0] || null;
    } else if (mode === 'LOWEST_COST') {
      selected = [...selectable].sort((a, b) => comparableCost(a) - comparableCost(b) || latency(a) - latency(b))[0] || null;
    } else if (mode === 'FASTEST') {
      selected = [...selectable].sort((a, b) => latency(a) - latency(b) || comparableCost(a) - comparableCost(b))[0] || null;
    } else if (mode === 'BEST_QUALITY') {
      selected = [...selectable].sort((a, b) => Number(b.provider.hardwareProfile.productionEligible) - Number(a.provider.hardwareProfile.productionEligible) || Number(b.provider.costClass === 'API') - Number(a.provider.costClass === 'API') || comparableCost(a) - comparableCost(b))[0] || null;
    } else {
      selected = [...selectable].sort(freeFirstCompare)[0] || null;
    }

    if (mode === 'CUSTOM' && !request.requestedProviderId && !request.model) throw new ComputeRequestError('CUSTOM 模式需要 providerId 或 model。');
    const fallbackChain = selected ? [selected, ...selectable.filter(candidate => candidate.provider.providerId !== selected?.provider.providerId).sort(freeFirstCompare).slice(0, this.config.maxFallbacks)].map(candidate => candidate.provider.providerId) : [];
    const routingReason = budgetExceeded
      ? '所有可用 provider 的预计成本均超过 maxCostUsd，未提交任务。'
      : selected
        ? `${mode}：在兼容、健康且通过 API 成本保护的 provider 中选择 ${selected.provider.displayName}。`
        : '没有同时满足 workflow、模型、健康状态和权限配置的 provider。';
    this.log('compute.route', { requestId: request.requestId, mode, selectedProvider: selected?.provider.providerId || null, fallbackChain, budgetExceeded, dryRun: this.config.dryRun });
    return {
      schemaVersion: 'compute-broker.v1',
      requestId: request.requestId,
      selectedProviderId: selected?.provider.providerId || null,
      estimatedCostUsd: selected?.cost.rawCostUsd ?? null,
      effectiveCostUsd: selected?.cost.effectiveCostUsd ?? null,
      routingReason,
      fallbackChain,
      candidates,
      budgetExceeded,
      dryRun: this.config.dryRun,
    };
  }

  async submit(request: VideoGenerationRequest, context: { authorization?: string | null } = {}): Promise<ComputeResponse> {
    const plan = await this.plan(request, context);
    if (!plan.selectedProviderId) {
      const reason: FailureReason = plan.budgetExceeded ? 'BUDGET_EXCEEDED' : 'PROVIDER_NOT_CONFIGURED';
      throw new ProviderError(plan.routingReason, reason, false);
    }
    const createdAt = now();
    const job: ComputeJob = {
      jobId: crypto.randomUUID(), requestId: request.requestId, requestedProviderId: request.requestedProviderId, selectedProviderId: plan.selectedProviderId,
      fallbackChain: plan.fallbackChain, attempts: 0, status: 'QUEUED', estimatedCostUsd: plan.estimatedCostUsd, actualCostUsd: null,
      createdAt, startedAt: null, finishedAt: null, providerTaskId: null, output: null, error: null,
    };
    await this.store.create(job);
    this.log('compute.request', { requestId: request.requestId, jobId: job.jobId, workflow: request.workflow, generationMode: request.generationMode, dryRun: this.config.dryRun });
    if (this.config.dryRun) {
      return { jobId: job.jobId, selectedProvider: plan.selectedProviderId, estimatedCostUsd: plan.estimatedCostUsd, routingReason: plan.routingReason, status: 'QUEUED', fallbackChain: plan.fallbackChain, dryRun: true, job };
    }

    await this.store.update(job.jobId, { status: 'ROUTING', startedAt: now() });
    let latest = await this.store.get(job.jobId) || job;
    for (const providerId of plan.fallbackChain) {
      const provider = this.registry.get(providerId);
      if (!provider) continue;
      latest = await this.store.update(job.jobId, { status: providerId === plan.selectedProviderId ? 'STARTING_PROVIDER' : 'FALLBACK', selectedProviderId: providerId, attempts: latest.attempts + 1 }) || latest;
      try {
        this.log('compute.provider.selected', { requestId: request.requestId, jobId: job.jobId, provider: providerId, attempt: latest.attempts });
        const providerJob = await provider.submitJob(request, context);
        latest = await this.store.update(job.jobId, { status: 'RUNNING', providerTaskId: providerJob.providerTaskId }) || latest;
        this.log('compute.job.started', { requestId: request.requestId, jobId: job.jobId, provider: providerId, providerTaskId: providerJob.providerTaskId });
        const output = provider.normalizeResult(providerJob);
        if (output.state === 'SUCCEEDED') {
          this.breaker.recordSuccess(providerId);
          latest = await this.store.update(job.jobId, { status: 'SUCCEEDED', output, finishedAt: now() }) || latest;
          this.log('compute.cost.actual', { requestId: request.requestId, jobId: job.jobId, provider: providerId, actualCostUsd: null, source: 'UNKNOWN', success: true });
          this.log('compute.job.completed', { requestId: request.requestId, jobId: job.jobId, provider: providerId, success: true });
          return { jobId: latest.jobId, selectedProvider: latest.selectedProviderId, estimatedCostUsd: plan.estimatedCostUsd, routingReason: plan.routingReason, status: latest.status, fallbackChain: plan.fallbackChain, dryRun: false, job: latest };
        }
        throw new ProviderError(output.error?.message || 'Provider returned a failed state.', output.error?.reason || 'UNKNOWN_PROVIDER_ERROR', output.error?.retryable ?? true);
      } catch (error) {
        const providerError = error instanceof ProviderError ? error : new ProviderError('Provider execution failed.', 'UNKNOWN_PROVIDER_ERROR', true);
        const quotaBlocked = providerError.reason === 'HF_ZERO_GPU_QUOTA_EXHAUSTED';
        // A quota admission refusal is a resource state, not a model/provider
        // failure. It must not open the circuit or trigger fallback spending.
        if (!quotaBlocked) this.breaker.recordFailure(providerId);
        this.log('compute.provider.failed', { requestId: request.requestId, jobId: job.jobId, provider: providerId, reason: providerError.reason, retryable: providerError.retryable, failureClass: quotaBlocked ? 'RESOURCE_QUOTA' : undefined, countsTowardModelFailureRate: quotaBlocked ? false : undefined });
        const hasFallback = !quotaBlocked && providerError.retryable && plan.fallbackChain.indexOf(providerId) < plan.fallbackChain.length - 1;
        if (hasFallback) {
          latest = await this.store.update(job.jobId, { status: 'RETRYING', error: { reason: providerError.reason, message: providerError.message, retryable: true, details: providerError.details } }) || latest;
          latest = await this.store.update(job.jobId, { status: 'FALLBACK', error: { reason: providerError.reason, message: providerError.message, retryable: true, details: providerError.details } }) || latest;
          this.log('compute.fallback', { requestId: request.requestId, jobId: job.jobId, from: providerId });
          continue;
        }
        this.log('compute.cost.actual', { requestId: request.requestId, jobId: job.jobId, provider: providerId, actualCostUsd: null, source: 'UNKNOWN', success: false, failureReason: providerError.reason, failureClass: quotaBlocked ? 'RESOURCE_QUOTA' : undefined, countsTowardModelFailureRate: quotaBlocked ? false : undefined });
        latest = await this.store.update(job.jobId, { status: 'FAILED', error: { reason: providerError.reason, message: providerError.message, retryable: providerError.retryable, details: providerError.details }, finishedAt: now() }) || latest;
        return { jobId: latest.jobId, selectedProvider: latest.selectedProviderId, estimatedCostUsd: plan.estimatedCostUsd, routingReason: plan.routingReason, status: latest.status, fallbackChain: plan.fallbackChain, dryRun: false, job: latest };
      }
    }
    latest = await this.store.update(job.jobId, { status: 'FAILED', error: { reason: 'PROVIDER_DOWN', message: '所有 provider 均不可用。', retryable: true }, finishedAt: now() }) || latest;
    return { jobId: latest.jobId, selectedProvider: latest.selectedProviderId, estimatedCostUsd: plan.estimatedCostUsd, routingReason: plan.routingReason, status: latest.status, fallbackChain: plan.fallbackChain, dryRun: false, job: latest };
  }

  async getJob(jobId: string) { return this.store.get(jobId); }

  async cancel(jobId: string, context: { authorization?: string | null } = {}) {
    const job = await this.store.get(jobId);
    if (!job) return null;
    if (terminalStates.has(job.status)) return job;
    const provider = job.selectedProviderId ? this.registry.get(job.selectedProviderId) : null;
    if (provider && job.providerTaskId) await provider.cancelJob(job.providerTaskId, context).catch(() => undefined);
    return this.store.update(jobId, { status: 'CANCELLED', finishedAt: now(), error: { reason: 'USER_CANCELLED', message: '任务由用户取消。', retryable: false } });
  }
}

export function createComputeBroker() { return new ComputeBroker(); }

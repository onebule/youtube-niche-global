import { estimateConfiguredCost } from './cost.ts';
import { H3_HARDWARE_PROFILES } from './config.ts';
import { ProviderError, type ProviderHealth, type ProviderJob, type VideoComputeProvider, type VideoGenerationRequest, type Workflow } from './types.ts';

const now = () => new Date().toISOString();

export type MockProviderOptions = {
  providerId: string;
  displayName?: string;
  providerType?: VideoComputeProvider['providerType'];
  costClass?: VideoComputeProvider['costClass'];
  creditBacked?: boolean;
  costPerSecondUsd?: number | null;
  health?: ProviderHealth['state'];
  modelState?: ProviderHealth['modelState'];
  latencyMs?: number | null;
  success?: boolean;
  failureReason?: ProviderError['reason'];
  supportedModels?: string[];
  supportedWorkflows?: Workflow[];
};

export class MockVideoComputeProvider implements VideoComputeProvider {
  readonly providerId: string;
  readonly displayName: string;
  readonly providerType: VideoComputeProvider['providerType'];
  readonly costClass: VideoComputeProvider['costClass'];
  readonly creditBacked: boolean;
  readonly supportedModels: string[];
  readonly supportedWorkflows: Workflow[];
  readonly hardwareProfile = H3_HARDWARE_PROFILES.H3_ECO;
  readonly calls = { health: 0, estimate: 0, submit: 0, status: 0, cancel: 0 };
  private readonly options: MockProviderOptions;

  constructor(options: MockProviderOptions) {
    this.options = options;
    this.providerId = options.providerId;
    this.displayName = options.displayName || options.providerId;
    this.providerType = options.providerType || 'API';
    this.costClass = options.costClass || (this.providerType === 'API' ? 'API' : 'CHEAP_GPU');
    this.creditBacked = options.creditBacked ?? this.costClass === 'FREE_CREDIT';
    this.supportedModels = options.supportedModels || ['MiniMax-H3', 'minimax-h3'];
    this.supportedWorkflows = options.supportedWorkflows || ['T2V', 'I2V', 'FL2V', 'REF2V'];
  }

  async healthCheck() {
    this.calls.health += 1;
    return { state: this.options.health || 'AVAILABLE', checkedAt: now(), latencyMs: this.options.latencyMs ?? null, modelState: this.options.modelState || 'UNKNOWN', reason: null } satisfies ProviderHealth;
  }

  async estimateCost(request: VideoGenerationRequest) {
    this.calls.estimate += 1;
    return estimateConfiguredCost(request, this.options.costPerSecondUsd ?? null, this.options.costPerSecondUsd === null || this.options.costPerSecondUsd === undefined ? 'UNKNOWN' : 'BENCHMARK', 'Mock provider cost for deterministic tests.');
  }

  async submitJob(): Promise<ProviderJob> {
    this.calls.submit += 1;
    if (this.options.success === false) {
      const reason = this.options.failureReason || 'PROVIDER_DOWN';
      const retryable = !['INVALID_INPUT', 'UNSUPPORTED_WORKFLOW', 'CONTENT_POLICY', 'AUTH_ERROR', 'USER_CANCELLED'].includes(reason);
      throw new ProviderError(`Mock ${this.providerId} failure.`, reason, retryable);
    }
    return { providerTaskId: `mock-task-${this.providerId}-${this.calls.submit}`, state: 'SUCCEEDED', submittedAt: now(), processingAt: now(), completedAt: now(), output: { url: null, assetId: `mock-output-${this.calls.submit}`, contentType: 'video/mp4' }, raw: { mock: true } };
  }

  async getJobStatus(providerTaskId: string) {
    this.calls.status += 1;
    return { providerTaskId, state: 'SUCCEEDED', submittedAt: now(), processingAt: now(), completedAt: now(), output: { url: null, assetId: 'mock-output', contentType: 'video/mp4' }, raw: { mock: true } } satisfies ProviderJob;
  }

  async cancelJob() { this.calls.cancel += 1; return true; }

  normalizeResult(job: ProviderJob) { return { state: job.state, outputUrl: job.output?.url || null, outputAssetId: job.output?.assetId || null, providerTaskId: job.providerTaskId, error: null }; }
}

/**
 * Phase 1 compute contracts. These types are deliberately independent from
 * Canvas and the legacy video-generation gateway so the new broker can be
 * enabled or removed without changing existing product behaviour.
 */

export const COMPUTE_BROKER_SCHEMA_VERSION = 'compute-broker.v1';

export type ProviderType = 'LOCAL_GPU' | 'FREE_GPU' | 'SPOT_GPU' | 'API' | 'MODAL_GPU' | 'CHEAP_GPU';
export type ProviderCostClass = 'FREE_CREDIT' | 'CHEAP_GPU' | 'API';
export type Workflow = 'T2V' | 'I2V' | 'FL2V' | 'REF2V';
export type QualityPreset = 'DRAFT' | 'FINAL';
export type GenerationMode = 'AUTO' | 'FREE_FIRST' | 'LOWEST_COST' | 'FASTEST' | 'BEST_QUALITY' | 'CUSTOM';
export type HardwareProfileId = 'H3_ULTRA' | 'H3_HIGH' | 'H3_ECO' | 'H3_SURVIVAL';
export type ProviderHealthState = 'AVAILABLE' | 'DEGRADED' | 'OFFLINE' | 'NOT_CONFIGURED' | 'UNKNOWN';
export type ProviderJobState = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNKNOWN';
export type JobStatus = 'QUEUED' | 'ROUTING' | 'STARTING_PROVIDER' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'RETRYING' | 'FALLBACK';

export type FailureReason =
  | 'NO_CAPACITY'
  | 'CREDIT_EXHAUSTED'
  | 'GPU_OOM'
  | 'PROVIDER_DOWN'
  | 'START_TIMEOUT'
  | 'INFERENCE_TIMEOUT'
  | 'INTERRUPTED'
  | 'INVALID_INPUT'
  | 'UNSUPPORTED_WORKFLOW'
  | 'CONTENT_POLICY'
  | 'AUTH_ERROR'
  | 'USER_CANCELLED'
  | 'BUDGET_EXCEEDED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'UNKNOWN_PROVIDER_ERROR';

export type AssetInputs = {
  startImage?: string | null;
  endImage?: string | null;
  referenceImages?: string[];
  referenceVideo?: string | null;
  referenceAudio?: string | null;
};

export type VideoGenerationRequest = {
  requestId: string;
  model: string | null;
  workflow: Workflow;
  generationMode: GenerationMode;
  prompt: string;
  negativePrompt: string | null;
  assets: AssetInputs;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  steps: number | null;
  seed: number | null;
  audio: boolean;
  qualityPreset: QualityPreset;
  maxCostUsd: number | null;
  requestedProviderId: string | null;
  deadlineMs: number | null;
};

export type H3HardwareProfile = {
  id: HardwareProfileId;
  vramGb: { min: number; target: number | null };
  systemRamGb: { min: number; target: number | null };
  precision: string[];
  offload: string[];
  productionEligible: boolean;
  calibrationStatus: 'CALIBRATION_REQUIRED' | 'VERIFIED';
};

export type ProviderHealth = {
  state: ProviderHealthState;
  checkedAt: string;
  latencyMs: number | null;
  modelState: 'MODEL_READY' | 'MODEL_LOADING' | 'MODEL_MISSING' | 'UNKNOWN';
  reason: string | null;
};

export type CostEstimate = {
  rawCostUsd: number | null;
  effectiveCostUsd: number | null;
  successRate: number | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: 'ENVIRONMENT' | 'BENCHMARK' | 'TELEMETRY' | 'UNKNOWN';
  notes: string[];
};

export type ProviderJob = {
  providerTaskId: string;
  state: ProviderJobState;
  submittedAt: string;
  processingAt: string | null;
  completedAt: string | null;
  output: { url: string | null; assetId: string | null; contentType: string | null } | null;
  raw: Record<string, unknown> | null;
};

export type NormalizedProviderResult = {
  state: ProviderJobState;
  outputUrl: string | null;
  outputAssetId: string | null;
  providerTaskId: string | null;
  error: { reason: FailureReason; message: string; retryable: boolean } | null;
};

export type VideoComputeProvider = {
  providerId: string;
  displayName: string;
  providerType: ProviderType;
  costClass: ProviderCostClass;
  creditBacked: boolean;
  supportedModels: string[];
  supportedWorkflows: Workflow[];
  hardwareProfile: H3HardwareProfile;
  healthCheck: (context?: { dryRun?: boolean; authorization?: string | null }) => Promise<ProviderHealth>;
  estimateCost: (request: VideoGenerationRequest) => Promise<CostEstimate>;
  submitJob: (request: VideoGenerationRequest, context?: { authorization?: string | null }) => Promise<ProviderJob>;
  getJobStatus: (providerTaskId: string, context?: { authorization?: string | null }) => Promise<ProviderJob>;
  cancelJob: (providerTaskId: string, context?: { authorization?: string | null }) => Promise<boolean>;
  normalizeResult: (job: ProviderJob) => NormalizedProviderResult;
};

export type ProviderCandidate = {
  provider: VideoComputeProvider;
  health: ProviderHealth;
  cost: CostEstimate;
  compatible: boolean;
  reasons: string[];
  rejectedReason?: string;
};

export type ComputeRoutePlan = {
  schemaVersion: typeof COMPUTE_BROKER_SCHEMA_VERSION;
  requestId: string;
  selectedProviderId: string | null;
  estimatedCostUsd: number | null;
  effectiveCostUsd: number | null;
  routingReason: string;
  fallbackChain: string[];
  candidates: ProviderCandidate[];
  budgetExceeded: boolean;
  dryRun: boolean;
};

export type ComputeJob = {
  jobId: string;
  requestId: string;
  requestedProviderId: string | null;
  selectedProviderId: string | null;
  fallbackChain: string[];
  attempts: number;
  status: JobStatus;
  estimatedCostUsd: number | null;
  actualCostUsd: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  providerTaskId: string | null;
  output: NormalizedProviderResult | null;
  error: { reason: FailureReason; message: string; retryable: boolean } | null;
};

export type ComputeResponse = {
  jobId: string;
  selectedProvider: string | null;
  estimatedCostUsd: number | null;
  routingReason: string;
  status: JobStatus;
  fallbackChain: string[];
  dryRun: boolean;
  job: ComputeJob;
};

export type ComputeJobStore = {
  create: (job: ComputeJob) => Promise<ComputeJob>;
  get: (jobId: string) => Promise<ComputeJob | null>;
  update: (jobId: string, patch: Partial<ComputeJob>) => Promise<ComputeJob | null>;
};

export class ProviderError extends Error {
  readonly reason: FailureReason;
  readonly retryable: boolean;
  readonly status?: number;
  constructor(
    message: string,
    reason: FailureReason,
    retryable: boolean,
    status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.reason = reason;
    this.retryable = retryable;
    this.status = status;
  }
}

export class ComputeRequestError extends Error {
  readonly reason: FailureReason;
  constructor(message: string, reason: FailureReason = 'INVALID_INPUT') {
    super(message);
    this.name = 'ComputeRequestError';
    this.reason = reason;
  }
}

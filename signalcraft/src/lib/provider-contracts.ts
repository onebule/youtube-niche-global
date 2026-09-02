/**
 * P4 Phase 4.5 — grounded provider and model contracts.
 *
 * The repository exposes an internal video proxy, not a direct MiniMax or
 * Seedance integration. This module records only what the repository wrapper
 * and the read-only model discovery response can prove. Provider generation
 * submission, polling and downstream schemas remain explicitly unknown.
 */
import type { CapabilityKey, CapabilityVerification, ModelAvailability, ModelDefinition } from './provider-routing.ts';

export const PROVIDER_CONTRACT_VERSION = 'video-gateway-contract-v1';
export const MODEL_CONTRACT_VERSION = 'video-gateway-model-contract-v1';
export const PROVIDER_VERIFICATION_VERSION = 'provider-verification-v1';
export const VIDEO_PROXY_ROUTE = '/api/video/[...path]';
export const VIDEO_PROXY_BASE_URL = 'https://youtube-niche-global-api.vercel.app/api/video';

export type IntegrationType = 'DIRECT_PROVIDER' | 'GATEWAY' | 'AGGREGATOR' | 'INTERNAL_PROXY' | 'UNKNOWN';
export type ContractEvidenceState = 'VERIFIED' | 'CONFIGURED' | 'UNVERIFIED' | 'UNKNOWN' | 'UNSUPPORTED';
export type ProviderConfigurationSource = 'REPOSITORY_CONFIG' | 'ENVIRONMENT_NAME' | 'READ_ONLY_GATEWAY_RESPONSE' | 'OFFICIAL_PROVIDER_CONFIG' | 'UNKNOWN';
export type ExecutionReadiness = 'READY_FOR_EXECUTION_INTEGRATION' | 'READY_WITH_CAUTION' | 'NEEDS_SCHEMA_VERIFICATION' | 'NEEDS_PROVIDER_CONFIGURATION' | 'BLOCKED' | 'INSUFFICIENT';
export type ProviderTaskStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNKNOWN';
export type RetryDisposition = 'RETRYABLE' | 'NON_RETRYABLE' | 'UNKNOWN';

export type ProviderOperationContract = {
  operation: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'UNKNOWN';
  path: string;
  requestSchema: ContractEvidenceState;
  responseSchema: ContractEvidenceState;
  state: ContractEvidenceState;
  sourceReference: string;
  notes: string[];
};

export type ProviderTaskLifecycleContract = {
  state: ContractEvidenceState;
  submissionOperation: string;
  statusOperation: string;
  taskIdField: string | null;
  statusField: string | null;
  mappings: Array<{ providerState: string; canonicalState: ProviderTaskStatus; state: ContractEvidenceState }>;
  pollingLiveTested: false;
  notes: string[];
};

export type ProviderAuthenticationContract = {
  state: ContractEvidenceState;
  mechanism: 'BEARER_FORWARD_IF_PRESENT' | 'SERVER_SIDE_SECRET' | 'UNKNOWN';
  clientBoundary: 'BROWSER_SESSION_TO_INTERNAL_PROXY' | 'SERVER_ONLY' | 'UNKNOWN';
  credentialNames: string[];
  secretExposure: 'NOT_EXPOSED' | 'UNKNOWN';
};

export type ProviderAssetInputContract = {
  state: ContractEvidenceState;
  representation: 'PRIVATE_ASSET_ID_WITH_UPLOAD_INTENT' | 'URL' | 'FILE' | 'BASE64' | 'UNKNOWN';
  formats: string[];
  maxBytes: number | null;
  maxReferenceCount: number | null;
  notes: string[];
};

export type ProviderResponseContract = {
  state: ContractEvidenceState;
  envelopes: Array<{ operation: string; rootField: string; fields: string[]; sourceReference: string }>;
  outputRepresentation: 'PRIVATE_ASSET_URL' | 'URL' | 'ASSET_ID' | 'FILE' | 'UNKNOWN';
  outputUrlExpiration: 'KNOWN' | 'UNKNOWN';
};

export type ProviderErrorContract = {
  state: ContractEvidenceState;
  categories: Array<{ category: string; retry: RetryDisposition; sourceReference: string | null }>;
  providerCodeField: string | null;
  providerMessageField: string | null;
};

export type ProviderContractProvenance = {
  sourceType: ProviderConfigurationSource;
  sourceReferences: string[];
  capturedAt: string | null;
  contractVersion: string;
  notes: string[];
};

export type ProviderContract = {
  providerId: string;
  contractVersion: string;
  integrationType: IntegrationType;
  baseUrlSource: ProviderConfigurationSource;
  baseUrl: string;
  operations: ProviderOperationContract[];
  taskLifecycle: ProviderTaskLifecycleContract;
  authentication: ProviderAuthenticationContract;
  assetInputs: ProviderAssetInputContract;
  responses: ProviderResponseContract;
  errors: ProviderErrorContract;
  verification: ContractEvidenceState;
  executionReadiness: ExecutionReadiness;
  provenance: ProviderContractProvenance;
};

export type VerifiedModelCapability = {
  providerId: string;
  modelId: string;
  capability: CapabilityKey;
  state: CapabilityVerification;
  sourceType: ProviderConfigurationSource;
  sourceReference: string | null;
  verifiedAt: string | null;
  contractVersion: string;
  notes: string[];
};

export type ModelContract = {
  providerId: string;
  modelId: string;
  displayName: string;
  actualRequestModelId: string;
  operations: Array<{ operation: string; state: ContractEvidenceState; sourceReference: string | null }>;
  capabilities: VerifiedModelCapability[];
  inputConstraints: { referenceCount: number | null; durationSeconds: { min: number | null; max: number | null }; aspectRatios: string[]; resolutions: string[] };
  outputConstraints: { type: 'IMAGE' | 'VIDEO' | 'UNKNOWN'; representation: string; expiration: 'KNOWN' | 'UNKNOWN' };
  availability: ModelAvailability;
  verification: CapabilityVerification;
  executionReadiness: ExecutionReadiness;
  provenance: { sourceType: ProviderConfigurationSource; sourceReferences: string[]; capturedAt: string | null; contractVersion: string; notes: string[] };
};

export type ProviderVerificationReport = {
  schemaVersion: typeof PROVIDER_VERIFICATION_VERSION;
  contractVersion: typeof PROVIDER_CONTRACT_VERSION;
  modelContractVersion: typeof MODEL_CONTRACT_VERSION;
  contracts: ProviderContract[];
  models: ModelContract[];
  coverage: { verified: number; configured: number; unverified: number; unknown: number; unsupported: number };
  executionReadiness: Array<{ providerId: string; modelId: string; state: ExecutionReadiness; blockers: string[] }>;
  provenance: { source: 'READ_ONLY_REPOSITORY_AND_GATEWAY_AUDIT'; capturedAt: string | null; sourceReferences: string[] };
};

/** Sanitized read-only response captured from GET /api/video/models. */
export const VIDEO_MODEL_DISCOVERY_FIXTURE = Object.freeze({
  capturedAt: '2026-09-02T00:00:00.000Z',
  source: `${VIDEO_PROXY_BASE_URL}/models`,
  models: [
    { id: 'seedance-2', provider: 'seedance', enabled: false, reason: 'AI 图生视频当前仅向 Team 成员开放。' },
    { id: 'seedance-2-5', provider: 'seedance', enabled: false, reason: 'AI 图生视频当前仅向 Team 成员开放。' },
    { id: 'minimax-h3', provider: 'minimax', enabled: false, reason: 'AI 图生视频当前仅向 Team 成员开放。' },
  ],
});

const capabilityKeys: CapabilityKey[] = ['TEXT_TO_IMAGE', 'REFERENCE_IMAGE', 'IMAGE_EDIT', 'MULTI_REFERENCE', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'VIDEO_CONTINUATION', 'START_FRAME', 'END_FRAME', 'REFERENCE_VIDEO', 'IDENTITY_REFERENCE', 'STYLE_REFERENCE', 'EXACT_TEXT', 'TRANSPARENT_BACKGROUND', 'AUDIO'];

const sourceReference = `${VIDEO_PROXY_ROUTE} + src/lib/video-generation.ts`;

export const VIDEO_GATEWAY_CONTRACT: ProviderContract = {
  providerId: 'video-gateway',
  contractVersion: PROVIDER_CONTRACT_VERSION,
  integrationType: 'INTERNAL_PROXY',
  baseUrlSource: 'REPOSITORY_CONFIG',
  baseUrl: VIDEO_PROXY_BASE_URL,
  operations: [
    { operation: 'MODEL_DISCOVERY', method: 'GET', path: '/models', requestSchema: 'CONFIGURED', responseSchema: 'CONFIGURED', state: 'CONFIGURED', sourceReference, notes: ['只读模型发现响应可复现；不等同于下游 provider schema。'] },
    { operation: 'IMAGE_MODEL_DISCOVERY', method: 'GET', path: '/image-models', requestSchema: 'CONFIGURED', responseSchema: 'CONFIGURED', state: 'CONFIGURED', sourceReference, notes: ['匿名请求返回 401；下游模型合同未验证。'] },
    { operation: 'VIDEO_SUBMISSION', method: 'POST', path: '/generate', requestSchema: 'CONFIGURED', responseSchema: 'UNKNOWN', state: 'UNVERIFIED', sourceReference, notes: ['客户端请求类型存在，但下游 provider 请求/响应 schema 未在仓库中出现。'] },
    { operation: 'VIDEO_STATUS', method: 'GET', path: '/status?generationId=', requestSchema: 'CONFIGURED', responseSchema: 'UNKNOWN', state: 'UNVERIFIED', sourceReference, notes: ['客户端声明 canonical status，但没有可验证的下游状态契约。'] },
    { operation: 'VIDEO_CANCEL', method: 'POST', path: '/cancel', requestSchema: 'CONFIGURED', responseSchema: 'UNKNOWN', state: 'UNVERIFIED', sourceReference, notes: ['未执行真实取消请求。'] },
    { operation: 'VIDEO_OUTPUT', method: 'GET', path: '/asset-url?assetId=', requestSchema: 'CONFIGURED', responseSchema: 'UNKNOWN', state: 'UNVERIFIED', sourceReference, notes: ['输出 URL 由内部媒体边界返回；过期时间未知。'] },
  ],
  taskLifecycle: {
    state: 'UNVERIFIED', submissionOperation: 'VIDEO_SUBMISSION', statusOperation: 'VIDEO_STATUS', taskIdField: 'generation.providerTaskId', statusField: 'generation.status',
    mappings: [
      { providerState: 'queued', canonicalState: 'QUEUED', state: 'CONFIGURED' },
      { providerState: 'processing', canonicalState: 'PROCESSING', state: 'CONFIGURED' },
      { providerState: 'completed', canonicalState: 'SUCCEEDED', state: 'CONFIGURED' },
      { providerState: 'failed', canonicalState: 'FAILED', state: 'CONFIGURED' },
      { providerState: '*', canonicalState: 'UNKNOWN', state: 'UNKNOWN' },
    ],
    pollingLiveTested: false,
    notes: ['这些是仓库客户端可接受的状态，不证明下游 provider 原始状态值。'],
  },
  authentication: { state: 'CONFIGURED', mechanism: 'BEARER_FORWARD_IF_PRESENT', clientBoundary: 'BROWSER_SESSION_TO_INTERNAL_PROXY', credentialNames: ['authorization'], secretExposure: 'NOT_EXPOSED' },
  assetInputs: { state: 'CONFIGURED', representation: 'PRIVATE_ASSET_ID_WITH_UPLOAD_INTENT', formats: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/wav', 'audio/mpeg'], maxBytes: null, maxReferenceCount: null, notes: ['上传意图与签名 URL 由服务端返回；下游 provider 输入格式未知。'] },
  responses: { state: 'UNVERIFIED', envelopes: [{ operation: 'MODEL_DISCOVERY', rootField: 'models', fields: ['id', 'provider', 'enabled', 'reason'], sourceReference: `${VIDEO_PROXY_BASE_URL}/models` }, { operation: 'VIDEO_SUBMISSION', rootField: 'generation', fields: ['id', 'providerTaskId', 'status', 'videoAssetId', 'errorCode'], sourceReference }], outputRepresentation: 'PRIVATE_ASSET_URL', outputUrlExpiration: 'UNKNOWN' },
  errors: { state: 'UNVERIFIED', categories: [{ category: 'AUTHENTICATION_ERROR', retry: 'NON_RETRYABLE', sourceReference: sourceReference }, { category: 'INVALID_REQUEST', retry: 'NON_RETRYABLE', sourceReference: sourceReference }, { category: 'NETWORK_ERROR', retry: 'UNKNOWN', sourceReference: sourceReference }, { category: 'UNKNOWN_PROVIDER_ERROR', retry: 'UNKNOWN', sourceReference: null }], providerCodeField: 'error.code', providerMessageField: 'error.message' },
  verification: 'CONFIGURED',
  executionReadiness: 'NEEDS_SCHEMA_VERIFICATION',
  provenance: { sourceType: 'REPOSITORY_CONFIG', sourceReferences: [VIDEO_PROXY_ROUTE, 'src/lib/video-generation.ts', VIDEO_MODEL_DISCOVERY_FIXTURE.source], capturedAt: VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt, contractVersion: PROVIDER_CONTRACT_VERSION, notes: ['内部代理路径已识别；下游 provider topology 仍未知。'] },
};

function modelContract(item: typeof VIDEO_MODEL_DISCOVERY_FIXTURE.models[number]): ModelContract {
  const capabilities = capabilityKeys.map(capability => ({ providerId: item.provider || 'unknown', modelId: item.id, capability, state: 'UNKNOWN' as const, sourceType: 'READ_ONLY_GATEWAY_RESPONSE' as const, sourceReference: VIDEO_MODEL_DISCOVERY_FIXTURE.source, verifiedAt: null, contractVersion: MODEL_CONTRACT_VERSION, notes: ['模型发现响应没有声明该能力。'] }));
  return { providerId: item.provider || 'unknown', modelId: item.id, displayName: item.id === 'minimax-h3' ? 'MiniMax H3' : item.id === 'seedance-2-5' ? 'Seedance 2.5' : 'Seedance 2.0', actualRequestModelId: item.id, operations: [{ operation: 'IMAGE_TO_VIDEO', state: 'CONFIGURED', sourceReference: sourceReference }], capabilities, inputConstraints: { referenceCount: null, durationSeconds: { min: null, max: null }, aspectRatios: [], resolutions: [] }, outputConstraints: { type: 'VIDEO', representation: 'UNKNOWN', expiration: 'UNKNOWN' }, availability: item.enabled ? 'AVAILABLE' : 'DISABLED', verification: 'CONFIGURED', executionReadiness: 'NEEDS_SCHEMA_VERIFICATION', provenance: { sourceType: 'READ_ONLY_GATEWAY_RESPONSE', sourceReferences: [VIDEO_MODEL_DISCOVERY_FIXTURE.source], capturedAt: VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt, contractVersion: MODEL_CONTRACT_VERSION, notes: [item.reason] } };
}

export const VERIFIED_MODEL_CONTRACTS: ModelContract[] = VIDEO_MODEL_DISCOVERY_FIXTURE.models.map(modelContract);

export function buildProviderVerificationReport(capturedAt: string | null = VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt): ProviderVerificationReport {
  const states = VERIFIED_MODEL_CONTRACTS.flatMap(model => model.capabilities.map(capability => capability.state));
  const coverage = { VERIFIED: 0, CONFIGURED: 0, UNVERIFIED: 0, UNKNOWN: 0, UNSUPPORTED: 0 } as Record<CapabilityVerification, number>;
  states.forEach(state => { coverage[state] += 1; });
  return { schemaVersion: PROVIDER_VERIFICATION_VERSION, contractVersion: PROVIDER_CONTRACT_VERSION, modelContractVersion: MODEL_CONTRACT_VERSION, contracts: [VIDEO_GATEWAY_CONTRACT], models: VERIFIED_MODEL_CONTRACTS, coverage: { verified: coverage.VERIFIED, configured: coverage.CONFIGURED, unverified: coverage.UNVERIFIED, unknown: coverage.UNKNOWN, unsupported: coverage.UNSUPPORTED }, executionReadiness: VERIFIED_MODEL_CONTRACTS.map(model => ({ providerId: model.providerId, modelId: model.modelId, state: model.executionReadiness, blockers: ['下游提交/响应/状态/错误 Schema 尚未验证', ...(model.availability === 'DISABLED' ? ['网关当前将模型标记为 disabled'] : [])] })), provenance: { source: 'READ_ONLY_REPOSITORY_AND_GATEWAY_AUDIT', capturedAt, sourceReferences: [VIDEO_PROXY_ROUTE, 'src/lib/video-generation.ts', VIDEO_MODEL_DISCOVERY_FIXTURE.source] } };
}

export function applyVerifiedModelDiscovery(registryModels: ModelDefinition[]): ModelDefinition[] {
  return registryModels.map(model => {
    const discovered = VERIFIED_MODEL_CONTRACTS.find(item => item.modelId === model.modelId);
    if (!discovered) return model;
    return { ...model, providerId: discovered.providerId, displayName: discovered.displayName, availability: discovered.availability, verification: discovered.verification, configurationVersion: MODEL_CONTRACT_VERSION };
  });
}

export function normalizeProviderVerificationReport(value: unknown): ProviderVerificationReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<ProviderVerificationReport>;
  return report.schemaVersion === PROVIDER_VERIFICATION_VERSION && report.contractVersion === PROVIDER_CONTRACT_VERSION && Array.isArray(report.models) && Array.isArray(report.contracts) ? report as ProviderVerificationReport : null;
}

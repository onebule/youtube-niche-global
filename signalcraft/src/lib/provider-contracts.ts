/**
 * P4 Phase 4.5 — grounded provider and model contracts.
 *
 * The repository exposes an internal video proxy. P4.5B grounds the local
 * gateway and its APIMart adapters from the backend source; access remains a
 * separate gate, so disabled models are never treated as executable.
 */
import type { CapabilityKey, CapabilitySupport, CapabilityVerification, ModelAvailability, ModelDefinition } from './provider-routing.ts';

export const PROVIDER_CONTRACT_VERSION = 'video-gateway-contract-v1';
export const MODEL_CONTRACT_VERSION = 'internal-proxy-contract-v1';
export const PROVIDER_VERIFICATION_VERSION = 'provider-verification-v1';
export const VIDEO_PROXY_ROUTE = '/api/video/[...path]';
export const VIDEO_PROXY_BASE_URL = 'https://youtube-niche-global-api.vercel.app/api/video';

export type IntegrationType = 'DIRECT_PROVIDER' | 'GATEWAY' | 'AGGREGATOR' | 'INTERNAL_PROXY' | 'UNKNOWN';
export type ContractEvidenceState = 'VERIFIED' | 'CONFIGURED' | 'UNVERIFIED' | 'UNKNOWN' | 'UNSUPPORTED';
export type ProviderConfigurationSource = 'REPOSITORY_CONFIG' | 'ENVIRONMENT_NAME' | 'READ_ONLY_GATEWAY_RESPONSE' | 'OFFICIAL_PROVIDER_CONFIG' | 'UNKNOWN';
export type ExecutionReadiness = 'READY_FOR_EXECUTION_INTEGRATION' | 'READY_WITH_CAUTION' | 'MODEL_DISABLED' | 'CONTRACT_UNVERIFIED' | 'NEEDS_SCHEMA_VERIFICATION' | 'NEEDS_PROVIDER_CONFIGURATION' | 'PROVIDER_UNCONFIGURED' | 'CAPABILITY_MISMATCH' | 'BLOCKED' | 'INSUFFICIENT';
export type ModelExecutionGate = 'EXECUTION_READY' | 'EXECUTION_READY_WITH_CAUTION' | 'MODEL_DISABLED' | 'CONTRACT_UNVERIFIED' | 'PROVIDER_UNCONFIGURED' | 'CAPABILITY_MISMATCH' | 'BLOCKED';
export type ExecutionGateSnapshot = { registered: boolean; configurationState: 'CONFIGURED' | 'NOT_CONFIGURED'; providerAuthState: 'CONFIGURED' | 'NOT_CONFIGURED' | 'UNKNOWN'; accessState: 'AUTHORIZED' | 'ACCESS_REQUIRED'; modelEnablementState: 'ENABLED' | 'DISABLED'; contractState: 'VERIFIED' | 'UNVERIFIED'; capabilityState: 'COMPATIBLE' | 'MISMATCH'; serializationState: 'VERIFIED' | 'UNVERIFIED'; executionState: ModelExecutionGate; executionPermission: 'SANDBOX_ONLY' | 'NO_EXECUTION'; smokeTestState: 'READY_FOR_MANUAL_SMOKE_TEST' | 'SMOKE_TEST_BLOCKED'; blockers: string[] };
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
  executionGate: ExecutionGateSnapshot;
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

export type InternalProxyContract = {
  contractId: string;
  contractVersion: string;
  basePath: string;
  downstreamProvider: 'APIMART' | 'UNKNOWN';
  operations: Array<{ name: string; method: string; path: string; request: string; response: string[]; state: ContractEvidenceState }>;
  taskLifecycle: { internalStates: string[]; providerTaskIdFields: string[]; unknownStatus: 'UNKNOWN'; internalGenerationId: string; statusPath: string };
  executionGate: ModelExecutionGate;
  provenance: ProviderContractProvenance;
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

const sourceReference = 'youtube-niche-global-api/vercel/api/video/[...path].js';
const apimartReference = 'youtube-niche-global-api/vercel/lib/video-generation/providers/apimart-client.js';
const minimaxReference = 'youtube-niche-global-api/vercel/lib/video-generation/providers/minimax-provider.js';
const seedanceReference = 'youtube-niche-global-api/vercel/lib/video-generation/providers/seedance-provider.js';

const capabilityEvidence: Record<string, Partial<Record<CapabilityKey, { state: CapabilityVerification; support: CapabilitySupport; note: string }>>> = {
  'minimax-h3': {
    IMAGE_TO_VIDEO: { state: 'VERIFIED', support: 'SUPPORTED', note: '首尾帧/全能参考序列化到 APIMart。' }, REFERENCE_IMAGE: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_urls。' }, MULTI_REFERENCE: { state: 'VERIFIED', support: 'SUPPORTED_WITH_LIMITS', note: '最多 9 张图片。' }, START_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'first_frame_image。' }, END_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'last_frame_image。' }, REFERENCE_VIDEO: { state: 'VERIFIED', support: 'SUPPORTED_WITH_LIMITS', note: '最多 3 个 video_urls。' }, AUDIO: { state: 'VERIFIED', support: 'SUPPORTED_WITH_LIMITS', note: '最多 3 个 audio_urls。' }, TEXT_TO_VIDEO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: '规范化输入仅允许 Veo 文生视频。' },
  },
  'seedance-2': {
    IMAGE_TO_VIDEO: { state: 'VERIFIED', support: 'SUPPORTED', note: '首尾帧序列化到 APIMart。' }, REFERENCE_IMAGE: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_urls。' }, MULTI_REFERENCE: { state: 'VERIFIED', support: 'SUPPORTED_WITH_LIMITS', note: '最多 9 张图片。' }, START_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_with_roles.first_frame。' }, END_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_with_roles.last_frame。' }, REFERENCE_VIDEO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: '规范化输入拒绝 Seedance 参考视频。' }, AUDIO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: 'generate_audio 固定为 false。' }, TEXT_TO_VIDEO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: '规范化输入仅允许 Veo 文生视频。' },
  },
  'seedance-2-5': {
    IMAGE_TO_VIDEO: { state: 'VERIFIED', support: 'SUPPORTED', note: '首尾帧序列化到 APIMart。' }, REFERENCE_IMAGE: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_urls。' }, MULTI_REFERENCE: { state: 'VERIFIED', support: 'SUPPORTED_WITH_LIMITS', note: '最多 9 张图片。' }, START_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_with_roles.first_frame。' }, END_FRAME: { state: 'VERIFIED', support: 'SUPPORTED', note: 'image_with_roles.last_frame。' }, REFERENCE_VIDEO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: '规范化输入拒绝 Seedance 参考视频。' }, AUDIO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: 'generate_audio 固定为 false。' }, TEXT_TO_VIDEO: { state: 'VERIFIED', support: 'UNSUPPORTED', note: '规范化输入仅允许 Veo 文生视频。' },
  },
};

export const VIDEO_GATEWAY_CONTRACT: ProviderContract = {
  providerId: 'video-gateway',
  contractVersion: PROVIDER_CONTRACT_VERSION,
  integrationType: 'INTERNAL_PROXY',
  baseUrlSource: 'REPOSITORY_CONFIG',
  baseUrl: VIDEO_PROXY_BASE_URL,
  operations: [
    { operation: 'MODEL_DISCOVERY', method: 'GET', path: '/models', requestSchema: 'CONFIGURED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['只读模型发现。'] },
    { operation: 'IMAGE_MODEL_DISCOVERY', method: 'GET', path: '/image-models', requestSchema: 'CONFIGURED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['Team 成员保护。'] },
    { operation: 'VIDEO_SUBMISSION', method: 'POST', path: '/generate', requestSchema: 'VERIFIED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['内部 generation.id 与 providerTaskId 分离。'] },
    { operation: 'VIDEO_STATUS', method: 'GET', path: '/status?generationId=', requestSchema: 'VERIFIED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['服务端按 providerTaskId 查询 APIMart。'] },
    { operation: 'VIDEO_CANCEL', method: 'POST', path: '/cancel', requestSchema: 'VERIFIED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['下游取消由可选环境模板控制。'] },
    { operation: 'VIDEO_OUTPUT', method: 'GET', path: '/asset-url?assetId=', requestSchema: 'VERIFIED', responseSchema: 'VERIFIED', state: 'VERIFIED', sourceReference, notes: ['Supabase 私有资产签名 URL；过期时间未声明。'] },
  ],
  taskLifecycle: {
    state: 'VERIFIED', submissionOperation: 'VIDEO_SUBMISSION', statusOperation: 'VIDEO_STATUS', taskIdField: 'generation.providerTaskId', statusField: 'generation.status',
    mappings: [
      { providerState: 'submitted|queued|pending', canonicalState: 'QUEUED', state: 'VERIFIED' },
      { providerState: 'processing|running', canonicalState: 'PROCESSING', state: 'VERIFIED' },
      { providerState: 'completed', canonicalState: 'SUCCEEDED', state: 'VERIFIED' },
      { providerState: 'failed|error', canonicalState: 'FAILED', state: 'VERIFIED' },
      { providerState: 'cancelled|canceled', canonicalState: 'FAILED', state: 'VERIFIED' },
      { providerState: '*', canonicalState: 'UNKNOWN', state: 'VERIFIED' },
    ],
    pollingLiveTested: false,
    notes: ['APIMart normalizeApimartTask 的状态映射；严格合同层将未知值归一为 UNKNOWN。'],
  },
  authentication: { state: 'VERIFIED', mechanism: 'SERVER_SIDE_SECRET', clientBoundary: 'BROWSER_SESSION_TO_INTERNAL_PROXY', credentialNames: ['server-side credential'], secretExposure: 'NOT_EXPOSED' },
  assetInputs: { state: 'VERIFIED', representation: 'PRIVATE_ASSET_ID_WITH_UPLOAD_INTENT', formats: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/wav', 'audio/mpeg'], maxBytes: null, maxReferenceCount: 9, notes: ['服务端上传后仅向 APIMart 发送 HTTPS URL。'] },
  responses: { state: 'VERIFIED', envelopes: [{ operation: 'MODEL_DISCOVERY', rootField: 'models', fields: ['id', 'provider', 'enabled', 'reason'], sourceReference: `${VIDEO_PROXY_BASE_URL}/models` }, { operation: 'VIDEO_SUBMISSION', rootField: 'generation', fields: ['id', 'providerTaskId', 'status', 'videoAssetId', 'errorCode'], sourceReference }, { operation: 'VIDEO_STATUS', rootField: 'generation', fields: ['id', 'status', 'progress', 'videoAssetId', 'errorCode'], sourceReference }, { operation: 'VIDEO_OUTPUT', rootField: 'asset', fields: ['assetId', 'url', 'contentType'], sourceReference }], outputRepresentation: 'PRIVATE_ASSET_URL', outputUrlExpiration: 'UNKNOWN' },
  errors: { state: 'VERIFIED', categories: [{ category: 'AUTH_ERROR', retry: 'NON_RETRYABLE', sourceReference: apimartReference }, { category: 'INVALID_REQUEST', retry: 'NON_RETRYABLE', sourceReference: apimartReference }, { category: 'INSUFFICIENT_CREDITS', retry: 'NON_RETRYABLE', sourceReference: apimartReference }, { category: 'CONTENT_POLICY_REJECTED', retry: 'NON_RETRYABLE', sourceReference: apimartReference }, { category: 'RATE_LIMITED', retry: 'RETRYABLE', sourceReference: apimartReference }, { category: 'PROVIDER_UNAVAILABLE', retry: 'RETRYABLE', sourceReference: apimartReference }, { category: 'UNKNOWN_PROVIDER_ERROR', retry: 'UNKNOWN', sourceReference: apimartReference }], providerCodeField: 'error.code', providerMessageField: 'error.message' },
  verification: 'VERIFIED',
  executionReadiness: 'READY_FOR_EXECUTION_INTEGRATION',
  provenance: { sourceType: 'REPOSITORY_CONFIG', sourceReferences: [VIDEO_PROXY_ROUTE, sourceReference, apimartReference, VIDEO_MODEL_DISCOVERY_FIXTURE.source], capturedAt: VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt, contractVersion: PROVIDER_CONTRACT_VERSION, notes: ['本地后端仓库已验证内部代理及 APIMart 适配器。'] },
};

export const INTERNAL_PROXY_CONTRACT: InternalProxyContract = {
  contractId: 'signalcraft-internal-video-proxy',
  contractVersion: MODEL_CONTRACT_VERSION,
  basePath: '/api/video',
  downstreamProvider: 'APIMART',
  operations: VIDEO_GATEWAY_CONTRACT.operations.map(operation => ({ name: operation.operation, method: operation.method, path: operation.path, request: operation.requestSchema, response: operation.responseSchema === 'VERIFIED' ? ['sanitized gateway envelope'] : [], state: operation.state })),
  taskLifecycle: { internalStates: ['queued', 'processing', 'completed', 'failed'], providerTaskIdFields: ['task_id', 'id'], unknownStatus: 'UNKNOWN', internalGenerationId: 'database generation.id', statusPath: '/tasks/{providerTaskId}?language=zh' },
  executionGate: 'MODEL_DISABLED',
  provenance: VIDEO_GATEWAY_CONTRACT.provenance,
};

function modelContract(item: typeof VIDEO_MODEL_DISCOVERY_FIXTURE.models[number]): ModelContract {
  const evidence = capabilityEvidence[item.id] || {};
  const capabilities: VerifiedModelCapability[] = capabilityKeys.map(capability => {
    const itemEvidence = evidence[capability];
    return { providerId: item.provider || 'unknown', modelId: item.id, capability, state: itemEvidence?.state || 'UNKNOWN', sourceType: itemEvidence ? 'REPOSITORY_CONFIG' as const : 'UNKNOWN' as const, sourceReference: itemEvidence ? (item.id === 'minimax-h3' ? minimaxReference : seedanceReference) : VIDEO_MODEL_DISCOVERY_FIXTURE.source, verifiedAt: itemEvidence ? VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt : null, contractVersion: MODEL_CONTRACT_VERSION, notes: [itemEvidence?.note || '该能力未在实际适配器中声明。'] };
  });
  const duration = item.id === 'minimax-h3' ? { min: 4, max: 15 } : item.id === 'seedance-2' ? { min: 5, max: 15 } : { min: 4, max: 30 };
  const downstreamModel = item.id === 'minimax-h3' ? 'MiniMax-H3' : item.id === 'seedance-2' ? 'seedance-2.0' : 'doubao-seedance-2.5';
  const resolutions = item.id === 'minimax-h3' ? ['2K', '768P'] : [];
  const executionState: ModelExecutionGate = item.enabled ? 'EXECUTION_READY' : 'MODEL_DISABLED';
  const executionReadiness: ExecutionReadiness = item.enabled ? 'READY_FOR_EXECUTION_INTEGRATION' : 'MODEL_DISABLED';
  return { providerId: item.provider || 'unknown', modelId: item.id, displayName: item.id === 'minimax-h3' ? 'MiniMax H3' : item.id === 'seedance-2-5' ? 'Seedance 2.5' : 'Seedance 2.0', actualRequestModelId: downstreamModel, operations: [{ operation: 'IMAGE_TO_VIDEO', state: 'VERIFIED', sourceReference: item.id === 'minimax-h3' ? minimaxReference : seedanceReference }, { operation: 'VIDEO_SUBMISSION', state: 'VERIFIED', sourceReference: apimartReference }, { operation: 'VIDEO_STATUS', state: 'VERIFIED', sourceReference: apimartReference }, { operation: 'VIDEO_OUTPUT', state: 'VERIFIED', sourceReference }], capabilities, inputConstraints: { referenceCount: 9, durationSeconds: duration, aspectRatios: ['9:16', '16:9', '1:1'], resolutions }, outputConstraints: { type: 'VIDEO', representation: 'PRIVATE_ASSET_ID_AFTER_SUPABASE_STORAGE', expiration: 'UNKNOWN' }, availability: item.enabled ? 'AVAILABLE' : 'DISABLED', verification: 'VERIFIED', executionReadiness, executionGate: { registered: true, configurationState: 'CONFIGURED', providerAuthState: 'UNKNOWN', accessState: 'ACCESS_REQUIRED', modelEnablementState: item.enabled ? 'ENABLED' : 'DISABLED', contractState: 'VERIFIED', capabilityState: 'COMPATIBLE', serializationState: 'VERIFIED', executionState, executionPermission: item.enabled ? 'SANDBOX_ONLY' : 'NO_EXECUTION', smokeTestState: item.enabled ? 'READY_FOR_MANUAL_SMOKE_TEST' : 'SMOKE_TEST_BLOCKED', blockers: item.enabled ? [] : ['MODEL_DISABLED', 'TEAM_ONLY_OR_PROVIDER_POLICY'] }, provenance: { sourceType: 'REPOSITORY_CONFIG', sourceReferences: [sourceReference, apimartReference, item.id === 'minimax-h3' ? minimaxReference : seedanceReference], capturedAt: VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt, contractVersion: MODEL_CONTRACT_VERSION, notes: [item.reason, `下游请求模型：${downstreamModel}`] } };
}

export const VERIFIED_MODEL_CONTRACTS: ModelContract[] = VIDEO_MODEL_DISCOVERY_FIXTURE.models.map(modelContract);

export function buildProviderVerificationReport(capturedAt: string | null = VIDEO_MODEL_DISCOVERY_FIXTURE.capturedAt): ProviderVerificationReport {
  const states = VERIFIED_MODEL_CONTRACTS.flatMap(model => model.capabilities.map(capability => capability.state));
  const coverage = { VERIFIED: 0, CONFIGURED: 0, UNVERIFIED: 0, UNKNOWN: 0, UNSUPPORTED: 0 } as Record<CapabilityVerification, number>;
  states.forEach(state => { coverage[state] += 1; });
  return { schemaVersion: PROVIDER_VERIFICATION_VERSION, contractVersion: PROVIDER_CONTRACT_VERSION, modelContractVersion: MODEL_CONTRACT_VERSION, contracts: [VIDEO_GATEWAY_CONTRACT], models: VERIFIED_MODEL_CONTRACTS, coverage: { verified: coverage.VERIFIED, configured: coverage.CONFIGURED, unverified: coverage.UNVERIFIED, unknown: coverage.UNKNOWN, unsupported: coverage.UNSUPPORTED }, executionReadiness: VERIFIED_MODEL_CONTRACTS.map(model => ({ providerId: model.providerId, modelId: model.modelId, state: model.executionReadiness, blockers: [...(model.availability === 'DISABLED' ? ['网关当前将模型标记为 disabled'] : [])] })), provenance: { source: 'READ_ONLY_REPOSITORY_AND_GATEWAY_AUDIT', capturedAt, sourceReferences: [VIDEO_PROXY_ROUTE, sourceReference, apimartReference, VIDEO_MODEL_DISCOVERY_FIXTURE.source] } };
}

export function applyVerifiedModelDiscovery(registryModels: ModelDefinition[]): ModelDefinition[] {
  return registryModels.map(model => {
    const discovered = VERIFIED_MODEL_CONTRACTS.find(item => item.modelId === model.modelId);
    if (!discovered) return model;
    return { ...model, providerId: discovered.providerId, displayName: discovered.displayName, availability: discovered.availability, verification: discovered.verification, capabilities: discovered.capabilities.map(item => ({ key: item.capability, support: item.state === 'UNSUPPORTED' ? 'UNSUPPORTED' : item.state === 'VERIFIED' ? 'SUPPORTED' : 'UNKNOWN', verification: item.state, source: item.sourceType === 'REPOSITORY_CONFIG' ? 'REPOSITORY_CONFIG' : 'UNKNOWN', limit: item.capability === 'MULTI_REFERENCE' ? { maxReferenceCount: discovered.inputConstraints.referenceCount } : undefined, capabilityVersion: 'provider-capability-v1', verifiedAt: item.verifiedAt })), adapterId: discovered.verification === 'VERIFIED' ? (discovered.providerId === 'minimax' ? 'minimax-verified-serialization' : 'seedance-verified-serialization') : model.adapterId, configurationVersion: MODEL_CONTRACT_VERSION };
  });
}

export function normalizeProviderVerificationReport(value: unknown): ProviderVerificationReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<ProviderVerificationReport>;
  return report.schemaVersion === PROVIDER_VERIFICATION_VERSION && report.contractVersion === PROVIDER_CONTRACT_VERSION && Array.isArray(report.models) && Array.isArray(report.contracts) ? report as ProviderVerificationReport : null;
}

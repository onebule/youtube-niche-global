/**
 * P4 Phase 4 — provider compatibility, routing and adapter boundaries.
 *
 * This module consumes P4.3 canonical intent. It never calls a provider,
 * spends credits, polls jobs, or mutates Canvas. Provider capabilities are
 * deliberately conservative when the repository has no verifiable schema.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { GenerationRoute, GenerationUnit, VisualGenerationSpecification } from './visual-generation-specification.ts';

export const PROVIDER_REGISTRY_VERSION = 'provider-registry-v1';
export const PROVIDER_CAPABILITY_VERSION = 'provider-capability-v1';
export const PROVIDER_ROUTING_ALGORITHM_VERSION = 'provider-routing-v1';
export const ADAPTER_VERSION = Object.freeze({ minimax: 'minimax-adapter-v1', seedance: 'seedance-adapter-v1' });

export type CapabilityKey = 'TEXT_TO_IMAGE' | 'REFERENCE_IMAGE' | 'IMAGE_EDIT' | 'MULTI_REFERENCE' | 'TEXT_TO_VIDEO' | 'IMAGE_TO_VIDEO' | 'VIDEO_CONTINUATION' | 'START_FRAME' | 'END_FRAME' | 'REFERENCE_VIDEO' | 'IDENTITY_REFERENCE' | 'STYLE_REFERENCE' | 'EXACT_TEXT' | 'TRANSPARENT_BACKGROUND' | 'AUDIO';
export type CapabilityVerification = 'VERIFIED' | 'CONFIGURED' | 'UNVERIFIED' | 'UNKNOWN' | 'UNSUPPORTED';
export type CapabilitySupport = 'SUPPORTED' | 'SUPPORTED_WITH_LIMITS' | 'UNSUPPORTED' | 'UNKNOWN' | 'UNVERIFIED';
export type ProviderAvailability = 'AVAILABLE' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED' | 'UNVERIFIED' | 'UNAVAILABLE';
export type ModelAvailability = 'AVAILABLE' | 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED' | 'DEPRECATED' | 'UNKNOWN';
export type CompatibilityState = 'COMPATIBLE' | 'COMPATIBLE_WITH_DEGRADATION' | 'REQUIRES_ADAPTATION' | 'INCOMPATIBLE' | 'UNVERIFIED' | 'INSUFFICIENT';
export type RoutingMode = 'AUTO' | 'USER_SELECTED' | 'FALLBACK';
export type OverrideResult = 'ACCEPTED' | 'ACCEPTED_WITH_CAUTION' | 'OVERRIDE_INCOMPATIBLE' | 'UNVERIFIED';
export type SerializationLossState = 'NO_LOSS' | 'SOFT_LOSS' | 'HARD_LOSS' | 'UNKNOWN';

export type CapabilityLimit = { maxReferenceCount?: number | null; durationSeconds?: { min: number | null; max: number | null }; aspectRatios?: string[]; inputTypes?: string[]; outputTypes?: string[] };
export type ModelCapability = { key: CapabilityKey; support: CapabilitySupport; verification: CapabilityVerification; source: 'REPOSITORY_CONFIG' | 'OFFICIAL_PROVIDER_CONFIG' | 'MANUAL_CONFIG' | 'UNKNOWN'; limit?: CapabilityLimit; verifiedAt?: string | null; capabilityVersion: string };
export type ProviderDefinition = { providerId: string; displayName: string; generationDomains: Array<'IMAGE' | 'VIDEO'>; availability: ProviderAvailability; verification: CapabilityVerification; modelIds: string[]; adapterId: string; configurationVersion: string };
export type ModelDefinition = { modelId: string; providerId: string; displayName: string; availability: ModelAvailability; verification: CapabilityVerification; capabilities: ModelCapability[]; adapterId: string; configurationVersion: string; telemetry: { priceDataState: 'AVAILABLE' | 'UNKNOWN' | 'STALE'; qualityDataState: 'AVAILABLE' | 'UNKNOWN' | 'STALE'; speedDataState: 'AVAILABLE' | 'UNKNOWN' | 'STALE' } };
export type ProviderRoutingRegistry = { registryVersion: string; capabilityVersion: string; providers: ProviderDefinition[]; models: ModelDefinition[] };

export type ProviderRequirement = { key: string; capability: CapabilityKey | null; hard: boolean; detail: string; source: string };
export type GenerationProviderRequirements = { route: GenerationRoute; nonGenerative: boolean; requirements: ProviderRequirement[]; referenceCount: number; referenceRoles: string[]; requiresStart: boolean; requiresEnd: boolean; durationSeconds: { min: number | null; max: number | null }; aspectRatio: string | null };
export type ModelCompatibility = { modelId: string; providerId: string; state: CompatibilityState; supportedRequirements: string[]; degradedRequirements: string[]; unsupportedRequirements: string[]; unknownRequirements: string[]; confidence: ConfidenceLevel; reasons: RoutingReason[]; risks: RoutingRisk[]; blockers: RoutingBlocker[] };
export type RoutingReason = { code: string; message: string; refs: string[] };
export type RoutingRisk = { code: string; message: string; refs: string[] };
export type RoutingBlocker = { code: string; message: string; refs: string[] };
export type ModelOverride = { requestedModelId: string; result: OverrideResult; compatibilityState: CompatibilityState; reasonCodes: string[] };
export type RoutingFallback = { modelId: string | null; route: GenerationRoute; state: 'AVAILABLE' | 'REJECTED' | 'NOT_APPLICABLE'; reasonCodes: string[]; changes: string[] };
export type RoutingProvenance = { decisionId: string; specificationId: string; generationUnitId: string; providerRegistryVersion: string; modelRegistryVersion: string; capabilityVersion: string; routingAlgorithmVersion: string; evaluatedAt: string | null };
export type ModelRoutingDecision = { decisionId: string; specificationId: string; generationUnitId: string; mode: RoutingMode; recommendedProviderId: string | null; recommendedModelId: string | null; compatibleModels: ModelCompatibility[]; rejectedModels: ModelCompatibility[]; userOverride: ModelOverride | null; fallbackChain: RoutingFallback[]; confidence: ConfidenceLevel; reasons: RoutingReason[]; risks: RoutingRisk[]; blockers: RoutingBlocker[]; provenance: RoutingProvenance };

export type ProviderGenerationRequest = { requestId: string; providerId: string; modelId: string; operation: GenerationRoute; payload: Record<string, unknown>; inputAssets: string[]; referenceAssets: string[]; expectedOutput: { type: 'IMAGE' | 'VIDEO' | 'NONE'; durationSeconds: number | null; aspectRatio: string | null }; metadata: { sourceSpecificationId: string; sourceGenerationUnitId: string; routingDecisionId: string; adapterVersion: string; serializationVersion: string; representation: Record<string, 'EXPLICIT' | 'DERIVED' | 'NOT_APPLICABLE' | 'UNKNOWN'> } };
export type SerializationValidation = { state: SerializationLossState; requestId: string; lostHardRequirements: string[]; lostSoftRequirements: string[]; unknownRequirements: string[]; reasons: RoutingReason[]; risks: RoutingRisk[]; blockers: RoutingBlocker[]; ready: boolean };
export type ProviderAdapterContext = { decision: ModelRoutingDecision; model: ModelDefinition };
export type GenerationProviderAdapter = { providerId: string; adapterVersion: string; validateCompatibility: (specification: VisualGenerationSpecification, model: ModelDefinition) => ModelCompatibility; serializeUnit: (unit: GenerationUnit, specification: VisualGenerationSpecification, context: ProviderAdapterContext) => ProviderGenerationRequest; validateSerializedRequest: (request: ProviderGenerationRequest, specification: VisualGenerationSpecification) => SerializationValidation };
export type ProviderRoutingDecision = { specificationId: string; route: GenerationRoute; requirements: GenerationProviderRequirements; decisions: ModelRoutingDecision[]; requests: ProviderGenerationRequest[]; serializations: SerializationValidation[]; registryVersion: string; capabilityVersion: string; routingAlgorithmVersion: string; dataAvailability: { providerCapabilities: 'AVAILABLE' | 'UNVERIFIED' | 'UNKNOWN'; price: 'AVAILABLE' | 'UNKNOWN' | 'STALE'; quality: 'AVAILABLE' | 'UNKNOWN' | 'STALE'; speed: 'AVAILABLE' | 'UNKNOWN' | 'STALE' }; provenance: { source: 'P4_PHASE_3_CANONICAL_SPECIFICATION'; specificationId: string; generationUnitIds: string[]; evaluatedAt: string | null } };
export type ProviderRoutingReport = { schemaVersion: 'provider-routing.v1'; algorithmVersion: typeof PROVIDER_ROUTING_ALGORITHM_VERSION; scope: 'LONG_FORM'; registry: ProviderRoutingRegistry; routes: ProviderRoutingDecision[]; gaps: string[]; provenance: { source: 'P4_PHASE_3_CANONICAL_SPECIFICATION'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[] } };

const allCapabilities: CapabilityKey[] = ['TEXT_TO_IMAGE', 'REFERENCE_IMAGE', 'IMAGE_EDIT', 'MULTI_REFERENCE', 'TEXT_TO_VIDEO', 'IMAGE_TO_VIDEO', 'VIDEO_CONTINUATION', 'START_FRAME', 'END_FRAME', 'REFERENCE_VIDEO', 'IDENTITY_REFERENCE', 'STYLE_REFERENCE', 'EXACT_TEXT', 'TRANSPARENT_BACKGROUND', 'AUDIO'];
const unknownCapabilities = (source: ModelCapability['source'] = 'UNKNOWN'): ModelCapability[] => allCapabilities.map(key => ({ key, support: 'UNKNOWN', verification: 'UNKNOWN', source, capabilityVersion: PROVIDER_CAPABILITY_VERSION }));

/** Repository audit: identifiers exist in legacy video configuration, but no provider request schema is verified here. */
export const PROVIDER_ROUTING_REGISTRY: ProviderRoutingRegistry = Object.freeze({
  registryVersion: PROVIDER_REGISTRY_VERSION,
  capabilityVersion: PROVIDER_CAPABILITY_VERSION,
  providers: [
    { providerId: 'minimax', displayName: 'MiniMax', generationDomains: ['IMAGE', 'VIDEO'], availability: 'UNVERIFIED', verification: 'UNVERIFIED', modelIds: ['provider:minimax:model:h3'], adapterId: 'minimax-boundary', configurationVersion: 'repository-reference-v1' },
    { providerId: 'seedance', displayName: 'Seedance', generationDomains: ['VIDEO'], availability: 'UNVERIFIED', verification: 'UNVERIFIED', modelIds: ['provider:seedance:model:2', 'provider:seedance:model:2.5'], adapterId: 'seedance-boundary', configurationVersion: 'repository-reference-v1' },
  ],
  models: [
    { modelId: 'provider:minimax:model:h3', providerId: 'minimax', displayName: 'MiniMax H3', availability: 'UNKNOWN', verification: 'UNVERIFIED', capabilities: unknownCapabilities(), adapterId: ADAPTER_VERSION.minimax, configurationVersion: 'repository-reference-v1', telemetry: { priceDataState: 'UNKNOWN', qualityDataState: 'UNKNOWN', speedDataState: 'UNKNOWN' } },
    { modelId: 'provider:seedance:model:2', providerId: 'seedance', displayName: 'Seedance 2.0', availability: 'UNKNOWN', verification: 'UNVERIFIED', capabilities: unknownCapabilities(), adapterId: ADAPTER_VERSION.seedance, configurationVersion: 'repository-reference-v1', telemetry: { priceDataState: 'UNKNOWN', qualityDataState: 'UNKNOWN', speedDataState: 'UNKNOWN' } },
    { modelId: 'provider:seedance:model:2.5', providerId: 'seedance', displayName: 'Seedance 2.5', availability: 'UNKNOWN', verification: 'UNVERIFIED', capabilities: unknownCapabilities(), adapterId: ADAPTER_VERSION.seedance, configurationVersion: 'repository-reference-v1', telemetry: { priceDataState: 'UNKNOWN', qualityDataState: 'UNKNOWN', speedDataState: 'UNKNOWN' } },
  ],
}) as unknown as ProviderRoutingRegistry;

const hash = (value: string) => { let h = 0x811c9dc5; for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const uniq = <T>(values: T[]) => [...new Set(values)];
const nonGenerativeRoutes = new Set<GenerationRoute>(['REUSE_EXISTING_ASSET', 'USER_CAPTURE', 'SOURCE_REAL_EVIDENCE', 'SCREEN_CAPTURE', 'CHART_RENDER', 'GRAPHIC_RENDER', 'RESEARCH_FIRST', 'RIGHTS_REVIEW_FIRST', 'MANUAL_PRODUCTION', 'BLOCKED', 'UNSUPPORTED']);

export function extractProviderRequirements(specification: VisualGenerationSpecification): GenerationProviderRequirements {
  const requirements: ProviderRequirement[] = [];
  const add = (key: string, capability: CapabilityKey | null, hard: boolean, detail: string, source: string) => requirements.push({ key, capability, hard, detail, source });
  const route = specification.generationRoute;
  const nonGenerative = nonGenerativeRoutes.has(route) || specification.evidenceSemantics.mode === 'NON_GENERATIVE' || specification.evidenceSemantics.mode === 'REAL_SOURCE_REQUIRED' || specification.evidenceSemantics.mode === 'REAL_DATA_RENDER';
  if (nonGenerative) return { route, nonGenerative: true, requirements: [], referenceCount: 0, referenceRoles: [], requiresStart: false, requiresEnd: false, durationSeconds: { min: null, max: null }, aspectRatio: specification.aspectRatio.value };
  const routeCapability: CapabilityKey | null = route === 'TEXT_TO_IMAGE' ? 'TEXT_TO_IMAGE' : route === 'REFERENCE_IMAGE_EDIT' ? 'IMAGE_EDIT' : route === 'IMAGE_TO_VIDEO' ? 'IMAGE_TO_VIDEO' : route === 'TEXT_TO_VIDEO' ? 'TEXT_TO_VIDEO' : route === 'MULTI_STAGE_GENERATION' ? null : null;
  if (routeCapability) add(`ROUTE_${route}`, routeCapability, true, `路线 ${route} 必须由 provider 明确支持。`, 'generationRoute');
  const refs = specification.referenceDependencies;
  const referenceRoles = refs.filter(ref => ref.required).map(ref => ref.role);
  if (refs.length) add('REFERENCE_INPUT', 'REFERENCE_IMAGE', refs.some(ref => ref.required), '参考依赖必须可映射到 provider 输入。', 'referenceDependencies');
  if (refs.length > 1) add('MULTIPLE_REFERENCES', 'MULTI_REFERENCE', refs.some(ref => ref.required), '多参考输入不能被静默丢弃。', 'referenceDependencies');
  const requiresStart = specification.inputState === 'START_FRAME' || route === 'IMAGE_TO_VIDEO' || specification.inputState === 'SOURCE_IMAGE' || specification.inputState === 'REFERENCE_IMAGE' || specification.inputState === 'MULTIPLE_REFERENCES';
  const requiresEnd = Boolean(specification.endState) || specification.complexity.requiresEndState;
  if (requiresStart) add('START_STATE', 'START_FRAME', true, 'START 状态必须保留。', 'startState');
  if (requiresEnd) add('END_STATE', 'END_FRAME', true, 'END 状态必须保留。', 'endState');
  if (specification.continuityLocks.some(lock => lock.type === 'IDENTITY_LOCK') || specification.preserveUnchanged.some(item => item.type === 'CHARACTER_IDENTITY')) add('IDENTITY_LOCK', 'IDENTITY_REFERENCE', true, '角色身份硬锁必须有可表示的参考能力。', 'continuityLocks');
  if (specification.preserveUnchanged.some(item => item.type === 'STYLE')) add('STYLE_LOCK', 'STYLE_REFERENCE', false, '风格锁为软要求，缺失时必须记录降级。', 'preserveUnchanged');
  if (specification.negativeConstraints.some(item => item.type === 'TEXT_FIDELITY_REQUIRED')) add('EXACT_TEXT', 'EXACT_TEXT', true, '可读文字保真是硬要求。', 'negativeConstraints');
  return { route, nonGenerative: false, requirements, referenceCount: refs.length, referenceRoles: uniq(referenceRoles), requiresStart, requiresEnd, durationSeconds: specification.duration ? { min: specification.duration.minSeconds, max: specification.duration.maxSeconds } : { min: null, max: null }, aspectRatio: specification.aspectRatio.value };
}

function capability(model: ModelDefinition, key: CapabilityKey) { return model.capabilities.find(item => item.key === key) || { key, support: 'UNKNOWN' as const, verification: 'UNKNOWN' as const, source: 'UNKNOWN' as const, capabilityVersion: PROVIDER_CAPABILITY_VERSION }; }
function evaluateModel(specification: VisualGenerationSpecification, requirements: GenerationProviderRequirements, model: ModelDefinition): ModelCompatibility {
  if (requirements.nonGenerative) return { modelId: model.modelId, providerId: model.providerId, state: 'INCOMPATIBLE', supportedRequirements: [], degradedRequirements: [], unsupportedRequirements: ['NON_GENERATIVE_ROUTE'], unknownRequirements: [], confidence: 'HIGH', reasons: [{ code: 'ROUTING_NON_GENERATIVE_ROUTE', message: '非生成/真实证据路线不进入 provider。', refs: [specification.specificationId] }], risks: [], blockers: [] };
  const supported: string[] = [], degraded: string[] = [], unsupported: string[] = [], unknown: string[] = [], reasons: RoutingReason[] = [], risks: RoutingRisk[] = [], blockers: RoutingBlocker[] = [];
  if (model.availability === 'DISABLED' || model.availability === 'NOT_CONFIGURED') { blockers.push({ code: 'PROVIDER_NOT_CONFIGURED', message: '模型未配置或已禁用，不能路由。', refs: [model.modelId] }); return { modelId: model.modelId, providerId: model.providerId, state: 'INCOMPATIBLE', supportedRequirements: [], degradedRequirements: [], unsupportedRequirements: ['MODEL_AVAILABILITY'], unknownRequirements: [], confidence: 'LOW', reasons, risks, blockers }; }
  for (const requirement of requirements.requirements) {
    if (!requirement.capability) continue;
    const item = capability(model, requirement.capability);
    if (item.support === 'SUPPORTED' || item.support === 'SUPPORTED_WITH_LIMITS') { supported.push(requirement.key); if (item.support === 'SUPPORTED_WITH_LIMITS') { degraded.push(requirement.key); risks.push({ code: 'CAPABILITY_LIMIT', message: `${requirement.key} 仅在 provider 限制内表示。`, refs: [model.modelId] }); } else reasons.push({ code: 'ROUTING_HARD_REQUIREMENT_SATISFIED', message: `${requirement.key} 有明确能力映射。`, refs: [model.modelId] }); }
    else if (item.support === 'UNSUPPORTED') { (requirement.hard ? unsupported : degraded).push(requirement.key); if (requirement.hard) blockers.push({ code: 'HARD_REQUIREMENT_UNSUPPORTED', message: `模型不支持硬要求 ${requirement.key}。`, refs: [model.modelId, requirement.source] }); else risks.push({ code: 'CONTINUITY_DEGRADATION', message: `软要求 ${requirement.key} 无显式能力，将降级并保留风险。`, refs: [model.modelId] }); }
    else { unknown.push(requirement.key); if (requirement.hard) blockers.push({ code: 'CAPABILITY_UNVERIFIED', message: `硬要求 ${requirement.key} 的能力尚未验证。`, refs: [model.modelId] }); else risks.push({ code: 'PROVIDER_CAPABILITY_UNVERIFIED', message: `软要求 ${requirement.key} 的能力尚未验证。`, refs: [model.modelId] }); }
  }
  if (requirements.referenceCount > 1 && capability(model, 'MULTI_REFERENCE').support === 'SUPPORTED_WITH_LIMITS') { const limit = capability(model, 'MULTI_REFERENCE').limit?.maxReferenceCount; if (limit !== null && limit !== undefined && requirements.referenceCount > limit) blockers.push({ code: 'REQUIRED_REFERENCE_UNREPRESENTABLE', message: '参考数量超出已验证上限。', refs: [model.modelId] }); }
  if (requirements.requiresEnd && capability(model, 'END_FRAME').support === 'UNKNOWN') risks.push({ code: 'END_STATE_SUPPORT_UNKNOWN', message: 'END 状态能力尚未验证。', refs: [model.modelId] });
  const state: CompatibilityState = blockers.length ? (unknown.length ? 'UNVERIFIED' : 'INCOMPATIBLE') : degraded.length || risks.length ? 'COMPATIBLE_WITH_DEGRADATION' : model.verification === 'UNVERIFIED' ? 'UNVERIFIED' : 'COMPATIBLE';
  const confidence: ConfidenceLevel = model.verification === 'VERIFIED' && !unknown.length ? (risks.length ? 'MEDIUM' : 'HIGH') : unknown.length ? 'LOW' : 'MEDIUM';
  if (unknown.length) reasons.push({ code: 'ROUTING_CAPABILITY_UNVERIFIED', message: '能力元数据不完整，不能当作已支持。', refs: unknown });
  return { modelId: model.modelId, providerId: model.providerId, state, supportedRequirements: supported, degradedRequirements: degraded, unsupportedRequirements: unsupported, unknownRequirements: unknown, confidence, reasons, risks, blockers };
}

function adapterRepresentation(specification: VisualGenerationSpecification, model: ModelDefinition) {
  const supports = (key: CapabilityKey) => { const item = capability(model, key); return item.support === 'SUPPORTED' || item.support === 'SUPPORTED_WITH_LIMITS'; };
  const representation: Record<string, 'EXPLICIT' | 'DERIVED' | 'NOT_APPLICABLE' | 'UNKNOWN'> = {
    startState: supports('START_FRAME') ? 'EXPLICIT' : 'UNKNOWN',
    endState: specification.endState ? (supports('END_FRAME') ? 'EXPLICIT' : 'UNKNOWN') : 'NOT_APPLICABLE',
    references: specification.referenceDependencies.length ? (supports('REFERENCE_IMAGE') ? 'EXPLICIT' : 'UNKNOWN') : 'NOT_APPLICABLE',
    multiReference: specification.referenceDependencies.length > 1 ? (supports('MULTI_REFERENCE') ? 'EXPLICIT' : 'UNKNOWN') : 'NOT_APPLICABLE',
    identityLocks: specification.continuityLocks.some(lock => lock.type === 'IDENTITY_LOCK') ? (supports('IDENTITY_REFERENCE') ? 'EXPLICIT' : 'UNKNOWN') : 'NOT_APPLICABLE',
    styleLocks: specification.preserveUnchanged.some(item => item.type === 'STYLE') ? (supports('STYLE_REFERENCE') ? 'EXPLICIT' : 'UNKNOWN') : 'NOT_APPLICABLE',
    negativeConstraints: specification.negativeConstraints.length ? 'DERIVED' : 'NOT_APPLICABLE',
    evidenceBoundary: specification.evidenceSemantics.mode === 'ILLUSTRATIVE_ONLY' ? 'EXPLICIT' : 'NOT_APPLICABLE',
  };
  return representation;
}
function serialize(adapterId: string, adapterVersion: string, unit: GenerationUnit, specification: VisualGenerationSpecification, context: ProviderAdapterContext): ProviderGenerationRequest {
  const representation = adapterRepresentation(specification, context.model);
  const outputType: ProviderGenerationRequest['expectedOutput']['type'] = ['TEXT_TO_IMAGE', 'REFERENCE_IMAGE_EDIT'].includes(unit.route) ? 'IMAGE' : ['IMAGE_TO_VIDEO', 'TEXT_TO_VIDEO', 'MULTI_STAGE_GENERATION'].includes(unit.route) ? 'VIDEO' : 'NONE';
  const semanticPrompt = [specification.startState.subjects.join('、'), specification.startState.environment, unit.desiredChange.map(change => change.description).join('；'), specification.endState ? `目标结束状态：${specification.endState.actionsAtState.join('、') || '保持状态并完成变化'}` : '', specification.negativeConstraints.map(item => `禁止：${item.description}`).join('；')].filter(Boolean).join('。');
  return { requestId: `pgr:${hash(`${context.decision.decisionId}|${unit.unitId}|${adapterVersion}`)}`, providerId: context.model.providerId, modelId: context.model.modelId, operation: unit.route, payload: { adapterId, adapterMode: 'BOUNDARY_ONLY', semanticPrompt, startState: specification.startState, desiredChange: unit.desiredChange, endState: specification.endState, references: specification.referenceDependencies.map(ref => ({ dependencyId: ref.dependencyId, assetId: ref.assetId, role: ref.role, required: ref.required })), continuityLocks: specification.continuityLocks, negativeConstraints: specification.negativeConstraints }, inputAssets: unit.requiredAssetIds, referenceAssets: specification.referenceDependencies.map(ref => ref.assetId), expectedOutput: { type: outputType, durationSeconds: specification.duration?.minSeconds || null, aspectRatio: specification.aspectRatio.value }, metadata: { sourceSpecificationId: specification.specificationId, sourceGenerationUnitId: unit.unitId, routingDecisionId: context.decision.decisionId, adapterVersion, serializationVersion: PROVIDER_ROUTING_ALGORITHM_VERSION, representation } };
}
function validate(request: ProviderGenerationRequest, specification: VisualGenerationSpecification): SerializationValidation {
  const representation = request.metadata.representation;
  const requiredKeys = new Set(extractProviderRequirements(specification).requirements.map(requirement => requirement.key));
  const hardMap: Array<[string, string]> = [['startState', 'START_STATE'], ['endState', 'END_STATE'], ['references', 'REFERENCE_INPUT'], ['identityLocks', 'IDENTITY_LOCK']];
  const softMap: Array<[string, string]> = [['styleLocks', 'STYLE_LOCK'], ['negativeConstraints', 'NEGATIVE_CONSTRAINTS']];
  const lostHard = hardMap.filter(([, requirement]) => requiredKeys.has(requirement)).filter(([key]) => representation[key] === 'UNKNOWN').map(([, requirement]) => requirement);
  const lostSoft = softMap.filter(([, requirement]) => requirement === 'STYLE_LOCK' ? specification.preserveUnchanged.some(item => item.type === 'STYLE') : specification.negativeConstraints.length > 0).filter(([key]) => representation[key] === 'UNKNOWN').map(([, requirement]) => requirement);
  const unknown = Object.entries(representation).filter(([, state]) => state === 'UNKNOWN').map(([key]) => key);
  const state: SerializationLossState = lostHard.length ? 'HARD_LOSS' : lostSoft.length ? 'SOFT_LOSS' : unknown.length ? 'UNKNOWN' : 'NO_LOSS';
  return { state, requestId: request.requestId, lostHardRequirements: lostHard, lostSoftRequirements: lostSoft, unknownRequirements: unknown, reasons: lostHard.length ? [{ code: 'ROUTING_SERIALIZATION_HARD_LOSS', message: 'provider request 无法表示硬要求，不能标记为 ready。', refs: lostHard }] : [], risks: lostSoft.length ? [{ code: 'SERIALIZATION_LOSS', message: 'provider request 对软要求进行了降级，需人工确认。', refs: lostSoft }] : [], blockers: lostHard.length ? [{ code: 'HARD_SERIALIZATION_LOSS', message: '硬要求在序列化中丢失。', refs: [request.requestId] }] : [], ready: !lostHard.length && state !== 'UNKNOWN' };
}

function makeAdapter(providerId: string, adapterVersion: string): GenerationProviderAdapter {
  return { providerId, adapterVersion, validateCompatibility: (specification, model) => evaluateModel(specification, extractProviderRequirements(specification), model), serializeUnit: (unit, specification, context) => serialize(`${providerId}-boundary`, adapterVersion, unit, specification, context), validateSerializedRequest: validate };
}
export const PROVIDER_ADAPTERS: Record<string, GenerationProviderAdapter> = { minimax: makeAdapter('minimax', ADAPTER_VERSION.minimax), seedance: makeAdapter('seedance', ADAPTER_VERSION.seedance) };

function decisionId(specification: VisualGenerationSpecification, unit: GenerationUnit) { return `routing:${hash(`${specification.specificationId}|${unit.unitId}|${PROVIDER_ROUTING_ALGORITHM_VERSION}`)}`; }
function routingForUnit(specification: VisualGenerationSpecification, unit: GenerationUnit, registry: ProviderRoutingRegistry, mode: RoutingMode, selectedModelId: string | null, fallbackModelIds: string[], evaluatedAt: string | null): { decision: ModelRoutingDecision; request: ProviderGenerationRequest | null; serialization: SerializationValidation | null } {
  const requirements = extractProviderRequirements(specification);
  const id = decisionId(specification, unit);
  if (requirements.nonGenerative) return { decision: { decisionId: id, specificationId: specification.specificationId, generationUnitId: unit.unitId, mode, recommendedProviderId: null, recommendedModelId: null, compatibleModels: [], rejectedModels: [], userOverride: null, fallbackChain: [{ modelId: null, route: specification.generationRoute, state: 'NOT_APPLICABLE', reasonCodes: ['ROUTING_NON_GENERATIVE_ROUTE'], changes: [] }], confidence: 'HIGH', reasons: [{ code: 'ROUTING_NON_GENERATIVE_ROUTE', message: '非生成路线不选择 provider。', refs: [specification.specificationId] }], risks: [], blockers: [], provenance: { decisionId: id, specificationId: specification.specificationId, generationUnitId: unit.unitId, providerRegistryVersion: registry.registryVersion, modelRegistryVersion: registry.registryVersion, capabilityVersion: registry.capabilityVersion, routingAlgorithmVersion: PROVIDER_ROUTING_ALGORITHM_VERSION, evaluatedAt } }, request: null, serialization: null };
  const all = registry.models.map(model => evaluateModel(specification, requirements, model));
  const selected = selectedModelId ? all.find(item => item.modelId === selectedModelId) || null : null;
  const compatible = all.filter(item => ['COMPATIBLE', 'COMPATIBLE_WITH_DEGRADATION'].includes(item.state));
  const safe = compatible.filter(item => { const model = registry.models.find(entry => entry.modelId === item.modelId); return model?.availability === 'AVAILABLE' || model?.availability === 'CONFIGURED'; });
  const autoModel = safe.find(item => item.state === 'COMPATIBLE') || safe[0] || null;
  const selectedAccepted = selected && ['COMPATIBLE', 'COMPATIBLE_WITH_DEGRADATION'].includes(selected.state) ? selected : null;
  const chosen = mode === 'USER_SELECTED' || mode === 'FALLBACK' ? selectedAccepted : autoModel;
  const userOverride: ModelOverride | null = mode === 'USER_SELECTED' && selected ? { requestedModelId: selected.modelId, result: selected.state === 'COMPATIBLE' ? 'ACCEPTED' : selected.state === 'COMPATIBLE_WITH_DEGRADATION' ? 'ACCEPTED_WITH_CAUTION' : selected.state === 'UNVERIFIED' ? 'UNVERIFIED' : 'OVERRIDE_INCOMPATIBLE', compatibilityState: selected.state, reasonCodes: selected.blockers.map(blocker => blocker.code) } : null;
  const blockers: RoutingBlocker[] = []; const risks: RoutingRisk[] = []; const reasons: RoutingReason[] = [];
  if (!chosen) blockers.push({ code: selectedModelId ? 'SELECTED_MODEL_INCOMPATIBLE' : 'NO_COMPATIBLE_PROVIDER', message: selectedModelId ? '用户选择的模型不能满足当前镜头硬要求。' : '没有已验证且可用的兼容模型。', refs: [specification.specificationId] });
  if (autoModel) reasons.push({ code: 'ROUTING_ROUTE_COMPATIBLE', message: '仅在硬要求兼容的模型中进行自动推荐。', refs: [autoModel.modelId] });
  if (registry.models.some(model => model.telemetry.priceDataState !== 'AVAILABLE')) reasons.push({ code: 'ROUTING_PRICE_UNKNOWN', message: '价格数据不可用，未进行最低成本宣称。', refs: [] });
  if (registry.models.some(model => model.telemetry.qualityDataState !== 'AVAILABLE')) reasons.push({ code: 'ROUTING_QUALITY_TELEMETRY_UNKNOWN', message: '质量遥测不可用，未进行最佳质量宣称。', refs: [] });
  if (registry.models.some(model => model.telemetry.speedDataState !== 'AVAILABLE')) risks.push({ code: 'SPEED_TELEMETRY_UNKNOWN', message: '速度遥测不可用，未进行最快宣称。', refs: [] });
  const fallbackChain: RoutingFallback[] = fallbackModelIds.map((modelId, index) => { const assessment = all.find(item => item.modelId === modelId); return { modelId, route: specification.generationRoute, state: assessment && ['COMPATIBLE', 'COMPATIBLE_WITH_DEGRADATION'].includes(assessment.state) ? 'AVAILABLE' : 'REJECTED', reasonCodes: assessment ? assessment.blockers.map(blocker => blocker.code) : ['MODEL_UNKNOWN'], changes: assessment && index > 0 && assessment.modelId === chosen?.modelId ? ['MODEL_CHANGED'] : [] }; });
  const decision: ModelRoutingDecision = { decisionId: id, specificationId: specification.specificationId, generationUnitId: unit.unitId, mode, recommendedProviderId: chosen?.providerId || null, recommendedModelId: chosen?.modelId || null, compatibleModels: compatible, rejectedModels: all.filter(item => !compatible.includes(item)), userOverride, fallbackChain, confidence: chosen ? (chosen.confidence === 'HIGH' ? 'HIGH' : chosen.confidence) : 'INSUFFICIENT', reasons: [...reasons, ...(chosen?.reasons || [])], risks: [...risks, ...(chosen?.risks || [])], blockers: [...blockers, ...(selected?.blockers || [])], provenance: { decisionId: id, specificationId: specification.specificationId, generationUnitId: unit.unitId, providerRegistryVersion: registry.registryVersion, modelRegistryVersion: registry.registryVersion, capabilityVersion: registry.capabilityVersion, routingAlgorithmVersion: PROVIDER_ROUTING_ALGORITHM_VERSION, evaluatedAt } };
  if (!chosen) return { decision, request: null, serialization: null };
  const model = registry.models.find(entry => entry.modelId === chosen.modelId)!; const adapter = PROVIDER_ADAPTERS[model.providerId];
  if (!adapter) return { decision: { ...decision, blockers: [...decision.blockers, { code: 'PROVIDER_NOT_CONFIGURED', message: '当前 provider 没有适配器边界。', refs: [model.providerId] }] }, request: null, serialization: null };
  const request = adapter.serializeUnit(unit, specification, { decision, model }); const serialization = adapter.validateSerializedRequest(request, specification);
  return { decision: { ...decision, blockers: serialization.blockers.length ? [...decision.blockers, ...serialization.blockers] : decision.blockers, risks: serialization.risks.length ? [...decision.risks, ...serialization.risks] : decision.risks }, request, serialization };
}

export function buildProviderRouting(input: { specification: VisualGenerationSpecification | null; registry?: ProviderRoutingRegistry; mode?: RoutingMode; selectedModelId?: string | null; fallbackModelIds?: string[]; capturedAt?: string | null; snapshotId?: string | null }): ProviderRoutingDecision | null {
  const specification = input.specification; if (!specification) return null;
  const registry = input.registry || PROVIDER_ROUTING_REGISTRY; const evaluatedAt = input.capturedAt || null; const mode = input.mode || 'AUTO'; const units = specification.units.length ? specification.units : [{ unitId: `${specification.specificationId}:unit:1`, index: 1, route: specification.generationRoute, inputState: specification.inputState, startState: specification.startState, desiredChange: specification.desiredChange, endState: specification.endState, intermediateStateId: null, dependsOnUnitIds: [], requiredAssetIds: specification.provenance.assetIds, referenceDependencyIds: specification.referenceDependencies.map(ref => ref.dependencyId), readiness: specification.readiness, provenance: { specificationId: specification.specificationId, shotId: specification.shotId, sceneId: specification.sceneId } }];
  const decisions = units.map(unit => routingForUnit(specification, unit, registry, mode, input.selectedModelId || null, input.fallbackModelIds || [], evaluatedAt)); const requirements = extractProviderRequirements(specification);
  return { specificationId: specification.specificationId, route: specification.generationRoute, requirements, decisions: decisions.map(item => item.decision), requests: decisions.flatMap(item => item.request ? [item.request] : []), serializations: decisions.flatMap(item => item.serialization ? [item.serialization] : []), registryVersion: registry.registryVersion, capabilityVersion: registry.capabilityVersion, routingAlgorithmVersion: PROVIDER_ROUTING_ALGORITHM_VERSION, dataAvailability: { providerCapabilities: registry.models.some(model => model.verification === 'VERIFIED') ? 'AVAILABLE' : 'UNVERIFIED', price: registry.models.some(model => model.telemetry.priceDataState === 'AVAILABLE') ? 'AVAILABLE' : 'UNKNOWN', quality: registry.models.some(model => model.telemetry.qualityDataState === 'AVAILABLE') ? 'AVAILABLE' : 'UNKNOWN', speed: registry.models.some(model => model.telemetry.speedDataState === 'AVAILABLE') ? 'AVAILABLE' : 'UNKNOWN' }, provenance: { source: 'P4_PHASE_3_CANONICAL_SPECIFICATION', specificationId: specification.specificationId, generationUnitIds: units.map(unit => unit.unitId), evaluatedAt } };
}

export function buildProviderRoutingReport(input: { specifications: VisualGenerationSpecification[]; blockedSpecifications?: VisualGenerationSpecification[]; registry?: ProviderRoutingRegistry; capturedAt?: string | null; snapshotId?: string | null }): ProviderRoutingReport {
  const routes = [...input.specifications, ...(input.blockedSpecifications || [])].map(specification => buildProviderRouting({ specification, registry: input.registry, capturedAt: input.capturedAt, snapshotId: input.snapshotId })).filter((route): route is ProviderRoutingDecision => Boolean(route));
  return { schemaVersion: 'provider-routing.v1', algorithmVersion: PROVIDER_ROUTING_ALGORITHM_VERSION, scope: 'LONG_FORM', registry: input.registry || PROVIDER_ROUTING_REGISTRY, routes, gaps: uniq(routes.flatMap(route => route.decisions.flatMap(decision => [...decision.blockers.map(blocker => blocker.message), ...decision.risks.map(risk => risk.message)]))), provenance: { source: 'P4_PHASE_3_CANONICAL_SPECIFICATION', capturedAt: input.capturedAt || null, snapshotId: input.snapshotId || null, algorithmVersions: [PROVIDER_ROUTING_ALGORITHM_VERSION, PROVIDER_REGISTRY_VERSION, PROVIDER_CAPABILITY_VERSION] } };
}

export function normalizeProviderRoutingReport(value: unknown): ProviderRoutingReport | null { if (!value || typeof value !== 'object') return null; const report = value as Partial<ProviderRoutingReport>; return report.schemaVersion === 'provider-routing.v1' && report.algorithmVersion === PROVIDER_ROUTING_ALGORITHM_VERSION && report.scope === 'LONG_FORM' && Array.isArray(report.routes) ? report as ProviderRoutingReport : null; }

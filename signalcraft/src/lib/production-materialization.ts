import type { LongformOpportunity } from './longform.ts';
import type { AccountStorageIdentity } from './account-storage.ts';
import { accountStorageKey } from './account-storage.ts';

export const PRODUCTION_MATERIALIZATION_VERSION = 'production-materialization.v1';
export const PRODUCTION_MATERIALIZATION_STORAGE_KEY = 'signalcraft-longform-production-drafts-v1';

export type ProductionMaterializationState =
  | 'READY_FOR_MANUAL_SMOKE_TEST'
  | 'INSUFFICIENT_UPSTREAM_DATA'
  | 'REFERENCE_ASSET_REQUIRED'
  | 'RESEARCH_REQUIRED'
  | 'RIGHTS_REVIEW_REQUIRED'
  | 'NO_COMPATIBLE_PROVIDER_ROUTE'
  | 'LONG-FORM PRODUCTION MATERIALIZATION BLOCKED';

export type ProductionStage = {
  id: string | null;
  state: string;
};

export type ProductionMaterialization = {
  schemaVersion: typeof PRODUCTION_MATERIALIZATION_VERSION;
  productionDraftId: string;
  opportunityId: string;
  selection: 'EXPLICIT_USER_SELECTED';
  createdAt: string;
  sourceSnapshotId: string | null;
  sourceCapturedAt: string | null;
  state: ProductionMaterializationState;
  blockers: string[];
  context: {
    topic: string;
    mechanism: string;
    productionType: string;
    sampleSize: number;
    channelCount: number;
  };
  stages: {
    creativeBrief: ProductionStage;
    script: ProductionStage & { architectureId: string | null };
    storyboard: ProductionStage & { sceneCount: number };
    shot: ProductionStage;
    visualAssets: { state: string; required: number; available: number; references: number; rightsReviews: number };
    generationSpecification: ProductionStage;
    generationUnit: ProductionStage & { references: number };
    providerRouting: { state: string; availableRoutes: number; compatibleModels: string[] };
    serialization: string;
    execution: string;
  };
};

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const list = (value: unknown) => Array.isArray(value) ? value : [];

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const stage = (id: string | null, state: string): ProductionStage => ({ id, state });

function firstBlocker(opportunity: LongformOpportunity) {
  const briefReport = opportunity.creativeBriefIntelligence;
  if (!briefReport?.briefs?.length) return 'CREATIVE_BRIEF_REQUIRED';
  const brief = briefReport.briefs[0];
  if (brief.readiness === 'BLOCKED') return 'CREATIVE_BRIEF_BLOCKED';
  if (brief.readiness === 'INSUFFICIENT') return 'CREATIVE_BRIEF_INSUFFICIENT';

  const scriptReport = opportunity.scriptWriting || opportunity.scriptDraft;
  if (!scriptReport?.drafts?.length) return 'SCRIPT_DRAFT_REQUIRED';
  const script = scriptReport.drafts[0];
  if (script.readiness === 'BLOCKED') return 'SCRIPT_BLOCKED';
  if (script.readiness === 'INSUFFICIENT') return 'SCRIPT_DRAFT_INSUFFICIENT';

  const storyboardReport = opportunity.storyboardIntelligence;
  if (!storyboardReport?.storyboards?.length) return 'STORYBOARD_REQUIRED';
  const storyboard = storyboardReport.storyboards[0];
  if (storyboard.readiness === 'BLOCKED') return 'STORYBOARD_BLOCKED';
  if (storyboard.readiness === 'INSUFFICIENT') return 'STORYBOARD_INSUFFICIENT';

  const scene = storyboard.scenes[0];
  if (!scene) return 'SHOT_REQUIRED';
  const shot = scene.shots[0];
  if (!shot) return 'SHOT_REQUIRED';
  if (scene.feasibility === 'REQUIRES_RESEARCH') return 'RESEARCH_REQUIRED';
  if (scene.feasibility === 'RIGHTS_REVIEW_REQUIRED') return 'RIGHTS_REVIEW_REQUIRED';

  const assets = opportunity.visualAssetIntelligence?.packages?.[0];
  if (!assets) return 'VISUAL_ASSET_PACKAGE_REQUIRED';
  if (assets.rightsReviews.length) return 'RIGHTS_REVIEW_REQUIRED';
  if (assets.missingAssets.length) return 'REFERENCE_ASSET_REQUIRED';

  const specs = opportunity.visualGenerationSpecifications;
  if (!specs?.specifications?.length) {
    if (specs?.blockedSpecifications?.length) return 'GENERATION_SPEC_BLOCKED';
    return 'GENERATION_SPEC_REQUIRED';
  }
  const specification = specs.specifications[0];
  if (specification.readiness === 'NEEDS_REFERENCE') return 'REFERENCE_ASSET_REQUIRED';
  if (specification.readiness === 'NEEDS_RIGHTS_REVIEW') return 'RIGHTS_REVIEW_REQUIRED';
  if (specification.readiness === 'BLOCKED') return 'GENERATION_SPEC_HARD_LOSS';

  const unit = specification.units[0];
  if (!unit) return 'GENERATION_UNIT_REQUIRED';
  if (!opportunity.providerRouting?.routes?.length) return 'NO_COMPATIBLE_PROVIDER_ROUTE';
  return null;
}

/**
 * Convert exactly one already-selected Long-form opportunity into a compact,
 * traceable production record. This function never invents downstream
 * objects: IDs are copied only from existing P3/P4 reports, and missing
 * stages remain null with an explicit blocker.
 */
export function materializeLongformProduction(input: { opportunity: LongformOpportunity; capturedAt?: string | null; snapshotId?: string | null; now?: string }): ProductionMaterialization {
  const opportunity = input.opportunity;
  const sourceSnapshotId = clean(input.snapshotId) || clean(opportunity.upstreamAssessment?.snapshotId) || null;
  const sourceCapturedAt = clean(input.capturedAt) || clean(opportunity.upstreamAssessment?.capturedAt) || null;
  const productionDraftId = `production-draft:v1:${stableHash(`${opportunity.key}|${sourceSnapshotId || sourceCapturedAt || 'current'}`)}`;
  const brief = opportunity.creativeBriefIntelligence?.briefs?.[0] || null;
  const script = (opportunity.scriptWriting || opportunity.scriptDraft)?.drafts?.[0] || null;
  const storyboard = opportunity.storyboardIntelligence?.storyboards?.[0] || null;
  const scene = storyboard?.scenes?.[0] || null;
  const shot = scene?.shots?.[0] || null;
  const assets = opportunity.visualAssetIntelligence?.packages?.[0] || null;
  const specification = opportunity.visualGenerationSpecifications?.specifications?.[0] || null;
  const unit = specification?.units?.[0] || null;
  const routes = opportunity.providerRouting?.routes || [];
  const decisions = routes.flatMap(route => route.decisions || []);
  const compatibleModels = [...new Set(decisions.flatMap(decision => (decision.compatibleModels || []).filter(model => model.state === 'COMPATIBLE' || model.state === 'COMPATIBLE_WITH_DEGRADATION').map(model => model.modelId)))];
  const blocker = firstBlocker(opportunity);
  const state: ProductionMaterializationState = blocker ? (blocker === 'REFERENCE_ASSET_REQUIRED' ? 'REFERENCE_ASSET_REQUIRED' : blocker === 'RESEARCH_REQUIRED' ? 'RESEARCH_REQUIRED' : blocker === 'RIGHTS_REVIEW_REQUIRED' ? 'RIGHTS_REVIEW_REQUIRED' : blocker === 'NO_COMPATIBLE_PROVIDER_ROUTE' ? 'NO_COMPATIBLE_PROVIDER_ROUTE' : !brief ? 'INSUFFICIENT_UPSTREAM_DATA' : 'LONG-FORM PRODUCTION MATERIALIZATION BLOCKED') : 'READY_FOR_MANUAL_SMOKE_TEST';
  return {
    schemaVersion: PRODUCTION_MATERIALIZATION_VERSION,
    productionDraftId,
    opportunityId: opportunity.key,
    selection: 'EXPLICIT_USER_SELECTED',
    createdAt: input.now || new Date().toISOString(),
    sourceSnapshotId,
    sourceCapturedAt,
    state,
    blockers: blocker ? [blocker] : [],
    context: { topic: opportunity.topic, mechanism: opportunity.mechanism, productionType: opportunity.productionType, sampleSize: opportunity.sampleSize, channelCount: opportunity.channelCount },
    stages: {
      creativeBrief: stage(brief?.briefId || null, brief?.readiness || 'NOT_CREATED'),
      script: { ...stage(script?.scriptId || null, script?.readiness || 'NOT_CREATED'), architectureId: script?.architectureId || null },
      storyboard: { ...stage(storyboard?.storyboardId || null, storyboard?.readiness || 'NOT_CREATED'), sceneCount: storyboard?.scenes?.length || 0 },
      shot: stage(shot?.shotId || null, shot ? 'READY' : 'NOT_CREATED'),
      visualAssets: { state: assets?.readiness || 'NOT_CREATED', required: assets?.assets?.length || 0, available: assets?.assets?.filter(asset => asset.availability === 'AVAILABLE').length || 0, references: assets?.references?.length || 0, rightsReviews: assets?.rightsReviews?.length || 0 },
      generationSpecification: stage(specification?.specificationId || null, specification?.readiness || 'NOT_CREATED'),
      generationUnit: { ...stage(unit?.unitId || null, unit?.readiness || 'NOT_CREATED'), references: unit?.referenceDependencyIds?.length || 0 },
      providerRouting: { state: routes.length ? 'AVAILABLE' : 'NOT_AVAILABLE', availableRoutes: routes.length, compatibleModels },
      serialization: routes.length ? 'VERIFIED_BY_PROVIDER_ROUTER' : 'NOT_RUN',
      execution: routes.length ? 'RUNTIME_GATES_REQUIRED' : 'NOT_READY',
    },
  };
}

function validRecord(value: unknown): value is ProductionMaterialization {
  return Boolean(value && typeof value === 'object' && (value as ProductionMaterialization).schemaVersion === PRODUCTION_MATERIALIZATION_VERSION && typeof (value as ProductionMaterialization).productionDraftId === 'string' && typeof (value as ProductionMaterialization).opportunityId === 'string');
}

export function loadProductionMaterializations(account: AccountStorageIdentity): ProductionMaterialization[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(accountStorageKey(PRODUCTION_MATERIALIZATION_STORAGE_KEY, account)) || '[]');
    return list(raw).filter(validRecord) as ProductionMaterialization[];
  } catch { return []; }
}

export function saveProductionMaterialization(record: ProductionMaterialization, account: AccountStorageIdentity): ProductionMaterialization[] {
  if (typeof window === 'undefined') return [record];
  const next = [...loadProductionMaterializations(account).filter(item => item.productionDraftId !== record.productionDraftId), record].slice(-20);
  window.localStorage.setItem(accountStorageKey(PRODUCTION_MATERIALIZATION_STORAGE_KEY, account), JSON.stringify(next));
  return next;
}

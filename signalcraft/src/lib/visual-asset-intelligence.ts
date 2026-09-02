/**
 * P4 Phase 2 — Long-form visual asset and reference intelligence.
 *
 * This is a model-independent registry. It turns P4.1 requirements into
 * stable, auditable asset identities and production gates; it never creates
 * media, prompts, embeddings, Canvas nodes, or claims visual understanding.
 */
import type {
  AssetRequirement,
  AssetType,
  EvidenceVisualization,
  ProductionSource,
  Storyboard,
} from './storyboard-planning.ts';
import type { ConfidenceLevel } from './entry-decision.ts';

export const VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION = 'visual-asset-intelligence-v1';
export const VISUAL_ASSET_INTELLIGENCE_CONFIG = Object.freeze({ calibrationStatus: 'CALIBRATION_REQUIRED' as const, initialVersion: '1.0' });

export type VisualAssetType = 'CHARACTER' | 'ENVIRONMENT' | 'PROP' | 'EVIDENCE_IMAGE' | 'SCREENSHOT' | 'CHART_DATA' | 'CHART_RENDER' | 'DOCUMENT' | 'ARCHIVE_VIDEO' | 'ARCHIVE_IMAGE' | 'STOCK_VIDEO' | 'STOCK_IMAGE' | 'LOGO' | 'TEXT_GRAPHIC' | 'DIAGRAM_SOURCE' | 'REFERENCE_IMAGE' | 'STYLE_REFERENCE' | 'OTHER';
export type VisualAssetAvailability = 'AVAILABLE' | 'PARTIAL' | 'REFERENCE_ONLY' | 'REQUIRES_USER_INPUT' | 'REQUIRES_RESEARCH' | 'REQUIRES_CAPTURE' | 'REQUIRES_RIGHTS_REVIEW' | 'AI_GENERATABLE' | 'UNAVAILABLE' | 'BLOCKED';
export type VisualAssetSource = 'EXISTING_REPOSITORY_ASSET' | 'USER_UPLOAD' | 'USER_CAPTURE' | 'PUBLIC_EVIDENCE' | 'LICENSED_STOCK' | 'ARCHIVE' | 'AI_GENERATION_CANDIDATE' | 'GRAPHIC_RENDER' | 'RESEARCH_REQUIRED' | 'UNKNOWN';
export type AssetRights = 'NO_KNOWN_RESTRICTION' | 'PUBLIC_DOMAIN_CONFIRMED' | 'USER_OWNED' | 'LICENSED' | 'LICENSE_REQUIRED' | 'RIGHTS_REVIEW_REQUIRED' | 'UNKNOWN' | 'BLOCKED';
export type ReferenceState = 'NO_REFERENCE' | 'DESCRIPTION_ONLY' | 'REFERENCE_ONLY' | 'PARTIAL' | 'SUITABLE' | 'REQUIRES_REFERENCE' | 'BLOCKED' | 'UNKNOWN';
export type GenerationEligibility = 'ELIGIBLE' | 'ELIGIBLE_WITH_REFERENCE' | 'REFERENCE_REQUIRED' | 'NOT_RECOMMENDED' | 'NOT_ELIGIBLE' | 'BLOCKED' | 'UNKNOWN';
export type ReferenceType = 'IDENTITY_REFERENCE' | 'APPEARANCE_REFERENCE' | 'ENVIRONMENT_REFERENCE' | 'PROP_REFERENCE' | 'STYLE_REFERENCE' | 'COMPOSITION_REFERENCE' | 'EVIDENCE_REFERENCE' | 'SOURCE_REFERENCE';
export type ReferenceSource = 'USER_UPLOAD' | 'EXISTING_REPOSITORY_ASSET' | 'PUBLIC_SOURCE' | 'LICENSED_SOURCE' | 'SOURCE_VIDEO_FRAME' | 'SCREENSHOT' | 'AI_GENERATED_REFERENCE' | 'UNKNOWN';
export type ReferenceSuitability = 'SUITABLE' | 'PARTIALLY_SUITABLE' | 'UNSUITABLE' | 'UNKNOWN' | 'REQUIRES_VISION';
export type ReferencePackType = 'CHARACTER' | 'ENVIRONMENT' | 'PROP' | 'EVIDENCE' | 'STYLE';
export type ReferencePackState = 'COMPLETE' | 'PARTIAL' | 'DESCRIPTION_ONLY' | 'REQUIRES_REFERENCE' | 'REQUIRES_RESEARCH' | 'BLOCKED' | 'INSUFFICIENT';
export type ContinuityLockType = 'IDENTITY_LOCK' | 'WARDROBE_LOCK' | 'ENVIRONMENT_LOCK' | 'PROP_LOCK' | 'STYLE_LOCK' | 'TEMPORAL_STATE_LOCK' | 'COMPOSITION_CONTINUITY';
export type LockStrength = 'HARD' | 'SOFT';
export type ProductionRoute = 'REUSE_EXISTING' | 'CAPTURE' | 'SOURCE' | 'LICENSE' | 'GENERATE_LATER' | 'CREATE_GRAPHIC' | 'RESEARCH_FIRST' | 'BLOCKED';
export type AssetGapType = 'NO_REFERENCE' | 'NO_SOURCE_ASSET' | 'NO_EVIDENCE_SOURCE' | 'RIGHTS_UNKNOWN' | 'REFERENCE_INCOMPLETE' | 'USER_INPUT_REQUIRED' | 'VISION_REQUIRED' | 'RESEARCH_REQUIRED' | 'GENERATION_REFERENCE_REQUIRED' | 'FRAME_EXTRACTION_REQUIRED' | 'CRITICAL_REFERENCE_MISSING' | 'KNOWN_RIGHTS_BLOCKER';
export type AssetPackageReadiness = 'READY_FOR_PROMPT_PLANNING' | 'READY_WITH_CAUTION' | 'NEEDS_ASSETS' | 'NEEDS_RIGHTS_REVIEW' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type AssetDataAuditState = 'AVAILABLE' | 'DERIVABLE' | 'PARTIAL' | 'REQUIRES_VISION' | 'REQUIRES_ASSET' | 'REQUIRES_RESEARCH' | 'REQUIRES_RIGHTS_REVIEW' | 'REQUIRES_USER_INPUT' | 'UNAVAILABLE';

export type VisualAssetProvenance = { storyboardId: string | null; sceneIds: string[]; shotIds: string[]; scriptId: string | null; claimIds: string[]; evidenceIds: string[]; sourceAssetId: string | null; sourceUrl: string | null; algorithmVersion: string; capturedAt: string | null; snapshotId: string | null };
export type VisualAssetIdentity = { entityId: string; label: string; continuityRole: 'RECURRING_CHARACTER' | 'RECURRING_ENVIRONMENT' | 'RECURRING_PROP' | 'EVIDENCE_SOURCE' | 'ONE_OFF' | 'UNKNOWN'; state: string | null; variants: string[] };
export type VisualAsset = { assetId: string; assetVersion: string; assetType: VisualAssetType; requirementIds: string[]; sceneIds: string[]; shotIds: string[]; identity: VisualAssetIdentity; availability: VisualAssetAvailability; source: VisualAssetSource; rights: AssetRights; referenceState: ReferenceState; generationEligibility: GenerationEligibility; continuity: { lockTypes: ContinuityLockType[]; variantStates: string[] }; confidence: ConfidenceLevel; reasons: string[]; risks: string[]; blockers: string[]; provenance: VisualAssetProvenance };
export type Reference = { referenceId: string; assetId: string; referenceType: ReferenceType; source: ReferenceSource; sourceAssetId: string | null; sourceUrl: string | null; capturedAt: string | null; rights: AssetRights; suitability: ReferenceSuitability; usedByAssetIds: string[]; confidence: ConfidenceLevel; version: string; provenance: VisualAssetProvenance };
export type ReferencePack = { referencePackId: string; packVersion: string; packType: ReferencePackType; canonicalAssetId: string; state: ReferencePackState; referenceIds: string[]; assetIds: string[]; completeness: string; continuityRole: VisualAssetIdentity['continuityRole']; confidence: ConfidenceLevel; risks: string[]; blockers: string[]; provenance: VisualAssetProvenance };
export type ContinuityLock = { lockId: string; type: ContinuityLockType; strength: LockStrength; assetId: string; sceneIds: string[]; shotIds: string[]; assetVersion: string; state: 'ACTIVE' | 'CONFLICT' | 'INCOMPLETE'; notes: string[]; provenance: VisualAssetProvenance };
export type SceneAssetManifest = { sceneId: string; requiredAssetIds: string[]; optionalAssetIds: string[]; evidenceAssetIds: string[]; referencePackIds: string[]; missingAssetIds: string[]; routes: ProductionRoute[]; provenance: VisualAssetProvenance };
export type ShotAssetManifest = { shotId: string; sceneId: string; requiredAssetIds: string[]; evidenceAssetIds: string[]; referencePackIds: string[]; missingAssetIds: string[]; routes: ProductionRoute[]; provenance: VisualAssetProvenance };
export type AssetDependency = { fromId: string; toId: string; relation: 'REQUIRES_ASSET' | 'REQUIRES_REFERENCE' | 'REQUIRES_EVIDENCE' | 'REQUIRES_RIGHTS_REVIEW' | 'USED_BY_SCENE' | 'USED_BY_SHOT' };
export type RightsReviewRequirement = { requirementId: string; assetId: string; rights: AssetRights; reason: string; provenance: VisualAssetProvenance };
export type AssetResearchRequirement = { requirementId: string; assetId: string; reason: string; provenance: VisualAssetProvenance };
export type AssetGap = { gapId: string; type: AssetGapType; assetId: string | null; sceneIds: string[]; shotIds: string[]; severity: 'INFO' | 'WARNING' | 'BLOCKER'; message: string; provenance: VisualAssetProvenance };

export type ExistingAssetInput = { assetId?: string; assetType?: VisualAssetType; label?: string; source?: VisualAssetSource; sourceAssetId?: string | null; sourceUrl?: string | null; availability?: VisualAssetAvailability; rights?: AssetRights; metadata?: { dimensions?: string; format?: string; durationSeconds?: number; aspectRatio?: string; fileSizeBytes?: number } };
export type ExistingReferenceInput = { referenceId?: string; assetId?: string; referenceType?: ReferenceType; source?: ReferenceSource; sourceAssetId?: string | null; sourceUrl?: string | null; rights?: AssetRights; suitability?: ReferenceSuitability; capturedAt?: string | null; version?: string };
export type VisualAssetPackage = { packageId: string; packageVersion: string; storyboardId: string; assets: VisualAsset[]; references: Reference[]; referencePacks: ReferencePack[]; continuityLocks: ContinuityLock[]; dependencyGraph: AssetDependency[]; sceneManifests: SceneAssetManifest[]; shotManifests: ShotAssetManifest[]; missingAssets: AssetGap[]; rightsReviews: RightsReviewRequirement[]; researchRequirements: AssetResearchRequirement[]; dataAvailability: Record<string, AssetDataAuditState>; readiness: AssetPackageReadiness; confidence: ConfidenceLevel; reasons: string[]; risks: string[]; blockers: string[]; provenance: VisualAssetProvenance };
export type VisualAssetIntelligenceReport = { schemaVersion: 'visual-asset-intelligence.v1'; algorithmVersion: typeof VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION; scope: 'LONG_FORM'; packages: VisualAssetPackage[]; blockedPackages: VisualAssetPackage[]; gaps: string[]; provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof VISUAL_ASSET_INTELLIGENCE_CONFIG.calibrationStatus }; };

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const minConfidence = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => rank[a] < rank[b] ? a : b;
const uniq = <T>(values: T[]) => [...new Set(values)];
const norm = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const hash = (value: string) => { let h = 0x811c9dc5; for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const provenance = (storyboard: Storyboard | null, sceneIds: string[], shotIds: string[], capturedAt: string | null, snapshotId: string | null, claimIds: string[] = [], evidenceIds: string[] = [], sourceAssetId: string | null = null, sourceUrl: string | null = null): VisualAssetProvenance => ({ storyboardId: storyboard?.storyboardId || null, sceneIds: uniq(sceneIds), shotIds: uniq(shotIds), scriptId: storyboard?.scriptId || null, claimIds: uniq(claimIds), evidenceIds: uniq(evidenceIds), sourceAssetId, sourceUrl, algorithmVersion: VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION, capturedAt, snapshotId });
const mapType = (type: AssetType, evidence: boolean): VisualAssetType => {
  if (type === 'SCREENSHOT') return 'SCREENSHOT';
  if (type === 'CHART') return 'CHART_DATA';
  if (type === 'DIAGRAM') return 'DIAGRAM_SOURCE';
  if (type === 'ARCHIVE') return 'ARCHIVE_VIDEO';
  if (type === 'STOCK') return 'STOCK_VIDEO';
  if (evidence) return 'EVIDENCE_IMAGE';
  const map: Record<AssetType, VisualAssetType> = { CHARACTER: 'CHARACTER', LOCATION: 'ENVIRONMENT', PROP: 'PROP', SCREENSHOT: 'SCREENSHOT', CHART: 'CHART_DATA', DIAGRAM: 'DIAGRAM_SOURCE', ARCHIVE: 'ARCHIVE_VIDEO', STOCK: 'STOCK_VIDEO', IMAGE: 'REFERENCE_IMAGE', VIDEO: 'OTHER', LOGO: 'LOGO', DOCUMENT: 'DOCUMENT', OTHER: 'OTHER' };
  return map[type];
};
const evidenceFor = (requirement: AssetRequirement, evidence: EvidenceVisualization[]) => evidence.filter(item => item.requiredAsset === requirement.assetId);
const recurringRole = (type: VisualAssetType): VisualAssetIdentity['continuityRole'] => type === 'CHARACTER' ? 'RECURRING_CHARACTER' : type === 'ENVIRONMENT' ? 'RECURRING_ENVIRONMENT' : type === 'PROP' ? 'RECURRING_PROP' : type.startsWith('EVIDENCE') ? 'EVIDENCE_SOURCE' : 'ONE_OFF';
const sourceFor = (source: ProductionSource, type: VisualAssetType): VisualAssetSource => source === 'EXISTING_ASSET' ? 'EXISTING_REPOSITORY_ASSET' : source === 'USER_PROVIDED' ? 'USER_UPLOAD' : source === 'PUBLIC_EVIDENCE' ? 'PUBLIC_EVIDENCE' : source === 'LICENSED_STOCK' ? 'LICENSED_STOCK' : source === 'AI_GENERATABLE' ? 'AI_GENERATION_CANDIDATE' : source === 'CREATOR_CAPTURE' ? 'USER_CAPTURE' : source === 'REQUIRES_RESEARCH' ? 'RESEARCH_REQUIRED' : type === 'CHART_RENDER' ? 'GRAPHIC_RENDER' : 'UNKNOWN';
const rightsFor = (rights: AssetRequirement['rightsStatus'], source: VisualAssetSource): AssetRights => rights === 'BLOCKED' ? 'BLOCKED' : rights === 'LICENSE_REQUIRED' ? 'LICENSE_REQUIRED' : rights === 'RIGHTS_REVIEW_REQUIRED' ? 'RIGHTS_REVIEW_REQUIRED' : rights === 'IP_DEPENDENCY_UNKNOWN' ? 'UNKNOWN' : source === 'USER_UPLOAD' || source === 'USER_CAPTURE' ? 'USER_OWNED' : source === 'PUBLIC_EVIDENCE' ? 'RIGHTS_REVIEW_REQUIRED' : 'UNKNOWN';
const routeFor = (asset: VisualAsset): ProductionRoute => { if (asset.blockers.length) return 'BLOCKED'; if (asset.source === 'EXISTING_REPOSITORY_ASSET' && asset.availability === 'AVAILABLE') return 'REUSE_EXISTING'; if (asset.availability === 'REQUIRES_CAPTURE' || asset.source === 'USER_CAPTURE') return 'CAPTURE'; if (asset.source === 'PUBLIC_EVIDENCE') return 'SOURCE'; if (asset.rights === 'LICENSE_REQUIRED') return 'LICENSE'; if (asset.assetType === 'CHART_RENDER' || asset.assetType === 'TEXT_GRAPHIC' || asset.assetType === 'DIAGRAM_SOURCE') return 'CREATE_GRAPHIC'; if (asset.generationEligibility === 'ELIGIBLE' || asset.generationEligibility === 'ELIGIBLE_WITH_REFERENCE') return 'GENERATE_LATER'; if (asset.availability === 'REQUIRES_RESEARCH') return 'RESEARCH_FIRST'; return 'GENERATE_LATER'; };

function classifyRequirement(requirement: AssetRequirement, storyboard: Storyboard, existing: ExistingAssetInput[], refs: ExistingReferenceInput[], capturedAt: string | null, snapshotId: string | null): VisualAsset {
  const evidence = evidenceFor(requirement, storyboard.evidenceVisualizations);
  const type = mapType(requirement.type, evidence.length > 0 || requirement.source === 'PUBLIC_EVIDENCE');
  const matchingAsset = existing.find(item => (item.assetId && item.assetId === requirement.assetId) || (item.label && norm(item.label) === norm(requirement.label)));
  const assetId = matchingAsset?.assetId || `va:${mapType(requirement.type, evidence.length > 0 || requirement.source === 'PUBLIC_EVIDENCE').toLocaleLowerCase()}:${hash(norm(requirement.label) || requirement.assetId)}`;
  const matchingRefs = refs.filter(item => item.assetId === (matchingAsset?.assetId || requirement.assetId || assetId));
  const sceneIds = uniq(requirement.usedBySceneIds);
  const shotIds = storyboard.scenes.flatMap(scene => scene.assetIds.includes(requirement.assetId) ? scene.shots.map(shot => shot.shotId) : []);
  const source = matchingAsset?.source || sourceFor(requirement.source, type);
  const rights = matchingAsset?.rights || rightsFor(requirement.rightsStatus, source);
  const isEvidence = type === 'EVIDENCE_IMAGE' || type === 'SCREENSHOT' || evidence.length > 0;
  const isChart = requirement.type === 'CHART';
  const available = matchingAsset?.availability || (requirement.availability === 'AVAILABLE' ? 'PARTIAL' : requirement.availability === 'REQUIRES_ASSET' ? 'UNAVAILABLE' : requirement.availability === 'REQUIRES_RESEARCH' ? 'REQUIRES_RESEARCH' : 'REFERENCE_ONLY');
  const sourceUrl = matchingAsset?.sourceUrl || null;
  const blockers: string[] = [];
  const risks: string[] = [];
  const reasons: string[] = [];
  const referenceState: ReferenceState = matchingRefs.length ? (matchingRefs.some(ref => ref.suitability === 'SUITABLE') ? 'SUITABLE' : 'PARTIAL') : (type === 'CHARACTER' || type === 'ENVIRONMENT' || type === 'PROP' ? 'DESCRIPTION_ONLY' : 'NO_REFERENCE');
  let generation: GenerationEligibility = 'UNKNOWN';
  if (isEvidence && source === 'AI_GENERATION_CANDIDATE') { blockers.push('EVIDENCE_ASSET_REPLACED_BY_SYNTHETIC'); generation = 'NOT_ELIGIBLE'; }
  else if (isEvidence) generation = 'NOT_RECOMMENDED';
  else if (matchingAsset?.availability === 'AVAILABLE' && rights !== 'BLOCKED') generation = matchingRefs.length ? 'ELIGIBLE_WITH_REFERENCE' : 'ELIGIBLE';
  else if (type === 'CHARACTER' || type === 'ENVIRONMENT' || type === 'PROP') generation = matchingRefs.length ? 'ELIGIBLE_WITH_REFERENCE' : 'REFERENCE_REQUIRED';
  else if (source === 'AI_GENERATION_CANDIDATE') generation = 'ELIGIBLE_WITH_REFERENCE';
  if (isEvidence && !matchingAsset && !evidence.some(item => item.availability === 'AVAILABLE' || item.source === 'PUBLIC_EVIDENCE')) { risks.push('EVIDENCE_ASSET_UNAVAILABLE'); }
  if (!matchingRefs.length && (type === 'CHARACTER' || type === 'ENVIRONMENT' || type === 'PROP')) { risks.push(`${type}_REFERENCE_MISSING`); reasons.push('ASSET_REFERENCE_REQUIRED'); }
  if (type === 'SCREENSHOT' && !matchingAsset) { risks.push('USER_INPUT_REQUIRED'); reasons.push('ASSET_USER_INPUT_REQUIRED'); }
  if (isChart) reasons.push('ASSET_RESEARCH_REQUIRED');
  if (rights === 'UNKNOWN' || rights === 'RIGHTS_REVIEW_REQUIRED' || rights === 'LICENSE_REQUIRED') risks.push('RIGHTS_STATUS_UNKNOWN');
  if (rights === 'BLOCKED') blockers.push('KNOWN_RIGHTS_BLOCKER');
  if (matchingAsset) reasons.push('ASSET_REFERENCE_AVAILABLE');
  if (source === 'AI_GENERATION_CANDIDATE' && !isEvidence) reasons.push('ASSET_AI_GENERATION_ELIGIBLE');
  return { assetId, assetVersion: VISUAL_ASSET_INTELLIGENCE_CONFIG.initialVersion, assetType: isChart && matchingAsset ? 'CHART_RENDER' : type, requirementIds: [requirement.assetId], sceneIds, shotIds, identity: { entityId: assetId, label: requirement.label || requirement.assetId, continuityRole: recurringRole(type), state: null, variants: [] }, availability: blockers.length ? 'BLOCKED' : available, source, rights, referenceState, generationEligibility: blockers.length ? 'BLOCKED' : generation, continuity: { lockTypes: type === 'CHARACTER' ? ['IDENTITY_LOCK', 'WARDROBE_LOCK'] : type === 'ENVIRONMENT' ? ['ENVIRONMENT_LOCK'] : type === 'PROP' ? ['PROP_LOCK'] : [], variantStates: [] }, confidence: minConfidence(storyboard.confidence, matchingRefs.length ? 'MEDIUM' : 'LOW'), reasons: uniq(reasons), risks: uniq(risks), blockers: uniq(blockers), provenance: provenance(storyboard, sceneIds, shotIds, capturedAt, snapshotId, [], evidence.map(item => item.evidenceId), matchingAsset?.sourceAssetId || null, sourceUrl) };
}

function makeReferences(asset: VisualAsset, inputs: ExistingReferenceInput[], storyboard: Storyboard, capturedAt: string | null, snapshotId: string | null): Reference[] {
  const seen = new Set<string>();
  return inputs.filter(ref => ref.assetId === asset.assetId || asset.requirementIds.includes(ref.assetId || '')).filter(ref => { const key = `${ref.sourceAssetId || ''}|${ref.sourceUrl || ''}|${ref.assetId || ''}`; if (seen.has(key)) return false; seen.add(key); return true; }).map((ref, index) => ({ referenceId: ref.referenceId || `ref:${asset.assetId}:${index + 1}`, assetId: asset.assetId, referenceType: ref.referenceType || (asset.assetType === 'CHARACTER' ? 'IDENTITY_REFERENCE' : asset.assetType === 'ENVIRONMENT' ? 'ENVIRONMENT_REFERENCE' : asset.assetType === 'PROP' ? 'PROP_REFERENCE' : 'SOURCE_REFERENCE'), source: ref.source || 'UNKNOWN', sourceAssetId: ref.sourceAssetId || null, sourceUrl: ref.sourceUrl || null, capturedAt: ref.capturedAt || capturedAt, rights: ref.rights || 'UNKNOWN', suitability: ref.suitability || 'REQUIRES_VISION', usedByAssetIds: [asset.assetId], confidence: ref.suitability === 'SUITABLE' ? 'MEDIUM' : 'LOW', version: ref.version || VISUAL_ASSET_INTELLIGENCE_CONFIG.initialVersion, provenance: provenance(storyboard, asset.sceneIds, asset.shotIds, capturedAt, snapshotId, [], [], ref.sourceAssetId || null, ref.sourceUrl || null) }))
}

export function buildVisualAssetIntelligence(input: { storyboard: Storyboard | null; existingAssets?: ExistingAssetInput[]; existingReferences?: ExistingReferenceInput[]; capturedAt?: string | null; snapshotId?: string | null }): VisualAssetIntelligenceReport {
  const storyboard = input.storyboard;
  const capturedAt = input.capturedAt || null;
  const snapshotId = input.snapshotId || null;
  if (!storyboard) return { schemaVersion: 'visual-asset-intelligence.v1', algorithmVersion: VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION, scope: 'LONG_FORM', packages: [], blockedPackages: [], gaps: ['STORYBOARD_REQUIRED'], provenance: { source: 'PUBLIC_YOUTUBE_METADATA', capturedAt, snapshotId, algorithmVersions: [VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION], calibrationStatus: VISUAL_ASSET_INTELLIGENCE_CONFIG.calibrationStatus } };
  const existing = input.existingAssets || [];
  const refs = input.existingReferences || [];
  const assets = storyboard.assetRequirements.map(req => classifyRequirement(req, storyboard, existing, refs, capturedAt, snapshotId));
  const referencePacks: ReferencePack[] = [];
  const allReferences = assets.flatMap(asset => makeReferences(asset, refs, storyboard, capturedAt, snapshotId));
  for (const asset of assets.filter(item => ['CHARACTER', 'ENVIRONMENT', 'PROP', 'EVIDENCE_IMAGE', 'SCREENSHOT', 'STYLE_REFERENCE'].includes(item.assetType))) {
    const assetRefs = allReferences.filter(ref => ref.assetId === asset.assetId);
    const packType: ReferencePackType = asset.assetType === 'CHARACTER' ? 'CHARACTER' : asset.assetType === 'ENVIRONMENT' ? 'ENVIRONMENT' : asset.assetType === 'PROP' ? 'PROP' : asset.assetType === 'STYLE_REFERENCE' ? 'STYLE' : 'EVIDENCE';
    const blocked = asset.blockers.length > 0;
    const complete = assetRefs.length > 0 && assetRefs.every(ref => ref.suitability === 'SUITABLE');
    const state: ReferencePackState = blocked ? 'BLOCKED' : complete ? 'COMPLETE' : assetRefs.length ? 'PARTIAL' : ['CHARACTER', 'ENVIRONMENT', 'PROP'].includes(asset.assetType) ? 'DESCRIPTION_ONLY' : 'REQUIRES_REFERENCE';
    referencePacks.push({ referencePackId: `pack:${packType.toLocaleLowerCase()}:${hash(asset.assetId)}`, packVersion: VISUAL_ASSET_INTELLIGENCE_CONFIG.initialVersion, packType, canonicalAssetId: asset.assetId, state, referenceIds: assetRefs.map(ref => ref.referenceId), assetIds: [asset.assetId], completeness: complete ? 'source and suitability recorded' : 'description alone is not a complete reference pack', continuityRole: asset.identity.continuityRole, confidence: minConfidence(asset.confidence, complete ? 'MEDIUM' : 'LOW'), risks: complete ? [] : ['REFERENCE_INCOMPLETE'], blockers: blocked ? asset.blockers : [], provenance: provenance(storyboard, asset.sceneIds, asset.shotIds, capturedAt, snapshotId) });
  }
  const byRequirement = new Map(storyboard.assetRequirements.map((req, index) => [req.assetId, assets[index]]));
  const sceneManifests = storyboard.scenes.map(scene => {
    const required = uniq(scene.assetIds.map(id => byRequirement.get(id)?.assetId || id));
    const evidence = uniq(scene.evidenceVisualizationIds.map(id => storyboard.evidenceVisualizations.find(item => item.visualizationId === id)?.requiredAsset).filter((id): id is string => Boolean(id)).map(id => byRequirement.get(id)?.assetId || id));
    const missing = required.filter(id => { const asset = assets.find(item => item.assetId === id); return !asset || ['UNAVAILABLE', 'BLOCKED', 'REQUIRES_USER_INPUT', 'REQUIRES_CAPTURE', 'REQUIRES_RESEARCH'].includes(asset.availability); });
    const routes = uniq(required.map(id => { const asset = assets.find(item => item.assetId === id); return asset ? routeFor(asset) : 'BLOCKED'; }));
    return { sceneId: scene.semanticScene.sceneId, requiredAssetIds: required, optionalAssetIds: [], evidenceAssetIds: evidence, referencePackIds: uniq(required.map(id => referencePacks.find(pack => pack.canonicalAssetId === id)?.referencePackId).filter((id): id is string => Boolean(id))), missingAssetIds: missing, routes, provenance: provenance(storyboard, [scene.semanticScene.sceneId], scene.shots.map(shot => shot.shotId), capturedAt, snapshotId) };
  });
  const shotManifests = storyboard.scenes.flatMap(scene => scene.shots.map(shot => { const required = uniq(scene.assetIds.map(id => byRequirement.get(id)?.assetId || id)); const evidence = scene.evidenceVisualizationIds.length ? required.filter(id => assets.find(asset => asset.assetId === id)?.assetType === 'EVIDENCE_IMAGE' || assets.find(asset => asset.assetId === id)?.assetType === 'SCREENSHOT') : []; const missing = required.filter(id => assets.find(asset => asset.assetId === id)?.availability !== 'AVAILABLE'); return { shotId: shot.shotId, sceneId: scene.semanticScene.sceneId, requiredAssetIds: required, evidenceAssetIds: evidence, referencePackIds: uniq(required.map(id => referencePacks.find(pack => pack.canonicalAssetId === id)?.referencePackId).filter((id): id is string => Boolean(id))), missingAssetIds: missing, routes: uniq(required.map(id => { const asset = assets.find(item => item.assetId === id); return asset ? routeFor(asset) : 'BLOCKED'; })), provenance: provenance(storyboard, [scene.semanticScene.sceneId], [shot.shotId], capturedAt, snapshotId) }; }));
  const gaps: AssetGap[] = [];
  const rightsReviews: RightsReviewRequirement[] = [];
  const researchRequirements: AssetResearchRequirement[] = [];
  for (const asset of assets) {
    const base = { sceneIds: asset.sceneIds, shotIds: asset.shotIds, provenance: asset.provenance };
    if (asset.referenceState === 'DESCRIPTION_ONLY') gaps.push({ gapId: `gap:reference:${asset.assetId}`, type: 'CRITICAL_REFERENCE_MISSING', assetId: asset.assetId, ...base, severity: asset.identity.continuityRole === 'RECURRING_CHARACTER' ? 'BLOCKER' : 'WARNING', message: 'Recurring visual identity has description but no usable reference.' });
    if (asset.assetType === 'SCREENSHOT' && asset.availability !== 'AVAILABLE') gaps.push({ gapId: `gap:capture:${asset.assetId}`, type: 'USER_INPUT_REQUIRED', assetId: asset.assetId, ...base, severity: 'BLOCKER', message: 'Screenshot requires an actual user/source capture; synthetic substitute is not accepted.' });
    if (asset.assetType === 'EVIDENCE_IMAGE' && asset.availability !== 'AVAILABLE') gaps.push({ gapId: `gap:evidence:${asset.assetId}`, type: 'NO_EVIDENCE_SOURCE', assetId: asset.assetId, ...base, severity: 'BLOCKER', message: 'Evidence visual must trace to a real source asset.' });
    if (asset.rights === 'RIGHTS_REVIEW_REQUIRED' || asset.rights === 'LICENSE_REQUIRED' || asset.rights === 'UNKNOWN') rightsReviews.push({ requirementId: `rights:${asset.assetId}`, assetId: asset.assetId, rights: asset.rights, reason: 'Source rights are not confirmed by public availability alone.', provenance: asset.provenance });
    if (asset.availability === 'REQUIRES_RESEARCH' || asset.assetType === 'CHART_DATA') researchRequirements.push({ requirementId: `research:${asset.assetId}`, assetId: asset.assetId, reason: 'Real data/source is required before rendering or citing this asset.', provenance: asset.provenance });
    if (asset.generationEligibility === 'REFERENCE_REQUIRED') gaps.push({ gapId: `gap:generation:${asset.assetId}`, type: 'GENERATION_REFERENCE_REQUIRED', assetId: asset.assetId, ...base, severity: 'WARNING', message: 'AI generation may be considered only after a suitable reference is supplied.' });
  }
  const blockers = uniq([...storyboard.blockers.map(item => item.code), ...assets.flatMap(asset => asset.blockers)]);
  const risks = uniq([...assets.flatMap(asset => asset.risks), ...gaps.filter(gap => gap.severity !== 'INFO').map(gap => gap.type)]);
  const readiness: AssetPackageReadiness = storyboard.readiness === 'BLOCKED' || blockers.length ? 'BLOCKED' : gaps.some(gap => gap.severity === 'BLOCKER') ? 'NEEDS_ASSETS' : rightsReviews.length ? 'NEEDS_RIGHTS_REVIEW' : assets.some(asset => asset.referenceState === 'DESCRIPTION_ONLY' || asset.confidence === 'LOW') ? 'READY_WITH_CAUTION' : 'READY_FOR_PROMPT_PLANNING';
  const locks: ContinuityLock[] = assets.flatMap(asset => asset.continuity.lockTypes.map(type => ({ lockId: `lock:${type.toLocaleLowerCase()}:${hash(asset.assetId)}`, type, strength: type === 'TEMPORAL_STATE_LOCK' ? 'SOFT' : 'HARD', assetId: asset.assetId, sceneIds: asset.sceneIds, shotIds: asset.shotIds, assetVersion: asset.assetVersion, state: 'ACTIVE', notes: ['Canonical identity is shared across all linked scenes and shots.'], provenance: asset.provenance })));
  const dependencyGraph: AssetDependency[] = assets.flatMap(asset => [
    ...asset.sceneIds.map(sceneId => ({ fromId: sceneId, toId: asset.assetId, relation: 'USED_BY_SCENE' as const })),
    ...asset.shotIds.map(shotId => ({ fromId: shotId, toId: asset.assetId, relation: 'USED_BY_SHOT' as const })),
    ...(asset.referenceState === 'DESCRIPTION_ONLY' || asset.referenceState === 'REQUIRES_REFERENCE' ? [{ fromId: asset.assetId, toId: `ref:${asset.assetId}`, relation: 'REQUIRES_REFERENCE' as const }] : []),
    ...(asset.rights !== 'NO_KNOWN_RESTRICTION' && asset.rights !== 'USER_OWNED' ? [{ fromId: asset.assetId, toId: `rights:${asset.assetId}`, relation: 'REQUIRES_RIGHTS_REVIEW' as const }] : []),
  ]);
  const dataAvailability: Record<string, AssetDataAuditState> = {
    storyboard: 'AVAILABLE', requirements: assets.length ? 'DERIVABLE' : 'UNAVAILABLE', existingAssets: existing.length ? 'AVAILABLE' : 'REQUIRES_ASSET', references: allReferences.length ? 'AVAILABLE' : 'REQUIRES_ASSET', visualUnderstanding: 'REQUIRES_VISION', embeddings: 'UNAVAILABLE', screenshots: assets.some(asset => asset.assetType === 'SCREENSHOT' && asset.availability === 'AVAILABLE') ? 'AVAILABLE' : 'REQUIRES_USER_INPUT', chartData: assets.some(asset => asset.assetType === 'CHART_DATA') ? 'REQUIRES_RESEARCH' : 'UNAVAILABLE', rights: rightsReviews.length ? 'REQUIRES_RIGHTS_REVIEW' : 'PARTIAL', userInputs: gaps.some(gap => gap.type === 'USER_INPUT_REQUIRED') ? 'REQUIRES_USER_INPUT' : 'PARTIAL', sourceFrames: 'REQUIRES_ASSET', canvasAssets: 'UNAVAILABLE',
  };
  const packageValue: VisualAssetPackage = { packageId: `vap:${storyboard.storyboardId}`, packageVersion: VISUAL_ASSET_INTELLIGENCE_CONFIG.initialVersion, storyboardId: storyboard.storyboardId, assets, references: allReferences, referencePacks, continuityLocks: locks, dependencyGraph, sceneManifests, shotManifests, missingAssets: gaps, rightsReviews, researchRequirements, dataAvailability, readiness, confidence: minConfidence(storyboard.confidence, gaps.length ? 'LOW' : 'MEDIUM'), reasons: uniq([readiness === 'READY_FOR_PROMPT_PLANNING' ? 'ASSET_REGISTRY_COMPLETE' : 'ASSET_REFERENCE_REQUIRED', ...assets.flatMap(asset => asset.reasons)]), risks, blockers, provenance: provenance(storyboard, storyboard.scenes.map(scene => scene.semanticScene.sceneId), storyboard.scenes.flatMap(scene => scene.shots.map(shot => shot.shotId)), capturedAt, snapshotId) };
  return { schemaVersion: 'visual-asset-intelligence.v1', algorithmVersion: VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION, scope: 'LONG_FORM', packages: readiness === 'BLOCKED' ? [] : [packageValue], blockedPackages: readiness === 'BLOCKED' ? [packageValue] : [], gaps: gaps.map(gap => gap.message), provenance: { source: 'PUBLIC_YOUTUBE_METADATA', capturedAt, snapshotId, algorithmVersions: [VISUAL_ASSET_INTELLIGENCE_ALGORITHM_VERSION], calibrationStatus: VISUAL_ASSET_INTELLIGENCE_CONFIG.calibrationStatus } };
}

export function normalizeVisualAssetIntelligenceReport(value: unknown): VisualAssetIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<VisualAssetIntelligenceReport>;
  if (report.schemaVersion !== 'visual-asset-intelligence.v1' || report.scope !== 'LONG_FORM') return null;
  if (!Array.isArray(report.packages) || !Array.isArray(report.blockedPackages)) return null;
  return report as VisualAssetIntelligenceReport;
}

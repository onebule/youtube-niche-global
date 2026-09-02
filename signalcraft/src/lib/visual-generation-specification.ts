/**
 * P4 Phase 3 — provider-independent visual generation specifications.
 *
 * This module serializes semantic production intent only. It does not create
 * prompts, call providers, submit jobs, or write Canvas nodes.
 */
import type { ShotPurpose, ShotRequirement, Storyboard, StoryboardScene, VisualMode } from './storyboard-planning.ts';
import type { ConfidenceLevel } from './entry-decision.ts';
import type { AssetDataAuditState, VisualAsset, VisualAssetPackage } from './visual-asset-intelligence.ts';

export const VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION = 'visual-generation-specification-v1';
export const VISUAL_GENERATION_SPECIFICATION_CONFIG = Object.freeze({ maxAtomicChangesPerUnit: 2, maxSequentialActionsPerUnit: 2, maxIndependentActorsPerUnit: 2, calibrationStatus: 'CALIBRATION_REQUIRED' as const });

export type GenerationRoute = 'REUSE_EXISTING_ASSET' | 'USER_CAPTURE' | 'SOURCE_REAL_EVIDENCE' | 'SCREEN_CAPTURE' | 'CHART_RENDER' | 'GRAPHIC_RENDER' | 'TEXT_TO_IMAGE' | 'REFERENCE_IMAGE_EDIT' | 'IMAGE_TO_VIDEO' | 'TEXT_TO_VIDEO' | 'MULTI_STAGE_GENERATION' | 'RESEARCH_FIRST' | 'RIGHTS_REVIEW_FIRST' | 'USER_INPUT_REQUIRED' | 'MANUAL_PRODUCTION' | 'UNSUPPORTED' | 'BLOCKED';
export type GenerationInputState = 'TEXT_ONLY' | 'REFERENCE_IMAGE' | 'SOURCE_IMAGE' | 'SOURCE_VIDEO' | 'START_FRAME' | 'MULTIPLE_REFERENCES' | 'EXISTING_ASSET' | 'EVIDENCE_ASSET' | 'UNKNOWN';
export type VisualState = { subjects: string[]; assetIds: string[]; environment: string | null; time: string | null; objectStates: Array<{ assetId: string; state: string }>; positions: string[]; expressions: string[]; actionsAtState: string[]; evidenceContent: string[]; composition: string | null; styleReferenceIds: string[] };
export type VisualChangeType = 'CHARACTER_ACTION' | 'OBJECT_ACTION' | 'EXPRESSION_CHANGE' | 'POSITION_CHANGE' | 'CAMERA_CHANGE' | 'ENVIRONMENT_CHANGE' | 'OBJECT_STATE_CHANGE' | 'INFORMATION_REVEAL' | 'GRAPHIC_TRANSITION' | 'TIME_PROGRESS';
export type VisualChange = { changeId: string; type: VisualChangeType; description: string; source: 'SHOT_REQUIREMENT' | 'CONTINUITY_RELATION' | 'EVIDENCE_REQUIREMENT'; atomic: boolean };
export type PreserveUnchangedConstraint = { constraintId: string; type: 'CHARACTER_IDENTITY' | 'WARDROBE' | 'ENVIRONMENT_IDENTITY' | 'PROP_IDENTITY' | 'CAMERA_SIDE' | 'LIGHTING_FAMILY' | 'COMPOSITION' | 'EVIDENCE_TEXT' | 'EVIDENCE_DATA' | 'STYLE'; description: string; strength: 'HARD' | 'SOFT'; sourceLockId: string | null };
export type GenerationContinuityLock = { lockId: string; type: string; strength: 'HARD' | 'SOFT'; assetId: string; scope: 'SHOT' | 'SCENE' | 'PACKAGE'; notes: string[] };
export type GenerationReferenceDependency = { dependencyId: string; assetId: string; referencePackId: string | null; referenceIds: string[]; required: boolean; role: 'IDENTITY' | 'ENVIRONMENT' | 'PROP' | 'STYLE' | 'EVIDENCE' | 'COMPOSITION'; state: 'AVAILABLE' | 'REQUIRED' | 'UNSUITABLE' | 'UNKNOWN'; };
export type GenerationConstraint = { constraintId: string; type: 'DO_NOT_CHANGE' | 'DO_NOT_INVENT_EVIDENCE' | 'TEXT_FIDELITY_REQUIRED' | 'RIGHTS_BOUNDARY' | 'NO_PROVIDER_ASSUMPTION' | 'NO_UNSUPPORTED_MOTION' | 'NO_IDENTITY_DRIFT' | 'NO_STYLE_DRIFT'; description: string; severity: 'HARD' | 'SOFT' };
export type CompositionRequirement = { framing: 'ESTABLISHING' | 'WIDE' | 'MEDIUM' | 'CLOSE' | 'DETAIL' | 'OVERHEAD' | 'SCREEN_FOCUS' | 'COMPARISON_SPLIT' | 'GRAPHIC_FULL_FRAME' | 'UNKNOWN'; subjectPlacement: string | null; aspectRatio: string | null; source: 'SHOT_REQUIREMENT' | 'UNAVAILABLE' };
export type CameraRequirement = { motion: 'STATIC' | 'SUBTLE_PUSH' | 'PAN' | 'TRACK' | 'ORBIT' | 'HANDHELD_STYLE' | 'REFRAME' | 'UNKNOWN'; direction: string | null; source: 'SHOT_REQUIREMENT' | 'DERIVED' | 'UNAVAILABLE' };
export type MotionComplexity = 'STATIC' | 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'MULTI_STAGE' | 'UNSUPPORTED';
export type MotionRequirement = { motionType: 'NONE' | 'CHARACTER' | 'OBJECT' | 'CAMERA' | 'ENVIRONMENT' | 'GRAPHIC' | 'MIXED'; primarySubject: string | null; actions: string[]; direction: string | null; speed: 'STILL' | 'SLOW' | 'NORMAL' | 'FAST' | 'UNKNOWN'; intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'; cameraMotion: CameraRequirement['motion']; environmentMotion: string[]; prohibitedMotion: string[]; startCondition: string | null; endCondition: string | null };
export type GenerationComplexity = { state: MotionComplexity; independentActors: number; sequentialActions: number; objectStateTransitions: number; environmentChanges: number; requiresEndState: boolean; rationale: string[]; calibrationStatus: typeof VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus };
export type GenerationUnit = { unitId: string; index: number; route: GenerationRoute; inputState: GenerationInputState; startState: VisualState; desiredChange: VisualChange[]; endState: VisualState | null; intermediateStateId: string | null; dependsOnUnitIds: string[]; requiredAssetIds: string[]; referenceDependencyIds: string[]; readiness: GenerationSpecificationReadiness; provenance: { specificationId: string; shotId: string; sceneId: string } };
export type EvidenceGenerationSemantics = { mode: 'NON_GENERATIVE' | 'REAL_SOURCE_REQUIRED' | 'REAL_DATA_RENDER' | 'ILLUSTRATIVE_ONLY' | 'BLOCKED_SYNTHETIC_SUBSTITUTION'; claimIds: string[]; evidenceIds: string[]; requiredSourceAssetIds: string[]; note: string };
export type GenerationSpecificationReadiness = 'READY_FOR_MODEL_ADAPTATION' | 'READY_WITH_CAUTION' | 'NEEDS_ASSETS' | 'NEEDS_REFERENCE' | 'NEEDS_RESEARCH' | 'NEEDS_RIGHTS_REVIEW' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type GenerationReason = { code: string; message: string; refs: string[] };
export type GenerationRisk = { code: string; message: string; refs: string[] };
export type GenerationBlocker = { code: string; message: string; refs: string[] };
export type GenerationSpecificationProvenance = { specificationId: string; storyboardId: string | null; sceneId: string; shotId: string; scriptId: string | null; assetPackageId: string | null; assetIds: string[]; referencePackIds: string[]; claimIds: string[]; evidenceIds: string[]; algorithmVersions: string[]; capturedAt: string | null; snapshotId: string | null; calibrationStatus: typeof VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus };

export type VisualGenerationSpecification = { specificationId: string; specificationVersion: typeof VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION; storyboardId: string; sceneId: string; shotId: string; generationRoute: GenerationRoute; purpose: ShotPurpose; inputState: GenerationInputState; startState: VisualState; desiredChange: VisualChange[]; stateDelta: VisualChange[]; endState: VisualState | null; preserveUnchanged: PreserveUnchangedConstraint[]; continuityLocks: GenerationContinuityLock[]; referenceDependencies: GenerationReferenceDependency[]; negativeConstraints: GenerationConstraint[]; composition: CompositionRequirement; camera: CameraRequirement; motion: MotionRequirement | null; duration: { minSeconds: number; maxSeconds: number; source: 'SHOT_REQUIREMENT' | 'UNAVAILABLE'; calibrationStatus: typeof VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } | null; aspectRatio: { value: string | null; source: 'EXPLICIT' | 'USER_INPUT_REQUIRED' | 'UNAVAILABLE' }; complexity: GenerationComplexity; units: GenerationUnit[]; evidenceSemantics: EvidenceGenerationSemantics; confidence: ConfidenceLevel; reasons: GenerationReason[]; risks: GenerationRisk[]; blockers: GenerationBlocker[]; readiness: GenerationSpecificationReadiness; dataAvailability: Record<string, AssetDataAuditState>; provenance: GenerationSpecificationProvenance };
export type VisualGenerationSpecificationReport = { schemaVersion: 'visual-generation-specification.v1'; algorithmVersion: typeof VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION; scope: 'LONG_FORM'; specifications: VisualGenerationSpecification[]; blockedSpecifications: VisualGenerationSpecification[]; dataAvailability: Record<string, AssetDataAuditState>; gaps: string[]; provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } };

/** Future adapters consume this interface; no provider request or execution lives here. */
export type ProviderCapabilityRequirement = { route: GenerationRoute; requiresStartFrame: boolean; requiresEndState: boolean; requiresReferences: number; requiresAudio: boolean; durationSeconds: { min: number | null; max: number | null }; aspectRatio: string | null };
export type VisualGenerationProviderAdapterBoundary = { providerId: string; capabilities: ProviderCapabilityRequirement[]; serialize: (specification: VisualGenerationSpecification) => unknown; execute?: never };

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const minConfidence = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => rank[a] < rank[b] ? a : b;
const uniq = <T>(values: T[]) => [...new Set(values)];
const hash = (value: string) => { let h = 0x811c9dc5; for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const has = (value: string, pattern: RegExp) => pattern.test(value.toLocaleLowerCase());
const split = (value: string) => value.split(/;|；|,|，|\s+then\s+|随后|然后|并且| and /i).map(text).filter(Boolean);
const actionWords = /\b(walk|run|pick|open|close|turn|raise|lower|move|enter|leave|react|look|show|reveal|change|transform|cut|zoom|pan|track|rotate|turns?)\b|走|跑|拿起|打开|关闭|转身|举起|放下|移动|进入|离开|反应|看向|展示|揭示|改变|变成|切换|推近|拉远|跟拍|旋转/i;
const changeType = (value: string): VisualChangeType => has(value, /camera|zoom|pan|track|推近|拉远|跟拍/) ? 'CAMERA_CHANGE' : has(value, /reveal|show|chart|text|metric|data|展示|揭示|图表|数据|文字/) ? 'INFORMATION_REVEAL' : has(value, /environment|room|location|场景|环境|地点/) ? 'ENVIRONMENT_CHANGE' : has(value, /expression|react|smile|cry|表情|反应|笑|哭/) ? 'EXPRESSION_CHANGE' : has(value, /position|move|walk|run|turn|进入|离开|移动|走|跑|转身/) ? 'POSITION_CHANGE' : has(value, /open|close|pick|raise|lower|打开|关闭|拿起|举起|放下/) ? 'OBJECT_STATE_CHANGE' : 'CHARACTER_ACTION';

function assetFor(requirementId: string | null, pkg: VisualAssetPackage | null) { return pkg?.assets.find(asset => asset.requirementIds.includes(requirementId || '') || asset.assetId === requirementId) || null; }
function sceneAssets(scene: StoryboardScene, shot: ShotRequirement, pkg: VisualAssetPackage | null) {
  const assets = scene.assetIds.map(id => assetFor(id, pkg)).filter((asset): asset is VisualAsset => Boolean(asset));
  const evidenceShot = ['SCREEN_CAPTURE', 'CHART', 'ARCHIVE'].includes(shot.visualMode) || shot.purpose === 'SHOW_EVIDENCE';
  return evidenceShot ? assets.filter(asset => ['EVIDENCE_IMAGE', 'SCREENSHOT', 'CHART_DATA', 'CHART_RENDER', 'ARCHIVE_VIDEO', 'ARCHIVE_IMAGE', 'STOCK_VIDEO', 'STOCK_IMAGE'].includes(asset.assetType)) : assets.filter(asset => !['EVIDENCE_IMAGE', 'SCREENSHOT', 'CHART_DATA', 'CHART_RENDER', 'ARCHIVE_VIDEO', 'ARCHIVE_IMAGE', 'STOCK_VIDEO', 'STOCK_IMAGE'].includes(asset.assetType));
}
function inputState(assets: VisualAsset[], refs: GenerationReferenceDependency[], evidence: boolean): GenerationInputState {
  if (evidence) return assets.some(asset => asset.availability === 'AVAILABLE') ? 'EVIDENCE_ASSET' : 'UNKNOWN';
  if (assets.some(asset => asset.source === 'EXISTING_REPOSITORY_ASSET' && asset.availability === 'AVAILABLE')) return refs.length > 1 ? 'MULTIPLE_REFERENCES' : 'EXISTING_ASSET';
  if (refs.length > 1) return 'MULTIPLE_REFERENCES';
  if (refs.length === 1) return 'REFERENCE_IMAGE';
  if (assets.some(asset => asset.source === 'USER_UPLOAD' || asset.source === 'USER_CAPTURE')) return 'SOURCE_IMAGE';
  return 'TEXT_ONLY';
}
function composition(shot: ShotRequirement): CompositionRequirement {
  const value = text(shot.compositionRequirement);
  const framing: CompositionRequirement['framing'] = has(value, /establish|建立/) ? 'ESTABLISHING' : has(value, /wide|全景|宽/) ? 'WIDE' : has(value, /close|特写/) ? 'CLOSE' : has(value, /detail|细节/) ? 'DETAIL' : has(value, /screen|screenshot|屏幕|截图/) ? 'SCREEN_FOCUS' : has(value, /split|对比|比较/) ? 'COMPARISON_SPLIT' : has(value, /graphic|chart|diagram|图表|图形/) ? 'GRAPHIC_FULL_FRAME' : value ? 'MEDIUM' : 'UNKNOWN';
  return { framing, subjectPlacement: value || null, aspectRatio: null, source: value ? 'SHOT_REQUIREMENT' : 'UNAVAILABLE' };
}
function camera(shot: ShotRequirement): CameraRequirement {
  const value = `${shot.actionRequirement || ''} ${shot.compositionRequirement || ''}`;
  const motion: CameraRequirement['motion'] = has(value, /push|zoom|推近|拉近/) ? 'SUBTLE_PUSH' : has(value, /pan|横摇/) ? 'PAN' : has(value, /track|跟拍/) ? 'TRACK' : has(value, /orbit|环绕/) ? 'ORBIT' : has(value, /handheld|手持/) ? 'HANDHELD_STYLE' : has(value, /reframe|重新构图/) ? 'REFRAME' : value ? 'STATIC' : 'UNKNOWN';
  return { motion, direction: null, source: value ? 'DERIVED' : 'UNAVAILABLE' };
}
function visualState(shot: ShotRequirement, assets: VisualAsset[], refs: GenerationReferenceDependency[], end = false): VisualState {
  const subject = text(shot.subjectRequirement);
  const environment = text(shot.environmentRequirement) || null;
  const action = text(shot.actionRequirement);
  return { subjects: subject ? [subject] : [], assetIds: assets.map(asset => asset.assetId), environment, time: null, objectStates: assets.filter(asset => asset.assetType === 'PROP').map(asset => ({ assetId: asset.assetId, state: end ? 'post-action state' : 'initial state' })), positions: [], expressions: [], actionsAtState: end ? [] : action ? [action] : [], evidenceContent: shot.evidenceRequirement ? [shot.evidenceRequirement] : [], composition: text(shot.compositionRequirement) || null, styleReferenceIds: refs.filter(ref => ref.role === 'STYLE').flatMap(ref => ref.referenceIds) };
}
function changesFor(shot: ShotRequirement): VisualChange[] {
  const values = split(text(shot.actionRequirement));
  return values.filter(value => actionWords.test(value) || values.length > 1).map((value, index) => ({ changeId: `change:${hash(`${shot.shotId}|${index}|${value}`)}`, type: changeType(value), description: value, source: 'SHOT_REQUIREMENT', atomic: !/[，,和及并]/.test(value) }));
}
function routeFor(shot: ShotRequirement, mode: VisualMode, assets: VisualAsset[], refs: GenerationReferenceDependency[], evidence: boolean): GenerationRoute {
  if (evidence) { if (mode === 'SCREEN_CAPTURE') return 'SCREEN_CAPTURE'; if (mode === 'CHART') return 'CHART_RENDER'; if (mode === 'DIAGRAM' || mode === 'TEXT_GRAPHIC') return 'GRAPHIC_RENDER'; if (mode === 'ARCHIVE') return assets.some(asset => asset.rights === 'RIGHTS_REVIEW_REQUIRED' || asset.rights === 'LICENSE_REQUIRED' || asset.rights === 'UNKNOWN') ? 'RIGHTS_REVIEW_FIRST' : 'SOURCE_REAL_EVIDENCE'; return 'SOURCE_REAL_EVIDENCE'; }
  if (mode === 'NARRATION_ONLY') return 'MANUAL_PRODUCTION';
  if (assets.some(asset => asset.blockers.length || asset.rights === 'BLOCKED')) return 'BLOCKED';
  if (refs.some(ref => ref.required && ref.state !== 'AVAILABLE')) return 'USER_INPUT_REQUIRED';
  if (assets.some(asset => asset.rights === 'RIGHTS_REVIEW_REQUIRED' || asset.rights === 'LICENSE_REQUIRED')) return 'RIGHTS_REVIEW_FIRST';
  if (assets.some(asset => asset.availability === 'REQUIRES_RESEARCH')) return 'RESEARCH_FIRST';
  if (assets.some(asset => asset.source === 'USER_CAPTURE')) return mode === 'SCREEN_CAPTURE' ? 'SCREEN_CAPTURE' : 'USER_CAPTURE';
  if (assets.some(asset => asset.source === 'EXISTING_REPOSITORY_ASSET' && asset.availability === 'AVAILABLE') && !changesFor(shot).length) return 'REUSE_EXISTING_ASSET';
  if (changesFor(shot).length && refs.some(ref => ref.state === 'AVAILABLE') && assets.some(asset => asset.assetType === 'CHARACTER' || asset.assetType === 'ENVIRONMENT' || asset.assetType === 'PROP')) return 'IMAGE_TO_VIDEO';
  if (refs.some(ref => ref.state === 'AVAILABLE') && assets.some(asset => asset.assetType === 'CHARACTER' || asset.assetType === 'ENVIRONMENT' || asset.assetType === 'PROP')) return 'REFERENCE_IMAGE_EDIT';
  if (assets.some(asset => asset.generationEligibility === 'REFERENCE_REQUIRED')) return 'USER_INPUT_REQUIRED';
  if (mode === 'AI_GENERATED_VISUAL' || mode === 'STATIC_IMAGE') return 'TEXT_TO_IMAGE';
  if (changesFor(shot).length) return 'TEXT_TO_VIDEO';
  return 'TEXT_TO_IMAGE';
}
function motionFor(shot: ShotRequirement, changes: VisualChange[], cameraReq: CameraRequirement): MotionRequirement | null {
  if (!changes.length && cameraReq.motion === 'STATIC') return null;
  const descriptions = changes.map(change => change.description);
  return { motionType: changes.some(change => change.type === 'CAMERA_CHANGE') ? 'MIXED' : changes.some(change => change.type === 'OBJECT_STATE_CHANGE') ? 'OBJECT' : 'CHARACTER', primarySubject: text(shot.subjectRequirement) || null, actions: descriptions, direction: null, speed: has(descriptions.join(' '), /fast|quick|快速/) ? 'FAST' : 'NORMAL', intensity: changes.length > 2 ? 'HIGH' : changes.length ? 'MEDIUM' : 'LOW', cameraMotion: cameraReq.motion, environmentMotion: [], prohibitedMotion: [], startCondition: text(shot.subjectRequirement) || null, endCondition: changes.length ? descriptions.at(-1) || null : null };
}
function complexity(changes: VisualChange[], assets: VisualAsset[], cameraReq: CameraRequirement, requiresEndState: boolean): GenerationComplexity {
  const sequentialActions = changes.length;
  const actors = assets.filter(asset => asset.assetType === 'CHARACTER').length;
  const environmentChanges = changes.filter(change => change.type === 'ENVIRONMENT_CHANGE').length;
  const objectStateTransitions = changes.filter(change => change.type === 'OBJECT_STATE_CHANGE').length;
  const multi = sequentialActions > VISUAL_GENERATION_SPECIFICATION_CONFIG.maxSequentialActionsPerUnit || actors > VISUAL_GENERATION_SPECIFICATION_CONFIG.maxIndependentActorsPerUnit || environmentChanges > 0;
  const state: MotionComplexity = multi ? 'MULTI_STAGE' : sequentialActions === 0 ? 'STATIC' : sequentialActions === 1 ? 'SIMPLE' : 'MODERATE';
  return { state, independentActors: actors, sequentialActions, objectStateTransitions, environmentChanges, requiresEndState, rationale: multi ? ['多个顺序动作或环境变化需要中间状态与分阶段生成。'] : ['当前镜头的变化可由一个语义生成单元承载。'], calibrationStatus: VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus };
}
function referencesFor(assets: VisualAsset[], pkg: VisualAssetPackage | null): GenerationReferenceDependency[] {
  return assets.flatMap(asset => { const pack = pkg?.referencePacks.find(item => item.canonicalAssetId === asset.assetId); const references = pkg?.references.filter(ref => ref.assetId === asset.assetId) || []; const role = asset.assetType === 'CHARACTER' ? 'IDENTITY' : asset.assetType === 'ENVIRONMENT' ? 'ENVIRONMENT' : asset.assetType === 'PROP' ? 'PROP' : asset.assetType === 'EVIDENCE_IMAGE' || asset.assetType === 'SCREENSHOT' ? 'EVIDENCE' : 'STYLE'; const identityReferenceRequired = asset.referenceState === 'DESCRIPTION_ONLY' && (asset.assetType === 'CHARACTER' || asset.assetType === 'ENVIRONMENT'); const generatedPropCanUseText = asset.assetType === 'PROP' && asset.source === 'AI_GENERATION_CANDIDATE'; return [{ dependencyId: `dep:${hash(`${asset.assetId}|${role}`)}`, assetId: asset.assetId, referencePackId: pack?.referencePackId || null, referenceIds: references.map(ref => ref.referenceId), required: (asset.generationEligibility === 'REFERENCE_REQUIRED' && !generatedPropCanUseText) || identityReferenceRequired || role === 'EVIDENCE', role, state: references.length ? (references.some(ref => ref.suitability === 'SUITABLE') ? 'AVAILABLE' : 'UNSUITABLE') : pack?.state === 'DESCRIPTION_ONLY' ? 'REQUIRED' : pack ? 'UNKNOWN' : 'UNKNOWN' } satisfies GenerationReferenceDependency]; });
}
function evidenceSemantics(scene: StoryboardScene, shot: ShotRequirement, assets: VisualAsset[]): EvidenceGenerationSemantics {
  const evidence = assets.filter(asset => asset.assetType === 'EVIDENCE_IMAGE' || asset.assetType === 'SCREENSHOT' || asset.assetType === 'CHART_DATA' || asset.assetType === 'CHART_RENDER');
  const evidenceMode = evidence.length || ['SCREEN_CAPTURE', 'CHART', 'ARCHIVE'].includes(shot.visualMode) || shot.purpose === 'SHOW_EVIDENCE';
  if (!evidenceMode && shot.visualMode === 'NARRATION_ONLY') return { mode: 'NON_GENERATIVE', claimIds: [], evidenceIds: [], requiredSourceAssetIds: [], note: '旁白镜头没有生成任务。' };
  if (!evidenceMode) return { mode: 'ILLUSTRATIVE_ONLY', claimIds: [], evidenceIds: [], requiredSourceAssetIds: [], note: '这是辅助理解的视觉，不承担事实证明。' };
  const synthetic = evidence.some(asset => asset.blockers.includes('EVIDENCE_ASSET_REPLACED_BY_SYNTHETIC'));
  return { mode: synthetic ? 'BLOCKED_SYNTHETIC_SUBSTITUTION' : evidence.some(asset => asset.assetType === 'CHART_DATA' || asset.assetType === 'CHART_RENDER') ? 'REAL_DATA_RENDER' : 'REAL_SOURCE_REQUIRED', claimIds: [], evidenceIds: evidence.flatMap(asset => asset.provenance.evidenceIds), requiredSourceAssetIds: evidence.map(asset => asset.assetId), note: synthetic ? '合成画面不能替代事实证据。' : '必须保留真实来源与 Claim → Evidence provenance。' };
}
function readiness(route: GenerationRoute, pkg: VisualAssetPackage | null, refs: GenerationReferenceDependency[], evidence: EvidenceGenerationSemantics, blockers: GenerationBlocker[], risks: GenerationRisk[]): GenerationSpecificationReadiness {
  if (!pkg) return 'INSUFFICIENT';
  if (blockers.length || route === 'BLOCKED' || evidence.mode === 'BLOCKED_SYNTHETIC_SUBSTITUTION') return 'BLOCKED';
  if (route === 'CHART_RENDER' || route === 'RESEARCH_FIRST' || pkg.researchRequirements.length && evidence.mode === 'REAL_DATA_RENDER') return 'NEEDS_RESEARCH';
  if (route === 'USER_INPUT_REQUIRED' || refs.some(ref => ref.required && ref.state !== 'AVAILABLE')) return 'NEEDS_REFERENCE';
  if (route === 'RIGHTS_REVIEW_FIRST' || pkg.rightsReviews.length) return 'NEEDS_RIGHTS_REVIEW';
  if (pkg.readiness === 'NEEDS_ASSETS') return 'NEEDS_ASSETS';
  if (pkg.readiness === 'NEEDS_REVISION') return 'NEEDS_REVISION';
  if (risks.length || pkg.readiness === 'READY_WITH_CAUTION') return 'READY_WITH_CAUTION';
  return 'READY_FOR_MODEL_ADAPTATION';
}
function makeSpec(storyboard: Storyboard, scene: StoryboardScene, shot: ShotRequirement, pkg: VisualAssetPackage | null, capturedAt: string | null, snapshotId: string | null): VisualGenerationSpecification {
  const assets = sceneAssets(scene, shot, pkg);
  const refs = referencesFor(assets, pkg);
  const evidence = evidenceSemantics(scene, shot, assets);
  const changes = changesFor(shot);
  const cameraReq = camera(shot);
  const baseRoute = routeFor(shot, shot.visualMode, assets, refs, evidence.mode !== 'ILLUSTRATIVE_ONLY' && evidence.mode !== 'NON_GENERATIVE');
  const start = visualState(shot, assets, refs);
  const comp = composition(shot);
  const motion = motionFor(shot, changes, cameraReq);
  const complexityValue = complexity(changes, assets, cameraReq, changes.length > 0);
  const route: GenerationRoute = complexityValue.state === 'MULTI_STAGE' && !['BLOCKED', 'SOURCE_REAL_EVIDENCE', 'SCREEN_CAPTURE', 'CHART_RENDER', 'GRAPHIC_RENDER', 'RIGHTS_REVIEW_FIRST'].includes(baseRoute) ? 'MULTI_STAGE_GENERATION' : baseRoute;
  const requiresEndState = ['IMAGE_TO_VIDEO', 'REFERENCE_IMAGE_EDIT', 'MULTI_STAGE_GENERATION', 'USER_INPUT_REQUIRED'].includes(route) || changes.some(change => ['OBJECT_STATE_CHANGE', 'ENVIRONMENT_CHANGE', 'INFORMATION_REVEAL'].includes(change.type));
  const end = requiresEndState ? visualState(shot, assets, refs, true) : null;
  const locks: GenerationContinuityLock[] = (pkg?.continuityLocks || []).filter(lock => lock.sceneIds.includes(scene.semanticScene.sceneId) && (!lock.shotIds.length || lock.shotIds.includes(shot.shotId))).map(lock => ({ lockId: lock.lockId, type: lock.type, strength: lock.strength, assetId: lock.assetId, scope: lock.shotIds.length ? 'SHOT' : 'SCENE', notes: lock.notes }));
  const preserve: PreserveUnchangedConstraint[] = locks.map(lock => ({ constraintId: `preserve:${lock.lockId}`, type: lock.type === 'IDENTITY_LOCK' ? 'CHARACTER_IDENTITY' : lock.type === 'WARDROBE_LOCK' ? 'WARDROBE' : lock.type === 'ENVIRONMENT_LOCK' ? 'ENVIRONMENT_IDENTITY' : lock.type === 'PROP_LOCK' ? 'PROP_IDENTITY' : lock.type === 'STYLE_LOCK' ? 'STYLE' : 'COMPOSITION', description: `保持 ${lock.type} 不变。`, strength: lock.strength, sourceLockId: lock.lockId }));
  const negative: GenerationConstraint[] = [...preserve.filter(item => item.type === 'CHARACTER_IDENTITY').map(item => ({ constraintId: `${item.constraintId}:drift`, type: 'NO_IDENTITY_DRIFT' as const, description: '禁止角色身份、面部与关键外观漂移。', severity: 'HARD' as const })), ...preserve.filter(item => item.type === 'STYLE').map(item => ({ constraintId: `${item.constraintId}:style`, type: 'NO_STYLE_DRIFT' as const, description: '禁止无依据改变风格参考。', severity: 'HARD' as const }))];
  if (evidence.mode === 'REAL_SOURCE_REQUIRED' || evidence.mode === 'REAL_DATA_RENDER') negative.push({ constraintId: `constraint:evidence:${shot.shotId}`, type: 'DO_NOT_INVENT_EVIDENCE', description: '不得用合成画面、虚构数据或伪造截图替代事实证据。', severity: 'HARD' });
  if (has(`${shot.subjectRequirement || ''} ${shot.actionRequirement || ''} ${shot.evidenceRequirement || ''}`, /text|title|label|文字|标题|标注|字幕/)) negative.push({ constraintId: `constraint:text:${shot.shotId}`, type: 'TEXT_FIDELITY_REQUIRED', description: '可读文字必须来自真实来源或后续图形渲染数据，不能凭空生成。', severity: 'HARD' });
  const blockers: GenerationBlocker[] = [];
  if (storyboard.blockers.length || storyboard.readiness === 'BLOCKED') blockers.push({ code: 'STORYBOARD_BLOCKED', message: '上游 Storyboard 已阻塞，不能进入生成规格。', refs: [storyboard.storyboardId] });
  if (pkg?.blockers.length) blockers.push(...pkg.blockers.map(code => ({ code, message: '资产包存在阻塞，不能安全生成。', refs: [pkg.packageId] })));
  if (evidence.mode === 'BLOCKED_SYNTHETIC_SUBSTITUTION') blockers.push({ code: 'EVIDENCE_ASSET_REPLACED_BY_SYNTHETIC', message: '证据资产不能被合成视觉替代。', refs: [shot.shotId] });
  if (has(`${shot.actionRequirement || ''} ${shot.continuityRequirement || ''}`, /contradict|矛盾|conflict/)) blockers.push({ code: 'START_END_STATE_CONFLICT', message: '镜头需求包含显式状态冲突，需要修改后再生成。', refs: [shot.shotId] });
  const risks: GenerationRisk[] = [];
  if (complexityValue.state === 'MULTI_STAGE') risks.push({ code: 'MULTI_STAGE_REQUIRED', message: '顺序动作或环境变化较多，已拆分为中间状态。', refs: [shot.shotId] });
  if (refs.some(ref => ref.required && ref.state !== 'AVAILABLE')) risks.push({ code: 'REFERENCE_REQUIRED', message: '连续性或身份依赖缺少可用参考。', refs: refs.map(ref => ref.dependencyId) });
  if (!shot.estimatedDuration || !Number.isFinite(shot.estimatedDuration.minSeconds)) risks.push({ code: 'DURATION_UNAVAILABLE', message: '镜头时长未提供，不能推断模型限制。', refs: [shot.shotId] });
  if (comp.framing === 'UNKNOWN') risks.push({ code: 'COMPOSITION_UNAVAILABLE', message: '构图要求未明确，保留为 UNKNOWN。', refs: [shot.shotId] });
  const unitChanges = complexityValue.state === 'MULTI_STAGE' ? changes.reduce<VisualChange[][]>((all, change) => { const group = all.at(-1); if (!group || group.length >= VISUAL_GENERATION_SPECIFICATION_CONFIG.maxAtomicChangesPerUnit) all.push([change]); else group.push(change); return all; }, []) : [changes];
  const specificationId = `vgs:${hash(`${storyboard.storyboardId}|${scene.semanticScene.sceneId}|${shot.shotId}`)}`;
  const units: GenerationUnit[] = unitChanges.map((unitChangesItem, index) => { const unitId = `${specificationId}:unit:${index + 1}`; const intermediateStateId = index < unitChanges.length - 1 ? `${specificationId}:state:${index + 1}` : null; return { unitId, index: index + 1, route: unitChanges.length > 1 ? (index === 0 ? route : 'IMAGE_TO_VIDEO') : route, inputState: index === 0 ? inputState(assets, refs, evidence.mode !== 'ILLUSTRATIVE_ONLY' && evidence.mode !== 'NON_GENERATIVE') : 'START_FRAME', startState: index === 0 ? start : visualState(shot, assets, refs, true), desiredChange: unitChangesItem, endState: index < unitChanges.length - 1 || requiresEndState ? visualState(shot, assets, refs, true) : null, intermediateStateId, dependsOnUnitIds: index ? [`${specificationId}:unit:${index}`] : [], requiredAssetIds: assets.map(asset => asset.assetId), referenceDependencyIds: refs.map(ref => ref.dependencyId), readiness: 'READY_FOR_MODEL_ADAPTATION', provenance: { specificationId, shotId: shot.shotId, sceneId: scene.semanticScene.sceneId } }; });
  const dataAvailability: Record<string, AssetDataAuditState> = { storyboard: 'AVAILABLE', shotRequirement: 'AVAILABLE', shotPurpose: shot.purpose ? 'AVAILABLE' : 'UNAVAILABLE', subject: shot.subjectRequirement ? 'AVAILABLE' : 'PARTIAL', characterIdentity: assets.some(asset => asset.assetType === 'CHARACTER') ? (refs.some(ref => ref.role === 'IDENTITY' && ref.state === 'AVAILABLE') ? 'AVAILABLE' : 'REQUIRES_REFERENCE') : 'UNAVAILABLE', environment: assets.some(asset => asset.assetType === 'ENVIRONMENT') ? 'DERIVABLE' : 'UNAVAILABLE', prop: assets.some(asset => asset.assetType === 'PROP') ? 'DERIVABLE' : 'UNAVAILABLE', action: shot.actionRequirement ? 'AVAILABLE' : 'PARTIAL', startState: shot.subjectRequirement || shot.environmentRequirement ? 'DERIVABLE' : 'PARTIAL', endState: requiresEndState ? 'PARTIAL' : 'UNAVAILABLE', references: refs.length ? 'PARTIAL' : 'REQUIRES_REFERENCE', styleReference: refs.some(ref => ref.role === 'STYLE') ? 'PARTIAL' : 'UNAVAILABLE', aspectRatio: 'REQUIRES_USER_INPUT', frameRate: 'REQUIRES_USER_INPUT', sourceMedia: assets.some(asset => asset.availability === 'AVAILABLE') ? 'AVAILABLE' : 'REQUIRES_ASSET', evidenceSource: evidence.mode === 'ILLUSTRATIVE_ONLY' ? 'UNAVAILABLE' : evidence.requiredSourceAssetIds.length ? 'PARTIAL' : 'REQUIRES_ASSET', motion: changes.length ? 'DERIVABLE' : 'PARTIAL', camera: cameraReq.motion === 'UNKNOWN' ? 'PARTIAL' : 'DERIVABLE', negativeConstraints: 'DERIVABLE', visualEmbeddings: 'UNAVAILABLE', referenceSuitability: refs.length ? 'PARTIAL' : 'REQUIRES_VISION', productionRoute: 'DERIVABLE', providerCapabilities: 'UNAVAILABLE' };
  const reasonList: GenerationReason[] = [{ code: 'GENERATION_SPECIFICATION_STRUCTURED', message: '生成意图以结构化字段保存，不以模型提示词作为事实源。', refs: [shot.shotId] }, ...((complexityValue.state === 'MULTI_STAGE') ? [{ code: 'GENERATION_MULTI_STAGE_SPLIT', message: '复杂顺序动作已拆成多个 Generation Unit，并保留中间状态。', refs: units.map(unit => unit.unitId) }] : [])];
  const riskList = risks;
  const evidenceMode = evidence.mode;
  const finalReadiness = readiness(route, pkg, refs, evidence, blockers, risks);
  const normalizedUnits = units.map(unit => ({ ...unit, readiness: finalReadiness }));
  return { specificationId, specificationVersion: VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION, storyboardId: storyboard.storyboardId, sceneId: scene.semanticScene.sceneId, shotId: shot.shotId, generationRoute: route, purpose: shot.purpose, inputState: inputState(assets, refs, evidenceMode !== 'ILLUSTRATIVE_ONLY' && evidenceMode !== 'NON_GENERATIVE'), startState: start, desiredChange: changes, stateDelta: changes, endState: end, preserveUnchanged: preserve, continuityLocks: locks, referenceDependencies: refs, negativeConstraints: negative, composition: comp, camera: cameraReq, motion, duration: shot.estimatedDuration ? { ...shot.estimatedDuration, source: 'SHOT_REQUIREMENT', calibrationStatus: VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } : null, aspectRatio: { value: null, source: 'USER_INPUT_REQUIRED' }, complexity: complexityValue, units: normalizedUnits, evidenceSemantics: evidence, confidence: minConfidence(storyboard.confidence, pkg?.confidence || 'LOW'), reasons: reasonList, risks: riskList, blockers, readiness: finalReadiness, dataAvailability, provenance: { specificationId, storyboardId: storyboard.storyboardId, sceneId: scene.semanticScene.sceneId, shotId: shot.shotId, scriptId: storyboard.scriptId, assetPackageId: pkg?.packageId || null, assetIds: assets.map(asset => asset.assetId), referencePackIds: refs.map(ref => ref.referencePackId).filter((id): id is string => Boolean(id)), claimIds: evidence.claimIds, evidenceIds: evidence.evidenceIds, algorithmVersions: [VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION, storyboard.provenance.storyboardVersion, pkg?.provenance.algorithmVersion || ''], capturedAt, snapshotId, calibrationStatus: VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } };
}

export function buildVisualGenerationSpecifications(input: { storyboard: Storyboard | null; assetPackage?: VisualAssetPackage | null; capturedAt?: string | null; snapshotId?: string | null }): VisualGenerationSpecificationReport {
  const storyboard = input.storyboard;
  const capturedAt = input.capturedAt || null;
  const snapshotId = input.snapshotId || null;
  const emptyAudit: Record<string, AssetDataAuditState> = { storyboard: 'UNAVAILABLE', shotRequirement: 'UNAVAILABLE', references: 'REQUIRES_ASSET', visualEmbeddings: 'UNAVAILABLE', providerCapabilities: 'UNAVAILABLE' };
  if (!storyboard) return { schemaVersion: 'visual-generation-specification.v1', algorithmVersion: VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION, scope: 'LONG_FORM', specifications: [], blockedSpecifications: [], dataAvailability: emptyAudit, gaps: ['STORYBOARD_REQUIRED'], provenance: { source: 'PUBLIC_YOUTUBE_METADATA', capturedAt, snapshotId, algorithmVersions: [VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION], calibrationStatus: VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } };
  const pkg = input.assetPackage || null;
  const specs = storyboard.scenes.flatMap(scene => scene.shots.map(shot => makeSpec(storyboard, scene, shot, pkg, capturedAt, snapshotId)));
  return { schemaVersion: 'visual-generation-specification.v1', algorithmVersion: VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION, scope: 'LONG_FORM', specifications: specs.filter(spec => spec.readiness !== 'BLOCKED'), blockedSpecifications: specs.filter(spec => spec.readiness === 'BLOCKED'), dataAvailability: { storyboard: 'AVAILABLE', shotRequirements: 'AVAILABLE', assetPackage: pkg ? 'AVAILABLE' : 'REQUIRES_ASSET', references: pkg?.references.length ? 'PARTIAL' : 'REQUIRES_REFERENCE', visualUnderstanding: 'REQUIRES_VISION', visualEmbeddings: 'UNAVAILABLE', providerCapabilities: 'UNAVAILABLE', generationExecution: 'UNAVAILABLE' }, gaps: uniq(specs.flatMap(spec => spec.risks.map(risk => risk.message))), provenance: { source: storyboard.provenance.evidenceIds.length ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', capturedAt, snapshotId, algorithmVersions: [VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION], calibrationStatus: VISUAL_GENERATION_SPECIFICATION_CONFIG.calibrationStatus } };
}

export function normalizeVisualGenerationSpecificationReport(value: unknown): VisualGenerationSpecificationReport | null {
  if (!value || typeof value !== 'object') return null;
  const report = value as Partial<VisualGenerationSpecificationReport>;
  if (report.schemaVersion !== 'visual-generation-specification.v1' || report.algorithmVersion !== VISUAL_GENERATION_SPECIFICATION_ALGORITHM_VERSION || report.scope !== 'LONG_FORM' || !Array.isArray(report.specifications) || !Array.isArray(report.blockedSpecifications)) return null;
  return report as VisualGenerationSpecificationReport;
}

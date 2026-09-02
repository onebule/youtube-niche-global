/**
 * P4 Phase 1 — deterministic, Long-form-only storyboard and shot planning.
 *
 * This layer consumes the P3.5 Script Draft and (when available) its P3.4
 * architecture. It stores semantic production requirements, never model
 * prompts, generated media, or Canvas nodes.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { ScriptDevelopmentIntelligenceReport, ScriptSection } from './script-development.ts';
import type { ScriptDraft, ScriptSectionDraft } from './script-writing.ts';

export const STORYBOARD_PLANNING_ALGORITHM_VERSION = 'storyboard-planning-v1';

/** Provisional planning heuristics. Each value must be calibrated with real production outcomes. */
export const STORYBOARD_PLANNING_CONFIG = Object.freeze({
  maxVisualResponsibilitiesPerScene: 3,
  maxRecommendedShotsPerScene: 3,
  maxRepeatedVisualMode: 3,
  defaultShotDurationRange: { minSeconds: 3, maxSeconds: 12 },
  minEvidenceVisualCoverage: 0.7,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type StoryboardReadiness = 'READY_FOR_PRODUCTION_PLANNING' | 'READY_WITH_CAUTION' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type VisualMode = 'LIVE_ACTION' | 'BROLL' | 'ARCHIVE' | 'SCREEN_CAPTURE' | 'DIAGRAM' | 'CHART' | 'TEXT_GRAPHIC' | 'MOTION_GRAPHIC' | 'ANIMATION' | 'AI_GENERATED_VISUAL' | 'STATIC_IMAGE' | 'NARRATION_ONLY' | 'UNKNOWN';
export type ProductionSource = 'CREATOR_CAPTURE' | 'EXISTING_ASSET' | 'PUBLIC_EVIDENCE' | 'LICENSED_STOCK' | 'USER_PROVIDED' | 'AI_GENERATABLE' | 'REQUIRES_RESEARCH' | 'UNKNOWN';
export type ScenePurpose = 'HOOK_VISUAL' | 'CONTEXT' | 'EXPLANATION' | 'EVIDENCE' | 'COMPARISON' | 'EXPERIMENT' | 'TRANSITION' | 'ESCALATION' | 'REVEAL' | 'PAYOFF' | 'RESOLUTION' | 'CONCLUSION';
export type ShotPurpose = 'ESTABLISH' | 'SHOW_SUBJECT' | 'SHOW_ACTION' | 'SHOW_EVIDENCE' | 'COMPARE' | 'EXPLAIN' | 'REACTION' | 'DETAIL' | 'TRANSITION' | 'REVEAL' | 'PAYOFF';
export type VisualAvailability = 'AVAILABLE' | 'DERIVABLE' | 'PARTIAL' | 'REQUIRES_VISION' | 'REQUIRES_ASSET' | 'REQUIRES_RESEARCH' | 'REQUIRES_RIGHTS_REVIEW' | 'REQUIRES_USER_INPUT' | 'UNAVAILABLE';
export type FeasibilityState = 'FEASIBLE' | 'FEASIBLE_WITH_RISK' | 'REQUIRES_ASSET' | 'REQUIRES_RESEARCH' | 'RIGHTS_REVIEW_REQUIRED' | 'UNKNOWN' | 'BLOCKED';
export type RightsState = 'LOW_KNOWN_RISK' | 'RIGHTS_REVIEW_REQUIRED' | 'LICENSE_REQUIRED' | 'IP_DEPENDENCY_UNKNOWN' | 'BLOCKED';
export type VisualComplexity = 'SIMPLE' | 'MODERATE' | 'COMPLEX' | 'UNKNOWN';
export type VisualDensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'OVERLOADED';
export type ContinuityRelation = 'CONTINUOUS' | 'CUT' | 'CONCEPTUAL' | 'TIME_SHIFT' | 'LOCATION_SHIFT' | 'COMPARISON_SHIFT' | 'EVIDENCE_SHIFT';
export type AssetType = 'CHARACTER' | 'LOCATION' | 'PROP' | 'SCREENSHOT' | 'CHART' | 'DIAGRAM' | 'ARCHIVE' | 'STOCK' | 'IMAGE' | 'VIDEO' | 'LOGO' | 'DOCUMENT' | 'OTHER';
export type AssetAvailability = 'AVAILABLE' | 'REQUIRES_ASSET' | 'REQUIRES_RESEARCH' | 'UNKNOWN' | 'UNAVAILABLE';
export type EvidenceVisualizationType = 'DIRECT_VISUAL_EVIDENCE' | 'CHART' | 'DIAGRAM' | 'TEXT_CALLOUT' | 'SCREENSHOT' | 'ARCHIVE_PUBLIC_EVIDENCE' | 'SUPPORTING_BROLL' | 'UNKNOWN';

export type StoryboardReason = { code: string; message: string; refs: string[] };
export type StoryboardRisk = { code: string; message: string; refs: string[] };
export type StoryboardBlocker = { code: string; message: string; refs: string[] };

export type SemanticScene = {
  sceneId: string;
  sourceSectionId: string;
  narrationBeatIds: string[];
  purpose: ScenePurpose;
  visualObjective: string;
  informationRequirement: string;
  evidenceRequirement: string;
  characterRequirement: string | null;
  environmentRequirement: string | null;
  objectRequirement: string | null;
  graphicRequirement: string | null;
  continuityRequirements: string[];
  suggestedVisualMode: VisualMode;
  shotCountRequirement: { min: number; max: number; reason: string; calibrationStatus: typeof STORYBOARD_PLANNING_CONFIG.calibrationStatus };
  durationRange: { minSeconds: number; maxSeconds: number; calibrationStatus: typeof STORYBOARD_PLANNING_CONFIG.calibrationStatus };
  visualDensity: VisualDensity;
  complexity: VisualComplexity;
  confidence: ConfidenceLevel;
  risks: StoryboardRisk[];
  provenance: { scriptId: string; scriptSectionId: string; architectureSectionId: string | null; scriptVersion: string };
};

export type ShotRequirement = {
  shotId: string;
  sceneId: string;
  purpose: ShotPurpose;
  subjectRequirement: string | null;
  environmentRequirement: string | null;
  actionRequirement: string | null;
  compositionRequirement: string | null;
  continuityRequirement: string | null;
  evidenceRequirement: string | null;
  visualMode: VisualMode;
  estimatedDuration: { minSeconds: number; maxSeconds: number; calibrationStatus: typeof STORYBOARD_PLANNING_CONFIG.calibrationStatus };
  productionSource: ProductionSource;
  confidence: ConfidenceLevel;
  risks: StoryboardRisk[];
};

export type EvidenceVisualization = {
  visualizationId: string;
  claimId: string;
  evidenceId: string;
  sceneId: string;
  shotId: string | null;
  visualizationType: EvidenceVisualizationType;
  evidenceKind: 'EVIDENCE_VISUAL' | 'ILLUSTRATIVE_VISUAL';
  requiredAsset: string | null;
  source: ProductionSource;
  rightsStatus: RightsState;
  confidence: ConfidenceLevel;
  availability: VisualAvailability;
  note: string;
};
export type IllustrativeVisual = { visualizationId: string; sceneId: string; shotId: string | null; visualizationType: 'SUPPORTING_BROLL' | 'STATIC_IMAGE' | 'AI_GENERATED_VISUAL'; evidenceKind: 'ILLUSTRATIVE_VISUAL'; note: string };

export type AssetRequirement = {
  assetId: string;
  type: AssetType;
  label: string;
  availability: AssetAvailability;
  source: ProductionSource;
  rightsStatus: RightsState;
  usedBySceneIds: string[];
  notes: string[];
};

export type CharacterContinuity = { characterId: string; role: string; identityRequirements: string[]; appearanceRequirements: string[]; wardrobeRequirements: string[]; sceneIds: string[] };
export type EnvironmentContinuity = { environmentId: string; environmentType: string; visualProperties: string[]; timeOfDay: string | null; sceneIds: string[]; constraints: string[] };
export type PropContinuity = { propId: string; label: string; sceneIds: string[]; constraints: string[] };
export type StoryboardContinuity = { characters: CharacterContinuity[]; environments: EnvironmentContinuity[]; props: PropContinuity[]; relations: Array<{ fromSceneId: string; toSceneId: string; relation: ContinuityRelation; note: string }> };

export type StoryboardScene = { semanticScene: SemanticScene; shots: ShotRequirement[]; transitionIn: ContinuityRelation | null; transitionOut: ContinuityRelation | null; evidenceVisualizationIds: string[]; assetIds: string[]; feasibility: FeasibilityState };

export type StoryboardProvenance = {
  storyboardId: string;
  storyboardVersion: typeof STORYBOARD_PLANNING_ALGORITHM_VERSION;
  scriptId: string;
  scriptVersion: string;
  architectureId: string | null;
  creativeDevelopmentPackageId: string | null;
  creativeBriefId: string | null;
  ideaId: string | null;
  patternIds: string[];
  strategyVersion: string | null;
  opportunityVersion: string | null;
  evidenceIds: string[];
  algorithmVersions: string[];
  generatedAt: string;
  evaluatedAt: string;
  snapshotId: string | null;
  calibrationStatus: typeof STORYBOARD_PLANNING_CONFIG.calibrationStatus;
};

export type Storyboard = {
  storyboardId: string;
  storyboardVersion: typeof STORYBOARD_PLANNING_ALGORITHM_VERSION;
  scriptId: string;
  scenes: StoryboardScene[];
  continuity: StoryboardContinuity;
  assetRequirements: AssetRequirement[];
  evidenceVisualizations: EvidenceVisualization[];
  illustrativeVisuals: IllustrativeVisual[];
  dataAvailability: Record<string, VisualAvailability>;
  productionFeasibility: { state: FeasibilityState; sceneStates: Record<string, FeasibilityState>; unknownAssetCount: number; rightsReviewCount: number; blockers: string[] };
  confidence: ConfidenceLevel;
  reasons: StoryboardReason[];
  risks: StoryboardRisk[];
  blockers: StoryboardBlocker[];
  readiness: StoryboardReadiness;
  provenance: StoryboardProvenance;
};

export type StoryboardPlanningInput = { scriptDraft: ScriptDraft | null; scriptDevelopment?: ScriptDevelopmentIntelligenceReport | null; capturedAt?: string | null; snapshotId?: string | null };
export type StoryboardIntelligenceReport = { schemaVersion: 'storyboard-planning.v1'; algorithmVersion: typeof STORYBOARD_PLANNING_ALGORITHM_VERSION; scope: 'LONG_FORM'; storyboards: Storyboard[]; blockedStoryboards: Storyboard[]; gaps: string[]; provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof STORYBOARD_PLANNING_CONFIG.calibrationStatus } };

const confidenceRank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const uniqRisks = (values: StoryboardRisk[]) => [...new Map(values.map(item => [`${item.code}:${item.refs.join('|')}`, item])).values()];
const stableHash = (value: string) => { let hash = 0x811c9dc5; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); };
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const has = (value: string, pattern: RegExp) => pattern.test(value.toLocaleLowerCase());
const minConfidence = (a: ConfidenceLevel, b: ConfidenceLevel): ConfidenceLevel => confidenceRank[a] <= confidenceRank[b] ? a : b;

function architectureSections(report: ScriptDevelopmentIntelligenceReport | null | undefined, script: ScriptDraft) {
  const packages = [...(report?.packages || []), ...(report?.blockedPackages || [])];
  const pkg = packages.find(item => item.scriptArchitecture.architectureId === script.architectureId);
  return new Map((pkg?.sections || []).map(section => [section.sectionId, section]));
}

function sectionVisualText(section: ScriptSectionDraft, architecture: ScriptSection | undefined) {
  return uniq([...(architecture?.visualRequirements || []).map(item => item.whatMustBeShown), ...section.visualRequirements, ...section.evidenceRequirements]);
}

function derivePurpose(section: ScriptSectionDraft, visuals: string[], architecture?: ScriptSection): ScenePurpose {
  const role = `${section.sectionRole} ${architecture?.payoffPlan.payoffType || ''}`.toLocaleLowerCase();
  const body = visuals.join(' ').toLocaleLowerCase();
  if (/opening|hook/.test(role)) return 'HOOK_VISUAL';
  if (/evidence|proof|data|metric|chart|screenshot/.test(role + body)) return 'EVIDENCE';
  if (/comparison|option|trade/.test(role)) return 'COMPARISON';
  if (/experiment|method|process|setup|observation/.test(role)) return 'EXPERIMENT';
  if (/escalat|turning/.test(role)) return 'ESCALATION';
  if (/result|payoff|resolution|takeaway|conclusion/.test(role)) return architecture?.payoffPlan.payoffType === 'NONE' ? 'CONCLUSION' : 'PAYOFF';
  if (/transition/.test(role)) return 'TRANSITION';
  if (/mechanism|explain|why/.test(role)) return 'EXPLANATION';
  return 'CONTEXT';
}

function deriveMode(visuals: string[], purpose: ScenePurpose, evidenceAvailable: boolean) : VisualMode {
  const value = visuals.join(' ');
  if (!value) return 'NARRATION_ONLY';
  if (has(value, /screenshot|screen capture|studio screenshot|截图|屏幕/)) return 'SCREEN_CAPTURE';
  if (has(value, /archive|historical footage|档案|历史影像/)) return 'ARCHIVE';
  if (has(value, /ai generated|ai-generated|ai生成|生成视觉/)) return 'AI_GENERATED_VISUAL';
  if (has(value, /chart|graph|quantitative|trend|数值|指标|图表|数据/)) return evidenceAvailable ? 'CHART' : 'UNKNOWN';
  if (has(value, /diagram|flow|mechanism|因果|流程|结构/)) return 'DIAGRAM';
  if (has(value, /text callout|caption|label|文字|标注/)) return 'TEXT_GRAPHIC';
  if (purpose === 'EVIDENCE') return evidenceAvailable ? 'BROLL' : 'UNKNOWN';
  if (purpose === 'EXPLANATION') return 'DIAGRAM';
  return 'BROLL';
}

function availabilityFor(visuals: string[], claims: ScriptDraft['claimRegistry'], evidence: ScriptDraft['evidenceRegistry']): VisualAvailability {
  const value = visuals.join(' ');
  if (has(value, /screenshot|截图|screen capture/)) return 'REQUIRES_ASSET';
  if (has(value, /archive|档案/)) return 'REQUIRES_RIGHTS_REVIEW';
  if (has(value, /transcript|subtitle|音频|转录/)) return 'REQUIRES_VISION';
  if (has(value, /chart|graph|quantitative|trend|数值|指标|图表|数据/) && !claims.length && !evidence.length) return 'REQUIRES_RESEARCH';
  if (!claims.length && !evidence.length) return 'DERIVABLE';
  if (claims.some(claim => claim.supportStatus === 'UNSUPPORTED')) return 'UNAVAILABLE';
  if (claims.some(claim => claim.supportStatus === 'RESEARCH_REQUIRED' || claim.supportStatus === 'UNKNOWN')) return 'REQUIRES_RESEARCH';
  return evidence.length ? 'DERIVABLE' : 'PARTIAL';
}

function splitVisualUnits(visuals: string[], section: ScriptSectionDraft, architecture?: ScriptSection) {
  if (visuals.length <= STORYBOARD_PLANNING_CONFIG.maxVisualResponsibilitiesPerScene && !visuals.some(item => /;|；|随后|then| and /i.test(item))) return [visuals];
  const chunks: string[][] = [];
  visuals.forEach(item => {
    const parts = item.split(/;|；|\s+then\s+|随后|\s+and\s+/i).map(text).filter(Boolean);
    parts.forEach(part => { const last = chunks.at(-1); if (last && last.length < STORYBOARD_PLANNING_CONFIG.maxVisualResponsibilitiesPerScene && normalize(part).split(' ')[0] === normalize(last[0] || '').split(' ')[0]) last.push(part); else chunks.push([part]); });
  });
  if (chunks.length <= 1) return [visuals];
  // Keep a simple explanatory section intact; splitting is for independent responsibilities.
  const role = `${section.sectionRole} ${architecture?.objective || ''}`;
  if (chunks.length === 2 && !/evidence|comparison|experiment|process|result|机制|证据|对比|实验|流程/.test(role.toLocaleLowerCase()) && !/archive|档案|ai-generated|ai生成/.test(visuals.join(' ').toLocaleLowerCase())) return [visuals];
  return chunks.slice(0, 4);
}

function sceneConfidence(script: ScriptDraft, availability: VisualAvailability): ConfidenceLevel {
  let result = script.confidence;
  if (availability === 'UNAVAILABLE' || availability === 'REQUIRES_VISION') result = minConfidence(result, 'LOW');
  else if (availability !== 'DERIVABLE' && availability !== 'AVAILABLE') result = minConfidence(result, 'MEDIUM');
  return result;
}

function makeRisk(code: string, message: string, refs: string[]): StoryboardRisk { return { code, message, refs }; }

function makeScene(script: ScriptDraft, section: ScriptSectionDraft, architecture: ScriptSection | undefined, visuals: string[], index: number): SemanticScene {
  const claims = script.claimRegistry.filter(claim => claim.sectionId === section.sectionId);
  const evidence = script.evidenceRegistry.filter(item => claims.some(claim => claim.evidenceIds.includes(item.evidenceId)));
  const purpose = derivePurpose(section, visuals, architecture);
  const availability = availabilityFor(visuals, claims, evidence);
  const chartEvidenceAvailable = evidence.length > 0 && claims.length > 0 && claims.every(claim => claim.supportStatus === 'SUPPORTED');
  const mode = deriveMode(visuals, purpose, chartEvidenceAvailable || availability === 'AVAILABLE' || availability === 'DERIVABLE');
  const independentResponsibilities = visuals.length;
  const overloaded = independentResponsibilities > STORYBOARD_PLANNING_CONFIG.maxVisualResponsibilitiesPerScene;
  const density: VisualDensity = overloaded ? 'OVERLOADED' : independentResponsibilities >= 3 ? 'HIGH' : independentResponsibilities === 2 ? 'MEDIUM' : 'LOW';
  const complexity: VisualComplexity = overloaded ? 'COMPLEX' : independentResponsibilities >= 2 ? 'MODERATE' : visuals.length ? 'SIMPLE' : 'UNKNOWN';
  const risk = overloaded ? [makeRisk('SCENE_OVERLOAD', '场景包含多个独立视觉责任，已建议拆分。', [section.sectionId])] : [];
  if (availability === 'REQUIRES_VISION') risk.push(makeRisk('SEMANTIC_VISUAL_UNDERSTANDING_UNAVAILABLE', '需要视觉理解或人工核验，不能从元数据推断画面事实。', [section.sectionId]));
  if (availability === 'REQUIRES_RIGHTS_REVIEW') risk.push(makeRisk('RIGHTS_STATUS_UNKNOWN', '档案素材的使用权仍需复核。', [section.sectionId]));
  const shotCount = Math.min(STORYBOARD_PLANNING_CONFIG.maxRecommendedShotsPerScene, Math.max(1, independentResponsibilities || 1));
  const beatIds = architecture?.narrationBeats.map(beat => beat.beatId) || [];
  return { sceneId: `${script.scriptId}:scene:${section.sectionId}:${index + 1}`, sourceSectionId: section.sectionId, narrationBeatIds: beatIds, purpose, visualObjective: visuals[0] || section.sectionObjective, informationRequirement: section.keyPoints.join('；') || section.sectionObjective, evidenceRequirement: evidence.map(item => item.description).join('；') || '无额外证据可视化要求', characterRequirement: has(visuals.join(' '), /character|person|host|creator|主角|人物|频道/) ? '保持主要人物身份一致' : null, environmentRequirement: has(visuals.join(' '), /location|room|workshop|kitchen|outdoor|indoor|现场|场景|环境|地点/) ? '保持场景与空间关系一致' : null, objectRequirement: has(visuals.join(' '), /prop|object|tool|道具|物件|工具/) ? '保持关键道具状态一致' : null, graphicRequirement: mode === 'CHART' || mode === 'DIAGRAM' || mode === 'TEXT_GRAPHIC' ? visuals.join('；') : null, continuityRequirements: [section.transitionIn, section.transitionOut].filter(Boolean), suggestedVisualMode: mode, shotCountRequirement: { min: 1, max: shotCount, reason: independentResponsibilities > 1 ? '多个信息/视觉责任需要分层呈现' : '单一视觉责任可用一个主镜头承载', calibrationStatus: STORYBOARD_PLANNING_CONFIG.calibrationStatus }, durationRange: { ...STORYBOARD_PLANNING_CONFIG.defaultShotDurationRange, calibrationStatus: STORYBOARD_PLANNING_CONFIG.calibrationStatus }, visualDensity: density, complexity, confidence: sceneConfidence(script, availability), risks: risk, provenance: { scriptId: script.scriptId, scriptSectionId: section.sectionId, architectureSectionId: architecture?.sectionId || null, scriptVersion: script.scriptVersion } };
}

function shotFor(scene: SemanticScene, index: number, claims: ScriptDraft['claimRegistry'], evidence: ScriptDraft['evidenceRegistry']): ShotRequirement {
  const evidenceClaim = claims.find(claim => claim.sectionId === scene.sourceSectionId);
  const evidenceRef = evidenceClaim?.evidenceIds.map(id => evidence.find(item => item.evidenceId === id)?.description || id).join('；') || null;
  const purpose: ShotPurpose = scene.purpose === 'EVIDENCE' ? 'SHOW_EVIDENCE' : scene.purpose === 'HOOK_VISUAL' ? 'REVEAL' : scene.purpose === 'COMPARISON' ? 'COMPARE' : scene.purpose === 'EXPLANATION' ? 'EXPLAIN' : scene.purpose === 'PAYOFF' ? 'PAYOFF' : index === 0 ? 'ESTABLISH' : 'DETAIL';
  const mode = scene.suggestedVisualMode;
  const source: ProductionSource = mode === 'CHART' || mode === 'SCREEN_CAPTURE' || mode === 'ARCHIVE' ? 'PUBLIC_EVIDENCE' : mode === 'AI_GENERATED_VISUAL' ? 'AI_GENERATABLE' : mode === 'NARRATION_ONLY' ? 'UNKNOWN' : 'CREATOR_CAPTURE';
  const risks = [...scene.risks];
  if (mode === 'UNKNOWN') risks.push(makeRisk('VISUAL_EVIDENCE_UNAVAILABLE', '没有可验证的视觉来源，保留为未知而不生成证明画面。', [scene.sceneId]));
  return { shotId: `${scene.sceneId}:shot:${index + 1}`, sceneId: scene.sceneId, purpose, subjectRequirement: scene.characterRequirement || scene.visualObjective, environmentRequirement: scene.environmentRequirement, actionRequirement: index === 0 ? scene.visualObjective : scene.informationRequirement, compositionRequirement: index === 0 ? '建立清晰的主体与信息层级' : '突出当前信息单元，避免把不同责任挤在同一画面', continuityRequirement: scene.continuityRequirements.join('；') || null, evidenceRequirement: evidenceRef, visualMode: mode, estimatedDuration: scene.durationRange, productionSource: source, confidence: scene.confidence, risks };
}

function addAsset(registry: Map<string, AssetRequirement>, type: AssetType, label: string, sceneId: string, availability: AssetAvailability, source: ProductionSource, rightsStatus: RightsState, notes: string[] = []) {
  const key = `${type}:${normalize(label)}`;
  const existing = registry.get(key);
  if (existing) { existing.usedBySceneIds = uniq([...existing.usedBySceneIds, sceneId]); existing.notes = uniq([...existing.notes, ...notes]); return existing; }
  const asset: AssetRequirement = { assetId: `asset:${stableHash(key)}`, type, label, availability, source, rightsStatus, usedBySceneIds: [sceneId], notes: uniq(notes) };
  registry.set(key, asset); return asset;
}

function assetsFor(scene: SemanticScene, claims: ScriptDraft['claimRegistry'], evidence: ScriptDraft['evidenceRegistry'], registry: Map<string, AssetRequirement>) {
  const ids: string[] = [];
  const all = `${scene.visualObjective} ${scene.informationRequirement} ${scene.evidenceRequirement}`;
  if (scene.characterRequirement) ids.push(addAsset(registry, 'CHARACTER', 'primary subject', scene.sceneId, 'UNKNOWN', 'CREATOR_CAPTURE', 'IP_DEPENDENCY_UNKNOWN', ['角色身份与外观需要后续参考资料。']).assetId);
  if (scene.environmentRequirement) ids.push(addAsset(registry, 'LOCATION', 'primary environment', scene.sceneId, 'UNKNOWN', 'CREATOR_CAPTURE', 'IP_DEPENDENCY_UNKNOWN').assetId);
  if (scene.objectRequirement) ids.push(addAsset(registry, 'PROP', 'key prop', scene.sceneId, 'REQUIRES_ASSET', 'USER_PROVIDED', 'IP_DEPENDENCY_UNKNOWN').assetId);
  if (scene.suggestedVisualMode === 'SCREEN_CAPTURE') ids.push(addAsset(registry, 'SCREENSHOT', 'source screenshot', scene.sceneId, 'REQUIRES_ASSET', 'USER_PROVIDED', 'RIGHTS_REVIEW_REQUIRED', ['没有认证 Studio 截图时不可伪造。']).assetId);
  if (scene.suggestedVisualMode === 'CHART') ids.push(addAsset(registry, 'CHART', 'evidence chart data', scene.sceneId, evidence.length ? 'REQUIRES_RESEARCH' : 'UNAVAILABLE', 'PUBLIC_EVIDENCE', 'LOW_KNOWN_RISK', ['只允许引用真实证据数据，不生成未知数值。']).assetId);
  if (scene.suggestedVisualMode === 'DIAGRAM') ids.push(addAsset(registry, 'DIAGRAM', 'explanatory diagram', scene.sceneId, 'REQUIRES_ASSET', 'CREATOR_CAPTURE', 'LOW_KNOWN_RISK').assetId);
  if (scene.suggestedVisualMode === 'ARCHIVE') ids.push(addAsset(registry, 'ARCHIVE', 'archive/public footage', scene.sceneId, 'REQUIRES_RESEARCH', 'REQUIRES_RESEARCH', 'RIGHTS_REVIEW_REQUIRED').assetId);
  if (scene.suggestedVisualMode === 'AI_GENERATED_VISUAL') ids.push(addAsset(registry, 'IMAGE', 'future generated visual', scene.sceneId, 'REQUIRES_ASSET', 'AI_GENERATABLE', 'IP_DEPENDENCY_UNKNOWN', ['仅记录语义需求；本阶段不生成模型提示词。']).assetId);
  if (has(all, /stock|素材库|b roll|b-roll/)) ids.push(addAsset(registry, 'STOCK', 'supporting stock footage', scene.sceneId, 'REQUIRES_RESEARCH', 'LICENSED_STOCK', 'LICENSE_REQUIRED').assetId);
  if (!claims.length && scene.suggestedVisualMode === 'NARRATION_ONLY') return ids;
  return ids;
}

function evidenceForScene(script: ScriptDraft, scene: SemanticScene, shots: ShotRequirement[], assetIds: string[]): EvidenceVisualization[] {
  const claims = script.claimRegistry.filter(claim => claim.sectionId === scene.sourceSectionId);
  const output: EvidenceVisualization[] = [];
  claims.forEach(claim => {
    const evidenceIds = claim.evidenceIds.length ? claim.evidenceIds : [`unknown-evidence:${claim.claimId}`];
    evidenceIds.forEach((evidenceId, evidenceIndex) => {
      const evidence = script.evidenceRegistry.find(item => item.evidenceId === evidenceId);
      const unavailable = claim.supportStatus === 'UNSUPPORTED' || claim.supportStatus === 'UNKNOWN' || claim.supportStatus === 'RESEARCH_REQUIRED' || !evidence;
      const quantitative = has(`${claim.text} ${evidence?.description || ''}`, /\b\d+(?:\.\d+)?%?|views|播放|percent|rate|metric|数据|数值|指标/);
      const type: EvidenceVisualizationType = unavailable ? 'UNKNOWN' : scene.suggestedVisualMode === 'CHART' && quantitative ? 'CHART' : scene.suggestedVisualMode === 'SCREEN_CAPTURE' ? 'SCREENSHOT' : scene.suggestedVisualMode === 'ARCHIVE' ? 'ARCHIVE_PUBLIC_EVIDENCE' : 'DIRECT_VISUAL_EVIDENCE';
      const availability: VisualAvailability = unavailable ? (claim.supportStatus === 'RESEARCH_REQUIRED' ? 'REQUIRES_RESEARCH' : 'UNAVAILABLE') : scene.suggestedVisualMode === 'SCREEN_CAPTURE' ? 'REQUIRES_ASSET' : scene.suggestedVisualMode === 'ARCHIVE' ? 'REQUIRES_RIGHTS_REVIEW' : 'DERIVABLE';
      output.push({ visualizationId: `evidence-visual:${stableHash(`${scene.sceneId}|${claim.claimId}|${evidenceId}|${evidenceIndex}`)}`, claimId: claim.claimId, evidenceId, sceneId: scene.sceneId, shotId: shots[0]?.shotId || null, visualizationType: type, evidenceKind: 'EVIDENCE_VISUAL', requiredAsset: assetIds[0] || null, source: evidence ? (evidence.sourceType === 'PUBLIC_VIDEO_METADATA' || evidence.sourceType === 'PUBLIC_CASE' ? 'PUBLIC_EVIDENCE' : 'REQUIRES_RESEARCH') : 'REQUIRES_RESEARCH', rightsStatus: scene.suggestedVisualMode === 'ARCHIVE' ? 'RIGHTS_REVIEW_REQUIRED' : 'LOW_KNOWN_RISK', confidence: unavailable ? 'LOW' : scene.confidence, availability, note: unavailable ? '证据不可用时保持 UNKNOWN/REQUIRES_RESEARCH，不把插画或元数据包装成事实证明。' : '可视化必须保留 Claim → Evidence → Scene → Shot provenance。' });
    });
  });
  return output;
}

function continuityFor(scenes: StoryboardScene[]): StoryboardContinuity {
  const characters = new Map<string, CharacterContinuity>();
  const environments = new Map<string, EnvironmentContinuity>();
  const props = new Map<string, PropContinuity>();
  scenes.forEach(item => {
    const scene = item.semanticScene;
    if (scene.characterRequirement) { const current = characters.get('character:primary-subject') || { characterId: 'character:primary-subject', role: 'primary subject', identityRequirements: ['身份在场景间保持一致'], appearanceRequirements: ['外观不得无依据漂移'], wardrobeRequirements: [], sceneIds: [] }; current.sceneIds = uniq([...current.sceneIds, scene.sceneId]); characters.set(current.characterId, current); }
    if (scene.environmentRequirement) { const current = environments.get('environment:primary') || { environmentId: 'environment:primary', environmentType: 'primary environment', visualProperties: [], timeOfDay: null, sceneIds: [], constraints: ['空间关系保持可识别'] }; current.sceneIds = uniq([...current.sceneIds, scene.sceneId]); environments.set(current.environmentId, current); }
    if (scene.objectRequirement) { const current = props.get('prop:key') || { propId: 'prop:key', label: 'key prop', sceneIds: [], constraints: ['状态变化需有脚本依据'] }; current.sceneIds = uniq([...current.sceneIds, scene.sceneId]); props.set(current.propId, current); }
  });
  const relations = scenes.slice(1).map((item, index) => { const previous = scenes[index]; const all = `${previous.semanticScene.continuityRequirements.join(' ')} ${item.semanticScene.continuityRequirements.join(' ')}`; const relation: ContinuityRelation = /next day|later|earlier|历史|次日|随后|之后/i.test(all) ? 'TIME_SHIFT' : previous.semanticScene.environmentRequirement !== item.semanticScene.environmentRequirement ? 'LOCATION_SHIFT' : previous.semanticScene.purpose === 'EVIDENCE' || item.semanticScene.purpose === 'EVIDENCE' ? 'EVIDENCE_SHIFT' : previous.semanticScene.purpose === 'COMPARISON' || item.semanticScene.purpose === 'COMPARISON' ? 'COMPARISON_SHIFT' : 'CONTINUOUS'; return { fromSceneId: previous.semanticScene.sceneId, toSceneId: item.semanticScene.sceneId, relation, note: relation === 'TIME_SHIFT' ? '脚本只提供相对时间关系，未推断具体日期。' : '保持语义连续，避免无依据的空间或时间跳跃。' }; });
  return { characters: [...characters.values()], environments: [...environments.values()], props: [...props.values()], relations };
}

function resolveReadiness(script: ScriptDraft, scenes: StoryboardScene[], evidenceVisualizations: EvidenceVisualization[], assets: AssetRequirement[], blockers: StoryboardBlocker[], risks: StoryboardRisk[]): StoryboardReadiness {
  if (script.readiness === 'BLOCKED') return 'BLOCKED';
  if (blockers.length) return 'BLOCKED';
  if (script.readiness === 'NEEDS_REVISION') return 'NEEDS_REVISION';
  if (!scenes.length) return 'INSUFFICIENT';
  if (script.promiseDelivery.state === 'PROMISE_NOT_DELIVERED' || (script.promiseDelivery.unresolvedElements.length && !scenes.some(item => item.semanticScene.purpose === 'PAYOFF' || item.semanticScene.purpose === 'RESOLUTION'))) return 'NEEDS_REVISION';
  if (scenes.some(item => item.semanticScene.visualDensity === 'OVERLOADED')) return 'NEEDS_REVISION';
  if (risks.length || assets.some(asset => asset.availability !== 'AVAILABLE') || evidenceVisualizations.some(item => item.availability !== 'DERIVABLE' && item.availability !== 'AVAILABLE')) return 'READY_WITH_CAUTION';
  return script.readiness === 'READY_FOR_STORYBOARD' ? 'READY_FOR_PRODUCTION_PLANNING' : 'READY_WITH_CAUTION';
}

function buildStoryboard(script: ScriptDraft, input: StoryboardPlanningInput): Storyboard {
  const architecture = architectureSections(input.scriptDevelopment, script);
  const assets = new Map<string, AssetRequirement>();
  const scenes: StoryboardScene[] = [];
  script.sections.forEach(section => {
    const architectureSection = architecture.get(section.sectionId);
    const visuals = sectionVisualText(section, architectureSection);
    const units = splitVisualUnits(visuals, section, architectureSection);
    units.forEach((unit, unitIndex) => {
      const semanticScene = makeScene(script, section, architectureSection, unit, unitIndex);
      const claims = script.claimRegistry.filter(claim => claim.sectionId === section.sectionId);
      const evidence = script.evidenceRegistry.filter(item => claims.some(claim => claim.evidenceIds.includes(item.evidenceId)));
      const shotCount = Math.min(semanticScene.shotCountRequirement.max, Math.max(1, unit.length));
      const shots = Array.from({ length: shotCount }, (_, index) => shotFor(semanticScene, index, claims, evidence));
      const assetIds = assetsFor(semanticScene, claims, evidence, assets);
      scenes.push({ semanticScene, shots, transitionIn: null, transitionOut: null, evidenceVisualizationIds: [], assetIds, feasibility: semanticScene.suggestedVisualMode === 'UNKNOWN' ? 'REQUIRES_RESEARCH' : assetIds.length ? 'FEASIBLE_WITH_RISK' : 'FEASIBLE' });
    });
  });
  const continuity = continuityFor(scenes);
  scenes.forEach((item, index) => { item.transitionIn = continuity.relations[index - 1]?.relation || null; item.transitionOut = continuity.relations[index]?.relation || null; });
  const evidenceVisualizations = scenes.flatMap(item => evidenceForScene(script, item.semanticScene, item.shots, item.assetIds));
  const illustrativeVisuals: IllustrativeVisual[] = scenes.filter(item => item.semanticScene.suggestedVisualMode === 'BROLL' || item.semanticScene.suggestedVisualMode === 'STATIC_IMAGE' || item.semanticScene.suggestedVisualMode === 'AI_GENERATED_VISUAL').filter(item => !script.claimRegistry.some(claim => claim.sectionId === item.semanticScene.sourceSectionId)).map(item => ({ visualizationId: `illustration:${stableHash(item.semanticScene.sceneId)}`, sceneId: item.semanticScene.sceneId, shotId: item.shots[0]?.shotId || null, visualizationType: item.semanticScene.suggestedVisualMode === 'AI_GENERATED_VISUAL' ? 'AI_GENERATED_VISUAL' : item.semanticScene.suggestedVisualMode === 'STATIC_IMAGE' ? 'STATIC_IMAGE' : 'SUPPORTING_BROLL', evidenceKind: 'ILLUSTRATIVE_VISUAL', note: '这是辅助理解的插画/补充 B-roll，不得被展示为 Claim 的证据。' }));
  evidenceVisualizations.forEach(item => { const scene = scenes.find(sceneItem => sceneItem.semanticScene.sceneId === item.sceneId); if (scene) scene.evidenceVisualizationIds = uniq([...scene.evidenceVisualizationIds, item.visualizationId]); });
  const risks = uniqRisks([...scenes.flatMap(item => item.semanticScene.risks), ...evidenceVisualizations.filter(item => item.availability !== 'DERIVABLE' && item.availability !== 'AVAILABLE').map(item => makeRisk(item.visualizationType === 'UNKNOWN' ? 'VISUAL_EVIDENCE_UNAVAILABLE' : 'VALIDATION_NOT_AVAILABLE', item.note, [item.visualizationId]))]);
  const blockers: StoryboardBlocker[] = [];
  if (script.readiness === 'BLOCKED') blockers.push({ code: 'SCRIPT_BLOCKED', message: '脚本状态为 BLOCKED，不能生成 READY 的 Storyboard。', refs: [script.scriptId] });
  if (scenes.some(item => item.semanticScene.visualObjective.toLocaleLowerCase().includes('contradict') || item.semanticScene.visualObjective.includes('矛盾'))) blockers.push({ code: 'VISUAL_SCRIPT_CONTRADICTION', message: '视觉责任与脚本存在显式矛盾，需要修改脚本或需求。', refs: scenes.map(item => item.semanticScene.sceneId) });
  if (scenes.some(item => /known rights blocker|版权阻塞|权利阻塞/i.test(item.semanticScene.visualObjective))) blockers.push({ code: 'KNOWN_RIGHTS_BLOCKER', message: '脚本标记了已知权利阻塞，不能进入制作规划。', refs: scenes.map(item => item.semanticScene.sceneId) });
  const readiness = resolveReadiness(script, scenes, evidenceVisualizations, [...assets.values()], blockers, risks);
  const confidence = scenes.reduce<ConfidenceLevel>((current, item) => minConfidence(current, item.semanticScene.confidence), script.confidence);
  const sceneStates = Object.fromEntries(scenes.map(item => [item.semanticScene.sceneId, item.feasibility]));
  const rightsReviewCount = [...assets.values()].filter(asset => asset.rightsStatus === 'RIGHTS_REVIEW_REQUIRED' || asset.rightsStatus === 'LICENSE_REQUIRED').length;
  const unknownAssetCount = [...assets.values()].filter(asset => asset.availability !== 'AVAILABLE').length;
  const productionState: FeasibilityState = blockers.length ? 'BLOCKED' : rightsReviewCount ? 'RIGHTS_REVIEW_REQUIRED' : unknownAssetCount ? 'FEASIBLE_WITH_RISK' : 'FEASIBLE';
  const reasons: StoryboardReason[] = [{ code: 'STORYBOARD_SCRIPT_READY', message: 'Storyboard 只消费 Long-form Script Draft，不重写脚本。', refs: [script.scriptId] }, { code: 'STORYBOARD_SCENE_STRUCTURE_COMPLETE', message: `已将 ${script.sections.length} 个脚本段落转换为 ${scenes.length} 个语义场景。`, refs: scenes.map(item => item.semanticScene.sceneId) }];
  if (evidenceVisualizations.length) reasons.push({ code: 'STORYBOARD_EVIDENCE_VISUAL_SUPPORTED', message: `已登记 ${evidenceVisualizations.length} 条 Claim → Evidence 可视化依赖。`, refs: evidenceVisualizations.map(item => item.visualizationId) });
  if ([...assets.values()].some(asset => asset.availability !== 'AVAILABLE')) reasons.push({ code: 'STORYBOARD_ASSET_REQUIRED', message: '未知或缺失资产保持显式状态，未假设资产可用。', refs: [...assets.values()].filter(asset => asset.availability !== 'AVAILABLE').map(asset => asset.assetId) });
  if (rightsReviewCount) reasons.push({ code: 'STORYBOARD_RIGHTS_REVIEW_REQUIRED', message: '涉及档案/截图/库存素材时保留权利复核状态。', refs: [...assets.values()].filter(asset => asset.rightsStatus !== 'LOW_KNOWN_RISK').map(asset => asset.assetId) });
  reasons.push({ code: 'STORYBOARD_CALIBRATION_REQUIRED', message: '镜头时长、场景拆分阈值和视觉密度仍需真实制作结果校准。', refs: [STORYBOARD_PLANNING_ALGORITHM_VERSION] });
  const chartRequirement = scenes.some(item => item.semanticScene.suggestedVisualMode === 'CHART' || Boolean(item.semanticScene.graphicRequirement?.toLocaleLowerCase().includes('chart')));
  const dataAvailability: Record<string, VisualAvailability> = { scriptSections: script.sections.length ? 'AVAILABLE' : 'UNAVAILABLE', narration: script.sections.some(section => section.narration) ? 'AVAILABLE' : 'PARTIAL', claimRegistry: script.claimRegistry.length ? 'AVAILABLE' : 'PARTIAL', evidenceRegistry: script.evidenceRegistry.length ? 'PARTIAL' : 'UNAVAILABLE', visualUnderstanding: 'REQUIRES_VISION', screenshots: assets.has('SCREENSHOT:source screenshot') ? 'REQUIRES_ASSET' : 'UNAVAILABLE', chartData: evidenceVisualizations.some(item => item.visualizationType === 'CHART') ? 'DERIVABLE' : chartRequirement ? 'REQUIRES_RESEARCH' : 'UNAVAILABLE', sourceMedia: 'REQUIRES_ASSET', rightsClearance: rightsReviewCount ? 'REQUIRES_RIGHTS_REVIEW' : 'PARTIAL', canvasAssets: 'UNAVAILABLE' };
  return { storyboardId: `storyboard:${stableHash(`${script.scriptId}|${STORYBOARD_PLANNING_ALGORITHM_VERSION}`)}`, storyboardVersion: STORYBOARD_PLANNING_ALGORITHM_VERSION, scriptId: script.scriptId, scenes, continuity, assetRequirements: [...assets.values()], evidenceVisualizations, illustrativeVisuals, dataAvailability, productionFeasibility: { state: productionState, sceneStates, unknownAssetCount, rightsReviewCount, blockers: blockers.map(item => item.code) }, confidence, reasons, risks, blockers, readiness, provenance: { storyboardId: `storyboard:${stableHash(`${script.scriptId}|${STORYBOARD_PLANNING_ALGORITHM_VERSION}`)}`, storyboardVersion: STORYBOARD_PLANNING_ALGORITHM_VERSION, scriptId: script.scriptId, scriptVersion: script.scriptVersion, architectureId: script.architectureId, creativeDevelopmentPackageId: script.creativeDevelopmentPackageId, creativeBriefId: script.creativeBriefId, ideaId: script.ideaId, patternIds: script.provenance.patternIds, strategyVersion: script.provenance.strategyVersion, opportunityVersion: script.provenance.opportunityVersion, evidenceIds: uniq([...script.provenance.evidenceIds, ...evidenceVisualizations.map(item => item.evidenceId)]), algorithmVersions: uniq([STORYBOARD_PLANNING_ALGORITHM_VERSION, script.provenance.scriptVersion]), generatedAt: input.capturedAt || script.provenance.generatedAt, evaluatedAt: script.provenance.evaluatedAt, snapshotId: input.snapshotId || script.provenance.snapshotId, calibrationStatus: STORYBOARD_PLANNING_CONFIG.calibrationStatus } };
}

export function buildStoryboardIntelligence(input: StoryboardPlanningInput): StoryboardIntelligenceReport {
  const scripts = input.scriptDraft ? [input.scriptDraft] : [];
  const storyboards = scripts.map(script => buildStoryboard(script, input));
  return { schemaVersion: 'storyboard-planning.v1', algorithmVersion: STORYBOARD_PLANNING_ALGORITHM_VERSION, scope: 'LONG_FORM', storyboards: storyboards.filter(item => item.readiness !== 'BLOCKED'), blockedStoryboards: storyboards.filter(item => item.readiness === 'BLOCKED'), gaps: uniq(['P4 Phase 1 只生成语义 Storyboard 与 Shot Requirements，不生成图片/视频提示词、音频、Canvas 节点或模型调用。', '视觉理解、真实截图、转录、图表数据、资产可用性和版权清权仍需后续输入。', '镜头时长、场景拆分、视觉密度阈值标记 CALIBRATION_REQUIRED']), provenance: { source: input.scriptDraft?.provenance.sourceCaseIds.length ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt || null, snapshotId: input.snapshotId || null, algorithmVersions: [STORYBOARD_PLANNING_ALGORITHM_VERSION], calibrationStatus: STORYBOARD_PLANNING_CONFIG.calibrationStatus } };
}

export function normalizeStoryboardIntelligenceReport(value: unknown): StoryboardIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<StoryboardIntelligenceReport>;
  if (raw.schemaVersion !== 'storyboard-planning.v1' || raw.algorithmVersion !== STORYBOARD_PLANNING_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.storyboards) || !Array.isArray(raw.blockedStoryboards)) return null;
  return raw as StoryboardIntelligenceReport;
}

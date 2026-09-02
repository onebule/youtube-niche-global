/**
 * P3 Phase 2 — deterministic Idea Validation and Creative Brief intelligence.
 *
 * This Long-form-only layer validates the P3.1 IdeaCandidate against the
 * current strategy, Pattern, trend, fit and validation snapshots. It creates
 * a structured hand-off for a future creative-development phase; it does not
 * generate titles, hooks, scripts, storyboards, prompts or Canvas state.
 */
import type { ConfidenceLevel, EntryDecisionStatus } from './entry-decision.ts';
import type { OpportunityAssessment } from './opportunity-engine.ts';
import type { ContentPatternTrendReport, PatternTrendState } from './content-pattern-trends.ts';
import type { ContentStrategy, StrategyPatternRole } from './content-strategy.ts';
import type { ExperimentValidationReport, PatternValidationState } from './experiment-validation.ts';
import type { ContentPattern } from './content-patterns.ts';
import type { IdeaCandidate, IdeaIntelligenceReport, IdeaNoveltyAssessment } from './idea-intelligence.ts';

export const IDEA_VALIDATION_ALGORITHM_VERSION = 'idea-validation-v1';
export const CREATIVE_BRIEF_ALGORITHM_VERSION = 'creative-brief-v1';

/** All new thresholds are provisional until labelled outcomes are available. */
export const CREATIVE_BRIEF_CONFIG = Object.freeze({
  minSourceCaseDiversity: 2,
  sourceCaseCopyLimit: 0.72,
  maxAllowedDuplicateSimilarity: 0.78,
  minPatternFidelity: 'ACCEPTABLE_MATCH' as const,
  minBriefConfidence: 'MEDIUM' as const,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type IdeaValidationState = 'VALIDATED' | 'CONDITIONALLY_VALIDATED' | 'NEEDS_REVISION' | 'REJECTED' | 'INSUFFICIENT';
export type StrategyAlignmentState = 'ALIGNED' | 'PARTIALLY_ALIGNED' | 'MISALIGNED' | 'INSUFFICIENT';
export type PatternFidelityState = 'STRONG_MATCH' | 'ACCEPTABLE_MATCH' | 'WEAK_MATCH' | 'MISMATCH' | 'INSUFFICIENT';
export type ProductionFeasibilityState = 'FEASIBLE' | 'FEASIBLE_WITH_RISK' | 'UNKNOWN' | 'BLOCKED' | 'INSUFFICIENT';
export type IpRightsRiskState = 'LOW_KNOWN_RISK' | 'POTENTIAL_DEPENDENCY' | 'UNKNOWN' | 'BLOCKED';
export type CreativeBriefReadiness = 'READY_FOR_CREATIVE_DEVELOPMENT' | 'READY_WITH_CAUTION' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type CreativeBriefEvidenceKind = 'FACT' | 'INFERENCE' | 'LOW_CONFIDENCE';

export type ValidationContextSnapshot = {
  ideaVersion: string;
  strategyVersion: string | null;
  opportunityVersion: string | null;
  patternVersion: string | null;
  validationVersion: string | null;
  ideaGenerationVersion: string;
  evaluatedAt: string;
  snapshotId: string | null;
  entryDecision: EntryDecisionStatus | 'UNKNOWN';
  entryWindow: string | null;
  strategyRole: StrategyPatternRole;
  patternIds: string[];
  sourceCaseIds: string[];
  patternTrend: PatternTrendState;
  nicheFit: string;
  patternValidation: PatternValidationState | 'NOT_AVAILABLE';
};

export type CreativeBriefReason = { code: string; message: string; refs: string[] };
export type CreativeBriefRisk = { code: string; message: string; refs: string[] };
export type CreativeBriefBlocker = { code: string; message: string; refs: string[] };
export type CreativeBriefEvidence = { kind: CreativeBriefEvidenceKind; code: string; message: string; refs: string[] };

export type IdeaValidation = {
  state: IdeaValidationState;
  confidence: ConfidenceLevel;
  strategyAlignment: { state: StrategyAlignmentState; role: StrategyPatternRole; evidenceRefs: string[] };
  patternFidelity: { state: PatternFidelityState; patternId: string | null; evidenceRefs: string[] };
  originality: IdeaNoveltyAssessment;
  sourceCaseDistance: { closestCaseId: string | null; surfaceSimilarity: number | null; semanticSimilarity: number | null; evidenceStatus: 'LEXICAL_PROXY' | 'REQUIRES_EMBEDDING' };
  evidence: CreativeBriefEvidence[];
  reasons: CreativeBriefReason[];
  risks: CreativeBriefRisk[];
  blockers: CreativeBriefBlocker[];
  validationContext: ValidationContextSnapshot;
  provenance: { ideaId: string; sourceCaseIds: string[]; patternIds: string[]; algorithmVersion: typeof IDEA_VALIDATION_ALGORITHM_VERSION; evaluatedAt: string; calibrationStatus: typeof CREATIVE_BRIEF_CONFIG.calibrationStatus };
};

export type ProductionFeasibility = {
  state: ProductionFeasibilityState;
  evidence: string[];
  missing: string[];
  reasons: CreativeBriefReason[];
  blockers: CreativeBriefBlocker[];
  calibrationStatus: typeof CREATIVE_BRIEF_CONFIG.calibrationStatus;
};

export type IpRightsRisk = { state: IpRightsRiskState; evidence: string[]; note: string; blockers: CreativeBriefBlocker[] };

export type CreativeBrief = {
  briefId: string;
  briefVersion: typeof CREATIVE_BRIEF_ALGORITHM_VERSION;
  ideaId: string;
  nicheId: string;
  strategyContext: { role: StrategyPatternRole; strategyVersion: string | null; positioning: string | null; entryDecision: EntryDecisionStatus | 'UNKNOWN'; entryWindow: string | null };
  patternContext: { patternId: string | null; label: string | null; taxonomy: string | null; featureValue: string | null; trendState: PatternTrendState; fitStatus: string; fidelity: PatternFidelityState };
  validation: IdeaValidation;
  audienceProblem: { viewerQuestion: string; problem: string; curiosityGap: string };
  contentPromise: { statement: string; value: string };
  coreMechanism: { type: string; description: string; patternId: string | null };
  differentiation: { changedSubject: string; changedContext: string; changedQuestion: string; changedEvidence: string; sourceCaseDistance: string };
  mandatoryConstraints: string[];
  flexibleVariables: string[];
  productionFeasibility: ProductionFeasibility;
  originality: IdeaNoveltyAssessment;
  ipRightsRisk: IpRightsRisk;
  confidence: ConfidenceLevel;
  reasons: CreativeBriefReason[];
  risks: CreativeBriefRisk[];
  blockers: CreativeBriefBlocker[];
  readiness: CreativeBriefReadiness;
  provenance: { briefId: string; ideaId: string; sourceCaseIds: string[]; patternIds: string[]; strategyVersion: string | null; opportunityVersion: string | null; ideaGenerationVersion: string; ideaValidationVersion: typeof IDEA_VALIDATION_ALGORITHM_VERSION; creativeBriefVersion: typeof CREATIVE_BRIEF_ALGORITHM_VERSION; patternTrend: PatternTrendState; nicheFit: string; patternValidation: PatternValidationState | 'NOT_AVAILABLE'; confidence: ConfidenceLevel; evaluatedAt: string; snapshotId: string | null; calibrationStatus: typeof CREATIVE_BRIEF_CONFIG.calibrationStatus };
};

export type CreativeBriefIntelligenceReport = {
  schemaVersion: 'creative-brief-intelligence.v1';
  algorithmVersion: typeof CREATIVE_BRIEF_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  context: ValidationContextSnapshot;
  validations: IdeaValidation[];
  briefs: CreativeBrief[];
  blockedBriefs: CreativeBrief[];
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof CREATIVE_BRIEF_CONFIG.calibrationStatus };
};

type Input = {
  nicheId: string;
  topic: string;
  mechanism: string;
  productionType: string;
  ideaIntelligence: IdeaIntelligenceReport | null;
  opportunityAssessment: OpportunityAssessment | null;
  contentPatternTrend: ContentPatternTrendReport | null;
  contentStrategy: ContentStrategy | null;
  experimentValidation: ExperimentValidationReport | null;
  capturedAt: string | null;
  snapshotId: string | null;
};

const confidenceRank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function selectionFor(strategy: ContentStrategy | null, patternId: string) {
  return [...(strategy?.primaryPatterns || []), ...(strategy?.testPatterns || []), ...(strategy?.watchPatterns || []), ...(strategy?.deprioritizedPatterns || []), ...(strategy?.avoidedPatterns || []), ...(strategy?.insufficientPatterns || [])].find(item => item.patternId === patternId) || null;
}
function trendFor(report: ContentPatternTrendReport | null, patternId: string) { return report?.assessments.find(item => item.pattern.patternId === patternId) || null; }
function fitFor(report: ContentPatternTrendReport | null, patternId: string) { return report?.nicheFits.find(item => item.pattern.patternId === patternId) || null; }
function patternFor(strategy: ContentStrategy | null, trend: ContentPatternTrendReport | null, patternId: string): ContentPattern | null {
  return selectionFor(strategy, patternId)?.pattern || trend?.assessments.find(item => item.pattern.patternId === patternId)?.pattern || trend?.currentReport.aggregations.find(item => item.pattern.patternId === patternId)?.pattern || null;
}
function evaluationTime(input: Input) { return input.capturedAt && Number.isFinite(Date.parse(input.capturedAt)) ? input.capturedAt : '1970-01-01T00:00:00.000Z'; }
function sourceCreatorCount(input: Input, candidate: IdeaCandidate) {
  const cases = input.ideaIntelligence?.cases || [];
  const creators = candidate.sourceCaseIds.map(caseId => cases.find(item => item.caseId === caseId)?.creatorId || caseId);
  return new Set(creators.filter(Boolean)).size;
}

function strategyAlignment(candidate: IdeaCandidate, input: Input) {
  const patternId = candidate.patternIds[0] || '';
  const selection = selectionFor(input.contentStrategy, patternId);
  const role = selection?.role || candidate.strategyRole;
  const decision = input.opportunityAssessment?.decision.status || candidate.fit.opportunityDecision || 'UNKNOWN';
  const refs = [`idea:${candidate.ideaId}`, `strategy:${role}`, `opportunity:${decision}`];
  if (!selection || !input.contentStrategy || !input.opportunityAssessment) return { state: 'INSUFFICIENT' as const, role, evidenceRefs: refs };
  if (role === 'AVOID' || role === 'DEPRIORITIZE' || role === 'INSUFFICIENT' || decision === 'AVOID') return { state: 'MISALIGNED' as const, role, evidenceRefs: refs };
  if (candidate.fit.validationState === 'CONTRADICTED') return { state: 'MISALIGNED' as const, role, evidenceRefs: [...refs, `validation:${patternId}`] };
  const open = input.opportunityAssessment.entryWindow === 'OPEN' || input.opportunityAssessment.entryWindow === 'NARROWING';
  if (!open) return { state: 'PARTIALLY_ALIGNED' as const, role, evidenceRefs: refs };
  if (role === 'PRIMARY' && (decision === 'RECOMMENDED' || decision === 'TEST')) return { state: 'ALIGNED' as const, role, evidenceRefs: refs };
  if (role === 'TEST' && (decision === 'TEST' || decision === 'RECOMMENDED' || decision === 'CAUTION')) return { state: 'ALIGNED' as const, role, evidenceRefs: refs };
  if (role === 'WATCH') return { state: 'PARTIALLY_ALIGNED' as const, role, evidenceRefs: refs };
  return { state: 'PARTIALLY_ALIGNED' as const, role, evidenceRefs: refs };
}

function patternFidelity(candidate: IdeaCandidate, input: Input) {
  const patternId = candidate.patternIds[0] || null;
  if (!patternId) return { state: 'INSUFFICIENT' as const, patternId: null, evidenceRefs: [] };
  const pattern = patternFor(input.contentStrategy, input.contentPatternTrend, patternId);
  if (!pattern) return { state: 'INSUFFICIENT' as const, patternId, evidenceRefs: [`pattern:${patternId}`] };
  const trend = trendFor(input.contentPatternTrend, patternId);
  const fit = fitFor(input.contentPatternTrend, patternId);
  const cases = candidate.sourceCaseIds.length;
  if (!cases) return { state: 'INSUFFICIENT' as const, patternId, evidenceRefs: [`pattern:${patternId}`, 'cases'] };
  const status = trend?.state || candidate.fit.trendState;
  if (!candidate.concept.patternReference.includes(patternId) || !candidate.concept.contentMechanism) return { state: 'MISMATCH' as const, patternId, evidenceRefs: [`pattern:${patternId}`, 'concept'] };
  if (status !== 'INSUFFICIENT' && (fit?.status || candidate.fit.nicheFit) !== 'INSUFFICIENT') {
    const strong = candidate.concept.angle.includes(pattern.label) || candidate.concept.contentMechanism.includes(pattern.featureValue) || pattern.taxonomy === 'DURATION_BAND';
    return { state: strong ? 'STRONG_MATCH' as const : 'ACCEPTABLE_MATCH' as const, patternId, evidenceRefs: [`pattern:${patternId}`, `trend:${status}`, `fit:${fit?.status || candidate.fit.nicheFit}`] };
  }
  return { state: 'WEAK_MATCH' as const, patternId, evidenceRefs: [`pattern:${patternId}`] };
}

function validationState(candidate: IdeaCandidate, alignment: ReturnType<typeof strategyAlignment>, fidelity: ReturnType<typeof patternFidelity>, input: Input) {
  const blockers: CreativeBriefBlocker[] = [];
  const reasons: CreativeBriefReason[] = [];
  const risks: CreativeBriefRisk[] = [];
  const refs = [`idea:${candidate.ideaId}`];
  candidate.blockers.forEach(item => blockers.push({ code: item.code, message: item.message, refs: item.refs }));
  if (!candidate.sourceCaseIds.length) blockers.push({ code: 'NO_SOURCE_CASES', message: '没有来源案例，无法完成可追溯验证。', refs: ['cases'] });
  if (fidelity.state === 'INSUFFICIENT') blockers.push({ code: 'NO_PATTERN_EVIDENCE', message: '缺少可确认的 Pattern 证据。', refs: fidelity.evidenceRefs });
  if (fidelity.state === 'MISMATCH' || fidelity.state === 'WEAK_MATCH') blockers.push({ code: 'PATTERN_MISMATCH', message: 'Idea 不再充分反映父 Pattern 的结构机制。', refs: fidelity.evidenceRefs });
  if (alignment.state === 'MISALIGNED') blockers.push({ code: input.opportunityAssessment?.decision.status === 'AVOID' ? 'ENTRY_DECISION_AVOID' : alignment.role === 'AVOID' ? 'STRATEGY_ROLE_AVOID' : 'STRATEGY_MISALIGNED', message: '当前入口或策略角色不允许创建可执行 Brief。', refs: alignment.evidenceRefs });
  if (candidate.novelty.state === 'DUPLICATE') blockers.push({ code: 'DUPLICATE_IDEA', message: 'Idea 与当前组合中的兄弟候选重复。', refs: [candidate.novelty.closestSiblingIdeaId || 'novelty'] });
  if (candidate.novelty.state === 'TOO_SIMILAR') risks.push({ code: 'SOURCE_CASE_SIMILARITY', message: '与来源案例的词面结构过近，需要改变主体、场景或问题。', refs: [candidate.novelty.closestCaseId || 'novelty'] });
  if (candidate.fit.trendState === 'DILUTING') risks.push({ code: 'PATTERN_DILUTION', message: 'Pattern 采用扩散但表现走弱。', refs: ['patternTrend'] });
  if (candidate.fit.trendState === 'DECLINING') risks.push({ code: 'PATTERN_DECLINE', message: 'Pattern 趋势正在回落。', refs: ['patternTrend'] });
  if (candidate.fit.nicheFit === 'WEAK_FIT') risks.push({ code: 'WEAK_NICHE_FIT', message: '当前赛道适配偏弱。', refs: ['nicheFit'] });
  const creators = sourceCreatorCount(input, candidate);
  if (creators < CREATIVE_BRIEF_CONFIG.minSourceCaseDiversity) risks.push({ code: 'LOW_SOURCE_CASE_DIVERSITY', message: '来源案例覆盖有限，置信度需要封顶。', refs: ['cases'] });
  if (candidate.novelty.dimensions.semanticSimilarity === null) risks.push({ code: 'SEMANTIC_SIMILARITY_UNAVAILABLE', message: '未接入真实 embeddings；相似度仅为词面代理。', refs: ['novelty.dimensions.semanticSimilarity'] });
  const validation = candidate.fit.validationState;
  if (validation === 'NOT_AVAILABLE' || !input.experimentValidation?.observations.length) risks.push({ code: 'VALIDATION_NOT_AVAILABLE', message: '尚无真实实验观察，不能把验证反馈当作正向证据。', refs: ['experimentValidation.observations'] });
  if (validation === 'CONTRADICTED') blockers.push({ code: 'CONTRADICTED_VALIDATION', message: 'P2 Phase 4 对该 Pattern 给出矛盾反馈。', refs: [`validation:${candidate.patternIds[0] || 'unknown'}`] });
  if (alignment.state === 'ALIGNED') reasons.push({ code: candidate.strategyRole === 'TEST' ? 'IDEA_TEST_PATTERN_ALIGNMENT' : 'IDEA_PRIMARY_PATTERN_ALIGNMENT', message: 'Idea 与当前策略角色和入口窗口一致。', refs: alignment.evidenceRefs });
  if (fidelity.state === 'STRONG_MATCH') reasons.push({ code: 'IDEA_STRONG_PATTERN_FIDELITY', message: 'Idea 保留了父 Pattern 的可识别结构机制。', refs: fidelity.evidenceRefs });
  if (candidate.novelty.state === 'NOVEL') reasons.push({ code: 'IDEA_LOW_SOURCE_CASE_SURFACE_COPYING', message: 'Idea 与来源案例保持较低词面重合。', refs: refs });
  if (candidate.novelty.state === 'ACCEPTABLE_VARIATION') reasons.push({ code: 'IDEA_ACCEPTABLE_ORIGINALITY', message: 'Idea 是在保留 Pattern 机制下的可接受改写。', refs: refs });
  const missing = !input.ideaIntelligence || !input.contentStrategy || !input.contentPatternTrend || !candidate.sourceCaseIds.length;
  let state: IdeaValidationState;
  if (blockers.some(item => ['ENTRY_DECISION_AVOID', 'STRATEGY_ROLE_AVOID', 'PATTERN_AVOIDED_BY_STRATEGY', 'IDEA_GATE_BLOCKED', 'DUPLICATE_IDEA', 'CONTRADICTED_VALIDATION', 'CONTRADICTED_PATTERN_VALIDATION', 'PATTERN_MISMATCH'].includes(item.code))) state = 'REJECTED';
  else if (missing || candidate.confidence === 'INSUFFICIENT' || alignment.state === 'INSUFFICIENT' || fidelity.state === 'INSUFFICIENT') state = 'INSUFFICIENT';
  else if (blockers.length) state = 'REJECTED';
  else if (candidate.novelty.state === 'TOO_SIMILAR' || fidelity.state === 'WEAK_MATCH') state = 'NEEDS_REVISION';
  else if (alignment.state === 'PARTIALLY_ALIGNED' || candidate.novelty.state === 'ACCEPTABLE_VARIATION' || validation === 'NOT_AVAILABLE' || validation === 'INCONCLUSIVE' || validation === 'PARTIALLY_VALIDATED') state = 'CONDITIONALLY_VALIDATED';
  else state = 'VALIDATED';
  return { state, reasons, risks, blockers };
}

function productionFeasibility(input: Input, candidate: IdeaCandidate): ProductionFeasibility {
  const production = text(input.productionType);
  const missing: string[] = [];
  const reasons: CreativeBriefReason[] = [];
  const blockers: CreativeBriefBlocker[] = [];
  if (!production || production === '待识别形式') { missing.push('productionType'); return { state: 'UNKNOWN', evidence: [], missing, reasons: [{ code: 'BRIEF_PRODUCTION_FEASIBILITY_UNKNOWN', message: '制作形式尚未被可靠识别。', refs: ['productionType'] }], blockers, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus }; }
  if (/blocked|unavailable|prohibited/i.test(production)) { blockers.push({ code: 'KNOWN_PRODUCTION_BLOCKER', message: '上游制作形式明确标记为不可用。', refs: ['productionType'] }); return { state: 'BLOCKED', evidence: [production], missing, reasons, blockers, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus }; }
  const evidence = [`公开 Pattern 形式：${production}`, `来源案例：${candidate.sourceCaseIds.length} 条`];
  if (/licensed|footage|celebrity|real.world|现场|授权/i.test(production)) return { state: 'FEASIBLE_WITH_RISK', evidence, missing: ['真实拍摄/授权条件'], reasons: [{ code: 'BRIEF_PRODUCTION_DEPENDENCY', message: '形式依赖现实拍摄、特定身份或授权素材，需人工确认。', refs: ['productionType'] }], blockers, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus };
  reasons.push({ code: 'BRIEF_KNOWN_FORMAT', message: '已知公开视频元数据提供了可复用的制作形式线索。', refs: ['productionType', 'pattern'] });
  return { state: 'FEASIBLE', evidence, missing, reasons, blockers, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus };
}

function ipRisk(candidate: IdeaCandidate): IpRightsRisk {
  const source = candidate.concept.subject;
  if (/licensed|copyright|brand|disney|marvel|celebrity|授权|版权|品牌/i.test(source)) return { state: 'POTENTIAL_DEPENDENCY', evidence: ['主题文本包含可能需要授权或权利核验的线索。'], note: '仅表示潜在依赖，不代表法律结论。', blockers: [] };
  return { state: 'LOW_KNOWN_RISK', evidence: ['可用主题元数据未出现明确的授权/特定 IP 依赖线索。'], note: '这是基于现有元数据的低已知风险，不代表法律清权。', blockers: [] };
}

function briefReadiness(validation: IdeaValidation, production: ProductionFeasibility, ip: IpRightsRisk, confidence: ConfidenceLevel): CreativeBriefReadiness {
  if (validation.state === 'REJECTED' || validation.blockers.length || production.state === 'BLOCKED' || ip.state === 'BLOCKED') return 'BLOCKED';
  if (validation.state === 'INSUFFICIENT' || production.state === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (validation.state === 'NEEDS_REVISION' || validation.patternFidelity.state === 'WEAK_MATCH') return 'NEEDS_REVISION';
  if (validation.state === 'VALIDATED' && production.state === 'FEASIBLE' && ip.state === 'LOW_KNOWN_RISK' && confidenceRank[confidence] >= confidenceRank[CREATIVE_BRIEF_CONFIG.minBriefConfidence]) return 'READY_FOR_CREATIVE_DEVELOPMENT';
  return 'READY_WITH_CAUTION';
}

function confidenceFor(candidate: IdeaCandidate, validation: IdeaValidation, production: ProductionFeasibility): ConfidenceLevel {
  const values: ConfidenceLevel[] = [candidate.confidence, validation.strategyAlignment.state === 'ALIGNED' ? 'HIGH' : validation.strategyAlignment.state === 'PARTIALLY_ALIGNED' ? 'MEDIUM' : 'LOW', validation.patternFidelity.state === 'STRONG_MATCH' ? 'HIGH' : validation.patternFidelity.state === 'ACCEPTABLE_MATCH' ? 'MEDIUM' : 'LOW'];
  if (candidate.sourceCaseIds.length < CREATIVE_BRIEF_CONFIG.minSourceCaseDiversity) values.push('MEDIUM');
  if (candidate.novelty.dimensions.semanticSimilarity === null) values.push('MEDIUM');
  if (validation.risks.some(item => item.code === 'VALIDATION_NOT_AVAILABLE')) values.push('MEDIUM');
  if (production.state === 'UNKNOWN') values.push('MEDIUM');
  return values.reduce((lowest, value) => confidenceRank[value] < confidenceRank[lowest] ? value : lowest, 'HIGH' as ConfidenceLevel);
}

function contextFor(input: Input, candidate: IdeaCandidate): ValidationContextSnapshot {
  const patternId = candidate.patternIds[0] || '';
  const trend = trendFor(input.contentPatternTrend, patternId);
  return { ideaVersion: IDEA_VALIDATION_ALGORITHM_VERSION, strategyVersion: input.contentStrategy?.strategyVersion || null, opportunityVersion: input.opportunityAssessment?.algorithmVersion || null, patternVersion: trend?.provenance.algorithmVersion || input.contentPatternTrend?.algorithmVersion || null, validationVersion: input.experimentValidation?.algorithmVersion || null, ideaGenerationVersion: candidate.algorithmVersion, evaluatedAt: evaluationTime(input), snapshotId: input.snapshotId, entryDecision: input.opportunityAssessment?.decision.status || candidate.fit.opportunityDecision || 'UNKNOWN', entryWindow: input.opportunityAssessment?.entryWindow || null, strategyRole: candidate.strategyRole, patternIds: candidate.patternIds, sourceCaseIds: candidate.sourceCaseIds, patternTrend: candidate.fit.trendState, nicheFit: candidate.fit.nicheFit, patternValidation: candidate.fit.validationState };
}

function buildValidation(input: Input, candidate: IdeaCandidate): IdeaValidation {
  const context = contextFor(input, candidate);
  const alignment = strategyAlignment(candidate, input);
  const fidelity = patternFidelity(candidate, input);
  const result = validationState(candidate, alignment, fidelity, input);
  const confidence = result.state === 'REJECTED' ? 'LOW' : confidenceFor(candidate, { state: result.state, confidence: candidate.confidence, strategyAlignment: alignment, patternFidelity: fidelity, originality: candidate.novelty, sourceCaseDistance: { closestCaseId: candidate.novelty.closestCaseId, surfaceSimilarity: candidate.novelty.dimensions.surfaceSimilarity, semanticSimilarity: candidate.novelty.dimensions.semanticSimilarity, evidenceStatus: candidate.novelty.dimensions.semanticSimilarity === null ? 'LEXICAL_PROXY' : 'LEXICAL_PROXY' }, evidence: [], reasons: result.reasons, risks: result.risks, blockers: result.blockers, validationContext: context, provenance: { ideaId: candidate.ideaId, sourceCaseIds: candidate.sourceCaseIds, patternIds: candidate.patternIds, algorithmVersion: IDEA_VALIDATION_ALGORITHM_VERSION, evaluatedAt: context.evaluatedAt, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus } }, { state: 'UNKNOWN', evidence: [], missing: [], reasons: [], blockers: [], calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus });
  const evidence: CreativeBriefEvidence[] = [{ kind: 'FACT', code: 'IDEA_CANDIDATE_LINEAGE', message: `复用 P3.1 Idea ${candidate.ideaId} 及其来源案例。`, refs: [`idea:${candidate.ideaId}`, ...candidate.sourceCaseIds] }, { kind: 'FACT', code: 'STRATEGY_ALIGNMENT', message: `策略角色 ${alignment.role}，对齐状态 ${alignment.state}。`, refs: alignment.evidenceRefs }, { kind: 'FACT', code: 'PATTERN_FIDELITY', message: `Pattern fidelity 为 ${fidelity.state}。`, refs: fidelity.evidenceRefs }];
  if (candidate.novelty.dimensions.semanticSimilarity === null) evidence.push({ kind: 'LOW_CONFIDENCE', code: 'LEXICAL_SIMILARITY_ONLY', message: '没有真实 embedding；语义相似度保持不可用。', refs: ['novelty.dimensions.semanticSimilarity'] });
  return { state: result.state, confidence, strategyAlignment: alignment, patternFidelity: fidelity, originality: candidate.novelty, sourceCaseDistance: { closestCaseId: candidate.novelty.closestCaseId, surfaceSimilarity: candidate.novelty.dimensions.surfaceSimilarity, semanticSimilarity: candidate.novelty.dimensions.semanticSimilarity, evidenceStatus: candidate.novelty.dimensions.semanticSimilarity === null ? 'LEXICAL_PROXY' : 'LEXICAL_PROXY' }, evidence, reasons: result.reasons, risks: result.risks, blockers: result.blockers, validationContext: context, provenance: { ideaId: candidate.ideaId, sourceCaseIds: candidate.sourceCaseIds, patternIds: candidate.patternIds, algorithmVersion: IDEA_VALIDATION_ALGORITHM_VERSION, evaluatedAt: context.evaluatedAt, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus } };
}

function buildBrief(input: Input, candidate: IdeaCandidate, validation: IdeaValidation): CreativeBrief {
  const patternId = candidate.patternIds[0] || null;
  const pattern = patternId ? patternFor(input.contentStrategy, input.contentPatternTrend, patternId) : null;
  const trend = patternId ? trendFor(input.contentPatternTrend, patternId) : null;
  const fit = patternId ? fitFor(input.contentPatternTrend, patternId) : null;
  const feasibility = productionFeasibility(input, candidate);
  const ip = ipRisk(candidate);
  const confidence = confidenceFor(candidate, validation, feasibility);
  const readiness = briefReadiness(validation, feasibility, ip, confidence);
  const briefId = `creative-brief-v1:${stableHash([candidate.ideaId, validation.validationContext.evaluatedAt, validation.validationContext.strategyVersion || '', validation.validationContext.patternVersion || ''].join('|'))}`;
  const mechanism = candidate.concept.contentMechanism || input.mechanism || '用公开证据回答一个具体问题。';
  const reasons = [...validation.reasons, ...feasibility.reasons];
  const risks = [...validation.risks];
  if (feasibility.state === 'UNKNOWN') risks.push({ code: 'PRODUCTION_FEASIBILITY_UNKNOWN', message: '制作可行性证据不足，需人工评估。', refs: ['productionFeasibility'] });
  if (ip.state === 'UNKNOWN' || ip.state === 'POTENTIAL_DEPENDENCY') risks.push({ code: 'IP_DEPENDENCY_UNKNOWN', message: ip.note, refs: ['ipRightsRisk'] });
  const blockers = [...validation.blockers, ...feasibility.blockers, ...ip.blockers];
  const mandatoryConstraints = uniq([`必须保留 Pattern ${patternId || '未知'} 的结构机制。`, `必须回答：${candidate.concept.coreQuestion}`, `不得复制来源案例 ${candidate.sourceCaseIds.join('、') || '未知'} 的具体人物、例子、场景或结局。`, `保持 Long-form 形式，并与 ${candidate.strategyRole} 策略角色一致。`]);
  const flexibleVariables = ['具体例子与素材', '拍摄/叙事场景', '信息排列顺序', '语气与视觉处理', '支撑结论的公开证据'];
  return { briefId, briefVersion: CREATIVE_BRIEF_ALGORITHM_VERSION, ideaId: candidate.ideaId, nicheId: candidate.nicheId, strategyContext: { role: candidate.strategyRole, strategyVersion: input.contentStrategy?.strategyVersion || null, positioning: input.contentStrategy?.positioning.summary || null, entryDecision: input.opportunityAssessment?.decision.status || candidate.fit.opportunityDecision || 'UNKNOWN', entryWindow: input.opportunityAssessment?.entryWindow || null }, patternContext: { patternId, label: pattern?.label || null, taxonomy: pattern?.taxonomy || null, featureValue: pattern?.featureValue || null, trendState: trend?.state || candidate.fit.trendState, fitStatus: fit?.status || candidate.fit.nicheFit, fidelity: validation.patternFidelity.state }, validation, audienceProblem: { viewerQuestion: candidate.concept.coreQuestion, problem: `观众需要理解${candidate.concept.subject}中一个可验证、但尚未被充分解释的问题。`, curiosityGap: `现有案例展示了结果或结构，Brief 要求解释为什么在新的主体与场景中仍然成立。` }, contentPromise: { statement: candidate.concept.audiencePromise, value: '提供可复核的判断依据，而不是承诺播放或收益。' }, coreMechanism: { type: pattern?.featureValue || input.mechanism, description: mechanism, patternId }, differentiation: { changedSubject: `替换来源案例中的具体主体：${candidate.concept.subject}。`, changedContext: '迁移到新的场景、语境或应用对象。', changedQuestion: candidate.concept.coreQuestion, changedEvidence: '使用新的公开案例与可核验依据，不复用来源案例的具体编排。', sourceCaseDistance: candidate.novelty.dimensions.surfaceSimilarity === null ? '词面距离未知；需要人工复核，语义相似度未接入。' : `词面相似度代理 ${candidate.novelty.dimensions.surfaceSimilarity.toFixed(2)}，阈值需校准。` }, mandatoryConstraints, flexibleVariables, productionFeasibility: feasibility, originality: candidate.novelty, ipRightsRisk: ip, confidence, reasons, risks, blockers, readiness, provenance: { briefId, ideaId: candidate.ideaId, sourceCaseIds: candidate.sourceCaseIds, patternIds: candidate.patternIds, strategyVersion: input.contentStrategy?.strategyVersion || null, opportunityVersion: input.opportunityAssessment?.algorithmVersion || null, ideaGenerationVersion: candidate.algorithmVersion, ideaValidationVersion: IDEA_VALIDATION_ALGORITHM_VERSION, creativeBriefVersion: CREATIVE_BRIEF_ALGORITHM_VERSION, patternTrend: candidate.fit.trendState, nicheFit: candidate.fit.nicheFit, patternValidation: candidate.fit.validationState, confidence, evaluatedAt: validation.validationContext.evaluatedAt, snapshotId: validation.validationContext.snapshotId, calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus } };
}

export function buildCreativeBriefIntelligence(input: Input): CreativeBriefIntelligenceReport {
  const candidates = [...(input.ideaIntelligence?.candidates || []), ...(input.ideaIntelligence?.blockedCandidates || [])];
  const validations = candidates.map(candidate => buildValidation(input, candidate));
  const allBriefs = candidates.map((candidate, index) => buildBrief(input, candidate, validations[index]));
  const briefs = allBriefs.filter(brief => ['READY_FOR_CREATIVE_DEVELOPMENT', 'READY_WITH_CAUTION'].includes(brief.readiness));
  const blockedBriefs = allBriefs.filter(brief => !['READY_FOR_CREATIVE_DEVELOPMENT', 'READY_WITH_CAUTION'].includes(brief.readiness));
  const context: ValidationContextSnapshot = candidates[0] ? contextFor(input, candidates[0]) : { ideaVersion: IDEA_VALIDATION_ALGORITHM_VERSION, strategyVersion: input.contentStrategy?.strategyVersion || null, opportunityVersion: input.opportunityAssessment?.algorithmVersion || null, patternVersion: input.contentPatternTrend?.algorithmVersion || null, validationVersion: input.experimentValidation?.algorithmVersion || null, ideaGenerationVersion: input.ideaIntelligence?.algorithmVersion || 'case-pattern-idea-v1', evaluatedAt: evaluationTime(input), snapshotId: input.snapshotId, entryDecision: (input.opportunityAssessment?.decision.status || 'UNKNOWN') as EntryDecisionStatus | 'UNKNOWN', entryWindow: input.opportunityAssessment?.entryWindow || null, strategyRole: 'INSUFFICIENT', patternIds: [], sourceCaseIds: [], patternTrend: 'INSUFFICIENT', nicheFit: 'INSUFFICIENT', patternValidation: 'NOT_AVAILABLE' };
  const gaps = [...(input.ideaIntelligence?.gaps || [])];
  if (!input.ideaIntelligence) gaps.push('缺少 P3 Phase 1 Idea Intelligence，无法进行候选验证。');
  if (!input.experimentValidation?.observations.length) gaps.push('VALIDATION_NOT_AVAILABLE：当前没有真实实验观察。');
  if (!input.contentPatternTrend) gaps.push('缺少可比较 Pattern Trend；Fidelity 与趋势判断保持保守。');
  gaps.push('v1 未接入 embeddings、字幕、视觉理解或私有 YouTube analytics。');
  return { schemaVersion: 'creative-brief-intelligence.v1', algorithmVersion: CREATIVE_BRIEF_ALGORITHM_VERSION, scope: 'LONG_FORM', context, validations, briefs, blockedBriefs, gaps: uniq(gaps), provenance: { source: input.opportunityAssessment ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt, snapshotId: input.snapshotId, algorithmVersions: uniq([CREATIVE_BRIEF_ALGORITHM_VERSION, IDEA_VALIDATION_ALGORITHM_VERSION, input.ideaIntelligence?.algorithmVersion || '', input.contentStrategy?.strategyVersion || '', input.contentPatternTrend?.algorithmVersion || '', input.experimentValidation?.algorithmVersion || '']), calibrationStatus: CREATIVE_BRIEF_CONFIG.calibrationStatus } };
}

export function normalizeCreativeBriefIntelligenceReport(value: unknown): CreativeBriefIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<CreativeBriefIntelligenceReport>;
  if (raw.schemaVersion !== 'creative-brief-intelligence.v1' || raw.algorithmVersion !== CREATIVE_BRIEF_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.validations) || !Array.isArray(raw.briefs) || !Array.isArray(raw.blockedBriefs)) return null;
  return raw as CreativeBriefIntelligenceReport;
}

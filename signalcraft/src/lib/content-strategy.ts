/**
 * P2 Phase 3 — deterministic Long-form content strategy.
 *
 * This layer consumes the canonical Opportunity, Pattern and Pattern Trend
 * contracts. It owns neither scoring nor pattern extraction and is never
 * called by Shorts. Every decision is a role with traceable evidence rather
 * than another opaque score.
 */
import type { ConfidenceLevel, EntryDecisionStatus } from './entry-decision.ts';
import type { EntryWindow, OpportunityAssessment } from './opportunity-engine.ts';
import type {
  ContentPattern,
  ContentPatternReport,
  PatternAggregation,
  PatternConfidence,
  PatternRepeatabilityStatus,
  WinningPatternStatus,
} from './content-patterns.ts';
import type {
  ContentPatternTrendReport,
  NichePatternFit,
  PatternFitConfidence,
  PatternFitStatus,
  PatternSelectionEvidence,
  PatternTrendAssessment,
  PatternTrendState,
} from './content-pattern-trends.ts';

export const CONTENT_STRATEGY_ALGORITHM_VERSION = 'content-strategy-v1';

/** New Phase 3 gates are provisional until calibrated on production samples. */
export const CONTENT_STRATEGY_CONFIG = Object.freeze({
  minPrimaryConfidence: 'MEDIUM' as const,
  minPrimaryCreators: 3,
  minPrimaryBreakoutCreators: 2,
  minPrimaryPerformanceSamples: 3,
  minPrimaryMedianPerformance: 1.1,
  minPrimaryRepeatability: 'REPEATED_ACROSS_CREATORS' as const,
  maxConcentrationForPrimary: 0.7,
  maxPrimaryPatterns: 1,
  minExperimentSample: 5,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type StrategyPatternRole = 'PRIMARY' | 'TEST' | 'WATCH' | 'DEPRIORITIZE' | 'AVOID' | 'INSUFFICIENT';
export type StrategyStatus = 'INSUFFICIENT' | 'RESEARCH_ONLY' | 'VALIDATION' | 'ACTIONABLE' | 'BLOCKED';
export type StrategyPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type StrategyReason = { code: string; message: string; evidenceRefs: string[] };
export type StrategyRisk = { code: string; message: string; evidenceRefs: string[] };
export type StrategyBlocker = { code: string; message: string; evidenceRefs: string[] };
export type StrategyOpportunityContext = {
  decision: EntryDecisionStatus | 'UNKNOWN';
  confidence: ConfidenceLevel;
  entryWindow: EntryWindow | 'UNKNOWN';
  lifecycle: string | null;
  evidenceRefs: string[];
};

export type StrategyPatternSelection = {
  patternId: string;
  pattern: ContentPattern;
  role: StrategyPatternRole;
  priority: StrategyPriority;
  patternStatus: WinningPatternStatus;
  trendState: PatternTrendState;
  trendConfidence: PatternConfidence;
  fitStatus: PatternFitStatus | null;
  fitConfidence: PatternFitConfidence | null;
  repeatability: PatternRepeatabilityStatus;
  creatorBreadth: number;
  breakoutEvidence: { videos: number; creators: number; rate: number | null };
  normalizedPerformance: { median: number | null; p75: number | null; samples: number };
  reasons: StrategyReason[];
  risks: StrategyRisk[];
  blockers: StrategyBlocker[];
  evidenceRefs: string[];
};

export type StrategyPositioning = {
  direction: 'EVIDENCE_BACKED_FORMAT' | 'EMERGING_FORMAT_TEST' | 'RESEARCH_ONLY' | 'NO_ENTRY_POSITIONING';
  summary: string;
  supportingPatternIds: string[];
  guardrails: string[];
};

export type StrategyExperimentPlan = {
  status: 'READY_FOR_VALIDATION' | 'BOUNDED_TEST' | 'RESEARCH_ONLY' | 'BLOCKED';
  primaryPatternIds: string[];
  testPatternIds: string[];
  priorities: Array<{ patternId: string; priority: StrategyPriority }>;
  minimumEligibleSample: number;
  sampleSemantics: 'ELIGIBLE_LONG_FORM_VIDEOS';
  evaluationMetrics: Array<'NORMALIZED_CREATOR_PERFORMANCE' | 'BREAKOUT_RATE' | 'REPEATABILITY' | 'CREATOR_BREADTH'>;
  successCriteria: string[];
  failureCriteria: string[];
  calibrationStatus: typeof CONTENT_STRATEGY_CONFIG.calibrationStatus;
};

export type StrategyProvenance = {
  source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM';
  algorithmVersions: string[];
  nicheId: string;
  opportunityDecision: string;
  opportunityEvidenceRefs: string[];
  patternIds: string[];
  currentWindow: string | null;
  comparisonWindow: string | null;
  historicalSemantics: string | null;
  calibrationStatus: typeof CONTENT_STRATEGY_CONFIG.calibrationStatus;
};

export type StrategyEvidenceAudit = Record<string, 'AVAILABLE' | 'DERIVABLE' | 'PARTIAL' | 'UPSTREAM_OPAQUE' | 'UNAVAILABLE'>;

export type ContentStrategy = {
  schemaVersion: 'content-strategy.v1';
  strategyVersion: typeof CONTENT_STRATEGY_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  nicheId: string;
  strategyStatus: StrategyStatus;
  opportunityContext: StrategyOpportunityContext;
  primaryPatterns: StrategyPatternSelection[];
  testPatterns: StrategyPatternSelection[];
  watchPatterns: StrategyPatternSelection[];
  deprioritizedPatterns: StrategyPatternSelection[];
  avoidedPatterns: StrategyPatternSelection[];
  insufficientPatterns: StrategyPatternSelection[];
  positioning: StrategyPositioning;
  experimentPlan: StrategyExperimentPlan;
  confidence: ConfidenceLevel;
  reasons: StrategyReason[];
  risks: StrategyRisk[];
  blockers: StrategyBlocker[];
  evidenceAudit: StrategyEvidenceAudit;
  provenance: StrategyProvenance;
};

export type ContentStrategyInput = {
  nicheId?: string | null;
  opportunityAssessment?: OpportunityAssessment | null;
  opportunity?: OpportunityAssessment | null;
  contentPatterns?: ContentPatternReport | null;
  patternReport?: ContentPatternReport | null;
  contentPatternTrend?: ContentPatternTrendReport | null;
  patternTrend?: ContentPatternTrendReport | null;
};

const confidenceRank: Record<ConfidenceLevel | PatternFitConfidence, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const rank = (value: string | null | undefined) => confidenceRank[value as keyof typeof confidenceRank] ?? 0;
const positiveTrends = new Set<PatternTrendState>(['ACCELERATING', 'GROWING', 'STABLE']);
const fitValues = new Set<PatternFitStatus>(['TOP_FIT', 'STRONG_FIT', 'MODERATE_FIT', 'WEAK_FIT', 'INSUFFICIENT']);

const reason = (code: string, message: string, evidenceRefs: string[] = []): StrategyReason => ({ code, message, evidenceRefs });
const risk = (code: string, message: string, evidenceRefs: string[] = []): StrategyRisk => ({ code, message, evidenceRefs });
const blocker = (code: string, message: string, evidenceRefs: string[] = []): StrategyBlocker => ({ code, message, evidenceRefs });
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];

function auditFor(input: { opportunity: OpportunityAssessment | null; patterns: ContentPatternReport | null; trend: ContentPatternTrendReport | null }): StrategyEvidenceAudit {
  return {
    nicheId: input.trend?.nicheFits.length ? 'AVAILABLE' : 'PARTIAL',
    entryDecision: input.opportunity ? 'AVAILABLE' : 'UNAVAILABLE',
    entryWindow: input.opportunity ? 'AVAILABLE' : 'UNAVAILABLE',
    opportunityConfidence: input.opportunity ? 'AVAILABLE' : 'UNAVAILABLE',
    lifecycle: input.opportunity?.dimensions.LIFECYCLE_POSITION ? 'AVAILABLE' : 'UNAVAILABLE',
    saturation: input.opportunity?.dimensions.SATURATION_RISK ? 'AVAILABLE' : 'UNAVAILABLE',
    patternId: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    patternStatus: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    patternTrend: input.trend ? (input.trend.comparableWindow.comparable ? 'AVAILABLE' : 'PARTIAL') : 'UNAVAILABLE',
    nichePatternFit: input.trend ? (input.trend.nicheFits.length ? 'AVAILABLE' : 'PARTIAL') : 'UNAVAILABLE',
    repeatability: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    creatorBreadth: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    breakoutEvidence: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    normalizedPatternPerformance: input.patterns ? 'AVAILABLE' : 'UNAVAILABLE',
    patternConcentration: input.trend ? 'DERIVABLE' : 'UNAVAILABLE',
    historicalProvenance: input.trend?.previousReport ? 'AVAILABLE' : 'PARTIAL',
    patternSelectionEvidence: input.trend ? 'AVAILABLE' : 'UNAVAILABLE',
    privateYouTubeMetrics: 'UNAVAILABLE',
    ctr: 'UNAVAILABLE',
    retention: 'UNAVAILABLE',
    trafficSource: 'UNAVAILABLE',
    rpm: 'UNAVAILABLE',
    revenue: 'UNAVAILABLE',
    productionCost: 'UNAVAILABLE',
  };
}

function trendFor(report: ContentPatternTrendReport | null, patternId: string): PatternTrendAssessment | null {
  return report?.assessments.find(item => item.pattern.patternId === patternId) || null;
}
function fitFor(report: ContentPatternTrendReport | null, patternId: string): NichePatternFit | null {
  return report?.nicheFits.find(item => item.pattern.patternId === patternId) || null;
}
function selectionFor(report: ContentPatternTrendReport | null, patternId: string): PatternSelectionEvidence | null {
  return report?.selectionEvidence.find(item => item.pattern.patternId === patternId) || null;
}

function concentrationFor(trend: PatternTrendAssessment | null) {
  const current = trend?.evidence.creatorConcentration.current;
  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}

function classifyRole(input: {
  aggregation: PatternAggregation;
  trend: PatternTrendAssessment | null;
  fit: NichePatternFit | null;
  opportunity: StrategyOpportunityContext;
}): { role: StrategyPatternRole; reasons: StrategyReason[]; risks: StrategyRisk[]; blockers: StrategyBlocker[] } {
  const { aggregation, trend, fit, opportunity } = input;
  const pattern = aggregation.pattern;
  const status = aggregation.winningPattern.status;
  const trendState = trend?.state || 'INSUFFICIENT';
  const fitStatus = fit?.status || null;
  const reasons: StrategyReason[] = [];
  const risks: StrategyRisk[] = [];
  const blockers: StrategyBlocker[] = [];
  const refs = [`pattern:${pattern.patternId}`, `pattern-status:${status}`, `trend:${trendState}`, `fit:${fitStatus || 'UNAVAILABLE'}`];
  const concentration = concentrationFor(trend);
  const strongEvidence = status === 'WINNING'
    && (fitStatus === 'TOP_FIT' || fitStatus === 'STRONG_FIT')
    && positiveTrends.has(trendState)
    && trendState !== 'DILUTING'
    && aggregation.confidence !== 'INSUFFICIENT'
    && rank(aggregation.confidence) >= rank(CONTENT_STRATEGY_CONFIG.minPrimaryConfidence)
    && aggregation.repeatability.status === CONTENT_STRATEGY_CONFIG.minPrimaryRepeatability
    && aggregation.creatorBreadth.distinctCreators >= CONTENT_STRATEGY_CONFIG.minPrimaryCreators
    && aggregation.breakoutEvidence.breakoutCreators >= CONTENT_STRATEGY_CONFIG.minPrimaryBreakoutCreators
    && aggregation.performance.normalizedPerformanceCount >= CONTENT_STRATEGY_CONFIG.minPrimaryPerformanceSamples
    && (aggregation.performance.medianNormalizedPerformance ?? 0) >= CONTENT_STRATEGY_CONFIG.minPrimaryMedianPerformance
    && (concentration === null || concentration < CONTENT_STRATEGY_CONFIG.maxConcentrationForPrimary)
    && opportunity.entryWindow !== 'CLOSED';
  const strongNegative = status !== 'INSUFFICIENT'
    && fitStatus === 'WEAK_FIT'
    && trendState === 'DECLINING'
    && (aggregation.performance.medianNormalizedPerformance !== null || aggregation.breakoutEvidence.breakoutRate !== null)
    && (aggregation.performance.medianNormalizedPerformance !== null && aggregation.performance.medianNormalizedPerformance < 1 || aggregation.breakoutEvidence.breakoutRate !== null && aggregation.breakoutEvidence.breakoutRate < 0.1)
    && rank(aggregation.confidence) >= 2;
  const insufficient = status === 'INSUFFICIENT' || !trend || trendState === 'INSUFFICIENT' || fitStatus === 'INSUFFICIENT' || !fit;

  if (strongNegative) {
    reasons.push(reason('AVOID_WEAK_FIT_DECLINING', '弱赛道适配与持续回落的表现证据共同指向结构性弱势。', refs));
    return { role: 'AVOID', reasons, risks, blockers };
  }
  if (insufficient) {
    blockers.push(blocker('INSUFFICIENT_PATTERN_HISTORY', '模式趋势或赛道适配证据不足，无法负责地选择策略角色。', refs));
    return { role: 'INSUFFICIENT', reasons, risks, blockers };
  }
  if (trendState === 'DILUTING') risks.push(risk('PATTERN_DILUTION', '采用量上升但表现或突破率走弱，避免把扩散误判为机会。', refs));
  if (trendState === 'DECLINING') risks.push(risk('PATTERN_DECLINE', '模式历史表现正在回落。', refs));
  if (concentration !== null && concentration >= CONTENT_STRATEGY_CONFIG.maxConcentrationForPrimary) risks.push(risk('HIGH_PATTERN_CONCENTRATION', '模式证据主要集中在少数创作者。', refs));
  if (aggregation.creatorBreadth.distinctCreators < CONTENT_STRATEGY_CONFIG.minPrimaryCreators) risks.push(risk('LIMITED_CREATOR_BREADTH', '独立创作者覆盖不足以证明可系统复用。', refs));
  if (aggregation.breakoutEvidence.breakoutCreators < CONTENT_STRATEGY_CONFIG.minPrimaryBreakoutCreators) risks.push(risk('LOW_BREAKOUT_COVERAGE', '跨创作者突破证据覆盖有限。', refs));
  if (aggregation.confidence === 'LOW' || (fit && fit.confidence === 'LOW')) risks.push(risk('LOW_PATTERN_CONFIDENCE', '模式或赛道适配置信度偏低。', refs));
  if (trend?.provenance.previousWindow === null) risks.push(risk('RETROSPECTIVE_ONLY_EVIDENCE', '没有可比较历史窗口，趋势只能保持保守解释。', refs));

  if (status === 'WINNING' && trendState === 'DECLINING') {
    reasons.push(reason('DEPRIORITIZE_DECLINING', '历史赢面仍在，但当前趋势回落，降低投入优先级。', refs));
    return { role: 'DEPRIORITIZE', reasons, risks, blockers };
  }
  if (status === 'WINNING' && trendState === 'DILUTING') {
    reasons.push(reason('WATCH_WINNING_DILUTING', '历史赢面与当前稀释信号冲突，保留观察而非直接主推。', refs));
    return { role: 'WATCH', reasons, risks, blockers };
  }
  if (fitStatus === 'WEAK_FIT' || (fitStatus === 'STRONG_FIT' && (aggregation.performance.medianNormalizedPerformance ?? 0) < 1)) {
    reasons.push(reason('DEPRIORITIZE_WEAK_RELATIVE_PERFORMANCE', '赛道适配或相对表现不足，暂不提高战略优先级。', refs));
    return { role: 'DEPRIORITIZE', reasons, risks, blockers };
  }
  if (strongEvidence) {
    reasons.push(reason(`PRIMARY_${status}_${fitStatus}_${trendState}`, '多创作者、重复性、突破、规范化表现、趋势与赛道适配形成一致证据。', refs));
    return { role: 'PRIMARY', reasons, risks, blockers };
  }
  const testable = (status === 'CANDIDATE' && (trendState === 'ACCELERATING' || trendState === 'GROWING') && (fitStatus === 'TOP_FIT' || fitStatus === 'STRONG_FIT'))
    || (status === 'WINNING' && fitStatus === 'MODERATE_FIT')
    || (fitStatus === 'TOP_FIT' && trendState === 'STABLE')
    || (fitStatus === 'STRONG_FIT' && (aggregation.confidence === 'MEDIUM' || fit?.confidence === 'MEDIUM'));
  if (testable) {
    reasons.push(reason(status === 'CANDIDATE' ? 'TEST_CANDIDATE_PROMISING_TREND' : 'TEST_POSITIVE_BUT_NOT_PRIMARY', '证据有吸引力，但尚未满足主推所需的多因素门槛，适合边界明确的测试。', refs));
    return { role: 'TEST', reasons, risks, blockers };
  }
  reasons.push(reason('WATCH_EVIDENCE_AMBIGUOUS', '模式有一定证据，但趋势、适配或可复用性尚不足以进入主动测试。', refs));
  return { role: 'WATCH', reasons, risks, blockers };
}

function priorityFor(role: StrategyPatternRole): StrategyPriority {
  return role === 'PRIMARY' ? 'HIGH' : role === 'TEST' ? 'MEDIUM' : role === 'WATCH' ? 'LOW' : 'LOW';
}

function selectionForAggregation(aggregation: PatternAggregation, trend: PatternTrendAssessment | null, fit: NichePatternFit | null, selection: PatternSelectionEvidence | null, opportunity: StrategyOpportunityContext): StrategyPatternSelection {
  const classified = classifyRole({ aggregation, trend, fit, opportunity });
  const evidenceRefs = uniq([...classified.reasons.flatMap(item => item.evidenceRefs), ...classified.risks.flatMap(item => item.evidenceRefs), ...classified.blockers.flatMap(item => item.evidenceRefs), `aggregation:${aggregation.pattern.patternId}`]);
  return {
    patternId: aggregation.pattern.patternId,
    pattern: aggregation.pattern,
    role: classified.role,
    priority: priorityFor(classified.role),
    patternStatus: aggregation.winningPattern.status,
    trendState: trend?.state || selection?.trendState || 'INSUFFICIENT',
    trendConfidence: trend?.confidence || 'INSUFFICIENT',
    fitStatus: fit?.status || selection?.fitStatus || null,
    fitConfidence: fit?.confidence || null,
    repeatability: aggregation.repeatability.status,
    creatorBreadth: aggregation.creatorBreadth.distinctCreators,
    breakoutEvidence: { videos: aggregation.breakoutEvidence.breakoutVideos, creators: aggregation.breakoutEvidence.breakoutCreators, rate: aggregation.breakoutEvidence.breakoutRate },
    normalizedPerformance: { median: aggregation.performance.medianNormalizedPerformance, p75: aggregation.performance.p75NormalizedPerformance, samples: aggregation.performance.normalizedPerformanceCount },
    reasons: classified.reasons,
    risks: classified.risks,
    blockers: classified.blockers,
    evidenceRefs,
  };
}

function gateSelections(selections: StrategyPatternSelection[], opportunity: StrategyOpportunityContext) {
  const sorted = [...selections].sort((a, b) => a.patternId.localeCompare(b.patternId));
  const primaryCandidates = sorted.filter(item => item.role === 'PRIMARY');
  const downgraded = new Set<string>();
  if (opportunity.decision === 'INSUFFICIENT' || opportunity.decision === 'AVOID' || opportunity.entryWindow === 'CLOSED') primaryCandidates.forEach(item => downgraded.add(item.patternId));
  if (opportunity.decision === 'CAUTION') primaryCandidates.slice(CONTENT_STRATEGY_CONFIG.maxPrimaryPatterns).forEach(item => downgraded.add(item.patternId));
  return sorted.map(item => {
    if (!downgraded.has(item.patternId)) return item;
    const gateCode = opportunity.decision === 'AVOID' ? 'ENTRY_DECISION_AVOID' : opportunity.decision === 'INSUFFICIENT' ? 'OPPORTUNITY_INSUFFICIENT' : opportunity.entryWindow === 'CLOSED' ? 'ENTRY_WINDOW_CLOSED' : 'OPPORTUNITY_CAUTION_LIMITS_STRATEGY';
    const gateMessage = opportunity.decision === 'AVOID' ? '上游机会判断为 AVOID，不能输出积极进入策略。' : opportunity.decision === 'INSUFFICIENT' ? '上游机会证据不足，不能形成主推分配。' : opportunity.entryWindow === 'CLOSED' ? '进入窗口已关闭，主推角色降为观察。' : '机会处于谨慎状态，主推数量受限并保留测试优先。';
    const gatedRole: StrategyPatternRole = opportunity.decision === 'AVOID' ? 'WATCH' : 'TEST';
    return { ...item, role: gatedRole, priority: 'MEDIUM' as const, reasons: [...item.reasons, reason(gateCode, gateMessage, ['opportunity.decision', 'opportunity.entryWindow'])], blockers: [...item.blockers, blocker(gateCode, gateMessage, ['opportunity.decision', 'opportunity.entryWindow'])], evidenceRefs: uniq([...item.evidenceRefs, 'opportunity.decision', 'opportunity.entryWindow']) };
  });
}

function strategyStatus(opportunity: StrategyOpportunityContext, selections: StrategyPatternSelection[]): StrategyStatus {
  if (opportunity.decision === 'AVOID') return 'BLOCKED';
  if (opportunity.decision === 'INSUFFICIENT') return 'RESEARCH_ONLY';
  if (!selections.length || selections.every(item => item.role === 'INSUFFICIENT')) return 'INSUFFICIENT';
  if (selections.some(item => item.role === 'PRIMARY') && (opportunity.decision === 'RECOMMENDED' || opportunity.decision === 'TEST')) return 'ACTIONABLE';
  return 'VALIDATION';
}

function strategyConfidence(opportunity: StrategyOpportunityContext, selections: StrategyPatternSelection[]): ConfidenceLevel {
  if (opportunity.decision === 'INSUFFICIENT' || opportunity.decision === 'AVOID' || !selections.length) return 'INSUFFICIENT';
  const primary = selections.find(item => item.role === 'PRIMARY');
  if (primary && rank(opportunity.confidence) >= 3 && rank(primary.trendConfidence) >= 2 && rank(primary.fitConfidence) >= 2) return 'HIGH';
  if (primary || selections.some(item => item.role === 'TEST')) return opportunity.decision === 'CAUTION' ? 'LOW' : 'MEDIUM';
  return 'LOW';
}

function buildPositioning(selections: StrategyPatternSelection[], status: StrategyStatus): StrategyPositioning {
  const primary = selections.filter(item => item.role === 'PRIMARY');
  const tests = selections.filter(item => item.role === 'TEST');
  if (status === 'BLOCKED') return { direction: 'NO_ENTRY_POSITIONING', summary: '上游机会判断阻止积极进入；仅保留证据供后续复核。', supportingPatternIds: [], guardrails: ['不生成具体选题或发布承诺。'] };
  if (status === 'RESEARCH_ONLY' || status === 'INSUFFICIENT') return { direction: 'RESEARCH_ONLY', summary: '先补齐可比较样本、趋势与赛道适配证据，再形成内容方向。', supportingPatternIds: [], guardrails: ['不把证据不足当作 AVOID。'] };
  if (primary.length) return { direction: 'EVIDENCE_BACKED_FORMAT', summary: '以跨创作者重复验证且与目标赛道匹配的结构作为主方向，同时保留有限测试。', supportingPatternIds: primary.map(item => item.patternId), guardrails: tests.length ? ['测试模式保持独立样本与明确成功/失败门槛。'] : ['避免复制单一创作者的偶然成功。'] };
  return { direction: 'EMERGING_FORMAT_TEST', summary: '优先验证趋势向上或适配较强的候选结构，不做规模化承诺。', supportingPatternIds: tests.map(item => item.patternId), guardrails: ['测试结果需回到规范化表现、突破率与创作者广度。'] };
}

function buildExperimentPlan(selections: StrategyPatternSelection[], opportunity: StrategyOpportunityContext, status: StrategyStatus): StrategyExperimentPlan {
  const primary = selections.filter(item => item.role === 'PRIMARY');
  const tests = selections.filter(item => item.role === 'TEST');
  const planStatus = status === 'BLOCKED' ? 'BLOCKED' : status === 'RESEARCH_ONLY' || status === 'INSUFFICIENT' ? 'RESEARCH_ONLY' : primary.length ? 'READY_FOR_VALIDATION' : 'BOUNDED_TEST';
  const success = ['在至少一个完整的 Long-form 合格样本周期内，规范化创作者表现不低于基线门槛。', '突破证据在至少两个独立创作者之间重复出现。'];
  const failure = ['达到合格样本量后仍持续低于创作者基线。', '新增样本没有形成可重复的跨创作者突破证据。'];
  if (opportunity.decision === 'CAUTION') failure.push('在谨慎机会状态下不得扩大投入，除非新增证据清除阻塞项。');
  return { status: planStatus, primaryPatternIds: primary.map(item => item.patternId), testPatternIds: tests.map(item => item.patternId), priorities: [...primary, ...tests].map(item => ({ patternId: item.patternId, priority: item.priority })), minimumEligibleSample: CONTENT_STRATEGY_CONFIG.minExperimentSample, sampleSemantics: 'ELIGIBLE_LONG_FORM_VIDEOS', evaluationMetrics: ['NORMALIZED_CREATOR_PERFORMANCE', 'BREAKOUT_RATE', 'REPEATABILITY', 'CREATOR_BREADTH'], successCriteria: success, failureCriteria: failure, calibrationStatus: CONTENT_STRATEGY_CONFIG.calibrationStatus };
}

export function buildContentStrategy(input: ContentStrategyInput): ContentStrategy {
  const opportunity = input.opportunityAssessment || input.opportunity || null;
  const patterns = input.contentPatterns || input.patternReport || null;
  const trend = input.contentPatternTrend || input.patternTrend || null;
  const nicheId = input.nicheId || trend?.nicheFits[0]?.nicheId || 'unknown-niche';
  const opportunityContext: StrategyOpportunityContext = { decision: opportunity?.decision.status || 'UNKNOWN', confidence: opportunity?.confidence || 'INSUFFICIENT', entryWindow: opportunity?.entryWindow || 'UNKNOWN', lifecycle: opportunity?.dimensions.LIFECYCLE_POSITION?.state || null, evidenceRefs: opportunity ? ['opportunity.decision', 'opportunity.entryWindow', 'opportunity.dimensions'] : [] };
  const rawSelections = patterns?.aggregations.map(aggregation => selectionForAggregation(aggregation, trendFor(trend, aggregation.pattern.patternId), fitFor(trend, aggregation.pattern.patternId), selectionFor(trend, aggregation.pattern.patternId), opportunityContext)) || [];
  const gated = gateSelections(rawSelections, opportunityContext);
  const byIdentity = new Map<string, StrategyPatternSelection>();
  for (const item of gated) {
    const identity = `${item.pattern.taxonomy}|${item.pattern.featureKey}|${item.pattern.featureValue}`.toLowerCase();
    if (!byIdentity.has(identity)) byIdentity.set(identity, item);
  }
  const selections = [...byIdentity.values()];
  const status = strategyStatus(opportunityContext, selections);
  const confidence = strategyConfidence(opportunityContext, selections);
  const primaryPatterns = selections.filter(item => item.role === 'PRIMARY');
  const testPatterns = selections.filter(item => item.role === 'TEST');
  const watchPatterns = selections.filter(item => item.role === 'WATCH');
  const deprioritizedPatterns = selections.filter(item => item.role === 'DEPRIORITIZE');
  const avoidedPatterns = selections.filter(item => item.role === 'AVOID');
  const insufficientPatterns = selections.filter(item => item.role === 'INSUFFICIENT');
  const reasons: StrategyReason[] = [];
  if (primaryPatterns.length) reasons.push(reason('PRIMARY_PORTFOLIO_ESTABLISHED', '至少一个模式满足主推的多因素证据门槛。', primaryPatterns.map(item => item.patternId)));
  if (testPatterns.length) reasons.push(reason('BOUNDED_TEST_PORTFOLIO', '保留证据积极但尚未主推的模式，进入受控测试。', testPatterns.map(item => item.patternId)));
  if (!primaryPatterns.length && !testPatterns.length) reasons.push(reason('NO_ACTIVE_PATTERN_ALLOCATION', '当前没有足够可靠的主动分配模式。', []));
  const risks: StrategyRisk[] = [...selections.flatMap(item => item.risks)];
  if (opportunity?.provenance.lifecycle === 'RETROSPECTIVE') risks.push(risk('RETROSPECTIVE_ONLY_EVIDENCE', '生命周期来自回顾性证据，不能当作实时趋势承诺。', ['opportunity.provenance.lifecycle']));
  if (opportunity?.dimensions.SATURATION_RISK?.state === 'HIGH') risks.push(risk('NICHE_SATURATION_PRESSURE', '上游机会维度显示赛道饱和压力偏高。', ['opportunity.dimensions.SATURATION_RISK']));
  const blockers: StrategyBlocker[] = [...selections.flatMap(item => item.blockers)];
  if (!patterns) blockers.push(blocker('NO_ELIGIBLE_PATTERNS', '没有可消费的 Long-form 模式报告。', ['contentPatterns']));
  if (opportunityContext.decision === 'INSUFFICIENT') blockers.push(blocker('OPPORTUNITY_INSUFFICIENT', '上游机会判断为 INSUFFICIENT。', ['opportunity.decision']));
  if (opportunityContext.decision === 'AVOID') blockers.push(blocker('ENTRY_DECISION_AVOID', '上游机会判断为 AVOID，策略层不能覆盖该结论。', ['opportunity.decision']));
  if (trend && !trend.comparableWindow.comparable) blockers.push(blocker('INSUFFICIENT_PATTERN_HISTORY', '没有可比较的 Pattern 历史窗口。', ['contentPatternTrend.comparableWindow']));
  const positioning = buildPositioning(selections, status);
  const experimentPlan = buildExperimentPlan(selections, opportunityContext, status);
  const algorithmVersions = uniq([CONTENT_STRATEGY_ALGORITHM_VERSION, opportunity?.algorithmVersion, patterns?.algorithmVersion, trend?.algorithmVersion].filter((value): value is string => Boolean(value)));
  const patternIds = selections.map(item => item.patternId);
  return {
    schemaVersion: 'content-strategy.v1', strategyVersion: CONTENT_STRATEGY_ALGORITHM_VERSION, scope: 'LONG_FORM', nicheId, strategyStatus: status, opportunityContext,
    primaryPatterns, testPatterns, watchPatterns, deprioritizedPatterns, avoidedPatterns, insufficientPatterns, positioning, experimentPlan, confidence, reasons, risks, blockers,
    evidenceAudit: auditFor({ opportunity, patterns, trend }),
    provenance: { source: opportunity ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', algorithmVersions, nicheId, opportunityDecision: opportunityContext.decision, opportunityEvidenceRefs: opportunityContext.evidenceRefs, patternIds, currentWindow: trend?.comparableWindow.current.key || null, comparisonWindow: trend?.comparableWindow.previous?.key || null, historicalSemantics: trend?.timeSemantics || null, calibrationStatus: CONTENT_STRATEGY_CONFIG.calibrationStatus },
  };
}

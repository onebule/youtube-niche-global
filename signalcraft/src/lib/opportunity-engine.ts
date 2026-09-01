import type { DataQuality, EvidenceContract } from './evidence-contract.ts';
import { derivePerformanceAssessment, type ConfidenceLevel, type EntryDecision, type EntryDecisionStatus, type DecisionReason } from './entry-decision.ts';
import type { NicheBreakoutSummary, SignalStrength } from './niche-signals.ts';
import type { NicheLifecycleSummary, NicheLifecycleState } from './niche-lifecycle.ts';

/**
 * P1 Phase 4 canonical Long-form decision layer.
 *
 * This module composes upstream evidence; it does not recalculate breakout,
 * saturation, lifecycle or data-quality semantics, and it is never used by
 * Shorts. Numeric upstream scores remain context only.
 */
export const OPPORTUNITY_ENGINE_ALGORITHM_VERSION = 'opportunity-engine-v1';
export const ENTRY_WINDOW_ALGORITHM_VERSION = 'entry-window-v1';

export const OPPORTUNITY_ENGINE_CONFIG = Object.freeze({
  version: OPPORTUNITY_ENGINE_ALGORITHM_VERSION,
  entryWindowVersion: ENTRY_WINDOW_ALGORITHM_VERSION,
  minSampleVideos: 5,
  minCreators: 3,
  hardMinCreators: 2,
  minRepresentativeVideos: 1,
  recommendedMinVideos: 20,
  recommendedMinCreators: 5,
  strongDemandScore: 60,
  moderateDemandScore: 40,
  strongAccessibilityCreators: 5,
  moderateAccessibilityCreators: 3,
  highConcentrationShare: 0.7,
  // Every new Phase 4 threshold is provisional until calibrated on production data.
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type OpportunityDimensionName =
  | 'DEMAND_STRENGTH'
  | 'DEMAND_MOMENTUM'
  | 'CREATOR_ACCESSIBILITY'
  | 'BREAKOUT_BREADTH'
  | 'COMPETITION_PRESSURE'
  | 'SATURATION_RISK'
  | 'CREATOR_CONCENTRATION'
  | 'LIFECYCLE_POSITION'
  | 'EXECUTION_FIT'
  | 'EVIDENCE_STRENGTH';

export type OpportunityDimensionState =
  | 'VERY_WEAK' | 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG'
  | 'RISING' | 'STABLE' | 'FALLING'
  | 'ONE_CREATOR' | 'MULTIPLE_CREATORS' | 'REPEATED_ACROSS_CREATORS'
  | 'LOW' | 'MEDIUM' | 'HIGH' | 'INSUFFICIENT'
  | NicheLifecycleState
  | 'UPSTREAM_OPAQUE';

export type OpportunityDimension = {
  name: OpportunityDimensionName;
  state: OpportunityDimensionState;
  value: number | null;
  confidence: ConfidenceLevel;
  evidenceRefs: string[];
  provenance: string[];
  calibrationStatus: 'CALIBRATION_REQUIRED' | 'CALIBRATED' | 'NOT_APPLICABLE';
};

export type EntryWindow = 'OPEN' | 'NARROWING' | 'CLOSED' | 'UNDETERMINED';
export type OpportunityReasonType = 'SUPPORTING' | 'RISK' | 'BLOCKING' | 'CONTEXT';
export type OpportunityReason = {
  code: string;
  type: OpportunityReasonType;
  message: string;
  evidenceRef: string[];
};

export type OpportunityAssessment = {
  dimensions: Record<OpportunityDimensionName, OpportunityDimension>;
  entryWindow: EntryWindow;
  decision: EntryDecision;
  confidence: ConfidenceLevel;
  reasons: OpportunityReason[];
  blockers: OpportunityReason[];
  provenance: {
    sources: string[];
    evidenceId: string | null;
    lifecycle: 'TRUE_SNAPSHOT_HISTORY' | 'RETROSPECTIVE' | 'INSUFFICIENT' | 'NOT_PROVIDED';
    algorithmVersions: string[];
  };
  algorithmVersion: string;
};

export type OpportunityEngineInput = {
  key: string;
  topic: string;
  sampleSize: number;
  channelCount: number;
  representativeVideoCount: number;
  metrics: Record<string, number | null | undefined>;
  marketOpportunity?: number | null;
  executionFit?: number | null;
  entryScore?: number | null;
  recommendation?: string | null;
  baselineStatus?: 'VERIFIED' | 'INSUFFICIENT' | 'UNAVAILABLE' | null;
  dataQuality: DataQuality | null;
  evidence?: EvidenceContract | null;
  nicheSignals?: NicheBreakoutSummary | null;
  nicheLifecycle?: NicheLifecycleSummary | null;
};

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const maxStrength = (values: SignalStrength[]) => values.includes('STRONG') ? 'STRONG' : values.includes('MODERATE') ? 'MODERATE' : values.includes('WEAK') ? 'WEAK' : 'INSUFFICIENT';
const confidenceRank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const minConfidence = (...values: ConfidenceLevel[]): ConfidenceLevel => values.reduce((current, value) => confidenceRank[value] < confidenceRank[current] ? value : current, 'HIGH');
const lifecycleState = (summary: NicheLifecycleSummary | null | undefined): NicheLifecycleState => summary?.lifecycle.state || 'INSUFFICIENT';
const lifecycleProvenance = (summary: NicheLifecycleSummary | null | undefined): OpportunityAssessment['provenance']['lifecycle'] => {
  if (!summary) return 'NOT_PROVIDED';
  if (summary.lifecycle.provenance === 'TRUE_SNAPSHOT_HISTORY') return 'TRUE_SNAPSHOT_HISTORY';
  if (summary.lifecycle.provenance === 'RETROSPECTIVE') return 'RETROSPECTIVE';
  return 'INSUFFICIENT';
};

function dimension(name: OpportunityDimensionName, state: OpportunityDimensionState, value: number | null, confidence: ConfidenceLevel, evidenceRefs: string[], provenance: string[] = [], calibrationStatus: OpportunityDimension['calibrationStatus'] = 'CALIBRATION_REQUIRED'): OpportunityDimension {
  return { name, state, value, confidence, evidenceRefs, provenance, calibrationStatus };
}

function reason(code: string, type: OpportunityReasonType, message: string, evidenceRef: string[] = []): OpportunityReason {
  return { code, type, message, evidenceRef };
}

function toDecisionReason(item: OpportunityReason): DecisionReason {
  const severity = item.type === 'SUPPORTING' ? 'SUPPORTING' : item.type === 'BLOCKING' || item.type === 'RISK' ? 'BLOCKING' : 'CONTEXT';
  return { code: item.code, severity, message: item.message };
}

function demandDimension(input: OpportunityEngineInput, performance: ReturnType<typeof derivePerformanceAssessment>): OpportunityDimension {
  const value = performance.score;
  const state = value === null ? 'INSUFFICIENT' : value >= OPPORTUNITY_ENGINE_CONFIG.strongDemandScore ? 'STRONG' : value >= OPPORTUNITY_ENGINE_CONFIG.moderateDemandScore ? 'MODERATE' : 'WEAK';
  return dimension('DEMAND_STRENGTH', state, value, input.dataQuality?.level === 'INSUFFICIENT' ? 'INSUFFICIENT' : input.dataQuality?.level || 'LOW', value === null ? [] : ['performance.score'], ['P0 PerformanceAssessment']);
}

function momentumDimension(summary: NicheLifecycleSummary | null | undefined): OpportunityDimension {
  const trend = summary?.observedDemand.trend.direction;
  const relationship = summary?.supplyDemandRelationship;
  const state: OpportunityDimensionState = trend === 'RISING' ? 'RISING' : trend === 'FALLING' ? 'FALLING' : trend === 'STABLE' ? 'STABLE' : relationship === 'DEMAND_OUTPACING_SUPPLY' ? 'RISING' : relationship === 'BOTH_DECLINING' ? 'FALLING' : 'INSUFFICIENT';
  return dimension('DEMAND_MOMENTUM', state, summary?.observedDemand.trend.relativeChange ?? null, summary?.confidence || 'INSUFFICIENT', summary ? ['nicheLifecycle.observedDemand.trend', 'nicheLifecycle.supplyDemandRelationship'] : [], summary ? ['P1 Phase 3 niche lifecycle'] : []);
}

function accessibilityDimension(summary: NicheBreakoutSummary | null | undefined): OpportunityDimension {
  if (!summary) return dimension('CREATOR_ACCESSIBILITY', 'INSUFFICIENT', null, 'INSUFFICIENT', [], []);
  const strengths = summary.signals.filter(signal => signal.type === 'SMALL_CREATOR_BREAKOUT' || signal.type === 'CROSS_CREATOR_BREAKOUT').map(signal => signal.strength);
  const state = maxStrength(strengths) as OpportunityDimensionState;
  const confidence = summary.signals.filter(signal => signal.type === 'SMALL_CREATOR_BREAKOUT' || signal.type === 'CROSS_CREATOR_BREAKOUT').reduce((current, signal) => minConfidence(current, signal.confidence), summary.confidence);
  const refs = ['nicheSignals.signals.SMALL_CREATOR_BREAKOUT', 'nicheSignals.signals.CROSS_CREATOR_BREAKOUT'];
  return dimension('CREATOR_ACCESSIBILITY', state, summary.smallCreatorBreakoutRate === null ? null : summary.smallCreatorBreakoutRate * 100, confidence, refs, ['P1 Phase 2 niche signals']);
}

function breakoutDimension(summary: NicheBreakoutSummary | null | undefined): OpportunityDimension {
  if (!summary) return dimension('BREAKOUT_BREADTH', 'INSUFFICIENT', null, 'INSUFFICIENT', [], []);
  const state: OpportunityDimensionState = summary.crossCreatorRepeatStatus === 'REPEATED_CROSS_CREATOR' ? 'REPEATED_ACROSS_CREATORS' : summary.breakoutCreators >= 2 ? 'MULTIPLE_CREATORS' : summary.breakoutCreators === 1 ? 'ONE_CREATOR' : 'INSUFFICIENT';
  return dimension('BREAKOUT_BREADTH', state, summary.breakoutCreators, summary.confidence, ['nicheSignals.breakoutCreators', 'nicheSignals.crossCreatorRepeatStatus'], ['P1 Phase 2 creator breakout aggregation']);
}

function concentrationDimension(input: OpportunityEngineInput): OpportunityDimension {
  const concentration = input.nicheSignals?.concentration || input.nicheLifecycle?.supply.current.breakout.concentration;
  if (!concentration) return dimension('CREATOR_CONCENTRATION', 'INSUFFICIENT', null, 'INSUFFICIENT', [], []);
  const state: OpportunityDimensionState = concentration.level === 'HIGH' ? 'HIGH' : concentration.level === 'LOW' ? 'LOW' : concentration.level === 'MIXED' ? 'MODERATE' : 'INSUFFICIENT';
  return dimension('CREATOR_CONCENTRATION', state, concentration.top3Share === null ? null : concentration.top3Share * 100, input.nicheSignals?.confidence || input.nicheLifecycle?.confidence || 'INSUFFICIENT', ['concentration.top3Share', 'concentration.level'], ['P1 Phase 2/3 creator concentration']);
}

function competitionDimension(summary: NicheLifecycleSummary | null | undefined, concentration: OpportunityDimension): OpportunityDimension {
  if (!summary) return dimension('COMPETITION_PRESSURE', concentration.state === 'HIGH' ? 'HIGH' : 'INSUFFICIENT', concentration.value, concentration.confidence, concentration.state === 'HIGH' ? ['concentration.level'] : [], concentration.provenance);
  const relationship = summary.supplyDemandRelationship;
  const state: OpportunityDimensionState = relationship === 'SUPPLY_OUTPACING_DEMAND' || concentration.state === 'HIGH' ? 'HIGH' : relationship === 'BALANCED_GROWTH' || summary.supply.videoSupplyTrend.direction === 'RISING' ? 'MODERATE' : relationship === 'DEMAND_OUTPACING_SUPPLY' ? 'LOW' : 'INSUFFICIENT';
  return dimension('COMPETITION_PRESSURE', state, summary.supply.videoSupplyTrend.relativeChange, summary.confidence, ['nicheLifecycle.supplyDemandRelationship', 'nicheLifecycle.supply.videoSupplyTrend', 'nicheLifecycle.supply.current.breakout.concentration'], ['P1 Phase 3 niche lifecycle']);
}

function saturationDimension(summary: NicheLifecycleSummary | null | undefined): OpportunityDimension {
  if (!summary) return dimension('SATURATION_RISK', 'INSUFFICIENT', null, 'INSUFFICIENT', [], []);
  const rising = summary.signals.find(signal => signal.type === 'SATURATION_RISING');
  const state: OpportunityDimensionState = summary.lifecycle.state === 'SATURATED' || rising?.strength === 'STRONG' ? 'HIGH' : rising ? 'MODERATE' : summary.lifecycle.state === 'DECLINING' ? 'MODERATE' : 'LOW';
  return dimension('SATURATION_RISK', state, rising?.evidence.relativeChange ?? null, rising?.confidence || summary.confidence, rising ? ['nicheLifecycle.signals.SATURATION_RISING'] : ['nicheLifecycle.lifecycle.state'], ['P1 Phase 3 multi-dimensional saturation']);
}

function lifecycleDimension(summary: NicheLifecycleSummary | null | undefined): OpportunityDimension {
  const state = lifecycleState(summary);
  return dimension('LIFECYCLE_POSITION', state, null, summary?.confidence || 'INSUFFICIENT', summary ? ['nicheLifecycle.lifecycle.state'] : [], summary ? [`P1 Phase 3 ${lifecycleProvenance(summary)}`] : []);
}

function evidenceDimension(input: OpportunityEngineInput, lifecycle: OpportunityDimension, accessibility: OpportunityDimension): OpportunityDimension {
  const quality = input.dataQuality?.level || 'INSUFFICIENT';
  const confidence = minConfidence(quality === 'HIGH' ? 'HIGH' : quality === 'MEDIUM' ? 'MEDIUM' : quality === 'LOW' ? 'LOW' : 'INSUFFICIENT', lifecycle.confidence, accessibility.confidence);
  return dimension('EVIDENCE_STRENGTH', confidence, input.dataQuality?.completeness ?? null, confidence, ['dataQuality.level', 'dataQuality.completeness', 'evidence.schemaVersion'], ['P0 DataQuality + EvidenceContract']);
}

function evaluateWindow(input: OpportunityEngineInput, lifecycle: OpportunityDimension, demand: OpportunityDimension, momentum: OpportunityDimension, accessibility: OpportunityDimension, competition: OpportunityDimension, saturation: OpportunityDimension, concentration: OpportunityDimension): { window: EntryWindow; reasons: OpportunityReason[] } {
  const reasons: OpportunityReason[] = [];
  if (!input.nicheLifecycle || lifecycle.state === 'INSUFFICIENT' || momentum.state === 'INSUFFICIENT') {
    reasons.push(reason('ENTRY_WINDOW_HISTORY_INSUFFICIENT', 'CONTEXT', '缺少可比较的生命周期/趋势证据，不能可靠标记结构性进入窗口。', ['nicheLifecycle.lifecycle', 'nicheLifecycle.trends']));
    return { window: 'UNDETERMINED', reasons };
  }
  const retrospective = lifecycle.provenance.includes('P1 Phase 3 RETROSPECTIVE');
  if (retrospective) reasons.push(reason('RETROSPECTIVE_WINDOW', 'CONTEXT', '当前窗口基于回顾性公开队列，不等同于实时市场预测。', ['nicheLifecycle.lifecycle.provenance']));
  const negative = saturation.state === 'HIGH' || lifecycle.state === 'SATURATED' || (competition.state === 'HIGH' && momentum.state === 'FALLING');
  const narrowing = negative || saturation.state === 'MODERATE' || competition.state === 'HIGH' || concentration.state === 'HIGH' || momentum.state === 'FALLING';
  const open = (lifecycle.state === 'EMERGING' || lifecycle.state === 'GROWING' || lifecycle.state === 'MATURE') && (demand.state === 'STRONG' || demand.state === 'MODERATE') && (accessibility.state === 'STRONG' || accessibility.state === 'MODERATE') && !negative && competition.state !== 'HIGH';
  if (negative && accessibility.state === 'WEAK' || (lifecycle.state === 'SATURATED' && concentration.state === 'HIGH')) return { window: 'CLOSED', reasons: [...reasons, reason('ENTRY_WINDOW_CLOSED', 'RISK', '供需、饱和与创作者可达性共同不支持有利的新进入窗口。', ['nicheLifecycle.lifecycle.state', 'nicheLifecycle.signals', 'nicheSignals.concentration'])] };
  if (open) return { window: 'OPEN', reasons: [...reasons, reason('ENTRY_WINDOW_OPEN', 'SUPPORTING', '当前证据支持继续调查或做受控进入测试；OPEN 不保证成功。', ['nicheLifecycle.lifecycle.state', 'nicheLifecycle.supplyDemandRelationship', 'nicheSignals.signals'])] };
  if (narrowing) return { window: 'NARROWING', reasons: [...reasons, reason('ENTRY_WINDOW_NARROWING', 'RISK', '需求仍可能存在，但供给、集中度或饱和压力正在收紧进入条件。', ['nicheLifecycle.trends', 'nicheLifecycle.signals'])] };
  return { window: retrospective ? 'OPEN' : 'UNDETERMINED', reasons };
}

function decide(input: OpportunityEngineInput, dimensions: OpportunityAssessment['dimensions'], window: EntryWindow, windowReasons: OpportunityReason[]): { status: EntryDecisionStatus; confidence: ConfidenceLevel; reasons: OpportunityReason[]; blockers: OpportunityReason[] } {
  const reasons: OpportunityReason[] = [...windowReasons];
  const blockers: OpportunityReason[] = [];
  if (finite(input.marketOpportunity) !== null || finite(input.executionFit) !== null || finite(input.entryScore) !== null || input.recommendation) {
    reasons.push(reason('UPSTREAM_OPAQUE_CONTEXT', 'CONTEXT', '上游市场/执行/进入分与建议仅作为不可审计上下文，不能绕过本地证据门槛。', ['marketOpportunity', 'executionFit', 'entryScore', 'recommendation']));
  }
  const evidence = dimensions.EVIDENCE_STRENGTH;
  const identityMissing = !input.key.trim() || !input.topic.trim() || input.topic === '未分类方向' || input.key.startsWith('longform-direction-');
  if (identityMissing) blockers.push(reason('NICHE_IDENTITY_MISSING', 'BLOCKING', '缺少可追溯的明确赛道身份。', ['key', 'topic']));
  if (input.sampleSize < OPPORTUNITY_ENGINE_CONFIG.minSampleVideos) blockers.push(reason('LOW_SAMPLE_SIZE', 'BLOCKING', `当前只有 ${input.sampleSize} 条可用视频，低于 Long-form 决策门槛。`, ['sampleSize']));
  if (input.channelCount < OPPORTUNITY_ENGINE_CONFIG.hardMinCreators) blockers.push(reason('LOW_CREATOR_COVERAGE', 'BLOCKING', `当前只有 ${input.channelCount} 个独立创作者，无法形成跨创作者判断。`, ['channelCount']));
  if (input.representativeVideoCount < OPPORTUNITY_ENGINE_CONFIG.minRepresentativeVideos) blockers.push(reason('NO_REPRESENTATIVE_EVIDENCE', 'BLOCKING', '没有代表视频可供人工复核。', ['representativeVideoCount']));
  if (evidence.state === 'INSUFFICIENT') blockers.push(reason('EVIDENCE_GATE_FAILED', 'BLOCKING', '数据质量或证据合同不足，不能输出强机会结论。', ['dataQuality', 'evidence']));
  if (input.baselineStatus && input.baselineStatus !== 'VERIFIED') blockers.push(reason('BASELINE_UNVERIFIED', 'BLOCKING', '创作者基线未验证；突破与可达性不能被当作确定事实。', ['baselineStatus']));
  if (dimensions.SATURATION_RISK.state === 'HIGH') blockers.push(reason('STRONG_SATURATION', 'BLOCKING', 'Phase 3 已提供强饱和风险，正向信号不能绕过该阻塞。', ['SATURATION_RISK']));
  if (dimensions.LIFECYCLE_POSITION.state === 'DECLINING') blockers.push(reason('LIFECYCLE_DECLINING', 'RISK', '可观察表现/供需关系正在回落。', ['LIFECYCLE_POSITION', 'DEMAND_MOMENTUM']));
  const confidence = minConfidence(evidence.confidence, dimensions.DEMAND_STRENGTH.confidence, dimensions.CREATOR_ACCESSIBILITY.confidence, dimensions.LIFECYCLE_POSITION.confidence);
  const hardGate = identityMissing || input.sampleSize < OPPORTUNITY_ENGINE_CONFIG.minSampleVideos || input.channelCount < OPPORTUNITY_ENGINE_CONFIG.hardMinCreators || input.representativeVideoCount < OPPORTUNITY_ENGINE_CONFIG.minRepresentativeVideos || evidence.state === 'INSUFFICIENT';
  const strongNegative = dimensions.SATURATION_RISK.state === 'HIGH' && (dimensions.CREATOR_ACCESSIBILITY.state === 'WEAK' || dimensions.CREATOR_ACCESSIBILITY.state === 'INSUFFICIENT') && confidenceRank[confidence] >= confidenceRank.MEDIUM;
  const decliningNegative = dimensions.LIFECYCLE_POSITION.state === 'DECLINING' && dimensions.DEMAND_MOMENTUM.state === 'FALLING' && dimensions.CREATOR_ACCESSIBILITY.state === 'WEAK' && confidence === 'HIGH';
  const positive = ['STRONG', 'MODERATE'].includes(dimensions.DEMAND_STRENGTH.state) && ['STRONG', 'MODERATE'].includes(dimensions.CREATOR_ACCESSIBILITY.state) && ['MULTIPLE_CREATORS', 'REPEATED_ACROSS_CREATORS'].includes(dimensions.BREAKOUT_BREADTH.state);
  const recommended = confidence === 'HIGH' && input.dataQuality?.level === 'HIGH' && input.sampleSize >= OPPORTUNITY_ENGINE_CONFIG.recommendedMinVideos && input.channelCount >= OPPORTUNITY_ENGINE_CONFIG.recommendedMinCreators && input.baselineStatus === 'VERIFIED' && positive && window === 'OPEN' && dimensions.SATURATION_RISK.state !== 'HIGH' && dimensions.CREATOR_CONCENTRATION.state !== 'HIGH';
  let status: EntryDecisionStatus;
  if (hardGate) status = 'INSUFFICIENT';
  else if (strongNegative || decliningNegative || (window === 'CLOSED' && confidence === 'HIGH')) status = 'AVOID';
  else if (confidence === 'LOW' || confidence === 'INSUFFICIENT') status = 'CAUTION';
  else if (recommended) status = 'RECOMMENDED';
  else if (positive || window === 'OPEN' || window === 'NARROWING') status = 'TEST';
  else status = 'CAUTION';
  if (positive) reasons.push(reason('MULTI_DIMENSIONAL_SUPPORT', 'SUPPORTING', '需求、创作者可达性与跨创作者突破证据形成支持，但不构成保证。', ['DEMAND_STRENGTH', 'CREATOR_ACCESSIBILITY', 'BREAKOUT_BREADTH']));
  if (dimensions.CREATOR_CONCENTRATION.state === 'HIGH') reasons.push(reason('CREATOR_CONCENTRATION_HIGH', 'RISK', '成功表现集中在少数创作者，降低新进入可复制性。', ['CREATOR_CONCENTRATION']));
  if (dimensions.COMPETITION_PRESSURE.state === 'HIGH') reasons.push(reason('COMPETITION_PRESSURE_HIGH', 'RISK', '供给增长或集中度已对进入形成压力。', ['COMPETITION_PRESSURE']));
  if (status === 'RECOMMENDED') reasons.push(reason('RECOMMENDED_GATE_PASSED', 'SUPPORTING', '多维正向证据、覆盖、基线与 OPEN 窗口同时满足严格门槛。', ['EVIDENCE_STRENGTH', 'ENTRY_WINDOW', 'DEMAND_STRENGTH', 'CREATOR_ACCESSIBILITY']));
  if (status === 'TEST') reasons.push(reason('BOUNDED_TEST', 'SUPPORTING', '证据支持受控小批测试，但尚不足以直接扩大投入。', ['decision']));
  if (status === 'CAUTION') reasons.push(reason('MATERIAL_UNCERTAINTY', 'RISK', '不确定性仍然显著，应补充证据后再扩大投入。', ['EVIDENCE_STRENGTH']));
  if (status === 'INSUFFICIENT') reasons.push(reason('WE_DO_NOT_KNOW', 'BLOCKING', '当前证据不足以负责地判断机会。', ['blockers']));
  return { status, confidence, reasons, blockers };
}

export function buildOpportunityAssessment(input: OpportunityEngineInput): OpportunityAssessment {
  const performance = derivePerformanceAssessment(input.metrics);
  const demand = demandDimension(input, performance);
  const momentum = momentumDimension(input.nicheLifecycle);
  const accessibility = accessibilityDimension(input.nicheSignals);
  const breakout = breakoutDimension(input.nicheSignals);
  const concentration = concentrationDimension(input);
  const competition = competitionDimension(input.nicheLifecycle, concentration);
  const saturation = saturationDimension(input.nicheLifecycle);
  const lifecycle = lifecycleDimension(input.nicheLifecycle);
  const execution = dimension('EXECUTION_FIT', input.executionFit === null || input.executionFit === undefined ? 'INSUFFICIENT' : 'UPSTREAM_OPAQUE', finite(input.executionFit), input.executionFit === null || input.executionFit === undefined ? 'INSUFFICIENT' : 'LOW', input.executionFit === null || input.executionFit === undefined ? [] : ['executionFit'], input.executionFit === null || input.executionFit === undefined ? [] : ['UPSTREAM_OPAQUE'], input.executionFit === null || input.executionFit === undefined ? 'NOT_APPLICABLE' : 'CALIBRATION_REQUIRED');
  const evidence = evidenceDimension(input, lifecycle, accessibility);
  const dimensions = { DEMAND_STRENGTH: demand, DEMAND_MOMENTUM: momentum, CREATOR_ACCESSIBILITY: accessibility, BREAKOUT_BREADTH: breakout, COMPETITION_PRESSURE: competition, SATURATION_RISK: saturation, CREATOR_CONCENTRATION: concentration, LIFECYCLE_POSITION: lifecycle, EXECUTION_FIT: execution, EVIDENCE_STRENGTH: evidence } satisfies Record<OpportunityDimensionName, OpportunityDimension>;
  const windowResult = evaluateWindow(input, lifecycle, demand, momentum, accessibility, competition, saturation, concentration);
  const decision = decide(input, dimensions, windowResult.window, windowResult.reasons);
  const decisionReasons = decision.reasons.map(toDecisionReason);
  const decisionBlockers = decision.blockers.map(toDecisionReason);
  return {
    dimensions,
    entryWindow: windowResult.window,
    confidence: decision.confidence,
    decision: { status: decision.status, confidence: decision.confidence, reasons: decisionReasons, blockers: decisionBlockers, evidenceId: input.evidence?.snapshotId || null, algorithmVersion: OPPORTUNITY_ENGINE_ALGORITHM_VERSION },
    reasons: decision.reasons,
    blockers: decision.blockers,
    provenance: { sources: [...new Set(['P0 PerformanceAssessment', 'P0 DataQuality', 'P0 EvidenceContract', ...(input.nicheSignals ? ['P1 Phase 2 NicheSignals'] : []), ...(input.nicheLifecycle ? ['P1 Phase 3 NicheLifecycle'] : [])])], evidenceId: input.evidence?.snapshotId || null, lifecycle: lifecycleProvenance(input.nicheLifecycle), algorithmVersions: [...new Set([OPPORTUNITY_ENGINE_ALGORITHM_VERSION, ENTRY_WINDOW_ALGORITHM_VERSION, input.nicheSignals?.algorithmVersion, input.nicheLifecycle?.algorithmVersion].filter((value): value is string => Boolean(value)))] },
    algorithmVersion: OPPORTUNITY_ENGINE_ALGORITHM_VERSION,
  };
}

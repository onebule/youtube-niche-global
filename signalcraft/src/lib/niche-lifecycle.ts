import type { ConfidenceLevel } from './entry-decision.ts';
import { EVIDENCE_SCHEMA_VERSION, DATA_QUALITY_SCHEMA_VERSION, normalizeDataQuality, normalizeEvidence, type DataQuality, type EvidenceContract } from './evidence-contract.ts';
import { buildNicheBreakoutSummary, type NicheBreakoutObservation, type NicheBreakoutSummary } from './niche-signals.ts';

/**
 * P1 Phase 3 temporal evidence. This module never fabricates historical
 * views, calls a proxy search demand, or writes an EntryDecision.
 */
export const NICHE_LIFECYCLE_ALGORITHM_VERSION = 'niche-lifecycle-v1';

export const NICHE_LIFECYCLE_CONFIG = Object.freeze({
  version: NICHE_LIFECYCLE_ALGORITHM_VERSION,
  minWindowVideos: 5,
  minWindowCreators: 3,
  minWindowCoverage: 0.6,
  minDateSpanDays: 14,
  comparableDurationTolerance: 0.2,
  materialGrowth: 0.2,
  stableChange: 0.1,
  performanceDilution: -0.15,
  breakoutTrendChange: 0.15,
  concentrationTrendChange: 0.1,
  strongSaturationSupport: 2,
  emergingMaxCurrentVideos: 20,
  publicationRateScaleDays: 30,
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type TimeSemantics = 'TRUE_SNAPSHOT_HISTORY' | 'PUBLICATION_COHORT_HISTORY' | 'CURRENT_PUBLIC_CORPUS' | 'UNKNOWN';
export type TrendDirection = 'RISING' | 'STABLE' | 'FALLING' | 'INSUFFICIENT';
export type SupplyDemandRelationship = 'INSUFFICIENT' | 'DEMAND_OUTPACING_SUPPLY' | 'BALANCED_GROWTH' | 'SUPPLY_OUTPACING_DEMAND' | 'BOTH_DECLINING' | 'MIXED';
export type NicheLifecycleState = 'INSUFFICIENT' | 'EMERGING' | 'GROWING' | 'MATURE' | 'SATURATED' | 'DECLINING';
export type NicheLifecycleSignalType = 'SUPPLY_ACCELERATION' | 'CREATOR_ACCELERATION' | 'OBSERVED_DEMAND_ACCELERATION' | 'SUPPLY_OUTPACING_DEMAND' | 'PERFORMANCE_DILUTION' | 'BREAKOUT_ACCESS_IMPROVING' | 'BREAKOUT_ACCESS_DECLINING' | 'CREATOR_CONCENTRATION_RISING' | 'CREATOR_CONCENTRATION_FALLING' | 'SATURATION_RISING' | 'SATURATION_EASING';
export type LifecycleSignalStrength = 'INSUFFICIENT' | 'WEAK' | 'MODERATE' | 'STRONG';

export type NicheLifecycleObservation = NicheBreakoutObservation & {
  publishedAt?: string | null;
  normalizedPerformance?: number | null;
  snapshotId?: string | null;
};

export type NicheWindowInput = {
  nicheId: string;
  format: 'long';
  key: 'current' | 'comparison';
  start: string;
  end: string;
  timeSemantics: TimeSemantics;
  coverage?: number | null;
  observations: readonly NicheLifecycleObservation[];
};

export type ComparableWindowAssessment = {
  current: { start: string; end: string; durationDays: number; timeSemantics: TimeSemantics };
  comparison: { start: string; end: string; durationDays: number; timeSemantics: TimeSemantics };
  durationDays: number;
  coverage: number | null;
  comparable: boolean;
  confidence: ConfidenceLevel;
  provenance: 'TRUE_SNAPSHOT_HISTORY' | 'RETROSPECTIVE' | 'INSUFFICIENT';
  blockers: string[];
};

export type TrendMetric = {
  current: number | null;
  comparison: number | null;
  absoluteChange: number | null;
  relativeChange: number | null;
  direction: TrendDirection;
  confidence: ConfidenceLevel;
  unit: string;
};

export type SupplyMetrics = {
  videoSupply: number;
  eligibleVideoSupply: number;
  activeCreators: number;
  newlyObservedCreators: number;
  videosPerCreator: number | null;
  publicationRate: number | null;
  totalViews: number | null;
  medianNormalizedPerformance: number | null;
  p75NormalizedPerformance: number | null;
  breakout: NicheBreakoutSummary;
};

export type ObservedDemandAssessment = {
  metric: 'median_normalized_performance';
  medianNormalizedPerformance: number | null;
  p75NormalizedPerformance: number | null;
  matureVideoCount: number;
  window: 'current' | 'comparison';
  timeSemantics: TimeSemantics;
  confidence: ConfidenceLevel;
  note: string;
};

export type NicheLifecycleSignal = {
  type: NicheLifecycleSignalType;
  strength: LifecycleSignalStrength;
  confidence: ConfidenceLevel;
  evidence: { currentValue: number | null; comparisonValue: number | null; relativeChange: number | null; eligibleVideos: number; eligibleCreators: number };
  reasons: string[];
  blockers: string[];
  algorithmVersion: string;
};

export type NicheLifecycleSummary = {
  algorithmVersion: string;
  nicheId: string;
  format: 'long';
  currentWindow: ComparableWindowAssessment['current'];
  comparisonWindow: ComparableWindowAssessment['comparison'];
  comparison: ComparableWindowAssessment;
  supply: { current: SupplyMetrics; comparison: SupplyMetrics; videoSupplyTrend: TrendMetric; creatorTrend: TrendMetric; performanceTrend: TrendMetric };
  observedDemand: { current: ObservedDemandAssessment; comparison: ObservedDemandAssessment; trend: TrendMetric };
  supplyDemandRelationship: SupplyDemandRelationship;
  breakoutTrend: { density: TrendMetric; strongDensity: TrendMetric; breakoutCreators: TrendMetric; smallCreatorRate: TrendMetric };
  concentrationTrend: { top1Share: TrendMetric; top3Share: TrendMetric };
  signals: NicheLifecycleSignal[];
  lifecycle: { state: NicheLifecycleState; confidence: ConfidenceLevel; provenance: 'TRUE_SNAPSHOT_HISTORY' | 'RETROSPECTIVE' | 'INSUFFICIENT'; reasons: string[]; blockers: string[] };
  confidence: ConfidenceLevel;
  dataQuality: DataQuality;
  evidence: EvidenceContract;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const median = (values: number[]) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2); };
const percentile = (values: number[], p: number) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); return round(sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]); };
const validDate = (value: string) => Number.isFinite(new Date(value).getTime());
const daysBetween = (start: string, end: string) => Math.max(0, (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000);
const breakout = (value: NicheLifecycleObservation): NicheBreakoutObservation => value;

function dedupeObservations(input: NicheWindowInput): NicheLifecycleObservation[] {
  const byVideo = new Map<string, NicheLifecycleObservation>();
  for (const row of input.observations) {
    if (!row || row.nicheId !== input.nicheId || row.format !== 'long' || !row.videoId || !row.creatorId || byVideo.has(row.videoId)) continue;
    byVideo.set(row.videoId, row);
  }
  return [...byVideo.values()];
}

function performanceValue(row: NicheLifecycleObservation, end: string): number | null {
  if (finite(row.normalizedPerformance) && row.normalizedPerformance! >= 0) return row.normalizedPerformance!;
  if (!finite(row.views) || row.views! < 0 || !row.publishedAt || !validDate(row.publishedAt)) return null;
  const ageDays = Math.max(1, daysBetween(row.publishedAt, end));
  return row.views! / ageDays;
}

function metricsFor(input: NicheWindowInput, comparisonCreators: Set<string>): SupplyMetrics {
  const rows = dedupeObservations(input);
  const durationDays = Math.max(1, daysBetween(input.start, input.end));
  const performances = rows.map(row => performanceValue(row, input.end)).filter((value): value is number => finite(value));
  const eligibleRows = rows.filter(row => row.baselineStatus === 'VERIFIED' && row.baselineConfidence !== 'INSUFFICIENT' && row.breakoutClassification !== 'INSUFFICIENT' && finite(row.breakoutMultiple) && row.breakoutMultiple! >= 0);
  const creators = new Set(rows.map(row => row.creatorId));
  const breakoutSummary = buildNicheBreakoutSummary({ nicheId: input.nicheId, observations: eligibleRows.map(breakout) });
  const views = rows.map(row => row.views).filter((value): value is number => finite(value) && value >= 0);
  return { videoSupply: rows.length, eligibleVideoSupply: eligibleRows.length, activeCreators: creators.size, newlyObservedCreators: [...creators].filter(id => !comparisonCreators.has(id)).length, videosPerCreator: creators.size ? round(rows.length / creators.size) : null, publicationRate: round((rows.length / durationDays) * NICHE_LIFECYCLE_CONFIG.publicationRateScaleDays), totalViews: views.length ? round(views.reduce((sum, value) => sum + value, 0), 0) : null, medianNormalizedPerformance: median(performances), p75NormalizedPerformance: percentile(performances, 0.75), breakout: breakoutSummary };
}

function directionFor(current: number | null, comparison: number | null, confidence: ConfidenceLevel, unit: string): TrendMetric {
  if (!finite(current) || !finite(comparison) || confidence === 'INSUFFICIENT') return { current, comparison, absoluteChange: null, relativeChange: null, direction: 'INSUFFICIENT', confidence, unit };
  const absoluteChange = current! - comparison!;
  const relativeChange = comparison! > 0 ? absoluteChange / comparison! : null;
  const direction = relativeChange === null ? absoluteChange > 0 ? 'RISING' : absoluteChange < 0 ? 'FALLING' : 'STABLE' : relativeChange >= NICHE_LIFECYCLE_CONFIG.stableChange ? 'RISING' : relativeChange <= -NICHE_LIFECYCLE_CONFIG.stableChange ? 'FALLING' : 'STABLE';
  return { current, comparison, absoluteChange: round(absoluteChange), relativeChange: relativeChange === null ? null : round(relativeChange), direction, confidence, unit };
}

function confidenceFor(current: NicheWindowInput, comparison: NicheWindowInput, currentMetrics: SupplyMetrics, comparisonMetrics: SupplyMetrics, coverage: number | null): ConfidenceLevel {
  if (currentMetrics.videoSupply < NICHE_LIFECYCLE_CONFIG.minWindowVideos || comparisonMetrics.videoSupply < NICHE_LIFECYCLE_CONFIG.minWindowVideos || currentMetrics.activeCreators < NICHE_LIFECYCLE_CONFIG.minWindowCreators || comparisonMetrics.activeCreators < NICHE_LIFECYCLE_CONFIG.minWindowCreators) return 'INSUFFICIENT';
  if (coverage !== null && coverage < NICHE_LIFECYCLE_CONFIG.minWindowCoverage) return 'LOW';
  const lowHistory = current.timeSemantics === 'CURRENT_PUBLIC_CORPUS' || comparison.timeSemantics === 'CURRENT_PUBLIC_CORPUS' || current.timeSemantics === 'PUBLICATION_COHORT_HISTORY' || comparison.timeSemantics === 'PUBLICATION_COHORT_HISTORY';
  if (currentMetrics.videoSupply >= 20 && comparisonMetrics.videoSupply >= 20 && currentMetrics.activeCreators >= 8 && comparisonMetrics.activeCreators >= 8 && !lowHistory) return 'HIGH';
  return lowHistory ? 'MEDIUM' : 'MEDIUM';
}

function lifecycleSignal(input: { type: NicheLifecycleSignalType; strength: LifecycleSignalStrength; confidence: ConfidenceLevel; current: number | null; comparison: number | null; relativeChange: number | null; currentVideos: number; currentCreators: number; reasons: string[]; blockers?: string[] }): NicheLifecycleSignal {
  const strength = input.confidence === 'INSUFFICIENT' ? 'INSUFFICIENT' : input.confidence === 'LOW' && input.strength === 'STRONG' ? 'MODERATE' : input.strength;
  return { type: input.type, strength, confidence: input.confidence, evidence: { currentValue: input.current, comparisonValue: input.comparison, relativeChange: input.relativeChange, eligibleVideos: input.currentVideos, eligibleCreators: input.currentCreators }, reasons: input.reasons, blockers: input.blockers || [], algorithmVersion: NICHE_LIFECYCLE_ALGORITHM_VERSION };
}

function trendFromBreakout(current: number | null, comparison: number | null, confidence: ConfidenceLevel, unit: string): TrendMetric { return directionFor(current, comparison, confidence, unit); }

function evidenceFor(summary: { nicheId: string; comparison: ComparableWindowAssessment; current: SupplyMetrics; previous: SupplyMetrics; state: NicheLifecycleState }): EvidenceContract {
  const missing = [...summary.comparison.blockers];
  return { schemaVersion: EVIDENCE_SCHEMA_VERSION, algorithmVersion: NICHE_LIFECYCLE_ALGORITHM_VERSION, source: 'public-youtube-niche-lifecycle', facts: [{ statement: `赛道 ${summary.nicheId} 当前窗口 ${summary.current.videoSupply} 条视频、${summary.current.activeCreators} 个活跃创作者；对比窗口 ${summary.previous.videoSupply} 条视频、${summary.previous.activeCreators} 个活跃创作者。`, type: 'FACT', source: 'niche-lifecycle-v1' }, { statement: `生命周期分析状态为 ${summary.state}，窗口语义为 ${summary.comparison.provenance}。`, type: 'FACT', source: 'niche-lifecycle-v1' }], inferences: [{ statement: '观测需求代理基于归一化单视频表现，不代表 YouTube 搜索量。', type: 'LOW_CONFIDENCE', source: 'niche-lifecycle-v1' }], missing, decisionReasons: [] };
}

export function compareNicheWindows(currentInput: NicheWindowInput, comparisonInput: NicheWindowInput): ComparableWindowAssessment {
  const currentDuration = daysBetween(currentInput.start, currentInput.end);
  const comparisonDuration = daysBetween(comparisonInput.start, comparisonInput.end);
  const blockers: string[] = [];
  if (currentInput.nicheId !== comparisonInput.nicheId || currentInput.format !== 'long' || comparisonInput.format !== 'long') blockers.push('窗口缺少相同的 Long-form 赛道身份。');
  if (!validDate(currentInput.start) || !validDate(currentInput.end) || !validDate(comparisonInput.start) || !validDate(comparisonInput.end)) blockers.push('窗口日期无效。');
  if (currentDuration < NICHE_LIFECYCLE_CONFIG.minDateSpanDays || comparisonDuration < NICHE_LIFECYCLE_CONFIG.minDateSpanDays) blockers.push('窗口日期跨度低于最低门槛。');
  const ratio = comparisonDuration > 0 ? currentDuration / comparisonDuration : 0;
  if (ratio < 1 - NICHE_LIFECYCLE_CONFIG.comparableDurationTolerance || ratio > 1 + NICHE_LIFECYCLE_CONFIG.comparableDurationTolerance) blockers.push('当前窗口与对比窗口长度不可比。');
  const coverageValues = [currentInput.coverage, comparisonInput.coverage].filter((value): value is number => finite(value));
  const coverage = coverageValues.length ? Math.min(...coverageValues) : null;
  if (coverage !== null && coverage < NICHE_LIFECYCLE_CONFIG.minWindowCoverage) blockers.push('窗口数据覆盖率不足。');
  const currentRows = dedupeObservations(currentInput);
  const comparisonRows = dedupeObservations(comparisonInput);
  if (currentRows.length < NICHE_LIFECYCLE_CONFIG.minWindowVideos || comparisonRows.length < NICHE_LIFECYCLE_CONFIG.minWindowVideos) blockers.push('窗口视频样本不足。');
  if (new Set(currentRows.map(row => row.creatorId)).size < NICHE_LIFECYCLE_CONFIG.minWindowCreators || new Set(comparisonRows.map(row => row.creatorId)).size < NICHE_LIFECYCLE_CONFIG.minWindowCreators) blockers.push('窗口创作者样本不足。');
  const lowHistory = [currentInput.timeSemantics, comparisonInput.timeSemantics].some(value => value === 'UNKNOWN');
  if (lowHistory) blockers.push('历史时间语义未知。');
  const comparable = blockers.length === 0;
  const provenance = !comparable ? 'INSUFFICIENT' : currentInput.timeSemantics === 'TRUE_SNAPSHOT_HISTORY' && comparisonInput.timeSemantics === 'TRUE_SNAPSHOT_HISTORY' ? 'TRUE_SNAPSHOT_HISTORY' : 'RETROSPECTIVE';
  const confidence: ConfidenceLevel = !comparable ? 'INSUFFICIENT' : provenance === 'TRUE_SNAPSHOT_HISTORY' ? 'MEDIUM' : 'MEDIUM';
  return { current: { start: currentInput.start, end: currentInput.end, durationDays: round(currentDuration), timeSemantics: currentInput.timeSemantics }, comparison: { start: comparisonInput.start, end: comparisonInput.end, durationDays: round(comparisonDuration), timeSemantics: comparisonInput.timeSemantics }, durationDays: round(currentDuration), coverage, comparable, confidence, provenance, blockers };
}

export function buildNicheLifecycleSummary(currentInput: NicheWindowInput, comparisonInput: NicheWindowInput): NicheLifecycleSummary {
  const comparison = compareNicheWindows(currentInput, comparisonInput);
  const currentRows = dedupeObservations(currentInput);
  const previousCreators = new Set(dedupeObservations(comparisonInput).map(row => row.creatorId));
  const current = metricsFor(currentInput, previousCreators);
  const previous = metricsFor(comparisonInput, new Set(currentRows.map(row => row.creatorId)));
  const confidence = comparison.comparable ? confidenceFor(currentInput, comparisonInput, current, previous, comparison.coverage) : 'INSUFFICIENT';
  const supplyTrend = directionFor(current.videoSupply, previous.videoSupply, confidence, 'videos');
  const creatorTrend = directionFor(current.activeCreators, previous.activeCreators, confidence, 'creators');
  const performanceTrend = directionFor(current.medianNormalizedPerformance, previous.medianNormalizedPerformance, confidence, 'normalized_performance');
  const demandCurrent: ObservedDemandAssessment = { metric: 'median_normalized_performance', medianNormalizedPerformance: current.medianNormalizedPerformance, p75NormalizedPerformance: current.p75NormalizedPerformance, matureVideoCount: current.eligibleVideoSupply, window: 'current', timeSemantics: currentInput.timeSemantics, confidence, note: '归一化单视频表现是公开表现代理，不是搜索需求或收入。' };
  const demandPrevious: ObservedDemandAssessment = { metric: 'median_normalized_performance', medianNormalizedPerformance: previous.medianNormalizedPerformance, p75NormalizedPerformance: previous.p75NormalizedPerformance, matureVideoCount: previous.eligibleVideoSupply, window: 'comparison', timeSemantics: comparisonInput.timeSemantics, confidence, note: '归一化单视频表现是公开表现代理，不是搜索需求或收入。' };
  const demandTrend = performanceTrend;
  const supplyChange = supplyTrend.relativeChange;
  const demandChange = demandTrend.relativeChange;
  const supplyDemandRelationship: SupplyDemandRelationship = !comparison.comparable || supplyChange === null || demandChange === null ? 'INSUFFICIENT' : demandChange >= NICHE_LIFECYCLE_CONFIG.materialGrowth && demandChange - supplyChange >= NICHE_LIFECYCLE_CONFIG.stableChange ? 'DEMAND_OUTPACING_SUPPLY' : supplyChange >= NICHE_LIFECYCLE_CONFIG.materialGrowth && demandChange < NICHE_LIFECYCLE_CONFIG.materialGrowth ? 'SUPPLY_OUTPACING_DEMAND' : demandChange <= -NICHE_LIFECYCLE_CONFIG.materialGrowth && supplyChange <= -NICHE_LIFECYCLE_CONFIG.materialGrowth ? 'BOTH_DECLINING' : Math.abs(demandChange - supplyChange) < NICHE_LIFECYCLE_CONFIG.stableChange ? 'BALANCED_GROWTH' : 'MIXED';
  const densityTrend = trendFromBreakout(current.breakout.breakoutDensity, previous.breakout.breakoutDensity, confidence, 'ratio');
  const strongDensityTrend = trendFromBreakout(current.breakout.strongBreakoutDensity, previous.breakout.strongBreakoutDensity, confidence, 'ratio');
  const breakoutCreatorsTrend = trendFromBreakout(current.breakout.breakoutCreators, previous.breakout.breakoutCreators, confidence, 'creators');
  const smallCreatorTrend = trendFromBreakout(current.breakout.smallCreatorBreakoutRate, previous.breakout.smallCreatorBreakoutRate, confidence, 'ratio');
  const top1Trend = directionFor(current.breakout.concentration.top1Share, previous.breakout.concentration.top1Share, confidence, 'share');
  const top3Trend = directionFor(current.breakout.concentration.top3Share, previous.breakout.concentration.top3Share, confidence, 'share');
  const negativeConditions = [supplyDemandRelationship === 'SUPPLY_OUTPACING_DEMAND', performanceTrend.direction === 'FALLING' && performanceTrend.relativeChange !== null && performanceTrend.relativeChange <= NICHE_LIFECYCLE_CONFIG.performanceDilution, densityTrend.direction === 'FALLING' && densityTrend.relativeChange !== null && densityTrend.relativeChange <= -NICHE_LIFECYCLE_CONFIG.breakoutTrendChange, top3Trend.direction === 'RISING' && top3Trend.absoluteChange !== null && top3Trend.absoluteChange >= NICHE_LIFECYCLE_CONFIG.concentrationTrendChange, creatorTrend.direction === 'RISING' && creatorTrend.relativeChange !== null && creatorTrend.relativeChange >= NICHE_LIFECYCLE_CONFIG.materialGrowth].filter(Boolean).length;
  const positiveConditions = [supplyDemandRelationship === 'DEMAND_OUTPACING_SUPPLY', performanceTrend.direction === 'RISING', densityTrend.direction === 'RISING', top3Trend.direction === 'FALLING'].filter(Boolean).length;
  const signals: NicheLifecycleSignal[] = [];
  const addTrendSignal = (type: NicheLifecycleSignalType, trend: TrendMetric, condition: boolean, reason: string) => { if (condition) signals.push(lifecycleSignal({ type, strength: 'MODERATE', confidence, current: trend.current, comparison: trend.comparison, relativeChange: trend.relativeChange, currentVideos: current.eligibleVideoSupply, currentCreators: current.activeCreators, reasons: [reason] })); };
  addTrendSignal('SUPPLY_ACCELERATION', supplyTrend, supplyTrend.direction === 'RISING' && (supplyTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.materialGrowth, `视频供给变化 ${(supplyTrend.relativeChange || 0) * 100}%。`);
  addTrendSignal('CREATOR_ACCELERATION', creatorTrend, creatorTrend.direction === 'RISING' && (creatorTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.materialGrowth, `活跃创作者变化 ${(creatorTrend.relativeChange || 0) * 100}%。`);
  addTrendSignal('OBSERVED_DEMAND_ACCELERATION', demandTrend, demandTrend.direction === 'RISING' && (demandTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.materialGrowth, '归一化单视频表现上升；这是观测受众表现代理，不是搜索量。');
  if (supplyDemandRelationship === 'SUPPLY_OUTPACING_DEMAND') signals.push(lifecycleSignal({ type: 'SUPPLY_OUTPACING_DEMAND', strength: 'MODERATE', confidence, current: demandChange, comparison: supplyChange, relativeChange: demandChange !== null && supplyChange !== null ? demandChange - supplyChange : null, currentVideos: current.eligibleVideoSupply, currentCreators: current.activeCreators, reasons: ['供给增长快于归一化单视频表现。'] }));
  addTrendSignal('PERFORMANCE_DILUTION', performanceTrend, performanceTrend.direction === 'FALLING' && (performanceTrend.relativeChange || 0) <= NICHE_LIFECYCLE_CONFIG.performanceDilution, `归一化单视频表现变化 ${(performanceTrend.relativeChange || 0) * 100}%。`);
  addTrendSignal('BREAKOUT_ACCESS_IMPROVING', densityTrend, densityTrend.direction === 'RISING' && (densityTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.breakoutTrendChange, '可比较视频的突破密度上升。');
  addTrendSignal('BREAKOUT_ACCESS_DECLINING', densityTrend, densityTrend.direction === 'FALLING' && (densityTrend.relativeChange || 0) <= -NICHE_LIFECYCLE_CONFIG.breakoutTrendChange, '可比较视频的突破密度下降。');
  addTrendSignal('CREATOR_CONCENTRATION_RISING', top3Trend, top3Trend.direction === 'RISING' && (top3Trend.absoluteChange || 0) >= NICHE_LIFECYCLE_CONFIG.concentrationTrendChange, 'Top 3 创作者的有效视频播放占比上升。');
  addTrendSignal('CREATOR_CONCENTRATION_FALLING', top3Trend, top3Trend.direction === 'FALLING' && (top3Trend.absoluteChange || 0) <= -NICHE_LIFECYCLE_CONFIG.concentrationTrendChange, 'Top 3 创作者的有效视频播放占比下降。');
  const supplyRising = supplyTrend.direction === 'RISING' && (supplyTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.materialGrowth;
  const performanceDiluting = performanceTrend.direction === 'FALLING' && (performanceTrend.relativeChange || 0) <= NICHE_LIFECYCLE_CONFIG.performanceDilution;
  const accessOrConcentrationNegative = (densityTrend.direction === 'FALLING' && (densityTrend.relativeChange || 0) <= -NICHE_LIFECYCLE_CONFIG.breakoutTrendChange) || (top3Trend.direction === 'RISING' && (top3Trend.absoluteChange || 0) >= NICHE_LIFECYCLE_CONFIG.concentrationTrendChange) || (creatorTrend.direction === 'RISING' && (creatorTrend.relativeChange || 0) >= NICHE_LIFECYCLE_CONFIG.materialGrowth);
  const strongSaturation = supplyRising && performanceDiluting && accessOrConcentrationNegative;
  const saturationStrength: LifecycleSignalStrength = strongSaturation ? 'STRONG' : negativeConditions >= NICHE_LIFECYCLE_CONFIG.strongSaturationSupport ? 'MODERATE' : negativeConditions === 1 ? 'WEAK' : 'INSUFFICIENT';
  if (saturationStrength !== 'INSUFFICIENT') signals.push(lifecycleSignal({ type: 'SATURATION_RISING', strength: saturationStrength, confidence, current: negativeConditions, comparison: null, relativeChange: null, currentVideos: current.eligibleVideoSupply, currentCreators: current.activeCreators, reasons: [`${negativeConditions} 个独立负向维度同时出现；供给、表现、突破可达性和集中度保持分开。`], blockers: negativeConditions < NICHE_LIFECYCLE_CONFIG.strongSaturationSupport ? ['负向维度不足以形成强饱和结论。'] : [] }));
  if (positiveConditions >= 2) signals.push(lifecycleSignal({ type: 'SATURATION_EASING', strength: 'MODERATE', confidence, current: positiveConditions, comparison: null, relativeChange: null, currentVideos: current.eligibleVideoSupply, currentCreators: current.activeCreators, reasons: [`${positiveConditions} 个增长或创作者可达性维度改善。`] }));
  const blockers = [...comparison.blockers];
  let state: NicheLifecycleState = 'INSUFFICIENT';
  const reasons: string[] = [];
  if (comparison.comparable) {
    if (strongSaturation) { state = 'SATURATED'; reasons.push('供给压力、单视频表现稀释与额外竞争负向维度同时出现。'); }
    else if (supplyDemandRelationship === 'BOTH_DECLINING' || (demandTrend.direction === 'FALLING' && performanceTrend.direction === 'FALLING')) { state = 'DECLINING'; reasons.push('观测受众表现与归一化单视频表现均走弱。'); }
    else if (current.videoSupply <= NICHE_LIFECYCLE_CONFIG.emergingMaxCurrentVideos && creatorTrend.direction === 'RISING' && demandTrend.direction === 'RISING') { state = 'EMERGING'; reasons.push('样本已过最低门槛但当前供给仍较低，创作者参与和归一化表现同步改善。'); }
    else if (demandTrend.direction === 'RISING' && supplyTrend.direction === 'RISING' && negativeConditions === 0) { state = 'GROWING'; reasons.push('供给与观测受众表现同步增长，未见多维饱和压力。'); }
    else if (supplyTrend.direction === 'STABLE' && creatorTrend.direction === 'STABLE' && demandTrend.direction === 'STABLE' && performanceTrend.direction === 'STABLE') { state = 'MATURE'; reasons.push('供给、创作者参与和归一化表现均保持稳定。'); }
    else { blockers.push('当前证据无法稳定区分增长、成熟或饱和。'); }
  }
  const lifecycleConfidence: ConfidenceLevel = state === 'INSUFFICIENT' ? 'INSUFFICIENT' : comparison.provenance === 'RETROSPECTIVE' ? confidence === 'HIGH' ? 'MEDIUM' : confidence : confidence;
  const dataQuality: DataQuality = normalizeDataQuality({ level: lifecycleConfidence, sampleVideos: current.eligibleVideoSupply + previous.eligibleVideoSupply, sampleChannels: Math.max(current.activeCreators, previous.activeCreators), completeness: comparison.comparable ? 80 : 20, missingFields: blockers }, { schemaVersion: DATA_QUALITY_SCHEMA_VERSION, source: 'public-youtube-niche-lifecycle' });
  const summary: NicheLifecycleSummary = { algorithmVersion: NICHE_LIFECYCLE_ALGORITHM_VERSION, nicheId: currentInput.nicheId, format: 'long', currentWindow: comparison.current, comparisonWindow: comparison.comparison, comparison, supply: { current, comparison: previous, videoSupplyTrend: supplyTrend, creatorTrend, performanceTrend }, observedDemand: { current: demandCurrent, comparison: demandPrevious, trend: demandTrend }, supplyDemandRelationship, breakoutTrend: { density: densityTrend, strongDensity: strongDensityTrend, breakoutCreators: breakoutCreatorsTrend, smallCreatorRate: smallCreatorTrend }, concentrationTrend: { top1Share: top1Trend, top3Share: top3Trend }, signals, lifecycle: { state, confidence: lifecycleConfidence, provenance: comparison.provenance, reasons, blockers }, confidence: lifecycleConfidence, dataQuality, evidence: evidenceFor({ nicheId: currentInput.nicheId, comparison, current, previous, state }) };
  return summary;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const confidenceValues = new Set<ConfidenceLevel>(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']);
const lifecycleValues = new Set<NicheLifecycleState>(['INSUFFICIENT', 'EMERGING', 'GROWING', 'MATURE', 'SATURATED', 'DECLINING']);
const semanticsValues = new Set<TimeSemantics>(['TRUE_SNAPSHOT_HISTORY', 'PUBLICATION_COHORT_HISTORY', 'CURRENT_PUBLIC_CORPUS', 'UNKNOWN']);
const signalTypes = new Set<NicheLifecycleSignalType>(['SUPPLY_ACCELERATION', 'CREATOR_ACCELERATION', 'OBSERVED_DEMAND_ACCELERATION', 'SUPPLY_OUTPACING_DEMAND', 'PERFORMANCE_DILUTION', 'BREAKOUT_ACCESS_IMPROVING', 'BREAKOUT_ACCESS_DECLINING', 'CREATOR_CONCENTRATION_RISING', 'CREATOR_CONCENTRATION_FALLING', 'SATURATION_RISING', 'SATURATION_EASING']);
const signalStrengths = new Set<LifecycleSignalStrength>(['INSUFFICIENT', 'WEAK', 'MODERATE', 'STRONG']);

function normalizeTrend(value: unknown): TrendMetric { const raw = isRecord(value) ? value : {}; const confidence = confidenceValues.has(raw.confidence as ConfidenceLevel) ? raw.confidence as ConfidenceLevel : 'INSUFFICIENT'; const direction = raw.direction === 'RISING' || raw.direction === 'FALLING' || raw.direction === 'STABLE' || raw.direction === 'INSUFFICIENT' ? raw.direction : 'INSUFFICIENT'; return { current: number(raw.current), comparison: number(raw.comparison), absoluteChange: number(raw.absoluteChange), relativeChange: number(raw.relativeChange), direction, confidence, unit: text(raw.unit) || 'unknown' }; }
function normalizeLifecycleSignal(value: unknown): NicheLifecycleSignal | null { if (!isRecord(value) || !signalTypes.has(value.type as NicheLifecycleSignalType) || !signalStrengths.has(value.strength as LifecycleSignalStrength) || !confidenceValues.has(value.confidence as ConfidenceLevel)) return null; const evidence = isRecord(value.evidence) ? value.evidence : {}; return { type: value.type as NicheLifecycleSignalType, strength: value.strength as LifecycleSignalStrength, confidence: value.confidence as ConfidenceLevel, evidence: { currentValue: number(evidence.currentValue), comparisonValue: number(evidence.comparisonValue), relativeChange: number(evidence.relativeChange), eligibleVideos: Math.max(0, Math.round(number(evidence.eligibleVideos) || 0)), eligibleCreators: Math.max(0, Math.round(number(evidence.eligibleCreators) || 0)) }, reasons: Array.isArray(value.reasons) ? value.reasons.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [], blockers: Array.isArray(value.blockers) ? value.blockers.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [], algorithmVersion: text(value.algorithmVersion) || NICHE_LIFECYCLE_ALGORITHM_VERSION }; }

/** Strictly normalizes optional upstream lifecycle evidence; missing history stays missing. */
export function normalizeNicheLifecycleSummary(value: unknown): NicheLifecycleSummary | null {
  if (!isRecord(value) || !text(value.nicheId) || value.format !== 'long' || !isRecord(value.comparison) || !isRecord(value.lifecycle)) return null;
  const comparison = value.comparison;
  const currentWindow = isRecord(value.currentWindow) ? value.currentWindow : {};
  const comparisonWindow = isRecord(value.comparisonWindow) ? value.comparisonWindow : {};
  const lifecycle = value.lifecycle;
  const state = lifecycleValues.has(lifecycle.state as NicheLifecycleState) ? lifecycle.state as NicheLifecycleState : 'INSUFFICIENT';
  const confidence = confidenceValues.has(value.confidence as ConfidenceLevel) ? value.confidence as ConfidenceLevel : 'INSUFFICIENT';
  const normalizeWindow = (raw: Record<string, unknown>) => ({ start: text(raw.start) || '', end: text(raw.end) || '', durationDays: Math.max(0, number(raw.durationDays) || 0), timeSemantics: semanticsValues.has(raw.timeSemantics as TimeSemantics) ? raw.timeSemantics as TimeSemantics : 'UNKNOWN' });
  const fallbackTrend = { current: null, comparison: null, absoluteChange: null, relativeChange: null, direction: 'INSUFFICIENT' as const, confidence: 'INSUFFICIENT' as const, unit: 'unknown' };
  const rawSupply = isRecord(value.supply) ? value.supply : {};
  const rawDemand = isRecord(value.observedDemand) ? value.observedDemand : {};
  const rawBreakout = isRecord(value.breakoutTrend) ? value.breakoutTrend : {};
  const rawConcentration = isRecord(value.concentrationTrend) ? value.concentrationTrend : {};
  const normalizedEvidence = normalizeEvidence(value.evidence, { schemaVersion: EVIDENCE_SCHEMA_VERSION, algorithmVersion: text(value.algorithmVersion) || NICHE_LIFECYCLE_ALGORITHM_VERSION, source: 'public-youtube-niche-lifecycle' });
  const normalizedQuality = normalizeDataQuality(value.dataQuality, { schemaVersion: DATA_QUALITY_SCHEMA_VERSION, level: confidence, source: 'public-youtube-niche-lifecycle' });
  const emptyMetrics = (): SupplyMetrics => ({ videoSupply: 0, eligibleVideoSupply: 0, activeCreators: 0, newlyObservedCreators: 0, videosPerCreator: null, publicationRate: null, totalViews: null, medianNormalizedPerformance: null, p75NormalizedPerformance: null, breakout: {} as NicheBreakoutSummary });
  return { algorithmVersion: text(value.algorithmVersion) || NICHE_LIFECYCLE_ALGORITHM_VERSION, nicheId: text(value.nicheId)!, format: 'long', currentWindow: normalizeWindow(currentWindow), comparisonWindow: normalizeWindow(comparisonWindow), comparison: { current: normalizeWindow(currentWindow), comparison: normalizeWindow(comparisonWindow), durationDays: Math.max(0, number(comparison.durationDays) || 0), coverage: number(comparison.coverage), comparable: comparison.comparable === true, confidence: confidenceValues.has(comparison.confidence as ConfidenceLevel) ? comparison.confidence as ConfidenceLevel : 'INSUFFICIENT', provenance: comparison.provenance === 'TRUE_SNAPSHOT_HISTORY' || comparison.provenance === 'RETROSPECTIVE' ? comparison.provenance : 'INSUFFICIENT', blockers: Array.isArray(comparison.blockers) ? comparison.blockers.filter((item): item is string => typeof item === 'string') : [] }, supply: { current: emptyMetrics(), comparison: emptyMetrics(), videoSupplyTrend: normalizeTrend(isRecord(rawSupply.videoSupplyTrend) ? rawSupply.videoSupplyTrend : fallbackTrend), creatorTrend: normalizeTrend(isRecord(rawSupply.creatorTrend) ? rawSupply.creatorTrend : fallbackTrend), performanceTrend: normalizeTrend(isRecord(rawSupply.performanceTrend) ? rawSupply.performanceTrend : fallbackTrend) }, observedDemand: { current: {} as ObservedDemandAssessment, comparison: {} as ObservedDemandAssessment, trend: normalizeTrend(isRecord(rawDemand.trend) ? rawDemand.trend : fallbackTrend) }, supplyDemandRelationship: value.supplyDemandRelationship === 'DEMAND_OUTPACING_SUPPLY' || value.supplyDemandRelationship === 'BALANCED_GROWTH' || value.supplyDemandRelationship === 'SUPPLY_OUTPACING_DEMAND' || value.supplyDemandRelationship === 'BOTH_DECLINING' || value.supplyDemandRelationship === 'MIXED' ? value.supplyDemandRelationship : 'INSUFFICIENT', breakoutTrend: { density: normalizeTrend(rawBreakout.density), strongDensity: normalizeTrend(rawBreakout.strongDensity), breakoutCreators: normalizeTrend(rawBreakout.breakoutCreators), smallCreatorRate: normalizeTrend(rawBreakout.smallCreatorRate) }, concentrationTrend: { top1Share: normalizeTrend(rawConcentration.top1Share), top3Share: normalizeTrend(rawConcentration.top3Share) }, signals: Array.isArray(value.signals) ? value.signals.map(normalizeLifecycleSignal).filter((item): item is NicheLifecycleSignal => Boolean(item)) : [], lifecycle: { state, confidence: confidenceValues.has(lifecycle.confidence as ConfidenceLevel) ? lifecycle.confidence as ConfidenceLevel : confidence, provenance: lifecycle.provenance === 'TRUE_SNAPSHOT_HISTORY' || lifecycle.provenance === 'RETROSPECTIVE' ? lifecycle.provenance : 'INSUFFICIENT', reasons: Array.isArray(lifecycle.reasons) ? lifecycle.reasons.filter((item): item is string => typeof item === 'string') : [], blockers: Array.isArray(lifecycle.blockers) ? lifecycle.blockers.filter((item): item is string => typeof item === 'string') : [] }, confidence, dataQuality: normalizedQuality, evidence: normalizedEvidence };
}

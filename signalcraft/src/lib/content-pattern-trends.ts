/**
 * P2 Phase 2 — Pattern history, trend and niche-pattern fit.
 *
 * This layer consumes the canonical P2 Phase 1 pattern report. It never
 * changes Pattern IDs, rewrites the niche lifecycle engine, or emits a
 * strategy/idea. Trend, fit and selection evidence remain separate facts.
 */
import { buildContentPatternReport, type ContentPattern, type ContentPatternReport, type ContentPatternVideo, type PatternConfidence } from './content-patterns.ts';

export const CONTENT_PATTERN_TREND_ALGORITHM_VERSION = 'content-pattern-trend-v1';
export const CONTENT_PATTERN_TREND_CONFIG = Object.freeze({
  minFitVideos: 5,
  minFitCreators: 3,
  adoptionChangeThreshold: 0.2,
  performanceChangeThreshold: 0.1,
  breakoutChangeThreshold: 0.05,
  stableChangeThreshold: 0.1,
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type PatternTimeSemantics = 'PUBLICATION_COHORT' | 'CAPTURE_SNAPSHOT';
export type PatternTrendState = 'ACCELERATING' | 'GROWING' | 'STABLE' | 'DILUTING' | 'DECLINING' | 'INSUFFICIENT';
export type PatternFitStatus = 'TOP_FIT' | 'STRONG_FIT' | 'MODERATE_FIT' | 'WEAK_FIT' | 'INSUFFICIENT';
export type PatternFitConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type PatternSelectionStatus = 'SELECTABLE_LATER' | 'WATCH' | 'INSUFFICIENT';

export type PatternWindowInput = {
  key: 'current' | 'previous' | string;
  start: string | null;
  end: string | null;
  timeSemantics: PatternTimeSemantics;
  videos: readonly ContentPatternVideo[];
  capturedAt?: string | null;
  snapshotId?: string | null;
};

export type PatternComparableWindow = {
  comparable: boolean;
  reason: string;
  current: { key: string; start: string | null; end: string | null; timeSemantics: PatternTimeSemantics };
  previous: { key: string; start: string | null; end: string | null; timeSemantics: PatternTimeSemantics } | null;
};

export type PatternMetricDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  changePct: number | null;
};

export type PatternTrendEvidence = {
  adoption: PatternMetricDelta;
  creatorBreadth: PatternMetricDelta;
  normalizedPerformance: PatternMetricDelta;
  p75Performance: PatternMetricDelta;
  breakoutRate: PatternMetricDelta;
  creatorConcentration: PatternMetricDelta;
};

export type PatternTrendAssessment = {
  pattern: ContentPattern;
  state: PatternTrendState;
  confidence: PatternConfidence;
  evidence: PatternTrendEvidence;
  repeatability: { current: string; previous: string | null };
  reasons: string[];
  blockers: string[];
  provenance: { algorithmVersion: string; timeSemantics: PatternTimeSemantics; currentWindow: string; previousWindow: string | null; sourcePatternIds: string[] };
};

export type NichePatternFit = {
  nicheId: string;
  pattern: ContentPattern;
  status: PatternFitStatus;
  confidence: PatternFitConfidence;
  inside: { videos: number; creators: number; medianPerformance: number | null; breakoutRate: number | null; repeatability: string };
  outside: { videos: number; creators: number; medianPerformance: number | null; breakoutRate: number | null; repeatability: string };
  performanceAdvantage: number | null;
  breakoutAdvantage: number | null;
  reasons: string[];
  blockers: string[];
  context?: { opportunityState?: string | null; lifecycleState?: string | null; entryWindow?: string | null };
  provenance: { algorithmVersion: string; source: 'PUBLIC_YOUTUBE_METADATA'; window: string; patternId: string; nicheId: string };
};

export type PatternSelectionEvidence = {
  pattern: ContentPattern;
  status: PatternSelectionStatus;
  reasons: string[];
  trendState: PatternTrendState;
  fitStatus: PatternFitStatus | null;
  confidence: PatternConfidence | PatternFitConfidence;
};

export type ContentPatternTrendReport = {
  schemaVersion: 'content-pattern-trends.v1';
  algorithmVersion: typeof CONTENT_PATTERN_TREND_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  timeSemantics: PatternTimeSemantics;
  comparableWindow: PatternComparableWindow;
  currentReport: ContentPatternReport;
  previousReport: ContentPatternReport | null;
  assessments: PatternTrendAssessment[];
  nicheFits: NichePatternFit[];
  selectionEvidence: PatternSelectionEvidence[];
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA'; currentWindow: string; previousWindow: string | null; capturedAt: string | null; snapshotId: string | null; calibrationStatus: typeof CONTENT_PATTERN_TREND_CONFIG.calibrationStatus };
};

const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const validDate = (value: string | null) => value !== null && Number.isFinite(Date.parse(value));

function metricDelta(current: number | null, previous: number | null): PatternMetricDelta {
  if (current === null || previous === null) return { current, previous, delta: null, changePct: null };
  const delta = current - previous;
  const changePct = previous === 0 ? (current === 0 ? 0 : null) : delta / Math.abs(previous);
  return { current: round(current), previous: round(previous), delta: round(delta), changePct: changePct === null ? null : round(changePct) };
}

function aggregationFor(report: ContentPatternReport, patternId: string) {
  return report.aggregations.find(item => item.pattern.patternId === patternId);
}

function patternVideoIds(report: ContentPatternReport, patternId: string) {
  return new Set(report.candidates.filter(candidate => candidate.pattern.patternId === patternId).map(candidate => candidate.sourceVideoId));
}

function concentrationShare(report: ContentPatternReport, patternId: string) {
  const ids = patternVideoIds(report, patternId);
  const byCreator = new Map<string, number>();
  if (report.input.longFormVideos > 0) {
    ids.forEach(videoId => {
      const candidate = report.candidates.find(item => item.pattern.patternId === patternId && item.sourceVideoId === videoId);
      if (candidate) byCreator.set(candidate.creatorId, (byCreator.get(candidate.creatorId) || 0) + 1);
    });
  }
  const counts = [...byCreator.values()].sort((a, b) => b - a);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return total ? round(counts.slice(0, 3).reduce((sum, count) => sum + count, 0) / total) : null;
}

function metricsFor(report: ContentPatternReport | null, patternId: string) {
  const aggregation = report ? aggregationFor(report, patternId) : undefined;
  if (!aggregation) return { adoption: 0, creators: 0, median: null as number | null, p75: null as number | null, breakout: null as number | null, concentration: null as number | null, repeatability: 'INSUFFICIENT' };
  return { adoption: aggregation.frequency.occurrences, creators: aggregation.creatorBreadth.distinctCreators, median: aggregation.performance.medianNormalizedPerformance, p75: aggregation.performance.p75NormalizedPerformance, breakout: aggregation.breakoutEvidence.breakoutRate, concentration: concentrationShare(report!, patternId), repeatability: aggregation.repeatability.status };
}

function comparableWindow(current: PatternWindowInput, previous?: PatternWindowInput): PatternComparableWindow {
  const currentWindow = { key: current.key, start: current.start, end: current.end, timeSemantics: current.timeSemantics };
  const previousWindow = previous ? { key: previous.key, start: previous.start, end: previous.end, timeSemantics: previous.timeSemantics } : null;
  if (!previous) return { comparable: false, reason: '没有提供 previous 窗口，无法计算趋势。', current: currentWindow, previous: null };
  if (current.key === previous.key) return { comparable: false, reason: 'current 与 previous 窗口标识相同。', current: currentWindow, previous: previousWindow };
  if (current.timeSemantics !== previous.timeSemantics) return { comparable: false, reason: '窗口时间语义不同，不能比较。', current: currentWindow, previous: previousWindow };
  if (!validDate(current.start) || !validDate(current.end) || !validDate(previous.start) || !validDate(previous.end)) return { comparable: false, reason: '窗口缺少可验证的起止时间。', current: currentWindow, previous: previousWindow };
  const currentDays = Math.round((Date.parse(current.end!) - Date.parse(current.start!)) / 86_400_000);
  const previousDays = Math.round((Date.parse(previous.end!) - Date.parse(previous.start!)) / 86_400_000);
  if (currentDays <= 0 || previousDays <= 0 || currentDays !== previousDays) return { comparable: false, reason: 'current 与 previous 窗口长度不同。', current: currentWindow, previous: previousWindow };
  return { comparable: true, reason: '窗口时间语义与长度一致，可比较。', current: currentWindow, previous: previousWindow };
}

function classifyTrend(evidence: PatternTrendEvidence, comparable: boolean): { state: PatternTrendState; reasons: string[]; blockers: string[] } {
  if (!comparable) return { state: 'INSUFFICIENT', reasons: [], blockers: ['缺少可比较的历史 Pattern 窗口。'] };
  const observed = [evidence.adoption.changePct, evidence.creatorBreadth.changePct, evidence.normalizedPerformance.changePct, evidence.breakoutRate.delta].filter(value => value !== null).length;
  if (observed < 2) return { state: 'INSUFFICIENT', reasons: [], blockers: ['可比较的趋势维度少于两个。'] };
  const adoptionUp = (evidence.adoption.changePct ?? 0) >= CONTENT_PATTERN_TREND_CONFIG.adoptionChangeThreshold;
  const adoptionDown = (evidence.adoption.changePct ?? 0) <= -CONTENT_PATTERN_TREND_CONFIG.adoptionChangeThreshold;
  const creatorsUp = (evidence.creatorBreadth.changePct ?? 0) >= CONTENT_PATTERN_TREND_CONFIG.stableChangeThreshold;
  const creatorsDown = (evidence.creatorBreadth.changePct ?? 0) <= -CONTENT_PATTERN_TREND_CONFIG.stableChangeThreshold;
  const performanceUp = (evidence.normalizedPerformance.changePct ?? 0) >= CONTENT_PATTERN_TREND_CONFIG.performanceChangeThreshold;
  const performanceDown = (evidence.normalizedPerformance.changePct ?? 0) <= -CONTENT_PATTERN_TREND_CONFIG.performanceChangeThreshold;
  const breakoutUp = (evidence.breakoutRate.delta ?? 0) >= CONTENT_PATTERN_TREND_CONFIG.breakoutChangeThreshold;
  const breakoutDown = (evidence.breakoutRate.delta ?? 0) <= -CONTENT_PATTERN_TREND_CONFIG.breakoutChangeThreshold;
  if (adoptionUp && creatorsUp && performanceUp && breakoutUp) return { state: 'ACCELERATING', reasons: ['采用量、独立创作者、规范化表现和突破率同时改善。'], blockers: [] };
  if (adoptionUp && (performanceDown || breakoutDown)) return { state: 'DILUTING', reasons: ['采用量增加，但规范化表现或突破率走弱，符合稀释/拥挤信号。'], blockers: [] };
  if ((adoptionUp && creatorsUp) && !performanceDown && !breakoutDown) return { state: 'GROWING', reasons: ['采用量与独立创作者覆盖扩大，未观察到同步的表现恶化。'], blockers: [] };
  if (adoptionDown && creatorsDown && (performanceDown || breakoutDown || observed === 2)) return { state: 'DECLINING', reasons: ['采用量与独立创作者覆盖共同回落。'], blockers: [] };
  const changes = [evidence.adoption.changePct, evidence.creatorBreadth.changePct, evidence.normalizedPerformance.changePct, evidence.breakoutRate.delta].filter((value): value is number => value !== null);
  if (changes.every(value => Math.abs(value) < CONTENT_PATTERN_TREND_CONFIG.stableChangeThreshold)) return { state: 'STABLE', reasons: ['可比较维度均在稳定范围内。'], blockers: [] };
  return { state: 'INSUFFICIENT', reasons: ['不同维度方向不一致，暂不强行归类。'], blockers: ['趋势证据尚未形成一致方向。'] };
}

function confidenceFor(assessment: PatternTrendAssessment): PatternConfidence {
  const observed = [assessment.evidence.adoption.current, assessment.evidence.creatorBreadth.current, assessment.evidence.normalizedPerformance.current, assessment.evidence.breakoutRate.current].filter(value => value !== null).length;
  if (assessment.state === 'INSUFFICIENT' || observed < 2) return 'INSUFFICIENT';
  if (assessment.evidence.adoption.current! < 5 || assessment.evidence.creatorBreadth.current! < 3) return 'LOW';
  if (assessment.evidence.normalizedPerformance.current === null && assessment.evidence.breakoutRate.current === null) return 'LOW';
  return 'MEDIUM';
}

function buildAssessment(pattern: ContentPattern, current: ContentPatternReport, previous: ContentPatternReport | null, comparable: PatternComparableWindow): PatternTrendAssessment {
  const now = metricsFor(current, pattern.patternId);
  const before = metricsFor(previous, pattern.patternId);
  const evidence: PatternTrendEvidence = { adoption: metricDelta(now.adoption, previous ? before.adoption : null), creatorBreadth: metricDelta(now.creators, previous ? before.creators : null), normalizedPerformance: metricDelta(now.median, previous ? before.median : null), p75Performance: metricDelta(now.p75, previous ? before.p75 : null), breakoutRate: metricDelta(now.breakout, previous ? before.breakout : null), creatorConcentration: metricDelta(now.concentration, previous ? before.concentration : null) };
  const classified = classifyTrend(evidence, comparable.comparable);
  const assessment: PatternTrendAssessment = { pattern, state: classified.state, confidence: 'INSUFFICIENT', evidence, repeatability: { current: now.repeatability, previous: previous ? before.repeatability : null }, reasons: classified.reasons, blockers: classified.blockers, provenance: { algorithmVersion: CONTENT_PATTERN_TREND_ALGORITHM_VERSION, timeSemantics: comparable.current.timeSemantics, currentWindow: comparable.current.key, previousWindow: comparable.previous?.key || null, sourcePatternIds: [pattern.patternId] } };
  assessment.confidence = confidenceFor(assessment);
  return assessment;
}

function fitForPattern(pattern: ContentPattern, nicheId: string, videos: readonly ContentPatternVideo[], window: PatternWindowInput, context?: NichePatternFit['context']): NichePatternFit {
  const inNiche = videos.filter(video => video.nicheId === nicheId);
  const outside = videos.filter(video => video.nicheId && video.nicheId !== nicheId);
  const insideReport = buildContentPatternReport({ videos: inNiche, capturedAt: window.capturedAt, snapshotId: window.snapshotId });
  const outsideReport = buildContentPatternReport({ videos: outside, capturedAt: window.capturedAt, snapshotId: window.snapshotId });
  const inside = metricsFor(insideReport, pattern.patternId);
  const outsideMetrics = metricsFor(outsideReport, pattern.patternId);
  const enoughInside = inside.adoption >= CONTENT_PATTERN_TREND_CONFIG.minFitVideos && inside.creators >= CONTENT_PATTERN_TREND_CONFIG.minFitCreators;
  const performanceAdvantage = inside.median !== null && outsideMetrics.median !== null && outsideMetrics.median !== 0 ? round((inside.median - outsideMetrics.median) / Math.abs(outsideMetrics.median)) : null;
  const breakoutAdvantage = inside.breakout !== null && outsideMetrics.breakout !== null ? round(inside.breakout - outsideMetrics.breakout) : null;
  const reasons: string[] = [];
  const blockers: string[] = [];
  let status: PatternFitStatus = 'INSUFFICIENT';
  let confidence: PatternFitConfidence = 'INSUFFICIENT';
  if (!enoughInside) blockers.push(`目标赛道需要至少 ${CONTENT_PATTERN_TREND_CONFIG.minFitVideos} 条视频和 ${CONTENT_PATTERN_TREND_CONFIG.minFitCreators} 个独立频道。`);
  else if (performanceAdvantage !== null && performanceAdvantage >= 0.15 && (breakoutAdvantage === null || breakoutAdvantage >= 0.05)) { status = 'TOP_FIT'; confidence = outsideMetrics.median === null ? 'MEDIUM' : 'HIGH'; reasons.push('目标赛道的规范化表现显著高于可比较的赛道外样本。'); }
  else if (performanceAdvantage !== null && performanceAdvantage >= 0.05 || breakoutAdvantage !== null && breakoutAdvantage >= 0.05) { status = 'STRONG_FIT'; confidence = 'MEDIUM'; reasons.push('目标赛道至少一个表现维度优于赛道外可比较样本。'); }
  else if (inside.median !== null || inside.breakout !== null) { status = 'MODERATE_FIT'; confidence = outsideMetrics.median === null && outsideMetrics.breakout === null ? 'LOW' : 'MEDIUM'; reasons.push('目标赛道存在模式表现，但相对优势尚未充分验证。'); }
  else if (enoughInside) { status = 'WEAK_FIT'; confidence = 'LOW'; reasons.push('目标赛道中出现该模式，但没有可比较的表现证据。'); }
  return { nicheId, pattern, status, confidence, inside: { videos: inside.adoption, creators: inside.creators, medianPerformance: inside.median, breakoutRate: inside.breakout, repeatability: inside.repeatability }, outside: { videos: outsideMetrics.adoption, creators: outsideMetrics.creators, medianPerformance: outsideMetrics.median, breakoutRate: outsideMetrics.breakout, repeatability: outsideMetrics.repeatability }, performanceAdvantage, breakoutAdvantage, reasons, blockers, context, provenance: { algorithmVersion: CONTENT_PATTERN_TREND_ALGORITHM_VERSION, source: 'PUBLIC_YOUTUBE_METADATA', window: window.key, patternId: pattern.patternId, nicheId } };
}

function selectionFor(pattern: ContentPattern, trend: PatternTrendAssessment, fit: NichePatternFit | null): PatternSelectionEvidence {
  if (!fit || fit.status === 'INSUFFICIENT' || trend.state === 'INSUFFICIENT') return { pattern, status: 'INSUFFICIENT', reasons: ['趋势或赛道适配证据不足，暂不提供后续选择依据。'], trendState: trend.state, fitStatus: fit?.status || null, confidence: trend.confidence };
  if (fit.status === 'TOP_FIT' && (trend.state === 'ACCELERATING' || trend.state === 'GROWING')) return { pattern, status: 'SELECTABLE_LATER', reasons: ['模式在目标赛道有较强适配，且趋势未显示稀释。'], trendState: trend.state, fitStatus: fit.status, confidence: fit.confidence };
  if (fit.status === 'STRONG_FIT' || trend.state === 'STABLE') return { pattern, status: 'WATCH', reasons: ['模式证据可继续观察，但尚未形成策略选择结论。'], trendState: trend.state, fitStatus: fit.status, confidence: fit.confidence };
  return { pattern, status: 'WATCH', reasons: ['模式存在证据，但趋势或赛道适配仍需验证。'], trendState: trend.state, fitStatus: fit.status, confidence: fit.confidence };
}

/** Build comparable Pattern Trend and Niche-Pattern Fit evidence. */
export function buildContentPatternTrendReport(input: { current: PatternWindowInput; previous?: PatternWindowInput; nicheId?: string | null; nicheContext?: NichePatternFit['context'] }): ContentPatternTrendReport {
  const currentReport = buildContentPatternReport({ videos: input.current.videos, capturedAt: input.current.capturedAt, snapshotId: input.current.snapshotId });
  const previousReport = input.previous ? buildContentPatternReport({ videos: input.previous.videos, capturedAt: input.previous.capturedAt, snapshotId: input.previous.snapshotId }) : null;
  const comparable = comparableWindow(input.current, input.previous);
  const patterns = new Map<string, ContentPattern>();
  for (const aggregation of currentReport.aggregations) patterns.set(aggregation.pattern.patternId, aggregation.pattern);
  for (const aggregation of previousReport?.aggregations || []) if (!patterns.has(aggregation.pattern.patternId)) patterns.set(aggregation.pattern.patternId, aggregation.pattern);
  const assessments = [...patterns.values()].map(pattern => buildAssessment(pattern, currentReport, previousReport, comparable)).sort((a, b) => a.pattern.patternId.localeCompare(b.pattern.patternId));
  const nicheFits = input.nicheId ? assessments.map(assessment => fitForPattern(assessment.pattern, input.nicheId!, input.current.videos, input.current, input.nicheContext)).filter(fit => fit.status !== 'INSUFFICIENT') : [];
  const fitById = new Map(nicheFits.map(fit => [fit.pattern.patternId, fit]));
  const selectionEvidence = assessments.map(assessment => selectionFor(assessment.pattern, assessment, fitById.get(assessment.pattern.patternId) || null));
  return { schemaVersion: 'content-pattern-trends.v1', algorithmVersion: CONTENT_PATTERN_TREND_ALGORITHM_VERSION, scope: 'LONG_FORM', timeSemantics: input.current.timeSemantics, comparableWindow: comparable, currentReport, previousReport, assessments, nicheFits, selectionEvidence, gaps: ['趋势只比较相同 Pattern ID 的可比窗口，不把当前 WINNING 状态直接当成增长。', '没有历史窗口时趋势保持 INSUFFICIENT；不会用当前频率制造趋势。', 'Niche-Pattern Fit 需要目标赛道与赛道外的 Long-form 样本；不足时不强行比较。', '本阶段只输出 Pattern Selection Evidence，不生成策略、选题或 Canvas 内容。'], provenance: { source: 'PUBLIC_YOUTUBE_METADATA', currentWindow: input.current.key, previousWindow: input.previous?.key || null, capturedAt: input.current.capturedAt || null, snapshotId: input.current.snapshotId || null, calibrationStatus: CONTENT_PATTERN_TREND_CONFIG.calibrationStatus } };
}

/** Conservative trust-boundary check for optional upstream P2 Phase 2 reports. */
export function normalizeContentPatternTrendReport(value: unknown): ContentPatternTrendReport | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.schemaVersion !== 'content-pattern-trends.v1' || raw.algorithmVersion !== CONTENT_PATTERN_TREND_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.assessments) || !raw.comparableWindow || typeof raw.comparableWindow !== 'object' || !raw.currentReport || typeof raw.currentReport !== 'object') return null;
  return raw as unknown as ContentPatternTrendReport;
}

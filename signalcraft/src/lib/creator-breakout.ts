import type { ConfidenceLevel } from './entry-decision.ts';
import { EVIDENCE_SCHEMA_VERSION, type BaselineStatus, type DataQuality, type EvidenceContract } from './evidence-contract.ts';

/**
 * P1 Phase 1 creator baseline and breakout evidence.
 *
 * This module is intentionally pure and format-specific. It consumes public
 * observations only; it does not rank opportunities or make entry decisions.
 */
export const CREATOR_BREAKOUT_ALGORITHM_VERSION = 'creator-breakout-v1';

export const CREATOR_BREAKOUT_CONFIG = Object.freeze({
  version: CREATOR_BREAKOUT_ALGORITHM_VERSION,
  minBaselineVideos: 5,
  recentWindowVideos: 20,
  maxBaselineAgeDays: 730,
  minVideoAgeDays: 1,
  minExpectedPerformance: 0,
  aboveBaselineMultiple: 1.5,
  breakoutMultiple: 3,
  strongBreakoutMultiple: 8,
  extremeBreakoutMultiple: 15,
  repeatMinEligibleVideos: 5,
  repeatMinBreakoutVideos: 2,
  highConfidenceMinVideos: 12,
  mediumConfidenceMinVideos: 8,
  highVarianceMadRatio: 0.75,
  mediumVarianceMadRatio: 0.4,
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type CreatorFormat = 'short' | 'long';
export type BreakoutClassification = 'NORMAL' | 'ABOVE_BASELINE' | 'BREAKOUT' | 'STRONG_BREAKOUT' | 'EXTREME_BREAKOUT' | 'INSUFFICIENT';
export type RepeatBreakoutStatus = 'NONE' | 'ONE_OFF' | 'REPEATED' | 'INSUFFICIENT';

export type CreatorSnapshotObservation = {
  capturedAt: string;
  views: number;
};

export type CreatorVideoObservation = {
  id: string;
  creatorId?: string | null;
  format: CreatorFormat;
  publishedAt: string;
  durationSeconds?: number | null;
  views?: number | null;
  snapshots?: readonly CreatorSnapshotObservation[];
};

export type CreatorBaseline = {
  status: BaselineStatus;
  sampleSize: number;
  performanceMetric: 'views_per_day';
  medianPerformance: number | null;
  p25: number | null;
  p75: number | null;
  mad: number | null;
  dispersionRatio: number | null;
  window: { recentVideos: number; maxAgeDays: number };
  confidence: ConfidenceLevel;
  temporalSemantics: 'RETROSPECTIVE_BASELINE';
  comparableVideoIds: string[];
  excludedVideoId?: string | null;
  evidence: EvidenceContract;
  dataQuality: DataQuality;
};

export type ExpectedPerformance = {
  value: number | null;
  metric: 'views_per_day';
  baselineStatus: BaselineStatus;
  baselineSampleSize: number;
  confidence: ConfidenceLevel;
  temporalSemantics: 'RETROSPECTIVE_BASELINE';
};

export type BreakoutAssessment = {
  videoId: string;
  format: CreatorFormat;
  actualPerformance: number | null;
  expectedPerformance: ExpectedPerformance;
  breakoutMultiple: number | null;
  classification: BreakoutClassification;
  confidence: ConfidenceLevel;
  evidence: EvidenceContract;
};

export type CreatorBreakoutSummary = {
  algorithmVersion: string;
  format: CreatorFormat;
  eligibleVideos: number;
  breakoutVideos: number;
  strongBreakoutVideos: number;
  breakoutRate: number | null;
  recentBreakoutCount: number;
  medianBreakoutMultiple: number | null;
  maxBreakoutMultiple: number | null;
  repeatBreakoutStatus: RepeatBreakoutStatus;
  assessments: BreakoutAssessment[];
  temporalSemantics: 'RETROSPECTIVE_BASELINE';
  calibrationStatus: typeof CREATOR_BREAKOUT_CONFIG.calibrationStatus;
  evidence: EvidenceContract;
};

const DAY = 86_400_000;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const validTime = (value: unknown) => typeof value === 'string' && Number.isFinite(new Date(value).getTime());
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));

function sorted(values: number[]) { return values.filter(finite).sort((a, b) => a - b); }
function median(values: number[]) {
  const list = sorted(values);
  if (!list.length) return null;
  const middle = Math.floor(list.length / 2);
  return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2;
}
function percentile(values: number[], p: number) {
  const list = sorted(values);
  if (!list.length) return null;
  const index = (list.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return list[lower] + (list[upper] - list[lower]) * (index - lower);
}
function mad(values: number[]) {
  const center = median(values);
  return center === null ? null : median(values.map(value => Math.abs(value - center)));
}

function latestObservation(video: CreatorVideoObservation, now: Date) {
  const snapshots = (video.snapshots || [])
    .filter(snapshot => validTime(snapshot.capturedAt) && finite(snapshot.views) && snapshot.views >= 0)
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());
  const snapshot = snapshots.at(-1);
  const views = snapshot ? snapshot.views : video.views;
  const capturedAt = snapshot?.capturedAt || now.toISOString();
  if (!finite(views) || views < 0 || !validTime(video.publishedAt) || !validTime(capturedAt)) return null;
  const ageDays = (new Date(capturedAt).getTime() - new Date(video.publishedAt).getTime()) / DAY;
  if (!Number.isFinite(ageDays) || ageDays < CREATOR_BREAKOUT_CONFIG.minVideoAgeDays) return null;
  return { views, capturedAt, ageDays, viewsPerDay: views / ageDays };
}

function uniqueVideos(videos: readonly CreatorVideoObservation[]) {
  const byId = new Map<string, CreatorVideoObservation>();
  for (const video of videos) {
    if (!video || typeof video.id !== 'string' || !video.id.trim() || byId.has(video.id)) continue;
    byId.set(video.id, video);
  }
  return [...byId.values()];
}

function qualityFor(sampleSize: number, dispersionRatio: number | null): ConfidenceLevel {
  if (sampleSize < CREATOR_BREAKOUT_CONFIG.minBaselineVideos) return 'INSUFFICIENT';
  if (dispersionRatio !== null && dispersionRatio >= CREATOR_BREAKOUT_CONFIG.highVarianceMadRatio) return 'LOW';
  if (sampleSize >= CREATOR_BREAKOUT_CONFIG.highConfidenceMinVideos && (dispersionRatio === null || dispersionRatio < CREATOR_BREAKOUT_CONFIG.mediumVarianceMadRatio)) return 'HIGH';
  if (sampleSize >= CREATOR_BREAKOUT_CONFIG.mediumConfidenceMinVideos) return 'MEDIUM';
  return 'LOW';
}

function evidenceFor(input: { capturedAt: string; facts: string[]; missing?: string[]; confidence?: ConfidenceLevel }): EvidenceContract {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    algorithmVersion: CREATOR_BREAKOUT_ALGORITHM_VERSION,
    capturedAt: input.capturedAt,
    source: 'public-youtube-creator-breakout',
    facts: input.facts.map(statement => ({ statement, type: 'FACT' as const, source: 'youtube-public-metadata' })),
    inferences: input.confidence && input.confidence !== 'HIGH' ? [{ statement: '该结果为回顾性年龄校正基线，不代表发布时的实时预测。', type: 'LOW_CONFIDENCE' as const, source: CREATOR_BREAKOUT_ALGORITHM_VERSION }] : [],
    missing: input.missing || [],
    decisionReasons: [],
  };
}

function qualityData(sampleVideos: number, confidence: ConfidenceLevel, capturedAt: string, missingFields: string[] = []): DataQuality {
  const level = confidence === 'HIGH' ? 'HIGH' : confidence === 'MEDIUM' ? 'MEDIUM' : confidence === 'LOW' ? 'LOW' : 'INSUFFICIENT';
  return { schemaVersion: 'data-quality.v1', level, sampleVideos, sampleChannels: 1, capturedAt, completeness: Math.round(clamp(sampleVideos / CREATOR_BREAKOUT_CONFIG.minBaselineVideos, 0, 1) * 100), missingFields, source: 'public-youtube-creator-breakout' };
}

function comparableVideos(allVideos: readonly CreatorVideoObservation[], target: CreatorVideoObservation, now: Date, allowLookAhead = false) {
  const targetTime = new Date(target.publishedAt).getTime();
  return uniqueVideos(allVideos)
    .filter(video => video.id !== target.id && video.format === target.format)
    .filter(video => !target.creatorId || !video.creatorId || video.creatorId === target.creatorId)
    .filter(video => allowLookAhead || (validTime(video.publishedAt) && new Date(video.publishedAt).getTime() <= targetTime))
    .map(video => ({ video, observation: latestObservation(video, now) }))
    .filter((item): item is { video: CreatorVideoObservation; observation: NonNullable<ReturnType<typeof latestObservation>> } => Boolean(item.observation))
    .filter(item => item.observation.ageDays <= CREATOR_BREAKOUT_CONFIG.maxBaselineAgeDays)
    .sort((a, b) => new Date(b.video.publishedAt).getTime() - new Date(a.video.publishedAt).getTime())
    .slice(0, CREATOR_BREAKOUT_CONFIG.recentWindowVideos);
}

export function buildCreatorBaseline(input: { videos: readonly CreatorVideoObservation[]; target: CreatorVideoObservation; now?: Date; allowLookAhead?: boolean }): CreatorBaseline {
  const now = input.now || new Date();
  const comparable = comparableVideos(input.videos, input.target, now, input.allowLookAhead === true);
  const values = comparable.map(item => item.observation.viewsPerDay);
  const center = median(values);
  const spread = mad(values);
  const dispersionRatio = center && center > 0 && spread !== null ? spread / center : null;
  const confidence = qualityFor(values.length, dispersionRatio);
  const status: BaselineStatus = values.length >= CREATOR_BREAKOUT_CONFIG.minBaselineVideos && center !== null && center > CREATOR_BREAKOUT_CONFIG.minExpectedPerformance ? 'VERIFIED' : 'INSUFFICIENT';
  const usable = status === 'VERIFIED';
  const capturedAt = now.toISOString();
  const missing = values.length < CREATOR_BREAKOUT_CONFIG.minBaselineVideos ? ['creator_history'] : [];
  return {
    status,
    sampleSize: values.length,
    performanceMetric: 'views_per_day',
    medianPerformance: usable && center !== null ? round(center) : null,
    p25: usable && percentile(values, .25) !== null ? round(percentile(values, .25)!) : null,
    p75: usable && percentile(values, .75) !== null ? round(percentile(values, .75)!) : null,
    mad: usable && spread !== null ? round(spread) : null,
    dispersionRatio: usable && dispersionRatio !== null ? round(dispersionRatio) : null,
    window: { recentVideos: CREATOR_BREAKOUT_CONFIG.recentWindowVideos, maxAgeDays: CREATOR_BREAKOUT_CONFIG.maxBaselineAgeDays },
    confidence: values.length >= CREATOR_BREAKOUT_CONFIG.minBaselineVideos ? confidence : 'INSUFFICIENT',
    temporalSemantics: 'RETROSPECTIVE_BASELINE',
    comparableVideoIds: comparable.map(item => item.video.id),
    excludedVideoId: input.target.id,
    evidence: evidenceFor({ capturedAt, confidence: values.length >= CREATOR_BREAKOUT_CONFIG.minBaselineVideos ? confidence : 'INSUFFICIENT', facts: [`使用 ${values.length} 条同一创作者、同一内容形态的历史公开视频计算年龄校正中位数。`, `目标视频 ${input.target.id} 未纳入自身基线。`], missing }),
    dataQuality: qualityData(values.length, values.length >= CREATOR_BREAKOUT_CONFIG.minBaselineVideos ? confidence : 'INSUFFICIENT', capturedAt, missing),
  };
}

function actualPerformance(video: CreatorVideoObservation, now: Date) {
  return latestObservation(video, now)?.viewsPerDay ?? null;
}

function classify(multiple: number | null, baseline: CreatorBaseline): BreakoutClassification {
  if (multiple === null || baseline.status !== 'VERIFIED' || baseline.confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (multiple >= CREATOR_BREAKOUT_CONFIG.extremeBreakoutMultiple) return 'EXTREME_BREAKOUT';
  if (multiple >= CREATOR_BREAKOUT_CONFIG.strongBreakoutMultiple) return 'STRONG_BREAKOUT';
  if (multiple >= CREATOR_BREAKOUT_CONFIG.breakoutMultiple) return 'BREAKOUT';
  if (multiple >= CREATOR_BREAKOUT_CONFIG.aboveBaselineMultiple) return 'ABOVE_BASELINE';
  return 'NORMAL';
}

export function assessCreatorBreakout(input: { videos: readonly CreatorVideoObservation[]; target: CreatorVideoObservation; now?: Date; allowLookAhead?: boolean }): BreakoutAssessment {
  const now = input.now || new Date();
  const baseline = buildCreatorBaseline({ ...input, now });
  const actual = actualPerformance(input.target, now);
  const expected: ExpectedPerformance = { value: baseline.medianPerformance, metric: 'views_per_day', baselineStatus: baseline.status, baselineSampleSize: baseline.sampleSize, confidence: baseline.confidence, temporalSemantics: 'RETROSPECTIVE_BASELINE' };
  const multiple = actual !== null && expected.value !== null && expected.value > CREATOR_BREAKOUT_CONFIG.minExpectedPerformance ? actual / expected.value : null;
  const roundedMultiple = multiple === null ? null : (multiple >= 10 ? Math.round(multiple) : round(multiple, 1));
  const classification = classify(multiple, baseline);
  const capturedAt = now.toISOString();
  return {
    videoId: input.target.id,
    format: input.target.format,
    actualPerformance: actual === null ? null : round(actual),
    expectedPerformance: expected,
    breakoutMultiple: roundedMultiple,
    classification,
    confidence: classification === 'INSUFFICIENT' ? 'INSUFFICIENT' : baseline.confidence,
    evidence: evidenceFor({ capturedAt, confidence: classification === 'INSUFFICIENT' ? 'INSUFFICIENT' : baseline.confidence, facts: [actual === null ? '目标视频缺少可验证播放数据。' : `目标视频年龄校正播放为 ${round(actual)} / 日。`, expected.value === null ? '没有可用的创作者历史基线，未计算倍数。' : `预期表现来自 ${baseline.sampleSize} 条同形态历史视频的中位数：${round(expected.value)} / 日。`, roundedMultiple === null ? '未生成爆款倍数。' : `实际 / 预期 = ${roundedMultiple}×；分类为 ${classification}。`], missing: actual === null ? ['target_views_or_publish_time'] : [] }),
  };
}

export function buildCreatorBreakoutSummary(input: { videos: readonly CreatorVideoObservation[]; format: CreatorFormat; now?: Date; creatorId?: string | null }): CreatorBreakoutSummary {
  const now = input.now || new Date();
  const videos = uniqueVideos(input.videos)
    .filter(video => video.format === input.format && (!input.creatorId || !video.creatorId || video.creatorId === input.creatorId))
    .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  // A creator summary is explicitly retrospective: to estimate repeatability
  // from the current public corpus, each video's baseline may include later
  // videos, but the result is never presented as a real-time forecast.
  const assessments = videos.map(target => assessCreatorBreakout({ videos, target, now, allowLookAhead: true }));
  const eligible = assessments.filter(item => item.classification !== 'INSUFFICIENT' && item.breakoutMultiple !== null);
  const breakout = eligible.filter(item => ['BREAKOUT', 'STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(item.classification));
  const strong = eligible.filter(item => ['STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(item.classification));
  const recent = eligible.slice(-CREATOR_BREAKOUT_CONFIG.recentWindowVideos);
  const multiples = breakout.map(item => item.breakoutMultiple!).filter(finite);
  const repeatBreakoutStatus: RepeatBreakoutStatus = eligible.length < CREATOR_BREAKOUT_CONFIG.repeatMinEligibleVideos
    ? 'INSUFFICIENT'
    : breakout.length >= CREATOR_BREAKOUT_CONFIG.repeatMinBreakoutVideos ? 'REPEATED' : breakout.length === 1 ? 'ONE_OFF' : 'NONE';
  const capturedAt = now.toISOString();
  return {
    algorithmVersion: CREATOR_BREAKOUT_ALGORITHM_VERSION,
    format: input.format,
    eligibleVideos: eligible.length,
    breakoutVideos: breakout.length,
    strongBreakoutVideos: strong.length,
    breakoutRate: eligible.length ? round(breakout.length / eligible.length, 3) : null,
    recentBreakoutCount: recent.filter(item => ['BREAKOUT', 'STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(item.classification)).length,
    medianBreakoutMultiple: multiples.length ? round(median(multiples)!, 1) : null,
    maxBreakoutMultiple: multiples.length ? round(Math.max(...multiples), 1) : null,
    repeatBreakoutStatus,
    assessments,
    temporalSemantics: 'RETROSPECTIVE_BASELINE',
    calibrationStatus: CREATOR_BREAKOUT_CONFIG.calibrationStatus,
    evidence: evidenceFor({ capturedAt, confidence: eligible.length >= CREATOR_BREAKOUT_CONFIG.repeatMinEligibleVideos ? 'MEDIUM' : 'INSUFFICIENT', facts: [`同一创作者 ${input.format === 'long' ? 'Long-form' : 'Shorts'} 仅使用 ${videos.length} 条去重公开视频。`, `可计算基线的视频 ${eligible.length} 条；达到爆款阈值的视频 ${breakout.length} 条。`], missing: eligible.length < CREATOR_BREAKOUT_CONFIG.repeatMinEligibleVideos ? ['repeat_breakout_history'] : [] }),
  };
}

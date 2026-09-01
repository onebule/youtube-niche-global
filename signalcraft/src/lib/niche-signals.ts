import type { ConfidenceLevel } from './entry-decision.ts';
import { normalizeDataQuality, normalizeEvidence, type DataQuality, type EvidenceContract } from './evidence-contract.ts';
import { EVIDENCE_SCHEMA_VERSION } from './evidence-contract.ts';
import type { BreakoutClassification, RepeatBreakoutStatus } from './creator-breakout.ts';

/**
 * P1 Phase 2 is an evidence aggregation layer. It never creates an
 * OpportunityScore or writes an EntryDecision.
 */
export const NICHE_SIGNAL_ALGORITHM_VERSION = 'niche-signals-v1';

export const NICHE_SIGNAL_CONFIG = Object.freeze({
  version: NICHE_SIGNAL_ALGORITHM_VERSION,
  temporalWindow: 'current-public-corpus',
  minEligibleVideos: 5,
  minEligibleCreators: 3,
  minCrossCreatorBreakoutCreators: 3,
  minSmallCreatorEligibleCreators: 3,
  minSmallCreatorBreakoutCreators: 2,
  minRepeatedBreakoutCreators: 2,
  smallCreatorMaxSubscribers: 100_000,
  highBreakoutDensity: 0.3,
  moderateBreakoutDensity: 0.15,
  highTop3ViewShare: 0.7,
  lowTop3ViewShare: 0.45,
  highConfidenceMinVideos: 20,
  highConfidenceMinCreators: 8,
  minimumKnownSubscriberCoverage: 0.6,
  calibrationStatus: 'CALIBRATION_REQUIRED',
} as const);

export type NicheSignalType = 'SMALL_CREATOR_BREAKOUT' | 'CROSS_CREATOR_BREAKOUT' | 'REPEATED_BREAKOUT' | 'BREAKOUT_DENSITY_HIGH' | 'CREATOR_CONCENTRATION_HIGH' | 'CREATOR_CONCENTRATION_LOW';
export type SignalStrength = 'INSUFFICIENT' | 'WEAK' | 'MODERATE' | 'STRONG';
export type CrossCreatorRepeatStatus = 'INSUFFICIENT' | 'ONE_OFF_CROSS_CREATOR' | 'REPEATED_CROSS_CREATOR';
export type CreatorConcentrationLevel = 'INSUFFICIENT' | 'LOW' | 'MIXED' | 'HIGH';

export type NicheBreakoutObservation = {
  nicheId: string;
  videoId: string;
  creatorId: string;
  format: 'long';
  views?: number | null;
  subscriberCount?: number | null;
  baselineStatus: 'VERIFIED' | 'INSUFFICIENT' | 'UNAVAILABLE';
  baselineConfidence: ConfidenceLevel;
  breakoutClassification: BreakoutClassification;
  breakoutMultiple: number | null;
  repeatBreakoutStatus?: RepeatBreakoutStatus;
};

export type NicheSignal = {
  type: NicheSignalType;
  strength: SignalStrength;
  confidence: ConfidenceLevel;
  evidence: { eligibleVideos: number; eligibleCreators: number; breakoutVideos: number; breakoutCreators: number; knownSubscriberCoverage: number | null };
  reasons: string[];
  blockers: string[];
  algorithmVersion: string;
};

export type CreatorConcentrationAssessment = {
  scope: 'eligible_video_views_by_creator';
  totalEligibleViews: number | null;
  top1Share: number | null;
  top3Share: number | null;
  level: CreatorConcentrationLevel;
  uniqueCreators: number;
};

export type NicheBreakoutSummary = {
  algorithmVersion: string;
  nicheId: string;
  format: 'long';
  temporalWindow: typeof NICHE_SIGNAL_CONFIG.temporalWindow;
  eligibleVideos: number;
  eligibleCreators: number;
  breakoutVideos: number;
  breakoutCreators: number;
  strongBreakoutVideos: number;
  strongBreakoutCreators: number;
  breakoutDensity: number | null;
  strongBreakoutDensity: number | null;
  knownCreatorSizeCount: number;
  unknownCreatorSizeCount: number;
  eligibleSmallCreators: number;
  smallBreakoutCreators: number;
  smallCreatorBreakoutRate: number | null;
  repeatedBreakoutCreators: number;
  crossCreatorRepeatStatus: CrossCreatorRepeatStatus;
  concentration: CreatorConcentrationAssessment;
  signals: NicheSignal[];
  confidence: ConfidenceLevel;
  dataQuality: DataQuality;
  evidence: EvidenceContract;
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 3) => Number(value.toFixed(digits));
const evidenceBreakout = (classification: BreakoutClassification) => ['BREAKOUT', 'STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(classification);
const strongBreakout = (classification: BreakoutClassification) => ['STRONG_BREAKOUT', 'EXTREME_BREAKOUT'].includes(classification);

function uniqueObservations(observations: readonly NicheBreakoutObservation[], nicheId: string) {
  const byVideo = new Map<string, NicheBreakoutObservation>();
  for (const observation of observations) {
    if (!observation || observation.nicheId !== nicheId || observation.format !== 'long' || !observation.videoId || !observation.creatorId || byVideo.has(observation.videoId)) continue;
    byVideo.set(observation.videoId, observation);
  }
  return [...byVideo.values()];
}

function eligible(observations: readonly NicheBreakoutObservation[]) {
  return observations.filter(item => item.baselineStatus === 'VERIFIED' && item.baselineConfidence !== 'INSUFFICIENT' && item.breakoutClassification !== 'INSUFFICIENT' && finite(item.breakoutMultiple) && item.breakoutMultiple! >= 0);
}

function confidenceFor(input: { videos: number; creators: number; lowConfidence: number; knownSubscriberCoverage: number | null }): ConfidenceLevel {
  if (input.videos < NICHE_SIGNAL_CONFIG.minEligibleVideos || input.creators < NICHE_SIGNAL_CONFIG.minEligibleCreators) return 'INSUFFICIENT';
  if (input.lowConfidence / Math.max(1, input.videos) >= 0.5) return 'LOW';
  if (input.videos >= NICHE_SIGNAL_CONFIG.highConfidenceMinVideos && input.creators >= NICHE_SIGNAL_CONFIG.highConfidenceMinCreators && (input.knownSubscriberCoverage === null || input.knownSubscriberCoverage >= NICHE_SIGNAL_CONFIG.minimumKnownSubscriberCoverage)) return 'HIGH';
  return 'MEDIUM';
}

function capStrength(strength: SignalStrength, confidence: ConfidenceLevel): SignalStrength {
  if (confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (confidence === 'LOW' && strength === 'STRONG') return 'MODERATE';
  return strength;
}

function signal(input: { type: NicheSignalType; strength: SignalStrength; confidence: ConfidenceLevel; eligibleVideos: number; eligibleCreators: number; breakoutVideos: number; breakoutCreators: number; knownSubscriberCoverage: number | null; reasons: string[]; blockers?: string[] }): NicheSignal {
  return { type: input.type, strength: capStrength(input.strength, input.confidence), confidence: input.confidence, evidence: { eligibleVideos: input.eligibleVideos, eligibleCreators: input.eligibleCreators, breakoutVideos: input.breakoutVideos, breakoutCreators: input.breakoutCreators, knownSubscriberCoverage: input.knownSubscriberCoverage }, reasons: input.reasons, blockers: input.blockers || [], algorithmVersion: NICHE_SIGNAL_ALGORITHM_VERSION };
}

function concentrationFor(items: readonly NicheBreakoutObservation[], creatorCount: number): CreatorConcentrationAssessment {
  const byCreator = new Map<string, number>();
  items.forEach(item => { if (finite(item.views) && item.views! >= 0) byCreator.set(item.creatorId, (byCreator.get(item.creatorId) || 0) + item.views!); });
  const values = [...byCreator.values()].sort((a, b) => b - a);
  const total = values.reduce((sum, value) => sum + value, 0);
  const top1Share = total > 0 && values.length ? values[0] / total : null;
  const top3Share = total > 0 && values.length ? values.slice(0, 3).reduce((sum, value) => sum + value, 0) / total : null;
  const level: CreatorConcentrationLevel = creatorCount < NICHE_SIGNAL_CONFIG.minEligibleCreators || top3Share === null ? 'INSUFFICIENT' : top3Share >= NICHE_SIGNAL_CONFIG.highTop3ViewShare ? 'HIGH' : top3Share <= NICHE_SIGNAL_CONFIG.lowTop3ViewShare ? 'LOW' : 'MIXED';
  return { scope: 'eligible_video_views_by_creator', totalEligibleViews: total > 0 ? total : null, top1Share: top1Share === null ? null : round(top1Share), top3Share: top3Share === null ? null : round(top3Share), level, uniqueCreators: byCreator.size };
}

function qualityData(input: { eligibleVideos: number; eligibleCreators: number; confidence: ConfidenceLevel; knownCoverage: number | null }): DataQuality {
  const level = input.confidence === 'HIGH' ? 'HIGH' : input.confidence === 'MEDIUM' ? 'MEDIUM' : input.confidence === 'LOW' ? 'LOW' : 'INSUFFICIENT';
  return { schemaVersion: 'data-quality.v1', level, sampleVideos: input.eligibleVideos, sampleChannels: input.eligibleCreators, completeness: input.eligibleVideos ? Math.round(clamp(input.eligibleVideos / NICHE_SIGNAL_CONFIG.minEligibleVideos, 0, 1) * 100) : 0, classificationConfidence: input.knownCoverage === null ? null : round(input.knownCoverage * 100), missingFields: input.eligibleVideos < NICHE_SIGNAL_CONFIG.minEligibleVideos || input.eligibleCreators < NICHE_SIGNAL_CONFIG.minEligibleCreators ? ['niche_breakout_history'] : [], source: 'public-youtube-niche-signals' };
}

function evidenceFor(input: { nicheId: string; eligibleVideos: number; eligibleCreators: number; breakoutCreators: number; knownCoverage: number | null }): EvidenceContract {
  const missing = input.eligibleVideos < NICHE_SIGNAL_CONFIG.minEligibleVideos || input.eligibleCreators < NICHE_SIGNAL_CONFIG.minEligibleCreators ? ['niche_breakout_history'] : [];
  if (input.knownCoverage !== null && input.knownCoverage < NICHE_SIGNAL_CONFIG.minimumKnownSubscriberCoverage) missing.push('subscriber_coverage');
  return { schemaVersion: EVIDENCE_SCHEMA_VERSION, algorithmVersion: NICHE_SIGNAL_ALGORITHM_VERSION, source: 'public-youtube-niche-signals', facts: [{ statement: `赛道 ${input.nicheId} 使用 ${input.eligibleVideos} 条可比较 Long-form 视频和 ${input.eligibleCreators} 个独立创作者。`, type: 'FACT', source: 'creator-breakout-v1' }, { statement: `${input.breakoutCreators} 个独立创作者产生了至少一条爆款视频。`, type: 'FACT', source: 'creator-breakout-v1' }], inferences: [{ statement: '该赛道聚合为回顾性公开数据证据，不代表实时机会预测。', type: 'LOW_CONFIDENCE', source: NICHE_SIGNAL_ALGORITHM_VERSION }], missing, decisionReasons: [] };
}

export function buildNicheBreakoutSummary(input: { nicheId: string; observations: readonly NicheBreakoutObservation[] }): NicheBreakoutSummary {
  const all = uniqueObservations(input.observations, input.nicheId);
  const items = eligible(all);
  const creators = new Set(items.map(item => item.creatorId));
  const breakoutItems = items.filter(item => evidenceBreakout(item.breakoutClassification));
  const breakoutCreators = new Set(breakoutItems.map(item => item.creatorId));
  const strongItems = items.filter(item => strongBreakout(item.breakoutClassification));
  const strongCreators = new Set(strongItems.map(item => item.creatorId));
  const knownSizeItems = items.filter(item => finite(item.subscriberCount) && item.subscriberCount! >= 0);
  const smallItems = knownSizeItems.filter(item => item.subscriberCount! < NICHE_SIGNAL_CONFIG.smallCreatorMaxSubscribers);
  const smallCreators = new Set(smallItems.map(item => item.creatorId));
  const smallBreakoutCreators = new Set(smallItems.filter(item => evidenceBreakout(item.breakoutClassification)).map(item => item.creatorId));
  const repeatedCreators = new Set(items.filter(item => item.repeatBreakoutStatus === 'REPEATED').map(item => item.creatorId));
  const knownCreatorIds = new Set(knownSizeItems.map(item => item.creatorId));
  const knownCoverage = creators.size ? knownCreatorIds.size / creators.size : null;
  const confidence = confidenceFor({ videos: items.length, creators: creators.size, lowConfidence: items.filter(item => item.baselineConfidence === 'LOW').length, knownSubscriberCoverage: knownCoverage });
  const concentration = concentrationFor(items, creators.size);
  const breakoutDensity = items.length ? round(breakoutItems.length / items.length) : null;
  const strongBreakoutDensity = items.length ? round(strongItems.length / items.length) : null;
  const crossStrength: SignalStrength = creators.size < NICHE_SIGNAL_CONFIG.minCrossCreatorBreakoutCreators ? 'INSUFFICIENT' : breakoutCreators.size >= 5 ? 'STRONG' : breakoutCreators.size >= NICHE_SIGNAL_CONFIG.minCrossCreatorBreakoutCreators ? 'MODERATE' : 'WEAK';
  const smallStrength: SignalStrength = smallCreators.size < NICHE_SIGNAL_CONFIG.minSmallCreatorEligibleCreators ? 'INSUFFICIENT' : smallBreakoutCreators.size >= 4 ? 'STRONG' : smallBreakoutCreators.size >= NICHE_SIGNAL_CONFIG.minSmallCreatorBreakoutCreators ? 'MODERATE' : 'WEAK';
  const signals: NicheSignal[] = [
    signal({ type: 'CROSS_CREATOR_BREAKOUT', strength: crossStrength, confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`${breakoutCreators.size} 个独立创作者出现爆款证据。`], blockers: creators.size < NICHE_SIGNAL_CONFIG.minCrossCreatorBreakoutCreators ? ['独立创作者数量低于门槛。'] : [] }),
    signal({ type: 'SMALL_CREATOR_BREAKOUT', strength: smallStrength, confidence: knownCoverage !== null && knownCoverage < NICHE_SIGNAL_CONFIG.minimumKnownSubscriberCoverage ? 'LOW' : confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: smallItems.filter(item => evidenceBreakout(item.breakoutClassification)).length, breakoutCreators: smallBreakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`${smallBreakoutCreators.size} 个独立小创作者出现爆款证据；小创作者定义为订阅数 < ${NICHE_SIGNAL_CONFIG.smallCreatorMaxSubscribers.toLocaleString()}。`], blockers: knownCoverage !== null && knownCoverage < NICHE_SIGNAL_CONFIG.minimumKnownSubscriberCoverage ? ['订阅数覆盖率不足，无法稳定判断小创作者比例。'] : smallCreators.size < NICHE_SIGNAL_CONFIG.minSmallCreatorEligibleCreators ? ['可比较小创作者数量不足。'] : [] }),
    signal({ type: 'REPEATED_BREAKOUT', strength: repeatedCreators.size >= NICHE_SIGNAL_CONFIG.minRepeatedBreakoutCreators && breakoutCreators.size >= NICHE_SIGNAL_CONFIG.minCrossCreatorBreakoutCreators ? 'STRONG' : repeatedCreators.size ? 'MODERATE' : 'INSUFFICIENT', confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`${repeatedCreators.size} 个创作者具备 Phase 1 REPEATED 证据。`], blockers: repeatedCreators.size < NICHE_SIGNAL_CONFIG.minRepeatedBreakoutCreators ? ['重复爆款创作者未达到门槛。'] : [] }),
    signal({ type: 'BREAKOUT_DENSITY_HIGH', strength: items.length < NICHE_SIGNAL_CONFIG.minEligibleVideos ? 'INSUFFICIENT' : breakoutDensity !== null && breakoutDensity >= NICHE_SIGNAL_CONFIG.highBreakoutDensity ? 'STRONG' : breakoutDensity !== null && breakoutDensity >= NICHE_SIGNAL_CONFIG.moderateBreakoutDensity ? 'MODERATE' : 'WEAK', confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`爆款密度 = ${breakoutDensity === null ? '—' : `${round(breakoutDensity * 100)}%`}，分母为有有效创作者基线的可比较视频。`], blockers: [] }),
  ];
  if (concentration.level === 'HIGH') signals.push(signal({ type: 'CREATOR_CONCENTRATION_HIGH', strength: 'MODERATE', confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`Top 3 创作者占可比较视频播放 ${(concentration.top3Share! * 100).toFixed(1)}%。`], blockers: [] }));
  if (concentration.level === 'LOW') signals.push(signal({ type: 'CREATOR_CONCENTRATION_LOW', strength: 'MODERATE', confidence, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, knownSubscriberCoverage: knownCoverage, reasons: [`Top 3 创作者占可比较视频播放 ${(concentration.top3Share! * 100).toFixed(1)}%，表现更分散。`], blockers: [] }));
  return { algorithmVersion: NICHE_SIGNAL_ALGORITHM_VERSION, nicheId: input.nicheId, format: 'long', temporalWindow: NICHE_SIGNAL_CONFIG.temporalWindow, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutVideos: breakoutItems.length, breakoutCreators: breakoutCreators.size, strongBreakoutVideos: strongItems.length, strongBreakoutCreators: strongCreators.size, breakoutDensity, strongBreakoutDensity, knownCreatorSizeCount: knownCreatorIds.size, unknownCreatorSizeCount: Math.max(0, creators.size - knownCreatorIds.size), eligibleSmallCreators: smallCreators.size, smallBreakoutCreators: smallBreakoutCreators.size, smallCreatorBreakoutRate: smallCreators.size ? round(smallBreakoutCreators.size / smallCreators.size) : null, repeatedBreakoutCreators: repeatedCreators.size, crossCreatorRepeatStatus: creators.size < NICHE_SIGNAL_CONFIG.minCrossCreatorBreakoutCreators || breakoutCreators.size === 0 ? 'INSUFFICIENT' : repeatedCreators.size >= NICHE_SIGNAL_CONFIG.minRepeatedBreakoutCreators ? 'REPEATED_CROSS_CREATOR' : 'ONE_OFF_CROSS_CREATOR', concentration, signals, confidence, dataQuality: qualityData({ eligibleVideos: items.length, eligibleCreators: creators.size, confidence, knownCoverage }), evidence: evidenceFor({ nicheId: input.nicheId, eligibleVideos: items.length, eligibleCreators: creators.size, breakoutCreators: breakoutCreators.size, knownCoverage }) };
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const confidenceValues = new Set<ConfidenceLevel>(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']);
const signalTypeValues = new Set<NicheSignalType>(['SMALL_CREATOR_BREAKOUT', 'CROSS_CREATOR_BREAKOUT', 'REPEATED_BREAKOUT', 'BREAKOUT_DENSITY_HIGH', 'CREATOR_CONCENTRATION_HIGH', 'CREATOR_CONCENTRATION_LOW']);
const strengthValues = new Set<SignalStrength>(['INSUFFICIENT', 'WEAK', 'MODERATE', 'STRONG']);

function normalizedSignal(value: unknown): NicheSignal | null {
  if (!isRecord(value) || !signalTypeValues.has(value.type as NicheSignalType) || !strengthValues.has(value.strength as SignalStrength) || !confidenceValues.has(value.confidence as ConfidenceLevel)) return null;
  const rawEvidence = isRecord(value.evidence) ? value.evidence : {};
  return {
    type: value.type as NicheSignalType,
    strength: value.strength as SignalStrength,
    confidence: value.confidence as ConfidenceLevel,
    evidence: { eligibleVideos: Math.max(0, Math.round(number(rawEvidence.eligibleVideos) || 0)), eligibleCreators: Math.max(0, Math.round(number(rawEvidence.eligibleCreators) || 0)), breakoutVideos: Math.max(0, Math.round(number(rawEvidence.breakoutVideos) || 0)), breakoutCreators: Math.max(0, Math.round(number(rawEvidence.breakoutCreators) || 0)), knownSubscriberCoverage: number(rawEvidence.knownSubscriberCoverage) },
    reasons: Array.isArray(value.reasons) ? value.reasons.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    blockers: Array.isArray(value.blockers) ? value.blockers.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [],
    algorithmVersion: text(value.algorithmVersion) || NICHE_SIGNAL_ALGORITHM_VERSION,
  };
}

/** Normalize optional upstream niche evidence without inventing missing signals. */
export function normalizeNicheBreakoutSummary(value: unknown): NicheBreakoutSummary | null {
  if (!isRecord(value) || text(value.nicheId) === null || value.format !== 'long') return null;
  const rawConcentration = isRecord(value.concentration) ? value.concentration : {};
  const level = rawConcentration.level === 'HIGH' || rawConcentration.level === 'LOW' || rawConcentration.level === 'MIXED' || rawConcentration.level === 'INSUFFICIENT' ? rawConcentration.level : 'INSUFFICIENT';
  const rawConfidence = confidenceValues.has(value.confidence as ConfidenceLevel) ? value.confidence as ConfidenceLevel : 'INSUFFICIENT';
  const eligibleVideos = Math.max(0, Math.round(number(value.eligibleVideos) || 0));
  const eligibleCreators = Math.max(0, Math.round(number(value.eligibleCreators) || 0));
  const evidence = normalizeEvidence(value.evidence, { schemaVersion: EVIDENCE_SCHEMA_VERSION, algorithmVersion: text(value.algorithmVersion) || NICHE_SIGNAL_ALGORITHM_VERSION, source: 'public-youtube-niche-signals' });
  const dataQuality = normalizeDataQuality(value.dataQuality, { schemaVersion: 'data-quality.v1', level: rawConfidence, sampleVideos: eligibleVideos, sampleChannels: eligibleCreators, source: 'public-youtube-niche-signals' });
  return {
    algorithmVersion: text(value.algorithmVersion) || NICHE_SIGNAL_ALGORITHM_VERSION,
    nicheId: text(value.nicheId)!, format: 'long', temporalWindow: NICHE_SIGNAL_CONFIG.temporalWindow,
    eligibleVideos, eligibleCreators, breakoutVideos: Math.max(0, Math.round(number(value.breakoutVideos) || 0)), breakoutCreators: Math.max(0, Math.round(number(value.breakoutCreators) || 0)), strongBreakoutVideos: Math.max(0, Math.round(number(value.strongBreakoutVideos) || 0)), strongBreakoutCreators: Math.max(0, Math.round(number(value.strongBreakoutCreators) || 0)), breakoutDensity: number(value.breakoutDensity), strongBreakoutDensity: number(value.strongBreakoutDensity), knownCreatorSizeCount: Math.max(0, Math.round(number(value.knownCreatorSizeCount) || 0)), unknownCreatorSizeCount: Math.max(0, Math.round(number(value.unknownCreatorSizeCount) || 0)), eligibleSmallCreators: Math.max(0, Math.round(number(value.eligibleSmallCreators) || 0)), smallBreakoutCreators: Math.max(0, Math.round(number(value.smallBreakoutCreators) || 0)), smallCreatorBreakoutRate: number(value.smallCreatorBreakoutRate), repeatedBreakoutCreators: Math.max(0, Math.round(number(value.repeatedBreakoutCreators) || 0)),
    crossCreatorRepeatStatus: value.crossCreatorRepeatStatus === 'REPEATED_CROSS_CREATOR' || value.crossCreatorRepeatStatus === 'ONE_OFF_CROSS_CREATOR' ? value.crossCreatorRepeatStatus : 'INSUFFICIENT',
    concentration: { scope: 'eligible_video_views_by_creator', totalEligibleViews: number(rawConcentration.totalEligibleViews), top1Share: number(rawConcentration.top1Share), top3Share: number(rawConcentration.top3Share), level, uniqueCreators: Math.max(0, Math.round(number(rawConcentration.uniqueCreators) || eligibleCreators)) },
    signals: Array.isArray(value.signals) ? value.signals.map(normalizedSignal).filter((item): item is NicheSignal => Boolean(item)) : [],
    confidence: rawConfidence, dataQuality, evidence,
  };
}

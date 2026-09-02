/**
 * P2 Phase 4 — Long-form experiment and validation intelligence.
 *
 * This module evaluates real observations against a strategy snapshot. It
 * never rewrites Opportunity, Pattern or Strategy truth and it does not run
 * for Shorts. A missing observation remains INSUFFICIENT, not a failure.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { ContentStrategy, StrategyPatternRole, StrategyPatternSelection } from './content-strategy.ts';
import type { DataQuality } from './evidence-contract.ts';

export const EXPERIMENT_VALIDATION_ALGORITHM_VERSION = 'experiment-validation-v1';

/** All Phase 4 gates are provisional until calibrated with production tests. */
export const EXPERIMENT_VALIDATION_CONFIG = Object.freeze({
  minObservationAgeDays: 7,
  expectedNormalizedPerformance: 1.1,
  aboveExpectationMargin: 0.1,
  minPatternValidationVideos: 3,
  minPatternValidationCreators: 2,
  minAdequatePatternVideos: 5,
  minAdequatePatternCreators: 3,
  minStrongPatternVideos: 10,
  minStrongPatternCreators: 5,
  minStrategyValidationVideos: 5,
  minStrategyValidationPatterns: 1,
  minSuccessCount: 3,
  minSuccessCreators: 2,
  minFailureCount: 3,
  minFailureCreators: 2,
  minSuccessRate: 0.6,
  minBaselineCoverage: 0.6,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type ExperimentStatus = 'PLANNED' | 'ACTIVE' | 'AWAITING_DATA' | 'READY_FOR_EVALUATION' | 'VALIDATED' | 'CLOSED';
export type ObservationEligibility = 'ELIGIBLE' | 'NOT_YET_ELIGIBLE' | 'INELIGIBLE';
export type ExpectedObservedState = 'ABOVE_EXPECTATION' | 'MEETS_EXPECTATION' | 'BELOW_EXPECTATION' | 'INSUFFICIENT';
export type SampleSufficiency = 'INSUFFICIENT' | 'MINIMAL' | 'ADEQUATE' | 'STRONG';
export type PatternValidationState = 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'INCONCLUSIVE' | 'CONTRADICTED' | 'INSUFFICIENT';
export type StrategyValidationState = 'VALIDATED' | 'PARTIALLY_VALIDATED' | 'INCONCLUSIVE' | 'UNDERPERFORMING' | 'FAILED' | 'INSUFFICIENT';
export type ValidationFeedbackAction = 'KEEP' | 'STRENGTHEN' | 'REVISE' | 'REDUCE' | 'STOP' | 'INSUFFICIENT';

export type ExpectedOutcome = {
  patternId: string;
  roleAtStart: StrategyPatternRole;
  expectedNormalizedPerformance: number | null;
  successCriteria: string[];
  failureCriteria: string[];
  source: 'STRATEGY_EXPERIMENT_PLAN' | 'PATTERN_SNAPSHOT' | 'CALIBRATION_DEFAULT';
};

export type PatternSnapshot = {
  patternId: string;
  patternStatus: string;
  trendState: string;
  fitStatus: string | null;
  repeatability: string;
  confidence: string;
  creatorBreadth: number;
  breakoutCreators: number;
};

export type ExperimentDefinition = {
  experimentId: string;
  strategyVersion: string;
  nicheId: string;
  startedAt: string;
  status: ExperimentStatus;
  strategySnapshot: ContentStrategy;
  patternSnapshots: PatternSnapshot[];
  expectedOutcomes: ExpectedOutcome[];
  algorithmVersions: string[];
  provenance: { source: 'STRATEGY_SNAPSHOT'; strategyPatternIds: string[]; calibrationStatus: typeof EXPERIMENT_VALIDATION_CONFIG.calibrationStatus };
};

export type ExperimentObservationInput = {
  observationId?: string;
  experimentId: string;
  videoId: string;
  creatorId?: string | null;
  patternId: string;
  format?: 'long' | 'short' | string | null;
  strategyRole?: StrategyPatternRole | null;
  publishedAt?: string | null;
  observedAt: string;
  capturedAt?: string | null;
  ageDays?: number | null;
  metrics: { views?: number | null; normalizedPerformance?: number | null; breakoutMultiple?: number | null };
  baselineReference?: string | null;
  dataQuality: DataQuality;
  confidence: ConfidenceLevel;
  provenance?: { source?: string | null; snapshotId?: string | null; algorithmVersions?: string[] };
};

export type ExperimentObservation = ExperimentObservationInput & {
  observationId: string;
  eligibility: ObservationEligibility;
  eligibilityReasons: string[];
  expectedObserved: ExpectedObservedState;
  expectedValue: number | null;
};

export type SampleSufficiencyReport = {
  state: SampleSufficiency;
  eligibleVideos: number;
  eligibleCreators: number;
  eligiblePatterns: number;
  baselineCoverage: number;
  repeatSnapshotCount: number;
  reasons: string[];
  blockers: string[];
  calibrationStatus: typeof EXPERIMENT_VALIDATION_CONFIG.calibrationStatus;
};

export type PatternValidationResult = {
  patternId: string;
  roleAtStart: StrategyPatternRole | 'UNKNOWN';
  state: PatternValidationState;
  confidence: ConfidenceLevel;
  eligibleVideos: number;
  eligibleCreators: number;
  aboveExpectation: number;
  meetsExpectation: number;
  belowExpectation: number;
  breakoutCount: number;
  successfulCreators: number;
  reasons: string[];
  blockers: string[];
  feedback: { action: ValidationFeedbackAction; reasonCodes: string[] };
  evidenceRefs: string[];
};

export type StrategyValidationResult = {
  state: StrategyValidationState;
  confidence: ConfidenceLevel;
  eligibleVideos: number;
  eligibleCreators: number;
  validatedPatterns: string[];
  contradictedPatterns: string[];
  primaryPatternStates: Array<{ patternId: string; state: PatternValidationState }>;
  testPatternStates: Array<{ patternId: string; state: PatternValidationState }>;
  reasons: string[];
  blockers: string[];
  feedback: { action: ValidationFeedbackAction; reasonCodes: string[] };
};

export type ValidationProvenance = {
  source: 'PUBLIC_YOUTUBE_OBSERVATIONS' | 'MIXED_PUBLIC_AND_UPSTREAM';
  experimentId: string | null;
  strategyVersion: string;
  strategySnapshotPatternIds: string[];
  observationIds: string[];
  videoIds: string[];
  creatorIds: string[];
  capturedAt: string[];
  observedAt: string[];
  algorithmVersions: string[];
  calibrationStatus: typeof EXPERIMENT_VALIDATION_CONFIG.calibrationStatus;
};

export type ExperimentValidationReport = {
  schemaVersion: 'experiment-validation.v1';
  algorithmVersion: typeof EXPERIMENT_VALIDATION_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  experiment: ExperimentDefinition | null;
  status: ExperimentStatus;
  observations: ExperimentObservation[];
  sampleSufficiency: SampleSufficiencyReport;
  expectedOutcomes: ExpectedOutcome[];
  patternValidation: PatternValidationResult[];
  strategyValidation: StrategyValidationResult;
  confidence: ConfidenceLevel;
  reasons: string[];
  blockers: string[];
  feedback: { pattern: Array<{ patternId: string; previousRole: StrategyPatternRole; validation: PatternValidationState; suggestedFutureState: string }>; strategy: { action: ValidationFeedbackAction; reasonCodes: string[] }; opportunity: { action: 'PRESERVE_AS_EVIDENCE'; reasonCodes: string[] } };
  provenance: ValidationProvenance;
};

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function roleSelection(strategy: ContentStrategy, patternId: string): StrategyPatternSelection | null {
  return [...strategy.primaryPatterns, ...strategy.testPatterns, ...strategy.watchPatterns, ...strategy.deprioritizedPatterns, ...strategy.avoidedPatterns, ...strategy.insufficientPatterns].find(item => item.patternId === patternId) || null;
}

function experimentId(strategy: ContentStrategy, startedAt: string) {
  const ids = [...strategy.primaryPatterns, ...strategy.testPatterns].map(item => item.patternId).sort().join(',');
  return `experiment-validation-v1:${stableHash([strategy.nicheId, strategy.strategyVersion, startedAt, ids].join('|'))}`;
}

function expectedFor(selection: StrategyPatternSelection): ExpectedOutcome {
  const expected = selection.normalizedPerformance.median ?? EXPERIMENT_VALIDATION_CONFIG.expectedNormalizedPerformance;
  const source = selection.normalizedPerformance.median === null ? 'CALIBRATION_DEFAULT' : 'PATTERN_SNAPSHOT';
  return { patternId: selection.patternId, roleAtStart: selection.role, expectedNormalizedPerformance: expected, successCriteria: ['规范化创作者表现达到或超过模式快照期望值。', '突破证据在独立创作者之间重复出现。'], failureCriteria: ['达到合格样本量后持续低于创作者基线。', '新增样本没有形成重复的跨创作者突破证据。'], source };
}

export function createExperimentDefinition(input: { strategy: ContentStrategy; experimentId?: string; startedAt: string }): ExperimentDefinition {
  const strategyPatterns = [...input.strategy.primaryPatterns, ...input.strategy.testPatterns];
  const expectedOutcomes = strategyPatterns.map(expectedFor).sort((a, b) => a.patternId.localeCompare(b.patternId));
  const patternSnapshots = strategyPatterns.map(item => ({ patternId: item.patternId, patternStatus: item.patternStatus, trendState: item.trendState, fitStatus: item.fitStatus, repeatability: item.repeatability, confidence: item.trendConfidence, creatorBreadth: item.creatorBreadth, breakoutCreators: item.breakoutEvidence.creators })).sort((a, b) => a.patternId.localeCompare(b.patternId));
  return { experimentId: input.experimentId || experimentId(input.strategy, input.startedAt), strategyVersion: input.strategy.strategyVersion, nicheId: input.strategy.nicheId, startedAt: input.startedAt, status: 'PLANNED', strategySnapshot: structuredClone(input.strategy), patternSnapshots, expectedOutcomes, algorithmVersions: uniq([EXPERIMENT_VALIDATION_ALGORITHM_VERSION, input.strategy.strategyVersion]), provenance: { source: 'STRATEGY_SNAPSHOT', strategyPatternIds: strategyPatterns.map(item => item.patternId).sort(), calibrationStatus: EXPERIMENT_VALIDATION_CONFIG.calibrationStatus } };
}

function ageDays(observation: ExperimentObservationInput, evaluatedAt: string) {
  if (finite(observation.ageDays)) return observation.ageDays!;
  if (!observation.publishedAt) return null;
  const end = Date.parse(evaluatedAt); const start = Date.parse(observation.publishedAt);
  return Number.isFinite(end) && Number.isFinite(start) ? Math.max(0, (end - start) / 86_400_000) : null;
}

function expectedValue(experiment: ExperimentDefinition, patternId: string) {
  return experiment.expectedOutcomes.find(item => item.patternId === patternId)?.expectedNormalizedPerformance ?? null;
}

function eligibilityFor(observation: ExperimentObservationInput, experiment: ExperimentDefinition, evaluatedAt: string): { status: ObservationEligibility; reasons: string[] } {
  const reasons: string[] = [];
  if (observation.experimentId !== experiment.experimentId) reasons.push('EXPERIMENT_ID_MISMATCH');
  if (!observation.videoId) reasons.push('MISSING_VIDEO_ID');
  if (!observation.patternId || !roleSelection(experiment.strategySnapshot, observation.patternId)) reasons.push('MISSING_OR_UNKNOWN_PATTERN_ID');
  if (observation.format && observation.format !== 'long') reasons.push('NOT_LONG_FORM');
  if (observation.dataQuality.level === 'INSUFFICIENT') reasons.push('LOW_DATA_QUALITY');
  const age = ageDays(observation, evaluatedAt);
  if (age === null) reasons.push('OBSERVATION_AGE_UNKNOWN');
  else if (age < EXPERIMENT_VALIDATION_CONFIG.minObservationAgeDays) reasons.push('OBSERVATION_NOT_MATURE');
  if (!finite(observation.metrics.normalizedPerformance) && !finite(observation.metrics.breakoutMultiple)) reasons.push('NO_SUPPORTED_PUBLIC_METRIC');
  if (reasons.some(code => code === 'OBSERVATION_NOT_MATURE')) return { status: 'NOT_YET_ELIGIBLE', reasons };
  return { status: reasons.length ? 'INELIGIBLE' : 'ELIGIBLE', reasons };
}

function compare(expected: number | null, observed: number | null): ExpectedObservedState {
  if (expected === null || observed === null) return 'INSUFFICIENT';
  if (observed >= expected * (1 + EXPERIMENT_VALIDATION_CONFIG.aboveExpectationMargin)) return 'ABOVE_EXPECTATION';
  if (observed >= expected) return 'MEETS_EXPECTATION';
  return 'BELOW_EXPECTATION';
}

/** Normalize and classify observations; repeated snapshots remain visible but are not independent samples. */
export function ingestExperimentObservations(input: { experiment: ExperimentDefinition; observations: readonly ExperimentObservationInput[]; evaluatedAt: string }): ExperimentObservation[] {
  const sorted = [...input.observations].map((item, index) => {
    const expected = expectedValue(input.experiment, item.patternId);
    const eligibility = eligibilityFor(item, input.experiment, input.evaluatedAt);
    const observationId = item.observationId || `observation-${item.videoId}-${item.capturedAt || item.observedAt}-${index}`;
    return { ...item, observationId, eligibility: eligibility.status, eligibilityReasons: eligibility.reasons, expectedObserved: eligibility.status === 'ELIGIBLE' ? compare(expected, finite(item.metrics.normalizedPerformance) ? item.metrics.normalizedPerformance! : null) : 'INSUFFICIENT', expectedValue: expected } satisfies ExperimentObservation;
  }).sort((a, b) => `${a.videoId}|${a.observedAt}|${a.observationId}`.localeCompare(`${b.videoId}|${b.observedAt}|${b.observationId}`));
  return sorted;
}

function latestEligibleByVideo(observations: readonly ExperimentObservation[]) {
  const latest = new Map<string, ExperimentObservation>();
  for (const item of observations) if (item.eligibility === 'ELIGIBLE') {
    const existing = latest.get(item.videoId);
    if (!existing || `${item.observedAt}|${item.observationId}` > `${existing.observedAt}|${existing.observationId}`) latest.set(item.videoId, item);
  }
  return [...latest.values()].sort((a, b) => a.videoId.localeCompare(b.videoId));
}

function sufficiency(observations: readonly ExperimentObservation[]): SampleSufficiencyReport {
  const eligible = latestEligibleByVideo(observations);
  const creators = new Set(eligible.map(item => item.creatorId).filter((value): value is string => Boolean(value)));
  const patterns = new Set(eligible.map(item => item.patternId));
  const baselineValues = eligible.filter(item => finite(item.metrics.normalizedPerformance));
  const baselineCoverage = eligible.length ? baselineValues.length / eligible.length : 0;
  const repeatSnapshotCount = Math.max(0, observations.filter(item => item.eligibility === 'ELIGIBLE').length - eligible.length);
  const reasons: string[] = []; const blockers: string[] = [];
  let state: SampleSufficiency = 'INSUFFICIENT';
  if (eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minStrongPatternVideos && creators.size >= EXPERIMENT_VALIDATION_CONFIG.minStrongPatternCreators && baselineCoverage >= 0.8) state = 'STRONG';
  else if (eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minAdequatePatternVideos && creators.size >= EXPERIMENT_VALIDATION_CONFIG.minAdequatePatternCreators && baselineCoverage >= EXPERIMENT_VALIDATION_CONFIG.minBaselineCoverage) state = 'ADEQUATE';
  else if (eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minPatternValidationVideos && creators.size >= EXPERIMENT_VALIDATION_CONFIG.minPatternValidationCreators) state = 'MINIMAL';
  else blockers.push('INSUFFICIENT_SAMPLE');
  if (creators.size < EXPERIMENT_VALIDATION_CONFIG.minPatternValidationCreators) blockers.push('LOW_CREATOR_BREADTH');
  if (baselineCoverage < EXPERIMENT_VALIDATION_CONFIG.minBaselineCoverage) blockers.push('LOW_BASELINE_COVERAGE');
  if (repeatSnapshotCount) reasons.push('REPEATED_SNAPSHOTS_DEDUPLICATED');
  if (state !== 'INSUFFICIENT') reasons.push(`SAMPLE_${state}`);
  return { state, eligibleVideos: eligible.length, eligibleCreators: creators.size, eligiblePatterns: patterns.size, baselineCoverage, repeatSnapshotCount, reasons, blockers: uniq(blockers), calibrationStatus: EXPERIMENT_VALIDATION_CONFIG.calibrationStatus };
}

function patternResult(patternId: string, role: StrategyPatternRole | 'UNKNOWN', observations: readonly ExperimentObservation[]): PatternValidationResult {
  const eligible = latestEligibleByVideo(observations).filter(item => item.patternId === patternId);
  const creators = new Set(eligible.map(item => item.creatorId).filter((value): value is string => Boolean(value)));
  const above = eligible.filter(item => item.expectedObserved === 'ABOVE_EXPECTATION').length;
  const meets = eligible.filter(item => item.expectedObserved === 'MEETS_EXPECTATION').length;
  const below = eligible.filter(item => item.expectedObserved === 'BELOW_EXPECTATION').length;
  const successful = eligible.filter(item => item.expectedObserved === 'ABOVE_EXPECTATION' || item.expectedObserved === 'MEETS_EXPECTATION');
  const successfulCreators = new Set(successful.map(item => item.creatorId).filter((value): value is string => Boolean(value)));
  const breakoutCount = eligible.filter(item => finite(item.metrics.breakoutMultiple) && item.metrics.breakoutMultiple! >= 1.1).length;
  const blockers: string[] = []; const reasons: string[] = [];
  let state: PatternValidationState = 'INSUFFICIENT';
  if (eligible.length < EXPERIMENT_VALIDATION_CONFIG.minPatternValidationVideos || creators.size < EXPERIMENT_VALIDATION_CONFIG.minPatternValidationCreators) { blockers.push('INSUFFICIENT_SAMPLE'); }
  else if (below >= EXPERIMENT_VALIDATION_CONFIG.minFailureCount && new Set(eligible.filter(item => item.expectedObserved === 'BELOW_EXPECTATION').map(item => item.creatorId).filter((value): value is string => Boolean(value))).size >= EXPERIMENT_VALIDATION_CONFIG.minFailureCreators && below / eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minSuccessRate) { state = 'CONTRADICTED'; reasons.push('PATTERN_REPEATED_UNDERPERFORMANCE'); }
  else if (successful.length >= EXPERIMENT_VALIDATION_CONFIG.minSuccessCount && successfulCreators.size >= EXPERIMENT_VALIDATION_CONFIG.minSuccessCreators && successful.length / eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minSuccessRate && eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minAdequatePatternVideos) { state = 'VALIDATED'; reasons.push('PATTERN_REPEATED_OUTPERFORMANCE', 'PATTERN_MULTICREATOR_SUCCESS'); if (breakoutCount >= 2) reasons.push('PATTERN_BREAKOUT_CONFIRMED'); }
  else if (successful.length >= 2 && successfulCreators.size >= 2) { state = 'PARTIALLY_VALIDATED'; reasons.push('PATTERN_PARTIAL_MULTICREATOR_SUCCESS'); }
  else { state = 'INCONCLUSIVE'; reasons.push('PATTERN_EVIDENCE_MIXED'); }
  const confidence: ConfidenceLevel = state === 'INSUFFICIENT' ? 'INSUFFICIENT' : eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minStrongPatternVideos && creators.size >= EXPERIMENT_VALIDATION_CONFIG.minStrongPatternCreators ? 'HIGH' : eligible.length >= EXPERIMENT_VALIDATION_CONFIG.minAdequatePatternVideos ? 'MEDIUM' : 'LOW';
  const action: ValidationFeedbackAction = state === 'VALIDATED' ? 'STRENGTHEN' : state === 'CONTRADICTED' ? 'REDUCE' : state === 'PARTIALLY_VALIDATED' ? 'KEEP' : 'INSUFFICIENT';
  const evidenceRefs = eligible.flatMap(item => [`observation:${item.observationId}`, `video:${item.videoId}`, ...(item.creatorId ? [`creator:${item.creatorId}`] : [])]);
  return { patternId, roleAtStart: role, state, confidence, eligibleVideos: eligible.length, eligibleCreators: creators.size, aboveExpectation: above, meetsExpectation: meets, belowExpectation: below, breakoutCount, successfulCreators: successfulCreators.size, reasons, blockers: uniq(blockers), feedback: { action, reasonCodes: reasons.length ? reasons : blockers }, evidenceRefs: uniq(evidenceRefs) };
}

function strategyResult(experiment: ExperimentDefinition, patterns: readonly PatternValidationResult[], sample: SampleSufficiencyReport): StrategyValidationResult {
  const primary = patterns.filter(item => item.roleAtStart === 'PRIMARY');
  const tests = patterns.filter(item => item.roleAtStart === 'TEST');
  const validated = patterns.filter(item => item.state === 'VALIDATED').map(item => item.patternId);
  const contradicted = patterns.filter(item => item.state === 'CONTRADICTED').map(item => item.patternId);
  const reasons: string[] = []; const blockers: string[] = [];
  if (sample.state === 'INSUFFICIENT' || sample.eligibleVideos < EXPERIMENT_VALIDATION_CONFIG.minStrategyValidationVideos) blockers.push('INSUFFICIENT_SAMPLE');
  let state: StrategyValidationState = 'INSUFFICIENT';
  if (blockers.length) state = 'INSUFFICIENT';
  else if (primary.length && primary.every(item => item.state === 'CONTRADICTED') && sample.state === 'STRONG') { state = 'FAILED'; reasons.push('STRATEGY_PRIMARY_REPEATEDLY_FAILED'); }
  else if (primary.some(item => item.state === 'CONTRADICTED') && sample.state !== 'MINIMAL') { state = 'UNDERPERFORMING'; reasons.push('STRATEGY_PRIMARY_UNDERPERFORMING'); }
  else if (patterns.length && patterns.every(item => item.state === 'VALIDATED') && sample.state !== 'MINIMAL') { state = 'VALIDATED'; reasons.push('STRATEGY_REPEATED_PATTERN_VALIDATION'); }
  else if (validated.length || patterns.some(item => item.state === 'PARTIALLY_VALIDATED')) { state = 'PARTIALLY_VALIDATED'; reasons.push('STRATEGY_PARTIAL_VALIDATION'); }
  else state = 'INCONCLUSIVE';
  const confidence: ConfidenceLevel = state === 'INSUFFICIENT' ? 'INSUFFICIENT' : sample.state === 'STRONG' ? 'HIGH' : sample.state === 'ADEQUATE' ? 'MEDIUM' : 'LOW';
  const action: ValidationFeedbackAction = state === 'VALIDATED' ? 'STRENGTHEN' : state === 'FAILED' ? 'STOP' : state === 'UNDERPERFORMING' ? 'REDUCE' : state === 'PARTIALLY_VALIDATED' ? 'REVISE' : 'INSUFFICIENT';
  return { state, confidence, eligibleVideos: sample.eligibleVideos, eligibleCreators: sample.eligibleCreators, validatedPatterns: validated, contradictedPatterns: contradicted, primaryPatternStates: primary.map(item => ({ patternId: item.patternId, state: item.state })), testPatternStates: tests.map(item => ({ patternId: item.patternId, state: item.state })), reasons, blockers: uniq(blockers), feedback: { action, reasonCodes: reasons.length ? reasons : blockers } };
}

export function buildExperimentValidationReport(input: { strategy: ContentStrategy; experiment?: ExperimentDefinition | null; observations?: readonly ExperimentObservationInput[]; evaluatedAt?: string }): ExperimentValidationReport {
  const experiment = input.experiment || createExperimentDefinition({ strategy: input.strategy, startedAt: input.evaluatedAt || '1970-01-01T00:00:00.000Z' });
  const evaluatedAt = input.evaluatedAt || new Date(experiment.startedAt).toISOString();
  const observations = ingestExperimentObservations({ experiment, observations: input.observations || [], evaluatedAt });
  const sample = sufficiency(observations);
  const patternIds = experiment.patternSnapshots.map(item => item.patternId);
  const patternResults = patternIds.map(patternId => patternResult(patternId, experiment.expectedOutcomes.find(item => item.patternId === patternId)?.roleAtStart || 'UNKNOWN', observations));
  const strategyValidation = strategyResult(experiment, patternResults, sample);
  const status: ExperimentStatus = observations.length === 0 ? 'PLANNED' : sample.state === 'INSUFFICIENT' ? 'AWAITING_DATA' : strategyValidation.state === 'VALIDATED' || strategyValidation.state === 'FAILED' ? 'CLOSED' : 'READY_FOR_EVALUATION';
  const confidence = strategyValidation.confidence;
  const blockers = uniq([...sample.blockers, ...strategyValidation.blockers]);
  const reasons = uniq([...sample.reasons, ...strategyValidation.reasons]);
  const source = observations.some(item => item.provenance?.source && item.provenance.source !== 'PUBLIC_YOUTUBE_METADATA') ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_OBSERVATIONS';
  const eligible = latestEligibleByVideo(observations);
  const feedback = { pattern: patternResults.map(item => ({ patternId: item.patternId, previousRole: item.roleAtStart === 'UNKNOWN' ? 'WATCH' : item.roleAtStart, validation: item.state, suggestedFutureState: item.state === 'VALIDATED' ? 'ELIGIBLE_FOR_STRONGER_CONSIDERATION' : item.state === 'CONTRADICTED' ? 'REQUIRE_REVIEW_BEFORE_REUSE' : 'COLLECT_MORE_EVIDENCE' })), strategy: strategyValidation.feedback, opportunity: { action: 'PRESERVE_AS_EVIDENCE' as const, reasonCodes: strategyValidation.state === 'VALIDATED' ? ['STRATEGY_VALIDATED_EVIDENCE'] : strategyValidation.state === 'FAILED' ? ['STRATEGY_FAILURE_EVIDENCE'] : ['VALIDATION_DOES_NOT_MUTATE_OPPORTUNITY'] } };
  return { schemaVersion: 'experiment-validation.v1', algorithmVersion: EXPERIMENT_VALIDATION_ALGORITHM_VERSION, scope: 'LONG_FORM', experiment, status, observations, sampleSufficiency: sample, expectedOutcomes: experiment.expectedOutcomes, patternValidation: patternResults, strategyValidation, confidence, reasons, blockers, feedback, provenance: { source, experimentId: experiment.experimentId, strategyVersion: experiment.strategyVersion, strategySnapshotPatternIds: experiment.provenance.strategyPatternIds, observationIds: eligible.map(item => item.observationId), videoIds: eligible.map(item => item.videoId), creatorIds: uniq(eligible.map(item => item.creatorId || '')), capturedAt: uniq(eligible.map(item => item.capturedAt || '').filter(Boolean)), observedAt: uniq(eligible.map(item => item.observedAt)), algorithmVersions: uniq([...experiment.algorithmVersions, EXPERIMENT_VALIDATION_ALGORITHM_VERSION]), calibrationStatus: EXPERIMENT_VALIDATION_CONFIG.calibrationStatus } };
}


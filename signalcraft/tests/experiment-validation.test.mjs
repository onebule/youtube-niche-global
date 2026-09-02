import test from 'node:test';
import assert from 'node:assert/strict';
import { createExperimentDefinition, buildExperimentValidationReport, EXPERIMENT_VALIDATION_CONFIG } from '../src/lib/experiment-validation.ts';

const selection = (overrides = {}) => ({
  patternId: overrides.patternId || 'content-pattern-v1:how-to', pattern: { patternId: overrides.patternId || 'content-pattern-v1:how-to', taxonomy: 'TITLE_STRUCTURE', featureKey: 'titleStructure', featureValue: 'HOW_TO', label: 'How-to', derivation: 'DETERMINISTIC_METADATA' }, role: overrides.role || 'TEST', priority: 'MEDIUM', patternStatus: 'CANDIDATE', trendState: 'ACCELERATING', trendConfidence: 'MEDIUM', fitStatus: 'STRONG_FIT', fitConfidence: 'MEDIUM', repeatability: 'REPEATED_ACROSS_CREATORS', creatorBreadth: 3, breakoutEvidence: { videos: 3, creators: 2, rate: 0.5 }, normalizedPerformance: { median: 1.1, p75: 1.3, samples: 5 }, reasons: [], risks: [], blockers: [], evidenceRefs: [],
});
const strategy = (overrides = {}) => {
  const selected = selection(overrides);
  return { schemaVersion: 'content-strategy.v1', strategyVersion: 'content-strategy-v1', scope: 'LONG_FORM', nicheId: 'niche-a', strategyStatus: 'VALIDATION', opportunityContext: { decision: 'TEST', confidence: 'MEDIUM', entryWindow: 'OPEN', lifecycle: 'GROWING', evidenceRefs: [] }, primaryPatterns: selected.role === 'PRIMARY' ? [selected] : [], testPatterns: selected.role === 'TEST' ? [selected] : [], watchPatterns: [], deprioritizedPatterns: [], avoidedPatterns: [], insufficientPatterns: [], positioning: { direction: 'EMERGING_FORMAT_TEST', summary: 'test', supportingPatternIds: [selected.patternId], guardrails: [] }, experimentPlan: { status: 'BOUNDED_TEST', primaryPatternIds: [], testPatternIds: [selected.patternId], priorities: [], minimumEligibleSample: 5, sampleSemantics: 'ELIGIBLE_LONG_FORM_VIDEOS', evaluationMetrics: ['NORMALIZED_CREATOR_PERFORMANCE', 'BREAKOUT_RATE', 'REPEATABILITY', 'CREATOR_BREADTH'], successCriteria: [], failureCriteria: [], calibrationStatus: 'CALIBRATION_REQUIRED' }, confidence: 'MEDIUM', reasons: [], risks: [], blockers: [], evidenceAudit: {}, provenance: { source: 'PUBLIC_YOUTUBE_METADATA', algorithmVersions: ['content-strategy-v1'], nicheId: 'niche-a', opportunityDecision: 'TEST', opportunityEvidenceRefs: [], patternIds: [selected.patternId], currentWindow: 'current', comparisonWindow: 'previous', historicalSemantics: 'PUBLICATION_COHORT', calibrationStatus: 'CALIBRATION_REQUIRED' }, ...overrides, testPatterns: overrides.testPatterns || (selected.role === 'TEST' ? [selected] : []), primaryPatterns: overrides.primaryPatterns || (selected.role === 'PRIMARY' ? [selected] : []) };
};
const quality = (level = 'HIGH') => ({ level, schemaVersion: 'data-quality.v1' });
const experiment = (input = {}) => createExperimentDefinition({ strategy: input.strategy || strategy(), startedAt: input.startedAt || '2026-09-01T00:00:00.000Z', experimentId: input.experimentId });
const observation = (exp, id, creatorId, value, options = {}) => ({ experimentId: exp.experimentId, videoId: id, creatorId, patternId: exp.patternSnapshots[0]?.patternId || 'content-pattern-v1:how-to', format: options.format || 'long', observedAt: options.observedAt || '2026-09-10T00:00:00.000Z', capturedAt: options.capturedAt || '2026-09-10T00:00:00.000Z', ageDays: options.ageDays ?? 10, metrics: { normalizedPerformance: value, breakoutMultiple: options.breakoutMultiple ?? (value >= 1.2 ? 2 : 1) }, dataQuality: quality(options.quality || 'HIGH'), confidence: options.confidence || 'HIGH', provenance: { source: 'PUBLIC_YOUTUBE_METADATA', snapshotId: options.snapshotId || id } });

test('one successful video remains insufficient', () => {
  const exp = experiment();
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations: [observation(exp, 'v1', 'c1', 1.5)], evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.sampleSufficiency.state, 'INSUFFICIENT');
  assert.equal(report.patternValidation[0].state, 'INSUFFICIENT');
  assert.notEqual(report.strategyValidation.state, 'VALIDATED');
});

test('repeated normalized success across creators validates the pattern and strategy', () => {
  const exp = experiment();
  const observations = Array.from({ length: 5 }, (_, i) => observation(exp, `v${i}`, `c${i % 3}`, 1.3, { breakoutMultiple: 3 }));
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations, evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.sampleSufficiency.state, 'ADEQUATE');
  assert.equal(report.patternValidation[0].state, 'VALIDATED');
  assert.equal(report.strategyValidation.state, 'VALIDATED');
  assert.ok(report.feedback.pattern[0].suggestedFutureState.includes('STRONGER'));
});

test('one viral outlier does not validate an otherwise weak sample', () => {
  const exp = experiment();
  const observations = [observation(exp, 'viral', 'c1', 4), ...Array.from({ length: 4 }, (_, i) => observation(exp, `weak${i}`, `c${(i % 3) + 2}`, 0.7))];
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations, evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.notEqual(report.patternValidation[0].state, 'VALIDATED');
});

test('repeated underperformance contradicts a pattern only after breadth and sample gates', () => {
  const exp = experiment({ strategy: strategy({ role: 'PRIMARY' }) });
  const observations = Array.from({ length: 6 }, (_, i) => observation(exp, `v${i}`, `c${i % 3}`, 0.7));
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations, evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.patternValidation[0].state, 'CONTRADICTED');
  assert.equal(report.strategyValidation.state, 'UNDERPERFORMING');
});

test('immature observations wait instead of failing', () => {
  const exp = experiment();
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations: [observation(exp, 'new', 'c1', 0.5, { ageDays: 1 })], evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.observations[0].eligibility, 'NOT_YET_ELIGIBLE');
  assert.equal(report.observations[0].expectedObserved, 'INSUFFICIENT');
  assert.equal(report.patternValidation[0].state, 'INSUFFICIENT');
});

test('missing baseline never fabricates normalized evaluation', () => {
  const exp = experiment();
  const item = observation(exp, 'no-baseline', 'c1', null, { breakoutMultiple: 3 });
  item.metrics.normalizedPerformance = null;
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations: [item], evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.observations[0].expectedObserved, 'INSUFFICIENT');
  assert.equal(report.observations[0].metrics.normalizedPerformance, null);
});

test('duplicate videos and repeated snapshots do not inflate independent samples', () => {
  const exp = experiment();
  const first = observation(exp, 'same', 'c1', 1.2, { observedAt: '2026-09-08T00:00:00.000Z', snapshotId: 'snap-1' });
  const later = observation(exp, 'same', 'c1', 1.4, { observedAt: '2026-09-10T00:00:00.000Z', snapshotId: 'snap-2' });
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations: [first, later], evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.sampleSufficiency.eligibleVideos, 1);
  assert.equal(report.sampleSufficiency.repeatSnapshotCount, 1);
  assert.equal(report.provenance.videoIds.length, 1);
});

test('strategy snapshots remain stable when current strategy changes', () => {
  const original = strategy({ strategyVersion: 'content-strategy-v1' });
  const exp = experiment({ strategy: original });
  original.strategyVersion = 'content-strategy-v2';
  original.testPatterns[0].role = 'WATCH';
  assert.equal(exp.strategySnapshot.strategyVersion, 'content-strategy-v1');
  assert.equal(exp.strategySnapshot.testPatterns[0].role, 'TEST');
});

test('Shorts are ineligible and opportunity feedback does not mutate upstream truth', () => {
  const exp = experiment({ strategy: strategy({ strategyStatus: 'BLOCKED', opportunityContext: { decision: 'AVOID', confidence: 'HIGH', entryWindow: 'CLOSED', lifecycle: 'SATURATED', evidenceRefs: [] } }) });
  const report = buildExperimentValidationReport({ strategy: exp.strategySnapshot, experiment: exp, observations: [observation(exp, 'short', 'c1', 2, { format: 'short' })], evaluatedAt: '2026-09-10T00:00:00.000Z' });
  assert.equal(report.observations[0].eligibility, 'INELIGIBLE');
  assert.equal(report.feedback.opportunity.action, 'PRESERVE_AS_EVIDENCE');
  assert.equal(EXPERIMENT_VALIDATION_CONFIG.calibrationStatus, 'CALIBRATION_REQUIRED');
});

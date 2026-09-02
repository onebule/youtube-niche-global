import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentPatternReport } from '../src/lib/content-patterns.ts';
import { buildContentPatternTrendReport } from '../src/lib/content-pattern-trends.ts';
import { buildContentStrategy } from '../src/lib/content-strategy.ts';

const video = (id, creatorId, title, options = {}) => ({
  videoId: id, creatorId, format: options.format || 'long', title, durationSeconds: options.durationSeconds ?? 900,
  normalizedPerformance: options.normalizedPerformance ?? 1, breakoutClassification: options.breakoutClassification ?? 'NORMAL',
  breakoutMultiple: options.breakoutMultiple ?? 1, nicheId: options.nicheId || 'target', views: 100_000,
});
const windowOf = (key, videos, start, end) => ({ key, start, end, timeSemantics: 'PUBLICATION_COHORT', videos });
const opportunity = (status = 'TEST', confidence = 'HIGH', window = 'OPEN') => ({
  dimensions: { LIFECYCLE_POSITION: { state: 'GROWING' }, SATURATION_RISK: { state: 'LOW' } },
  entryWindow: window, confidence, decision: { status }, provenance: { lifecycle: 'TRUE_SNAPSHOT_HISTORY' }, algorithmVersion: 'opportunity-engine-v1',
});
const strongReports = () => {
  const previous = Array.from({ length: 10 }, (_, i) => video(`p${i}`, `creator-${i % 5}`, 'How to build', { normalizedPerformance: 1, breakoutClassification: i < 2 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: i < 2 ? 3 : 1 }));
  const current = Array.from({ length: 20 }, (_, i) => video(`c${i}`, `creator-${i % 8}`, 'How to build', { normalizedPerformance: 1.4, breakoutClassification: i < 10 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: i < 10 ? 4 : 1 }));
  const outside = Array.from({ length: 5 }, (_, i) => video(`o${i}`, `outside-${i % 3}`, 'How to build', { nicheId: 'other', normalizedPerformance: 0.8 }));
  const currentAll = [...current, ...outside];
  return {
    patterns: buildContentPatternReport({ videos: currentAll, capturedAt: '2026-09-02T00:00:00.000Z' }),
    trend: buildContentPatternTrendReport({ current: windowOf('current', currentAll, '2026-08-01T00:00:00.000Z', '2026-08-31T00:00:00.000Z'), previous: windowOf('previous', previous, '2026-07-01T00:00:00.000Z', '2026-07-31T00:00:00.000Z'), nicheId: 'target' }),
  };
};

test('clear winning, accelerating, top-fit pattern becomes PRIMARY', () => {
  const { patterns, trend } = strongReports();
  const result = buildContentStrategy({ nicheId: 'target', opportunityAssessment: opportunity('RECOMMENDED'), contentPatterns: patterns, contentPatternTrend: trend });
  assert.ok(result.primaryPatterns.some(item => item.pattern.featureValue === 'HOW_TO'));
  assert.equal(result.scope, 'LONG_FORM');
  assert.equal(result.strategyVersion, 'content-strategy-v1');
});

test('candidate accelerating strong-fit pattern becomes TEST and dilution is not primary', () => {
  const { patterns, trend } = strongReports();
  const altered = structuredClone(patterns);
  const target = altered.aggregations.find(item => item.pattern.featureValue === 'HOW_TO');
  target.winningPattern.status = 'CANDIDATE';
  const result = buildContentStrategy({ opportunityAssessment: opportunity(), contentPatterns: altered, contentPatternTrend: trend });
  assert.ok(result.testPatterns.some(item => item.pattern.featureValue === 'HOW_TO'));
  const diluting = structuredClone(trend);
  const assessment = diluting.assessments.find(item => item.pattern.featureValue === 'HOW_TO');
  assessment.state = 'DILUTING';
  const dilutedResult = buildContentStrategy({ opportunityAssessment: opportunity('RECOMMENDED'), contentPatterns: patterns, contentPatternTrend: diluting });
  assert.equal(dilutedResult.primaryPatterns.some(item => item.pattern.featureValue === 'HOW_TO'), false);
  assert.ok(dilutedResult.risks.some(item => item.code === 'PATTERN_DILUTION'));
});

test('weak fit does not become primary and insufficient never becomes avoid', () => {
  const { patterns, trend } = strongReports();
  const weak = structuredClone(trend);
  const fit = weak.nicheFits.find(item => item.pattern.featureValue === 'HOW_TO');
  fit.status = 'WEAK_FIT';
  fit.confidence = 'MEDIUM';
  const weakResult = buildContentStrategy({ opportunityAssessment: opportunity('RECOMMENDED'), contentPatterns: patterns, contentPatternTrend: weak });
  assert.equal(weakResult.primaryPatterns.some(item => item.pattern.featureValue === 'HOW_TO'), false);
  const insufficient = buildContentStrategy({ opportunityAssessment: opportunity('RECOMMENDED'), contentPatterns: patterns, contentPatternTrend: null });
  assert.equal(insufficient.avoidedPatterns.length, 0);
  assert.ok(insufficient.insufficientPatterns.length > 0);
});

test('opportunity gates are conservative and deterministic', () => {
  const { patterns, trend } = strongReports();
  const insufficient = buildContentStrategy({ opportunityAssessment: opportunity('INSUFFICIENT', 'INSUFFICIENT'), contentPatterns: patterns, contentPatternTrend: trend });
  assert.equal(insufficient.primaryPatterns.length, 0);
  assert.equal(insufficient.strategyStatus, 'RESEARCH_ONLY');
  const avoid = buildContentStrategy({ opportunityAssessment: opportunity('AVOID', 'HIGH'), contentPatterns: patterns, contentPatternTrend: trend });
  assert.equal(avoid.primaryPatterns.length, 0);
  assert.equal(avoid.strategyStatus, 'BLOCKED');
  const caution = buildContentStrategy({ opportunityAssessment: opportunity('CAUTION', 'LOW'), contentPatterns: patterns, contentPatternTrend: trend });
  assert.ok(caution.primaryPatterns.length <= 1);
  assert.equal(caution.experimentPlan.calibrationStatus, 'CALIBRATION_REQUIRED');
});

test('deterministic replay, redundancy and Shorts isolation hold', () => {
  const { patterns, trend } = strongReports();
  const input = { nicheId: 'target', opportunityAssessment: opportunity('TEST'), contentPatterns: patterns, contentPatternTrend: trend };
  assert.deepEqual(buildContentStrategy(input), buildContentStrategy(input));
  const shorts = buildContentPatternReport({ videos: [video('s1', 'short', 'How to build', { format: 'short' })] });
  assert.equal(shorts.input.longFormVideos, 0);
  assert.equal(buildContentStrategy({ opportunityAssessment: opportunity(), contentPatterns: shorts, contentPatternTrend: null }).scope, 'LONG_FORM');
});

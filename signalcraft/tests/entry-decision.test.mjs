import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePerformanceAssessment, evaluateLongformEntryDecision } from '../src/lib/entry-decision.ts';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';

const quality = (level, overrides = {}) => ({ level, sampleVideos: 20, sampleChannels: 5, schemaVersion: 'data-quality.v1', ...overrides });
const input = (overrides = {}) => ({
  sampleSize: 20,
  channelCount: 5,
  representativeVideoCount: 3,
  metrics: { growth: 86, lowCompetition: 72 },
  marketOpportunity: 78,
  executionFit: 70,
  entryScore: 76,
  recommendation: null,
  baselineStatus: 'VERIFIED',
  dataQuality: quality('HIGH'),
  ...overrides,
});

test('high performance with insufficient evidence cannot become recommended', () => {
  const result = evaluateLongformEntryDecision(input({ sampleSize: 2, channelCount: 1, representativeVideoCount: 1, dataQuality: quality('INSUFFICIENT', { sampleVideos: 2, sampleChannels: 1 }) }));
  assert.equal(result.performance.level, 'VERY_HIGH');
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.notEqual(result.decision.status, 'RECOMMENDED');
  assert.ok(result.decision.blockers.some(item => item.code === 'LOW_SAMPLE_SIZE'));
});

test('medium performance with strong evidence defaults to a controlled test', () => {
  const result = evaluateLongformEntryDecision(input({ metrics: { growth: 52, lowCompetition: 68 }, marketOpportunity: 62, executionFit: 65, entryScore: 60 }));
  assert.equal(result.performance.level, 'MEDIUM');
  assert.equal(result.confidence, 'HIGH');
  assert.equal(result.decision.status, 'TEST');
  assert.ok(result.decision.reasons.some(item => item.code === 'CONTROLLED_TEST'));
});

test('weak data quality is cautious even when upstream scores are high', () => {
  const result = evaluateLongformEntryDecision(input({ dataQuality: quality('LOW'), sampleSize: 8, channelCount: 3, representativeVideoCount: 2 }));
  assert.equal(result.confidence, 'LOW');
  assert.equal(result.decision.status, 'CAUTION');
  assert.ok(result.decision.blockers.some(item => item.code === 'DATA_QUALITY_LOW'));
});

test('missing baseline produces a test at most and never claims verified repeatability', () => {
  const result = evaluateLongformEntryDecision(input({ baselineStatus: 'UNAVAILABLE' }));
  assert.equal(result.decision.status, 'TEST');
  assert.ok(result.decision.blockers.some(item => item.code === 'BASELINE_UNVERIFIED'));
  assert.notEqual(result.decision.status, 'RECOMMENDED');
});

test('opaque upstream scores are preserved as context, not local facts', () => {
  const normalized = normalizeLongformResponse({
    evidence: { algorithmVersion: 'upstream-v9', snapshotId: 'snap-42', capturedAt: '2026-09-01T00:00:00.000Z', source: 'upstream' },
    dataScope: { source: 'stored-corpus', latestCapturedAt: '2026-09-01T00:00:00.000Z', longformRows: 25, classificationCoverage: 90 },
    opportunities: [{ key: 'opaque', sampleSize: 25, channelCount: 6, recommendation: 'BUILD', marketOpportunity: 91, executionFit: 84, entryScore: 88, metrics: { growth: 82, lowCompetition: 74 }, representativeVideos: [{ videoId: 'v1', title: 'Observed' }] }],
  });
  const opportunity = normalized.opportunities[0];
  assert.equal(opportunity.upstreamAssessment.source, 'UPSTREAM_OPAQUE');
  assert.equal(opportunity.upstreamAssessment.algorithmVersion, 'upstream-v9');
  assert.equal(opportunity.upstreamAssessment.scores.entryScore, 88);
  assert.equal(opportunity.entryDecision.algorithmVersion, 'entry-decision-v1');
  assert.ok(opportunity.entryDecision.reasons.some(item => item.code === 'UPSTREAM_RECOMMENDATION'));
});

test('performance stays unknown when no supported public metric exists', () => {
  const performance = derivePerformanceAssessment({ growth: null, viewsPerDay: null, viewsPerHour: null });
  assert.equal(performance.level, 'UNKNOWN');
  assert.equal(performance.score, null);
  assert.equal(performance.sourceMetric, null);
});


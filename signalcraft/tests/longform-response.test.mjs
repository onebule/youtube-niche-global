import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';
import { buildNicheBreakoutSummary } from '../src/lib/niche-signals.ts';
import { buildNicheLifecycleSummary } from '../src/lib/niche-lifecycle.ts';

test('partial long-form responses normalize to safe unknown states', () => {
  const result = normalizeLongformResponse({
    available: true,
    opportunities: [{ key: 'topic-a', topic: 'Topic A', metrics: { growth: 'not-a-number', lowCompetition: 64 }, representativeVideos: [{ videoId: 'v1', title: 'Video 1' }] }],
  });
  assert.equal(result.opportunities.length, 1);
  assert.equal(result.opportunities[0].metrics.growth, undefined);
  assert.equal(result.opportunities[0].metrics.lowCompetition, 64);
  assert.equal(result.opportunities[0].representativeVideos[0].channelAvatar, null);
  assert.equal(result.dataScope.window, '28d');
  assert.equal(result.availabilityAudit.coverage, 0);
});

test('normalized responses preserve real fields and reject invalid scores', () => {
  const result = normalizeLongformResponse({
    engineVersion: 'longform-discovery-v1',
    dataScope: { markets: ['US'], window: '90d', collectedRows: 12, longformRows: 9, uncertainRows: 3, classificationCoverage: 75, note: 'Captured' },
    availabilityAudit: { fields: { views: { available: true, provenance: 'youtube', confidence: 'HIGH', note: null }, revenue: { available: false, provenance: 'private', confidence: 'NONE', note: 'Not public' } } },
    lanes: { BREAKOUT: 4 },
    opportunities: [{ confidence: 120, confidenceLabel: 'INVALID', recommendation: 'INVALID', sampleSize: -2, channelCount: -1, metrics: { growth: 12 } }],
  });
  assert.equal(result.engineVersion, 'longform-discovery-v1');
  assert.deepEqual(result.dataScope.markets, ['US']);
  assert.equal(result.dataScope.longformRows, 9);
  assert.equal(result.availabilityAudit.coverage, 50);
  assert.equal(result.availabilityAudit.fields.revenue.available, false);
  assert.equal(result.lanes.BREAKOUT, 4);
  assert.equal(result.opportunities[0].confidence, 100);
  assert.equal(result.opportunities[0].confidenceLabel, 'LOW');
  assert.equal(result.opportunities[0].recommendation, undefined);
  assert.equal(result.opportunities[0].sampleSize, 0);
});

test('optional Long-form niche signals survive the response boundary', () => {
  const nicheSignals = buildNicheBreakoutSummary({ nicheId: 'topic-a', observations: Array.from({ length: 5 }, (_, index) => ({ nicheId: 'topic-a', videoId: `v${index}`, creatorId: `c${index}`, format: 'long', views: 100, subscriberCount: 20_000, baselineStatus: 'VERIFIED', baselineConfidence: 'HIGH', breakoutClassification: index < 3 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index < 3 ? 4 : 1, repeatBreakoutStatus: 'NONE' })) });
  const result = normalizeLongformResponse({ opportunities: [{ key: 'topic-a', nicheSignals }] });
  assert.equal(result.opportunities[0].nicheSignals?.nicheId, 'topic-a');
  assert.equal(result.opportunities[0].nicheSignals?.format, 'long');
});

test('optional Long-form lifecycle evidence survives the response boundary', () => {
  const row = (id, creatorId, performance) => ({ nicheId: 'topic-a', videoId: id, creatorId, format: 'long', views: 100, normalizedPerformance: performance, subscriberCount: 20_000, baselineStatus: 'VERIFIED', baselineConfidence: 'HIGH', breakoutClassification: 'NORMAL', breakoutMultiple: 1, repeatBreakoutStatus: 'NONE' });
  const current = { nicheId: 'topic-a', format: 'long', key: 'current', start: '2026-08-01T00:00:00.000Z', end: '2026-08-31T00:00:00.000Z', timeSemantics: 'PUBLICATION_COHORT_HISTORY', coverage: 1, observations: Array.from({ length: 5 }, (_, index) => row(`c${index}`, `creator-${index}`, 110)) };
  const comparison = { nicheId: 'topic-a', format: 'long', key: 'comparison', start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T00:00:00.000Z', timeSemantics: 'PUBLICATION_COHORT_HISTORY', coverage: 1, observations: Array.from({ length: 5 }, (_, index) => row(`p${index}`, `creator-${index}`, 100)) };
  const nicheLifecycle = buildNicheLifecycleSummary(current, comparison);
  const result = normalizeLongformResponse({ opportunities: [{ key: 'topic-a', nicheLifecycle }] });
  assert.equal(result.opportunities[0].nicheLifecycle?.nicheId, 'topic-a');
  assert.equal(result.opportunities[0].nicheLifecycle?.lifecycle.provenance, 'RETROSPECTIVE');
});

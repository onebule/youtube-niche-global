import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';

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

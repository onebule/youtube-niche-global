import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLongformEvidenceLayer } from '../src/lib/longform-intelligence.ts';

function opportunity(overrides = {}) {
  return {
    key: 'test', topic: 'Topic', mechanism: 'Mechanism', productionType: 'Explainer',
    sampleSize: 12, channelCount: 5, medianViews: 100000, marketOpportunity: 70,
    executionFit: 65, entryScore: 68, confidence: 84, confidenceLabel: 'HIGH',
    lanes: [], metrics: { growth: 22, lowCompetition: 61, smallCreator: 48, creatorDiversity: 72 },
    execution: { score: 65, coverage: 80, rationale: 'Observed' }, representativeVideos: [{ videoId: 'v1' }],
    ...overrides,
  };
}

test('evidence layer preserves observed proxies and never invents revenue', () => {
  const layer = buildLongformEvidenceLayer(opportunity());
  assert.equal(layer.signals.demand.value, 22);
  assert.equal(layer.signals.supply.value, 61);
  assert.equal(layer.signals.smallCreator.value, 48);
  assert.equal(layer.signals.diversity.value, 72);
  assert.deepEqual(layer.revenue, { available: false, value: null });
  assert.deepEqual(layer.riskFlags, []);
});

test('missing metrics stay unknown instead of falling back to zero', () => {
  const layer = buildLongformEvidenceLayer(opportunity({ metrics: { growth: null, lowCompetition: undefined, smallCreator: NaN, creatorDiversity: null } }));
  assert.equal(layer.signals.demand.value, null);
  assert.equal(layer.signals.supply.value, null);
  assert.equal(layer.signals.smallCreator.value, null);
  assert.equal(layer.signals.diversity.value, null);
});

test('sparse evidence produces explicit risk flags', () => {
  const layer = buildLongformEvidenceLayer(opportunity({ sampleSize: 4, channelCount: 2, confidenceLabel: 'LOW', representativeVideos: [], recommendation: 'AVOID' }));
  assert.deepEqual(layer.riskFlags, ['SMALL_SAMPLE', 'NARROW_CREATOR_BASE', 'LOW_CONFIDENCE', 'NO_REPRESENTATIVE_EVIDENCE', 'AVOID_RECOMMENDATION']);
});

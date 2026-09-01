import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNicheLifecycleSummary, compareNicheWindows, NICHE_LIFECYCLE_ALGORITHM_VERSION, NICHE_LIFECYCLE_CONFIG } from '../src/lib/niche-lifecycle.ts';

const row = (videoId, creatorId, performance, views = performance * 10, classification = 'NORMAL', repeat = 'NONE', nicheId = 'niche-a', format = 'long') => ({ nicheId, videoId, creatorId, format, views, normalizedPerformance: performance, subscriberCount: 50_000, baselineStatus: 'VERIFIED', baselineConfidence: 'HIGH', breakoutClassification: classification, breakoutMultiple: classification === 'NORMAL' ? 1 : 4, repeatBreakoutStatus: repeat });
const windowOf = (key, count, creators, performance, options = {}) => ({ nicheId: 'niche-a', format: 'long', key, start: options.start || (key === 'current' ? '2026-08-01T00:00:00.000Z' : '2026-07-01T00:00:00.000Z'), end: options.end || (key === 'current' ? '2026-08-31T00:00:00.000Z' : '2026-07-31T00:00:00.000Z'), timeSemantics: options.timeSemantics || 'PUBLICATION_COHORT_HISTORY', coverage: options.coverage ?? 1, observations: Array.from({ length: count }, (_, index) => row(`${key}-v${index}`, creators[index % creators.length], performance, performance * 10, options.classification || 'NORMAL', options.repeat || 'NONE')) });

test('comparable windows reject unequal dates and tiny samples', () => {
  const current = windowOf('current', 3, ['a', 'b'], 100);
  const previous = windowOf('comparison', 5, ['a', 'b', 'c'], 100, { start: '2026-01-01T00:00:00.000Z', end: '2026-01-15T00:00:00.000Z' });
  const result = compareNicheWindows(current, previous);
  assert.equal(result.comparable, false);
  assert.equal(result.provenance, 'INSUFFICIENT');
  assert.ok(result.blockers.length >= 2);
});

test('healthy growth exposes supply and observed demand acceleration', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 6, ['a', 'b', 'c', 'd'], 160, { classification: 'BREAKOUT' }), windowOf('comparison', 5, ['a', 'b', 'c'], 100, { classification: 'NORMAL' }));
  assert.ok(['EMERGING', 'GROWING'].includes(result.lifecycle.state));
  assert.equal(result.supplyDemandRelationship, 'DEMAND_OUTPACING_SUPPLY');
  assert.ok(result.signals.some(signal => signal.type === 'OBSERVED_DEMAND_ACCELERATION'));
});

test('supply crowding emits supply-outpacing and strong saturation evidence', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 17, ['a', 'b', 'c', 'd', 'e'], 75), windowOf('comparison', 10, ['a', 'b', 'c'], 100));
  assert.equal(result.supplyDemandRelationship, 'SUPPLY_OUTPACING_DEMAND');
  assert.equal(result.lifecycle.state, 'SATURATED');
  assert.equal(result.signals.find(signal => signal.type === 'SATURATION_RISING')?.strength, 'STRONG');
});

test('balanced expansion is not saturation', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 14, ['a', 'b', 'c', 'd', 'e'], 145), windowOf('comparison', 10, ['a', 'b', 'c', 'd'], 100));
  assert.ok(['EMERGING', 'GROWING'].includes(result.lifecycle.state));
  assert.notEqual(result.lifecycle.state, 'SATURATED');
});

test('stable windows classify as mature', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 10, ['a', 'b', 'c'], 100), windowOf('comparison', 10, ['a', 'b', 'c'], 100));
  assert.equal(result.lifecycle.state, 'MATURE');
  assert.equal(result.supply.videoSupplyTrend.direction, 'STABLE');
});

test('multi-dimensional decline classifies as declining', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 6, ['a', 'b', 'c'], 60), windowOf('comparison', 10, ['a', 'b', 'c', 'd'], 100));
  assert.equal(result.lifecycle.state, 'DECLINING');
  assert.equal(result.observedDemand.trend.direction, 'FALLING');
});

test('tiny denominator cannot create high confidence acceleration', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 3, ['a', 'b'], 300), windowOf('comparison', 3, ['a', 'b'], 100));
  assert.equal(result.lifecycle.state, 'INSUFFICIENT');
  assert.equal(result.confidence, 'INSUFFICIENT');
});

test('missing comparison history remains insufficient', () => {
  const current = windowOf('current', 6, ['a', 'b', 'c'], 100);
  const previous = { ...windowOf('comparison', 6, ['a', 'b', 'c'], 100), observations: [] };
  const result = buildNicheLifecycleSummary(current, previous);
  assert.equal(result.lifecycle.state, 'INSUFFICIENT');
  assert.equal(result.supplyDemandRelationship, 'INSUFFICIENT');
});

test('total-view growth caused by doubled supply does not become demand acceleration', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 10, ['a', 'b', 'c', 'd'], 100), windowOf('comparison', 5, ['a', 'b', 'c'], 100));
  assert.equal(result.supply.videoSupplyTrend.direction, 'RISING');
  assert.equal(result.observedDemand.trend.direction, 'STABLE');
  assert.notEqual(result.supplyDemandRelationship, 'DEMAND_OUTPACING_SUPPLY');
});

test('duplicate video rows do not create artificial supply growth', () => {
  const current = windowOf('current', 6, ['a', 'b', 'c'], 100);
  current.observations.push(current.observations[0], current.observations[1]);
  const previous = windowOf('comparison', 6, ['a', 'b', 'c'], 100);
  const result = buildNicheLifecycleSummary(current, previous);
  assert.equal(result.supply.current.videoSupply, 6);
  assert.equal(result.supply.videoSupplyTrend.direction, 'STABLE');
});

test('publication cohort results carry retrospective provenance', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 6, ['a', 'b', 'c'], 100), windowOf('comparison', 6, ['a', 'b', 'c'], 100));
  assert.equal(result.lifecycle.provenance, 'RETROSPECTIVE');
  assert.match(result.observedDemand.current.note, /不是搜索需求/);
});

test('true snapshots preserve snapshot provenance without changing metric definitions', () => {
  const result = buildNicheLifecycleSummary(windowOf('current', 6, ['a', 'b', 'c'], 100, { timeSemantics: 'TRUE_SNAPSHOT_HISTORY' }), windowOf('comparison', 6, ['a', 'b', 'c'], 100, { timeSemantics: 'TRUE_SNAPSHOT_HISTORY' }));
  assert.equal(result.lifecycle.provenance, 'TRUE_SNAPSHOT_HISTORY');
  assert.equal(result.algorithmVersion, NICHE_LIFECYCLE_ALGORITHM_VERSION);
});

test('Shorts observations never enter the long-form lifecycle engine', () => {
  const current = windowOf('current', 6, ['a', 'b', 'c'], 100, { format: 'short' });
  current.observations = current.observations.map(item => ({ ...item, format: 'short' }));
  const previous = windowOf('comparison', 6, ['a', 'b', 'c'], 100);
  const result = buildNicheLifecycleSummary(current, previous);
  assert.equal(result.lifecycle.state, 'INSUFFICIENT');
  assert.equal(NICHE_LIFECYCLE_CONFIG.calibrationStatus, 'CALIBRATION_REQUIRED');
});

test('lifecycle replay is deterministic and versioned', () => {
  const current = windowOf('current', 8, ['a', 'b', 'c', 'd'], 120, { classification: 'BREAKOUT' });
  const previous = windowOf('comparison', 8, ['a', 'b', 'c', 'd'], 100);
  const first = buildNicheLifecycleSummary(current, previous);
  const replay = buildNicheLifecycleSummary(JSON.parse(JSON.stringify(current)), JSON.parse(JSON.stringify(previous)));
  assert.deepEqual(replay, first);
  assert.equal(first.algorithmVersion, NICHE_LIFECYCLE_ALGORITHM_VERSION);
});

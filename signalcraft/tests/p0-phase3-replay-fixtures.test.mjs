import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvidence } from '../src/lib/evidence-contract.ts';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';
import { normalizeOpportunityRadarResponse } from '../src/lib/opportunity-radar.ts';
import { normalizeShortformRadarResponse } from '../src/lib/shortform-opportunity-radar.ts';
import { readResearchUrlState, writeResearchUrlState } from '../src/lib/research-url-state.ts';
import { buildCreatorBreakoutSummary } from '../src/lib/creator-breakout.ts';
import { buildNicheBreakoutSummary } from '../src/lib/niche-signals.ts';
import { buildNicheLifecycleSummary } from '../src/lib/niche-lifecycle.ts';

const longformFixture = {
  schemaVersion: 'longform.v3',
  evidence: {
    source: 'fixture',
    algorithmVersion: 'upstream-lf-1',
    snapshotId: 'snap-lf-1',
    inputSnapshotId: 'input-lf-1',
    requestId: 'req-lf-1',
    capturedAt: '2026-09-01T00:00:00.000Z',
    decisionReasons: [{ code: 'CONTROLLED_TEST', severity: 'SUPPORTING', message: 'Fixture evidence supports a controlled test.' }],
  },
  dataScope: { source: 'fixture', markets: ['US'], window: '28d', latestCapturedAt: '2026-09-01T00:00:00.000Z', collectedRows: 6, longformRows: 6, uncertainRows: 0, classificationCoverage: 100 },
  opportunities: [
    { key: 'b', topic: 'Topic B', mechanism: 'Format B', productionType: 'Tutorial', sampleSize: 4, channelCount: 2, marketOpportunity: 61, executionFit: 59, entryScore: 60, confidence: 72, confidenceLabel: 'MEDIUM', metrics: { growth: 52 }, representativeVideos: [{ videoId: 'vb', title: 'B' }] },
    { key: 'a', topic: 'Topic A', mechanism: 'Format A', productionType: 'Explainer', sampleSize: 8, channelCount: 3, marketOpportunity: 71, executionFit: 68, entryScore: 70, confidence: 84, confidenceLabel: 'HIGH', metrics: { growth: 80 }, representativeVideos: [{ videoId: 'va', title: 'A' }] },
  ],
  gaps: [],
};

test('long-form fixture replay is deterministic and preserves upstream observability', () => {
  const first = normalizeLongformResponse(longformFixture);
  const replay = normalizeLongformResponse(JSON.parse(JSON.stringify(longformFixture)));
  assert.deepEqual(replay, first);
  assert.deepEqual(first.opportunities.map(item => item.key), ['b', 'a']);
  assert.equal(first.evidence.inputSnapshotId, 'input-lf-1');
  assert.equal(first.opportunities[0].upstreamAssessment.decisionReasons[0].code, 'CONTROLLED_TEST');
  assert.equal(first.opportunities[0].entryDecision.status, 'INSUFFICIENT');
});

test('radar fixtures preserve count, order, and explicit empty/filter inputs', () => {
  const payload = { available: true, engineVersion: 'fixture-radar', window: '14d', dataScope: { source: 'fixture', markets: ['US'], historyDays: 30, currentWindowDays: 14, currentRows: 2, historicalRows: 4, latestCapturedAt: null, note: 'fixture' }, events: [{ id: 'e2', title: 'Second' }, { id: 'e1', title: 'First' }], lanes: { ALL: 2 }, gaps: [] };
  const first = normalizeOpportunityRadarResponse(payload);
  const replay = normalizeOpportunityRadarResponse(JSON.parse(JSON.stringify(payload)));
  assert.deepEqual(replay.events.map(event => event.id), ['e2', 'e1']);
  assert.equal(first.events.length, 2);
  assert.deepEqual(first, replay);
  const shorts = normalizeShortformRadarResponse({ ...payload, format: 'SHORT_FORM', events: [{ id: 's2' }, { id: 's1' }] });
  assert.deepEqual(shorts.events.map(event => event.id), ['s2', 's1']);
});

test('research URL state round-trips meaningful controls without workspace data', () => {
  const state = readResearchUrlState('?market=US&window=28d&lane=BREAKOUT&topic=Format%20A&direction=a');
  assert.deepEqual(state, { market: 'US', window: '28d', lane: 'BREAKOUT', topic: 'Format A', direction: 'a' });
  assert.equal(writeResearchUrlState('?source=trend-radar&market=US', { window: '90d', lane: 'ALL', direction: 'a' }), '?source=trend-radar&market=US&window=90d&lane=ALL&direction=a');
  assert.equal(writeResearchUrlState('?topic=Format%20A&lane=BREAKOUT', { topic: undefined, lane: 'ALL' }), '?lane=ALL');
});

test('evidence fixture rejects malformed decision reasons instead of inventing provenance', () => {
  const evidence = normalizeEvidence({ requestId: 'req-1', inputSnapshotId: 'in-1', decisionReasons: [{ code: 'ok', severity: 'UNKNOWN', message: 'discard' }, { code: 'known', severity: 'CONTEXT', message: 'kept' }] });
  assert.equal(evidence.requestId, 'req-1');
  assert.equal(evidence.inputSnapshotId, 'in-1');
  assert.deepEqual(evidence.decisionReasons, [{ code: 'known', severity: 'CONTEXT', message: 'kept' }]);
});

test('creator breakout fixture replay is deterministic and keeps the retrospective boundary', () => {
  const now = new Date('2026-09-01T00:00:00.000Z');
  const video = (id, views, daysAgo) => {
    const published = new Date(now.getTime() - daysAgo * 86_400_000);
    return { id, format: 'long', publishedAt: published.toISOString(), views, snapshots: [{ capturedAt: new Date(published.getTime() + 86_400_000).toISOString(), views }] };
  };
  const fixture = { videos: [...Array.from({ length: 6 }, (_, index) => video(`n${index}`, 20_000, 30 + index)), video('breakout', 800_000, 5)], format: 'long', now };
  const first = buildCreatorBreakoutSummary(fixture);
  const replay = buildCreatorBreakoutSummary({ ...JSON.parse(JSON.stringify(fixture)), now });
  assert.deepEqual(replay, first);
  assert.equal(first.temporalSemantics, 'RETROSPECTIVE_BASELINE');
  assert.equal(first.calibrationStatus, 'CALIBRATION_REQUIRED');
});

test('niche signal replay preserves creator breadth and signal types', () => {
  const observations = Array.from({ length: 6 }, (_, index) => ({ nicheId: 'fixture-niche', videoId: `v${index}`, creatorId: `creator-${index}`, format: 'long', views: 100, subscriberCount: 20_000, baselineStatus: 'VERIFIED', baselineConfidence: 'HIGH', breakoutClassification: index < 3 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index < 3 ? 4 : 1, repeatBreakoutStatus: 'NONE' }));
  const first = buildNicheBreakoutSummary({ nicheId: 'fixture-niche', observations });
  const replay = buildNicheBreakoutSummary({ nicheId: 'fixture-niche', observations: JSON.parse(JSON.stringify(observations)) });
  assert.deepEqual(replay, first);
  assert.equal(first.eligibleCreators, 6);
  assert.ok(first.signals.some(signal => signal.type === 'CROSS_CREATOR_BREAKOUT'));
});

test('niche lifecycle replay preserves retrospective semantics', () => {
  const row = (id, creatorId, performance) => ({ nicheId: 'fixture-niche', videoId: id, creatorId, format: 'long', views: 100, normalizedPerformance: performance, subscriberCount: 20_000, baselineStatus: 'VERIFIED', baselineConfidence: 'HIGH', breakoutClassification: 'NORMAL', breakoutMultiple: 1, repeatBreakoutStatus: 'NONE' });
  const makeWindow = (key, performance) => ({ nicheId: 'fixture-niche', format: 'long', key, start: key === 'current' ? '2026-08-01T00:00:00.000Z' : '2026-07-01T00:00:00.000Z', end: key === 'current' ? '2026-08-31T00:00:00.000Z' : '2026-07-31T00:00:00.000Z', timeSemantics: 'PUBLICATION_COHORT_HISTORY', coverage: 1, observations: Array.from({ length: 6 }, (_, index) => row(`${key}-${index}`, `creator-${index % 3}`, performance)) });
  const first = buildNicheLifecycleSummary(makeWindow('current', 120), makeWindow('comparison', 100));
  const replay = buildNicheLifecycleSummary(JSON.parse(JSON.stringify(makeWindow('current', 120))), JSON.parse(JSON.stringify(makeWindow('comparison', 100))));
  assert.deepEqual(replay, first);
  assert.equal(first.lifecycle.provenance, 'RETROSPECTIVE');
});

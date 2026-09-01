import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveDataQuality, normalizeEvidence, normalizeDataQuality } from '../src/lib/evidence-contract.ts';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';
import { normalizeOpportunityRadarResponse } from '../src/lib/opportunity-radar.ts';
import { normalizeShortformRadarResponse } from '../src/lib/shortform-opportunity-radar.ts';
import { searchYouTubeSignals } from '../src/lib/youtube.ts';
import { getOpportunity } from '../src/lib/mock.ts';
import { calculateSignal } from '../src/lib/scoring.mjs';

test('canonical contracts preserve unknowns and classify insufficient evidence', () => {
  const quality = deriveDataQuality({ sampleVideos: 1, sampleChannels: 0, completeness: 10, missingFields: ['subscribers'] });
  assert.equal(quality.level, 'INSUFFICIENT');
  assert.equal(quality.sampleChannels, 0);
  assert.deepEqual(quality.missingFields, ['subscribers']);
  const evidence = normalizeEvidence({ algorithmVersion: '', snapshotId: 'snap-1', facts: ['views are public'], inferences: [{ statement: 'may be emerging', type: 'LOW_CONFIDENCE' }] });
  assert.equal(evidence.algorithmVersion, null);
  assert.equal(evidence.snapshotId, 'snap-1');
  assert.equal(evidence.facts[0].type, 'FACT');
  assert.equal(evidence.inferences[0].type, 'LOW_CONFIDENCE');
  assert.equal(normalizeDataQuality({ level: 'invalid' }).level, 'INSUFFICIENT');
});

test('Long-form response keeps upstream metadata when supplied and leaves unavailable values null', () => {
  const result = normalizeLongformResponse({
    schemaVersion: 'longform.v3',
    evidence: { schemaVersion: 'longform-evidence.v2', algorithmVersion: 'lf-2026-08', snapshotId: 'snap-9', requestId: 'req-9', capturedAt: '2026-08-31T00:00:00.000Z', source: 'upstream' },
    dataQuality: { level: 'MEDIUM', sampleVideos: 12, sampleChannels: 4, schemaVersion: 'quality.v2' },
    dataScope: { source: 'stored-corpus', latestCapturedAt: '2026-08-31T00:00:00.000Z', longformRows: 12, classificationCoverage: 80 },
    opportunities: [],
  });
  assert.equal(result.schemaVersion, 'longform.v3');
  assert.equal(result.evidence.algorithmVersion, 'lf-2026-08');
  assert.equal(result.evidence.snapshotId, 'snap-9');
  assert.equal(result.dataQuality.level, 'MEDIUM');
});

test('Radar normalizers expose canonical contracts without changing event payloads', () => {
  const radar = normalizeOpportunityRadarResponse({ available: true, engineVersion: 'radar-v2', window: '14d', dataScope: { source: 'stored', markets: ['US'], historyDays: 30, currentWindowDays: 14, currentRows: 0, historicalRows: 0, latestCapturedAt: null, note: 'empty' }, events: [{ id: 'e1', title: 'keep me' }], lanes: {}, gaps: [] });
  assert.equal(radar.events[0].id, 'e1');
  assert.equal(radar.dataQuality.level, 'INSUFFICIENT');
  const shorts = normalizeShortformRadarResponse({ available: true, format: 'SHORT_FORM', dataScope: { source: 'stored', markets: [], historyDays: 30, currentWindowDays: 14, currentRows: 2, historicalRows: 8, latestCapturedAt: null, note: 'partial' }, events: [{ id: 's1' }, { id: 's2' }], lanes: {}, gaps: [] });
  assert.equal(shorts.format, 'SHORT_FORM');
  assert.equal(shorts.dataQuality.level, 'LOW');
  assert.deepEqual(shorts.events.map(event => event.id), ['s1', 's2']);
});

test('YouTube normalizer retains valid incomplete rows and never creates a single-video baseline', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    longOpportunities: [
      { videoId: 'v1', videoUrl: 'https://youtube.com/watch?v=v1', title: null, channelId: null, channelTitle: null, channelUrl: null, views: 1200, subscribers: null, format: 'long', ageDays: 2 },
      { videoId: 'v2', videoUrl: 'https://youtube.com/watch?v=v2', title: 'Complete', channelId: 'c2', channelTitle: 'Creator', channelUrl: 'https://youtube.com/@creator', views: 2400, subscribers: 0, format: 'long', ageDays: 1 },
    ],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const result = await searchYouTubeSignals({ query: 'test', language: '英语', format: 'long', locale: 'en', region: 'US', window: '7d' });
    assert.equal(result.videos.length, 2);
    assert.equal(result.videos[0].title, '未命名公开视频');
    assert.ok(result.videos[0].missingFields.includes('subscribers'));
    assert.equal(result.channels[0].subscribers, null);
    assert.equal(result.channels[0].medianViews, null);
    assert.equal(result.channels[0].baselineStatus, 'INSUFFICIENT');
    assert.equal(result.dataQuality.level, 'LOW');
    const longScore = getOpportunity(result.videos[0]);
    assert.equal(longScore.confidence, 0);
    assert.equal(longScore.opportunityScore, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('Shorts scoring path remains the legacy calculation when shared types gain metadata', () => {
  const video = {
    id: 'short-1', channelId: 'short-channel', title: 'Short', topic: '人物生活', language: '英语', region: 'US', format: 'short', publishedAt: '2026-08-30T00:00:00.000Z', durationSeconds: 20, thumbnail: '', risk: 'low', tags: [],
    snapshots: [{ capturedAt: '2026-08-31T00:00:00.000Z', views: 1000, likes: 20, comments: 3, subscribers: 100 }],
  };
  const actual = getOpportunity(video);
  const expected = calculateSignal({ ...video.snapshots[0], ageHours: 24, sampleCount: 1 }, { medianViews: 1000 });
  assert.deepEqual(actual, { videoId: video.id, ...expected, reasons: actual.reasons });
  assert.equal(actual.confidence, 42);
  assert.equal(actual.opportunityScore, expected.opportunityScore);
});

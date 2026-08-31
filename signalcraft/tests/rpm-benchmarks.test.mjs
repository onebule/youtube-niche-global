import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRpmPublicContext, combineRpmBenchmarks, getRpmBenchmarkForTopic } from '../src/lib/rpm-benchmarks.ts';

test('market benchmark stays unknown when a topic has no public mapping', () => {
  const result = getRpmBenchmarkForTopic('极窄的新兴主题');
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.lowUsd, null);
  assert.equal(result.highUsd, null);
  assert.equal(result.sourceCount, 0);
});

test('topic matching returns a transparent multi-source range', () => {
  const result = getRpmBenchmarkForTopic('AI 工具与自动化教程');
  assert.equal(result.status, 'BENCHMARK');
  assert.equal(result.matchedNiche, 'AI / software');
  assert.equal(result.lowUsd, 4);
  assert.equal(result.highUsd, 25);
  assert.equal(result.midpointUsd, 11);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.confidence, 'LOW');
  assert.equal(result.overlapLowUsd, 5);
  assert.equal(result.overlapHighUsd, 10);
  assert.equal(result.rows.length, 2);
});

test('Chinese science and technology topics use the technology benchmark', () => {
  const result = getRpmBenchmarkForTopic('科学与技术');
  assert.equal(result.matchedNiche, 'Technology');
  assert.equal(result.lowUsd, 4);
  assert.equal(result.highUsd, 18);
});

test('combined range uses the conservative envelope and midpoint median', () => {
  const result = combineRpmBenchmarks([
    { sourceId: 'vidiq', sourceName: 'vidIQ', sourceUrl: 'https://example.com/vidiq', niche: 'Test', lowUsd: 2, highUsd: 6, midpointUsd: 4, capturedAt: '2026-08', note: 'benchmark' },
    { sourceId: 'rpm_meter', sourceName: 'RPM Meter', sourceUrl: 'https://example.com/rpm', niche: 'Test', lowUsd: 5, highUsd: 12, midpointUsd: 8.5, capturedAt: '2026-08', note: 'benchmark' },
  ]);
  assert.equal(result.lowUsd, 2);
  assert.equal(result.highUsd, 12);
  assert.equal(result.midpointUsd, 6.25);
  assert.equal(result.sourceCount, 2);
  assert.equal(result.status, 'BENCHMARK');
  assert.equal(result.overlapLowUsd, 5);
  assert.equal(result.overlapHighUsd, 6);
});

test('invalid benchmark rows are ignored rather than becoming false precision', () => {
  const result = combineRpmBenchmarks([
    { sourceId: 'vidiq', sourceName: 'vidIQ', sourceUrl: 'https://example.com/vidiq', niche: 'Test', lowUsd: 0, highUsd: 10, midpointUsd: 5, capturedAt: '2026-08', note: 'invalid' },
    { sourceId: 'rpm_meter', sourceName: 'RPM Meter', sourceUrl: 'https://example.com/rpm', niche: 'Test', lowUsd: 3, highUsd: 1, midpointUsd: 2, capturedAt: '2026-08', note: 'invalid' },
  ]);
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.rows.length, 0);
});

test('public RPM context reports observable duration and collection-market coverage only', () => {
  const context = buildRpmPublicContext([
    { durationSeconds: 900, sourceMarket: 'jp' },
    { durationSeconds: 300, sourceMarket: 'GB' },
    { durationSeconds: null, sourceMarket: null },
  ]);
  assert.equal(context.videoCount, 3);
  assert.equal(context.durationKnownCount, 2);
  assert.equal(context.midrollEligibleCount, 1);
  assert.equal(context.midrollEligibleShare, 0.5);
  assert.equal(context.marketKnownCount, 2);
  assert.deepEqual(context.sourceMarkets, ['GB', 'JP']);
});

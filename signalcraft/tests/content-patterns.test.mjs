import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentDataAvailability, buildContentPatternReport, stableContentPatternId } from '../src/lib/content-patterns.ts';
import { normalizeLongformResponse } from '../src/lib/longform-response.ts';

const video = (id, creatorId, title, options = {}) => ({
  videoId: id,
  creatorId,
  format: options.format || 'long',
  title,
  durationSeconds: options.durationSeconds ?? 900,
  views: options.views ?? 100_000,
  normalizedPerformance: options.normalizedPerformance ?? null,
  breakoutClassification: options.breakoutClassification ?? null,
  breakoutMultiple: options.breakoutMultiple ?? null,
  channelId: creatorId,
  nicheId: 'niche-a',
  thumbnailUrl: 'https://img.example/thumb.jpg',
});

test('content availability audit is explicit and does not fabricate video-level fields', () => {
  const audit = buildContentDataAvailability([video('v1', 'c1', 'How to build a studio')]);
  assert.equal(audit.scope, 'LONG_FORM');
  assert.equal(audit.fields.videoTitle.status, 'AVAILABLE');
  assert.equal(audit.fields.duration.status, 'AVAILABLE');
  assert.equal(audit.fields.formatClassification.status, 'DERIVABLE');
  assert.equal(audit.fields.transcript.status, 'REQUIRES_NEW_DATA');
  assert.equal(audit.fields.hookText.status, 'REQUIRES_LLM');
  assert.equal(audit.fields.visualFeatures.status, 'REQUIRES_VISION');
  assert.equal(audit.fields.audioFeatures.status, 'REQUIRES_NEW_DATA');
});

test('pattern IDs are stable and canonical', () => {
  assert.equal(stableContentPatternId('TITLE_STRUCTURE', 'titleStructure', 'HOW_TO'), stableContentPatternId('TITLE_STRUCTURE', 'titleStructure', 'how_to'));
  assert.match(stableContentPatternId('DURATION_BAND', 'durationBand', 'OVER_30_MIN'), /^content-pattern-v1:[0-9a-f]{8}$/);
});

test('Shorts are excluded from Long-form candidates and aggregations', () => {
  const report = buildContentPatternReport({ videos: [video('s1', 'short-creator', 'How to win', { format: 'short' }), video('l1', 'long-creator', 'How to win')] });
  assert.equal(report.input.excludedShorts, 1);
  assert.equal(report.input.longFormVideos, 1);
  assert.ok(report.candidates.every(candidate => candidate.sourceVideoId === 'l1'));
});

test('frequency and performance remain separate; raw views alone cannot win', () => {
  const videos = [
    video('v1', 'c1', 'How to make it', { views: 9_000_000 }),
    video('v2', 'c2', 'How to make it', { views: 8_000_000 }),
    video('v3', 'c3', 'How to make it', { views: 7_000_000 }),
    video('v4', 'c1', 'How to make it', { views: 6_000_000 }),
    video('v5', 'c2', 'How to make it', { views: 5_000_000 }),
  ];
  const report = buildContentPatternReport({ videos });
  const title = report.aggregations.find(item => item.pattern.featureValue === 'HOW_TO');
  assert.ok(title);
  assert.equal(title.frequency.occurrences, 5);
  assert.equal(title.performance.medianNormalizedPerformance, null);
  assert.equal(title.performance.rawViewsUsed, false);
  assert.equal(title.winningPattern.status, 'CANDIDATE');
});

test('winning requires normalized performance and breakout evidence across independent creators', () => {
  const videos = [
    video('v1', 'c1', 'How to build a studio', { normalizedPerformance: 1.5, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }),
    video('v2', 'c1', 'How to build a studio', { normalizedPerformance: 1.3, breakoutClassification: 'BREAKOUT', breakoutMultiple: 3 }),
    video('v3', 'c2', 'How to build a studio', { normalizedPerformance: 1.4, breakoutClassification: 'STRONG_BREAKOUT', breakoutMultiple: 5 }),
    video('v4', 'c2', 'How to build a studio', { normalizedPerformance: 1.2, breakoutClassification: 'NORMAL', breakoutMultiple: 1 }),
    video('v5', 'c3', 'How to build a studio', { normalizedPerformance: 1.1, breakoutClassification: 'BREAKOUT', breakoutMultiple: 3 }),
  ];
  const report = buildContentPatternReport({ videos, capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' });
  const title = report.aggregations.find(item => item.pattern.featureValue === 'HOW_TO');
  assert.ok(title);
  assert.equal(title.winningPattern.status, 'WINNING');
  assert.equal(title.repeatability.repeatedAcrossCreators, true);
  assert.equal(title.crossCreatorEvidence.creatorsWithBreakout, 3);
  assert.equal(title.provenance.snapshotId, 'snap-1');
  assert.equal(report.winningPatterns.length, 3); // title structure + instruction signal + duration band
});

test('duplicate videos are deduplicated and deterministic replay is byte-stable', () => {
  const input = [video('v2', 'c2', 'Why did it work?', { normalizedPerformance: 1.2 }), video('v1', 'c1', 'Why did it work?', { normalizedPerformance: 1.3 }), video('v1', 'c1', 'Why did it work?', { normalizedPerformance: 9 })];
  const first = buildContentPatternReport({ videos: input, capturedAt: '2026-09-02T00:00:00.000Z' });
  const second = buildContentPatternReport({ videos: [...input].reverse(), capturedAt: '2026-09-02T00:00:00.000Z' });
  assert.equal(first.input.longFormVideos, 2);
  assert.deepEqual(first, second);
});

test('normalization and confidence never promote a one-creator pattern', () => {
  const videos = Array.from({ length: 8 }, (_, index) => video(`v${index}`, 'same-creator', 'Top 10 tools', { normalizedPerformance: 2, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }));
  const report = buildContentPatternReport({ videos });
  const title = report.aggregations.find(item => item.pattern.featureValue === 'LIST_OR_NUMBER');
  assert.ok(title);
  assert.equal(title.confidence, 'INSUFFICIENT');
  assert.equal(title.winningPattern.status, 'INSUFFICIENT');
  assert.equal(title.repeatability.status, 'INSUFFICIENT');
});

test('Long-form response boundary exposes a conservative content report from representatives', () => {
  const normalized = normalizeLongformResponse({
    available: true,
    engineVersion: 'fixture',
    dataScope: { source: 'fixture', markets: ['US'], window: '28d', latestCapturedAt: '2026-09-02T00:00:00.000Z', collectedRows: 1, longformRows: 1, uncertainRows: 0, classificationCoverage: 100, note: 'fixture' },
    availabilityAudit: { coverage: 0, availableFields: 0, unavailableFields: 0, fields: {} },
    lanes: {},
    opportunities: [{ key: 'one', topic: 'Topic', mechanism: 'Mechanism', productionType: 'Format', sampleSize: 1, channelCount: 1, confidence: 10, confidenceLabel: 'LOW', marketOpportunity: null, executionFit: null, entryScore: null, medianViews: 100, metrics: {}, execution: { score: null, coverage: 0, rationale: '' }, representativeVideos: [video('v1', 'c1', 'How to build a studio')] }],
  });
  assert.equal(normalized.opportunities[0].contentPatterns?.scope, 'LONG_FORM');
  assert.equal(normalized.opportunities[0].contentPatterns?.winningPatterns.length, 0);
  assert.equal(normalized.opportunities[0].contentPatterns?.input.excludedShorts, 0);
});

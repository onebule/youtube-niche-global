import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCreatorBreakout, buildCreatorBaseline, buildCreatorBreakoutSummary, CREATOR_BREAKOUT_ALGORITHM_VERSION } from '../src/lib/creator-breakout.ts';

const NOW = new Date('2026-08-31T00:00:00.000Z');
const video = (id, views, daysAgo, format = 'long', creatorId = 'creator-1') => {
  const publishedAt = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return { id, creatorId, format, publishedAt: publishedAt.toISOString(), durationSeconds: format === 'short' ? 30 : 600, views, snapshots: [{ capturedAt: new Date(publishedAt.getTime() + 86_400_000).toISOString(), views }] };
};

test('famous high-view video can be normal against its own baseline', () => {
  const history = Array.from({ length: 6 }, (_, index) => video(`h${index}`, 5_000_000, 20 + index));
  const result = assessCreatorBreakout({ videos: [...history, video('target', 6_000_000, 1)], target: video('target', 6_000_000, 1), now: NOW });
  assert.equal(result.classification, 'NORMAL');
  assert.equal(result.breakoutMultiple, 1.2);
});

test('small creator strong breakout is visible without subscriber heuristics', () => {
  const history = Array.from({ length: 6 }, (_, index) => video(`h${index}`, 20_000, 20 + index));
  const result = assessCreatorBreakout({ videos: [...history, video('target', 800_000, 1)], target: video('target', 800_000, 1), now: NOW });
  assert.equal(result.classification, 'EXTREME_BREAKOUT');
  assert.equal(result.breakoutMultiple, 40);
});

test('one comparable video is insufficient and produces no ratio', () => {
  const target = video('target', 100_000, 1);
  const result = assessCreatorBreakout({ videos: [video('history', 10_000, 10), target], target, now: NOW });
  assert.equal(result.expectedPerformance.baselineStatus, 'INSUFFICIENT');
  assert.equal(result.classification, 'INSUFFICIENT');
  assert.equal(result.breakoutMultiple, null);
});

test('median and MAD resist a viral historical outlier', () => {
  const history = [20_000, 25_000, 31_000, 28_000, 2_800_000, 27_000].map((views, index) => video(`h${index}`, views, 20 + index));
  const target = video('target', 56_000, 1);
  const baseline = buildCreatorBaseline({ videos: [...history, target], target, now: NOW });
  assert.equal(baseline.status, 'VERIFIED');
  assert.ok(baseline.medianPerformance < 40_000);
  assert.ok(baseline.mad !== null && baseline.mad < baseline.medianPerformance);
});

test('target video is excluded from its own baseline', () => {
  const target = video('target', 10_000_000, 1);
  const history = Array.from({ length: 5 }, (_, index) => video(`h${index}`, 10_000, 10 + index));
  const baseline = buildCreatorBaseline({ videos: [...history, target], target, now: NOW });
  assert.equal(baseline.comparableVideoIds.includes('target'), false);
  assert.equal(baseline.sampleSize, 5);
});

test('mixed Shorts and Long-form remain isolated', () => {
  const longHistory = Array.from({ length: 5 }, (_, index) => video(`l${index}`, 20_000, 20 + index, 'long'));
  const shorts = Array.from({ length: 12 }, (_, index) => video(`s${index}`, 2_000_000, 20 + index, 'short'));
  const target = video('target', 40_000, 1, 'long');
  const baseline = buildCreatorBaseline({ videos: [...longHistory, ...shorts, target], target, now: NOW });
  assert.equal(baseline.sampleSize, 5);
  assert.equal(baseline.comparableVideoIds.some(id => id.startsWith('s')), false);
});

test('high variance lowers canonical confidence', () => {
  const values = [1_000, 2_000, 5_000, 20_000, 1_000_000, 40_000, 3_000, 8_000, 700_000, 600];
  const history = values.map((views, index) => video(`h${index}`, views, 20 + index));
  const target = video('target', 10_000, 1);
  const baseline = buildCreatorBaseline({ videos: [...history, target], target, now: NOW });
  assert.equal(baseline.confidence, 'LOW');
});

test('repeated breakouts require multiple eligible videos', () => {
  const normals = Array.from({ length: 6 }, (_, index) => video(`n${index}`, 20_000, 30 + index));
  const breakouts = [video('b1', 800_000, 10), video('b2', 600_000, 8), video('b3', 900_000, 6)];
  const summary = buildCreatorBreakoutSummary({ videos: [...normals, ...breakouts], format: 'long', now: NOW });
  assert.equal(summary.repeatBreakoutStatus, 'REPEATED');
  assert.ok(summary.breakoutVideos >= 2);
});

test('one-off breakout is not labeled repeated', () => {
  const normals = Array.from({ length: 9 }, (_, index) => video(`n${index}`, 20_000, 30 + index));
  const summary = buildCreatorBreakoutSummary({ videos: [...normals, video('b1', 800_000, 5)], format: 'long', now: NOW });
  assert.equal(summary.repeatBreakoutStatus, 'ONE_OFF');
  assert.equal(summary.breakoutVideos, 1);
});

test('zero baseline is safe and invalid for breakout math', () => {
  const history = Array.from({ length: 5 }, (_, index) => video(`h${index}`, 0, 20 + index));
  const target = video('target', 100_000, 1);
  const result = assessCreatorBreakout({ videos: [...history, target], target, now: NOW });
  assert.equal(result.expectedPerformance.value, null);
  assert.equal(result.breakoutMultiple, null);
  assert.equal(result.classification, 'INSUFFICIENT');
});

test('creator breakout replay is deterministic and versioned', () => {
  const history = Array.from({ length: 6 }, (_, index) => video(`h${index}`, 20_000, 20 + index));
  const target = video('target', 800_000, 1);
  const input = { videos: [...history, target], format: 'long', now: NOW };
  const first = buildCreatorBreakoutSummary(input);
  const second = buildCreatorBreakoutSummary(input);
  assert.equal(first.algorithmVersion, CREATOR_BREAKOUT_ALGORITHM_VERSION);
  assert.deepEqual(first, second);
});

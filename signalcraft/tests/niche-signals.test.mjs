import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNicheBreakoutSummary, NICHE_SIGNAL_ALGORITHM_VERSION } from '../src/lib/niche-signals.ts';

const item = (videoId, creatorId, views, classification = 'NORMAL', subscriberCount = 50_000, baselineConfidence = 'HIGH', repeatBreakoutStatus = 'NONE', nicheId = 'niche-a', format = 'long') => ({ nicheId, videoId, creatorId, format, views, subscriberCount, baselineStatus: 'VERIFIED', baselineConfidence, breakoutClassification: classification, breakoutMultiple: classification === 'NORMAL' ? 1 : 10, repeatBreakoutStatus });
const summary = observations => buildNicheBreakoutSummary({ nicheId: 'niche-a', observations });

test('one creator dominance is not cross-creator breadth', () => {
  const result = summary(Array.from({ length: 8 }, (_, index) => item(`v${index}`, 'creator-1', 1_000_000, 'BREAKOUT')));
  assert.equal(result.eligibleCreators, 1);
  assert.equal(result.breakoutCreators, 1);
  assert.equal(result.signals.find(signal => signal.type === 'CROSS_CREATOR_BREAKOUT')?.strength, 'INSUFFICIENT');
});

test('multiple independent small creators create a small-creator signal', () => {
  const observations = Array.from({ length: 8 }, (_, index) => item(`v${index}`, `creator-${index}`, 100_000, index < 5 ? 'BREAKOUT' : 'NORMAL', 25_000));
  const result = summary(observations);
  assert.equal(result.eligibleSmallCreators, 8);
  assert.equal(result.smallBreakoutCreators, 5);
  assert.equal(result.signals.find(signal => signal.type === 'SMALL_CREATOR_BREAKOUT')?.strength, 'STRONG');
});

test('high views without relative breakout breadth stays unclassified', () => {
  const result = summary(Array.from({ length: 8 }, (_, index) => item(`v${index}`, `large-${index}`, 10_000_000, 'NORMAL', 2_000_000)));
  assert.equal(result.breakoutCreators, 0);
  assert.equal(result.signals.find(signal => signal.type === 'CROSS_CREATOR_BREAKOUT')?.strength, 'WEAK');
});

test('unknown subscriber coverage does not become small creators', () => {
  const result = summary(Array.from({ length: 6 }, (_, index) => item(`v${index}`, `creator-${index}`, 100_000, 'BREAKOUT', null)));
  assert.equal(result.knownCreatorSizeCount, 0);
  assert.equal(result.unknownCreatorSizeCount, 6);
  assert.equal(result.eligibleSmallCreators, 0);
  assert.equal(result.signals.find(signal => signal.type === 'SMALL_CREATOR_BREAKOUT')?.confidence, 'LOW');
});

test('two creators are insufficient for a strong niche conclusion', () => {
  const result = summary([item('v1', 'a', 100_000, 'BREAKOUT'), item('v2', 'b', 100_000, 'BREAKOUT'), item('v3', 'a', 100_000, 'NORMAL'), item('v4', 'b', 100_000, 'NORMAL')]);
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.equal(result.signals.find(signal => signal.type === 'CROSS_CREATOR_BREAKOUT')?.strength, 'INSUFFICIENT');
});

test('duplicate videos do not inflate density or creator breadth', () => {
  const observations = [item('same', 'creator-a', 100_000, 'BREAKOUT'), item('same', 'creator-a', 100_000, 'BREAKOUT'), ...Array.from({ length: 4 }, (_, index) => item(`v${index}`, `creator-${index + 1}`, 100_000))];
  const result = summary(observations);
  assert.equal(result.eligibleVideos, 5);
  assert.equal(result.breakoutVideos, 1);
});

test('repeated breakouts across creators are stronger than one creator repetition', () => {
  const observations = Array.from({ length: 3 }, (_, creatorIndex) => [item(`a${creatorIndex}`, `creator-${creatorIndex}`, 100_000, 'BREAKOUT', 50_000, 'HIGH', 'REPEATED'), item(`b${creatorIndex}`, `creator-${creatorIndex}`, 100_000, 'BREAKOUT', 50_000, 'HIGH', 'REPEATED')]).flat();
  const result = summary(observations);
  assert.equal(result.repeatedBreakoutCreators, 3);
  assert.equal(result.crossCreatorRepeatStatus, 'REPEATED_CROSS_CREATOR');
  assert.equal(result.signals.find(signal => signal.type === 'REPEATED_BREAKOUT')?.strength, 'STRONG');
});

test('one-off viral noise is not repeated cross-creator evidence', () => {
  const observations = Array.from({ length: 8 }, (_, index) => item(`v${index}`, `creator-${index}`, 100_000, index === 0 ? 'EXTREME_BREAKOUT' : 'NORMAL'));
  const result = summary(observations);
  assert.equal(result.crossCreatorRepeatStatus, 'ONE_OFF_CROSS_CREATOR');
  assert.equal(result.signals.find(signal => signal.type === 'REPEATED_BREAKOUT')?.strength, 'INSUFFICIENT');
});

test('high creator concentration is measured on eligible video views', () => {
  const views = [900, 800, 700, 50, 40];
  const result = summary(views.map((viewsValue, index) => item(`v${index}`, `creator-${index}`, viewsValue)));
  assert.equal(result.concentration.scope, 'eligible_video_views_by_creator');
  assert.equal(result.concentration.level, 'HIGH');
  assert.ok(result.signals.some(signal => signal.type === 'CREATOR_CONCENTRATION_HIGH'));
});

test('low creator concentration is exposed without declaring opportunity', () => {
  const result = summary(Array.from({ length: 8 }, (_, index) => item(`v${index}`, `creator-${index}`, 100)));
  assert.equal(result.concentration.level, 'LOW');
  assert.ok(result.signals.some(signal => signal.type === 'CREATOR_CONCENTRATION_LOW'));
});

test('low-confidence creator baselines cap signal strength', () => {
  const observations = Array.from({ length: 8 }, (_, index) => item(`v${index}`, `creator-${index}`, 100_000, 'BREAKOUT', 50_000, 'LOW'));
  const result = summary(observations);
  const signal = result.signals.find(signal => signal.type === 'CROSS_CREATOR_BREAKOUT');
  assert.equal(result.confidence, 'LOW');
  assert.equal(signal?.strength, 'MODERATE');
});

test('Shorts observations are isolated from the Long-form signal engine', () => {
  const result = summary(Array.from({ length: 8 }, (_, index) => item(`s${index}`, `creator-${index}`, 100_000, 'BREAKOUT', 50_000, 'HIGH', 'REPEATED', 'niche-a', 'short')));
  assert.equal(result.eligibleVideos, 0);
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.equal(result.algorithmVersion, NICHE_SIGNAL_ALGORITHM_VERSION);
});

test('niche replay is deterministic and versioned', () => {
  const observations = Array.from({ length: 6 }, (_, index) => item(`v${index}`, `creator-${index}`, 100_000, index < 3 ? 'BREAKOUT' : 'NORMAL'));
  const first = summary(observations);
  const replay = summary(JSON.parse(JSON.stringify(observations)));
  assert.deepEqual(replay, first);
});

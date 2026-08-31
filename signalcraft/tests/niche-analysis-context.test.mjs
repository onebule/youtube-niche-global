import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNicheEvaluationHref, buildTrendRadarHref, contextFromQuery } from '../src/lib/niche-analysis-context.ts';

test('radar hand-off keeps the URL small and carries the source/type/window', () => {
  const context = {
    nicheId: 'event-42',
    nicheName: 'Animated History',
    topicName: 'Animated History',
    contentType: 'LONG_FORM',
    platformType: 'YOUTUBE',
    timeWindow: '30d',
    filters: { market: 'US', lane: 'EMERGING' },
    representativeVideos: [{ videoId: 'video-1', title: 'Evidence' }],
    source: 'TREND_RADAR',
    returnState: { scrollPosition: 880, activeTab: 'EMERGING', filters: { market: 'US' } },
  };
  const href = buildNicheEvaluationHref(context);
  assert.match(href, /^\/longform\?/);
  assert.match(href, /nicheId=event-42/);
  assert.match(href, /source=trend-radar/);
  assert.match(href, /type=long/);
  assert.match(href, /window=30d/);
  assert.doesNotMatch(href, /video-1/);
});

test('evaluation back-link restores radar filter and focus topic without serializing evidence', () => {
  const context = {
    nicheName: 'Animated History',
    topicName: 'Animated History',
    timeWindow: '30d',
    source: 'TREND_RADAR',
    representativeVideos: [{ videoId: 'video-1' }],
    returnState: { scrollPosition: 100, activeTab: 'SMALL_CREATOR', filters: { market: 'GB' } },
  };
  const href = buildTrendRadarHref(context, true);
  assert.match(href, /^\/radar\?/);
  assert.match(href, /topic=Animated\+History/);
  assert.match(href, /restore=1/);
  assert.match(href, /lane=SMALL_CREATOR/);
  assert.match(href, /market=GB/);
  assert.match(buildTrendRadarHref(context, false, 'SUPPLY_GAP'), /lane=SUPPLY_GAP/);
  assert.doesNotMatch(href, /video-1/);
});

test('query context is normalized as a trend-radar source', () => {
  const context = contextFromQuery(new URLSearchParams('nicheId=e-1&nicheName=Animated%20History&topic=Animated%20History&type=long&window=30d&source=trend-radar'));
  assert.equal(context?.source, 'TREND_RADAR');
  assert.equal(context?.nicheId, 'e-1');
  assert.equal(context?.contentType, 'long');
  assert.equal(context?.timeWindow, '30d');
});

test('Shorts radar hand-off uses the isolated Shorts evaluation and return routes', () => {
  const context = {
    nicheId: 'short-event-7',
    nicheName: 'Cat rescue reactions',
    topicName: 'Cat rescue reactions',
    contentType: 'SHORT_FORM',
    format: 'SHORT_FORM',
    timeWindow: '14d',
    source: 'TREND_RADAR',
    returnState: { scrollPosition: 420, filters: { market: 'US', window: '14d' } },
  };
  const evaluationHref = buildNicheEvaluationHref(context);
  assert.match(evaluationHref, /^\/shortform-evaluation\?/);
  assert.match(evaluationHref, /type=short/);
  assert.match(buildTrendRadarHref(context, true), /^\/short-radar\?/);
  assert.match(buildTrendRadarHref(context, true), /restore=1/);
  const parsed = contextFromQuery(new URLSearchParams('nicheName=Cat%20rescue%20reactions&type=short&source=trend-radar'));
  assert.equal(parsed?.contentType, 'short');
});

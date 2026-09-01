import assert from 'node:assert/strict';
import test from 'node:test';
import { beginnerAccessForRadar, competitionForRadar, opportunityStatusForRadar } from '../src/lib/opportunity-presentation.ts';
import { LONG_FORM_OPPORTUNITY_CONFIG, SHORTS_OPPORTUNITY_CONFIG } from '../src/lib/opportunity-config.ts';

const event = (overrides = {}) => ({
  lifecycle: 'CONFIRMED',
  eventType: 'SMALL_CREATOR_BREAKOUT',
  confidence: 'HIGH',
  independentChannelCount: 5,
  sampleVideoCount: 20,
  smallCreatorBreakoutCount: 3,
  creatorConcentrationTop3: 36,
  ...overrides,
});

test('presents cross-channel creator evidence as a recommendation without exposing a score', () => {
  assert.equal(opportunityStatusForRadar(event()).key, 'RECOMMENDED');
  assert.equal(beginnerAccessForRadar(event(), 'zh'), '较高');
  assert.equal(competitionForRadar(event(), 'zh'), '较低');
});

test('keeps sparse or concentrated signals cautious', () => {
  assert.equal(opportunityStatusForRadar(event({ confidence: 'LOW' })).key, 'CAUTION');
  assert.equal(opportunityStatusForRadar(event({ creatorConcentrationTop3: 72 })).key, 'CAUTION');
  assert.equal(beginnerAccessForRadar(event({ creatorConcentrationTop3: 72 }), 'zh'), '较低');
});

test('never treats crowded events as a recommendation just because they have views', () => {
  assert.equal(opportunityStatusForRadar(event({ lifecycle: 'CROWDED', confidence: 'HIGH' })).key, 'AVOID');
});

test('keeps engine thresholds versioned and data-quality gates conservative', () => {
  assert.equal(LONG_FORM_OPPORTUNITY_CONFIG.version, 'LongFormOpportunityV1');
  assert.equal(SHORTS_OPPORTUNITY_CONFIG.version, 'ShortsOpportunityV1');
  assert.equal(opportunityStatusForRadar(event({ dataQuality: 'STALE' })).key, 'CAUTION');
  assert.equal(opportunityStatusForRadar(event({ baseline: { multiWindow: false } })).key, 'CAUTION');
});

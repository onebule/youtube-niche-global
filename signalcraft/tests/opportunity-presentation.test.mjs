import assert from 'node:assert/strict';
import test from 'node:test';
import { beginnerAccessForRadar, competitionForRadar, opportunityStatusForRadar } from '../src/lib/opportunity-presentation.ts';

const event = (overrides = {}) => ({
  lifecycle: 'CONFIRMED',
  eventType: 'SMALL_CREATOR_BREAKOUT',
  confidence: 'HIGH',
  independentChannelCount: 4,
  sampleVideoCount: 12,
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

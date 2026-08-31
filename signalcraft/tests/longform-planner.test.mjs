import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLongformIncomeScenario } from '../src/lib/longform-planner.ts';

test('income planner stays unknown until a user RPM assumption exists', () => {
  const result = calculateLongformIncomeScenario({ targetUsd: 1000, rpmLowUsd: null, rpmHighUsd: null, videosPerMonth: 4, baselineViewsPerVideo: 10000 });
  assert.equal(result.isScenario, false);
  assert.equal(result.monthlyViewsLow, null);
  assert.equal(result.monthlyViewsHigh, null);
});

test('income planner returns a range and scales it by monthly output', () => {
  const result = calculateLongformIncomeScenario({ targetUsd: 1000, rpmLowUsd: 4, rpmHighUsd: 8, videosPerMonth: 4, baselineViewsPerVideo: 10000 });
  assert.equal(result.isScenario, true);
  assert.equal(result.monthlyViewsLow, 125000);
  assert.equal(result.monthlyViewsHigh, 250000);
  assert.equal(result.viewsPerVideoLow, 31250);
  assert.equal(result.viewsPerVideoHigh, 62500);
  assert.equal(result.baselineVideosLow, 12.5);
  assert.equal(result.baselineVideosHigh, 25);
  assert.equal(result.baselineMonthlyViews, 40000);
  assert.equal(result.baselineRevenueLowUsd, 160);
  assert.equal(result.baselineRevenueHighUsd, 320);
});

test('reversed RPM inputs are normalized and invalid capacity remains unknown', () => {
  const result = calculateLongformIncomeScenario({ targetUsd: 500, rpmLowUsd: 10, rpmHighUsd: 5, videosPerMonth: 0, baselineViewsPerVideo: null });
  assert.equal(result.rpmLowUsd, 5);
  assert.equal(result.rpmHighUsd, 10);
  assert.equal(result.viewsPerVideoLow, null);
  assert.equal(result.baselineVideosHigh, null);
  assert.equal(result.baselineMonthlyViews, null);
  assert.equal(result.baselineRevenueLowUsd, null);
});

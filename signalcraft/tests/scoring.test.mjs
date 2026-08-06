import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSignal } from '../src/lib/scoring.mjs';

test('机会评分稳定且落在 0-100', () => {
  const input = { views: 600000, likes: 28000, comments: 1300, subscribers: 42000, ageHours: 36, sampleCount: 4 };
  const a = calculateSignal(input, { medianViews: 18000 });
  const b = calculateSignal(input, { medianViews: 18000 });
  assert.equal(a.opportunityScore, b.opportunityScore);
  assert.ok(a.opportunityScore >= 0 && a.opportunityScore <= 100);
  assert.ok(a.outlierScore > 50);
});

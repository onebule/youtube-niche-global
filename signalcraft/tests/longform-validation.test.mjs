import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLongformValidationPlan } from '../src/lib/longform-validation.ts';

function opportunity(overrides = {}) {
  return { sampleSize: 10, channelCount: 4, confidenceLabel: 'HIGH', recommendation: 'TEST', ...overrides };
}

test('validation plan proposes a small batch only after evidence clears the gate', () => {
  const plan = buildLongformValidationPlan(opportunity());
  assert.equal(plan.recommendedVideos, 3);
  assert.equal(plan.reason, 'READY_FOR_SMALL_TEST');
  assert.ok(plan.successCriteria.includes('Cross-video consistency'));
});

test('thin evidence gets a larger bounded test instead of a build decision', () => {
  const plan = buildLongformValidationPlan(opportunity({ sampleSize: 2, channelCount: 1, confidenceLabel: 'LOW' }));
  assert.equal(plan.recommendedVideos, 5);
  assert.equal(plan.reason, 'THIN_EVIDENCE');
  assert.ok(plan.requiredMetrics.includes('RPM'));
});

test('avoid and insufficient-data recommendations do not create a test batch', () => {
  assert.equal(buildLongformValidationPlan(opportunity({ recommendation: 'AVOID' })).recommendedVideos, null);
  assert.equal(buildLongformValidationPlan(opportunity({ recommendation: 'INSUFFICIENT_DATA' })).reason, 'DO_NOT_ENTER');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateModelCost,
  estimateProjectCost,
  normalizeShotRouterState,
  resolveEffectiveModel,
  routeShot,
  VIDEO_MODEL_REGISTRY,
} from '../src/lib/video-model-router.ts';

const h3 = VIDEO_MODEL_REGISTRY.find(model => model.id === 'minimax-h3');
const seedance = VIDEO_MODEL_REGISTRY.find(model => model.id === 'seedance-2');

test('manual lock always wins over Auto routing', () => {
  const router = normalizeShotRouterState({ selectionMode: 'MANUAL', manualModelId: 'seedance-2', locked: true });
  const routing = { recommendedModel: 'minimax-h3' };
  assert.equal(resolveEffectiveModel(router, routing), 'seedance-2');
  assert.equal(router.locked, true);
});

test('hard capability filtering rejects unavailable audio and planned adapters', () => {
  const result = routeShot({ character: false, characterConsistency: 0, motionComplexity: 40, expressionComplexity: 0, cameraComplexity: 20, physicsComplexity: 20, startFrame: true, endFrame: true, referenceImages: 0, referenceVideo: false, audioRequired: true, duration: 5, resolution: '768P', aspectRatio: '9:16', priority: 'BALANCED' });
  assert.equal(result.recommendedModel, 'minimax-h3');
  assert.ok(result.rejected.some(item => item.modelId === 'veo-3.1'));
  assert.ok(result.rejected.some(item => item.modelId === 'seedance-2' && item.reason.includes('音频')));
});

test('cost and quality strategies can choose different models', () => {
  const registry = VIDEO_MODEL_REGISTRY.map(model => model.id === 'minimax-h3' ? { ...model, resolutions: [...model.resolutions, '720p'], pricing: { ...model.pricing, perSecond: 0.1 } } : model.id === 'seedance-2' ? { ...model, pricing: { ...model.pricing, perSecond: 0.5 } } : model);
  const analysis = { character: false, characterConsistency: 0, motionComplexity: 95, expressionComplexity: 0, cameraComplexity: 95, physicsComplexity: 95, startFrame: true, endFrame: false, referenceImages: 0, referenceVideo: false, audioRequired: false, duration: 5, resolution: '720p', aspectRatio: '16:9', priority: 'BALANCED' };
  const cost = routeShot(analysis, 'COST', registry);
  const quality = routeShot(analysis, 'QUALITY', registry);
  assert.equal(cost.recommendedModel, 'minimax-h3');
  assert.equal(quality.recommendedModel, 'seedance-2');
});

test('legacy data receives safe router defaults', () => {
  const router = normalizeShotRouterState(undefined, { prompt: 'A room', startFrame: true, duration: 5, resolution: '720p', aspectRatio: '9:16' });
  assert.equal(router.selectionMode, 'AUTO');
  assert.equal(router.strategy, 'BALANCED');
  assert.equal(router.locked, false);
  assert.deepEqual(router.attempts, []);
  assert.deepEqual(router.candidates, []);
});

test('failed attempts cannot silently switch the selected model', () => {
  const router = normalizeShotRouterState({ selectionMode: 'MANUAL', manualModelId: 'minimax-h3', locked: true });
  const failedAttempt = { recommendedModel: 'seedance-2' };
  assert.equal(resolveEffectiveModel(router, failedAttempt), 'minimax-h3');
});

test('cost calculation uses configured price, duration, and resolution multiplier', () => {
  const model = { ...h3, pricing: { ...h3.pricing, perSecond: 0.13, resolutionMultipliers: { '2K': 1.6 } } };
  assert.equal(estimateModelCost(model, '5s', '2K'), 1.04);
  const secondModel = { ...seedance, pricing: { ...seedance.pricing, perSecond: 0.2 } };
  assert.equal(estimateModelCost(secondModel, 4, '720p'), 0.8);
});

test('project cost derives the current Auto recommendation when routing is not cached', () => {
  const registry = VIDEO_MODEL_REGISTRY.map(model => model.id === 'seedance-2'
    ? { ...model, pricing: { ...model.pricing, perSecond: 0.2 } }
    : model.id === 'kling-3'
    ? { ...model, pricing: { ...model.pricing, perSecond: 0.4 } }
    : model);
  const total = estimateProjectCost([{ duration: '5s', resolution: '720p', router: { selectionMode: 'AUTO', strategy: 'BALANCED', analysis: { character: false, characterConsistency: 0, motionComplexity: 40, expressionComplexity: 0, cameraComplexity: 20, physicsComplexity: 10, startFrame: true, endFrame: false, referenceImages: 1, referenceVideo: false, audioRequired: false, duration: 5, resolution: '720p', aspectRatio: '9:16', priority: 'BALANCED' } } }], registry);
  assert.equal(total, 1);
});

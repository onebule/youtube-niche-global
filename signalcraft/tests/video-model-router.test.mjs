import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeShot,
  estimateModelCost,
  routeShot,
  VIDEO_MODEL_REGISTRY,
} from '../src/lib/video-model-router.ts';

const h3 = VIDEO_MODEL_REGISTRY.find(model => model.id === 'minimax-h3');
const seedance = VIDEO_MODEL_REGISTRY.find(model => model.id === 'seedance-2');

test('H3 registry advertises image, video reference, and audio capabilities', () => {
  assert.equal(h3.adapterStatus, 'ready');
  assert.equal(h3.capabilities.imageToVideo, true);
  assert.equal(h3.capabilities.referenceVideo, true);
  assert.equal(h3.capabilities.audio, true);
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
  assert.equal(quality.recommendedModel, 'seedance-2-5');
});

test('analyzeShot fills safe defaults and detects H3-relevant media needs', () => {
  const analysis = analyzeShot({ prompt: '人物沿着街道奔跑并说话', referenceMode: 'omni' });
  assert.equal(analysis.character, true);
  assert.equal(analysis.referenceMode, 'omni');
  assert.equal(analysis.audioRequired, true);
  assert.ok(analysis.motionComplexity >= 65);
});

test('cost calculation uses configured price, duration, and resolution multiplier', () => {
  const model = { ...h3, pricing: { ...h3.pricing, perSecond: 0.13, resolutionMultipliers: { '2K': 1.6 } } };
  assert.equal(estimateModelCost(model, '5s', '2K'), 1.04);
  const secondModel = { ...seedance, pricing: { ...seedance.pricing, perSecond: 0.2 } };
  assert.equal(estimateModelCost(secondModel, 4, '720p'), 0.8);
});


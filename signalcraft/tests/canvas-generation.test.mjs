import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageGenerationJob, normalizeVideoGenerationJob, resolveCanvasModelMode } from '../src/lib/canvas-generation.ts';

test('canvas normalizes video lifecycle and preserves lineage fields', () => {
  const job = normalizeVideoGenerationJob({
    id: 'video-1', provider: 'apimart', model: 'seedance-2', prompt: 'A quiet street',
    startImageAssetId: 'asset-start', endImageAssetId: null, duration: '5s', aspectRatio: '16:9', resolution: '720p',
    status: 'completed', progress: 100, videoAssetId: 'asset-video', thumbnailAssetId: null, creditsCost: 4,
    errorCode: null, errorMessage: null, retryable: false, failureStage: null, createdAt: '2026-08-31T00:00:00Z', startedAt: null, completedAt: '2026-08-31T00:01:00Z',
    shotId: 'shot-1', generationSpec: { references: [{ assetId: 'asset-ref', role: 'reference' }] },
  });
  assert.equal(job.status, 'SUCCESS');
  assert.deepEqual(job.sourceAssetIds, ['asset-start']);
  assert.deepEqual(job.referenceAssetIds, ['asset-ref']);
  assert.equal(job.shotId, 'shot-1');
});

test('canvas keeps image failures visible and cost nullable', () => {
  const job = normalizeImageGenerationJob({
    provider: 'apimart', model: 'gpt-image-2', taskId: 'image-1', prompt: 'A paper boat', size: '1:1', resolution: '1k',
    status: 'failed', progress: 99, imageAssetId: null, providerCost: null, createdAt: null, completedAt: null,
    errorCode: 'TIMEOUT', errorMessage: 'Timed out',
  });
  assert.equal(job.status, 'FAILED');
  assert.equal(job.cost, null);
  assert.equal(job.errorCode, 'TIMEOUT');
});

test('custom model mode never gets replaced by auto routing', () => {
  assert.deepEqual(resolveCanvasModelMode('CUSTOM', 'seedance-2'), { routing: 'locked', model: 'seedance-2' });
  assert.deepEqual(resolveCanvasModelMode('QUALITY', 'seedance-2'), { routing: 'auto', strategy: 'QUALITY', model: null });
});


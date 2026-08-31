import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageGenerationJob, normalizeVideoGenerationJob, resolveCanvasModelMode } from '../src/lib/canvas-generation.ts';
import { canvasVersionForGeneration, createCanvasSemantics, recordCanvasGeneration, selectCanvasBestTake } from '../src/lib/canvas-domain.ts';

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

function videoGeneration(id, status = 'completed', progress = status === 'completed' ? 100 : 0) {
  return {
    id,
    provider: 'apimart',
    model: 'seedance-2',
    prompt: `Shot ${id}`,
    startImageAssetId: null,
    endImageAssetId: null,
    duration: '5s',
    aspectRatio: '16:9',
    resolution: '720p',
    status,
    progress,
    videoAssetId: status === 'completed' ? `asset-${id}` : null,
    thumbnailAssetId: null,
    creditsCost: 1,
    errorCode: status === 'failed' ? 'TIMEOUT' : null,
    retryable: status === 'failed',
    failureStage: status === 'failed' ? 'provider' : null,
    errorMessage: status === 'failed' ? 'Timed out' : null,
    createdAt: '2026-08-31T00:00:00Z',
    startedAt: '2026-08-31T00:00:01Z',
    completedAt: status === 'completed' ? '2026-08-31T00:01:00Z' : null,
  };
}

test('canvas generation updates reuse a version and new generations append versions', () => {
  const first = recordCanvasGeneration(createCanvasSemantics(2), videoGeneration('gen-1'));
  const firstVersion = canvasVersionForGeneration(first, 'gen-1');
  assert.equal(firstVersion?.number, 1);

  const failed = recordCanvasGeneration(first, videoGeneration('gen-2', 'failed'));
  assert.equal(canvasVersionForGeneration(failed, 'gen-2')?.number, 2);
  assert.equal(failed.versions.length, 2);
  assert.equal(failed.shot.status, 'failed');

  const recovered = recordCanvasGeneration(failed, videoGeneration('gen-2'));
  assert.equal(recovered.versions.length, 2);
  assert.equal(canvasVersionForGeneration(recovered, 'gen-2')?.number, 2);
  assert.equal(recovered.shot.status, 'completed');
});

test('selecting a canvas best take is immutable and does not create a generation', () => {
  const withVersions = recordCanvasGeneration(
    recordCanvasGeneration(createCanvasSemantics(), videoGeneration('gen-1')),
    videoGeneration('gen-2'),
  );
  const selected = selectCanvasBestTake(withVersions, 'gen-2');
  assert.equal(withVersions.generations.length, 2);
  assert.equal(withVersions.versions.some(version => version.bestTake), false);
  assert.equal(selected.generations.length, 2);
  assert.equal(selected.versions.find(version => version.generationId === 'gen-2')?.bestTake, true);
  assert.equal(selected.nodes.result?.generationId, 'gen-2');
  assert.equal(selected.nodes.result?.bestTake, true);
});

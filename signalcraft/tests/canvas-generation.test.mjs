import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeImageGenerationJob, normalizeVideoGenerationJob, resolveCanvasModelMode } from '../src/lib/canvas-generation.ts';
import { canvasHistoryRestoreTarget, canvasVersionForGeneration, createCanvasSemantics, normalizeCanvasSemantics, recordCanvasGeneration, selectCanvasBestTake } from '../src/lib/canvas-domain.ts';

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

test('canvas refuses to attach a generation from another Shot', () => {
  const shot = createCanvasSemantics(1, '11111111-1111-4111-8111-111111111111');
  const other = { ...videoGeneration('gen-other'), shotId: '22222222-2222-4222-8222-222222222222', generationJobId: 'job-other' };
  assert.equal(recordCanvasGeneration(shot, other), shot);
  const own = recordCanvasGeneration(shot, { ...videoGeneration('gen-own'), shotId: shot.shot.id, generationJobId: 'job-own' });
  assert.equal(own.generations[0].generationJobId, 'job-own');
});

test('saved Shot restores the same identity and every generation version after refresh', () => {
  const shotId = '33333333-3333-4333-8333-333333333333';
  const first = recordCanvasGeneration(
    createCanvasSemantics(1, shotId),
    { ...videoGeneration('gen-v1'), shotId, generationJobId: 'job-v1' },
  );
  const second = recordCanvasGeneration(
    first,
    { ...videoGeneration('gen-v2'), shotId, generationJobId: 'job-v2' },
  );
  const saved = JSON.parse(JSON.stringify({
    generationJobId: 'job-v2',
    semantics: second,
  }));
  const restored = normalizeCanvasSemantics(saved.semantics, 1);

  assert.equal(restored.shot.id, shotId);
  assert.equal(saved.generationJobId, 'job-v2');
  assert.deepEqual(restored.versions.map(version => version.generationId), ['gen-v1', 'gen-v2']);
  assert.deepEqual(restored.generations.map(generation => generation.generationJobId), ['job-v1', 'job-v2']);
});

test('history restore rejects another project, a missing Shot, and legacy lineage', () => {
  const projectId = '123e4567-e89b-42d3-a456-426614174000';
  const shotId = '223e4567-e89b-42d3-a456-426614174000';
  const generation = { ...videoGeneration('gen-history'), generationGroupId: projectId, shotId };
  assert.equal(canvasHistoryRestoreTarget(generation, projectId, [shotId]), shotId);
  assert.equal(canvasHistoryRestoreTarget({ ...generation, generationGroupId: '323e4567-e89b-42d3-a456-426614174000' }, projectId, [shotId]), null);
  assert.equal(canvasHistoryRestoreTarget(generation, projectId, []), null);
  assert.equal(canvasHistoryRestoreTarget(videoGeneration('gen-legacy'), projectId, [shotId]), null);
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

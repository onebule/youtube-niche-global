import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HFZeroGpuH3Provider, HF_ZEROGPU_H3 } from '../src/lib/compute-broker/hf-zerogpu/provider.ts';
import { buildHfH3Invocation, discoverHfH3Api } from '../src/lib/compute-broker/hf-zerogpu/discovery.ts';
import { normalizeHfZeroGpuOutput, sanitizeHfError } from '../src/lib/compute-broker/hf-zerogpu/normalizer.ts';
import { parseVideoComputeRequest } from '../src/lib/compute-broker/validation.ts';
import { isSafeHfVideoPath } from '../src/lib/compute-broker/hf-zerogpu/storage.ts';

const execFileAsync = promisify(execFile);
const root = new URL('..', import.meta.url);
const config = (overrides = {}) => ({ enabled: true, smokeOnly: true, allowRealGeneration: false, space: 'MiniMaxAI/MiniMax-H3-Turbo-Lora', maxWaitSeconds: null, expectedDailyQuotaMinutes: 5, token: 'hf_test_token', ...overrides });
const request = (overrides = {}) => parseVideoComputeRequest({ workflow: 'T2V', model: 'MiniMax-H3', prompt: 'a calm landscape', duration: 5, ...overrides }, 'req-1');

test('ZeroGPU discovery uses the live named endpoint and preserves parameter order', () => {
  const schema = discoverHfH3Api({ named_endpoints: { '/generate_video': { parameters: [{ name: 'duration', type: 'number', default: 5, min: 5, max: 15 }, { name: 'prompt', type: 'str', required: true }, { name: 'seed', type: 'number', default: 0 }], returns: [{ type: 'video' }] } } });
  assert.equal(schema.endpoint, '/generate_video');
  assert.equal(schema.compatible, true);
  const invocation = buildHfH3Invocation(schema, request({ seed: 42 }));
  assert.deepEqual(invocation.inputNames, ['duration', 'prompt', 'seed']);
  assert.deepEqual(invocation.args, [5, 'a calm landscape', 42]);
});

test('incompatible or missing API schemas are explicit', () => {
  assert.equal(discoverHfH3Api({}, 'space').errorCode, 'HF_API_INCOMPATIBLE');
  const schema = discoverHfH3Api({ named_endpoints: { '/status': { parameters: [] } } }, 'space');
  assert.equal(schema.compatible, false);
  assert.equal(schema.errorCode, 'HF_API_CHANGED');
});

test('provider is disabled and cannot submit when real-generation gates are closed', async () => {
  const provider = new HFZeroGpuH3Provider(config({ enabled: false }), { check: async () => { throw new Error('must not call'); }, smoke: async () => { throw new Error('must not call'); } });
  const health = await provider.healthCheck();
  assert.equal(health.state, 'NOT_CONFIGURED');
  await assert.rejects(() => provider.submitJob(request()), /闸门未开启/);
});

test('smoke-only provider rejects ordinary broker requests without invoking the bridge', async () => {
  let calls = 0;
  const provider = new HFZeroGpuH3Provider(config({ allowRealGeneration: true, maxWaitSeconds: 60 }), { check: async () => { calls += 1; throw new Error('must not call'); }, smoke: async () => { calls += 1; throw new Error('must not call'); } });
  await assert.rejects(() => provider.submitJob(request()), /仅允许显式单任务 smoke/);
  assert.equal(calls, 0);
});

test('provider reports included quota as zero USD with low confidence', async () => {
  const provider = new HFZeroGpuH3Provider(config());
  const cost = await provider.estimateCost(request());
  assert.equal(provider.providerId, HF_ZEROGPU_H3);
  assert.equal(provider.providerType, 'FREE_GPU');
  assert.equal(provider.costClass, 'FREE_QUOTA');
  assert.equal(cost.rawCostUsd, 0);
  assert.equal(cost.source, 'INCLUDED_QUOTA');
  assert.equal(cost.confidence, 'LOW');
});

test('authorized smoke materializes and validates exactly one MP4 before success', async () => {
  let smokeCalls = 0;
  let storedInput = null;
  const apiInfo = { named_endpoints: { '/generate': { parameters: [{ name: 'prompt', type: 'str', required: true }], returns: [{ type: 'video' }] } } };
  const provider = new HFZeroGpuH3Provider(config({ allowRealGeneration: true, maxWaitSeconds: 60 }), {
    check: async () => ({ ok: true, auth: 'AUTH_VERIFIED', reachability: 'REACHABLE', runtime: 'RUNNING', hardware: 'zeroGPU', quota: 'UNKNOWN', apiInfo }),
    smoke: async () => { smokeCalls += 1; return { ok: true, providerTaskId: 'hf-task-1', result: { video: { url: 'https://hf.space/output.mp4' } } }; },
  }, async input => { storedInput = input; return { assetId: 'asset-1', path: 'tmp/generated/hf-h3/asset-1.mp4', sourceProvider: 'HF_ZEROGPU_H3', spaceId: input.spaceId, generationId: input.generationId || null, timestamp: '2026-09-04T00:00:00.000Z', contentType: 'video/mp4' }; }, async () => ({ valid: true, state: 'OUTPUT_VALIDATED' }));
  const job = await provider.submitJob(request({ requestId: 'hf-h3-smoke-1' }));
  assert.equal(smokeCalls, 1);
  assert.equal(storedInput.url, 'https://hf.space/output.mp4');
  assert.equal(job.state, 'SUCCEEDED');
  assert.equal(job.output.assetId, 'asset-1');
  assert.equal(job.raw.providerMetrics.costType, 'INCLUDED_QUOTA');
});

test('invalid MP4 validation cannot become a successful provider job', async () => {
  const apiInfo = { named_endpoints: { '/generate': { parameters: [{ name: 'prompt', required: true }], returns: [{ type: 'video' }] } } };
  const provider = new HFZeroGpuH3Provider(config({ allowRealGeneration: true, maxWaitSeconds: 60 }), {
    check: async () => ({ ok: true, auth: 'AUTH_VERIFIED', reachability: 'REACHABLE', runtime: 'RUNNING', hardware: 'zeroGPU', quota: 'UNKNOWN', apiInfo }),
    smoke: async () => ({ ok: true, providerTaskId: 'hf-task-2', result: { video: { url: 'https://hf.space/output.mp4' } } }),
  }, async input => ({ assetId: 'asset-2', path: input.path || 'tmp/generated/hf-h3/asset-2.mp4', sourceProvider: 'HF_ZEROGPU_H3', spaceId: input.spaceId, generationId: input.generationId || null, timestamp: '2026-09-04T00:00:00.000Z', contentType: 'video/mp4' }), async () => ({ valid: false, code: 'INVALID_DURATION' }));
  await assert.rejects(() => provider.submitJob(request({ requestId: 'hf-h3-smoke-2' })), /输出校验失败/);
});

test('output normalization requires an authoritative MP4 candidate', () => {
  const normalized = normalizeHfZeroGpuOutput({ video: { url: 'https://hf.space/file.mp4' }, providerReport: { queueState: 'DONE' } });
  assert.equal(normalized.videoAsset.url, 'https://hf.space/file.mp4');
  assert.equal(normalized.providerReport.confidence, 'LOW');
  assert.equal(normalizeHfZeroGpuOutput({ text: 'not a video' }).videoAsset, null);
  assert.equal(sanitizeHfError(new Error('Bearer hf_secret_value')).includes('hf_secret'), false);
});

test('default commands are safe and never submit a generation', async () => {
  const check = JSON.parse((await execFileAsync(process.execPath, ['scripts/hf-h3-check.mjs'], { cwd: root, env: { ...process.env, HF_ZEROGPU_H3_ENABLED: 'false', HF_TOKEN: 'hf_secret_value' }, windowsHide: true })).stdout);
  assert.equal(check.generationSubmitted, false);
  assert.equal(JSON.stringify(check).includes('hf_secret_value'), false);
  const smoke = JSON.parse((await execFileAsync(process.execPath, ['scripts/hf-h3-smoke.mjs'], { cwd: root, env: { ...process.env, HF_ZEROGPU_H3_ENABLED: 'false', ALLOW_HF_ZEROGPU_REAL_GENERATION: 'false', HF_TOKEN: 'hf_secret_value' }, windowsHide: true })).stdout);
  assert.equal(smoke.generationSubmitted, false);
  assert.equal(smoke.fallback, false);
  assert.equal(smoke.retry, false);
});

test('storage adapter only accepts MP4 assets', () => {
  assert.equal(isSafeHfVideoPath('video.mp4'), true);
  assert.equal(isSafeHfVideoPath('video.webm'), false);
});

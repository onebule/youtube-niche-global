import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { HFZeroGpuH3Provider, HF_ZEROGPU_H3 } from '../src/lib/compute-broker/hf-zerogpu/provider.ts';
import { buildHfH3Invocation, discoverHfH3Api } from '../src/lib/compute-broker/hf-zerogpu/discovery.ts';
import { normalizeHfZeroGpuOutput, sanitizeHfError } from '../src/lib/compute-broker/hf-zerogpu/normalizer.ts';
import { estimateHfGpuSeconds, parseHfQuotaMessage } from '../src/lib/compute-broker/hf-zerogpu/quota.ts';
import { parseVideoComputeRequest } from '../src/lib/compute-broker/validation.ts';
import { isSafeHfVideoPath } from '../src/lib/compute-broker/hf-zerogpu/storage.ts';
import { readComputeBrokerConfig } from '../src/lib/compute-broker/config.ts';

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

test('ZeroGPU invocation maps semantic Canvas labels to a provider-valid fast choice', () => {
  const schema = discoverHfH3Api({ named_endpoints: { '/output_video': { parameters: [
    { label: 'Prompt', parameter_name: 'in_0', type: 'str' },
    { label: 'Canvas', parameter_name: 'in_1', type: 'str' },
  ], returns: [{ type: 'video' }] } } });
  assert.equal(buildHfH3Invocation(schema, request({ aspectRatio: '16:9' })).args[1], '960x544 · 16:9 fast');
});

test('ZeroGPU invocation uses a discovered Turbo 4-step preset without inventing a provider choice', () => {
  const schema = discoverHfH3Api({ named_endpoints: { '/generate': { parameters: [
    { name: 'prompt', type: 'str', required: true },
    { name: 'generation_preset', type: 'str', choices: ['Balanced — best overall', 'Turbo 4-step — fastest, more artifacts'], default: 'Balanced — best overall' },
    { name: 'steps', type: 'number', default: 28 },
  ], returns: [{ type: 'video' }] } } });
  const invocation = buildHfH3Invocation(schema, request({ steps: 28 }));
  assert.equal(invocation.selectedPreset?.value, 'Turbo 4-step — fastest, more artifacts');
  assert.equal(invocation.selectedPreset?.steps, 4);
  assert.deepEqual(invocation.args, ['a calm landscape', 'Turbo 4-step — fastest, more artifacts', 4]);
});

test('compute broker config contains a primary and secondary free H3 Space', () => {
  const spaces = readComputeBrokerConfig({}).hfZeroGpu.spaces;
  assert.deepEqual(spaces.map(space => [space.role, space.kind, space.space]), [
    ['PRIMARY', 'H3_ULTRA_FAST_ZERO', 'mrfakename/minimax-h3-ultra-fast'],
    ['SECONDARY', 'H3_OFFICIAL_ZERO', 'MiniMaxAI/MiniMax-H3-Turbo-Lora'],
  ]);
});

test('ZeroGPU quota messages keep authoritative requested, remaining, and reset estimate values', () => {
  const quota = parseHfQuotaMessage('You have exceeded your free ZeroGPU quota (190s requested vs. 3s left). Try again in 21:58:29.');
  assert.deepEqual(quota, {
    estimatedRequiredGpuSeconds: 190,
    remainingGpuSeconds: 3,
    quotaResetAt: null,
    resetEstimate: '21:58:29',
    quotaStatus: 'INSUFFICIENT',
    source: 'PROVIDER_ERROR',
    observedAt: quota.observedAt,
  });
  assert.equal(estimateHfGpuSeconds(request({ steps: 10, resolution: '960x544' })), 174);
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

test('quota preflight blocks before remote submit and records a non-generation failure', async () => {
  let smokeCalls = 0;
  const apiInfo = { named_endpoints: { '/output_video': { parameters: [{ label: 'Prompt', parameter_name: 'in_0', type: 'str' }], returns: [{ type: 'video' }] } } };
  const provider = new HFZeroGpuH3Provider(config({ allowRealGeneration: true, maxWaitSeconds: 60 }), {
    check: async () => ({ ok: true, auth: 'AUTH_VERIFIED', reachability: 'REACHABLE', runtime: 'RUNNING', hardware: 'zeroGPU', quota: 'INSUFFICIENT', quotaDetails: { estimatedRequiredGpuSeconds: 190, remainingGpuSeconds: 3, quotaResetAt: null, resetEstimate: '21:58:29', quotaStatus: 'INSUFFICIENT', source: 'PROVIDER_ERROR' }, apiInfo }),
    smoke: async () => { smokeCalls += 1; throw new Error('must not submit'); },
  });
  await assert.rejects(() => provider.submitJob(request({ requestId: 'hf-h3-smoke-quota', steps: 10 })), error => {
    assert.equal(error.reason, 'HF_ZERO_GPU_QUOTA_EXHAUSTED');
    assert.equal(error.details.publicCode, 'BLOCKED_BY_HF_QUOTA');
    assert.equal(error.details.quota.quotaStatus, 'INSUFFICIENT');
    assert.equal(error.details.providerMetrics.generationStarted, false);
    assert.equal(error.details.providerMetrics.gpuInferenceStarted, false);
    assert.equal(error.details.providerMetrics.videoGenerated, false);
    assert.equal(error.details.providerMetrics.failureClass, 'RESOURCE_QUOTA');
    assert.equal(error.details.providerMetrics.failureReason, 'HF_ZERO_GPU_QUOTA_EXHAUSTED');
    assert.equal(error.details.providerMetrics.countsTowardModelFailureRate, false);
    return true;
  });
  assert.equal(smokeCalls, 0);
});

test('quota refusal returned by the read-only check keeps the public quota classification', async () => {
  const provider = new HFZeroGpuH3Provider(config({ allowRealGeneration: true, maxWaitSeconds: 60 }), {
    check: async () => ({ ok: false, auth: 'AUTH_VERIFIED', reachability: 'REACHABLE', runtime: 'RUNNING', hardware: 'zeroGPU', quota: 'INSUFFICIENT', code: 'HF_ZERO_GPU_QUOTA_EXHAUSTED', message: 'quota (190s requested vs. 3s left)', quotaDetails: { estimatedRequiredGpuSeconds: 190, remainingGpuSeconds: 3, quotaResetAt: null, resetEstimate: null, quotaStatus: 'INSUFFICIENT', source: 'PROVIDER_PREFLIGHT' } }),
    smoke: async () => { throw new Error('must not submit'); },
  });
  await assert.rejects(() => provider.submitJob(request({ requestId: 'hf-h3-smoke-check-quota' })), error => {
    assert.equal(error.details.publicCode, 'BLOCKED_BY_HF_QUOTA');
    assert.equal(error.details.providerMetrics.generationStarted, false);
    return true;
  });
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
  const workflowTuple = normalizeHfZeroGpuOutput([{ path: '/tmp/h3-output.mp4', mime_type: 'video/mp4' }, 'report', 'refined prompt']);
  assert.equal(workflowTuple.videoAsset.path, '/tmp/h3-output.mp4');
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

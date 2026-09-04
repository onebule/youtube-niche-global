import test from 'node:test';
import assert from 'node:assert/strict';
import { ComputeBroker } from '../src/lib/compute-broker/broker.ts';
import { readComputeBrokerConfig } from '../src/lib/compute-broker/config.ts';
import { MockVideoComputeProvider } from '../src/lib/compute-broker/mock.ts';
import { ProviderRegistry, CircuitBreaker } from '../src/lib/compute-broker/registry.ts';
import { InMemoryComputeJobStore } from '../src/lib/compute-broker/store.ts';
import { parseVideoComputeRequest } from '../src/lib/compute-broker/validation.ts';
import { readModelCacheConfig } from '../src/lib/compute-broker/model-cache.ts';
import { H3ApiProvider, ModalH3Provider } from '../src/lib/compute-broker/providers.ts';
import { buildConditioningCacheKey, UnavailableConditioningCache } from '../src/lib/compute-broker/conditioning-cache.ts';

const config = (overrides = {}) => ({
  ...readComputeBrokerConfig({}),
  enabled: true,
  dryRun: false,
  apiCostGuardRatio: 1.2,
  apiCostGuardCalibrationRequired: false,
  maxFallbacks: 2,
  circuitBreakerFailureThreshold: 3,
  circuitBreakerCooldownMs: 60_000,
  ...overrides,
});

const request = (overrides = {}) => parseVideoComputeRequest({ workflow: 'T2V', model: 'minimax-h3', prompt: 'a calm landscape', generationMode: 'AUTO', duration: 4, ...overrides }, `request-${Math.random()}`);
const broker = (providers, overrides = {}) => new ComputeBroker(new ProviderRegistry(providers), config(overrides), new InMemoryComputeJobStore(), new CircuitBreaker(3, 60_000));
const api = (cost, options = {}) => new MockVideoComputeProvider({ providerId: 'api', providerType: 'API', costClass: 'API', costPerSecondUsd: cost, latencyMs: 100, ...options });
const gpu = (id, cost, options = {}) => new MockVideoComputeProvider({ providerId: id, providerType: id === 'modal' ? 'MODAL_GPU' : 'CHEAP_GPU', costClass: id === 'modal' ? 'FREE_CREDIT' : 'CHEAP_GPU', creditBacked: id === 'modal', costPerSecondUsd: cost, latencyMs: 200, ...options });

test('FREE_FIRST prefers credit-backed GPU over a cheaper API', async () => {
  const result = await broker([gpu('modal', 0.5), api(0.1)]).plan(request({ generationMode: 'FREE_FIRST' }));
  assert.equal(result.selectedProviderId, 'modal');
});

test('LOWEST_COST chooses a cheaper GPU', async () => {
  const result = await broker([gpu('runpod', 0.01), api(0.2)]).plan(request({ generationMode: 'LOWEST_COST' }));
  assert.equal(result.selectedProviderId, 'runpod');
});

test('FASTEST uses observed latency as the tie-breaker', async () => {
  const fast = gpu('runpod', 0.2, { latencyMs: 20 });
  const slow = api(0.2, { latencyMs: 200 });
  const result = await broker([slow, fast]).plan(request({ generationMode: 'FASTEST' }));
  assert.equal(result.selectedProviderId, 'runpod');
});

test('BEST_QUALITY can choose the production-eligible API when quality ties', async () => {
  const result = await broker([gpu('runpod', 0.01), api(0.2)]).plan(request({ generationMode: 'BEST_QUALITY' }));
  assert.equal(result.selectedProviderId, 'api');
});

test('CUSTOM keeps an explicit provider choice', async () => {
  const result = await broker([gpu('modal', 0.1), api(0.01)]).plan(request({ generationMode: 'CUSTOM', providerId: 'modal' }));
  assert.equal(result.selectedProviderId, 'modal');
  assert.deepEqual(result.fallbackChain, ['modal']);
});

test('unavailable providers are not routed', async () => {
  const result = await broker([gpu('modal', 0.1, { health: 'OFFLINE' }), api(null, { health: 'NOT_CONFIGURED' })]).plan(request());
  assert.equal(result.selectedProviderId, null);
});

test('model-missing provider is not routed even when its endpoint is healthy', async () => {
  const result = await broker([gpu('modal', 0.01, { modelState: 'MODEL_MISSING' }), api(0.2)]).plan(request());
  assert.equal(result.selectedProviderId, 'api');
  assert.equal(result.candidates.find(item => item.provider.providerId === 'modal')?.compatible, false);
});

test('API cost guard rejects GPU when the configured API is cheaper', async () => {
  const result = await broker([gpu('runpod', 0.5), api(0.1)]).plan(request({ generationMode: 'LOWEST_COST' }));
  assert.equal(result.selectedProviderId, 'api');
  assert.equal(result.candidates.find(item => item.provider.providerId === 'runpod')?.rejectedReason, 'NEVER_PAY_MORE_THAN_API');
});

test('budget guard returns no provider when every estimate exceeds the budget', async () => {
  const result = await broker([gpu('runpod', 0.5), api(0.5)]).plan(request({ maxCostUsd: 0.01 }));
  assert.equal(result.budgetExceeded, true);
  assert.equal(result.selectedProviderId, null);
});

test('dry run never submits a provider job', async () => {
  const provider = gpu('modal', 0.01);
  const result = await broker([provider], { dryRun: true }).submit(request());
  assert.equal(result.dryRun, true);
  assert.equal(result.status, 'QUEUED');
  assert.equal(provider.calls.submit, 0);
});

test('provider failure falls back once to the next provider', async () => {
  const failing = gpu('modal', 0.01, { success: false, failureReason: 'NO_CAPACITY' });
  const fallback = api(0.2);
  const result = await broker([failing, fallback]).submit(request({ generationMode: 'FREE_FIRST' }));
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.selectedProvider, 'api');
  assert.equal(failing.calls.submit, 1);
  assert.equal(fallback.calls.submit, 1);
});

test('GPU OOM and provider timeout are retryable, while auth failure is not', async () => {
  for (const reason of ['GPU_OOM', 'INFERENCE_TIMEOUT']) {
    const failing = gpu('modal', 0.01, { success: false, failureReason: reason });
    const fallback = api(0.2);
    const result = await broker([failing, fallback]).submit(request({ generationMode: 'FREE_FIRST' }));
    assert.equal(result.status, 'SUCCEEDED');
  }

  const auth = gpu('modal', 0.01, { success: false, failureReason: 'AUTH_ERROR' });
  const authFallback = api(0.2);
  const authResult = await broker([auth, authFallback]).submit(request({ generationMode: 'FREE_FIRST' }));
  assert.equal(authResult.status, 'FAILED');
  assert.equal(authFallback.calls.submit, 0);
});

test('circuit breaker opens after repeated transient failures', async () => {
  const failing = gpu('modal', 0.01, { success: false, failureReason: 'PROVIDER_DOWN' });
  const instance = broker([failing], { maxFallbacks: 0 });
  for (let i = 0; i < 3; i += 1) await instance.submit(request());
  const fourth = await instance.plan(request());
  assert.equal(fourth.selectedProviderId, null);
  assert.equal(failing.calls.submit, 3);
});

test('validation rejects missing I2V asset and unsupported workflow explicitly', () => {
  assert.throws(() => parseVideoComputeRequest({ workflow: 'I2V', prompt: 'x' }), /startImage/);
  assert.throws(() => parseVideoComputeRequest({ workflow: 'FL2V', prompt: 'x', assets: { startImage: 'a' } }), /endImage/);
  assert.throws(() => parseVideoComputeRequest({ workflow: 'L2V', prompt: 'x' }), /workflow/);
});

test('model cache stays explicit and unverified until a real deployment proves it', () => {
  const missing = readModelCacheConfig({});
  assert.equal(missing.state, 'MODEL_MISSING');
  assert.equal(missing.persistent, false);
  assert.equal(missing.calibrationStatus, 'CALIBRATION_REQUIRED');
  const ready = readModelCacheConfig({ H3_MODEL_CACHE_DIR: '/models/h3', H3_MODEL_CACHE_READY: 'true', H3_MODEL_VERSION: 'h3-test' });
  assert.equal(ready.state, 'MODEL_READY');
  assert.equal(ready.persistent, true);
  assert.equal(ready.version, 'h3-test');
  assert.equal(ready.calibrationStatus, 'CALIBRATION_REQUIRED');
});

test('provider credentials stay server-side while the existing gateway can receive user auth', async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), authorization: init.headers?.authorization || null });
    return new Response(JSON.stringify({ status: 'available', modelState: 'MODEL_READY' }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    await new ModalH3Provider({ endpoint: 'https://modal.test', token: 'provider-secret', model: 'MiniMax-H3', costPerSecondUsd: null, hardware: 'H3_ECO' }).healthCheck({ authorization: 'Bearer user-session' });
    await new H3ApiProvider({ endpoint: 'https://gateway.test', token: 'gateway-secret', model: 'minimax-h3', costPerSecondUsd: null }).healthCheck({ authorization: 'Bearer user-session' });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests[0].authorization, 'Bearer provider-secret');
  assert.equal(requests[1].authorization, 'Bearer user-session');
});

test('conditioning cache is a deterministic Phase 2 boundary with no fake hits', async () => {
  const input = { prompt: 'x', startImageHash: 'a', referenceImageHashes: ['b', 'c'], workflow: 'I2V', modelVersion: 'h3-test' };
  assert.equal(buildConditioningCacheKey(input), buildConditioningCacheKey({ ...input, referenceImageHashes: ['c', 'b'] }));
  assert.equal(await new UnavailableConditioningCache().get('missing'), null);
});

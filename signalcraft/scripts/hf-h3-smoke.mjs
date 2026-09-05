#!/usr/bin/env node
import { blockedStatus, buildInvocation, containsMp4, estimateHfQuotaSeconds, endpointAndInputs, runHfBridge } from './hf-bridge-run.mjs';

const truthy = value => String(value || '').trim().toLowerCase() === 'true';
const space = process.env.HF_ZEROGPU_H3_SPACE?.trim() || 'mrfakename/minimax-h3-ultra-fast';
const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim() || '';
const enabled = truthy(process.env.HF_ZEROGPU_H3_ENABLED);
const allow = truthy(process.env.ALLOW_HF_ZEROGPU_REAL_GENERATION);
const smokeOnly = process.env.HF_ZEROGPU_H3_SMOKE_ONLY !== 'false';
const maxWait = Number(process.env.HF_ZEROGPU_MAX_WAIT_SECONDS || 0);
const blocked = !enabled ? 'HF_ZEROGPU_DISABLED' : !allow ? 'REAL_GENERATION_NOT_AUTHORIZED' : !token ? 'BLOCKED_BY_HF_AUTH' : !maxWait ? 'HF_ZEROGPU_MAX_WAIT_CALIBRATION_REQUIRED' : null;
if (blocked) {
  console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state: blocked, generationSubmitted: false, fallback: false, retry: false, smokeOnly }, null, 2));
  process.exit(0);
}

try {
  const check = await runHfBridge('check', { space, token }, 30_000);
  if (!check.ok) {
    console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state: blockedStatus(check.code), generationSubmitted: false, fallback: false, retry: false, code: check.code || null }, null, 2));
    process.exit(0);
  }
  const smokeParameters = { workflow: 'T2V', duration: 5, canvas: '960x544 · 16:9 fast', steps: 10, seed: 42, upsample: false, firstImage: null, lastImage: null, prompt: 'A calm cinematic landscape at sunrise.' };
  const invocation = buildInvocation(check.apiInfo, { prompt: 'A calm cinematic landscape at sunrise.', durationSeconds: smokeParameters.duration, steps: smokeParameters.steps, seed: smokeParameters.seed, aspectRatio: '16:9', resolution: '960x544' });
  if (!invocation) {
    console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state: 'BLOCKED_BY_API_CHANGE', generationSubmitted: false, fallback: false, retry: false }, null, 2));
    process.exit(0);
  }
  const capabilities = endpointAndInputs(check.apiInfo).capabilities || {};
  const selectedPreset = invocation.selectedPreset || null;
  const effectiveSteps = selectedPreset?.steps || smokeParameters.steps;
  const estimatedRequiredGpuSeconds = estimateHfQuotaSeconds({ durationSeconds: smokeParameters.duration, resolution: '960x544', steps: effectiveSteps });
  const quota = check.quotaDetails || null;
  if (quota?.remainingGpuSeconds !== null && quota?.remainingGpuSeconds !== undefined && quota.remainingGpuSeconds < estimatedRequiredGpuSeconds) {
    const quotaDetails = { ...quota, estimatedRequiredGpuSeconds, quotaStatus: 'INSUFFICIENT', source: 'PROVIDER_PREFLIGHT' };
    const providerMetrics = { providerId: 'HF_H3_ULTRA_FAST_ZERO', spaceId: space, ...smokeParameters, steps: effectiveSteps, generationStarted: false, gpuInferenceStarted: false, videoGenerated: false, failureClass: 'RESOURCE_QUOTA', failureReason: 'HF_ZERO_GPU_QUOTA_EXHAUSTED', countsTowardModelFailureRate: false, ...quotaDetails };
    console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state: 'BLOCKED_BY_HF_QUOTA', generationSubmitted: false, fallback: false, retry: false, provider: 'HF_H3_ULTRA_FAST_ZERO', space, selectedPreset, estimatedRequiredGpuSeconds, quota: quotaDetails, providerMetrics, smokeParameters: { ...smokeParameters, steps: effectiveSteps } }, null, 2));
    process.exit(0);
  }
  const smoke = await runHfBridge('smoke', { space, token, invocation, maxWaitSeconds: maxWait }, maxWait * 1000 + 60_000);
  const hasMp4 = Boolean(smoke.ok && containsMp4(smoke.result));
  const state = !smoke.ok ? blockedStatus(smoke.code) : hasMp4 ? 'REAL_HF_ZEROGPU_H3_PASS' : 'REAL_HF_ZEROGPU_H3_FAILED';
  const smokeQuota = smoke.quotaDetails || null;
  const providerMetrics = state === 'BLOCKED_BY_HF_QUOTA' ? { providerId: 'HF_H3_ULTRA_FAST_ZERO', spaceId: space, ...smokeParameters, steps: effectiveSteps, generationStarted: false, gpuInferenceStarted: false, videoGenerated: false, failureClass: 'RESOURCE_QUOTA', failureReason: 'HF_ZERO_GPU_QUOTA_EXHAUSTED', countsTowardModelFailureRate: false, ...(smokeQuota || {}) } : null;
  console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state, generationSubmitted: Boolean(smoke.ok), fallback: false, retry: false, provider: 'HF_H3_ULTRA_FAST_ZERO', space, providerTaskId: smoke.providerTaskId || null, outputValidated: hasMp4, selectedPreset, capabilities, estimatedRequiredGpuSeconds, quota: smokeQuota, providerMetrics, smokeParameters: { ...smokeParameters, steps: effectiveSteps }, providerReport: smoke.providerReport || null, code: smoke.code || null }, null, 2));
} catch (error) {
  console.log(JSON.stringify({ schemaVersion: 'hf-h3-smoke.v1', state: 'REAL_HF_ZEROGPU_H3_FAILED', generationSubmitted: false, fallback: false, retry: false, message: String(error.message || error).slice(0, 500) }, null, 2));
}

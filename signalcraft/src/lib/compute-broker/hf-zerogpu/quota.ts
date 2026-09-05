import type { VideoGenerationRequest } from '../types.ts';

export type HfQuotaStatus = 'SUFFICIENT' | 'INSUFFICIENT' | 'UNKNOWN';
export type HfQuotaSource = 'PROVIDER_PREFLIGHT' | 'PROVIDER_ERROR' | 'CONFIGURED' | 'UNKNOWN';

export type HfQuotaDetails = {
  estimatedRequiredGpuSeconds: number | null;
  remainingGpuSeconds: number | null;
  quotaResetAt: string | null;
  resetEstimate: string | null;
  quotaStatus: HfQuotaStatus;
  source: HfQuotaSource;
  observedAt?: string;
};

const finiteSeconds = (value: unknown) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
};

/**
 * HF's scheduler includes the authoritative requested/remaining values in a
 * quota preflight error. The reset value is deliberately kept as the
 * provider's relative estimate; it is not converted into a fabricated date.
 */
export function parseHfQuotaMessage(message: unknown): HfQuotaDetails | null {
  const source = String(message || '');
  const match = source.match(/\(\s*([0-9]+(?:\.[0-9]+)?)s\s+requested\s+vs\.?\s*([0-9]+(?:\.[0-9]+)?)s\s+left\s*\)/i);
  if (!match) return null;
  const estimatedRequiredGpuSeconds = finiteSeconds(match[1]);
  const remainingGpuSeconds = finiteSeconds(match[2]);
  const resetEstimate = source.match(/try\s+again\s+in\s+([0-9]+(?::[0-9]{2}){1,2})/i)?.[1] || null;
  const resetAt = source.match(/(?:quota\s+reset(?:s|\s+at)?|reset\s+at)\s*[:=]?\s*(20[0-9]{2}-[0-9]{2}-[0-9]{2}T[^\s,)]+)/i)?.[1] || null;
  return {
    estimatedRequiredGpuSeconds,
    remainingGpuSeconds,
    quotaResetAt: resetAt,
    resetEstimate,
    quotaStatus: estimatedRequiredGpuSeconds !== null && remainingGpuSeconds !== null
      ? remainingGpuSeconds < estimatedRequiredGpuSeconds ? 'INSUFFICIENT' : 'SUFFICIENT'
      : 'UNKNOWN',
    source: 'PROVIDER_ERROR',
    observedAt: new Date().toISOString(),
  };
}

/**
 * Mirrors the public H3 Space's duration booking formula for the verified
 * 960x544 fast canvas. This is an admission estimate, not measured runtime.
 */
export function estimateHfGpuSeconds(request: VideoGenerationRequest): number {
  const dimensions = request.resolution.match(/(\d{3,5})\s*x\s*(\d{3,5})/i);
  const width = dimensions ? Number(dimensions[1]) : 960;
  const height = dimensions ? Number(dimensions[2]) : 544;
  const fps = 24;
  const framesPerChunk = 17;
  const latentsPerChunk = 5;
  let frames = Math.max(1, Math.round(request.durationSeconds * fps));
  while (frames % framesPerChunk !== latentsPerChunk) frames += 1;
  const latentFrames = Math.floor((frames - latentsPerChunk) / framesPerChunk) * latentsPerChunk + 2;
  const patches = Math.max(1, Math.floor(height / 32) * Math.floor(width / 32));
  const rows = latentFrames * patches;
  const steps = request.steps ?? 10;
  const denoise = steps * (1.1745e-4 * rows + 3.8396e-9 * rows ** 2);
  const decode = 15 + 15 * (height * width * frames) / (960 * 544 * 124);
  const singleGpuSeconds = Math.max(60, Math.floor(denoise + decode) + 12 + 10);
  const sizeMultiplier = String(process.env.H3_GPU_SIZE || 'xlarge').toLowerCase() === 'xlarge' ? 2 : 1;
  return singleGpuSeconds * sizeMultiplier;
}

export function mergeHfQuotaDetails(details: HfQuotaDetails | null | undefined, estimatedRequiredGpuSeconds: number): HfQuotaDetails {
  const estimated = details?.estimatedRequiredGpuSeconds ?? estimatedRequiredGpuSeconds;
  const remaining = details?.remainingGpuSeconds ?? null;
  return {
    estimatedRequiredGpuSeconds: estimated,
    remainingGpuSeconds: remaining,
    quotaResetAt: details?.quotaResetAt ?? null,
    resetEstimate: details?.resetEstimate ?? null,
    quotaStatus: remaining !== null ? (remaining < estimated ? 'INSUFFICIENT' : 'SUFFICIENT') : 'UNKNOWN',
    source: details?.source || 'UNKNOWN',
    ...(details?.observedAt ? { observedAt: details.observedAt } : {}),
  };
}

export function quotaFailureMetrics(input: {
  providerId: string;
  spaceId: string;
  request: VideoGenerationRequest;
  quota: HfQuotaDetails;
}) {
  return {
    providerId: input.providerId,
    spaceId: input.spaceId,
    workflow: input.request.workflow,
    durationSeconds: input.request.durationSeconds,
    canvas: input.request.aspectRatio,
    steps: input.request.steps ?? 10,
    seed: input.request.seed ?? 42,
    queueMs: null,
    generationMs: null,
    downloadMs: null,
    validationMs: null,
    totalMs: 0,
    costUsd: 0,
    costType: 'INCLUDED_QUOTA',
    quotaSecondsPerGeneration: null,
    videoSecondsPerQuotaMinute: null,
    confidence: 'LOW',
    calibrationRequired: true,
    generationStarted: false,
    gpuInferenceStarted: false,
    videoGenerated: false,
    failureClass: 'RESOURCE_QUOTA',
    failureReason: 'HF_ZERO_GPU_QUOTA_EXHAUSTED',
    countsTowardModelFailureRate: false,
    ...input.quota,
  };
}

'use client';

import { authHeaders } from './auth';
import type { CanvasAgentAction, CanvasAgentContext, CanvasAssetReference } from './canvas-domain';

export type VideoModelId = 'auto' | 'seedance-2' | 'seedance-2-5' | 'minimax-h3';
export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type VideoGenerationCancellation = 'confirmed' | 'requested' | 'unsupported' | 'failed' | 'not_applicable';

export type GenerationSpecReferenceRole = 'character' | 'start_frame' | 'end_frame' | 'motion' | 'style' | 'scene' | 'prop' | 'script' | 'storyboard' | 'reference';
export type GenerationSpecReference = {
  assetId: string;
  role: GenerationSpecReferenceRole;
  priority: number;
  strength: 'strong' | 'weak';
  required: boolean;
  shotId: string | null;
  constraints: string[];
};

/** Provider-neutral request contract shared by the canvas and API boundary. */
export type GenerationSpecV2 = {
  schemaVersion: 2;
  requestId: string;
  taskType: 'image-to-video';
  routing: {
    mode: 'locked' | 'auto';
    requestedModel: VideoModelId;
    resolvedModel: Exclude<VideoModelId, 'auto'> | null;
    reason: string;
  };
  requestedModel: VideoModelId;
  resolvedModel: Exclude<VideoModelId, 'auto'> | null;
  rawPrompt: string;
  normalizedPrompt: string;
  references: GenerationSpecReference[];
  shotId: string | null;
  shotOrder: number | null;
  characterSetId: string | null;
  sceneSetId: string | null;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  styleConstraints: string[];
  motionConstraints: string[];
  identityConstraints: string[];
  outputDestination: 'private-media';
  idempotencyKey: string;
  retryPolicy: { mode: 'manual'; maxAttempts: 0; retryableOnly: true };
  userConfirmed: boolean;
};

type VideoGenerationTimeProfile = { minSeconds: number; maxSeconds: number };

const VIDEO_GENERATION_TIME_PROFILES: Record<VideoModelId, VideoGenerationTimeProfile> = {
  auto: { minSeconds: 60, maxSeconds: 240 },
  'seedance-2': { minSeconds: 60, maxSeconds: 240 },
  'seedance-2-5': { minSeconds: 90, maxSeconds: 300 },
  'minimax-h3': { minSeconds: 60, maxSeconds: 180 },
};

export type VideoGenerationTimeEstimate = {
  minSeconds: number;
  maxSeconds: number;
  elapsedSeconds: number;
  remainingSeconds: number | null;
  actualSeconds: number | null;
};

function parseDurationSeconds(value: string) {
  const seconds = Number.parseInt(String(value || '').replace(/\D/g, ''), 10);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 5;
}

function roundToFive(value: number) {
  return Math.max(5, Math.round(value / 5) * 5);
}

/**
 * Returns a deliberately broad client-side estimate because APIMart does not
 * expose a stable ETA for every provider. A real startedAt/progress pair can
 * tighten the remaining-time estimate without changing the API contract.
 */
export function estimateVideoGenerationTime(input: {
  model: VideoModelId;
  duration: string;
  referenceCount?: number;
  resolution?: string;
  status: GenerationStatus;
  progress?: number;
  startedAt?: string | null;
  createdAt?: string | null;
  completedAt?: string | null;
  now?: number;
}): VideoGenerationTimeEstimate {
  const profile = VIDEO_GENERATION_TIME_PROFILES[input.model] || VIDEO_GENERATION_TIME_PROFILES.auto;
  const durationSeconds = parseDurationSeconds(input.duration);
  const referenceCount = Math.max(1, Number(input.referenceCount) || 1);
  const durationFactor = 1 + Math.max(0, durationSeconds - 5) * 0.035;
  const referenceFactor = 1 + Math.max(0, referenceCount - 1) * 0.025;
  const resolutionFactor = input.resolution === '2K' || input.resolution === '1080p' ? 1.12 : 1;
  const complexityFactor = Math.min(1.8, durationFactor * referenceFactor * resolutionFactor);
  const minSeconds = roundToFive(profile.minSeconds * complexityFactor);
  const maxSeconds = Math.max(minSeconds + 15, roundToFive(profile.maxSeconds * complexityFactor));
  const now = Number.isFinite(input.now) ? Number(input.now) : Date.now();
  const startedAt = input.startedAt ? Date.parse(input.startedAt) : Number.NaN;
  const createdAt = input.createdAt ? Date.parse(input.createdAt) : Number.NaN;
  const completedAt = input.completedAt ? Date.parse(input.completedAt) : Number.NaN;
  const elapsedStart = Number.isFinite(startedAt) ? startedAt : createdAt;
  const elapsedSeconds = Number.isFinite(elapsedStart) && now >= elapsedStart
    ? Math.max(0, Math.floor((now - elapsedStart) / 1000))
    : 0;
  const actualSeconds = input.status === 'completed' && Number.isFinite(elapsedStart) && Number.isFinite(completedAt) && completedAt >= elapsedStart
    ? Math.max(0, Math.floor((completedAt - elapsedStart) / 1000))
    : null;

  if (input.status !== 'queued' && input.status !== 'processing') {
    return { minSeconds, maxSeconds, elapsedSeconds, remainingSeconds: null, actualSeconds };
  }

  const progress = Math.max(0, Math.min(99, Number(input.progress) || 0));
  const progressTotal = progress >= 8 && elapsedSeconds >= 8 ? elapsedSeconds / (progress / 100) : 0;
  const expectedTotal = progressTotal > 0
    ? Math.max(minSeconds, Math.min(maxSeconds, progressTotal))
    : (minSeconds + maxSeconds) / 2;
  const remainingSeconds = input.status === 'processing' && Number.isFinite(startedAt)
    ? Math.max(5, Math.ceil(expectedTotal - elapsedSeconds))
    : null;

  return { minSeconds, maxSeconds, elapsedSeconds, remainingSeconds, actualSeconds };
}

export function formatVideoGenerationTime(seconds: number, zh: boolean) {
  const value = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(value / 60);
  const remainder = value % 60;
  if (zh) {
    if (minutes > 0 && remainder > 0) return `${minutes}分${remainder}秒`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${remainder}秒`;
  }
  if (minutes > 0 && remainder > 0) return `${minutes}m ${remainder}s`;
  if (minutes > 0) return `${minutes} min`;
  return `${remainder}s`;
}

export function formatVideoGenerationTimeRange(minSeconds: number, maxSeconds: number, zh: boolean) {
  return `${formatVideoGenerationTime(minSeconds, zh)}–${formatVideoGenerationTime(maxSeconds, zh)}`;
}

const VIDEO_DURATION_LIMITS: Record<VideoModelId, { min: number; max: number }> = {
  auto: { min: 5, max: 15 },
  'seedance-2': { min: 5, max: 15 },
  'seedance-2-5': { min: 4, max: 30 },
  'minimax-h3': { min: 4, max: 15 },
};

export function videoDurationOptions(model: VideoModelId) {
  const limits = VIDEO_DURATION_LIMITS[model] || VIDEO_DURATION_LIMITS.auto;
  return Array.from({ length: limits.max - limits.min + 1 }, (_, index) => `${limits.min + index}s`);
}

export function normalizeVideoDuration(model: VideoModelId, value: string) {
  const limits = VIDEO_DURATION_LIMITS[model] || VIDEO_DURATION_LIMITS.auto;
  const parsed = Number.parseInt(String(value || ''), 10);
  const seconds = Number.isFinite(parsed) ? parsed : limits.min;
  return `${Math.min(limits.max, Math.max(limits.min, seconds))}s`;
}

export type VideoModel = {
  id: VideoModelId;
  provider?: string;
  enabled: boolean;
  creditsCost?: number | null;
  creditsPerSecond?: number | null;
  ownerUnlimited?: boolean;
  callback?: boolean;
  reason?: string | null;
};

export function estimateVideoCredits(model: VideoModel | null | undefined, duration: string) {
  if (!model || model.ownerUnlimited) return null;
  const seconds = Number.parseInt(String(duration).replace(/\D/g, ''), 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return model.creditsCost ?? null;
  if (model.creditsPerSecond) return model.creditsPerSecond * seconds;
  return model.creditsCost ?? null;
}

export type VideoGeneration = {
  id: string;
  provider: string;
  /** Optional until older API deployments expose the provider task id. */
  providerTaskId?: string | null;
  model: VideoModelId;
  prompt: string;
  startImageAssetId: string;
  endImageAssetId: string | null;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  status: GenerationStatus;
  progress: number;
  videoAssetId: string | null;
  thumbnailAssetId: string | null;
  creditsCost: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  generationSpec?: GenerationSpecV2 | null;
};

export type VideoGenerationPlan = {
  kind: 'video-generation-plan';
  director: { id: 'gpt' | 'claude'; label: string; model: string; mode: string; provider?: string | null };
  model: Exclude<VideoModelId, 'auto'>;
  modelLabel: string;
  referenceMode: 'start-end' | 'omni';
  referenceCount: number;
  referenceImageRoles?: Array<{ index: number; role: string }>;
  prompt: string;
  duration: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  resolution: string;
  imageModel?: string | null;
  estimatedCredits: number | null;
  warnings: string[];
  reasoning: string;
  confidence?: number;
  suggestedActions?: CanvasAgentAction[];
  autoGenerate: false;
  agentFallback?: boolean;
};

type ApiErrorPayload = { error?: string; code?: string; retryable?: boolean };

export class VideoGenerationClientError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = 'VideoGenerationClientError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/video/${path}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...authHeaders(),
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({})) as T & ApiErrorPayload;
  if (!response.ok) throw new VideoGenerationClientError(payload.error || '视频生成服务暂时不可用。', response.status, payload.code);
  return payload;
}

export async function loadVideoModels() {
  const payload = await request<{ models: VideoModel[] }>('models');
  return payload.models;
}

export function buildGenerationSpecV2(input: {
  model: VideoModelId;
  prompt: string;
  startImageAssetId: string;
  endImageAssetId?: string | null;
  referenceMode?: 'start-end' | 'omni';
  referenceImageAssetIds?: string[];
  referenceBindings?: CanvasAssetReference[];
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
}, { requestId, idempotencyKey, shotId = null, shotOrder = null, userConfirmed = true }: { requestId: string; idempotencyKey: string; shotId?: string | null; shotOrder?: number | null; userConfirmed?: boolean }): GenerationSpecV2 {
  const referenceIds = input.referenceMode === 'omni'
    ? Array.from(new Set(input.referenceImageAssetIds || []))
    : [input.startImageAssetId, ...(input.endImageAssetId ? [input.endImageAssetId] : [])];
  const references = referenceIds.filter(Boolean).map((assetId, index) => {
    const binding = input.referenceBindings?.find(item => item.assetId === assetId && (!shotId || item.shotId === shotId));
    const bindingRole = binding?.role && ['character', 'start_frame', 'end_frame', 'motion', 'style', 'scene', 'prop', 'script', 'storyboard', 'reference'].includes(binding.role)
      ? binding.role as GenerationSpecReferenceRole
      : null;
    return {
      assetId,
      role: bindingRole || (input.referenceMode === 'omni' && index > 0 ? 'reference' as const : index === 0 ? 'start_frame' as const : 'end_frame' as const),
      priority: binding ? Math.max(0, Math.min(100, binding.priority)) : index === 0 ? 100 : Math.max(10, 90 - index * 10),
      strength: binding?.strength || (index === 0 || input.referenceMode === 'start-end' ? 'strong' as const : 'weak' as const),
      required: binding?.required ?? index === 0,
      shotId: binding?.shotId || shotId,
      constraints: binding?.constraints?.slice(0, 12) || [],
    };
  });
  const mode = input.model === 'auto' ? 'auto' : 'locked';
  const resolvedModel = input.model === 'auto' ? null : input.model;
  return {
    schemaVersion: 2,
    requestId,
    taskType: 'image-to-video',
    routing: {
      mode,
      requestedModel: input.model,
      resolvedModel,
      reason: mode === 'locked' ? '用户明确指定模型，Agent 不得切换。' : '等待 Router 根据质量、成本和能力数据解析模型。',
    },
    requestedModel: input.model,
    resolvedModel,
    rawPrompt: input.prompt.trim(),
    normalizedPrompt: input.prompt.trim(),
    references,
    shotId,
    shotOrder,
    characterSetId: null,
    sceneSetId: null,
    duration: input.duration,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution,
    styleConstraints: [],
    motionConstraints: [],
    identityConstraints: [],
    outputDestination: 'private-media',
    idempotencyKey,
    retryPolicy: { mode: 'manual', maxAttempts: 0, retryableOnly: true },
    userConfirmed,
  };
}

export async function planVideoGeneration(input: {
  prompt: string;
  preferredModel?: VideoModelId;
  referenceMode: 'start-end' | 'omni';
  referenceCount: number;
  referenceImageAssetIds?: string[];
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  canvasContext?: CanvasAgentContext;
}) {
  // Keep this endpoint to one path segment because the production Vercel
  // function router is configured around `/api/video/[...path]` and only
  // forwards the first segment on legacy deployments.
  const payload = await request<{ plan: VideoGenerationPlan }>('agent-plan', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.plan;
}

export async function uploadVideoInput(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new VideoGenerationClientError('仅支持 JPG、PNG 或 WEBP 图片。', 422, 'VIDEO_INPUT_TYPE_INVALID');
  }
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) {
    throw new VideoGenerationClientError('图片文件须小于 20 MB。', 422, 'VIDEO_INPUT_TOO_LARGE');
  }
  const intent = await request<{
    upload: { assetId: string; uploadUrl: string; uploadHeaders: Record<string, string> };
  }>('upload-intent', {
    method: 'POST',
    body: JSON.stringify({ filename: file.name, contentType: file.type, byteSize: file.size }),
  });
  const uploaded = await fetch(intent.upload.uploadUrl, {
    method: 'PUT',
    headers: intent.upload.uploadHeaders,
    body: file,
  });
  if (!uploaded.ok) throw new VideoGenerationClientError('图片上传未完成，请重新选择图片后再试。', uploaded.status, 'VIDEO_INPUT_UPLOAD_FAILED');
  return intent.upload.assetId;
}

export async function createVideoGeneration(input: {
  model: VideoModelId;
  prompt: string;
  startImageAssetId: string;
  endImageAssetId?: string | null;
  referenceMode?: 'start-end' | 'omni';
  referenceImageAssetIds?: string[];
  referenceBindings?: CanvasAssetReference[];
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
  shotId?: string | null;
  shotOrder?: number | null;
}) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const generationSpec = buildGenerationSpecV2(input, {
    requestId: idempotencyKey,
    idempotencyKey,
    shotId: input.shotId,
    shotOrder: input.shotOrder,
    userConfirmed: true,
  });
  const payload = await request<{ generation: VideoGeneration }>('generate', {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ ...input, idempotencyKey, generationSpec }),
  });
  return payload.generation;
}

export async function refreshVideoGeneration(generationId: string) {
  const payload = await request<{ generation: VideoGeneration }>(`status?generationId=${encodeURIComponent(generationId)}`);
  return payload.generation;
}

export async function cancelVideoGeneration(generationId: string) {
  const payload = await request<{
    generation: VideoGeneration;
    providerCancellation: VideoGenerationCancellation;
  }>('cancel', {
    method: 'POST',
    body: JSON.stringify({ generationId }),
  });
  return payload;
}

export async function loadVideoHistory(limit = 20, offset = 0) {
  const payload = await request<{ generations: VideoGeneration[] }>(`history?limit=${limit}&offset=${offset}`);
  return payload.generations;
}

export async function loadVideoAssetUrl(assetId: string, download = false) {
  const payload = await request<{ asset: { url: string; contentType: string | null; kind: string } }>(
    `asset-url?assetId=${encodeURIComponent(assetId)}${download ? '&download=1' : ''}`,
  );
  return payload.asset.url;
}

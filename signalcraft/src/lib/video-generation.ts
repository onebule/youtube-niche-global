'use client';

import { authHeaders } from './auth';

export type VideoModelId = 'auto' | 'seedance-2' | 'minimax-h3';
export type GenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

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
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
}) {
  const idempotencyKey = globalThis.crypto?.randomUUID?.() || `video-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload = await request<{ generation: VideoGeneration }>('generate', {
    method: 'POST',
    headers: { 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ ...input, idempotencyKey }),
  });
  return payload.generation;
}

export async function refreshVideoGeneration(generationId: string) {
  const payload = await request<{ generation: VideoGeneration }>(`status?generationId=${encodeURIComponent(generationId)}`);
  return payload.generation;
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

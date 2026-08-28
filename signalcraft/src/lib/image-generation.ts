'use client';

import { authHeaders } from './auth';
import { VideoGenerationClientError } from './video-generation';

export type ImageGenerationSize = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageGenerationResolution = '1k' | '2k' | '4k';
export type ImageGenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type ImageGeneration = {
  provider: string;
  model: 'gpt-image-2';
  taskId: string;
  prompt: string | null;
  size: ImageGenerationSize | null;
  resolution: ImageGenerationResolution | null;
  status: ImageGenerationStatus;
  progress: number;
  imageAssetId: string | null;
  imageUrl?: string;
  imageContentType?: string | null;
  providerCost: number | null;
  createdAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type ImageModel = {
  id: 'gpt-image-2';
  provider: string;
  enabled: boolean;
  async: boolean;
  sizes: ImageGenerationSize[];
  resolutions: ImageGenerationResolution[];
  reason: string | null;
};

type ApiErrorPayload = { error?: string; code?: string };

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
  if (!response.ok) throw new VideoGenerationClientError(payload.error || '图片生成服务暂时不可用。', response.status, payload.code);
  return payload;
}

export async function loadImageModels() {
  const payload = await request<{ models: ImageModel[] }>('image-models');
  return payload.models;
}

export async function createImageGeneration(input: {
  prompt: string;
  size: ImageGenerationSize;
  resolution: ImageGenerationResolution;
}) {
  const payload = await request<{ image: ImageGeneration }>('image-generate', {
    method: 'POST',
    body: JSON.stringify({ model: 'gpt-image-2', ...input }),
  });
  return payload.image;
}

export async function refreshImageGeneration(taskId: string) {
  const payload = await request<{ image: ImageGeneration }>(`image-status?taskId=${encodeURIComponent(taskId)}`);
  return payload.image;
}

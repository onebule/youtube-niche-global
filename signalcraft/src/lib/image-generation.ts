'use client';

import { authHeaders } from './auth';
import { VideoGenerationClientError } from './video-generation';
import { clientErrorMessage } from './client-error';
import { scopedStorageKey } from './account-storage';

export type ImageGenerationSize = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageGenerationResolution = '1k' | '2k' | '4k';
export type ImageGenerationStatus = 'queued' | 'processing' | 'completed' | 'failed';

const IMAGE_SIZES = ['1:1', '16:9', '9:16', '4:3', '3:4'] as const satisfies readonly ImageGenerationSize[];
const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'] as const satisfies readonly ImageGenerationResolution[];

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

const IMAGE_HISTORY_STORAGE_KEY = 'signalcraft:image-generation-history:v1';
const IMAGE_HISTORY_LIMIT = 12;

function imageHistoryStorageKey(scope?: string) {
  return scopedStorageKey(IMAGE_HISTORY_STORAGE_KEY, scope || 'anonymous');
}

function isImageGenerationStatus(value: unknown): value is ImageGenerationStatus {
  return value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed';
}

function historyItem(value: unknown): ImageGeneration | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ImageGeneration>;
  const taskId = typeof candidate.taskId === 'string' ? candidate.taskId.trim() : '';
  if (!taskId || taskId.length > 512 || !isImageGenerationStatus(candidate.status)) return null;
  const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.slice(0, 2000) : null;
  const size = IMAGE_SIZES.includes(candidate.size as ImageGenerationSize) ? candidate.size! : null;
  const resolution = IMAGE_RESOLUTIONS.includes(candidate.resolution as ImageGenerationResolution) ? candidate.resolution! : null;
  return {
    provider: typeof candidate.provider === 'string' ? candidate.provider : 'apimart',
    model: 'gpt-image-2',
    taskId,
    prompt,
    size,
    resolution,
    status: candidate.status,
    progress: Math.max(0, Math.min(100, Number(candidate.progress) || 0)),
    imageAssetId: typeof candidate.imageAssetId === 'string' ? candidate.imageAssetId : null,
    // Signed preview URLs are intentionally not persisted because they expire.
    providerCost: Number.isFinite(Number(candidate.providerCost)) ? Number(candidate.providerCost) : null,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : null,
    completedAt: typeof candidate.completedAt === 'string' ? candidate.completedAt : null,
    errorCode: typeof candidate.errorCode === 'string' ? candidate.errorCode : null,
    errorMessage: typeof candidate.errorMessage === 'string' ? candidate.errorMessage : null,
  };
}

export function readImageGenerationHistory(scope?: string): ImageGeneration[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(imageHistoryStorageKey(scope)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(historyItem).filter((item): item is ImageGeneration => Boolean(item)).slice(0, IMAGE_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function writeImageGenerationHistory(items: ImageGeneration[], scope?: string) {
  if (typeof window === 'undefined') return;
  try {
    const serialized = items.map(historyItem).filter((item): item is ImageGeneration => Boolean(item)).slice(0, IMAGE_HISTORY_LIMIT);
    window.localStorage.setItem(imageHistoryStorageKey(scope), JSON.stringify(serialized));
  } catch {
    // Storage may be disabled or full; polling continues in memory.
  }
}

export function upsertImageGenerationHistory(items: ImageGeneration[], task: ImageGeneration) {
  const normalized = historyItem(task);
  if (!normalized) return items;
  return [normalized, ...items.filter(item => item.taskId !== normalized.taskId)].slice(0, IMAGE_HISTORY_LIMIT);
}

type ApiErrorPayload = { error?: unknown; code?: string };

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
  if (!response.ok) throw new VideoGenerationClientError(clientErrorMessage(payload.error, '图片生成服务暂时不可用。'), response.status, payload.code);
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

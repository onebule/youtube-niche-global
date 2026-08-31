import type { ImageGeneration, ImageGenerationStatus } from './image-generation';
import type { GenerationStatus as VideoGenerationStatus, VideoGeneration } from './video-generation';

/** The canvas vocabulary stays provider-neutral even when the existing API
 * uses a smaller set of lifecycle labels. It is a view-model only: submitting
 * and billing still happen through the existing generation services. */
export type CanvasGenerationStatus =
  | 'QUEUED'
  | 'SUBMITTING'
  | 'GENERATING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type CanvasGenerationTaskType = 'image' | 'video';
export type CanvasModelMode = 'AUTO' | 'FAST' | 'QUALITY' | 'CHEAPEST' | 'CUSTOM';

export type CanvasGenerationJob = {
  id: string;
  taskType: CanvasGenerationTaskType;
  status: CanvasGenerationStatus;
  provider: string | null;
  model: string | null;
  shotId: string | null;
  prompt: string;
  sourceAssetIds: string[];
  referenceAssetIds: string[];
  errorCode: string | null;
  errorMessage: string | null;
  cost: number | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type CanvasProviderAdapter = {
  provider: string;
  submit: (input: unknown) => Promise<{ id: string }>;
  getStatus: (id: string) => Promise<CanvasGenerationJob>;
  cancel?: (id: string) => Promise<void>;
};

function videoStatus(status: VideoGenerationStatus): CanvasGenerationStatus {
  if (status === 'queued') return 'QUEUED';
  if (status === 'processing') return 'PROCESSING';
  if (status === 'completed') return 'SUCCESS';
  // A cancelled video is represented as a failed task by the existing API,
  // but retains a stable error code so the canvas can render it distinctly.
  return 'FAILED';
}

function imageStatus(status: ImageGenerationStatus): CanvasGenerationStatus {
  if (status === 'queued') return 'QUEUED';
  if (status === 'processing') return 'GENERATING';
  if (status === 'completed') return 'SUCCESS';
  return 'FAILED';
}

export function normalizeVideoGenerationJob(generation: VideoGeneration): CanvasGenerationJob {
  const spec = generation.generationSpec;
  return {
    id: generation.id,
    taskType: 'video',
    status: generation.errorCode === 'VIDEO_GENERATION_CANCELLED' ? 'CANCELLED' : videoStatus(generation.status),
    provider: generation.provider || null,
    model: generation.model || null,
    shotId: generation.shotId || null,
    prompt: generation.prompt || '',
    sourceAssetIds: [generation.startImageAssetId, generation.endImageAssetId].filter((id): id is string => Boolean(id)),
    referenceAssetIds: (spec?.references || []).map(reference => reference.assetId).filter(Boolean),
    errorCode: generation.errorCode || null,
    errorMessage: generation.errorMessage || null,
    cost: typeof generation.creditsCost === 'number' ? generation.creditsCost : null,
    createdAt: generation.createdAt || null,
    startedAt: generation.startedAt || null,
    completedAt: generation.completedAt || null,
  };
}

export function normalizeImageGenerationJob(generation: ImageGeneration): CanvasGenerationJob {
  return {
    id: generation.taskId,
    taskType: 'image',
    status: imageStatus(generation.status),
    provider: generation.provider || null,
    model: generation.model || null,
    shotId: null,
    prompt: generation.prompt || '',
    sourceAssetIds: [],
    referenceAssetIds: [],
    errorCode: generation.errorCode || null,
    errorMessage: generation.errorMessage || null,
    cost: typeof generation.providerCost === 'number' ? generation.providerCost : null,
    createdAt: generation.createdAt || null,
    startedAt: null,
    completedAt: generation.completedAt || null,
  };
}

/** Map the product-level mode to the existing video router without changing
 * its strategy contract or accidentally overriding a manual model choice. */
export function resolveCanvasModelMode(mode: CanvasModelMode, manualModel: string | null) {
  if (mode === 'CUSTOM') return { routing: 'locked' as const, model: manualModel };
  if (mode === 'QUALITY') return { routing: 'auto' as const, strategy: 'QUALITY' as const, model: null };
  if (mode === 'CHEAPEST') return { routing: 'auto' as const, strategy: 'COST' as const, model: null };
  // FAST and AUTO both use the balanced router today. Keeping FAST explicit
  // lets the UI communicate intent without inventing an unavailable provider.
  return { routing: 'auto' as const, strategy: 'BALANCED' as const, model: null };
}

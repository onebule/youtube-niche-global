import { createHash } from 'node:crypto';

/** Reserved for Phase 2. No request is served from this cache in Phase 1. */
export const CONDITIONING_CACHE_PHASE = 'PHASE_2' as const;

export type ConditioningCacheKeyInput = {
  prompt: string;
  startImageHash?: string | null;
  endImageHash?: string | null;
  referenceImageHashes?: string[];
  referenceVideoHash?: string | null;
  referenceAudioHash?: string | null;
  workflow: string;
  modelVersion: string;
};

export type ConditioningCacheEntry = {
  key: string;
  value: unknown;
  createdAt: string;
  expiresAt: string | null;
};

export type ConditioningCache = {
  get: (key: string) => Promise<ConditioningCacheEntry | null>;
  set: (entry: ConditioningCacheEntry) => Promise<void>;
  delete: (key: string) => Promise<void>;
};

export function buildConditioningCacheKey(input: ConditioningCacheKeyInput) {
  const canonical = JSON.stringify({
    prompt: input.prompt,
    startImageHash: input.startImageHash || null,
    endImageHash: input.endImageHash || null,
    referenceImageHashes: [...(input.referenceImageHashes || [])].sort(),
    referenceVideoHash: input.referenceVideoHash || null,
    referenceAudioHash: input.referenceAudioHash || null,
    workflow: input.workflow,
    modelVersion: input.modelVersion,
  });
  return `conditioning:${createHash('sha256').update(canonical).digest('hex')}`;
}

/** Explicit no-op implementation until a persistent Phase 2 cache is approved. */
export class UnavailableConditioningCache implements ConditioningCache {
  async get() { return null; }
  async set() { /* PHASE_2: do not persist conditioning in Phase 1. */ }
  async delete() { /* PHASE_2: do not persist conditioning in Phase 1. */ }
}

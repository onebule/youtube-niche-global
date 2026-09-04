export type ModelCacheState = 'MODEL_READY' | 'MODEL_LOADING' | 'MODEL_MISSING';

export type ModelCacheDescriptor = {
  modelId: string;
  version: string;
  location: string | null;
  state: ModelCacheState;
  persistent: boolean;
  calibrationStatus: 'CALIBRATION_REQUIRED' | 'VERIFIED';
};

/**
 * Describes model-cache readiness without downloading weights or claiming
 * inference capability. A deployment must set an explicit readiness signal
 * after its own volume, weights, and inference checks are verified.
 */
export function readModelCacheConfig(
  env: Record<string, string | undefined> = process.env,
  modelId = 'MiniMax-H3',
): ModelCacheDescriptor {
  const location = env.H3_MODEL_CACHE_DIR?.trim() || null;
  const ready = String(env.H3_MODEL_CACHE_READY || 'false').toLowerCase() === 'true';
  const loading = String(env.H3_MODEL_CACHE_LOADING || 'false').toLowerCase() === 'true';
  const state: ModelCacheState = ready ? 'MODEL_READY' : loading ? 'MODEL_LOADING' : 'MODEL_MISSING';
  return {
    modelId,
    version: env.H3_MODEL_VERSION?.trim() || 'unversioned',
    location,
    state,
    persistent: Boolean(location),
    calibrationStatus: 'CALIBRATION_REQUIRED',
  };
}

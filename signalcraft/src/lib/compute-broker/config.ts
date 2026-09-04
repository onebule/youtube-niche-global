import type { H3HardwareProfile, ProviderType } from './types.ts';

const boolEnv = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
};

const numberEnv = (value: string | undefined, fallback: number | null) => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const optionalEnv = (value: string | undefined) => value?.trim() || null;

export const H3_HARDWARE_PROFILES: Record<string, H3HardwareProfile> = Object.freeze({
  H3_ULTRA: { id: 'H3_ULTRA', vramGb: { min: 96, target: 120 }, systemRamGb: { min: 64, target: 128 }, precision: ['BF16'], offload: [], productionEligible: true, calibrationStatus: 'CALIBRATION_REQUIRED' },
  H3_HIGH: { id: 'H3_HIGH', vramGb: { min: 48, target: 80 }, systemRamGb: { min: 48, target: 96 }, precision: ['BF16', 'INT8 hybrid'], offload: ['CPU offload'], productionEligible: true, calibrationStatus: 'CALIBRATION_REQUIRED' },
  H3_ECO: { id: 'H3_ECO', vramGb: { min: 24, target: 32 }, systemRamGb: { min: 64, target: 128 }, precision: ['INT8', 'FP8'], offload: ['Group Offload'], productionEligible: true, calibrationStatus: 'CALIBRATION_REQUIRED' },
  H3_SURVIVAL: { id: 'H3_SURVIVAL', vramGb: { min: 16, target: 24 }, systemRamGb: { min: 32, target: 64 }, precision: ['INT8'], offload: ['Heavy CPU offload'], productionEligible: false, calibrationStatus: 'CALIBRATION_REQUIRED' },
});

export const H3_PRESETS = Object.freeze({
  DRAFT: {
    name: 'DRAFT',
    resolution: '544x960',
    durationSeconds: 4,
    steps: 12,
    audio: false,
    preferredHardware: 'H3_ECO' as const,
    calibrationStatus: 'CALIBRATION_REQUIRED' as const,
  },
  FINAL: {
    name: 'FINAL',
    resolution: '1080p',
    durationSeconds: 8,
    steps: 30,
    audio: true,
    preferredHardware: 'H3_HIGH' as const,
    calibrationStatus: 'CALIBRATION_REQUIRED' as const,
  },
});

export type ComputeBrokerConfig = {
  enabled: boolean;
  dryRun: boolean;
  apiCostGuardRatio: number;
  apiCostGuardCalibrationRequired: boolean;
  maxFallbacks: number;
  circuitBreakerFailureThreshold: number;
  circuitBreakerCooldownMs: number;
  modal: { endpoint: string | null; token: string | null; model: string; costPerSecondUsd: number | null; hardware: keyof typeof H3_HARDWARE_PROFILES };
  cheapGpu: { endpoint: string | null; apiKey: string | null; model: string; costPerSecondUsd: number | null; hardware: keyof typeof H3_HARDWARE_PROFILES };
  h3Api: { endpoint: string; token: string | null; model: string; costPerSecondUsd: number | null };
};

/**
 * Server-only configuration. The feature flag is intentionally off by
 * default; dry-run is intentionally on whenever the flag is enabled without
 * an explicit override, so a deployment cannot accidentally spend credits.
 */
export function readComputeBrokerConfig(env: NodeJS.ProcessEnv = process.env): ComputeBrokerConfig {
  const guardRatio = numberEnv(env.API_COST_GUARD_RATIO, 1.2) || 1.2;
  return {
    enabled: boolEnv(env.VIDEO_COMPUTE_BROKER_ENABLED, false),
    dryRun: boolEnv(env.VIDEO_COMPUTE_BROKER_DRY_RUN, true),
    apiCostGuardRatio: guardRatio,
    apiCostGuardCalibrationRequired: !Boolean(env.API_COST_GUARD_RATIO?.trim()),
    maxFallbacks: Math.max(0, Math.floor(numberEnv(env.VIDEO_COMPUTE_MAX_FALLBACKS, 2) || 0)),
    circuitBreakerFailureThreshold: Math.max(1, Math.floor(numberEnv(env.VIDEO_COMPUTE_CIRCUIT_FAILURE_THRESHOLD, 3) || 3)),
    circuitBreakerCooldownMs: Math.max(1000, Math.floor(numberEnv(env.VIDEO_COMPUTE_CIRCUIT_COOLDOWN_MS, 60_000) || 60_000)),
    modal: {
      endpoint: optionalEnv(env.MODAL_H3_ENDPOINT),
      token: optionalEnv(env.MODAL_H3_TOKEN),
      model: env.MODAL_H3_MODEL?.trim() || 'MiniMax-H3',
      costPerSecondUsd: numberEnv(env.MODAL_H3_COST_PER_SECOND_USD, null),
      hardware: (env.MODAL_H3_HARDWARE?.trim() as keyof typeof H3_HARDWARE_PROFILES) || 'H3_ECO',
    },
    cheapGpu: {
      endpoint: optionalEnv(env.RUNPOD_H3_ENDPOINT),
      apiKey: optionalEnv(env.RUNPOD_API_KEY),
      model: env.RUNPOD_H3_MODEL?.trim() || 'MiniMax-H3',
      costPerSecondUsd: numberEnv(env.RUNPOD_H3_COST_PER_SECOND_USD, null),
      hardware: (env.RUNPOD_H3_HARDWARE?.trim() as keyof typeof H3_HARDWARE_PROFILES) || 'H3_ECO',
    },
    h3Api: {
      endpoint: env.VIDEO_GATEWAY_BASE_URL?.trim() || 'https://youtube-niche-global-api.vercel.app/api/video',
      token: optionalEnv(env.VIDEO_GATEWAY_AUTH_TOKEN),
      model: env.H3_API_MODEL?.trim() || 'minimax-h3',
      costPerSecondUsd: numberEnv(env.H3_API_COST_PER_SECOND_USD, null),
    },
  };
}

export const providerPriority: ProviderType[] = ['MODAL_GPU', 'CHEAP_GPU', 'API'];

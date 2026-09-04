import type { CostEstimate, ProviderCandidate, VideoGenerationRequest } from './types.ts';

export type CostPolicy = {
  apiCostGuardRatio: number;
  apiCostGuardCalibrationRequired: boolean;
};

const qualityMultiplier = (request: VideoGenerationRequest) => request.qualityPreset === 'FINAL' ? 2 : 1;

export function estimateConfiguredCost(
  request: VideoGenerationRequest,
  costPerSecondUsd: number | null,
  source: CostEstimate['source'] = 'ENVIRONMENT',
  note = '成本来自服务端配置，尚未由 benchmark 校准。',
): CostEstimate {
  if (costPerSecondUsd === null) {
    return { rawCostUsd: null, effectiveCostUsd: null, successRate: null, confidence: 'LOW', source: 'UNKNOWN', notes: ['成本未配置，不能宣称最低成本。'] };
  }
  const rawCostUsd = Number((costPerSecondUsd * request.durationSeconds * qualityMultiplier(request)).toFixed(6));
  return { rawCostUsd, effectiveCostUsd: null, successRate: null, confidence: 'LOW', source, notes: [note, 'successRate 数据不足，effectiveCost 保持未知。'] };
}

export function withObservedSuccessRate(estimate: CostEstimate, successRate: number | null): CostEstimate {
  if (successRate === null || !Number.isFinite(successRate) || successRate <= 0 || successRate > 1 || estimate.rawCostUsd === null) return estimate;
  return { ...estimate, successRate, effectiveCostUsd: Number((estimate.rawCostUsd / successRate).toFixed(6)), confidence: 'MEDIUM', source: estimate.source === 'UNKNOWN' ? 'TELEMETRY' : estimate.source, notes: [...estimate.notes, 'effectiveCost = rawCost / observed successRate。'] };
}

export function passesApiCostGuard(candidate: ProviderCandidate, api: ProviderCandidate | null, policy: CostPolicy) {
  if (!api || candidate.cost.rawCostUsd === null || api.cost.rawCostUsd === null) return { allowed: true, reason: 'API 或候选成本未知，成本保护无法比较，保留低置信度。' };
  const candidateCost = candidate.cost.effectiveCostUsd ?? candidate.cost.rawCostUsd;
  const apiCost = api.cost.effectiveCostUsd ?? api.cost.rawCostUsd;
  if (candidateCost === null || apiCost === null) return { allowed: true, reason: 'effectiveCost 未完整，成本保护无法比较。' };
  const allowed = candidateCost <= apiCost * policy.apiCostGuardRatio;
  return {
    allowed,
    reason: allowed
      ? `候选有效成本 ${candidateCost} 不高于 API 成本保护线 ${Number((apiCost * policy.apiCostGuardRatio).toFixed(6))}。`
      : `候选有效成本 ${candidateCost} 超过 API 成本保护线 ${Number((apiCost * policy.apiCostGuardRatio).toFixed(6))}。${policy.apiCostGuardCalibrationRequired ? '保护比例仍需校准。' : ''}`,
  };
}

export function comparableCost(candidate: ProviderCandidate) {
  return candidate.cost.effectiveCostUsd ?? candidate.cost.rawCostUsd ?? Number.POSITIVE_INFINITY;
}

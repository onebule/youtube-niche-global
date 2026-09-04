import { ComputeRequestError, type AssetInputs, type GenerationMode, type QualityPreset, type VideoGenerationRequest, type Workflow } from './types.ts';

const workflows = new Set<Workflow>(['T2V', 'I2V', 'FL2V', 'REF2V']);
const modes = new Set<GenerationMode>(['AUTO', 'FREE_FIRST', 'LOWEST_COST', 'FASTEST', 'BEST_QUALITY', 'CUSTOM']);
const presets = new Set<QualityPreset>(['DRAFT', 'FINAL']);

const optionalText = (value: unknown, max = 2048) => typeof value === 'string' && value.trim().length <= max ? value.trim() || null : null;
const optionalStringList = (value: unknown, maxItems = 9) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, maxItems).map(item => item.trim()) : [];

function assets(value: unknown): AssetInputs {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    startImage: optionalText(source.startImage),
    endImage: optionalText(source.endImage),
    referenceImages: optionalStringList(source.referenceImages),
    referenceVideo: optionalText(source.referenceVideo),
    referenceAudio: optionalText(source.referenceAudio),
  };
}

export function parseVideoComputeRequest(input: unknown, requestId = crypto.randomUUID()): VideoGenerationRequest {
  if (!input || typeof input !== 'object') throw new ComputeRequestError('请求体必须是 JSON 对象。');
  const source = input as Record<string, unknown>;
  const workflow = String(source.workflow || '').toUpperCase() as Workflow;
  if (!workflows.has(workflow)) throw new ComputeRequestError('workflow 必须是 T2V、I2V、FL2V 或 REF2V。', 'UNSUPPORTED_WORKFLOW');
  const generationMode = String(source.generationMode || 'AUTO').toUpperCase() as GenerationMode;
  if (!modes.has(generationMode)) throw new ComputeRequestError('generationMode 不受支持。');
  const qualityPreset = String(source.qualityPreset || 'DRAFT').toUpperCase() as QualityPreset;
  if (!presets.has(qualityPreset)) throw new ComputeRequestError('qualityPreset 必须是 DRAFT 或 FINAL。');
  const prompt = typeof source.prompt === 'string' ? source.prompt.trim() : '';
  if (!prompt) throw new ComputeRequestError('prompt 不能为空。');
  if (prompt.length > 12_000) throw new ComputeRequestError('prompt 不能超过 12000 个字符。');
  const durationSeconds = Number(source.duration ?? source.durationSeconds ?? 4);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 60) throw new ComputeRequestError('duration 必须在 1–60 秒之间。');
  const maxCostRaw = source.maxCostUsd;
  const maxCostUsd = maxCostRaw === null || maxCostRaw === undefined || maxCostRaw === '' ? null : Number(maxCostRaw);
  if (maxCostUsd !== null && (!Number.isFinite(maxCostUsd) || maxCostUsd < 0)) throw new ComputeRequestError('maxCostUsd 必须是非负数字。');
  const rawSteps = source.steps === null || source.steps === undefined || source.steps === '' ? null : Number(source.steps);
  if (rawSteps !== null && (!Number.isInteger(rawSteps) || rawSteps < 1 || rawSteps > 200)) throw new ComputeRequestError('steps 必须是 1–200 的整数。');
  const rawSeed = source.seed === null || source.seed === undefined || source.seed === '' ? null : Number(source.seed);
  if (rawSeed !== null && (!Number.isInteger(rawSeed) || rawSeed < 0)) throw new ComputeRequestError('seed 必须是非负整数。');
  const parsedAssets = assets(source.assets);
  if (workflow === 'I2V' && !parsedAssets.startImage) throw new ComputeRequestError('I2V 需要 assets.startImage。');
  if (workflow === 'FL2V' && (!parsedAssets.startImage || !parsedAssets.endImage)) throw new ComputeRequestError('FL2V 需要 startImage 和 endImage。');
  if (workflow === 'REF2V' && !parsedAssets.referenceImages?.length && !parsedAssets.referenceVideo && !parsedAssets.referenceAudio) throw new ComputeRequestError('REF2V 至少需要一个参考素材。');
  return {
    requestId: optionalText(source.requestId, 160) || requestId,
    model: optionalText(source.model, 160),
    workflow,
    generationMode,
    prompt,
    negativePrompt: optionalText(source.negativePrompt, 6_000),
    assets: parsedAssets,
    durationSeconds,
    aspectRatio: optionalText(source.aspectRatio, 32) || '16:9',
    resolution: optionalText(source.resolution, 32) || (qualityPreset === 'DRAFT' ? '544x960' : '1080p'),
    steps: rawSteps,
    seed: rawSeed,
    audio: Boolean(source.audio),
    qualityPreset,
    maxCostUsd,
    requestedProviderId: optionalText(source.providerId || source.requestedProviderId, 160),
    deadlineMs: source.deadlineMs === null || source.deadlineMs === undefined ? null : Math.max(1000, Number(source.deadlineMs) || 0),
  };
}

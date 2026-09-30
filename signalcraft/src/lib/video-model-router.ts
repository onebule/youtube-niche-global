import type { VideoModel, VideoModelId } from './video-generation';

export type ModelRoutingStrategy = 'BALANCED' | 'COST' | 'QUALITY';
export type RoutableVideoModelId = Exclude<VideoModelId, 'auto'> | 'veo-3.1' | 'runway-gen-4';
export type ModelAdapterStatus = 'ready' | 'planned' | 'disabled';

export type VideoModelCapability = {
  textToVideo: boolean;
  imageToVideo: boolean;
  startFrame: boolean;
  endFrame: boolean;
  referenceImages: boolean;
  referenceVideo: boolean;
  audio: boolean;
  omniReference: boolean;
};

export type VideoModelDefinition = {
  id: RoutableVideoModelId;
  label: string;
  provider: string;
  adapterStatus: ModelAdapterStatus;
  capabilities: VideoModelCapability;
  strengths: {
    character: number;
    characterConsistency: number;
    motion: number;
    expression: number;
    camera: number;
    physics: number;
    realism: number;
    reference: number;
    audio: number;
  };
  limitations: string[];
  duration: { minSeconds: number; maxSeconds: number };
  resolutions: string[];
  aspectRatios: string[];
  pricing: { perSecond: number | null; resolutionMultipliers: Record<string, number>; note?: string };
  speed: number;
  reliability: number;
  qualityFloor: number;
};

export type ShotAnalysis = {
  character: boolean;
  characterConsistency: number;
  motionComplexity: number;
  expressionComplexity: number;
  cameraComplexity: number;
  physicsComplexity: number;
  startFrame: boolean;
  endFrame: boolean;
  referenceImages: number;
  referenceVideo: boolean;
  audioRequired: boolean;
  duration: number;
  resolution: string;
  aspectRatio: string;
  referenceMode: 'start-end' | 'omni' | 'text';
  priority: ModelRoutingStrategy;
};

export type ModelSelectionMode = 'AUTO' | 'MANUAL';
export type GenerationAttemptStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type GenerationInputSnapshot = {
  prompt: string;
  startImageAssetId: string | null;
  endImageAssetId: string | null;
  duration: string;
  aspectRatio: string;
  resolution: string;
};
export type GenerationAttempt = {
  id: string;
  generationId: string | null;
  modelId: RoutableVideoModelId;
  shotId: string;
  status: GenerationAttemptStatus;
  errorType: string | null;
  latency: number | null;
  estimatedCost: number | null;
  actualCost: number | null;
  userSelected: boolean;
  userFeedback: string | null;
  input: GenerationInputSnapshot;
  createdAt: string;
};
export type VideoCandidate = {
  id: string;
  shotId: string;
  attemptId: string;
  modelId: RoutableVideoModelId;
  generationId: string | null;
  status: GenerationAttemptStatus;
  videoAssetId: string | null;
  thumbnailAssetId: string | null;
  errorMessage: string | null;
  createdAt: string;
};
export type ShotRouterState = {
  selectionMode: ModelSelectionMode;
  manualModelId: RoutableVideoModelId | null;
  locked: boolean;
  strategy: ModelRoutingStrategy;
  analysis: ShotAnalysis;
  lastRouting: ModelRoutingResult | null;
  attempts: GenerationAttempt[];
  candidates: VideoCandidate[];
  activeCandidateId: string | null;
};

export type ModelRoutingAlternative = {
  modelId: RoutableVideoModelId;
  score: number;
  eligible: boolean;
  reason: string;
};

export type ModelRoutingResult = {
  recommendedModel: Exclude<VideoModelId, 'auto'> | null;
  score: number;
  reason: string[];
  alternatives: ModelRoutingAlternative[];
  rejected: Array<{ modelId: RoutableVideoModelId; reason: string }>;
};

export const ROUTER_SCORING_WEIGHTS = Object.freeze({
  quality: { BALANCED: 0.55, COST: 0.35, QUALITY: 0.72 },
  cost: { BALANCED: 0.2, COST: 0.45, QUALITY: 0.05 },
  reliability: { BALANCED: 0.15, COST: 0.1, QUALITY: 0.18 },
  speed: { BALANCED: 0.1, COST: 0.1, QUALITY: 0.05 },
});

const RESOLUTION_MULTIPLIERS = Object.freeze({ '480p': 0.7, '720p': 1, '768P': 1, '1080p': 1.25, '2K': 1.6, '4K': 2.2 });
const IMAGE_TO_VIDEO_CAPABILITIES: VideoModelCapability = {
  textToVideo: false,
  imageToVideo: true,
  startFrame: true,
  endFrame: true,
  referenceImages: true,
  referenceVideo: false,
  audio: false,
  omniReference: true,
};

export const VIDEO_MODEL_REGISTRY: VideoModelDefinition[] = [
  {
    id: 'minimax-h3', label: 'MiniMax H3', provider: 'minimax', adapterStatus: 'ready',
    capabilities: { ...IMAGE_TO_VIDEO_CAPABILITIES, referenceVideo: true, audio: true },
    strengths: { character: 86, characterConsistency: 88, motion: 74, expression: 84, camera: 72, physics: 68, realism: 82, reference: 88, audio: 70 },
    limitations: ['输入图片尺寸和画幅受 Provider 规则约束'], duration: { minSeconds: 4, maxSeconds: 15 }, resolutions: ['768P', '2K'], aspectRatios: ['9:16', '16:9', '1:1'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: '由服务端积分配置提供' }, speed: 72, reliability: 78, qualityFloor: 68,
  },
  {
    id: 'seedance-2', label: 'Seedance 2.0', provider: 'seedance', adapterStatus: 'ready', capabilities: IMAGE_TO_VIDEO_CAPABILITIES,
    strengths: { character: 90, characterConsistency: 92, motion: 89, expression: 88, camera: 86, physics: 82, realism: 90, reference: 91, audio: 30 },
    limitations: ['实际可用时长、分辨率与积分由服务端模型配置决定'], duration: { minSeconds: 5, maxSeconds: 15 }, resolutions: ['480p', '720p', '1080p'], aspectRatios: ['9:16', '16:9', '1:1'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: '由服务端积分配置提供' }, speed: 62, reliability: 74, qualityFloor: 72,
  },
  {
    id: 'seedance-2-5', label: 'Seedance 2.5', provider: 'seedance', adapterStatus: 'ready', capabilities: IMAGE_TO_VIDEO_CAPABILITIES,
    strengths: { character: 91, characterConsistency: 93, motion: 91, expression: 89, camera: 88, physics: 84, realism: 92, reference: 92, audio: 35 },
    limitations: ['实际可用时长、分辨率与积分由服务端模型配置决定'], duration: { minSeconds: 4, maxSeconds: 30 }, resolutions: ['480p', '720p', '1080p'], aspectRatios: ['9:16', '16:9', '1:1'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: '由服务端积分配置提供' }, speed: 58, reliability: 76, qualityFloor: 74,
  },
  {
    id: 'kling-3', label: 'Kling 3.0', provider: 'kling', adapterStatus: 'ready',
    capabilities: { ...IMAGE_TO_VIDEO_CAPABILITIES, referenceImages: false, omniReference: false, audio: true },
    strengths: { character: 78, characterConsistency: 76, motion: 88, expression: 68, camera: 84, physics: 78, realism: 82, reference: 65, audio: 25 },
    limitations: ['当前适配器支持 START/END 首尾帧，不支持 Omni 多图参考'], duration: { minSeconds: 3, maxSeconds: 15 }, resolutions: ['720p', '1080p', '4K'], aspectRatios: ['9:16', '16:9', '1:1'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: '由服务端积分配置提供' }, speed: 64, reliability: 68, qualityFloor: 60,
  },
  {
    id: 'veo-3.1', label: 'Veo 3.x', provider: 'google-veo', adapterStatus: 'planned',
    capabilities: { textToVideo: true, imageToVideo: true, startFrame: false, endFrame: false, referenceImages: false, referenceVideo: false, audio: true, omniReference: false },
    strengths: { character: 82, characterConsistency: 74, motion: 85, expression: 74, camera: 88, physics: 86, realism: 93, reference: 52, audio: 94 },
    limitations: ['Provider adapter 尚未接入，不会伪造 API 调用'], duration: { minSeconds: 4, maxSeconds: 8 }, resolutions: ['720p', '1080p'], aspectRatios: ['9:16', '16:9'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: 'Provider adapter 待接入' }, speed: 76, reliability: 80, qualityFloor: 70,
  },
  {
    id: 'veo-3.1-lite', label: 'Veo 3.1 Lite', provider: 'veo', adapterStatus: 'ready',
    capabilities: { textToVideo: true, imageToVideo: false, startFrame: false, endFrame: false, referenceImages: false, referenceVideo: false, audio: true, omniReference: false },
    strengths: { character: 68, characterConsistency: 60, motion: 78, expression: 66, camera: 80, physics: 76, realism: 82, reference: 0, audio: 76 },
    limitations: ['仅支持纯文本生视频', '固定 8 秒；不接收 START、END 或参考图片'], duration: { minSeconds: 8, maxSeconds: 8 }, resolutions: ['720p', '1080p', '4K'], aspectRatios: ['9:16', '16:9'],
    pricing: { perSecond: null, resolutionMultipliers: RESOLUTION_MULTIPLIERS, note: '由服务端积分配置提供' }, speed: 86, reliability: 76, qualityFloor: 58,
  },
];

export function registryWithApiModels(apiModels: VideoModel[]) {
  return VIDEO_MODEL_REGISTRY.map(definition => {
    const apiModel = apiModels.find(model => model.id === definition.id);
    if (!apiModel || definition.adapterStatus === 'planned') return definition;
    return {
      ...definition,
      adapterStatus: apiModel.enabled ? 'ready' : 'disabled',
      pricing: { ...definition.pricing, perSecond: apiModel.creditsPerSecond ?? definition.pricing.perSecond },
    } satisfies VideoModelDefinition;
  });
}

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
function seconds(value: number | string) { const parsed = Number.parseFloat(String(value)); return Number.isFinite(parsed) ? parsed : 0; }

export function analyzeShot(input: Partial<ShotAnalysis> & { prompt?: string }): ShotAnalysis {
  const prompt = input.prompt || '';
  const character = input.character ?? /\b(person|man|woman|girl|boy|character|face|hand|actor)\b|人物|角色|男人|女人|女孩|男孩|脸|手|表演|说话/i.test(prompt);
  return {
    character,
    characterConsistency: input.characterConsistency ?? (character ? 78 : 0),
    motionComplexity: input.motionComplexity ?? (/快速|奔跑|旋转|fight|run|fast|spin|复杂动作/i.test(prompt) ? 76 : 35),
    expressionComplexity: input.expressionComplexity ?? (/微表情|表情|smile|cry|look|笑|哭|看向|眼神/i.test(prompt) ? 78 : character ? 28 : 0),
    cameraComplexity: input.cameraComplexity ?? (/推近|拉远|环绕|跟拍|drone|orbit|tracking|zoom/i.test(prompt) ? 72 : 20),
    physicsComplexity: input.physicsComplexity ?? (/水|烟|火|爆炸|布料|液体|water|smoke|fire|explosion|cloth/i.test(prompt) ? 74 : 10),
    startFrame: input.startFrame ?? true,
    endFrame: input.endFrame ?? false,
    referenceImages: input.referenceImages ?? 0,
    referenceVideo: input.referenceVideo ?? false,
    audioRequired: input.audioRequired ?? /音频|声音|对白|说话|sing|voice|dialogue|audio/i.test(prompt),
    duration: input.duration ?? 5,
    resolution: input.resolution ?? '720p',
    aspectRatio: input.aspectRatio ?? '9:16',
    referenceMode: input.referenceMode ?? 'start-end',
    priority: input.priority ?? 'BALANCED',
  };
}

const demandWeights = { character: 0.13, characterConsistency: 0.16, motion: 0.13, expression: 0.12, camera: 0.11, physics: 0.1, reference: 0.14, audio: 0.05, realism: 0.06 } as const;
function qualityScore(model: VideoModelDefinition, analysis: ShotAnalysis) {
  const requests = [
    ['character', analysis.character ? 100 : 0], ['characterConsistency', analysis.characterConsistency], ['motion', analysis.motionComplexity], ['expression', analysis.expressionComplexity],
    ['camera', analysis.cameraComplexity], ['physics', analysis.physicsComplexity], ['reference', analysis.referenceImages || analysis.referenceVideo || analysis.startFrame || analysis.endFrame ? 100 : 0],
    ['audio', analysis.audioRequired ? 100 : 0], ['realism', Math.max(analysis.motionComplexity, analysis.physicsComplexity)],
  ] as const;
  const demandWeight = (demand: number) => Math.max(0.35, demand / 100);
  const total = requests.reduce((sum, [key, demand]) => sum + (demand > 0 ? demandWeights[key] * demandWeight(demand) : 0), 0) || 1;
  return clamp(requests.reduce((sum, [key, demand]) => sum + (demand > 0 ? model.strengths[key] * demandWeights[key] * demandWeight(demand) : 0), 0) / total);
}

function rejectionReason(model: VideoModelDefinition, analysis: ShotAnalysis) {
  if (model.adapterStatus !== 'ready') return model.adapterStatus === 'planned' ? 'Provider adapter 待接入' : '服务端模型未就绪';
  if (analysis.referenceMode === 'text' && model.id !== 'veo-3.1-lite') return '当前镜头是纯文本生视频，模型不支持该模式';
  if (analysis.referenceMode !== 'text' && model.id === 'veo-3.1-lite') return 'Veo 3.1 Lite 不支持参考图片';
  if (analysis.referenceMode === 'omni' && !model.capabilities.omniReference) return '不支持 Omni 多图参考';
  if (analysis.startFrame && !model.capabilities.imageToVideo) return '不支持图生视频';
  if (analysis.startFrame && !model.capabilities.startFrame) return '不支持 START 首帧';
  if (analysis.endFrame && !model.capabilities.endFrame) return '不支持 END 尾帧';
  if (analysis.referenceImages > 0 && !model.capabilities.referenceImages) return '不支持参考图片';
  if (analysis.referenceVideo && !model.capabilities.referenceVideo) return '不支持参考视频';
  if (analysis.audioRequired && !model.capabilities.audio) return '不支持音频需求';
  if (seconds(analysis.duration) < model.duration.minSeconds || seconds(analysis.duration) > model.duration.maxSeconds) return '时长超出模型范围';
  if (!model.resolutions.includes(analysis.resolution)) return '不支持当前分辨率';
  if (!model.aspectRatios.includes(analysis.aspectRatio)) return '不支持当前画幅';
  const quality = qualityScore(model, analysis);
  return quality < model.qualityFloor ? `低于最低质量阈值 ${model.qualityFloor}` : null;
}

function costScore(model: VideoModelDefinition, analysis: ShotAnalysis, registry: VideoModelDefinition[]) {
  if (model.pricing.perSecond === null) return 45;
  const requestedCost = model.pricing.perSecond * seconds(analysis.duration) * (model.pricing.resolutionMultipliers[analysis.resolution] || 1);
  const costs = registry.map(item => item.pricing.perSecond === null ? null : item.pricing.perSecond * seconds(analysis.duration) * (item.pricing.resolutionMultipliers[analysis.resolution] || 1)).filter((cost): cost is number => cost !== null);
  const maximum = Math.max(...costs, requestedCost, 0.0001);
  return clamp(100 - (requestedCost / maximum) * 100);
}

function reasons(model: VideoModelDefinition, analysis: ShotAnalysis, strategy: ModelRoutingStrategy, score: number) {
  const output: string[] = [];
  if (analysis.character && model.strengths.character >= 80) output.push(`人物一致性 ${model.strengths.characterConsistency} 分`);
  if (analysis.expressionComplexity >= 60 && model.strengths.expression >= 80) output.push('适合微表情与人物表演');
  if (analysis.motionComplexity >= 65 && model.strengths.motion >= 80) output.push('动作与运镜匹配度高');
  if (analysis.endFrame && model.capabilities.endFrame) output.push('支持 START/END 首尾帧');
  if (analysis.referenceMode === 'omni' && model.capabilities.omniReference) output.push('支持多图参考');
  if (analysis.audioRequired && model.capabilities.audio) output.push('满足音频需求');
  if (analysis.referenceMode === 'text' && model.capabilities.textToVideo) output.push('适合纯文本生视频');
  if (strategy === 'COST' && model.pricing.perSecond !== null) output.push('当前配置下成本优先');
  if (strategy === 'QUALITY' && model.strengths.realism >= 85) output.push('质量与真实感优先');
  if (!output.length) output.push(`综合适配 ${score} 分`);
  if (output.length === 1) output.push(`可靠性 ${model.reliability} 分`);
  return output.slice(0, 4);
}

export function routeShot(analysis: ShotAnalysis, strategy: ModelRoutingStrategy = analysis.priority, registry = VIDEO_MODEL_REGISTRY): ModelRoutingResult {
  const rejected: ModelRoutingResult['rejected'] = [];
  const alternatives: ModelRoutingAlternative[] = [];
  for (const model of registry) {
    const rejection = rejectionReason(model, analysis);
    if (rejection) { rejected.push({ modelId: model.id, reason: rejection }); continue; }
    const quality = qualityScore(model, analysis);
    const weights = ROUTER_SCORING_WEIGHTS;
    const score = clamp(quality * weights.quality[strategy] + costScore(model, analysis, registry) * weights.cost[strategy] + model.reliability * weights.reliability[strategy] + model.speed * weights.speed[strategy]);
    alternatives.push({ modelId: model.id, score, eligible: true, reason: reasons(model, analysis, strategy, score).join(' · ') });
  }
  alternatives.sort((left, right) => right.score - left.score);
  const recommended = alternatives.find(item => item.modelId !== 'veo-3.1' && item.modelId !== 'runway-gen-4');
  const definition = recommended ? registry.find(item => item.id === recommended.modelId) : undefined;
  return {
    recommendedModel: recommended?.modelId && recommended.modelId !== 'veo-3.1' && recommended.modelId !== 'runway-gen-4' ? recommended.modelId : null,
    score: recommended?.score || 0,
    reason: definition && recommended ? reasons(definition, analysis, strategy, recommended.score) : ['没有同时满足当前镜头硬能力要求的已接入模型'],
    alternatives,
    rejected,
  };
}

export function estimateModelCost(model: VideoModelDefinition | undefined, duration: number | string, resolution: string) {
  if (!model || model.pricing.perSecond === null) return null;
  const multiplier = model.pricing.resolutionMultipliers[resolution] || 1;
  return Number((model.pricing.perSecond * seconds(duration) * multiplier).toFixed(4));
}

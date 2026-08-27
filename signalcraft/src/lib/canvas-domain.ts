import type { GenerationStatus, VideoGeneration, VideoModelId } from './video-generation';

/**
 * Semantic metadata for the existing canvas. The visual canvas remains the
 * source of truth for layout; this layer gives the current nodes production
 * meaning without introducing a second graph or workflow engine.
 */
export type CanvasNodeId = 'source' | 'prompt' | 'model' | 'agent' | 'task' | 'result';
export type CanvasNodeRole = 'generic' | 'reference' | 'agent' | 'generation' | 'video_result';
export type CanvasAssetKind = 'image' | 'video';
export type CanvasAssetRole = 'generic' | 'start_frame' | 'end_frame' | 'reference' | 'output';
export type CanvasNodeStatus = 'draft' | GenerationStatus;
export type CanvasShotStatus = 'draft' | 'generating' | 'completed' | 'failed';
export type CanvasEdgeType = 'INPUT' | 'REFERENCE' | 'CONTINUITY' | 'VARIATION' | 'GENERATION' | 'SHOT_FLOW';

export type CanvasNodeSemantic = {
  role: CanvasNodeRole;
  shotId: string;
  assetId?: string | null;
  generationId?: string | null;
  versionId?: string | null;
  status?: CanvasNodeStatus;
  provider?: string | null;
  model?: VideoModelId | null;
  version?: number;
  bestTake?: boolean;
};

export type CanvasAssetSemantic = {
  assetId: string;
  kind: CanvasAssetKind;
  role: CanvasAssetRole;
  shotId: string;
  generationId?: string | null;
  versionId?: string | null;
  name?: string;
  width?: number;
  height?: number;
};

export type CanvasGenerationSemantic = {
  id: string;
  shotId: string;
  provider: string;
  model: VideoModelId;
  status: GenerationStatus;
  progress: number;
  versionId: string;
  providerTaskId?: string | null;
  createdAt: string;
};

export type CanvasVersionSemantic = {
  id: string;
  generationId: string;
  shotId: string;
  number: number;
  bestTake: boolean;
  createdAt: string;
};

export type CanvasShotSemantic = {
  id: string;
  index: number;
  title: string;
  status: CanvasShotStatus;
};

export type CanvasEdgeSemantic = {
  id: string;
  from: CanvasNodeId;
  to: CanvasNodeId;
  type: CanvasEdgeType;
};

export type CanvasSemantics = {
  version: 1;
  shot: CanvasShotSemantic;
  nodes: Partial<Record<CanvasNodeId, CanvasNodeSemantic>>;
  edges: CanvasEdgeSemantic[];
  assets: CanvasAssetSemantic[];
  generations: CanvasGenerationSemantic[];
  versions: CanvasVersionSemantic[];
};

const NODE_IDS: CanvasNodeId[] = ['source', 'prompt', 'model', 'agent', 'task', 'result'];
const NODE_ROLES: CanvasNodeRole[] = ['generic', 'reference', 'agent', 'generation', 'video_result'];
const ASSET_KINDS: CanvasAssetKind[] = ['image', 'video'];
const ASSET_ROLES: CanvasAssetRole[] = ['generic', 'start_frame', 'end_frame', 'reference', 'output'];
const NODE_STATUSES: CanvasNodeStatus[] = ['draft', 'queued', 'processing', 'completed', 'failed'];
const SHOT_STATUSES: CanvasShotStatus[] = ['draft', 'generating', 'completed', 'failed'];
const EDGE_TYPES: CanvasEdgeType[] = ['INPUT', 'REFERENCE', 'CONTINUITY', 'VARIATION', 'GENERATION', 'SHOT_FLOW'];
const VIDEO_MODELS: VideoModelId[] = ['auto', 'seedance-2', 'seedance-2-5', 'minimax-h3'];
const MAX_SEMANTIC_ROWS = 100;

function text(value: unknown, fallback = '', maximum = 160) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized.slice(0, maximum) : fallback;
}

function integer(value: unknown, fallback: number, minimum = 0, maximum = 100) {
  const candidate = Number(value);
  return Number.isInteger(candidate) ? Math.min(maximum, Math.max(minimum, candidate)) : fallback;
}

function oneOf<T extends string>(value: unknown, values: readonly T[], fallback: T) {
  return values.includes(value as T) ? value as T : fallback;
}

function nullableText(value: unknown) {
  const normalized = text(value, '');
  return normalized || null;
}

export function shotIdFor(index: number) {
  return `shot-${String(Math.max(1, Math.floor(index || 1))).padStart(2, '0')}`;
}

function defaultNode(role: CanvasNodeRole, shotId: string): CanvasNodeSemantic {
  return { role, shotId, status: 'draft' };
}

export function createCanvasSemantics(shotIndex = 1): CanvasSemantics {
  const index = Math.max(1, Math.floor(shotIndex || 1));
  const shotId = shotIdFor(index);
  const edges: CanvasEdgeSemantic[] = [
    { id: 'source-agent', from: 'source', to: 'agent', type: 'REFERENCE' },
    { id: 'agent-task', from: 'agent', to: 'task', type: 'GENERATION' },
    { id: 'task-result', from: 'task', to: 'result', type: 'GENERATION' },
  ];
  return {
    version: 1,
    shot: { id: shotId, index, title: `Shot ${String(index).padStart(2, '0')}`, status: 'draft' },
    nodes: {
      source: defaultNode('reference', shotId),
      prompt: defaultNode('generic', shotId),
      model: defaultNode('generic', shotId),
      agent: defaultNode('agent', shotId),
      task: defaultNode('generation', shotId),
      result: defaultNode('video_result', shotId),
    },
    edges,
    assets: [],
    generations: [],
    versions: [],
  };
}

function normalizeNode(value: unknown, fallback: CanvasNodeSemantic, shotId: string) {
  const candidate = value && typeof value === 'object' ? value as Partial<CanvasNodeSemantic> : {};
  return {
    ...fallback,
    role: oneOf(candidate.role, NODE_ROLES, fallback.role),
    shotId: text(candidate.shotId, shotId),
    assetId: nullableText(candidate.assetId),
    generationId: nullableText(candidate.generationId),
    versionId: nullableText(candidate.versionId),
    status: oneOf(candidate.status, NODE_STATUSES, fallback.status || 'draft'),
    provider: nullableText(candidate.provider),
    model: candidate.model && VIDEO_MODELS.includes(candidate.model) ? candidate.model : (fallback.model || null),
    version: candidate.version === undefined ? fallback.version : integer(candidate.version, 1, 1, 999),
    bestTake: Boolean(candidate.bestTake),
  };
}

function normalizeAsset(value: unknown, shotId: string): CanvasAssetSemantic | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CanvasAssetSemantic>;
  const assetId = text(candidate.assetId, '', 240);
  if (!assetId) return null;
  return {
    assetId,
    kind: oneOf(candidate.kind, ASSET_KINDS, 'image'),
    role: oneOf(candidate.role, ASSET_ROLES, 'generic'),
    shotId: text(candidate.shotId, shotId),
    generationId: nullableText(candidate.generationId),
    versionId: nullableText(candidate.versionId),
    name: nullableText(candidate.name) || undefined,
    width: candidate.width === undefined ? undefined : integer(candidate.width, 0, 0, 100000),
    height: candidate.height === undefined ? undefined : integer(candidate.height, 0, 0, 100000),
  };
}

function normalizeGeneration(value: unknown, shotId: string): CanvasGenerationSemantic | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CanvasGenerationSemantic>;
  const id = text(candidate.id, '', 240);
  if (!id) return null;
  const versionId = text(candidate.versionId, `generation-${id}-v1`, 260);
  return {
    id,
    shotId: text(candidate.shotId, shotId),
    provider: text(candidate.provider, 'unknown', 80),
    model: oneOf(candidate.model, VIDEO_MODELS, 'auto'),
    status: oneOf(candidate.status, ['queued', 'processing', 'completed', 'failed'] as const, 'failed'),
    progress: integer(candidate.progress, 0, 0, 100),
    versionId,
    providerTaskId: nullableText(candidate.providerTaskId),
    createdAt: text(candidate.createdAt, new Date(0).toISOString(), 80),
  };
}

function normalizeVersion(value: unknown, shotId: string): CanvasVersionSemantic | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CanvasVersionSemantic>;
  const id = text(candidate.id, '', 260);
  const generationId = text(candidate.generationId, '', 240);
  if (!id || !generationId) return null;
  return {
    id,
    generationId,
    shotId: text(candidate.shotId, shotId),
    number: integer(candidate.number, 1, 1, 999),
    bestTake: Boolean(candidate.bestTake),
    createdAt: text(candidate.createdAt, new Date(0).toISOString(), 80),
  };
}

/** Safely upgrades v1–v3 local snapshots into the semantic v1 shape. */
export function normalizeCanvasSemantics(value: unknown, shotIndex = 1): CanvasSemantics {
  const fallback = createCanvasSemantics(shotIndex);
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<CanvasSemantics>;
  const rawShot = candidate.shot && typeof candidate.shot === 'object' ? candidate.shot : {};
  const shotCandidate = rawShot as Partial<CanvasShotSemantic>;
  const index = integer(shotCandidate.index, fallback.shot.index, 1, 999);
  const shotId = text(shotCandidate.id, shotIdFor(index), 120);
  const nodes = Object.fromEntries(NODE_IDS.map(id => [
    id,
    normalizeNode(candidate.nodes?.[id], fallback.nodes[id] || defaultNode('generic', shotId), shotId),
  ])) as Partial<Record<CanvasNodeId, CanvasNodeSemantic>>;
  const edges = Array.isArray(candidate.edges) ? candidate.edges.slice(0, 24).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const edge = item as Partial<CanvasEdgeSemantic>;
    if (!NODE_IDS.includes(edge.from as CanvasNodeId) || !NODE_IDS.includes(edge.to as CanvasNodeId)) return [];
    const id = text(edge.id, `${edge.from}-${edge.to}`, 120);
    return [{ id, from: edge.from as CanvasNodeId, to: edge.to as CanvasNodeId, type: oneOf(edge.type, EDGE_TYPES, 'GENERATION') }];
  }) : fallback.edges;
  return {
    version: 1,
    shot: {
      id: shotId,
      index,
      title: text(shotCandidate.title, `Shot ${String(index).padStart(2, '0')}`, 160),
      status: oneOf(shotCandidate.status, SHOT_STATUSES, 'draft'),
    },
    nodes,
    edges,
    assets: Array.isArray(candidate.assets) ? candidate.assets.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeAsset(item, shotId)).filter((item): item is CanvasAssetSemantic => Boolean(item)) : [],
    generations: Array.isArray(candidate.generations) ? candidate.generations.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeGeneration(item, shotId)).filter((item): item is CanvasGenerationSemantic => Boolean(item)) : [],
    versions: Array.isArray(candidate.versions) ? candidate.versions.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeVersion(item, shotId)).filter((item): item is CanvasVersionSemantic => Boolean(item)) : [],
  };
}

export function patchCanvasNode(semantics: CanvasSemantics, nodeId: CanvasNodeId, patch: Partial<CanvasNodeSemantic>): CanvasSemantics {
  const current = semantics.nodes[nodeId] || defaultNode('generic', semantics.shot.id);
  return { ...semantics, nodes: { ...semantics.nodes, [nodeId]: { ...current, ...patch, shotId: patch.shotId || current.shotId || semantics.shot.id } } };
}

export function registerCanvasAsset(semantics: CanvasSemantics, asset: CanvasAssetSemantic): CanvasSemantics {
  const normalized: CanvasAssetSemantic = {
    ...asset,
    assetId: text(asset.assetId, '', 240),
    shotId: text(asset.shotId, semantics.shot.id, 120),
  };
  if (!normalized.assetId) return semantics;
  const assets = [...semantics.assets.filter(item => item.assetId !== normalized.assetId), normalized].slice(-MAX_SEMANTIC_ROWS);
  return { ...semantics, assets };
}

/** Records a generation as a version and mirrors its lifecycle onto nodes. */
export function recordCanvasGeneration(semantics: CanvasSemantics, generation: VideoGeneration): CanvasSemantics {
  const versionId = `generation-${generation.id}-v1`;
  const nextGeneration: CanvasGenerationSemantic = {
    id: generation.id,
    shotId: semantics.shot.id,
    provider: generation.provider,
    model: generation.model,
    status: generation.status,
    progress: Math.min(100, Math.max(0, Number(generation.progress) || 0)),
    versionId,
    providerTaskId: generation.providerTaskId || null,
    createdAt: generation.createdAt,
  };
  const version: CanvasVersionSemantic = {
    id: versionId,
    generationId: generation.id,
    shotId: semantics.shot.id,
    number: 1,
    bestTake: false,
    createdAt: generation.createdAt,
  };
  const nextStatus: CanvasShotStatus = generation.status === 'completed'
    ? 'completed'
    : generation.status === 'failed'
      ? 'failed'
      : 'generating';
  const outputAssets: CanvasAssetSemantic[] = [];
  if (generation.videoAssetId) outputAssets.push({
      assetId: generation.videoAssetId,
      kind: 'video' as const,
      role: 'output' as const,
      shotId: semantics.shot.id,
      generationId: generation.id,
      versionId,
      name: 'Generated video',
    });
  if (generation.thumbnailAssetId) outputAssets.push({
      assetId: generation.thumbnailAssetId,
      kind: 'image' as const,
      role: 'output' as const,
      shotId: semantics.shot.id,
      generationId: generation.id,
      versionId,
      name: 'Generated thumbnail',
    });
  const next = {
    ...semantics,
    shot: { ...semantics.shot, status: nextStatus },
    assets: [...semantics.assets.filter(item => !outputAssets.some(asset => asset.assetId === item.assetId)), ...outputAssets].slice(-MAX_SEMANTIC_ROWS),
    generations: [...semantics.generations.filter(item => item.id !== generation.id), nextGeneration].slice(-MAX_SEMANTIC_ROWS),
    versions: [...semantics.versions.filter(item => item.id !== versionId), version].slice(-MAX_SEMANTIC_ROWS),
  };
  return patchCanvasNode(
    patchCanvasNode(next, 'task', { role: 'generation', generationId: generation.id, versionId, provider: generation.provider, model: generation.model, status: generation.status, version: 1 }),
    'result',
    { role: 'video_result', generationId: generation.id, versionId, provider: generation.provider, model: generation.model, status: generation.status, version: 1 },
  );
}

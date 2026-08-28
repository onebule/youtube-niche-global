import type { GenerationStatus, VideoGeneration, VideoModelId } from './video-generation';

/**
 * Semantic metadata for the existing canvas. The visual canvas remains the
 * source of truth for layout; this layer gives the current nodes production
 * meaning without introducing a second graph or workflow engine.
 */
export type CanvasNodeId = 'source' | 'prompt' | 'model' | 'agent' | 'task' | 'result';
export type CanvasNodeRole = 'generic' | 'reference' | 'agent' | 'generation' | 'video_result';
export type CanvasAssetKind = 'image' | 'video' | 'script' | 'character' | 'style' | 'scene' | 'prop' | 'storyboard';
export type CanvasAssetRole = 'generic' | 'start_frame' | 'end_frame' | 'reference' | 'output' | 'character' | 'motion' | 'style' | 'scene' | 'prop' | 'script' | 'storyboard';
export type CanvasAssetReferenceStatus = 'valid' | 'invalid';
export type CanvasNodeStatus = 'draft' | GenerationStatus;
export type CanvasShotStatus = 'draft' | 'generating' | 'completed' | 'failed';
export type CanvasEdgeType = 'INPUT' | 'REFERENCE' | 'CONTINUITY' | 'VARIATION' | 'GENERATION' | 'SHOT_FLOW';
export type CanvasEventType = 'asset.bound' | 'asset.invalidated' | 'agent.planned' | 'generation.status';
export type CanvasEventActor = 'user' | 'agent' | 'system';
export type CanvasEventMetadata = Record<string, string | number | boolean | null>;

export type CanvasEventSemantic = {
  id: string;
  shotId: string;
  type: CanvasEventType;
  actor: CanvasEventActor;
  message: string;
  createdAt: string;
  metadata: CanvasEventMetadata;
};

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
  available?: boolean;
};

export type CanvasAssetReference = {
  mentionId: string;
  token: string;
  assetId: string;
  role: CanvasAssetRole;
  priority: number;
  strength: 'strong' | 'weak';
  required: boolean;
  shotId: string;
  constraints: string[];
  status: CanvasAssetReferenceStatus;
};

export type CanvasAssetMention = {
  mentionId: string;
  token: string;
  index: number;
  start: number;
  end: number;
};

export type CanvasAssetMentionValidation = {
  mentions: CanvasAssetMention[];
  bindings: CanvasAssetReference[];
  invalid: CanvasAssetMention[];
  unbound: CanvasAssetMention[];
  hasInvalid: boolean;
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
  order: number;
  collapsed: boolean;
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
  references: CanvasAssetReference[];
  generations: CanvasGenerationSemantic[];
  versions: CanvasVersionSemantic[];
  events: CanvasEventSemantic[];
};

/**
 * Small, provider-neutral context packet sent with an Agent planning request.
 * It contains semantic IDs and settings, never blob URLs or provider secrets.
 */
export type CanvasAgentContext = {
  schemaVersion: 1;
  shot: CanvasSemantics['shot'];
  selectedNodeId: CanvasNodeId | null;
  selectedNode: CanvasNodeSemantic | null;
  nodes: CanvasSemantics['nodes'];
  nodePositions: Record<CanvasNodeId, { x: number; y: number }>;
  assets: CanvasSemantics['assets'];
  references: CanvasSemantics['references'];
  generations: CanvasSemantics['generations'];
  versions: CanvasSemantics['versions'];
  events: CanvasSemantics['events'];
  input: {
    prompt: string;
    model: VideoModelId;
    duration: string;
    aspectRatio: '9:16' | '16:9' | '1:1';
    resolution: string;
    referenceMode: 'start-end' | 'omni' | 'text';
    startAssetId: string | null;
    endAssetId: string | null;
    referenceAssetIds: string[];
  };
};

export type CanvasAgentAction = {
  id: string;
  type: 'canvas.organize' | 'shot.create' | 'shot.duplicate' | 'shot.reorder' | 'shot.delete';
  direction?: 'up' | 'down';
  shotId?: string | null;
  reason?: string;
};

const NODE_IDS: CanvasNodeId[] = ['source', 'prompt', 'model', 'agent', 'task', 'result'];
const NODE_ROLES: CanvasNodeRole[] = ['generic', 'reference', 'agent', 'generation', 'video_result'];
const ASSET_KINDS: CanvasAssetKind[] = ['image', 'video', 'script', 'character', 'style', 'scene', 'prop', 'storyboard'];
const ASSET_ROLES: CanvasAssetRole[] = ['generic', 'start_frame', 'end_frame', 'reference', 'output', 'character', 'motion', 'style', 'scene', 'prop', 'script', 'storyboard'];
const NODE_STATUSES: CanvasNodeStatus[] = ['draft', 'queued', 'processing', 'completed', 'failed'];
const SHOT_STATUSES: CanvasShotStatus[] = ['draft', 'generating', 'completed', 'failed'];
const EDGE_TYPES: CanvasEdgeType[] = ['INPUT', 'REFERENCE', 'CONTINUITY', 'VARIATION', 'GENERATION', 'SHOT_FLOW'];
const EVENT_TYPES: CanvasEventType[] = ['asset.bound', 'asset.invalidated', 'agent.planned', 'generation.status'];
const EVENT_ACTORS: CanvasEventActor[] = ['user', 'agent', 'system'];
const VIDEO_MODELS: VideoModelId[] = ['auto', 'seedance-2', 'seedance-2-5', 'minimax-h3', 'kling-3', 'veo-3.1-lite'];
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
    shot: { id: shotId, index, title: `Shot ${String(index).padStart(2, '0')}`, status: 'draft', order: index, collapsed: false },
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
    references: [],
    generations: [],
    versions: [],
    events: [],
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
    available: candidate.available !== false,
  };
}

function normalizeReference(value: unknown, shotId: string, assets: CanvasAssetSemantic[]): CanvasAssetReference | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CanvasAssetReference>;
  const assetId = text(candidate.assetId, '', 240);
  const token = text(candidate.token, '', 80).replace(/\s+/g, '');
  const mentionId = normalizeCanvasMentionToken(token) || text(candidate.mentionId, '', 80);
  if (!assetId || !token || !mentionId) return null;
  const asset = assets.find(item => item.assetId === assetId && item.shotId === (candidate.shotId || shotId));
  return {
    mentionId,
    token,
    assetId,
    role: oneOf(candidate.role, ASSET_ROLES, 'reference'),
    priority: integer(candidate.priority, 50, 0, 100),
    strength: candidate.strength === 'strong' ? 'strong' : 'weak',
    required: Boolean(candidate.required),
    shotId: text(candidate.shotId, shotId, 120),
    constraints: Array.isArray(candidate.constraints) ? candidate.constraints.map(item => text(item, '', 160)).filter(Boolean).slice(0, 12) : [],
    status: asset && asset.available !== false ? 'valid' : 'invalid',
  };
}

/** Converts the two supported UI aliases into one stable mention identity. */
export function normalizeCanvasMentionToken(value: unknown) {
  const token = text(value, '', 80).replace(/\s+/g, '');
  const match = token.match(/^@(图片|image)([1-9])(?!\d)$/iu);
  return match ? `image:${match[2]}` : null;
}

/** Parses mentions without trusting their display label as an asset identity. */
export function parseCanvasAssetMentions(prompt: string): CanvasAssetMention[] {
  const mentions: CanvasAssetMention[] = [];
  const source = String(prompt || '');
  const pattern = /@(图片|image)\s*([1-9])(?!\d)/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    const index = Number(match[2]);
    if (!Number.isInteger(index) || index < 1) continue;
    mentions.push({
      mentionId: `image:${index}`,
      token: match[0].replace(/\s+/g, ''),
      index,
      start: match.index,
      end: match.index + match[0].length,
    });
  }
  return mentions;
}

export type CanvasAssetReferenceInput = {
  token: string;
  assetId: string;
  role?: CanvasAssetRole;
  priority?: number;
  strength?: 'strong' | 'weak';
  required?: boolean;
  shotId?: string | null;
  constraints?: string[];
};

/** Binds a visible mention to an asset while preserving an invalid binding. */
export function bindCanvasAssetReference(semantics: CanvasSemantics, input: CanvasAssetReferenceInput): CanvasSemantics {
  const mentionId = normalizeCanvasMentionToken(input.token);
  const assetId = text(input.assetId, '', 240);
  if (!mentionId || !assetId) return semantics;
  const shotId = text(input.shotId, semantics.shot.id, 120);
  const asset = semantics.assets.find(item => item.assetId === assetId && item.shotId === shotId);
  const reference: CanvasAssetReference = {
    mentionId,
    token: text(input.token, `@图片${mentionId.split(':')[1]}`, 80).replace(/\s+/g, ''),
    assetId,
    role: oneOf(input.role, ASSET_ROLES, 'reference'),
    priority: integer(input.priority, 50, 0, 100),
    strength: input.strength === 'strong' ? 'strong' : 'weak',
    required: Boolean(input.required),
    shotId,
    constraints: Array.isArray(input.constraints) ? input.constraints.map(item => text(item, '', 160)).filter(Boolean).slice(0, 12) : [],
    status: asset && asset.available !== false ? 'valid' : 'invalid',
  };
  return {
    ...semantics,
    references: [...semantics.references.filter(item => !(item.mentionId === mentionId && item.shotId === shotId)), reference].slice(-MAX_SEMANTIC_ROWS),
  };
}

/** Marks the asset unavailable without deleting history or its old binding. */
export function markCanvasAssetUnavailable(semantics: CanvasSemantics, assetId: string): CanvasSemantics {
  const normalizedId = text(assetId, '', 240);
  if (!normalizedId) return semantics;
  return {
    ...semantics,
    assets: semantics.assets.map(asset => asset.assetId === normalizedId ? { ...asset, available: false } : asset),
    references: semantics.references.map(reference => reference.assetId === normalizedId ? { ...reference, status: 'invalid' } : reference),
  };
}

/** Recomputes validity after a persisted snapshot or a replacement upload. */
export function refreshCanvasAssetReferences(semantics: CanvasSemantics): CanvasSemantics {
  return {
    ...semantics,
    references: semantics.references.map(reference => {
      const asset = semantics.assets.find(item => item.assetId === reference.assetId && item.shotId === reference.shotId);
      return { ...reference, status: asset && asset.available !== false ? 'valid' : 'invalid' };
    }),
  };
}

/** Returns the exact mentions that cannot be safely submitted for this Shot. */
export function validateCanvasAssetMentions(semantics: CanvasSemantics, prompt: string, shotId = semantics.shot.id): CanvasAssetMentionValidation {
  const mentions = parseCanvasAssetMentions(prompt);
  const bindings = mentions.flatMap(mention => semantics.references.filter(reference => reference.mentionId === mention.mentionId && reference.shotId === shotId));
  const invalid: CanvasAssetMention[] = [];
  const unbound: CanvasAssetMention[] = [];
  mentions.forEach(mention => {
    const binding = semantics.references.find(reference => reference.mentionId === mention.mentionId && reference.shotId === shotId);
    if (!binding) {
      unbound.push(mention);
      return;
    }
    const asset = semantics.assets.find(item => item.assetId === binding.assetId && item.shotId === shotId);
    if (binding.status === 'invalid' || !asset || asset.available === false) invalid.push(mention);
  });
  return { mentions, bindings, invalid, unbound, hasInvalid: invalid.length > 0 || unbound.length > 0 };
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

function normalizeEvent(value: unknown, shotId: string): CanvasEventSemantic | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<CanvasEventSemantic>;
  const id = text(candidate.id, '', 240);
  if (!id) return null;
  const rawMetadata = candidate.metadata && typeof candidate.metadata === 'object'
    ? candidate.metadata as Record<string, unknown>
    : {};
  const metadata = Object.entries(rawMetadata).slice(0, 16).reduce<CanvasEventMetadata>((result, [key, rawValue]) => {
    const normalizedKey = text(key, '', 80);
    if (!normalizedKey) return result;
    if (/(secret|token|key|url|credential|password|cookie)/iu.test(normalizedKey)) return result;
    if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'boolean') result[normalizedKey] = rawValue;
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) result[normalizedKey] = rawValue;
    return result;
  }, {});
  return {
    id,
    shotId: text(candidate.shotId, shotId, 120),
    type: oneOf(candidate.type, EVENT_TYPES, 'generation.status'),
    actor: oneOf(candidate.actor, EVENT_ACTORS, 'system'),
    message: text(candidate.message, '', 240),
    createdAt: text(candidate.createdAt, new Date(0).toISOString(), 80),
    metadata,
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
  const assets = Array.isArray(candidate.assets)
    ? candidate.assets.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeAsset(item, shotId)).filter((item): item is CanvasAssetSemantic => Boolean(item))
    : [];
  const references = Array.isArray(candidate.references)
    ? candidate.references.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeReference(item, shotId, assets)).filter((item): item is CanvasAssetReference => Boolean(item))
    : [];
  const events = Array.isArray(candidate.events)
    ? candidate.events.slice(-MAX_SEMANTIC_ROWS).map(item => normalizeEvent(item, shotId)).filter((item): item is CanvasEventSemantic => Boolean(item))
    : [];
  return {
    version: 1,
    shot: {
      id: shotId,
      index,
      title: text(shotCandidate.title, `Shot ${String(index).padStart(2, '0')}`, 160),
      status: oneOf(shotCandidate.status, SHOT_STATUSES, 'draft'),
      order: integer(shotCandidate.order, index, 1, 999),
      collapsed: Boolean(shotCandidate.collapsed),
    },
    nodes,
    edges,
    assets,
    references,
    generations: Array.isArray(candidate.generations) ? candidate.generations.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeGeneration(item, shotId)).filter((item): item is CanvasGenerationSemantic => Boolean(item)) : [],
    versions: Array.isArray(candidate.versions) ? candidate.versions.slice(0, MAX_SEMANTIC_ROWS).map(item => normalizeVersion(item, shotId)).filter((item): item is CanvasVersionSemantic => Boolean(item)) : [],
    events,
  };
}

export type CanvasEventInput = Omit<CanvasEventSemantic, 'shotId' | 'createdAt' | 'metadata'> & {
  shotId?: string | null;
  createdAt?: string | null;
  metadata?: CanvasEventMetadata;
};

/** Appends a small, idempotent audit event to the local Shot semantics. */
export function recordCanvasEvent(semantics: CanvasSemantics, input: CanvasEventInput): CanvasSemantics {
  const id = text(input.id, '', 240);
  if (!id || semantics.events.some(event => event.id === id)) return semantics;
  const event = normalizeEvent({
    ...input,
    id,
    shotId: input.shotId || semantics.shot.id,
    createdAt: input.createdAt || new Date().toISOString(),
  }, semantics.shot.id);
  if (!event) return semantics;
  return { ...semantics, events: [...semantics.events, event].slice(-MAX_SEMANTIC_ROWS) };
}

export function patchCanvasNode(semantics: CanvasSemantics, nodeId: CanvasNodeId, patch: Partial<CanvasNodeSemantic>): CanvasSemantics {
  const current = semantics.nodes[nodeId] || defaultNode('generic', semantics.shot.id);
  return { ...semantics, nodes: { ...semantics.nodes, [nodeId]: { ...current, ...patch, shotId: patch.shotId || current.shotId || semantics.shot.id } } };
}

export function patchCanvasShot(semantics: CanvasSemantics, patch: Partial<CanvasShotSemantic>): CanvasSemantics {
  return { ...semantics, shot: { ...semantics.shot, ...patch } };
}

export function registerCanvasAsset(semantics: CanvasSemantics, asset: CanvasAssetSemantic): CanvasSemantics {
  const normalized: CanvasAssetSemantic = {
    ...asset,
    assetId: text(asset.assetId, '', 240),
    shotId: text(asset.shotId, semantics.shot.id, 120),
    available: asset.available !== false,
  };
  if (!normalized.assetId) return semantics;
  const assets = [...semantics.assets.filter(item => item.assetId !== normalized.assetId), normalized].slice(-MAX_SEMANTIC_ROWS);
  return refreshCanvasAssetReferences({ ...semantics, assets });
}

/** Records a generation as a version and mirrors its lifecycle onto nodes. */
export function recordCanvasGeneration(semantics: CanvasSemantics, generation: VideoGeneration): CanvasSemantics {
  // A generation can be observed more than once while it moves from queued to
  // processing to completed. Reuse its existing version in that case; a new
  // generation for the same Shot becomes the next visible version.
  const previousGeneration = semantics.generations.find(item => item.id === generation.id);
  const previousVersion = previousGeneration
    ? semantics.versions.find(item => item.id === previousGeneration.versionId)
    : undefined;
  const nextVersionNumber = previousVersion?.number || (
    semantics.versions
      .filter(item => item.shotId === semantics.shot.id)
      .reduce((highest, item) => Math.max(highest, item.number), 0) + 1
  );
  const versionId = previousVersion?.id || `generation-${generation.id}-v${nextVersionNumber}`;
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
    number: nextVersionNumber,
    // Keep a previously selected Best Take while refreshing the generation
    // status. New versions start unselected until the user chooses one.
    bestTake: previousVersion?.bestTake || false,
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
    patchCanvasNode(next, 'task', { role: 'generation', generationId: generation.id, versionId, provider: generation.provider, model: generation.model, status: generation.status, version: nextVersionNumber, bestTake: previousVersion?.bestTake || false }),
    'result',
    { role: 'video_result', generationId: generation.id, versionId, provider: generation.provider, model: generation.model, status: generation.status, version: nextVersionNumber, bestTake: previousVersion?.bestTake || false },
  );
}

export function canvasVersionForGeneration(semantics: CanvasSemantics, generationId: string | null | undefined) {
  if (!generationId) return null;
  return semantics.versions.find(version => version.generationId === generationId && version.shotId === semantics.shot.id) || null;
}

/** Selects one completed generation as the Shot's Best Take without changing
 * the active generation or submitting another provider request. */
export function selectCanvasBestTake(semantics: CanvasSemantics, generationId: string) {
  const target = canvasVersionForGeneration(semantics, generationId);
  if (!target) return semantics;
  const versions = semantics.versions.map(version => version.shotId === semantics.shot.id
    ? { ...version, bestTake: version.id === target.id }
    : version);
  const nodes = Object.fromEntries(Object.entries(semantics.nodes).map(([nodeId, node]) => [
    nodeId,
    node && node.shotId === semantics.shot.id
      ? { ...node, bestTake: node.generationId === generationId }
      : node,
  ])) as CanvasSemantics['nodes'];
  return { ...semantics, nodes, versions };
}

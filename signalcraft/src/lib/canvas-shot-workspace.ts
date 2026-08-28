import { type CanvasNodePositions } from './canvas-commands';
import { normalizeCanvasSemantics, type CanvasAgentContext, type CanvasNodeId, type CanvasSemantics } from './canvas-domain';
import { normalizeVideoDuration, type VideoGeneration, type VideoGenerationPlan, type VideoModelId } from './video-generation';
import type { ModelRoutingStrategy } from './video-model-router';

export type CanvasAspectRatio = '9:16' | '16:9' | '1:1';
export type CanvasReferenceMode = 'start-end' | 'omni' | 'text';
export type UploadedFrame = { assetId: string; name: string; previewUrl: string; width: number; height: number; referenceIndex?: number };
export type PersistedFrame = Omit<UploadedFrame, 'previewUrl'>;
export type ScriptOcrDraft = { assetId: string; text: string; extractedAt?: string | null };

/** Canvas-only steps; they never submit a paid generation by themselves. */
export type CanvasCustomNodeType = 'text' | 'image' | 'video' | 'other';
export type CanvasCustomNode = {
  id: string;
  type: CanvasCustomNodeType;
  parentId: string;
  x: number;
  y: number;
  title: string;
  body: string;
  assetId?: string | null;
};
export type CanvasCustomEdge = { id: string; from: string; to: string };

export type ShotSnapshot = {
  shot: number;
  nodes: CanvasNodePositions;
  prompt: string;
  model: VideoModelId;
  routingStrategy?: ModelRoutingStrategy;
  duration: string;
  aspectRatio: CanvasAspectRatio;
  resolution: string;
  startFrame: UploadedFrame | null;
  endFrame: UploadedFrame | null;
  referenceMode: CanvasReferenceMode;
  referenceFrames: UploadedFrame[];
  generation: VideoGeneration | null;
  restoredGenerationId: string | null;
  videoUrl: string;
  agentPlan: VideoGenerationPlan | null;
  semantics: CanvasSemantics;
  scriptOcr: ScriptOcrDraft | null;
  customNodes?: CanvasCustomNode[];
  customEdges?: CanvasCustomEdge[];
};

export type SavedShot = {
  shot: number;
  nodes: CanvasNodePositions;
  prompt: string;
  model: VideoModelId;
  routingStrategy?: ModelRoutingStrategy;
  duration: string;
  aspectRatio: CanvasAspectRatio;
  resolution: string;
  startFrame: PersistedFrame | null;
  endFrame: PersistedFrame | null;
  referenceMode?: CanvasReferenceMode;
  referenceFrames?: PersistedFrame[];
  generationId: string | null;
  semantics?: CanvasSemantics;
  scriptOcr?: ScriptOcrDraft | null;
  customNodes?: CanvasCustomNode[];
  customEdges?: CanvasCustomEdge[];
};

/**
 * Small, provider-neutral context packet sent with an Agent planning request.
 * It contains semantic IDs and settings, never blob URLs or provider secrets.
 */
export type { CanvasAgentContext } from './canvas-domain';

export function cloneFrame(frame: UploadedFrame | null): UploadedFrame | null {
  return frame ? { ...frame } : null;
}

export function stripFrame(frame: UploadedFrame | null): PersistedFrame | null {
  if (!frame) return null;
  return { assetId: frame.assetId, name: frame.name, width: frame.width, height: frame.height, ...(frame.referenceIndex ? { referenceIndex: frame.referenceIndex } : {}) };
}

export function restoreFrame(frame: PersistedFrame | null | undefined): UploadedFrame | null {
  return frame ? { ...frame, previewUrl: '' } : null;
}

export function createCanvasAgentContext(snapshot: ShotSnapshot, selectedNodeId: CanvasNodeId | null): CanvasAgentContext {
  const selectedNode = selectedNodeId ? snapshot.semantics.nodes[selectedNodeId] || null : null;
  return {
    schemaVersion: 1,
    shot: snapshot.semantics.shot,
    selectedNodeId,
    selectedNode,
    nodes: snapshot.semantics.nodes,
    nodePositions: snapshot.nodes,
    assets: snapshot.semantics.assets.slice(-24),
    references: snapshot.semantics.references.slice(-24),
    generations: snapshot.semantics.generations.slice(-24),
    versions: snapshot.semantics.versions.slice(-24),
    events: snapshot.semantics.events.slice(-24),
    input: {
      prompt: snapshot.prompt.slice(0, 1200),
      model: snapshot.model,
      duration: snapshot.duration,
      aspectRatio: snapshot.aspectRatio,
      resolution: snapshot.resolution,
      referenceMode: snapshot.referenceMode,
      startAssetId: snapshot.startFrame?.assetId || null,
      endAssetId: snapshot.endFrame?.assetId || null,
      referenceAssetIds: snapshot.referenceFrames.slice(0, 9).map(frame => frame.assetId),
    },
  };
}

export function restoreSavedShot(saved: SavedShot, restoreNodes: (value: unknown) => CanvasNodePositions): ShotSnapshot {
  const shot = Number.isInteger(saved.shot) && saved.shot > 0 ? saved.shot : 1;
  const model = saved.model || 'seedance-2';
  const customNodes = normalizeCustomNodes(saved.customNodes);
  return {
    shot,
    nodes: restoreNodes(saved.nodes),
    prompt: saved.prompt || '',
    model,
    routingStrategy: saved.routingStrategy || 'BALANCED',
    duration: normalizeVideoDuration(model, saved.duration || '5s'),
    aspectRatio: saved.aspectRatio || '9:16',
    resolution: saved.resolution || '720p',
    startFrame: restoreFrame(saved.startFrame),
    endFrame: restoreFrame(saved.endFrame),
    referenceMode: saved.referenceMode || 'start-end',
    referenceFrames: (saved.referenceFrames || []).slice(0, 9).map(frame => ({ ...frame, previewUrl: '' })),
    generation: null,
    restoredGenerationId: saved.generationId || null,
    videoUrl: '',
    agentPlan: null,
    semantics: normalizeCanvasSemantics(saved.semantics, shot),
    scriptOcr: restoreScriptOcr(saved.scriptOcr),
    customNodes,
    customEdges: normalizeCustomEdges(saved.customEdges, customNodes),
  };
}

export function restoreScriptOcr(value: ScriptOcrDraft | null | undefined): ScriptOcrDraft | null {
  if (!value || typeof value !== 'object') return null;
  const assetId = String(value.assetId || '').trim().slice(0, 240);
  const text = String(value.text || '').replace(/\u0000/g, '').slice(0, 12_000).trim();
  if (!assetId || !text) return null;
  const extractedAt = value.extractedAt ? String(value.extractedAt).slice(0, 80) : null;
  return { assetId, text, extractedAt };
}

const CUSTOM_NODE_TYPES: CanvasCustomNodeType[] = ['text', 'image', 'video', 'other'];

function normalizeCustomNodeType(value: unknown): CanvasCustomNodeType {
  return typeof value === 'string' && CUSTOM_NODE_TYPES.includes(value as CanvasCustomNodeType)
    ? value as CanvasCustomNodeType
    : 'other';
}

/** Keep canvas extensions bounded and safe to restore from localStorage. */
export function normalizeCustomNodes(value: unknown): CanvasCustomNode[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  return value.slice(0, 12).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CanvasCustomNode>;
    const baseId = String(candidate.id || `custom-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 72);
    let id = baseId;
    let suffix = 1;
    while (id && seenIds.has(id)) {
      suffix += 1;
      id = `${baseId}-${suffix}`.slice(0, 72);
    }
    const parentId = String(candidate.parentId || 'result').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || 'result';
    if (!id) return [];
    seenIds.add(id);
    const x = typeof candidate.x === 'number' && Number.isFinite(candidate.x) ? Math.max(0, Math.min(3600, candidate.x)) : 1300;
    const y = typeof candidate.y === 'number' && Number.isFinite(candidate.y) ? Math.max(0, Math.min(1400, candidate.y)) : 180;
    const clean = (input: unknown, max: number) => String(input || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
    return [{
      id,
      type: normalizeCustomNodeType(candidate.type),
      parentId,
      x,
      y,
      title: clean(candidate.title, 80) || '自定义步骤',
      body: clean(candidate.body, 1200),
      assetId: candidate.assetId ? String(candidate.assetId).slice(0, 240) : null,
    } satisfies CanvasCustomNode];
  });
}

export function normalizeCustomEdges(value: unknown, customNodes: CanvasCustomNode[] = []): CanvasCustomEdge[] {
  if (!Array.isArray(value)) return [];
  const customIds = new Set(customNodes.map(node => node.id));
  const fixedIds = new Set(['source', 'prompt', 'model', 'agent', 'task', 'result']);
  const seen = new Set<string>();
  return value.slice(0, 24).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CanvasCustomEdge>;
    const from = String(candidate.from || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    const to = String(candidate.to || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!from || !to || from === to || !customIds.has(to)) return [];
    if (!customIds.has(from) && !fixedIds.has(from)) return [];
    const id = String(candidate.id || `${from}-${to}-${index}`).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, from, to } satisfies CanvasCustomEdge];
  });
}

export function upsertShotSnapshot(snapshots: ShotSnapshot[], snapshot: ShotSnapshot) {
  return sortShotSnapshots([...snapshots.filter(item => item.shot !== snapshot.shot), snapshot]);
}

/**
 * Keeps the visual rail order separate from a Shot's stable numeric identity.
 * Older snapshots have no explicit ordering beyond their original number, so
 * the semantic order field is a safe backwards-compatible fallback.
 */
export function sortShotSnapshots(snapshots: ShotSnapshot[]) {
  return [...snapshots].sort((left, right) => {
    const orderDelta = (left.semantics.shot.order || left.shot) - (right.semantics.shot.order || right.shot);
    return orderDelta || left.shot - right.shot;
  });
}

export function removeShotSnapshot(snapshots: ShotSnapshot[], shot: number) {
  return sortShotSnapshots(snapshots.filter(snapshot => snapshot.shot !== shot));
}

export function reorderShotSnapshots(snapshots: ShotSnapshot[], shot: number, direction: 'up' | 'down') {
  const ordered = sortShotSnapshots(snapshots);
  const index = ordered.findIndex(snapshot => snapshot.shot === shot);
  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= ordered.length) return ordered;
  const current = ordered[index];
  const neighbor = ordered[neighborIndex];
  const currentOrder = current.semantics.shot.order || current.shot;
  const neighborOrder = neighbor.semantics.shot.order || neighbor.shot;
  return sortShotSnapshots(ordered.map(snapshot => {
    if (snapshot.shot === current.shot) return { ...snapshot, semantics: { ...snapshot.semantics, shot: { ...snapshot.semantics.shot, order: neighborOrder } } };
    if (snapshot.shot === neighbor.shot) return { ...snapshot, semantics: { ...snapshot.semantics, shot: { ...snapshot.semantics.shot, order: currentOrder } } };
    return snapshot;
  }));
}

/** Keep the active Shot when local history reaches its storage cap. */
export function limitShotSnapshots(snapshots: ShotSnapshot[], activeShot: number, limit = 24) {
  const ordered = sortShotSnapshots(snapshots);
  if (ordered.length <= limit) return ordered;
  const active = ordered.find(snapshot => snapshot.shot === activeShot);
  const rest = ordered.filter(snapshot => snapshot.shot !== activeShot).slice(0, Math.max(0, limit - 1));
  return sortShotSnapshots(active ? [...rest, active] : rest);
}

export function serializeShotSnapshot(snapshot: ShotSnapshot): SavedShot {
  const customNodes = normalizeCustomNodes(snapshot.customNodes);
  return {
    shot: snapshot.shot,
    nodes: snapshot.nodes,
    prompt: snapshot.prompt,
    model: snapshot.model,
    routingStrategy: snapshot.routingStrategy || 'BALANCED',
    duration: snapshot.duration,
    aspectRatio: snapshot.aspectRatio,
    resolution: snapshot.resolution,
    startFrame: stripFrame(snapshot.startFrame),
    endFrame: stripFrame(snapshot.endFrame),
    referenceMode: snapshot.referenceMode,
    referenceFrames: snapshot.referenceFrames.map(stripFrame).filter((frame): frame is PersistedFrame => Boolean(frame)),
    generationId: snapshot.generation?.id || snapshot.restoredGenerationId,
    semantics: snapshot.semantics,
    scriptOcr: snapshot.scriptOcr,
    customNodes,
    customEdges: normalizeCustomEdges(snapshot.customEdges, customNodes),
  };
}

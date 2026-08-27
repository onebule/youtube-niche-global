import { type CanvasNodePositions } from './canvas-commands';
import { normalizeCanvasSemantics, type CanvasSemantics } from './canvas-domain';
import { normalizeVideoDuration, type VideoGeneration, type VideoGenerationPlan, type VideoModelId } from './video-generation';

export type CanvasAspectRatio = '9:16' | '16:9' | '1:1';
export type CanvasReferenceMode = 'start-end' | 'omni';
export type UploadedFrame = { assetId: string; name: string; previewUrl: string; width: number; height: number };
export type PersistedFrame = Omit<UploadedFrame, 'previewUrl'>;

export type ShotSnapshot = {
  shot: number;
  nodes: CanvasNodePositions;
  prompt: string;
  model: VideoModelId;
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
};

export type SavedShot = {
  shot: number;
  nodes: CanvasNodePositions;
  prompt: string;
  model: VideoModelId;
  duration: string;
  aspectRatio: CanvasAspectRatio;
  resolution: string;
  startFrame: PersistedFrame | null;
  endFrame: PersistedFrame | null;
  referenceMode?: CanvasReferenceMode;
  referenceFrames?: PersistedFrame[];
  generationId: string | null;
  semantics?: CanvasSemantics;
};

export function cloneFrame(frame: UploadedFrame | null): UploadedFrame | null {
  return frame ? { ...frame } : null;
}

export function stripFrame(frame: UploadedFrame | null): PersistedFrame | null {
  if (!frame) return null;
  return { assetId: frame.assetId, name: frame.name, width: frame.width, height: frame.height };
}

export function restoreFrame(frame: PersistedFrame | null | undefined): UploadedFrame | null {
  return frame ? { ...frame, previewUrl: '' } : null;
}

export function restoreSavedShot(saved: SavedShot, restoreNodes: (value: unknown) => CanvasNodePositions): ShotSnapshot {
  const shot = Number.isInteger(saved.shot) && saved.shot > 0 ? saved.shot : 1;
  const model = saved.model || 'seedance-2';
  return {
    shot,
    nodes: restoreNodes(saved.nodes),
    prompt: saved.prompt || '',
    model,
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
  };
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
  return {
    shot: snapshot.shot,
    nodes: snapshot.nodes,
    prompt: snapshot.prompt,
    model: snapshot.model,
    duration: snapshot.duration,
    aspectRatio: snapshot.aspectRatio,
    resolution: snapshot.resolution,
    startFrame: stripFrame(snapshot.startFrame),
    endFrame: stripFrame(snapshot.endFrame),
    referenceMode: snapshot.referenceMode,
    referenceFrames: snapshot.referenceFrames.map(stripFrame).filter((frame): frame is PersistedFrame => Boolean(frame)),
    generationId: snapshot.generation?.id || snapshot.restoredGenerationId,
    semantics: snapshot.semantics,
  };
}

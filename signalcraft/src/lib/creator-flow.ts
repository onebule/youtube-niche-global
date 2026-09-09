/**
 * Creator Flow is deliberately a small presentation layer over the existing
 * canvas semantics. It does not create a second graph, provider integration,
 * or billing path: a project brief only helps a creator start a shot draft.
 */
import type { CanvasCreatorContext } from './canvas-domain';
import type { CanvasShotSemantic } from './canvas-domain';

export type CreatorProjectFormat = 'short' | 'landscape' | 'square' | 'series';
export type CreatorBibleField = 'character' | 'scene' | 'style' | 'camera' | 'motion';
export type CreatorBible = {
  character: string;
  scene: string;
  style: string;
  camera: string;
  motion: string;
  locks: Record<CreatorBibleField, boolean>;
};

export type CreatorProject = {
  title: string;
  brief: string;
  format: CreatorProjectFormat;
  /** A human-facing label for the existing ordered Shot workspace. */
  sequenceTitle: string;
  /** Private project-wide rules. New shots and explicit applications include them as visible prompt text. */
  bible: CreatorBible;
};

export type CreatorFlowStage = 'brief' | 'reference' | 'direction' | 'ready' | 'rendering' | 'complete' | 'needs_attention';

const FORMATS: CreatorProjectFormat[] = ['short', 'landscape', 'square', 'series'];
export const CREATOR_BIBLE_FIELDS: CreatorBibleField[] = ['character', 'scene', 'style', 'camera', 'motion'];
const BIBLE_BLOCK_START = '[SIGNALCRAFT_PROJECT_RULES]';
const BIBLE_BLOCK_END = '[/SIGNALCRAFT_PROJECT_RULES]';
const BIBLE_BLOCK_PATTERN = /\s*\[SIGNALCRAFT_PROJECT_RULES\][\s\S]*?\[\/SIGNALCRAFT_PROJECT_RULES\]\s*/g;
const SHOT_INTENT_BLOCK_PATTERN = /\s*\[SIGNALCRAFT_SHOT_INTENT\][\s\S]*?\[\/SIGNALCRAFT_SHOT_INTENT\]\s*/g;

function clean(value: unknown, maximum: number) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maximum);
}

export function createCreatorProject(): CreatorProject {
  return { title: '未命名项目', brief: '', format: 'short', sequenceTitle: '主镜头序列', bible: createCreatorBible() };
}

export function createCreatorBible(): CreatorBible {
  return {
    character: '', scene: '', style: '', camera: '', motion: '',
    locks: { character: false, scene: false, style: false, camera: false, motion: false },
  };
}

export function normalizeCreatorBible(value: unknown): CreatorBible {
  const candidate = value && typeof value === 'object' ? value as Partial<CreatorBible> : {};
  const locks: Partial<Record<CreatorBibleField, boolean>> = candidate.locks && typeof candidate.locks === 'object' ? candidate.locks : {};
  const bible = createCreatorBible();
  for (const field of CREATOR_BIBLE_FIELDS) {
    bible[field] = clean(candidate[field], 240);
    bible.locks[field] = Boolean(locks[field]) && Boolean(bible[field]);
  }
  return bible;
}

/** Accept old local snapshots without asking a creator to rebuild a project. */
export function normalizeCreatorProject(value: unknown): CreatorProject {
  const candidate = value && typeof value === 'object' ? value as Partial<CreatorProject> : {};
  const format = FORMATS.includes(candidate.format as CreatorProjectFormat) ? candidate.format as CreatorProjectFormat : 'short';
  return {
    title: clean(candidate.title, 80) || '未命名项目',
    brief: clean(candidate.brief, 1200),
    format,
    sequenceTitle: clean(candidate.sequenceTitle, 80) || '主镜头序列',
    bible: normalizeCreatorBible(candidate.bible),
  };
}

export function creatorBibleSummary(bible: CreatorBible) {
  const filled = CREATOR_BIBLE_FIELDS.filter(field => Boolean(bible[field].trim()));
  return { filled: filled.length, locked: filled.filter(field => bible.locks[field]).length };
}

/** A compact, non-secret snapshot for one read-only AI Director planning turn. */
export function creatorAgentContext(project: CreatorProject, sequence: CanvasCreatorContext['sequence']): CanvasCreatorContext {
  const bible = {} as CanvasCreatorContext['bible'];
  for (const field of CREATOR_BIBLE_FIELDS) {
    bible[field] = { value: project.bible[field], locked: project.bible.locks[field] };
  }
  return {
    project: { title: project.title, format: project.format, sequenceTitle: project.sequenceTitle },
    sequence: {
      shotCount: Math.min(999, Math.max(1, Math.round(sequence.shotCount || 1))),
      currentShot: Math.min(999, Math.max(1, Math.round(sequence.currentShot || 1))),
      currentShotPosition: Math.min(999, Math.max(1, Math.round(sequence.currentShotPosition || 1))),
    },
    bible,
  };
}

export function creatorBiblePromptBlock(project: CreatorProject, locale: 'zh' | 'en') {
  const labels: Record<CreatorBibleField, string> = locale === 'zh'
    ? { character: '人物 / 身份', scene: '场景', style: '风格', camera: '镜头', motion: '动作' }
    : { character: 'Character / identity', scene: 'Scene', style: 'Style', camera: 'Camera', motion: 'Motion' };
  const lines = CREATOR_BIBLE_FIELDS.flatMap(field => {
    const value = project.bible[field].trim();
    if (!value) return [];
    const mode = project.bible.locks[field] ? (locale === 'zh' ? '锁定，必须保留' : 'LOCKED — preserve') : (locale === 'zh' ? '项目方向' : 'Project direction');
    return [`${labels[field]}（${mode}）：${value}`];
  });
  return lines.length ? `${BIBLE_BLOCK_START}\n${lines.join('\n')}\n${BIBLE_BLOCK_END}` : '';
}

/** Project rules help a shot, but are not themselves a shot direction. */
export function creatorShotDirection(input: string) {
  return String(input || '').replace(BIBLE_BLOCK_PATTERN, '\n').replace(SHOT_INTENT_BLOCK_PATTERN, '\n').trim();
}

export function mergeCreatorShotIntentIntoPrompt(input: string, shot: CanvasShotSemantic, locale: 'zh' | 'en', maximum = 1200) {
  const labels = locale === 'zh'
    ? { purpose: '目的', character: '人物', scene: '场景', camera: '镜头', motion: '动作' }
    : { purpose: 'Purpose', character: 'Character', scene: 'Scene', camera: 'Camera', motion: 'Motion' };
  const fields = ['purpose', 'character', 'scene', 'camera', 'motion'] as const;
  const lines = fields.flatMap(field => shot[field].trim() ? [`${labels[field]}：${shot[field].trim()}`] : []);
  const withoutPrevious = String(input || '').replace(SHOT_INTENT_BLOCK_PATTERN, '\n').trim();
  if (!lines.length) return { prompt: withoutPrevious, applied: false, reason: 'empty' as const };
  const block = `[SIGNALCRAFT_SHOT_INTENT]\n${lines.join('\n')}\n[/SIGNALCRAFT_SHOT_INTENT]`;
  const prompt = [withoutPrevious, block].filter(Boolean).join('\n\n');
  if (prompt.length > maximum) return { prompt: String(input || '').trim(), applied: false, reason: 'too_long' as const };
  return { prompt, applied: true, reason: null };
}

/**
 * Project rules are explicit prompt text, never a hidden provider setting.
 * Reapplying replaces the old block, and refuses to truncate locked rules.
 */
export function mergeCreatorBibleIntoPrompt(input: string, project: CreatorProject, locale: 'zh' | 'en', maximum = 1200) {
  // Keep the current shot's intent block intact. Project Bible is project-wide;
  // replacing it must never silently erase a separate shot-level decision.
  const withoutPrevious = String(input || '').replace(BIBLE_BLOCK_PATTERN, '\n').trim();
  const block = creatorBiblePromptBlock(project, locale);
  if (!block) return { prompt: withoutPrevious, applied: false, reason: 'empty' as const };
  const prompt = [withoutPrevious, block].filter(Boolean).join('\n\n');
  if (prompt.length > maximum) return { prompt: String(input || '').trim(), applied: false, reason: 'too_long' as const };
  return { prompt, applied: true, reason: null };
}

/**
 * Copy only a creator-authored project brief into a first-shot draft. This is
 * intentionally not a prompt compiler and never calls a model or submits work.
 */
export function projectBriefToShotDraft(project: CreatorProject) {
  return clean(project.brief, 1200);
}

export function creatorFlowStage(input: {
  brief: string;
  hasReference: boolean;
  hasPrompt: boolean;
  generationStatus?: 'queued' | 'processing' | 'completed' | 'failed' | null;
}): CreatorFlowStage {
  if (input.generationStatus === 'queued' || input.generationStatus === 'processing') return 'rendering';
  if (input.generationStatus === 'completed') return 'complete';
  if (input.generationStatus === 'failed') return 'needs_attention';
  if (!input.brief.trim()) return 'brief';
  if (!input.hasReference) return 'reference';
  if (!input.hasPrompt) return 'direction';
  return 'ready';
}

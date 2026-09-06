/**
 * Creator Flow is deliberately a small presentation layer over the existing
 * canvas semantics. It does not create a second graph, provider integration,
 * or billing path: a project brief only helps a creator start a shot draft.
 */
export type CreatorProjectFormat = 'short' | 'landscape' | 'square' | 'series';

export type CreatorProject = {
  title: string;
  brief: string;
  format: CreatorProjectFormat;
};

export type CreatorFlowStage = 'brief' | 'reference' | 'direction' | 'ready' | 'rendering' | 'complete' | 'needs_attention';

const FORMATS: CreatorProjectFormat[] = ['short', 'landscape', 'square', 'series'];

function clean(value: unknown, maximum: number) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maximum);
}

export function createCreatorProject(): CreatorProject {
  return { title: '未命名项目', brief: '', format: 'short' };
}

/** Accept old local snapshots without asking a creator to rebuild a project. */
export function normalizeCreatorProject(value: unknown): CreatorProject {
  const candidate = value && typeof value === 'object' ? value as Partial<CreatorProject> : {};
  const format = FORMATS.includes(candidate.format as CreatorProjectFormat) ? candidate.format as CreatorProjectFormat : 'short';
  return {
    title: clean(candidate.title, 80) || '未命名项目',
    brief: clean(candidate.brief, 1200),
    format,
  };
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

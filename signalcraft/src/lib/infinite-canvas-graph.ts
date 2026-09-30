import type { VideoModel, VideoModelId } from './video-generation';
import type { CanvasTextModelId } from './canvas-text-generation';

export const infiniteAssetKey = (projectId: string, nodeId: string) => `${projectId}:${nodeId}`;

export function createInfiniteAttemptGuard(scope: string, currentScope: () => string | null) {
  const assert = () => {
    if (currentScope() !== scope) throw new Error('账号已变更，已取消本次操作。 / Account changed. Operation cancelled.');
  };
  return { assert, async run<T>(action: () => Promise<T>): Promise<T> {
    assert(); const result = await action(); assert(); return result;
  } };
}

export type InfiniteNodeKind = 'text' | 'image' | 'video' | 'video-result' | 'audio' | 'storyboard' | 'note';
export type InfiniteInputPort = 'prompt' | 'start' | 'end' | 'reference';
export type InfiniteVideoMode = 'text' | 'start-end' | 'omni';
export type InfiniteVideoSettings = {
  model: Exclude<VideoModelId, 'auto'> | null;
  mode: InfiniteVideoMode;
  modeSelection: 'auto' | 'manual';
  prompt: string;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
};
export type InfiniteRun = {
  jobId: string;
  generationId: string | null;
  model?: Exclude<VideoModelId, 'auto'> | null;
  prompt?: string;
  state: string;
  videoAssetId: string | null;
  error: string | null;
  submittedAt: string;
};
export type InfiniteCanvasNode = {
  id: string;
  kind: InfiniteNodeKind;
  x: number;
  y: number;
  title: string;
  text: string;
  textModel?: CanvasTextModelId | null;
  textResult?: string;
  assetId: string | null;
  output?: { type: 'image' | 'video'; assetId: string; generationId?: string | null; model?: string | null; prompt?: string } | null;
  assetName: string | null;
  width: number | null;
  height: number | null;
  video: InfiniteVideoSettings | null;
  runs: InfiniteRun[];
};
export type InfiniteCanvasEdge = {
  id: string;
  source: string;
  target: string;
  port: InfiniteInputPort;
};
export type InfiniteCanvasProject = {
  version: 1;
  id: string;
  title: string;
  nodes: InfiniteCanvasNode[];
  edges: InfiniteCanvasEdge[];
  view: { x: number; y: number; scale: number };
  updatedAt: string;
};
export type InfiniteCanvasWorkspace = {
  version: 1;
  activeProjectId: string;
  projects: InfiniteCanvasProject[];
};
export type InfiniteGenerationInputs = {
  mode: InfiniteVideoMode;
  prompt: string;
  startFrame: InfiniteCanvasNode | null;
  endFrame: InfiniteCanvasNode | null;
  referenceFrames: InfiniteCanvasNode[];
  referenceVideos: InfiniteCanvasNode[];
  referenceAudios: InfiniteCanvasNode[];
  errors: string[];
};

const nodeKinds: InfiniteNodeKind[] = ['text', 'image', 'video', 'video-result', 'audio', 'storyboard', 'note'];
const ports: InfiniteInputPort[] = ['prompt', 'start', 'end', 'reference'];
const videoModes: InfiniteVideoMode[] = ['text', 'start-end', 'omni'];
const ratios = ['9:16', '16:9', '1:1'];
const knownModels: Exclude<VideoModelId, 'auto'>[] = ['minimax-h3', 'seedance-2', 'seedance-2-5', 'kling-3', 'veo-3.1-lite'];
const finiteCoordinate = (value: unknown, fallback = 0) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(-500000, Math.min(500000, value)) : fallback;
const shortText = (value: unknown, limit = 1200) => typeof value === 'string' ? value.slice(0, limit) : '';
const safeDate = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : new Date(0).toISOString();

export const DEFAULT_INFINITE_VIDEO: InfiniteVideoSettings = {
  model: null,
  mode: 'start-end',
  modeSelection: 'auto',
  prompt: '',
  duration: '5s',
  aspectRatio: '9:16',
  resolution: '720p',
};

export function createInfiniteProject(id: string, title = 'Untitled'): InfiniteCanvasProject {
  return { version: 1, id, title, nodes: [], edges: [], view: { x: 0, y: 0, scale: 1 }, updatedAt: new Date(0).toISOString() };
}

export function createInfiniteNode(id: string, kind: InfiniteNodeKind, x: number, y: number): InfiniteCanvasNode {
  const labels: Record<InfiniteNodeKind, string> = {
    text: '文本', image: '图片', video: '视频生成', 'video-result': '视频结果', audio: '音频', storyboard: '分镜', note: '便签',
  };
  return {
    id, kind, x: finiteCoordinate(x), y: finiteCoordinate(y),
    title: labels[kind], text: '', assetId: null, output: null, assetName: null,
    width: null, height: null, video: kind === 'video' ? { ...DEFAULT_INFINITE_VIDEO } : null, runs: [],
  };
}

export function normalizeInfiniteNode(value: unknown): InfiniteCanvasNode | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<InfiniteCanvasNode>;
  if (typeof item.id !== 'string' || item.id.length < 1 || item.id.length > 100 || !nodeKinds.includes(item.kind as InfiniteNodeKind)) return null;
  const kind = item.kind as InfiniteNodeKind;
  const created = createInfiniteNode(item.id, kind, finiteCoordinate(item.x), finiteCoordinate(item.y));
  const v = item.video;
  const rawRuns = Array.isArray(item.runs) ? item.runs : [];
  return {
    ...created,
    title: shortText(item.title, 70) || created.title,
    text: shortText(item.text, 12000),
    textModel: kind === 'text' && (item.textModel === 'claude-fable-5-1' || item.textModel === 'claude-opus-5-5' || item.textModel === 'gpt-6-sol' || item.textModel === 'gpt-6-astra') ? item.textModel : null,
    textResult: kind === 'text' ? shortText(item.textResult, 12000) : '',
    assetId: typeof item.assetId === 'string' && item.assetId.length <= 240 ? item.assetId : null,
    output: (kind === 'image' || kind === 'video-result') && typeof item.assetId === 'string' && item.assetId.length <= 240
      ? { type: kind === 'image' ? 'image' : 'video', assetId: item.assetId,
        ...(kind === 'video-result' ? { generationId: shortText(item.output?.generationId, 140) || null,
          model: shortText(item.output?.model, 80) || null, prompt: shortText(item.output?.prompt, 1200) } : {}) } : null,
    assetName: shortText(item.assetName, 200) || null,
    width: typeof item.width === 'number' && item.width > 0 ? Math.min(item.width, 25000) : null,
    height: typeof item.height === 'number' && item.height > 0 ? Math.min(item.height, 25000) : null,
    video: kind === 'video' ? {
      model: knownModels.includes(v?.model as Exclude<VideoModelId, 'auto'>) ? v!.model : null,
      mode: videoModes.includes(v?.mode as InfiniteVideoMode) ? v!.mode : 'start-end',
      modeSelection: v?.modeSelection === 'manual' || (v?.modeSelection !== 'auto' && v?.mode !== 'start-end') ? 'manual' : 'auto',
      prompt: shortText(v?.prompt),
      duration: typeof v?.duration === 'string' && /^\d{1,2}s$/.test(v.duration) ? v.duration : '5s',
      aspectRatio: ratios.includes(v?.aspectRatio as string) ? v!.aspectRatio : '9:16',
      resolution: shortText(v?.resolution, 16) || '720p',
    } : null,
    runs: rawRuns.flatMap(run => {
      if (!run || typeof run !== 'object' || typeof run.jobId !== 'string' || !run.jobId) return [];
      return [{
        jobId: run.jobId.slice(0, 140), generationId: shortText(run.generationId, 140) || null,
        model: knownModels.includes(run.model as Exclude<VideoModelId, 'auto'>) ? run.model : null,
        prompt: shortText(run.prompt, 1200),
        state: shortText(run.state, 35) || 'CREATED', videoAssetId: shortText(run.videoAssetId, 140) || null,
        error: shortText(run.error, 320) || null, submittedAt: safeDate(run.submittedAt),
      }];
    }),
  };
}

export function normalizeInfiniteWorkspace(raw: unknown, defaultProjectId = 'first-project'): InfiniteCanvasWorkspace {
  const initial = createInfiniteProject(defaultProjectId);
  if (!raw || typeof raw !== 'object') return { version: 1, activeProjectId: initial.id, projects: [initial] };
  const input = raw as Partial<InfiniteCanvasWorkspace>;
  if (input.version !== 1 || !Array.isArray(input.projects)) return { version: 1, activeProjectId: initial.id, projects: [initial] };
  const projects: InfiniteCanvasProject[] = input.projects.slice(0, 40).flatMap(item => {
    if (!item || typeof item.id !== 'string' || !item.id || item.id.length > 100) return [];
    const seen = new Set<string>();
    const nodes = (Array.isArray(item.nodes) ? item.nodes : []).slice(0, 400).map(normalizeInfiniteNode)
      .filter((node): node is InfiniteCanvasNode => {
        if (!node || seen.has(node.id)) return false;
        seen.add(node.id); return true;
      });
    const ids = new Set(nodes.map(node => node.id));
    const edges = (Array.isArray(item.edges) ? item.edges : []).slice(0, 800).flatMap(edge => {
      if (!edge || typeof edge.id !== 'string' || !ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target ||
          !ports.includes(edge.port as InfiniteInputPort)) return [];
      return [{ id: edge.id.slice(0, 100), source: edge.source, target: edge.target, port: edge.port as InfiniteInputPort }];
    });
    const project: InfiniteCanvasProject = {
      version: 1 as const, id: item.id, title: shortText(item.title, 85) || 'Untitled',
      nodes, edges,
      view: {
        x: finiteCoordinate(item.view?.x), y: finiteCoordinate(item.view?.y),
        scale: typeof item.view?.scale === 'number' && Number.isFinite(item.view.scale) ? Math.max(0.2, Math.min(2.5, item.view.scale)) : 1,
      },
      updatedAt: safeDate(item.updatedAt),
    };
    project.edges = [];
    for (const edge of edges) {
      if (!connectionIssue(project, edge.source, edge.target, edge.port)) {
        project.edges = connectInfiniteNodes(project, edge.id, edge.source, edge.target, edge.port).edges;
      }
    }
    return [project];
  });
  if (!projects.length) projects.push(initial);
  return {
    version: 1,
    activeProjectId: projects.some(project => project.id === input.activeProjectId) ? input.activeProjectId! : projects[0].id,
    projects,
  };
}

export function connectionIssue(project: InfiniteCanvasProject, sourceId: string, targetId: string, port: InfiniteInputPort): string | null {
  const source = project.nodes.find(node => node.id === sourceId);
  const target = project.nodes.find(node => node.id === targetId);
  if (!source || !target) return '节点不存在';
  if (!ports.includes(port)) return '连接端口不可用';
  if (sourceId === targetId) return '不能连接节点自身';
  const reachable = new Set([targetId]);
  for (let changed = true; changed;) {
    changed = false;
    for (const edge of project.edges) if (reachable.has(edge.source) && !reachable.has(edge.target)) { reachable.add(edge.target); changed = true; }
  }
  if (reachable.has(sourceId)) return '不能形成循环连接';
  if (target.kind === 'video-result') return source.kind === 'video' && port === 'reference'
    ? project.edges.some(edge => edge.target === targetId) ? '结果节点已有生成来源' : null
    : '结果节点只能接收生成器输出';
  if (target.kind !== 'video') return '目前仅支持将素材或文本连接到视频节点';
  if (source.kind === 'image' && port === 'prompt') return '图片不能接入提示词端口';
  if (source.kind === 'image' && !['start', 'end', 'reference'].includes(port)) return '图片只能接入首帧、尾帧或参考图端口';
  if (source.kind === 'audio' && port !== 'reference') return '音频只能接入全能参考端口';
  if (['text', 'storyboard', 'note'].includes(source.kind) && port !== 'prompt') return '文字只能接入提示词端口';
  if (source.kind === 'video') return '请连接视频结果节点，而不是生成器节点';
  if (source.kind === 'video-result' && port !== 'reference') return '视频结果只能接入全能参考端口';
  if (source.kind === 'video-result' && target.video?.model && target.video.model !== 'minimax-h3') return '参考视频当前仅支持 MiniMax H3';
  if (source.kind === 'video-result' && !source.assetId) return '视频结果尚未生成完成';
  if (project.edges.some(edge => edge.source === sourceId && edge.target === targetId && edge.port === port)) return '这条连接已经存在';
  return null;
}

export function connectInfiniteNodes(project: InfiniteCanvasProject, id: string, source: string, target: string, port: InfiniteInputPort): InfiniteCanvasProject {
  const issue = connectionIssue(project, source, target, port);
  if (issue) throw new Error(issue);
  const edges = project.edges.filter(edge => !(edge.target === target && (edge.port === port && port !== 'reference')));
  return { ...project, edges: [...edges, { id, source, target, port }] };
}

/** A generated asset stays in private storage; result nodes only persist its owned asset ID. */
export function upsertInfiniteVideoResult(project: InfiniteCanvasProject, generatorId: string, run: InfiniteRun): InfiniteCanvasProject {
  const generator = project.nodes.find(node => node.id === generatorId && node.kind === 'video');
  if (!generator || run.state !== 'SUCCEEDED' || !run.videoAssetId) return project;
  const id = `video-result:${run.jobId.slice(0, 80)}`;
  const existing = project.nodes.find(node => node.id === id);
  const result: InfiniteCanvasNode = {
    ...(existing || createInfiniteNode(id, 'video-result', generator.x + 520, generator.y)),
    title: `视频结果 ${run.generationId ? run.generationId.slice(0, 8) : ''}`.trim(),
    assetId: run.videoAssetId, assetName: `Generation ${run.jobId.slice(0, 8)}`,
    output: { type: 'video', assetId: run.videoAssetId, generationId: run.generationId,
      model: run.model || generator.video?.model, prompt: run.prompt || generator.video?.prompt || '' },
  };
  const nodes = existing ? project.nodes.map(node => node.id === id ? result : node) : [...project.nodes, result];
  const withNode = { ...project, nodes };
  return project.edges.some(edge => edge.source === generatorId && edge.target === id)
    ? withNode : connectInfiniteNodes(withNode, `${id}:edge`, generatorId, id, 'reference');
}

export function collectInfiniteGenerationInputs(project: InfiniteCanvasProject, videoId: string): InfiniteGenerationInputs {
  const video = project.nodes.find(node => node.id === videoId && node.kind === 'video');
  if (!video?.video) return { mode: 'text', prompt: '', startFrame: null, endFrame: null, referenceFrames: [], referenceVideos: [], referenceAudios: [], errors: ['请选择视频节点'] };
  const incoming = project.edges.filter(edge => edge.target === videoId);
  const sourceFor = (edge: InfiniteCanvasEdge) => project.nodes.find(node => node.id === edge.source);
  const first = (port: InfiniteInputPort) => incoming.filter(edge => edge.port === port).map(sourceFor).find((node): node is InfiniteCanvasNode => Boolean(node)) || null;
  const references = incoming.filter(edge => edge.port === 'reference').map(sourceFor).filter((node): node is InfiniteCanvasNode => Boolean(node));
  const connectedText = incoming.filter(edge => edge.port === 'prompt').map(sourceFor).map(node => node?.text?.trim()).filter(Boolean).join('\n\n');
  const errors: string[] = [];
  const start = first('start');
  const end = first('end');
  const images = references.filter(node => node.kind === 'image');
  const videos = references.filter(node => node.kind === 'video-result');
  const audios = references.filter(node => node.kind === 'audio');
  const allImages = [...new Map([start, end, ...images].filter((node): node is InfiniteCanvasNode => node?.kind === 'image').map(node => [node.id, node])).values()];
  const mode: InfiniteVideoMode = video.video.modeSelection === 'manual' ? video.video.mode
    : videos.length || audios.length || allImages.length >= 3 ? 'omni' : allImages.length ? 'start-end' : 'text';
  const startFrame = mode === 'start-end' ? (start?.kind === 'image' ? start : images.find(node => node.id !== end?.id) || null) : null;
  const endFrame = mode === 'start-end' ? (end?.kind === 'image' ? end : startFrame ? images.find(node => node.id !== startFrame.id) || null : null) : null;
  const referenceFrames = mode === 'omni' ? allImages : [];
  const referenceVideos = mode === 'omni' ? videos : [];
  if (mode === 'start-end' && !startFrame?.assetId) errors.push(endFrame ? '已连接尾帧，但还需要一张已上传的首帧图片' : '首尾帧模式需要至少 1 张已上传的首帧图片');
  if (mode === 'start-end' && endFrame && !endFrame.assetId) errors.push('尾帧图片尚未上传');
  if (mode === 'omni' && !referenceFrames.some(node => node.assetId) && !referenceVideos.some(node => node.assetId)) errors.push('全能参考至少需要一张已上传的图片或一个已生成的视频');
  if (mode === 'omni' && referenceFrames.length > 9) errors.push('全能参考最多支持 9 张图片');
  if (mode === 'omni' && referenceVideos.length > 3) errors.push('全能参考最多支持 3 个参考视频');
  if (mode === 'omni' && audios.length > 3) errors.push('最多支持 3 个参考音频');
  if (mode === 'omni') {
    for (const node of [...referenceFrames, ...referenceVideos, ...audios]) if (!node.assetId) errors.push(node.title + ' 尚未上传或生成');
    if ((audios.length || referenceVideos.length) && video.video.model !== 'minimax-h3') errors.push('参考视频和音频当前仅支持 MiniMax H3');
  }
  const prompt = [video.video.prompt.trim(), connectedText].filter(Boolean).join('\n\n');
  if (prompt.length > 1200) errors.push('组合后的提示词超过 1200 个字符');
  return { mode, prompt, startFrame, endFrame, referenceFrames,
    referenceVideos, referenceAudios: mode === 'omni' ? audios : [], errors };
}

export function usableInfiniteModel(model: VideoModel | undefined, mode: InfiniteVideoMode): boolean {
  if (!model?.enabled || !knownModels.includes(model.id as Exclude<VideoModelId, 'auto'>)) return false;
  if (mode === 'text') return ['minimax-h3', 'veo-3.1-lite'].includes(model.id);
  if (mode === 'omni') return ['minimax-h3', 'seedance-2', 'seedance-2-5'].includes(model.id);
  return model.id !== 'veo-3.1-lite';
}

export function infiniteModelSettings(modelId: Exclude<VideoModelId, 'auto'>): Pick<InfiniteVideoSettings, 'duration' | 'resolution' | 'mode'> {
  if (modelId === 'minimax-h3') return { duration: '8s', resolution: '768P', mode: 'start-end' };
  if (modelId === 'veo-3.1-lite') return { duration: '8s', resolution: '720p', mode: 'text' };
  return { duration: '5s', resolution: '720p', mode: 'start-end' };
}

/** Verify private media returned by the current account, never trust imported ids or dimensions. */
export function infiniteAssetIssue(node: InfiniteCanvasNode, asset: { contentType: string | null; width?: number | null; height?: number | null } | null): string | null {
  if (!asset) return `${node.title} 素材不可访问，请重新上传。`;
  if (node.kind === 'image') {
    if (!asset.contentType?.startsWith('image/')) return `${node.title} 不是图片素材。`;
    if (!Number.isFinite(asset.width) || !Number.isFinite(asset.height) || Number(asset.width) <= 0 || Number(asset.height) <= 0) return `${node.title} 图片尺寸不可用，请重新上传。`;
  } else if (node.kind === 'audio' && !asset.contentType?.startsWith('audio/')) return `${node.title} 不是音频素材。`;
  else if (node.kind === 'video-result' && !asset.contentType?.startsWith('video/')) return `${node.title} 不是视频素材。`;
  return null;
}

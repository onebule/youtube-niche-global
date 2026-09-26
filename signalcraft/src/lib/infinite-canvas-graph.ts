import type { VideoModel, VideoModelId } from './video-generation';

export const infiniteAssetKey = (projectId: string, nodeId: string) => `${projectId}:${nodeId}`;

export function createInfiniteAttemptGuard(scope: string, currentScope: () => string | null) {
  const assert = () => {
    if (currentScope() !== scope) throw new Error('账号已变更，已取消本次操作。 / Account changed. Operation cancelled.');
  };
  return { assert, async run<T>(action: () => Promise<T>): Promise<T> {
    assert(); const result = await action(); assert(); return result;
  } };
}

export type InfiniteNodeKind = 'text' | 'image' | 'video' | 'audio' | 'storyboard' | 'note';
export type InfiniteInputPort = 'prompt' | 'start' | 'end' | 'reference';
export type InfiniteVideoMode = 'text' | 'start-end' | 'omni';
export type InfiniteVideoSettings = {
  model: Exclude<VideoModelId, 'auto'> | null;
  mode: InfiniteVideoMode;
  prompt: string;
  duration: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  resolution: string;
};
export type InfiniteRun = {
  jobId: string;
  generationId: string | null;
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
  assetId: string | null;
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
  prompt: string;
  startFrame: InfiniteCanvasNode | null;
  endFrame: InfiniteCanvasNode | null;
  referenceFrames: InfiniteCanvasNode[];
  referenceAudios: InfiniteCanvasNode[];
  errors: string[];
};

const nodeKinds: InfiniteNodeKind[] = ['text', 'image', 'video', 'audio', 'storyboard', 'note'];
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
    text: '文本', image: '图片', video: '视频生成', audio: '音频', storyboard: '分镜', note: '便签',
  };
  return {
    id, kind, x: finiteCoordinate(x), y: finiteCoordinate(y),
    title: labels[kind], text: '', assetId: null, assetName: null,
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
    assetId: typeof item.assetId === 'string' && item.assetId.length <= 240 ? item.assetId : null,
    assetName: shortText(item.assetName, 200) || null,
    width: typeof item.width === 'number' && item.width > 0 ? Math.min(item.width, 25000) : null,
    height: typeof item.height === 'number' && item.height > 0 ? Math.min(item.height, 25000) : null,
    video: kind === 'video' ? {
      model: knownModels.includes(v?.model as Exclude<VideoModelId, 'auto'>) ? v!.model : null,
      mode: videoModes.includes(v?.mode as InfiniteVideoMode) ? v!.mode : 'start-end',
      prompt: shortText(v?.prompt),
      duration: typeof v?.duration === 'string' && /^\d{1,2}s$/.test(v.duration) ? v.duration : '5s',
      aspectRatio: ratios.includes(v?.aspectRatio as string) ? v!.aspectRatio : '9:16',
      resolution: shortText(v?.resolution, 16) || '720p',
    } : null,
    runs: rawRuns.flatMap(run => {
      if (!run || typeof run !== 'object' || typeof run.jobId !== 'string' || !run.jobId) return [];
      return [{
        jobId: run.jobId.slice(0, 140), generationId: shortText(run.generationId, 140) || null,
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
  if (target.kind !== 'video') return '目前仅支持将素材或文本连接到视频节点';
  if (source.kind === 'image' && port === 'prompt') return '图片不能接入提示词端口';
  if (source.kind === 'image' && !['start', 'end', 'reference'].includes(port)) return '图片只能接入首帧、尾帧或参考图端口';
  if (source.kind === 'audio' && port !== 'reference') return '音频只能接入全能参考端口';
  if (['text', 'storyboard', 'note'].includes(source.kind) && port !== 'prompt') return '文字只能接入提示词端口';
  if (source.kind === 'video') return '视频结果接力尚未接入现有生成服务，请先将结果图片添加为图片节点';
  if (project.edges.some(edge => edge.source === sourceId && edge.target === targetId && edge.port === port)) return '这条连接已经存在';
  return null;
}

export function connectInfiniteNodes(project: InfiniteCanvasProject, id: string, source: string, target: string, port: InfiniteInputPort): InfiniteCanvasProject {
  const issue = connectionIssue(project, source, target, port);
  if (issue) throw new Error(issue);
  const edges = project.edges.filter(edge => !(edge.target === target && (edge.port === port && port !== 'reference')));
  return { ...project, edges: [...edges, { id, source, target, port }] };
}

export function collectInfiniteGenerationInputs(project: InfiniteCanvasProject, videoId: string): InfiniteGenerationInputs {
  const video = project.nodes.find(node => node.id === videoId && node.kind === 'video');
  if (!video?.video) return { prompt: '', startFrame: null, endFrame: null, referenceFrames: [], referenceAudios: [], errors: ['请选择视频节点'] };
  const incoming = project.edges.filter(edge => edge.target === videoId);
  const sourceFor = (edge: InfiniteCanvasEdge) => project.nodes.find(node => node.id === edge.source);
  const first = (port: InfiniteInputPort) => incoming.filter(edge => edge.port === port).map(sourceFor).find((node): node is InfiniteCanvasNode => Boolean(node)) || null;
  const references = incoming.filter(edge => edge.port === 'reference').map(sourceFor).filter((node): node is InfiniteCanvasNode => Boolean(node));
  const connectedText = incoming.filter(edge => edge.port === 'prompt').map(sourceFor).map(node => node?.text?.trim()).filter(Boolean).join('\n\n');
  const errors: string[] = [];
  const start = first('start');
  const end = first('end');
  const images = references.filter(node => node.kind === 'image');
  const audios = references.filter(node => node.kind === 'audio');
  if (video.video.mode === 'start-end' && (!start || !start.assetId)) errors.push('首尾帧模式需要连接并上传首帧图片');
  if (video.video.mode === 'start-end' && end && !end.assetId) errors.push('尾帧图片尚未上传');
  if (video.video.mode === 'start-end' && start && start.kind !== 'image') errors.push('首帧必须连接图片节点');
  if (video.video.mode === 'start-end' && end && end.kind !== 'image') errors.push('尾帧必须连接图片节点');
  if (video.video.mode === 'omni' && !images.some(node => node.assetId)) errors.push('全能参考至少需要一张已上传的参考图片');
  if (video.video.mode === 'omni' && images.length > 9) errors.push('全能参考最多支持 9 张图片');
  if (video.video.mode === 'omni' && audios.length > 3) errors.push('最多支持 3 个参考音频');
  if (video.video.mode === 'omni') {
    for (const node of [...images, ...audios]) if (!node.assetId) errors.push(node.title + ' 尚未上传');
    if (audios.length && video.video.model !== 'minimax-h3') errors.push('参考音频当前仅支持 MiniMax H3');
  }
  const prompt = [video.video.prompt.trim(), connectedText].filter(Boolean).join('\n\n');
  if (prompt.length > 1200) errors.push('组合后的提示词超过 1200 个字符');
  return { prompt, startFrame: video.video.mode === 'start-end' ? start : null,
    endFrame: video.video.mode === 'start-end' ? end : null,
    referenceFrames: video.video.mode === 'omni' ? images : [], referenceAudios: video.video.mode === 'omni' ? audios : [], errors };
}

export function usableInfiniteModel(model: VideoModel | undefined, mode: InfiniteVideoMode): boolean {
  if (!model?.enabled || !knownModels.includes(model.id as Exclude<VideoModelId, 'auto'>)) return false;
  if (mode === 'text') return model.id === 'veo-3.1-lite';
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
  return null;
}

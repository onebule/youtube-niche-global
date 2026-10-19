import type { InfiniteCanvasProject, InfiniteCanvasNode } from './infinite-canvas-graph';

/**
 * Pure, deterministic workflow preview. Never reads a credential, writes a
 * database, spends credits or invokes a provider. Real execution remains
 * behind the existing backend execution gate and explicit user consent.
 */
export type WorkflowStepState =
  | 'READY_FOR_MANUAL_PREFLIGHT'
  | 'NEEDS_MODEL'
  | 'NEEDS_PROMPT'
  | 'NEEDS_ASSETS'
  | 'INVALID_INPUT';

export type WorkflowStepPreview = {
  nodeId: string;
  title: string;
  model: string | null;
  mode: string;
  dependsOn: string[];
  state: WorkflowStepState;
  issues: string[];
};

export type WorkflowDryRun = {
  schemaVersion: 1;
  projectId: string;
  executionEnabled: false;
  estimatedCredits: null;
  paidJobs: 0;
  videos: WorkflowStepPreview[];
  invalidEdges: number;
  hasCycle: boolean;
  issues: string[];
};

const unique = (items: string[]) => Array.from(new Set(items));

export function previewStudioWorkflow(project: InfiniteCanvasProject): WorkflowDryRun {
  const nodes = new Map(project.nodes.map(node => [node.id, node]));
  const invalidEdges = project.edges.filter(edge => !nodes.has(edge.source) || !nodes.has(edge.target)).length;
  const videoNodes = project.nodes.filter(node => node.kind === 'video');
  const indexed = new Map(videoNodes.map((node, index) => [node.id, index]));
  const producers = new Map<string, string>();

  for (const result of project.nodes.filter(node => node.kind === 'video-result')) {
    const input = project.edges.filter(edge => edge.target === result.id
      && nodes.get(edge.source)?.kind === 'video');
    if (input.length === 1) producers.set(result.id, input[0].source);
  }

  const dependencies = new Map(videoNodes.map(node => [node.id, new Set<string>()]));
  for (const edge of project.edges) {
    if (!dependencies.has(edge.target)) continue;
    const source = nodes.get(edge.source);
    const origin = source?.kind === 'video-result' ? producers.get(source.id) : null;
    if (origin && origin !== edge.target) dependencies.get(edge.target)?.add(origin);
    if (origin === edge.target) dependencies.get(edge.target)?.add(origin);
  }

  // Stable Kahn sort: ties follow the user's visual node creation order.
  const degree = new Map(videoNodes.map(node => [node.id, dependencies.get(node.id)?.size || 0]));
  const ordered: string[] = [];
  const visited = new Set<string>();
  while (ordered.length < videoNodes.length) {
    const ready = videoNodes.filter(node => !visited.has(node.id) && degree.get(node.id) === 0);
    if (!ready.length) break;
    ready.sort((a, b) => (indexed.get(a.id) || 0) - (indexed.get(b.id) || 0));
    const node = ready[0];
    visited.add(node.id);
    ordered.push(node.id);
    for (const next of videoNodes) {
      if (dependencies.get(next.id)?.has(node.id)) degree.set(next.id, (degree.get(next.id) || 0) - 1);
    }
  }
  const hasCycle = ordered.length !== videoNodes.length;
  for (const node of videoNodes) if (!visited.has(node.id)) ordered.push(node.id);

  function checkInputs(node: InfiniteCanvasNode) {
    const issues: string[] = [];
    const incoming = project.edges.filter(edge => edge.target === node.id);
    const source = (id: string) => nodes.get(id);
    const texts = incoming.filter(edge => edge.port === 'prompt')
      .map(edge => source(edge.source)?.text?.trim() || '').filter(Boolean);
    const settings = node.video;
    const mode = settings?.modeSelection === 'manual' ? settings.mode :
      incoming.some(edge => ['start', 'end'].includes(edge.port)) ? 'start-end' :
      incoming.some(edge => edge.port === 'reference') ? 'omni' : 'text';
    const prompt = [settings?.prompt?.trim() || '', ...texts].filter(Boolean).join('\n\n');

    if (!settings?.model) issues.push('尚未选择视频模型');
    if (!prompt) issues.push('缺少视频生成提示词');
    if (prompt.length > 1200) issues.push('组合提示词超过 1200 字符');

    if (mode === 'start-end') {
      const starts = incoming.filter(edge => edge.port === 'start' ||
        (edge.port === 'reference' && source(edge.source)?.kind === 'image'));
      const validStart = starts.some(edge => source(edge.source)?.kind === 'image'
        && Boolean(source(edge.source)?.assetId));
      if (!validStart) issues.push('首尾帧模式缺少已上传的首帧图片');
      if (incoming.some(edge => edge.port === 'end' && !source(edge.source)?.assetId)) issues.push('尾帧尚未上传');
    } else if (mode === 'omni') {
      const references = incoming.filter(edge => edge.port === 'reference');
      const usable = references.some(edge => Boolean(source(edge.source)?.assetId));
      if (!usable) issues.push('全能参考模式缺少已上传或已生成的素材');
      if (references.some(edge => !source(edge.source)?.assetId)) issues.push('部分参考素材尚未就绪');
      if (references.some(edge => ['audio','video-result'].includes(source(edge.source)?.kind || '')) &&
        settings?.model !== 'minimax-h3') issues.push('音频和视频参考当前仅支持 MiniMax H3');
    }

    let state: WorkflowStepState = 'READY_FOR_MANUAL_PREFLIGHT';
    if (issues.some(item => item.includes('超过') || item.includes('仅支持'))) state = 'INVALID_INPUT';
    else if (issues.some(item => item.includes('未选择'))) state = 'NEEDS_MODEL';
    else if (issues.some(item => item.includes('提示词'))) state = 'NEEDS_PROMPT';
    else if (issues.length) state = 'NEEDS_ASSETS';
    return { mode, issues, state };
  }

  const videos = ordered.map(id => {
    const node = nodes.get(id)!;
    const { issues, state, mode } = checkInputs(node);
    return {
      nodeId: id,
      title: node.title,
      model: node.video?.model || null,
      mode,
      dependsOn: videoNodes.filter(item => dependencies.get(id)?.has(item.id)).map(item => item.id),
      state,
      issues,
    };
  });
  const issues = unique([
    ...(invalidEdges ? [`存在 ${invalidEdges} 条引用丢失节点的连线`] : []),
    ...(hasCycle ? ['发现视频任务循环依赖，无法生成合法执行顺序'] : []),
    ...(videoNodes.length === 0 ? ['当前没有视频任务节点'] : []),
    ...videos.flatMap(step => step.issues.map(issue => `${step.title}: ${issue}`)),
  ]);
  return {
    schemaVersion: 1,
    projectId: project.id,
    executionEnabled: false,
    estimatedCredits: null,
    paidJobs: 0,
    videos,
    invalidEdges,
    hasCycle,
    issues,
  };
}

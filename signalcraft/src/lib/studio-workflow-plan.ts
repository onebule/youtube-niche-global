import type { InfiniteCanvasProject } from './infinite-canvas-graph';
import { collectInfiniteGenerationInputs } from './infinite-canvas-graph.ts';

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

  function checkInputs(nodeId: string) {
    // Reuse the production graph's input collector to avoid disagreement
    // about auto mode, reference ports, missing assets or prompt limits.
    const node = nodes.get(nodeId)!;
    const input = collectInfiniteGenerationInputs(project, nodeId);
    const issues = [
      ...(!node.video?.model ? ['尚未选择视频模型'] : []),
      ...(!input.prompt.trim() ? ['缺少视频生成提示词'] : []),
      ...input.errors,
    ];
    let state: WorkflowStepState = 'READY_FOR_MANUAL_PREFLIGHT';
    if (issues.some(item => item.includes('超过') || item.includes('仅支持'))) state = 'INVALID_INPUT';
    else if (!node.video?.model) state = 'NEEDS_MODEL';
    else if (!input.prompt.trim()) state = 'NEEDS_PROMPT';
    else if (issues.length) state = 'NEEDS_ASSETS';
    return { mode: input.mode, issues: unique(issues), state };
  }

  const videos = ordered.map(id => {
    const node = nodes.get(id)!;
    const { issues, state, mode } = checkInputs(id);
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

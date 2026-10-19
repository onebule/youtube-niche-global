import type { InfiniteCanvasProject } from './infinite-canvas-graph.ts';
import { previewStudioWorkflow } from './studio-workflow-plan.ts';

/**
 * Phase 3, mock-only workflow runtime. This is a synchronous state machine:
 * NO provider, billing, storage, queue, media, network or production side effect.
 * It never modifies the graph or claims to have produced a real asset.
 */
export type MockTaskStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type MockRunStatus = 'READY' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
export type MockRunEventType =
  | 'CREATED' | 'STEP_STARTED' | 'STEP_SUCCEEDED' | 'STEP_FAILED'
  | 'RETRY_APPROVED' | 'CANCELLED' | 'COMPLETED';
export type MockRunEvent = {
  sequence: number;
  type: MockRunEventType;
  nodeId: string | null;
  message: string;
};
export type MockRunTask = {
  nodeId: string;
  title: string;
  dependsOn: string[];
  status: MockTaskStatus;
  attempts: number;
  error: string | null;
};
export type StudioMockRun = {
  schemaVersion: 1;
  mode: 'MOCK_ONLY';
  projectId: string;
  graphFingerprint: string;
  id: string;
  status: MockRunStatus;
  tasks: MockRunTask[];
  events: MockRunEvent[];
  failOnceNodeId: string | null;
  executionEnabled: false;
  providerCalls: 0;
  paidJobs: 0;
  estimatedCredits: null;
  generatedAssets: 0;
};

const MAX_MOCK_TASKS = 64;
const MAX_MOCK_EVENTS = MAX_MOCK_TASKS * 5 + 8;
const clocklessEvent = (
  events: MockRunEvent[], type: MockRunEventType, nodeId: string | null, message: string,
): MockRunEvent[] => {
  if (events.length >= MAX_MOCK_EVENTS) throw new Error('Mock 事件数量已达到保护上限。');
  return [...events, { sequence: events.length + 1, type, nodeId, message }];
};

/** Graph camera/view does not change the workflow; node and edge edits do. */
export function mockGraphFingerprint(project: InfiniteCanvasProject): string {
  return JSON.stringify({
    version: project.version,
    id: project.id,
    nodes: project.nodes,
    edges: project.edges,
  });
}

function assertMockRun(run: StudioMockRun, project: InfiniteCanvasProject) {
  if (run.mode !== 'MOCK_ONLY' || run.schemaVersion !== 1 ||
      run.executionEnabled !== false || run.providerCalls !== 0 ||
      run.paidJobs !== 0 || run.estimatedCredits !== null ||
      run.generatedAssets !== 0 || run.projectId !== project.id) {
    throw new Error('Mock Runtime 安全协议不匹配，操作已拒绝。');
  }
  if (run.graphFingerprint !== mockGraphFingerprint(project)) {
    throw new Error('画布节点或连线已改变，请重新建立 Mock 运行。');
  }
}

/**
 * Validates original graph data with the shared input collector and DAG
 * planner. Real model configuration is optional ONLY for this mock:
 * missing assets, missing prompts, invalid mode and cycles remain blockers.
 */
export function createStudioMockRun(
  project: InfiniteCanvasProject,
  opts: { id?: string; failOnceNodeId?: string | null } = {},
): StudioMockRun {
  const plan = previewStudioWorkflow(project);
  if (!plan.videos.length) throw new Error('至少添加一个视频生成节点才能进行 Mock 验证。');
  if (plan.videos.length > MAX_MOCK_TASKS) throw new Error('Mock 运行最多支持 64 个视频任务。');
  if (plan.hasCycle || plan.invalidEdges) throw new Error('存在循环依赖或悬空连线，禁止启动 Mock 运行。');
  const blocked = plan.videos.flatMap(step => step.issues
    .filter(issue => issue !== '尚未选择视频模型')
    .map(issue => step.title + '：' + issue));
  if (blocked.length) throw new Error('工作流静态检查未通过：' + blocked.slice(0, 3).join('；'));
  const failedId = opts.failOnceNodeId || null;
  if (failedId && !plan.videos.some(step => step.nodeId === failedId)) {
    throw new Error('指定的模拟故障节点不存在。');
  }
  const id = opts.id || 'mock-session';
  if (typeof id !== 'string' || id.length > 100 || !id.trim()) throw new Error('Mock 运行 ID 无效。');
  return {
    schemaVersion: 1,
    mode: 'MOCK_ONLY',
    projectId: project.id,
    graphFingerprint: mockGraphFingerprint(project),
    id,
    status: 'READY',
    tasks: plan.videos.map(step => ({
      nodeId: step.nodeId, title: step.title, dependsOn: [...step.dependsOn],
      status: 'PENDING', attempts: 0, error: null,
    })),
    events: [{ sequence: 1, type: 'CREATED', nodeId: null, message: 'Mock 运行已创建，没有执行真实模型。' }],
    failOnceNodeId: failedId,
    executionEnabled: false,
    providerCalls: 0,
    paidJobs: 0,
    estimatedCredits: null,
    generatedAssets: 0,
  };
}

/**
 * One deterministic transition per call. Starting and completing each step
 * require separate transitions so the UI can display a meaningful RUNNING state.
 * Successful mock steps never write media results to the canvas.
 */
export function stepStudioMockRun(
  run: StudioMockRun, project: InfiniteCanvasProject,
): StudioMockRun {
  assertMockRun(run, project);
  if (run.status === 'CANCELLED' || run.status === 'COMPLETED' || run.status === 'PAUSED') return run;
  const running = run.tasks.find(task => task.status === 'RUNNING');
  if (running) {
    const fail = running.nodeId === run.failOnceNodeId && running.attempts === 1;
    const tasks = run.tasks.map(task => task.nodeId === running.nodeId ? {
      ...task, status: fail ? 'FAILED' as const : 'SUCCEEDED' as const,
      error: fail ? '预设的一次性 Mock 故障（非真实服务失败）' : null,
    } : task);
    const events = clocklessEvent(run.events, fail ? 'STEP_FAILED' : 'STEP_SUCCEEDED',
      running.nodeId, fail ? '模拟故障：' + running.title : '模拟成功：' + running.title);
    const completed = !fail && tasks.every(task => task.status === 'SUCCEEDED');
    return {
      ...run, tasks, events: completed
        ? clocklessEvent(events, 'COMPLETED', null, '所有 Mock 任务模拟完成；真实生成数量为 0。')
        : events,
      status: fail ? 'PAUSED' : completed ? 'COMPLETED' : 'RUNNING',
    };
  }
  const next = run.tasks.find(task => task.status === 'PENDING' &&
    task.dependsOn.every(dep => run.tasks.some(upstream =>
      upstream.nodeId === dep && upstream.status === 'SUCCEEDED')));
  if (!next) {
    // A DAG with all checks passed cannot reach a deadlock without corruption.
    throw new Error('Mock 任务依赖状态无法继续，已停止，未发生任何外部请求。');
  }
  return {
    ...run,
    status: 'RUNNING',
    tasks: run.tasks.map(task => task.nodeId === next.nodeId
      ? { ...task, status: 'RUNNING', attempts: task.attempts + 1 } : task),
    events: clocklessEvent(run.events, 'STEP_STARTED', next.nodeId, '模拟开始：' + next.title),
  };
}

/** Executes *only* the synchronous mock reducer, bounded by task count. */
export function finishStudioMockRun(
  run: StudioMockRun, project: InfiniteCanvasProject,
): StudioMockRun {
  assertMockRun(run, project);
  let current = run;
  for (let i = 0; i < current.tasks.length * 2 + 1; i += 1) {
    if (current.status === 'PAUSED' || current.status === 'CANCELLED' ||
        current.status === 'COMPLETED') return current;
    current = stepStudioMockRun(current, project);
  }
  throw new Error('Mock 执行步数超过安全上限。');
}

export function retryStudioMockRun(
  run: StudioMockRun, project: InfiniteCanvasProject,
): StudioMockRun {
  assertMockRun(run, project);
  if (run.status !== 'PAUSED') throw new Error('只有失败暂停的 Mock 运行可以重试。');
  const failed = run.tasks.find(task => task.status === 'FAILED');
  if (!failed || failed.attempts !== 1) throw new Error('当前 Mock 运行不支持继续重试。');
  return {
    ...run,
    status: 'READY',
    tasks: run.tasks.map(task => task.nodeId === failed.nodeId
      ? { ...task, status: 'PENDING', error: null } : task),
    events: clocklessEvent(run.events, 'RETRY_APPROVED', failed.nodeId,
      '仅重新模拟失败节点，已成功的上游节点保持成功。'),
  };
}

export function cancelStudioMockRun(
  run: StudioMockRun, project: InfiniteCanvasProject,
): StudioMockRun {
  assertMockRun(run, project);
  if (run.status === 'CANCELLED') return run;
  if (run.status === 'COMPLETED') throw new Error('已完成的 Mock 运行不能取消。');
  return {
    ...run,
    status: 'CANCELLED',
    tasks: run.tasks.map(task => task.status === 'PENDING' || task.status === 'RUNNING'
      ? { ...task, status: 'CANCELLED' } : task),
    events: clocklessEvent(run.events, 'CANCELLED', null,
      '已取消未完成的 Mock 任务；无外部任务需要终止。'),
  };
}

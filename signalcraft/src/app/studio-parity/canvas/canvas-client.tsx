'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { accountStorageKey, accountStorageScope } from '@/src/lib/account-storage';
import { getSession } from '@/src/lib/auth';
import {
  createInfiniteNode, createInfiniteProject, normalizeInfiniteWorkspace,
  connectionIssue, connectInfiniteNodes,
  type InfiniteCanvasProject, type InfiniteNodeKind, type InfiniteInputPort,
} from '@/src/lib/infinite-canvas-graph';
import { previewStudioWorkflow, type WorkflowStepState } from '@/src/lib/studio-workflow-plan';
import { planStudioRequest, appendStudioRuleDraft, type StudioRuleDraft } from '@/src/lib/studio-agent-draft';
import { suggestStudioAgentEdits, prepareStudioAgentPatch, confirmStudioAgentPatch, type StudioAgentPatch } from '@/src/lib/studio-agent-tools';
import { bridgePreexistingVideoAgentPlan, type StudioPlanBridgeReview } from '@/src/lib/studio-agent-plan-bridge';
import { mockGraphFingerprint, type StudioMockRun } from '@/src/lib/studio-mock-runtime';
import {
  createStudioMockJournal, appendStudioMockCommand,
  restoreStudioMockJournal, serializeStudioMockJournal,
  type StudioMockJournal, type StudioMockJournalState,
  type StudioMockCommandType,
} from '@/src/lib/studio-mock-checkpoint';
import styles from './canvas.module.css';

const DRAFT_PREFIX = 'signalcraft-studio-parity-canvas-sandbox-v1';
const MOCK_JOURNAL_PREFIX = 'signalcraft-studio-parity-mock-journal-v1';
const NODE_KINDS: { kind: InfiniteNodeKind; name: string; description: string }[] = [
  { kind: 'text', name: '文本', description: '脚本、提示词和创作方向' },
  { kind: 'storyboard', name: '分镜', description: '单镜头脚本或构图草图' },
  { kind: 'image', name: '图片', description: '结构节点，素材上传暂未接入' },
  { kind: 'video', name: '视频任务', description: '仅编辑参数，不会运行模型' },
  { kind: 'audio', name: '音频', description: '结构节点，音频上传暂未接入' },
  { kind: 'note', name: '便签', description: '留给团队的创作备注' },
];
const PORTS: { id: InfiniteInputPort; name: string }[] = [
  { id: 'prompt', name: '提示词' },
  { id: 'start', name: '首帧' },
  { id: 'end', name: '尾帧' },
  { id: 'reference', name: '参考素材' },
];
const STEP_LABELS: Record<WorkflowStepState, string> = {
  READY_FOR_MANUAL_PREFLIGHT: '待人工预检', NEEDS_MODEL: '未选模型',
  NEEDS_PROMPT: '缺少提示词', NEEDS_ASSETS: '素材未就绪', INVALID_INPUT: '输入不兼容',
};
const PREVIEW_MODELS = [
  { id: 'minimax-h3', name: 'MiniMax H3' },
  { id: 'seedance-2', name: 'Seedance 2' },
  { id: 'seedance-2-5', name: 'Seedance 2.5' },
  { id: 'kling-3', name: 'Kling 3' },
  { id: 'veo-3.1-lite', name: 'Veo 3.1 Lite' },
] as const;
const PREVIEW_DURATIONS = ['4s','5s','8s','10s','15s'] as const;
const NODE_WIDTH = 264;
const NODE_HEIGHT = 204;
const BOARD_WIDTH = 5000;
const BOARD_HEIGHT = 3500;
type History = { past: InfiniteCanvasProject[]; future: InfiniteCanvasProject[] };
type DragState = { nodeId: string; startX: number; startY: number; originX: number; originY: number; before: InfiniteCanvasProject; moved: boolean };
type PanState = { startX: number; startY: number; x: number; y: number };
type Camera = { x: number; y: number; scale: number };
const defaultCamera: Camera = { x: 94, y: 88, scale: 1 };
const newId = () => crypto.randomUUID();
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const describe = (kind: InfiniteNodeKind) => NODE_KINDS.find(item => item.kind === kind)?.name || kind;

export default function CanvasClient() {
  const [project, setProject] = useState<InfiniteCanvasProject>(() => createInfiniteProject('sandbox'));
  const projectRef = useRef(project);
  const [camera, setCamera] = useState<Camera>(defaultCamera);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [message, setMessage] = useState('这是隔离画布：支持本地编辑，但不会发送任何模型或付费请求。');
  const [history, setHistory] = useState<History>({ past: [], future: [] });
  const historyRef = useRef(history);
  const [scope, setScope] = useState('');
  const [storageScope, setStorageScope] = useState('');
  const [showPlan, setShowPlan] = useState(false);
  const [showMock, setShowMock] = useState(false);
  const [mockRun, setMockRun] = useState<StudioMockRun | null>(null);
  const [mockJournal, setMockJournal] = useState<StudioMockJournal | null>(null);
  const mockJournalRef = useRef<StudioMockJournal | null>(null);
  const [mockFailNode, setMockFailNode] = useState('');
  const [showAgent, setShowAgent] = useState(false);
  const [idea, setIdea] = useState('');
  const [agentDraft, setAgentDraft] = useState<StudioRuleDraft | null>(null);
  const [toolProposal, setToolProposal] = useState<StudioAgentPatch | null>(null);
  const [agentJson, setAgentJson] = useState('');
  const [bridgeReview, setBridgeReview] = useState<StudioPlanBridgeReview | null>(null);
  const workflow = useMemo(() => previewStudioWorkflow(project), [project]);
  const drag = useRef<DragState | null>(null);
  const pan = useRef<PanState | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);

  const writeHistory = useCallback((next: History) => {
    historyRef.current = next;
    setHistory(next);
  }, []);
  const apply = useCallback((next: InfiniteCanvasProject, record = true) => {
    const before = projectRef.current;
    if (JSON.stringify(before) === JSON.stringify(next)) return;
    projectRef.current = next;
    setProject(next);
    if (record) writeHistory({ past: [...historyRef.current.past, before].slice(-50), future: [] });
  }, [writeHistory]);

  const undo = useCallback(() => {
    const current = historyRef.current;
    const before = current.past.at(-1);
    if (!before) return;
    const after = projectRef.current;
    projectRef.current = before;
    setProject(before);
    writeHistory({ past: current.past.slice(0, -1), future: [after, ...current.future].slice(0, 50) });
  }, [writeHistory]);

  const redo = useCallback(() => {
    const current = historyRef.current;
    const next = current.future[0];
    if (!next) return;
    const before = projectRef.current;
    projectRef.current = next;
    setProject(next);
    writeHistory({ past: [...current.past, before].slice(-50), future: current.future.slice(1) });
  }, [writeHistory]);

  useEffect(() => {
    const session = getSession();
    const key = accountStorageKey(DRAFT_PREFIX, session);
    const authenticated = accountStorageScope(session) !== 'anonymous';
    const storage = authenticated ? localStorage : sessionStorage;
    setScope(authenticated ? key : '仅当前浏览器标签（未登录）');
    setStorageScope(accountStorageScope(session));
    try {
      const raw = storage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1 && Array.isArray(parsed.projects)) {
          const restored = normalizeInfiniteWorkspace(parsed);
          const next = restored.projects.find(item => item.id === restored.activeProjectId) || restored.projects[0];
          projectRef.current = next;
          setProject(next);
          setCamera(next.view);
        }
      }
    } catch {
      setMessage('历史草稿无法读取，已保留空白画布。不会覆盖原有工作室内容。');
    }
    // One-shot handoff from the explicit "添加到实验画布" action.
    // Always append to the isolated project; never overwrite old drafts.
    try {
      const pending = sessionStorage.getItem('signalcraft-studio-parity-intent-v1');
      if (pending) {
        const intent = JSON.parse(pending) as { prompt?: unknown; mode?: unknown };
        sessionStorage.removeItem('signalcraft-studio-parity-intent-v1');
        if (typeof intent.prompt === 'string' && intent.prompt.trim()) {
          setIdea(intent.prompt.slice(0, 2000));
          setShowAgent(true);
          const text = createInfiniteNode(newId(), 'text',
            130 + (projectRef.current.nodes.length % 4) * 320,
            120 + Math.floor(projectRef.current.nodes.length / 4) * 260);
          text.title = '创作需求 · 待规划';
          text.text = intent.prompt.slice(0, 4000);
          const next = { ...projectRef.current, nodes: [...projectRef.current.nodes, text] };
          projectRef.current = next;
          setProject(next);
          setSelected(text.id);
          setMessage('已从创作入口导入需求。尚未调用 Agent；请继续建立分镜和视频节点。');
        }
      }
    } catch {
      setMessage('临时创作需求读取失败，已保留现有项目。');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const identity = getSession();
    const key = accountStorageKey(DRAFT_PREFIX, identity);
    const authenticated = accountStorageScope(identity) !== 'anonymous';
    try {
      if (scope !== (authenticated ? key : '仅当前浏览器标签（未登录）')) {
        setMessage('检测到账号变化，已停止保存。刷新后按当前账号重新打开。');
        return;
      }
      const next = { ...project, view: camera, updatedAt: new Date().toISOString() };
      const payload = { version: 1, activeProjectId: next.id, projects: [next] };
      (authenticated ? localStorage : sessionStorage).setItem(key, JSON.stringify(payload));
    } catch {
      setMessage('浏览器草稿保存失败。请使用导出 JSON 备份当前项目。');
    }
  }, [project, camera, ready, scope]);

  // Restore a replayable, account-scoped Mock command log after the graph is
  // hydrated. A corrupt, cross-account or stale record is never executed.
  useEffect(() => {
    if (!ready || !storageScope) return;
    const identity = getSession();
    if (accountStorageScope(identity) !== storageScope) {
      setMessage('账号已切换，拒绝恢复之前的 Mock 记录。');
      return;
    }
    try {
      const key = accountStorageKey(MOCK_JOURNAL_PREFIX, identity);
      const storage = storageScope === 'anonymous' ? sessionStorage : localStorage;
      const raw = storage.getItem(key);
      if (!raw) return;
      const restored = restoreStudioMockJournal(raw, projectRef.current, storageScope);
      mockJournalRef.current = restored.journal;
      setMockJournal(restored.journal);
      setMockRun(restored.run);
      setMockFailNode(restored.journal.failOnceNodeId || '');
      setShowMock(true);
      setMessage('已从隔离浏览器检查点重放 ' + restored.journal.revision +
        ' 条 Mock 命令。无模型或付费请求。');
    } catch {
      setMessage('Mock 检查点无法恢复：图版本或账号可能已变化。旧日志保留，创建新运行前请检查。');
    }
  }, [ready, storageScope]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [undo, redo]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    const handler = (event: WheelEvent) => {
      if (event.ctrlKey) return; // preserve browser accessibility zoom
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const pointX = event.clientX - rect.left;
      const pointY = event.clientY - rect.top;
      setCamera(before => {
        const scale = clamp(before.scale * (event.deltaY > 0 ? 0.9 : 1.1), .35, 2.2);
        const wx = (pointX - before.x) / before.scale;
        const wy = (pointY - before.y) / before.scale;
        return { x: pointX - wx * scale, y: pointY - wy * scale, scale };
      });
    };
    element.addEventListener('wheel', handler, { passive: false });
    return () => element.removeEventListener('wheel', handler);
  }, [ready]);

  const patchNode = (nodeId: string, changes: Record<string, unknown>) => {
    const current = projectRef.current;
    const next = { ...current, nodes: current.nodes.map(node => node.id === nodeId ? { ...node, ...changes } : node) };
    apply(next);
  };

  const addNode = (kind: InfiniteNodeKind) => {
    if (projectRef.current.nodes.length >= 400) { setMessage('单项目最多保存 400 个节点，请新建项目或导出整理。'); return; }
    const n = createInfiniteNode(newId(), kind, 110 + (projectRef.current.nodes.length % 4) * 320, 125 + Math.floor(projectRef.current.nodes.length / 4) * 260);
    const next = { ...projectRef.current, nodes: [...projectRef.current.nodes, n] };
    apply(next);
    setSelected(n.id);
    setSource(null);
    setMessage(`已添加${describe(kind)}节点。视频仅提供本地规划，不会触发模型。`);
  };
  const addExample = () => {
    const current = projectRef.current;
    if (current.nodes.length > 397) { setMessage('节点数已接近保存上限，不能再追加三节点示例。'); return; }
    if (current.nodes.length > 0 && !window.confirm('示例将在当前画布添加三个节点，不会删除已有节点。继续？')) return;
    const text = createInfiniteNode(newId(), 'text', 130, 180);
    text.title = '创作需求';
    text.text = '制作一条 30 秒 9:16 英文科幻 Shorts：主角 Nilo 在维修店修好一只旧铃铛，6 个镜头，保持角色一致。';
    const board = createInfiniteNode(newId(), 'storyboard', 130, 450);
    board.title = '分镜草案';
    board.text = 'Shot 1: Nilo finds the bell. Shot 2: He repairs it. Shot 3: The bell rings. Keep the same robot design.';
    const video = createInfiniteNode(newId(), 'video', 515, 250);
    video.video = { ...video.video!, mode: 'text', modeSelection: 'manual', prompt: 'Cinematic warm repair shop, gentle dolly-in, detailed 3D animation, vertical 9:16.' };
    let next = { ...current, nodes: [...current.nodes, text, board, video] };
    next = connectInfiniteNodes(next, newId(), text.id, video.id, 'prompt');
    apply(next);
    setSelected(video.id);
    setMessage('已创建三节点示例及提示词连线。尚未生成任何素材。');
  };

  const removeNode = (id: string) => {
    const next = { ...projectRef.current, nodes: projectRef.current.nodes.filter(node => node.id !== id), edges: projectRef.current.edges.filter(edge => edge.source !== id && edge.target !== id) };
    apply(next);
    if (selected === id) setSelected(null);
    if (source === id) setSource(null);
    setMessage('节点及相关连线已移除，可使用撤销恢复。');
  };

  const connect = (targetId: string, port: InfiniteInputPort) => {
    if (projectRef.current.edges.length >= 800) { setMessage('单项目连线已达保存上限 800 条。'); return; }
    if (!source) { setMessage('先选择一个节点的「设为连线起点」。'); return; }
    const reason = connectionIssue(projectRef.current, source, targetId, port);
    if (reason) { setMessage(`无法连接：${reason}`); return; }
    try {
      apply(connectInfiniteNodes(projectRef.current, newId(), source, targetId, port));
      setSource(null);
      setMessage('连线已建立。该连线仅表示输入依赖，不会自动执行模型。');
    } catch { setMessage('连线失败，现有项目未发生变化。'); }
  };

  const unlink = (id: string) => {
    apply({ ...projectRef.current, edges: projectRef.current.edges.filter(edge => edge.id !== id) });
    setMessage('已断开连线，可撤销恢复。');
  };

  const beginDrag = (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const node = projectRef.current.nodes.find(item => item.id === id);
    if (!node) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { nodeId: id, startX: event.clientX, startY: event.clientY, originX: node.x, originY: node.y, before: projectRef.current, moved: false };
    setSelected(id);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.startX) / camera.scale;
    const dy = (event.clientY - state.startY) / camera.scale;
    if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
    const next = {
      ...projectRef.current,
      nodes: projectRef.current.nodes.map(node => node.id === state.nodeId
        ? { ...node, x: clamp(Math.round(state.originX + dx), -2000, 4000), y: clamp(Math.round(state.originY + dy), -2000, 3000) }
        : node),
    };
    projectRef.current = next;
    setProject(next);
  };
  const endDrag = () => {
    const state = drag.current;
    if (state?.moved) writeHistory({ past: [...historyRef.current.past, state.before].slice(-50), future: [] });
    drag.current = null;
  };
  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-canvas-node],button,input,textarea,select,a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pan.current = { startX: event.clientX, startY: event.clientY, x: camera.x, y: camera.y };
    setSelected(null);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    const p = pan.current;
    setCamera(prev => ({ ...prev, x: p.x + event.clientX - p.startX, y: p.y + event.clientY - p.startY }));
  };

  const exportProject = () => {
    const current = { ...projectRef.current, view: camera, updatedAt: new Date().toISOString() };
    const payload = { version: 1, activeProjectId: current.id, projects: [current] };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'signalcraft-parity-canvas.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    setMessage('JSON 项目已导出。仅包含结构和已有资产 ID，不导出私有生成素材。');
  };
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 1024 * 1024) { setMessage('JSON 不能超过 1 MB。'); return; }
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || (data as { version?: unknown }).version !== 1 || !Array.isArray((data as { projects?: unknown }).projects)
        || !(data as { projects: unknown[] }).projects.some(p => p && typeof p === 'object'
          && typeof (p as { id?: unknown }).id === 'string' && Array.isArray((p as { nodes?: unknown }).nodes)
          && Array.isArray((p as { edges?: unknown }).edges))) {
        throw new Error('版本不兼容');
      }
      const workspace = normalizeInfiniteWorkspace(data);
      if (!workspace.projects.length) throw new Error('没有可恢复的项目');
      const imported = workspace.projects.find(p => p.id === workspace.activeProjectId) || workspace.projects[0];
      if (!window.confirm('导入会替换当前隔离画布。请先导出需要保留的项目。确认导入？')) return;
      apply(imported);
      setCamera(imported.view);
      setSelected(null);
      setSource(null);
      setMessage('项目已按 SignalCraft v1 数据契约校验并导入。没有上传文件或调用服务端。');
    } catch { setMessage('导入失败：JSON 无效或不是可识别的 SignalCraft v1 项目。'); }
  };

  const planFromIdea = () => {
    try {
      const next = planStudioRequest(idea);
      setAgentDraft(next);
      setMessage('已生成离线规则草稿：' + next.shotCount + ' 个镜头。请审核后手动加入画布。');
    } catch (error) {
      setAgentDraft(null);
      setMessage(error instanceof Error ? error.message : '规划未完成。');
    }
  };
  const confirmAgentDraft = () => {
    if (!agentDraft) return;
    if (!window.confirm('确认将 ' + agentDraft.shotCount + ' 个镜头的结构草稿添加到当前隔离画布？不会生成视频、扣积分或覆盖旧节点。')) return;
    try {
      const previous = projectRef.current;
      const next = appendStudioRuleDraft(previous, agentDraft, newId);
      apply(next);
      setSelected(next.nodes.at(-1)?.id || null);
      setSource(null);
      const first = next.nodes[previous.nodes.length];
      if (first) setCamera({ x: 120 - first.x * 0.65, y: 25, scale: 0.65 });
      setAgentDraft(null);
      setShowAgent(false);
      setShowPlan(true);
      setMessage('已新增规则草稿和节点连线。请在「检查工作流」中逐项修正，再单独审批任何实际生成。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法添加草稿。');
    }
  };

  const previewToolProposal = () => {
    try {
      const current = projectRef.current;
      const instructions = suggestStudioAgentEdits(current, selected, idea);
      const proposal = prepareStudioAgentPatch(current, instructions, newId);
      setToolProposal(proposal);
      setBridgeReview(null);
      setAgentDraft(null);
      setMessage('已预演 ' + proposal.changes.length + ' 项 Agent 工具操作。请审查差异后再应用。');
    } catch (error) {
      setToolProposal(null);
      setMessage(error instanceof Error ? error.message : 'Agent 工具预演失败。');
    }
  };
  const approveToolProposal = () => {
    if (!toolProposal) return;
    if (!window.confirm('确认应用 ' + toolProposal.changes.length + ' 项节点操作？不会提交付费生成，应用后可撤销。')) return;
    try {
      const next = confirmStudioAgentPatch(projectRef.current, toolProposal);
      apply(next);
      setToolProposal(null);
      setBridgeReview(null);
      setShowPlan(true);
      setMessage('已应用 Agent 节点操作，可以通过撤销恢复。未调用 AI Provider 或发生费用。');
    } catch (error) {
      setToolProposal(null);
      setBridgeReview(null);
      setMessage(error instanceof Error ? error.message : '画布已变化，需要重新预演。');
    }
  };

  const previewExistingAgentPlan = () => {
    try {
      const review = bridgePreexistingVideoAgentPlan(projectRef.current, selected, agentJson, newId);
      setBridgeReview(review);
      setToolProposal(review.proposal);
      setAgentDraft(null);
      setMessage('已适配已有 Agent 规划。仅提议修改选中视频节点的 Prompt 和创建说明节点，未请求模型。');
    } catch (error) {
      setBridgeReview(null);
      setToolProposal(null);
      setMessage(error instanceof Error ? error.message : '规划导入失败，未修改画布。');
    }
  };

  const mockStale = Boolean(mockRun && mockRun.graphFingerprint !== mockGraphFingerprint(project));
  const commitMockCheckpoint = (state: StudioMockJournalState) => {
    const identity = getSession();
    if (!ready || !storageScope || accountStorageScope(identity) !== storageScope) {
      throw new Error('账号状态发生变化，已拒绝写入 Mock 检查点。');
    }
    // Synchronous persistence happens before updating React state. A failed
    // browser write does not advance the visible Mock execution state.
    const payload = serializeStudioMockJournal(state.journal, projectRef.current, storageScope);
    const storage = storageScope === 'anonymous' ? sessionStorage : localStorage;
    storage.setItem(accountStorageKey(MOCK_JOURNAL_PREFIX, identity), payload);
    mockJournalRef.current = state.journal;
    setMockJournal(state.journal);
    setMockRun(state.run);
  };
  const createMockSession = () => {
    try {
      const next = createStudioMockJournal(projectRef.current, storageScope, {
        runId: newId(), failOnceNodeId: mockFailNode || null,
      });
      commitMockCheckpoint(next);
      setMessage('已建立可恢复的 Mock 运行：' + next.run.tasks.length +
        ' 个视频任务。浏览器日志修订号 0；真实模型调用 0。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mock 预检或浏览器保存失败，未启动。');
    }
  };
  const transitionMock = (action: 'step' | 'finish' | 'retry' | 'cancel') => {
    const current = mockJournalRef.current;
    if (!current) return;
    try {
      const commandType: Record<typeof action, StudioMockCommandType> = {
        step: 'STEP', finish: 'FINISH', retry: 'RETRY', cancel: 'CANCEL',
      };
      const next = appendStudioMockCommand(current, projectRef.current, storageScope, {
        action: commandType[action], requestId: newId(),
        expectedRevision: current.revision,
      });
      commitMockCheckpoint(next);
      setMessage('Mock Runtime：' + next.run.status + '。已持久保存第 ' +
        next.journal.revision + ' 条命令，真实生成 0 次。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mock 状态更新失败，旧检查点未变化。');
    }
  };
  const clearMockCheckpoint = () => {
    try {
      const identity = getSession();
      if (!ready || accountStorageScope(identity) !== storageScope) {
        throw new Error('账号发生变化，不能清空其他账号的 Mock 数据。');
      }
      const storage = storageScope === 'anonymous' ? sessionStorage : localStorage;
      storage.removeItem(accountStorageKey(MOCK_JOURNAL_PREFIX, identity));
      mockJournalRef.current = null;
      setMockJournal(null);
      setMockRun(null);
      setMessage('已清除当前账号的本地 Mock 检查点；原画布节点未变化。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mock 清空失败。');
    }
  };
  const exportMockSession = () => {
    if (!mockRun || !mockJournal) return;
    const payload = {
      schemaVersion: 1, mode: 'MOCK_ONLY', projectId: mockRun.projectId,
      runId: mockRun.id, status: mockRun.status, events: mockRun.events,
      tasks: mockRun.tasks, journal: mockJournal,
      providerCalls: 0, paidJobs: 0, generatedAssets: 0,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'signalcraft-mock-run-audit.json';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
    setMessage('已导出本地 Mock 审计及命令日志，未包含模型密钥或真实资产。');
  };

  const activeNode = project.nodes.find(item => item.id === selected) || null;
  const resetView = () => setCamera(defaultCamera);
  const fitView = () => {
    const items = projectRef.current.nodes;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width < 120 || rect.height < 120 || items.length === 0) {
      resetView();
      return;
    }
    const left = Math.min(...items.map(node => node.x));
    const top = Math.min(...items.map(node => node.y));
    const right = Math.max(...items.map(node => node.x + NODE_WIDTH));
    const bottom = Math.max(...items.map(node => node.y + NODE_HEIGHT));
    const margin = 48;
    const visibleW = Math.max(rect.width - 2 * margin, 100);
    const visibleH = Math.max(rect.height - 2 * margin, 100);
    // Graph v1 normalizer persists zoom in [0.2, 2.5]. Respect this range.
    const scale = clamp(Math.min(visibleW / Math.max(1, right - left), visibleH / Math.max(1, bottom - top)), 0.2, 2.2);
    const centerX = (left + right) / 2;
    const centerY = (top + bottom) / 2;
    setCamera({
      scale,
      x: rect.width / 2 - centerX * scale,
      y: rect.height / 2 - centerY * scale,
    });
    setMessage('已将画布视角调整到节点范围；多镜头流程可继续通过滚轮缩放。');
  };

  return <main className={styles.shell}>
    <header className={styles.bar}>
      <div className={styles.brand}><Link href="/studio-parity">← 工作室入口</Link><strong>SignalCraft <span>／ 无限画布实验台</span></strong></div>
      <div className={styles.barActions}>
        <span className={styles.safePill}>LOCAL · NO GENERATION</span>
        <button type="button" onClick={() => setShowAgent(value => !value)} aria-expanded={showAgent} aria-controls="studio-agent-draft">{showAgent ? '收起规则草稿' : '生成节点草稿'}</button>
        <button type="button" disabled={!history.past.length} onClick={undo}>↶ 撤销</button>
        <button type="button" disabled={!history.future.length} onClick={redo}>↷ 重做</button>
        <button type="button" onClick={() => setShowPlan(value => !value)} aria-expanded={showPlan} aria-controls="studio-workflow-preview">{showPlan ? '收起检查' : '检查工作流'}</button>
        <button type="button" onClick={() => setShowMock(value => !value)} aria-expanded={showMock} aria-controls="studio-mock-runtime">{showMock ? '收起 Mock' : 'Mock Runtime'}</button>
        <button type="button" onClick={exportProject}>导出 JSON</button>
        <label className={styles.importButton}>导入 JSON <input type="file" accept=".json,application/json" onChange={event => { void importProject(event); }} /></label>
      </div>
    </header>
    <div className={styles.layout}>
      <aside className={styles.tools} aria-label="节点工具箱">
        <h2>创作工具</h2>
        <p>点击添加到画布。当前不连接付费模型。</p>
        {NODE_KINDS.map(item => <button key={item.kind} type="button" className={styles.tool}
          onClick={() => addNode(item.kind)}><b>＋ {item.name}</b><small>{item.description}</small></button>)}
        <button className={styles.exampleButton} type="button" onClick={addExample}>✦ 创建 Nilo 示例流程</button>
        <div className={styles.toolDivider} />
        <h3>项目状态</h3>
        <p>{project.nodes.length} 个节点 · {project.edges.length} 条连线</p>
        <p className={styles.storageInfo}>浏览器独立草稿；{scope ? (scope.startsWith('signalcraft-') ? '当前账号隔离' : scope) : '读取中'}</p>
        <Link href="/app/canvas" className={styles.legacyLink}>打开现有生产工作室 ↗</Link>
      </aside>
      <section className={styles.center} aria-label="节点创作画布">
        <div className={styles.canvasTop}>
          <div><b>项目：{project.title}</b><span>可拖动节点标题 · 背景拖动平移 · 滚轮缩放</span></div>
          <div className={styles.zoom}>
            <button type="button" onClick={() => setCamera(v => ({ ...v, scale: clamp(v.scale - .1, .35, 2.2) }))}>−</button>
            <output>{Math.round(camera.scale * 100)}%</output>
            <button type="button" onClick={() => setCamera(v => ({ ...v, scale: clamp(v.scale + .1, .35, 2.2) }))}>＋</button>
            <button type="button" onClick={resetView}>复位</button>
            <button type="button" onClick={fitView} title="按节点范围缩放和平移画布">适配全部节点</button>
          </div>
        </div>
        {showAgent && <section id="studio-agent-draft" className={styles.agentPanel} aria-label="离线创作需求规划">
          <div className={styles.agentTitle}><strong>从创作需求搭建节点图</strong><span>LOCAL_RULES_ONLY · 非大模型 Agent</span></div>
          <p>创建一组分镜节点，或对当前选中节点预演安全工具操作。此阶段仅支持离线规则建议，不会产出视频或发生费用。</p>
          <label className={styles.agentPromptLabel} htmlFor="studio-agent-idea">创作需求（最多 2000 字）</label>
          <textarea id="studio-agent-idea" className={styles.agentInput} rows={3} maxLength={2000} value={idea}
            placeholder="例：制作一条30秒英文 Shorts，分成6个镜头，9:16，角色 Nilo 保持一致。"
            onChange={event => { setIdea(event.target.value); setAgentDraft(null); setToolProposal(null); }} />
          <div className={styles.agentActions}>
            <button type="button" onClick={planFromIdea} disabled={!idea.trim()}>预览多镜头规划</button>
            <button type="button" onClick={previewToolProposal} disabled={!idea.trim()}>预演所选节点的 Agent 操作</button>
            {toolProposal && <button type="button" className={styles.agentApprove} onClick={approveToolProposal}>审核通过并应用操作</button>}
            {agentDraft && <button type="button" className={styles.agentApprove} onClick={confirmAgentDraft}>确认添加到画布（不执行生成）</button>}
          </div>
          <details className={styles.agentReview}>
            <summary>导入已有 Agent 规划 JSON（不调用 API）</summary>
            <p>请先选中画布中的视频节点，再粘贴现有 SignalCraft 的 VideoGenerationPlan JSON。不会导入旧镜头动作、修改模型或触发生成。</p>
            <label className={styles.agentPromptLabel} htmlFor="studio-existing-plan-json">已有 Agent 规划 JSON</label>
            <textarea id="studio-existing-plan-json" className={styles.agentInput} rows={4} maxLength={40000}
              placeholder='{"plan":{"kind":"video-generation-plan","autoGenerate":false,"model":"minimax-h3","prompt":"..."}}'
              value={agentJson} onChange={event => { setAgentJson(event.target.value); setBridgeReview(null); setToolProposal(null); }} />
            <div className={styles.agentActions}>
              <button type="button" disabled={!agentJson.trim() || !selected} onClick={previewExistingAgentPlan}>验证并预演已有 Agent 规划</button>
            </div>
            {bridgeReview && <div className={styles.agentReview} aria-live="polite">
              <strong>模型建议：{bridgeReview.modelSuggestion} · {bridgeReview.fallback ? '规则回退' : bridgeReview.director + ' 规划'}</strong>
              <p>未自动更换模型 · 忽略旧镜头动作 {bridgeReview.ignoredLegacyActions} 项</p>
              {bridgeReview.warnings.map((warning, index) => <p key={index}>· {warning}</p>)}
            </div>}
          </details>
          {toolProposal && <div className={styles.agentReview} aria-live="polite">
            <strong>Agent 画布操作差异（尚未应用）</strong>
            <ol>{toolProposal.changes.map((change, index) => <li key={index}>{change}</li>)}</ol>
            <p>已限制为节点创建、修改、移动及提示词连线；禁止删除结果、改动资产或调用模型。</p>
            <p>画布在审核期间变化时，本提案自动失效并需要重新预演。</p>
          </div>}
          {agentDraft && <div className={styles.agentReview} aria-live="polite">
            <strong>{agentDraft.shotCount} 个镜头 · {agentDraft.durationSeconds ? agentDraft.durationSeconds + ' 秒' : '时长未设'} · {agentDraft.aspectRatio}</strong>
            <ol>{agentDraft.shots.map(shot => <li key={shot.index}>{shot.title}：{shot.storyboard.split('\n')[0]}</li>)}</ol>
            {agentDraft.caveats.map((warning, index) => <p key={index}>· {warning}</p>)}
          </div>}
        </section>}
        {showPlan && <section id="studio-workflow-preview" className={styles.planPanel} aria-label="工作流模拟执行计划">
          <div className={styles.planTop}><strong>工作流 Dry Run · 仅依赖检查</strong><span>{workflow.videos.length} 个视频节点 · {workflow.issues.length} 条待处理项</span></div>
          <p>不执行生成、不访问模型、没有预算报价。所有节点仍需通过人工预检、服务端权限和费用确认。</p>
          {workflow.videos.length > 0 && <ol className={styles.planList}>{workflow.videos.map((step, index) =>
            <li key={step.nodeId} className={styles.planStep}><b>{index + 1}. {step.title}</b>
              <span>{STEP_LABELS[step.state]} · {step.mode} · {step.model || '未选模型'}</span>
              {step.dependsOn.length > 0 && <small>依赖：{step.dependsOn.map(id => workflow.videos.find(item => item.nodeId === id)?.title || id).join('、')}</small>}
              {step.issues.length > 0 && <small>{step.issues.join('；')}</small>}
            </li>)}</ol>}
          {workflow.issues.length > 0 && <div className={styles.planIssues} role="status">{workflow.issues.map((issue, i) => <p key={i}>· {issue}</p>)}</div>}
          {workflow.videos.length > 0 && workflow.issues.length === 0 && <p>所有节点的静态检查已通过；不代表模型可用或实际生成成功。</p>}
        </section>}
        {showMock && <section id="studio-mock-runtime" className={styles.mockPanel} aria-label="Mock 工作流执行器">
          <div className={styles.mockTop}>
            <strong>Workflow Runtime V2 · 可恢复 Mock</strong>
            <span>0 付费调用 · 0 生成素材 · 无服务器任务</span>
          </div>
          <p>手动模拟依赖排序、失败重试和取消；每次操作会先写入当前账号的浏览器命令日志，刷新后可安全重放。无云端任务持久化或真实状态轮询。</p>
          <div className={styles.mockActions}>
            <label>模拟一次性故障
              <select aria-label="Mock 故障注入节点" value={mockFailNode}
                onChange={event => setMockFailNode(event.target.value)}>
                <option value="">不注入故障</option>
                {workflow.videos.map(step => <option key={step.nodeId} value={step.nodeId}>{step.title}</option>)}
              </select>
            </label>
            <button type="button" onClick={createMockSession}>创建 Mock 运行</button>
            <button type="button" disabled={!mockRun || mockStale || mockRun.status === 'PAUSED' || mockRun.status === 'CANCELLED' || mockRun.status === 'COMPLETED'}
              onClick={() => transitionMock('step')}>单步推进</button>
            <button type="button" disabled={!mockRun || mockStale || mockRun.status === 'PAUSED' || mockRun.status === 'CANCELLED' || mockRun.status === 'COMPLETED'}
              onClick={() => transitionMock('finish')}>模拟运行全部</button>
            <button type="button" disabled={!mockRun || mockStale || mockRun.status !== 'PAUSED'}
              onClick={() => transitionMock('retry')}>重试失败节点</button>
            <button type="button" disabled={!mockRun || mockStale || mockRun.status === 'CANCELLED' || mockRun.status === 'COMPLETED'}
              onClick={() => transitionMock('cancel')}>取消 Mock</button>
            <button type="button" disabled={!mockRun} onClick={exportMockSession}>导出审计 JSON</button>
            <button type="button" disabled={!mockRun} onClick={clearMockCheckpoint}>清空记录</button>
          </div>
          {mockStale && <p className={styles.mockWarning} role="alert">画布节点或连线已变化，旧运行不能继续。可导出旧日志，然后创建新的 Mock 运行。</p>}
          {mockRun && <div className={styles.mockStatus} aria-live="polite">
            <strong>当前运行：{mockRun.status} · {mockRun.tasks.filter(task => task.status === 'SUCCEEDED').length}/{mockRun.tasks.length} 已模拟完成</strong>
            <p className={styles.mockCheckpointLabel}>Mock Journal · 第 {mockJournal?.revision ?? 0} 版 · 当前账号浏览器隔离保存 · 请求 ID 幂等保护</p>
            <ol className={styles.mockTasks}>{mockRun.tasks.map(task =>
              <li key={task.nodeId}><b>{task.title}</b><span>{task.status} · 尝试 {task.attempts} 次</span>
                {task.error && <small>{task.error}</small>}</li>)}</ol>
            <details><summary>查看事件日志（{mockRun.events.length}）</summary>
              <ol className={styles.mockEvents}>{mockRun.events.map(event =>
                <li key={event.sequence}>{event.sequence}. {event.type} · {event.message}</li>)}</ol>
            </details>
          </div>}
        </section>}
        <div className={styles.viewport} ref={canvasRef}
          onPointerDown={startPan}
          onPointerMove={movePan}
          onPointerUp={() => { pan.current = null; }}
          onPointerCancel={() => { pan.current = null; }}>
          <div className={styles.world} style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
            <svg className={styles.edges} width={BOARD_WIDTH} height={BOARD_HEIGHT} aria-hidden="true">
              {project.edges.map(edge => {
                const from = project.nodes.find(node => node.id === edge.source);
                const to = project.nodes.find(node => node.id === edge.target);
                if (!from || !to) return null;
                const x1 = from.x + NODE_WIDTH, y1 = from.y + NODE_HEIGHT / 2;
                const x2 = to.x, y2 = to.y + NODE_HEIGHT / 2;
                const curve = Math.max(80, Math.abs(x2 - x1) * .45);
                return <path key={edge.id} d={`M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`}
                  fill="none" stroke="#988ce7" strokeWidth="3" strokeLinecap="round" />;
              })}
            </svg>
            {project.nodes.map(node => <article key={node.id} className={selected === node.id ? styles.nodeSelected : styles.node}
              data-canvas-node data-kind={node.kind} style={{ left: node.x, top: node.y }}>
              <div className={styles.nodeHead} onPointerDown={e => beginDrag(node.id, e)}
                onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}
                role="button" tabIndex={0} aria-label={`选择并拖动 ${node.title}`}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(node.id); } }}>
                <span className={styles.nodeBadge}>{describe(node.kind)}</span><strong>{node.title}</strong><span className={styles.handle}>⠿</span>
              </div>
              <div className={styles.nodeBody}>
                <p>{node.kind === 'video' ? (node.video?.prompt || '未填写运动指令') : (node.text || '暂无内容，选中后在右侧编辑。')}</p>
                <div className={styles.nodeTags}>
                  <span>{node.kind === 'video' ? '模型未执行' : '本地节点'}</span>
                  {node.kind === 'image' || node.kind === 'audio' ? <span>未接入素材</span> : null}
                </div>
              </div>
              <div className={styles.nodeFooter}>
                <button type="button" onClick={() => { setSource(node.id); setSelected(node.id); setMessage('已选择连线起点。请点击目标视频节点右侧的输入端口。'); }}
                  aria-pressed={source === node.id}>{source === node.id ? '✓ 已选输出' : '◎ 设为连线起点'}</button>
                <button type="button" onClick={() => setSelected(node.id)}>参数 ›</button>
              </div>
            </article>)}
          </div>
          {project.nodes.length === 0 && <div className={styles.empty}><div>✦</div><h2>从一个节点开始创作</h2><p>在左侧添加文本、分镜或视频节点，也可以载入 Nilo 示例。</p><button onClick={addExample} type="button">创建示例流程</button></div>}
        </div>
        <footer className={styles.canvasFooter} role="status">
          <span>{message}</span><span>{ready ? '已启用本地草稿保存' : '正在读取草稿'}</span>
        </footer>
      </section>
      <aside className={styles.inspector} aria-label="节点属性面板">
        <h2>节点检查器</h2>
        {!activeNode ? <div className={styles.placeholder}><span>◎</span><strong>选择画布节点</strong><p>点击任意节点的「参数」，即可修改名称、内容和连线。</p></div> : <>
          <p className={styles.subheading}>{describe(activeNode.kind)} · {activeNode.id.slice(0, 8)}</p>
          <label>节点名称<input key={activeNode.id + '-title-' + activeNode.title} defaultValue={activeNode.title}
            maxLength={70} onBlur={e => { if (e.target.value.trim() && e.target.value !== activeNode.title) patchNode(activeNode.id, { title: e.target.value.trim() }); }}/></label>
          <label>{activeNode.kind === 'video' ? '运动提示词' : '节点内容'}
            <textarea key={activeNode.id + '-body-' + (activeNode.kind === 'video' ? activeNode.video?.prompt || '' : activeNode.text)} rows={6} defaultValue={activeNode.kind === 'video' ? activeNode.video?.prompt || '' : activeNode.text}
              maxLength={12000} onBlur={e => {
                if (activeNode.kind === 'video' && activeNode.video && e.target.value !== activeNode.video.prompt)
                  patchNode(activeNode.id, { video: { ...activeNode.video, prompt: e.target.value.slice(0, 1200) } });
                if (activeNode.kind !== 'video' && e.target.value !== activeNode.text) patchNode(activeNode.id, { text: e.target.value });
              }} /></label>
          {activeNode.kind === 'video' && activeNode.video && <>
            <label>视频模型（仅选择，不会调用）
              <select value={activeNode.video.model || ''} onChange={e => {
                const candidate = PREVIEW_MODELS.find(item => item.id === e.target.value);
                patchNode(activeNode.id, { video: { ...activeNode.video!, model: candidate?.id || null } });
              }}>
                <option value="">未选择模型</option>
                {PREVIEW_MODELS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>生成时长
              <select value={activeNode.video.duration} onChange={e => patchNode(activeNode.id, { video: { ...activeNode.video!, duration: e.target.value } })}>
                {[...new Set([activeNode.video.duration, ...PREVIEW_DURATIONS])].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>画面比例
              <select value={activeNode.video.aspectRatio} onChange={e => patchNode(activeNode.id, { video: { ...activeNode.video!, aspectRatio: e.target.value as '9:16' | '16:9' | '1:1' } })}>
                <option value="9:16">9:16 竖屏</option>
                <option value="16:9">16:9 横屏</option>
                <option value="1:1">1:1 正方形</option>
              </select>
            </label>
            <label>参考模式<select value={activeNode.video.mode} onChange={e => patchNode(activeNode.id, { video: { ...activeNode.video!, mode: e.target.value as 'text' | 'start-end' | 'omni', modeSelection: 'manual' } })}>
              <option value="text">文生视频</option><option value="start-end">首尾帧</option><option value="omni">全能参考</option>
            </select></label>
            <p className={styles.note}>本实验台只编辑工作流数据。真实视频生成请进入原工作室并单独审批。</p>
            <div className={styles.portBox}><strong>连线输入端口</strong>
              {PORTS.map(port => <button key={port.id} type="button" disabled={!source}
                onClick={() => connect(activeNode.id, port.id)}>{port.name} <span>{source ? '连接 →' : '先选输出'}</span></button>)}
            </div>
          </>}
          <div className={styles.portBox}><strong>连接记录</strong>
            {project.edges.filter(edge => edge.source === activeNode.id || edge.target === activeNode.id).length === 0
              ? <p className={styles.note}>此节点尚无连线。</p>
              : project.edges.filter(edge => edge.source === activeNode.id || edge.target === activeNode.id).map(edge =>
                <div key={edge.id} className={styles.edgeRow}><span>{edge.source.slice(0, 6)} → {edge.target.slice(0, 6)} · {edge.port}</span>
                  <button type="button" onClick={() => unlink(edge.id)} aria-label="断开此连线">断开</button></div>)}
          </div>
          <button className={styles.danger} type="button" onClick={() => removeNode(activeNode.id)}>删除节点（可撤销）</button>
        </>}
        <div className={styles.disclaimer}><b>执行安全</b><p>不发送模型请求、不扣积分、不操作生产数据。这只是第一个可运行的节点编辑切片。</p></div>
      </aside>
    </div>
  </main>;
}

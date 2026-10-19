import {
  connectInfiniteNodes,
  createInfiniteNode,
  type InfiniteCanvasProject,
  type InfiniteCanvasNode,
} from './infinite-canvas-graph.ts';

/**
 * A strict, non-executing command boundary for future LLM tool use.
 * Never accepts provider settings, private asset handles, run histories,
 * credit operations, deletion or network instructions.
 */
type NewKind = 'text' | 'storyboard' | 'video' | 'note';
export type StudioAgentOperation =
  | { type: 'node.create'; ref: string; kind: NewKind; title: string; text?: string; x: number; y: number }
  | { type: 'node.set_text'; ref: string; text: string }
  | { type: 'node.set_title'; ref: string; title: string }
  | { type: 'node.set_video_prompt'; ref: string; prompt: string }
  | { type: 'node.move'; ref: string; x: number; y: number }
  | { type: 'edge.connect'; source: string; target: string; port: 'prompt' };

export type StudioAgentPatch = {
  version: 1;
  baseFingerprint: string;
  next: InfiniteCanvasProject;
  changes: string[];
  executionEnabled: false;
  providerCalls: 0;
};

const KINDS: NewKind[] = ['text', 'storyboard', 'video', 'note'];
const TMP_REF = /^tmp:[a-zA-Z0-9_-]{1,35}$/;
const MAX_COMMANDS = 24;
const MAX_NODES = 400;
const MAX_EDGES = 800;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const own = (obj: Record<string, unknown>, field: string) =>
  Object.prototype.hasOwnProperty.call(obj, field);

const exactKeys = (obj: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(obj).some(key => !allowed.includes(key))) {
    throw new Error('Agent 工具包含未经授权的字段，已拒绝整批操作。');
  }
};
const stringField = (obj: Record<string, unknown>, key: string, limit: number, optional = false) => {
  const value = obj[key];
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new Error('Agent 工具字段 ' + key + ' 缺失或超出限制。');
  }
  return value.trim();
};
const coord = (obj: Record<string, unknown>, key: string) => {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 10000) {
    throw new Error('Agent 节点坐标无效。');
  }
  return Math.round(value);
};

/** Treat all future model responses as untrusted, even if TS typed upstream. */
export function validateStudioAgentOperations(input: unknown): StudioAgentOperation[] {
  if (!Array.isArray(input) || !input.length || input.length > MAX_COMMANDS) {
    throw new Error('Agent 操作数量必须在 1–24 之间。');
  }
  return input.map(raw => {
    if (!isRecord(raw)) throw new Error('Agent 操作必须是对象。');
    const type = stringField(raw, 'type', 32);
    if (type === 'node.create') {
      exactKeys(raw, ['type', 'ref', 'kind', 'title', 'text', 'x', 'y']);
      const ref = stringField(raw, 'ref', 40)!;
      const kind = stringField(raw, 'kind', 12)!;
      if (!TMP_REF.test(ref) || !KINDS.includes(kind as NewKind)) {
        throw new Error('新增节点必须使用 tmp: 句柄和受支持类型。');
      }
      const text = stringField(raw, 'text', 1200, true);
      if (kind === 'video' && text !== undefined) throw new Error('视频节点不能通过 text 字段设置生成参数。');
      return {
        type, ref, kind: kind as NewKind, title: stringField(raw, 'title', 70)!,
        ...(text === undefined ? {} : { text }), x: coord(raw, 'x'), y: coord(raw, 'y'),
      };
    }
    if (type === 'node.set_text') {
      exactKeys(raw, ['type', 'ref', 'text']);
      return { type, ref: stringField(raw, 'ref', 140)!, text: stringField(raw, 'text', 1200)! };
    }
    if (type === 'node.set_title') {
      exactKeys(raw, ['type', 'ref', 'title']);
      return { type, ref: stringField(raw, 'ref', 140)!, title: stringField(raw, 'title', 70)! };
    }
    if (type === 'node.set_video_prompt') {
      exactKeys(raw, ['type', 'ref', 'prompt']);
      return { type, ref: stringField(raw, 'ref', 140)!, prompt: stringField(raw, 'prompt', 1200)! };
    }
    if (type === 'node.move') {
      exactKeys(raw, ['type', 'ref', 'x', 'y']);
      return { type, ref: stringField(raw, 'ref', 140)!, x: coord(raw, 'x'), y: coord(raw, 'y') };
    }
    if (type === 'edge.connect') {
      exactKeys(raw, ['type', 'source', 'target', 'port']);
      if (raw.port !== 'prompt') throw new Error('Agent 当前只能操作提示词端口。');
      return {
        type, source: stringField(raw, 'source', 140)!, target: stringField(raw, 'target', 140)!, port: 'prompt',
      };
    }
    throw new Error('Agent 工具类型未授权。');
  });
}

/** Lightweight conflict token, not a cryptographic attestation. */
export const studioGraphFingerprint = (project: InfiniteCanvasProject) => JSON.stringify(project);

export function prepareStudioAgentPatch(
  project: InfiniteCanvasProject,
  untrustedInput: unknown,
  idFactory: () => string,
): StudioAgentPatch {
  const operations = validateStudioAgentOperations(untrustedInput);
  const baseFingerprint = studioGraphFingerprint(project);
  const aliases = new Map<string, string>();
  const occupied = new Set(project.nodes.map(node => node.id));
  const edgeIds = new Set(project.edges.map(edge => edge.id));
  const changes: string[] = [];
  let next: InfiniteCanvasProject = { ...project, nodes: [...project.nodes], edges: [...project.edges] };
  const freshId = () => {
    const id = idFactory();
    if (typeof id !== 'string' || !id || id.length > 100 || occupied.has(id) || edgeIds.has(id)) {
      throw new Error('Agent 新节点或连线 ID 冲突，未应用任何修改。');
    }
    occupied.add(id);
    return id;
  };
  const resolve = (ref: string) => {
    if (ref.startsWith('tmp:')) {
      const id = aliases.get(ref);
      if (!id) throw new Error('Agent 引用了不存在的临时节点。');
      return id;
    }
    if (!occupied.has(ref)) throw new Error('Agent 引用了不存在的画布节点。');
    return ref;
  };
  const patchNode = (nodeId: string, update: (node: InfiniteCanvasNode) => InfiniteCanvasNode) => {
    next = { ...next, nodes: next.nodes.map(node => node.id === nodeId ? update(node) : node) };
  };
  for (const op of operations) {
    if (op.type === 'node.create') {
      if (aliases.has(op.ref) || occupied.has(op.ref)) throw new Error('Agent 节点临时句柄重复。');
      if (next.nodes.length >= MAX_NODES) throw new Error('节点数量达到上限。');
      const id = freshId();
      aliases.set(op.ref, id);
      const created = createInfiniteNode(id, op.kind, op.x, op.y);
      const node = { ...created, title: op.title, text: op.text || '' };
      next = { ...next, nodes: [...next.nodes, node] };
      changes.push('新增 ' + op.kind + ' 节点：' + op.title);
      continue;
    }
    if (op.type === 'edge.connect') {
      if (next.edges.length >= MAX_EDGES) throw new Error('连线数量达到上限。');
      const source = resolve(op.source), target = resolve(op.target);
      const id = freshId();
      next = connectInfiniteNodes(next, id, source, target, op.port);
      edgeIds.add(id);
      changes.push('连接提示词：' + source.slice(0, 12) + ' → ' + target.slice(0, 12));
      continue;
    }
    const id = resolve(op.ref);
    const node = next.nodes.find(item => item.id === id);
    if (!node) throw new Error('Agent 节点不存在。');
    if (op.type === 'node.set_text') {
      if (!['text', 'storyboard', 'note'].includes(node.kind)) throw new Error('目标节点不允许修改文本。');
      patchNode(id, current => ({ ...current, text: op.text }));
      changes.push('更新节点文本：' + node.title);
    } else if (op.type === 'node.set_title') {
      if (node.kind === 'video-result') throw new Error('不可通过 Agent 修改结果节点。');
      patchNode(id, current => ({ ...current, title: op.title }));
      changes.push('修改节点名称：' + node.title + ' → ' + op.title);
    } else if (op.type === 'node.set_video_prompt') {
      if (node.kind !== 'video' || !node.video) throw new Error('仅视频生成节点可设置运动提示词。');
      patchNode(id, current => ({ ...current, video: { ...current.video!, prompt: op.prompt } }));
      changes.push('更新视频提示词：' + node.title);
    } else if (op.type === 'node.move') {
      if (node.kind === 'video-result') throw new Error('Agent 不可移动历史结果节点。');
      patchNode(id, current => ({ ...current, x: op.x, y: op.y }));
      changes.push('移动节点：' + node.title);
    }
  }
  return {
    version: 1,
    baseFingerprint,
    next,
    changes,
    executionEnabled: false,
    providerCalls: 0,
  };
}

export function confirmStudioAgentPatch(
  current: InfiniteCanvasProject, proposal: StudioAgentPatch,
): InfiniteCanvasProject {
  if (proposal.version !== 1 || proposal.executionEnabled !== false || proposal.providerCalls !== 0) {
    throw new Error('Agent 执行权限不合法。');
  }
  if (proposal.baseFingerprint !== studioGraphFingerprint(current) || proposal.next.id !== current.id) {
    throw new Error('画布在审核期间已变化，请重新预览 Agent 操作。');
  }
  return proposal.next;
}

/** Offline demonstration action, not an LLM response. */
export function suggestStudioAgentEdits(
  project: InfiniteCanvasProject,
  selectedNodeId: string | null,
  instruction: string,
): StudioAgentOperation[] {
  const text = instruction.trim();
  if (!text || text.length > 1200) throw new Error('请输入不超过 1200 字的操作建议。');
  const node = project.nodes.find(item => item.id === selectedNodeId);
  if (node?.kind === 'video') {
    const ref = 'tmp:agent-storyboard';
    return [
      { type: 'node.create', ref, kind: 'storyboard', title: 'Agent 补充分镜', text,
        x: Math.max(-10000, node.x - 335), y: node.y },
      { type: 'edge.connect', source: ref, target: node.id, port: 'prompt' },
    ];
  }
  if (node && ['text', 'storyboard', 'note'].includes(node.kind)) {
    return [{ type: 'node.set_text', ref: node.id, text }];
  }
  return [{ type: 'node.create', ref: 'tmp:agent-brief', kind: 'text',
    title: 'Agent 编辑建议', text, x: 160, y: 160 }];
}

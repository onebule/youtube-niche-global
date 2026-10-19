import type { InfiniteCanvasProject } from './infinite-canvas-graph.ts';
import {
  cancelStudioMockRun, createStudioMockRun, finishStudioMockRun,
  mockGraphFingerprint, retryStudioMockRun, stepStudioMockRun,
  type StudioMockRun,
} from './studio-mock-runtime.ts';

/**
 * Browser-local mock checkpoint/journal V1.
 * Every state is reconstructed by replaying validated commands through the
 * existing MOCK_ONLY reducer. No trusted state, provider receipt, asset or
 * credit value is ever loaded directly from browser storage.
 *
 * This is NOT a production queue, durable cloud store or cryptographic gate.
 */
export type StudioMockCommandType = 'STEP' | 'FINISH' | 'RETRY' | 'CANCEL';
export type StudioMockCommand = {
  requestId: string;
  action: StudioMockCommandType;
  expectedRevision: number;
};
export type StudioMockJournal = {
  schemaVersion: 1;
  mode: 'MOCK_ONLY';
  scope: string;
  projectId: string;
  graphToken: string;
  runId: string;
  failOnceNodeId: string | null;
  revision: number;
  commands: StudioMockCommand[];
};
export type StudioMockJournalState = { journal: StudioMockJournal; run: StudioMockRun };

const MAX_COMMANDS = 200;
const MAX_SERIALIZED_SIZE = 96 * 1024;
const MAX_ID_LENGTH = 100;
const ALLOWED_ACTIONS: StudioMockCommandType[] = ['STEP', 'FINISH', 'RETRY', 'CANCEL'];
const SCOPE_PATTERN = /^(anonymous|account-[a-z0-9]{1,12})$/;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const exactKeys = (value: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));

/** Compact, non-cryptographic change token. Not a security authorization. */
export function mockGraphToken(project: InfiniteCanvasProject): string {
  const text = mockGraphFingerprint(project);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 'fnv1a32-' + (hash >>> 0).toString(16).padStart(8, '0') + '-' + text.length;
}

function assertScope(scope: string) {
  if (!SCOPE_PATTERN.test(scope)) throw new Error('Mock 检查点账号范围无效。');
}
function assertId(id: unknown, field: string) {
  if (typeof id !== 'string' || !id.trim() || id.length > MAX_ID_LENGTH) {
    throw new Error('Mock 检查点 ' + field + ' 不合法。');
  }
}
function apply(run: StudioMockRun, project: InfiniteCanvasProject, action: StudioMockCommandType) {
  if (action === 'STEP') return stepStudioMockRun(run, project);
  if (action === 'FINISH') return finishStudioMockRun(run, project);
  if (action === 'RETRY') return retryStudioMockRun(run, project);
  return cancelStudioMockRun(run, project);
}
function parseJournal(raw: unknown): StudioMockJournal {
  const parsed: unknown = typeof raw === 'string' ? (() => {
    if (raw.length > MAX_SERIALIZED_SIZE) throw new Error('Mock 检查点超过容量上限。');
    try { return JSON.parse(raw) as unknown; }
    catch { throw new Error('Mock 检查点不是有效 JSON。'); }
  })() : raw;
  if (!isRecord(parsed) ||
      !exactKeys(parsed, ['schemaVersion','mode','scope','projectId','graphToken','runId',
        'failOnceNodeId','revision','commands']) ||
      parsed.schemaVersion !== 1 || parsed.mode !== 'MOCK_ONLY' ||
      typeof parsed.scope !== 'string' || typeof parsed.projectId !== 'string' ||
      typeof parsed.graphToken !== 'string' ||
      typeof parsed.revision !== 'number' || !Number.isInteger(parsed.revision) ||
      !Array.isArray(parsed.commands)) {
    throw new Error('Mock 检查点协议非法，已停止恢复。');
  }
  assertScope(parsed.scope);
  assertId(parsed.projectId,'projectId');
  assertId(parsed.runId,'runId');
  if (parsed.failOnceNodeId !== null) assertId(parsed.failOnceNodeId,'failOnceNodeId');
  if (parsed.graphToken.length > 100 || !parsed.graphToken.startsWith('fnv1a32-')) {
    throw new Error('Mock 检查点图版本字段非法。');
  }
  if (parsed.commands.length > MAX_COMMANDS || parsed.revision !== parsed.commands.length) {
    throw new Error('Mock 检查点修订号或命令数量不一致。');
  }
  const used = new Set<string>();
  const commands: StudioMockCommand[] = parsed.commands.map((item, index) => {
    if (!isRecord(item) || !exactKeys(item,['requestId','action','expectedRevision']) ||
        typeof item.requestId !== 'string' ||
        !ALLOWED_ACTIONS.includes(item.action as StudioMockCommandType) ||
        item.expectedRevision !== index) throw new Error('Mock 命令记录不合法或顺序不一致。');
    assertId(item.requestId,'requestId');
    if (used.has(item.requestId)) throw new Error('Mock 检查点包含重复请求 ID。');
    used.add(item.requestId);
    return {
      requestId: item.requestId,
      action: item.action as StudioMockCommandType,
      expectedRevision: index,
    };
  });
  return {
    schemaVersion: 1,
    mode: 'MOCK_ONLY',
    scope: parsed.scope,
    projectId: parsed.projectId,
    graphToken: parsed.graphToken,
    runId: parsed.runId as string,
    failOnceNodeId: parsed.failOnceNodeId as string | null,
    revision: parsed.revision,
    commands,
  };
}

/**
 * Fresh journal, checked against the actual graph and account scope.
 * Only the graph token and mock commands will be persisted, not raw prompts.
 */
export function createStudioMockJournal(
  project: InfiniteCanvasProject,
  scope: string,
  options: { runId: string; failOnceNodeId?: string | null },
): StudioMockJournalState {
  assertScope(scope);
  const run = createStudioMockRun(project, {
    id: options.runId, failOnceNodeId: options.failOnceNodeId || null,
  });
  return {
    journal: {
      schemaVersion: 1, mode: 'MOCK_ONLY', scope,
      projectId: project.id, graphToken: mockGraphToken(project),
      runId: run.id, failOnceNodeId: run.failOnceNodeId,
      revision: 0, commands: [],
    },
    run,
  };
}

/**
 * Fail closed if account, graph, command order or simulated transitions differ.
 * Unlike storing the full run object, replay cannot forge SUCCEEDED outcomes.
 */
export function restoreStudioMockJournal(
  raw: unknown, project: InfiniteCanvasProject, scope: string,
): StudioMockJournalState {
  assertScope(scope);
  const journal = parseJournal(raw);
  if (journal.scope !== scope) throw new Error('Mock 检查点属于其他账号范围。');
  if (journal.projectId !== project.id || journal.graphToken !== mockGraphToken(project)) {
    throw new Error('画布图版本已变化，Mock 检查点不能继续。');
  }
  let run = createStudioMockRun(project, {
    id: journal.runId, failOnceNodeId: journal.failOnceNodeId,
  });
  for (const command of journal.commands) {
    const next = apply(run, project, command.action);
    if (next === run) throw new Error('Mock 检查点包含终态重复操作。');
    run = next;
  }
  return { journal, run };
}

/**
 * Idempotent local command application, with optimistic revision checking.
 * A replayed request ID yields exactly the prior state; reusing its ID with
 * a different command or submitting a stale revision is rejected.
 */
export function appendStudioMockCommand(
  raw: unknown, project: InfiniteCanvasProject, scope: string,
  command: { requestId: string; action: StudioMockCommandType; expectedRevision: number },
): StudioMockJournalState {
  const { journal, run } = restoreStudioMockJournal(raw, project, scope);
  assertId(command.requestId,'requestId');
  if (!ALLOWED_ACTIONS.includes(command.action)) throw new Error('Mock 命令类型未授权。');
  const existing = journal.commands.find(item => item.requestId === command.requestId);
  if (existing) {
    if (existing.action !== command.action) throw new Error('同一请求 ID 不能用于不同操作。');
    return { journal, run };
  }
  if (command.expectedRevision !== journal.revision) {
    throw new Error('Mock 状态修订号过期，请重新读取当前检查点。');
  }
  if (journal.commands.length >= MAX_COMMANDS) throw new Error('Mock 命令日志已满，无法继续。');
  const next = apply(run, project, command.action);
  if (next === run) throw new Error('Mock 已进入终态或该操作没有状态变化。');
  const updated: StudioMockJournal = {
    ...journal,
    revision: journal.revision + 1,
    commands: [...journal.commands, {
      requestId: command.requestId, action: command.action,
      expectedRevision: journal.revision,
    }],
  };
  if (JSON.stringify(updated).length > MAX_SERIALIZED_SIZE) {
    throw new Error('Mock 命令日志超出浏览器容量限制。');
  }
  return { journal: updated, run: next };
}

export function serializeStudioMockJournal(
  journal: StudioMockJournal, project: InfiniteCanvasProject, scope: string,
): string {
  const { journal: validated } = restoreStudioMockJournal(journal,project,scope);
  return JSON.stringify(validated);
}

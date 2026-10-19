import {
  connectInfiniteNodes,
  createInfiniteNode,
  type InfiniteCanvasProject,
  type InfiniteCanvasNode,
} from './infinite-canvas-graph.ts';

/**
 * Offline-only creativity scaffold, NOT an LLM agent. No provider calls,
 * database writes, credits or background execution are permitted here.
 */
export type StudioRuleDraft = {
  schemaVersion: 1;
  mode: 'LOCAL_RULES_ONLY';
  brief: string;
  shotCount: number;
  durationSeconds: number | null;
  aspectRatio: '9:16' | '16:9' | '1:1';
  shots: { index: number; title: string; storyboard: string }[];
  caveats: string[];
  executionEnabled: false;
  providerCalls: 0;
};

const MIN_SHOTS = 2;
const MAX_SHOTS = 8;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Deterministically interpret only explicitly recognizable constraints. */
export function planStudioRequest(raw: string): StudioRuleDraft {
  const brief = String(raw || '').trim();
  if (!brief || brief.length > 2000) throw new Error('请填写 1–2000 字的创作需求。');
  const explicitCount = brief.match(/(?:^|[\s，,：:])(?:分成|制作|生成|需要|共)?\s*(\d{1,2})\s*(?:个)?(?:镜头|分镜|shots?\b)/i)
    || brief.match(/(?:shots?|镜头|分镜)\s*(?:[:：]?\s*)(\d{1,2})/i);
  const count = explicitCount ? Number(explicitCount[1]) : null;
  if (count !== null && (count < MIN_SHOTS || count > MAX_SHOTS)) {
    throw new Error('隔离画布每次仅支持规划 2–8 个镜头。请调整需求。');
  }
  const durationMatch = brief.match(/(?:^|[^\d])(\d{1,3})\s*(?:秒钟?|seconds?|secs?\b)/i);
  const durationSeconds = durationMatch ? Number(durationMatch[1]) : null;
  if (durationSeconds !== null && (durationSeconds < 4 || durationSeconds > 240)) {
    throw new Error('当前规则草稿支持 4–240 秒时长，请调整创作需求。');
  }
  const aspectRatio = brief.includes('16:9') ? '16:9' :
    brief.includes('1:1') ? '1:1' : '9:16';
  const shotCount = count ?? (durationSeconds ? clamp(Math.ceil(durationSeconds / 5), MIN_SHOTS, MAX_SHOTS) : 4);
  if (durationSeconds !== null && (durationSeconds < shotCount * 4 || durationSeconds > shotCount * 15)) {
    throw new Error('时长与镜头数不匹配：规则草稿要求每镜头 4–15 秒，请增加镜头数或调整时长。');
  }
  const caveats = [
    '这是离线规则生成的可编辑结构，不是大模型生成的专业剧本。',
    '每个镜头均需确认 Prompt、选择模型和检查素材后才能人工执行。',
    '目前不会调用生图、生视频、GPU 或收费服务。',
  ];
  if (count === null) caveats.push('未指定镜头数量，已使用规则估算；可修改需求重新规划。');
  if (durationSeconds === null) caveats.push('未识别到明确视频时长，请手动确定每个镜头长度。');
  const shots = Array.from({ length: shotCount }, (_, offset) => {
    const index = offset + 1;
    const purpose = index === 1 ? '开场 Hook / 引出核心情境' :
      index === shotCount ? '收束 / 留下结尾情绪或悬念' :
      '推进情节 / 镜头间过渡';
    return {
      index,
      title: 'Shot ' + String(index).padStart(2, '0'),
      storyboard: [
        '镜头 ' + index + '/' + shotCount + ' · ' + purpose,
        '创作需求：' + brief.slice(0, 650),
        '请进一步填写动作、景别、镜头运动、角色/场景连续性。以上均为编辑提示，尚非已验证分镜。',
      ].join('\n'),
    };
  });
  return {
    schemaVersion: 1,
    mode: 'LOCAL_RULES_ONLY',
    brief,
    shotCount,
    durationSeconds,
    aspectRatio,
    shots,
    caveats,
    executionEnabled: false,
    providerCalls: 0,
  };
}

/**
 * Apply only after a deliberate UI confirmation. Appends nodes, preserving
 * existing graph, project metadata, paid-job history and legacy projects.
 */
export function appendStudioRuleDraft(
  original: InfiniteCanvasProject,
  draft: StudioRuleDraft,
  createId: () => string,
): InfiniteCanvasProject {
  if (draft.schemaVersion !== 1 || draft.mode !== 'LOCAL_RULES_ONLY'
    || draft.executionEnabled !== false || draft.providerCalls !== 0
    || draft.shots.length !== draft.shotCount || draft.shotCount < MIN_SHOTS
    || draft.shotCount > MAX_SHOTS) throw new Error('规划协议不合法，已阻止写入。');
  if (original.nodes.length + 1 + draft.shotCount * 2 > 400
    || original.edges.length + draft.shotCount > 800) {
    throw new Error('画布容量不足，请先整理已有节点。');
  }
  const ids = new Set(original.nodes.map(node => node.id));
  const issueId = () => {
    const id = createId();
    if (!id || ids.has(id) || id.length > 100) throw new Error('节点 ID 重复或非法，已取消新增。');
    ids.add(id);
    return id;
  };
  const baseX = clamp(Math.max(100, ...original.nodes.map(node => node.x + 310)), 100, 2600);
  const nodes: InfiniteCanvasNode[] = [];
  const edges: { id: string; source: string; target: string; port: 'prompt' }[] = [];
  const brief = createInfiniteNode(issueId(), 'text', baseX, 90);
  brief.title = '创作需求 · Agent 草稿';
  brief.text = draft.brief.slice(0, 2000);
  nodes.push(brief);
  for (const shot of draft.shots) {
    const y = 370 + (shot.index - 1) * 310;
    const storyboard = createInfiniteNode(issueId(), 'storyboard', baseX, y);
    storyboard.title = shot.title + ' 分镜';
    storyboard.text = shot.storyboard.slice(0, 12000);
    const video = createInfiniteNode(issueId(), 'video', baseX + 350, y);
    video.title = shot.title + ' 视频';
    video.video = {
      ...video.video!,
      model: null,
      mode: 'text',
      modeSelection: 'manual',
      prompt: '',
      aspectRatio: draft.aspectRatio,
      duration: draft.durationSeconds !== null
        ? String(Math.floor(draft.durationSeconds / draft.shotCount)
          + (shot.index <= draft.durationSeconds % draft.shotCount ? 1 : 0)) + 's'
        : '5s',
    };
    nodes.push(storyboard, video);
    const edgeId = issueId();
    edges.push({ id: edgeId, source: storyboard.id, target: video.id, port: 'prompt' });
  }
  let next: InfiniteCanvasProject = {
    ...original,
    nodes: [...original.nodes, ...nodes],
  };
  for (const edge of edges) next = connectInfiniteNodes(next, edge.id, edge.source, edge.target, edge.port);
  return next;
}

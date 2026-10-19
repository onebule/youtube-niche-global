import type { InfiniteCanvasProject } from './infinite-canvas-graph.ts';
import {
  prepareStudioAgentPatch,
  type StudioAgentPatch,
  type StudioAgentOperation,
} from './studio-agent-tools.ts';

/**
 * Adapts a *previously obtained* SignalCraft VideoGenerationPlan payload.
 * It makes zero network calls and never trusts optional suggestedActions.
 * Any actual LLM/paid planning calls must be approved and run elsewhere.
 */
export type StudioPlanBridgeReview = {
  source: 'PREEXISTING_AGENT_PLAN_JSON';
  modelSuggestion: string;
  selectedNodeModel: string | null;
  director: string;
  fallback: boolean;
  ignoredLegacyActions: number;
  warnings: string[];
  proposal: StudioAgentPatch;
};

const isRecord = (input: unknown): input is Record<string, unknown> =>
  Boolean(input && typeof input === 'object' && !Array.isArray(input));

const parse = (input: unknown) => {
  if (typeof input !== 'string') return input;
  if (input.length > 40000) throw new Error('Agent 规划 JSON 不能超过 40000 字符。');
  let json: unknown;
  try { json = JSON.parse(input); } catch { throw new Error('Agent 规划 JSON 格式错误。'); }
  return json;
};

export function bridgePreexistingVideoAgentPlan(
  project: InfiniteCanvasProject,
  selectedVideoId: string | null,
  rawPlan: unknown,
  createId: () => string,
): StudioPlanBridgeReview {
  if (!selectedVideoId) throw new Error('请先选择一个视频生成节点。');
  const node = project.nodes.find(item => item.id === selectedVideoId);
  if (!node || node.kind !== 'video' || !node.video) throw new Error('仅支持导入到已有视频生成节点。');

  const wrapped = parse(rawPlan);
  if (!isRecord(wrapped)) throw new Error('Agent 规划必须是 JSON 对象。');
  const plan = 'plan' in wrapped ? wrapped.plan : wrapped;
  if (!isRecord(plan) || plan.kind !== 'video-generation-plan') {
    throw new Error('不是受支持的 SignalCraft VideoGenerationPlan。');
  }
  if (plan.autoGenerate !== false) throw new Error('Agent 规划必须明确禁止自动生成。');
  if (typeof plan.prompt !== 'string' || !plan.prompt.trim() || plan.prompt.length > 1200) {
    throw new Error('Agent 提示词为空或超过 1200 字符。');
  }
  if (typeof plan.model !== 'string' || plan.model.length > 45) throw new Error('Agent 模型字段非法。');
  if (node.video.model && node.video.model !== plan.model) {
    throw new Error('Agent 推荐模型与当前节点已锁定模型不同，请检查后重新规划。');
  }
  const warnings: string[] = [];
  if (Array.isArray(plan.warnings)) {
    for (const warning of plan.warnings.slice(0, 8)) {
      if (typeof warning === 'string' && warning.trim()) warnings.push(warning.slice(0, 160));
    }
  }
  const director = isRecord(plan.director) && typeof plan.director.id === 'string'
    ? plan.director.id.slice(0, 30) : 'unknown';
  const rationale = typeof plan.reasoning === 'string' ? plan.reasoning.trim().slice(0, 450) : '';
  const fallback = plan.agentFallback === true;
  const legacyActions = Array.isArray(plan.suggestedActions) ? plan.suggestedActions.length : 0;
  // VideoGenerationPlan's legacy shot.* action IDs refer to a *different*
  // semantic workspace. Never reinterpret them as graph node commands.
  if (legacyActions) warnings.push('旧工作室镜头动作建议有 ' + legacyActions + ' 项，未转成节点操作。');
  if (fallback) warnings.push('这是规则回退规划，不是一次成功的大模型 Agent 调用。');
  if (!node.video.model) warnings.push('仅导入提示词和说明，不会自动选择模型或执行生成。');

  const instructions: StudioAgentOperation[] = [{
    type: 'node.set_video_prompt', ref: node.id, prompt: plan.prompt.trim(),
  }];
  if (rationale || warnings.length) {
    const explanation = [
      rationale ? 'Agent 规划理由：' + rationale : 'Agent 规划说明：',
      '建议模型：' + plan.model,
      ...warnings.map(text => '提醒：' + text),
    ].join('\n').slice(0, 1200);
    instructions.push({
      type: 'node.create', ref: 'tmp:agent-review-note', kind: 'note', title: 'Agent 规划说明',
      text: explanation, x: node.x - 330, y: node.y + 230,
    });
  }
  const proposal = prepareStudioAgentPatch(project, instructions, createId);
  return {
    source: 'PREEXISTING_AGENT_PLAN_JSON',
    modelSuggestion: plan.model,
    selectedNodeModel: node.video.model,
    director,
    fallback,
    ignoredLegacyActions: legacyActions,
    warnings,
    proposal,
  };
}

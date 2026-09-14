import type { OpportunityUnit } from './product-convergence.ts';
import { getRpmBenchmarkForTopic } from './rpm-benchmarks.ts';

export const DECISION_INTELLIGENCE_VERSION = 'decision-intelligence-p0.v1';

export type DecisionSupportType = 'DATA_BACKED' | 'INFERENCE' | 'LOW_CONFIDENCE' | 'UNAVAILABLE';
export type DecisionSignalLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'UNKNOWN';

export type DecisionSignal = {
  score: number | null;
  level: DecisionSignalLevel;
  supportType: DecisionSupportType;
  explanation: string;
  evidence: string[];
};

export type DecisionIntelligence = {
  version: typeof DECISION_INTELLIGENCE_VERSION;
  opportunityScore: number | null;
  riskAdjustedScore: number | null;
  demandSupplyGap: DecisionSignal;
  smallCreatorOpportunity: DecisionSignal;
  confidence: DecisionSignal;
  commentDemand: DecisionSignal;
  aiSuitability: DecisionSignal;
  monetization: DecisionSignal & { rangeUsd: [number, number] | null };
  riskPenalty: number;
  mainRisks: string[];
};

export type FirstVideoIdea = {
  id: string;
  group: 'CORE' | 'ADAPTATION' | 'EXPLORE';
  titleConcept: string;
  hook: string;
  format: OpportunityUnit['format'];
  whyThisTopic: string;
  supportType: Exclude<DecisionSupportType, 'UNAVAILABLE'>;
};

export type ValidationDecisionRule = {
  decision: 'CONTINUE' | 'ADJUST' | 'STOP';
  when: string;
  action: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const levelFor = (score: number | null): DecisionSignalLevel => score === null ? 'UNKNOWN' : score >= 70 ? 'STRONG' : score >= 45 ? 'MODERATE' : 'WEAK';
const unknown = (explanation: string): DecisionSignal => ({ score: null, level: 'UNKNOWN', supportType: 'UNAVAILABLE', explanation, evidence: [] });

function confidenceSignal(unit: OpportunityUnit): DecisionSignal {
  const rules = unit.format === 'SHORTS'
    ? { strongVideos: 12, strongCreators: 5, historyVideos: 6 }
    : { strongVideos: 12, strongCreators: 5, historyVideos: 5 };
  const supplied = finite(unit.market.confidenceScore);
  const qualityScore = unit.market.quality === 'COMPLETE' ? 100 : unit.market.quality === 'PARTIAL' ? 65 : unit.market.quality === 'STALE' ? 25 : 0;
  const derived = clamp(
    Math.min(1, unit.market.videos / rules.strongVideos) * 35
    + Math.min(1, unit.market.creators / rules.strongCreators) * 30
    + Math.min(1, unit.market.previousVideos / rules.historyVideos) * 20
    + qualityScore * 0.15,
  );
  const labelCap = unit.market.confidence === 'HIGH' ? 100 : unit.market.confidence === 'MEDIUM' ? 79 : unit.market.confidence === 'LOW' ? 49 : 24;
  const score = Math.min(labelCap, supplied === null ? derived : clamp(supplied));
  const supportType: DecisionSupportType = score >= 50 && !['INSUFFICIENT', 'STALE'].includes(unit.market.quality) ? 'DATA_BACKED' : 'LOW_CONFIDENCE';
  return {
    score,
    level: levelFor(score),
    supportType,
    explanation: `由 ${unit.market.videos} 条样本、${unit.market.creators} 个频道、${unit.market.previousVideos} 条历史对照和 ${unit.market.quality} 数据质量共同校准。`,
    evidence: ['sampleVideoCount', 'independentChannelCount', 'previousSampleCount', 'dataQuality'],
  };
}

function demandSupplyGapSignal(unit: OpportunityUnit): DecisionSignal {
  const demandGrowth = finite(unit.market.growth);
  const supplyGrowth = finite(unit.market.supplyGrowth);
  if (demandGrowth === null || supplyGrowth === null || unit.market.previousVideos <= 0) {
    return unknown('缺少同窗口需求表现与内容供给变化，不能把样本量或频道集中度冒充供需缺口。');
  }
  const difference = demandGrowth - supplyGrowth;
  let score = clamp(50 + difference);
  if (demandGrowth <= 0) score = Math.min(score, 44);
  const supportType: DecisionSupportType = ['INSUFFICIENT', 'STALE'].includes(unit.market.quality) ? 'LOW_CONFIDENCE' : 'DATA_BACKED';
  return {
    score,
    level: levelFor(score),
    supportType,
    explanation: `当前需求表现代理变化 ${Math.round(demandGrowth)}%，供给样本变化 ${Math.round(supplyGrowth)}%，差值 ${Math.round(difference)} 个百分点。`,
    evidence: ['metrics.demandProxyGrowth', 'metrics.supplyGrowth', 'baseline.previousSampleCount'],
  };
}

function smallCreatorSignal(unit: OpportunityUnit): DecisionSignal {
  const breakouts = finite(unit.market.smallCreatorBreakouts);
  if (breakouts === null || unit.market.videos <= 0 || unit.market.creators <= 0) {
    return unknown('缺少中小频道突破候选或订阅规模证据。');
  }
  const density = breakouts / unit.market.videos;
  const breadth = Math.min(1, unit.market.creators / 5);
  const repeatBonus = breakouts >= 3 ? 50 : breakouts >= 2 ? 35 : breakouts >= 1 ? 20 : 0;
  const score = clamp(repeatBonus + density * 45 + breadth * 20);
  const supportType: DecisionSupportType = unit.market.quality === 'INSUFFICIENT' ? 'LOW_CONFIDENCE' : 'DATA_BACKED';
  return {
    score,
    level: levelFor(score),
    supportType,
    explanation: `${Math.round(breakouts)} 个突破候选分布在 ${unit.market.videos} 条视频、${unit.market.creators} 个频道的当前样本中；这是公开播放/订阅代理，不是成功率。`,
    evidence: ['smallCreatorBreakouts', 'sampleVideoCount', 'independentChannelCount'],
  };
}

function mainRisks(unit: OpportunityUnit): string[] {
  const risks = (unit.market.decision?.risks || []).map(item => item.message);
  if ((unit.market.concentration ?? 0) >= (unit.format === 'SHORTS' ? 75 : 65)) risks.push('头部频道集中度偏高，当前机会可能由少数创作者驱动。');
  if (['CROWDED', 'SATURATING', 'SATURATED', 'DECLINING'].includes(unit.market.lifecycle)) risks.push(`生命周期为 ${unit.market.lifecycle}，进入窗口可能正在收窄。`);
  if (unit.market.previousVideos <= 0) risks.push('缺少等长历史窗口，不能把单期表现当成稳定趋势。');
  return [...new Set(risks)].slice(0, 3);
}

export function buildDecisionIntelligence(unit: OpportunityUnit): DecisionIntelligence {
  const confidence = confidenceSignal(unit);
  const demandSupplyGap = demandSupplyGapSignal(unit);
  const smallCreatorOpportunity = smallCreatorSignal(unit);
  const risks = mainRisks(unit);
  const riskPenalty = Math.min(25, risks.length * 8 + (confidence.supportType === 'LOW_CONFIDENCE' ? 5 : 0));
  const opportunityScore = finite(unit.market.decision?.score ?? unit.market.opportunityScore);
  const riskAdjustedScore = opportunityScore === null ? null : clamp(opportunityScore - riskPenalty);
  const aiScore = finite(unit.market.aiSuitability);
  const aiSuitability = aiScore === null
    ? unknown('当前公开数据没有足够的制作结构证据，AI 适配保持未知。')
    : { score: clamp(aiScore), level: levelFor(aiScore), supportType: 'INFERENCE' as const, explanation: '由内容机制与制作方式推断；不代表生成质量、成本或成功率。', evidence: ['decisionDimensions.aiSuitability'] };
  const specificBenchmark = getRpmBenchmarkForTopic(unit.subNiche);
  const benchmark = specificBenchmark.status === 'BENCHMARK' ? specificBenchmark : getRpmBenchmarkForTopic(unit.niche);
  const monetization = benchmark.status === 'BENCHMARK' && benchmark.lowUsd !== null && benchmark.highUsd !== null
    ? { score: null, level: 'UNKNOWN' as const, supportType: 'LOW_CONFIDENCE' as const, explanation: `公开市场工具参考 RPM $${benchmark.lowUsd}–$${benchmark.highUsd}；不是当前频道真实收益，也不参与市场事实评分。`, evidence: benchmark.rows.map(row => row.sourceUrl), rangeUsd: [benchmark.lowUsd, benchmark.highUsd] as [number, number] }
    : { ...unknown('没有可匹配的公开 RPM 基准；变现潜力保持未知。'), rangeUsd: null };
  return {
    version: DECISION_INTELLIGENCE_VERSION,
    opportunityScore,
    riskAdjustedScore,
    demandSupplyGap,
    smallCreatorOpportunity,
    confidence,
    commentDemand: unknown('当前链路只有评论总数，没有评论正文；不能据此判断观众需求。'),
    aiSuitability,
    monetization,
    riskPenalty,
    mainRisks: risks,
  };
}

const ideaTemplates: Array<{ group: FirstVideoIdea['group']; title: (niche: string) => string; hook: (niche: string) => string; why: string }> = [
  { group: 'CORE', title: niche => `${niche}：新手最先要解决的 1 个问题`, hook: niche => `做 ${niche} 前，先别急着买工具。`, why: '先验证最核心受众问题是否成立。' },
  { group: 'CORE', title: niche => `${niche} 的 3 个常见误区`, hook: () => '多数人第一步就做反了。', why: '用纠错结构验证问题认知。' },
  { group: 'CORE', title: niche => `${niche}：从零到完成的最短路径`, hook: () => '把完整过程压缩成可执行的三步。', why: '验证教程/解释机制能否稳定兑现。' },
  { group: 'CORE', title: niche => `我用一个真实案例验证 ${niche}`, hook: () => '不讲空泛结论，直接看一次可复核测试。', why: '把代表视频信号改写成自己的证据。' },
  { group: 'ADAPTATION', title: niche => `${niche}：低预算方案 vs 标准方案`, hook: () => '预算减半，结果会差多少？', why: '验证价格与资源约束下的受众分层。' },
  { group: 'ADAPTATION', title: niche => `${niche} 中最值得比较的两种方法`, hook: () => '看起来相同的两条路，差别其实在这里。', why: '用对比结构寻找更清晰的差异化。' },
  { group: 'ADAPTATION', title: niche => `${niche} 失败案例：问题到底出在哪`, hook: () => '结果失败并不可怕，真正值得看的是原因。', why: '验证风险解释是否能产生持续需求。' },
  { group: 'EXPLORE', title: niche => `${niche} 的反常识结论`, hook: () => '大家默认正确的做法，可能恰好拖慢结果。', why: '探索不同观点，但需要额外证据核验。' },
  { group: 'EXPLORE', title: niche => `${niche}：一个月后再看结果`, hook: () => '第一次结果不算结论，时间才是关键变量。', why: '测试长期性与可重复观看价值。' },
  { group: 'EXPLORE', title: niche => `观众最想追问的 ${niche} 问题`, hook: () => '先把评论区真正想问的问题列出来。', why: '为后续评论需求验证预留位置；发布前仍需人工采样。' },
];

export function buildFirstVideoIdeas(unit: OpportunityUnit): FirstVideoIdea[] {
  if (!unit.subNiche || !unit.pattern || !unit.market.evidenceVideoIds.length) return [];
  const intelligence = buildDecisionIntelligence(unit);
  const supportType: FirstVideoIdea['supportType'] = intelligence.confidence.score !== null && intelligence.confidence.score >= 50 ? 'INFERENCE' : 'LOW_CONFIDENCE';
  const evidenceFoundation = `基于 ${unit.market.evidenceVideoIds.length} 条可回溯公开视频与“${unit.pattern.label}”内容机制提出。`;
  const whySignal = intelligence.demandSupplyGap.score !== null
    ? `供需差值代理为 ${intelligence.demandSupplyGap.score}/100；创意本身仍是待验证推断。`
    : intelligence.smallCreatorOpportunity.score !== null
      ? `中小创作者机会代理为 ${intelligence.smallCreatorOpportunity.score}/100；创意本身仍是待验证推断。`
      : '基于当前代表视频与内容机制提出，尚未被发布结果验证。';
  return ideaTemplates.map((template, index) => ({
    id: `${unit.id}:first-10:${index + 1}`,
    group: template.group,
    titleConcept: template.title(unit.subNiche!),
    hook: template.hook(unit.subNiche!),
    format: unit.format,
    whyThisTopic: `${template.why}${evidenceFoundation}${whySignal}`,
    supportType,
  }));
}

export function validationDecisionRules(): ValidationDecisionRule[] {
  return [
    { decision: 'CONTINUE', when: '多条视频相对频道基线与同赛道样本持续改善；或 CTR、留存健康但曝光仍低。', action: '保持核心机制，再完成下一轮受控测试。' },
    { decision: 'ADJUST', when: 'CTR 弱而留存健康，或 CTR 健康而留存弱，或只有少数角度明显优于其余内容。', action: '分别调整包装、内容兑现或受众问题；不要同时改所有变量。' },
    { decision: 'STOP', when: '完成一批可比较视频后，多个角度持续同时低于频道基线与赛道基线，且调整后仍无改善。', action: '停止当前细分假设并回到趋势雷达；绝不因单条失败停止。' },
  ];
}

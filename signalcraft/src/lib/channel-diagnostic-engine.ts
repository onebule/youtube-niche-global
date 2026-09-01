import { channelDiagnosticConfig as config } from './channel-diagnostic-config.ts';
import { buildCreatorBreakoutSummary, type CreatorBreakoutSummary } from './creator-breakout.ts';

export type ChannelStage = 'NEW_CHANNEL' | 'EARLY_TESTING' | 'EARLY_GROWTH' | 'GROWTH' | 'STABLE' | 'MATURE' | 'DECLINING' | 'DORMANT' | 'INSUFFICIENT_DATA';
export type ChannelState = 'HEALTHY_GROWTH' | 'HEALTHY_STABLE' | 'EARLY_EXPLORATION' | 'VOLATILE' | 'STALLED' | 'DECLINING' | 'HIT_DEPENDENT' | 'FORMAT_CONFUSED' | 'TOPIC_DRIFT' | 'DISTRIBUTION_ANOMALY' | 'LOW_REPEATABILITY' | 'DORMANT' | 'INSUFFICIENT_DATA';
export type DiagnosticConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type DiagnosticSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type DiagnosticPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type ChannelIssueCode = 'BASELINE_DECLINE' | 'UPLOAD_IRREGULARITY' | 'HIGH_VOLATILITY' | 'HIT_DEPENDENCE' | 'LOW_REPEATABILITY' | 'TOPIC_DRIFT' | 'FORMAT_CONFUSION' | 'RECENT_DISTRIBUTION_ANOMALY' | 'BREAKOUT_NO_FOLLOWUP' | 'CONTENT_STAGNATION' | 'LONG_INACTIVITY' | 'WEAK_RECENT_MOMENTUM' | 'PACKAGING_INCONSISTENCY_PROXY' | 'INSUFFICIENT_DATA';
export type EvidenceType = 'FACT' | 'INFERENCE';

export type DiagnosticEvidence = {
  metric: string;
  currentValue: number | string;
  baselineValue?: number | string;
  delta?: number;
  window?: string;
  sampleSize?: number;
  evidenceType: EvidenceType;
};

export type PossibleCause = { text: string; confidence: DiagnosticConfidence; supportingEvidence: string[]; contradictingEvidence: string[] };
export type DiagnosticAction = { title: string; detail: string; metricToWatch: string; window: string; priority?: DiagnosticPriority };
export type DiagnosticExperiment = { hypothesis: string; plan: string[]; observe: string[]; decisionRule: string; confidence: DiagnosticConfidence };

export type DiagnosticIssue = {
  issueCode: ChannelIssueCode;
  title: string;
  severity: DiagnosticSeverity;
  priority: DiagnosticPriority;
  confidence: DiagnosticConfidence;
  persistence: string;
  impact: string;
  fact: string;
  evidence: DiagnosticEvidence[];
  possibleCauses: PossibleCause[];
  recommendedAction: DiagnosticAction;
  metricToWatch?: string;
};

export type DiagnosticMetrics = {
  sampleSize: number;
  medianViews: number;
  p25Views: number;
  p75Views: number;
  p90Views: number;
  mad: number;
  medianViewsPerDay: number;
  recentMedian: number | null;
  historicalMedian: number | null;
  recentVsBaseline: number | null;
  lowPerformanceRate: number;
  hitRate: number;
  top1ViewShare: number;
  top3ViewShare: number;
  uploadIntervalDays: number | null;
  longestUploadGapDays: number | null;
  breakoutCount: number;
};

export type FormatDiagnosis = {
  format: 'SHORTS' | 'LONG_FORM';
  sampleSize: number;
  state: ChannelState;
  confidence: DiagnosticConfidence;
  metrics: DiagnosticMetrics;
  topIssues: DiagnosticIssue[];
  /** Long-form-only creator baseline evidence; Shorts diagnostics remain unchanged. */
  creatorBreakout?: CreatorBreakoutSummary;
};

export type ChannelDiagnosis = {
  channelId: string;
  diagnosedAt: string;
  diagnosisVersion: string;
  algorithmVersion: string;
  channelStage: ChannelStage;
  primaryState: ChannelState;
  secondaryStates: ChannelState[];
  healthScore?: number;
  confidence: DiagnosticConfidence;
  dataQuality: { sampleSize: number; timeSpanDays: number; completeness: number; classificationConfidence: number; notes: string[] };
  summary: { headline: string; detail: string };
  topIssues: DiagnosticIssue[];
  overallMetrics: DiagnosticMetrics;
  longFormDiagnosis?: FormatDiagnosis;
  shortFormDiagnosis?: FormatDiagnosis;
  performanceTrend: Array<{ date: string; rollingMedianViews: number; ageNormalizedMedian: number; label?: string }>;
  breakoutVideos: Array<{ videoId: string; title: string; ratio: number; followUpFound: boolean }>;
  actions: DiagnosticAction[];
  experiments: DiagnosticExperiment[];
};

export type DiagnosticVideo = {
  id: string;
  title: string;
  publishedAt: string;
  views: number;
  durationSeconds: number;
  format: 'short' | 'long' | 'unknown';
  formatConfidence?: 'high' | 'medium' | 'low';
};

export type DiagnosticChannelInput = {
  channelId: string;
  channelTitle: string;
  subscriberCount?: number;
  videoCount?: number;
  createdAt?: string;
  videos: DiagnosticVideo[];
};

const DAY = 86_400_000;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const round = (value: number, digits = 1) => Number(value.toFixed(digits));
const sorted = (values: number[]) => values.filter(finite).sort((a, b) => a - b);
const median = (values: number[]) => { const list = sorted(values); if (!list.length) return 0; const middle = Math.floor(list.length / 2); return list.length % 2 ? list[middle] : (list[middle - 1] + list[middle]) / 2; };
const percentile = (values: number[], p: number) => { const list = sorted(values); if (!list.length) return 0; const index = (list.length - 1) * p; const lower = Math.floor(index); const upper = Math.ceil(index); return list[lower] + (list[upper] - list[lower]) * (index - lower); };
const mad = (values: number[]) => { const center = median(values); return median(values.map(value => Math.abs(value - center))); };
const ratioDelta = (current: number | null, baseline: number | null) => current === null || baseline === null || baseline <= 0 ? null : current / baseline - 1;
const ageDays = (publishedAt: string, now: number) => Math.max(1, Math.floor((now - new Date(publishedAt).getTime()) / DAY));
const viewsPerDay = (video: DiagnosticVideo, now: number) => video.views / ageDays(video.publishedAt, now);

function metricFor(videos: DiagnosticVideo[], now: number): DiagnosticMetrics {
  const views = videos.map(video => Math.max(0, video.views));
  const normalized = videos.map(video => viewsPerDay(video, now));
  const ordered = [...videos].sort((a, b) => b.views - a.views);
  const total = views.reduce((sum, value) => sum + value, 0);
  const recent = [...videos].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, config.recentWindowSize);
  const previous = [...videos].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(config.recentWindowSize, config.recentWindowSize + config.previousWindowSize);
  const baseline = previous.length >= 3 ? median(previous.map(video => viewsPerDay(video, now))) : null;
  const recentMedian = recent.length ? median(recent.map(video => viewsPerDay(video, now))) : null;
  const lowThreshold = percentile(views, 0.25);
  const intervals = [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).map((video, index, list) => index ? (new Date(video.publishedAt).getTime() - new Date(list[index - 1].publishedAt).getTime()) / DAY : null).filter(finite);
  const breakoutThreshold = baseline && baseline > 0 ? baseline * config.breakoutThreshold : 0;
  const breakoutCount = baseline ? videos.filter(video => viewsPerDay(video, now) >= breakoutThreshold).length : 0;
  return {
    sampleSize: videos.length,
    medianViews: round(median(views)),
    p25Views: round(percentile(views, .25)),
    p75Views: round(percentile(views, .75)),
    p90Views: round(percentile(views, .9)),
    mad: round(mad(views)),
    medianViewsPerDay: round(median(normalized)),
    recentMedian: recentMedian === null ? null : round(recentMedian),
    historicalMedian: baseline === null ? null : round(baseline),
    recentVsBaseline: ratioDelta(recentMedian, baseline) === null ? null : round(ratioDelta(recentMedian, baseline)! * 100),
    lowPerformanceRate: views.length ? round(views.filter(value => value <= lowThreshold).length / views.length * 100) : 0,
    hitRate: videos.length ? round(breakoutCount / videos.length * 100) : 0,
    top1ViewShare: total ? round(ordered[0]?.views / total * 100) : 0,
    top3ViewShare: total ? round(ordered.slice(0, 3).reduce((sum, video) => sum + video.views, 0) / total * 100) : 0,
    uploadIntervalDays: intervals.length ? round(median(intervals)) : null,
    longestUploadGapDays: intervals.length ? round(Math.max(...intervals)) : null,
    breakoutCount,
  };
}

function confidenceFor(videos: DiagnosticVideo[]): DiagnosticConfidence {
  // Treat the minimum sample as a guardrail, not as enough evidence for a
  // medium-confidence conclusion.  The first qualifying batch should still
  // be labelled low confidence until more history is available.
  if (videos.length <= config.minSample) return 'LOW';
  const dates = videos.map(video => new Date(video.publishedAt).getTime()).filter(Number.isFinite);
  const span = dates.length ? (Math.max(...dates) - Math.min(...dates)) / DAY : 0;
  const classification = videos.filter(video => video.format !== 'unknown').map(video => video.formatConfidence === 'high' ? 1 : video.formatConfidence === 'medium' ? .7 : .4);
  if (videos.length >= config.highConfidenceSample && span >= config.highConfidenceTimeSpanDays && (!classification.length || median(classification) >= .7)) return 'HIGH';
  return 'MEDIUM';
}

function stageFor(input: DiagnosticChannelInput, metrics: DiagnosticMetrics, now: number): ChannelStage {
  if (metrics.sampleSize < config.minSample) return 'INSUFFICIENT_DATA';
  const latest = input.videos.length ? Math.min(...input.videos.map(video => ageDays(video.publishedAt, now))) : Infinity;
  if (latest >= config.inactivityDays) return 'DORMANT';
  const age = input.createdAt ? ageDays(input.createdAt, now) : null;
  if (age !== null && age <= 180 && metrics.sampleSize <= 10) return metrics.recentVsBaseline !== null && metrics.recentVsBaseline > 15 ? 'EARLY_GROWTH' : 'EARLY_TESTING';
  if (metrics.recentVsBaseline !== null && metrics.recentVsBaseline < -config.declineThreshold * 100) return 'DECLINING';
  if (metrics.sampleSize >= 50) return 'MATURE';
  if (metrics.recentVsBaseline !== null && metrics.recentVsBaseline > 15) return 'GROWTH';
  return metrics.recentVsBaseline !== null && Math.abs(metrics.recentVsBaseline) <= 15 ? 'STABLE' : 'GROWTH';
}

function priorityFor(severity: DiagnosticSeverity, confidence: DiagnosticConfidence): DiagnosticPriority {
  if (severity === 'CRITICAL') return 'P0';
  if (severity === 'HIGH' && confidence !== 'LOW') return 'P1';
  if (severity === 'HIGH' || confidence === 'HIGH') return 'P1';
  if (severity === 'MEDIUM') return 'P2';
  return 'P3';
}

function issueBase(issueCode: ChannelIssueCode, title: string, fact: string, impact: string, confidence: DiagnosticConfidence, severity: DiagnosticSeverity, evidence: DiagnosticEvidence[], action: DiagnosticAction, causes: PossibleCause[] = []): DiagnosticIssue {
  return { issueCode, title, severity, priority: priorityFor(severity, confidence), confidence, persistence: '最近窗口', impact, fact, evidence, possibleCauses: causes, recommendedAction: action, metricToWatch: action.metricToWatch };
}

function tokenize(title: string) {
  return new Set((title.toLowerCase().match(/[a-z0-9\u4e00-\u9fff]{2,}/g) || []).filter(token => !['the', 'and', 'with', 'this', 'that', 'how', 'for'].includes(token)));
}
function titleSimilarity(a: string, b: string) {
  const left = tokenize(a); const right = tokenize(b); if (!left.size || !right.size) return 0;
  let overlap = 0; left.forEach(token => { if (right.has(token)) overlap += 1; });
  return overlap / Math.max(1, Math.min(left.size, right.size));
}

function detectIssues(videos: DiagnosticVideo[], metrics: DiagnosticMetrics, overall: DiagnosticMetrics, confidence: DiagnosticConfidence, now: number, stage: ChannelStage): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  if (videos.length < config.minSample) {
    issues.push(issueBase('INSUFFICIENT_DATA', '样本不足，暂不生成稳定结论', `当前只有 ${videos.length} 条可分析视频。`, '避免把早期波动误判为频道问题。', 'LOW', 'LOW', [{ metric: 'sampleSize', currentValue: videos.length, baselineValue: config.minSample, evidenceType: 'FACT' }], { title: '先补齐可比较样本', detail: '继续发布并等待至少 5 条同一形态公开视频后复诊。', metricToWatch: '可分析视频数', window: '下一次采集' }));
    return issues;
  }
  const latestAge = Math.min(...videos.map(video => ageDays(video.publishedAt, now)));
  if (latestAge >= config.inactivityDays) {
    issues.push(issueBase('LONG_INACTIVITY', '频道已长时间没有发布', `最近一条公开视频距今约 ${latestAge} 天。`, '没有新的样本，无法继续验证主题与发布策略是否有效。', confidence, 'HIGH', [{ metric: 'days since latest upload', currentValue: latestAge, baselineValue: config.inactivityDays, window: '当前时间', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '恢复可持续的发布节奏', detail: '先发布 1 条低成本验证视频，随后按稳定间隔恢复连续样本。', metricToWatch: '恢复后的年龄校正播放', window: '未来 3 条视频' }));
  }
  if (metrics.recentVsBaseline !== null && metrics.recentVsBaseline <= -config.declineThreshold * 100) {
    issues.push(issueBase('BASELINE_DECLINE', '近期表现低于自身基线', `最近一组年龄校正播放中位数较前一组下降 ${Math.abs(metrics.recentVsBaseline)}%。`, '会降低下一条视频获得稳定初始反馈的概率。', confidence, confidence === 'HIGH' ? 'HIGH' : 'MEDIUM', [{ metric: 'ageNormalizedMedian', currentValue: metrics.recentMedian ?? 0, baselineValue: metrics.historicalMedian ?? 0, delta: metrics.recentVsBaseline ?? 0, window: 'Recent 10 vs previous 20', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '回到已验证主题做对照', detail: '下一轮 3 条视频中安排 2 条历史强势主题，1 条受控实验。', metricToWatch: '24h/72h 年龄校正播放', window: '未来 3 条视频' }, [{ text: '近期主题或内容机制发生漂移', confidence, supportingEvidence: ['近期基线持续低于历史基线'], contradictingEvidence: ['公开数据无法确认 CTR、留存或流量来源'] }]));
  }
  const volatilityRatio = metrics.medianViews > 0 ? metrics.mad / metrics.medianViews : 0;
  if (volatilityRatio >= config.volatilityMadRatio && videos.length >= config.highConfidenceSample) {
    issues.push(issueBase('HIGH_VOLATILITY', '视频表现波动过大', `播放 MAD 为 ${metrics.mad}，约为中位数的 ${round(volatilityRatio * 100)}%。`, '单条爆款会掩盖大多数视频的真实可重复表现。', confidence, 'MEDIUM', [{ metric: 'MAD / median', currentValue: round(volatilityRatio * 100), baselineValue: round(config.volatilityMadRatio * 100), window: '全部样本', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '拆出可重复的共同结构', detail: '分析 Top 3 视频的主题、格式与标题机制，制作 3 条相邻变体。', metricToWatch: 'P25 年龄校正播放', window: '未来 3 条视频' }));
  }
  if (metrics.top1ViewShare >= config.hitTop1Share * 100 || metrics.top3ViewShare >= config.hitTop3Share * 100) {
    const cautious = stage === 'EARLY_TESTING' || stage === 'EARLY_GROWTH';
    if (!cautious || videos.length >= config.highConfidenceSample) issues.push(issueBase('HIT_DEPENDENCE', '频道流量过度依赖少数视频', `Top 1 视频占样本总播放 ${metrics.top1ViewShare}%，Top 3 占 ${metrics.top3ViewShare}%。`, '总播放看起来健康，但常态视频缺少稳定支撑。', confidence, 'HIGH', [{ metric: 'top3ViewShare', currentValue: metrics.top3ViewShare, baselineValue: config.hitTop3Share * 100, window: '全部样本', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '围绕 Top 3 做相邻验证', detail: '分别复制高表现视频的主题、形式和受众意图，不直接复制标题。', metricToWatch: '未来 3 条视频 P25 播放', window: '未来 3 条视频' }));
  }
  if (metrics.longestUploadGapDays !== null && metrics.longestUploadGapDays >= config.uploadGapWatchDays) {
    const severity = metrics.longestUploadGapDays >= config.uploadGapHighDays ? 'HIGH' : 'MEDIUM';
    issues.push(issueBase('UPLOAD_IRREGULARITY', '发布节奏存在明显断档', `最长发布间隔为 ${metrics.longestUploadGapDays} 天，中位间隔为 ${metrics.uploadIntervalDays ?? 0} 天。`, '间隔过大使得主题实验难以形成可比较序列。', confidence, severity, [{ metric: 'longestUploadGapDays', currentValue: metrics.longestUploadGapDays, baselineValue: config.uploadGapWatchDays, window: '全部样本', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '设定可持续发布区间', detail: `以历史成功视频的发布节奏为参考，先稳定在每 ${Math.max(3, Math.round(metrics.uploadIntervalDays ?? 7))}–${Math.max(7, Math.round((metrics.uploadIntervalDays ?? 7) * 1.5))} 天 1 条。`, metricToWatch: '发布间隔与单条年龄校正表现', window: '未来 30 天' }));
  }
  const recent = [...videos].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 5);
  const baselinePerDay = metrics.historicalMedian ?? metrics.medianViewsPerDay;
  if (recent.length >= 5 && baselinePerDay > 0 && recent.every(video => viewsPerDay(video, now) <= baselinePerDay * (1 - config.anomalyThreshold))) {
    issues.push(issueBase('RECENT_DISTRIBUTION_ANOMALY', '近期出现连续低分发表现信号', `最近 ${recent.length} 条视频的年龄校正表现均低于历史基线 ${Math.round(config.anomalyThreshold * 100)}% 以上。`, '这是需要复核的分发异常信号，但公开数据无法确认平台级限制。', confidence, 'HIGH', [{ metric: 'recent videos below baseline', currentValue: recent.length, baselineValue: 5, window: '最近 5 条', sampleSize: recent.length, evidenceType: 'FACT' }], { title: '先排除内容与发布时间变化', detail: '对照最近 5 条的主题、格式和发布间隔；不要以此推断限流。', metricToWatch: '下一条 24h 年龄校正播放', window: '下一条视频' }, [{ text: '近期主题或发布时间变化', confidence: 'MEDIUM', supportingEvidence: ['连续低于自身基线'], contradictingEvidence: ['无曝光、CTR、流量来源数据'] }]));
  }
  const dated = [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  const proven = dated.slice(0, Math.max(3, Math.floor(dated.length / 2))).map(video => video.title);
  const recentTitles = dated.slice(-Math.max(3, Math.floor(dated.length / 3))).map(video => video.title);
  const similarity = recentTitles.length && proven.length ? median(recentTitles.map(title => Math.max(...proven.map(item => titleSimilarity(title, item))))) : 1;
  if (similarity < config.topicDriftThreshold && metrics.recentVsBaseline !== null && metrics.recentVsBaseline <= -10) {
    issues.push(issueBase('TOPIC_DRIFT', '近期主题与历史强势模式距离变大', `近期标题与历史样本的词面相似度代理为 ${Math.round(similarity * 100)}%，且近期基线下降 ${Math.abs(metrics.recentVsBaseline)}%。`, '主题漂移本身不是错误，但与表现下降同时出现时应优先验证。', confidence, 'MEDIUM', [{ metric: 'topic similarity proxy', currentValue: round(similarity * 100), baselineValue: round(config.topicDriftThreshold * 100), window: '近期 vs 历史', sampleSize: videos.length, evidenceType: 'INFERENCE' }], { title: '回到历史验证主题做 2 条对照', detail: '下一轮保留 1 条当前实验，避免一次性完全切换方向。', metricToWatch: '对照组与实验组 72h 年龄校正播放', window: '未来 3 条视频' }, [{ text: '近期主题漂移可能削弱内容匹配', confidence: 'MEDIUM', supportingEvidence: ['主题相似度代理下降', '近期基线同步下降'], contradictingEvidence: ['标题词面不能代替语义嵌入或受众数据'] }]));
  }
  if (metrics.breakoutCount > 0) {
    const top = [...videos].sort((a, b) => viewsPerDay(b, now) - viewsPerDay(a, now))[0];
    const followup = videos.filter(video => video.id !== top.id).some(video => titleSimilarity(video.title, top.title) >= .5);
    if (!followup && videos.length >= 7) issues.push(issueBase('BREAKOUT_NO_FOLLOWUP', '出现突破视频后没有形成后续测试', `至少 1 条视频达到历史年龄校正基线的 ${config.breakoutThreshold}×，但后续视频没有相似主题/机制的跟进。`, '频道已有市场验证信号，却没有充分继续测试成功模式。', confidence, 'HIGH', [{ metric: 'breakoutCount', currentValue: metrics.breakoutCount, baselineValue: 1, window: '全部样本', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '优先制作突破相邻内容', detail: '下一条先测试同一受众意图的相邻变体，再决定是否扩展到新主题。', metricToWatch: '突破相邻视频 24h/72h 表现', window: '下一条视频' }));
  }
  if (!issues.length && metrics.recentVsBaseline !== null && metrics.recentVsBaseline <= -10) issues.push(issueBase('WEAK_RECENT_MOMENTUM', '近期增长动能偏弱', `近期年龄校正播放中位数较前一组下降 ${Math.abs(metrics.recentVsBaseline)}%。`, '需要小规模实验确认下降是否持续。', confidence, 'LOW', [{ metric: 'recentVsBaseline', currentValue: metrics.recentVsBaseline, window: 'Recent 10 vs previous 20', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '用 3 条视频做小批量复核', detail: '不要立即改变整个频道方向，先观察同主题与受控实验的差异。', metricToWatch: '滚动中位数', window: '未来 3 条视频' }));
  return issues.sort((a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.priority] - ({ P0: 0, P1: 1, P2: 2, P3: 3 }[b.priority]))).slice(0, config.issueLimit);
}

function stateFor(metrics: DiagnosticMetrics, issues: DiagnosticIssue[], stage: ChannelStage): ChannelState {
  if (stage === 'INSUFFICIENT_DATA') return 'INSUFFICIENT_DATA';
  if (stage === 'DORMANT') return 'DORMANT';
  const codes = new Set(issues.map(issue => issue.issueCode));
  if (codes.has('HIT_DEPENDENCE')) return 'HIT_DEPENDENT';
  if (codes.has('FORMAT_CONFUSION')) return 'FORMAT_CONFUSED';
  if (codes.has('TOPIC_DRIFT')) return 'TOPIC_DRIFT';
  if (codes.has('RECENT_DISTRIBUTION_ANOMALY')) return 'DISTRIBUTION_ANOMALY';
  if (codes.has('BASELINE_DECLINE')) return 'DECLINING';
  if (codes.has('HIGH_VOLATILITY')) return 'VOLATILE';
  if (stage === 'EARLY_TESTING' || stage === 'EARLY_GROWTH') return 'EARLY_EXPLORATION';
  if (stage === 'GROWTH') return 'HEALTHY_GROWTH';
  if (stage === 'STABLE' || stage === 'MATURE') return 'HEALTHY_STABLE';
  return metrics.recentVsBaseline !== null && metrics.recentVsBaseline < 0 ? 'STALLED' : 'HEALTHY_STABLE';
}

function dimensionScore(metrics: DiagnosticMetrics, issues: DiagnosticIssue[], formatCount: number) {
  const momentum = metrics.recentVsBaseline === null ? 50 : clamp((metrics.recentVsBaseline + 100) / 2) * 100;
  const stability = clamp(1 - (metrics.mad / Math.max(1, metrics.medianViews))) * 100;
  const contentFit = issues.some(issue => issue.issueCode === 'TOPIC_DRIFT') ? 35 : 72;
  const publishing = metrics.longestUploadGapDays === null ? 50 : clamp(1 - metrics.longestUploadGapDays / 120) * 100;
  const repeatability = clamp(1 - metrics.top3ViewShare / 150) * 100;
  const formatStructure = formatCount > 1 ? 72 : 90;
  const score = momentum * config.weights.growthMomentum + stability * config.weights.performanceStability + contentFit * config.weights.contentFit + publishing * config.weights.publishingHealth + repeatability * config.weights.repeatability + formatStructure * config.weights.formatStructure;
  return Math.round(clamp(score / 100) * 100);
}

function formatDiagnosis(format: 'SHORTS' | 'LONG_FORM', videos: DiagnosticVideo[], now: number): FormatDiagnosis | undefined {
  if (!videos.length) return undefined;
  const metrics = metricFor(videos, now); const confidence = confidenceFor(videos); const stage = videos.length < config.minSample ? 'INSUFFICIENT_DATA' : 'STABLE';
  const issues = detectIssues(videos, metrics, metrics, confidence, now, stage);
  const creatorBreakout = format === 'LONG_FORM'
    ? buildCreatorBreakoutSummary({ format: 'long', now: new Date(now), videos: videos.map(video => ({ id: video.id, format: 'long' as const, title: video.title, publishedAt: video.publishedAt, views: video.views, durationSeconds: video.durationSeconds })) })
    : undefined;
  return { format, sampleSize: videos.length, state: stateFor(metrics, issues, stage), confidence, metrics, topIssues: issues, ...(creatorBreakout ? { creatorBreakout } : {}) };
}

function trendFor(videos: DiagnosticVideo[], now: number) {
  return [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()).map((video, index, list) => {
    const slice = list.slice(Math.max(0, index - 4), index + 1);
    return { date: video.publishedAt, rollingMedianViews: round(median(slice.map(item => item.views))), ageNormalizedMedian: round(median(slice.map(item => viewsPerDay(item, now)))) };
  });
}

export function buildChannelDiagnosis(input: DiagnosticChannelInput, diagnosedAt = new Date()): ChannelDiagnosis {
  const now = diagnosedAt.getTime();
  const videos = input.videos.filter(video => video && finite(video.views) && Number.isFinite(new Date(video.publishedAt).getTime()));
  const metrics = metricFor(videos, now); const confidence = confidenceFor(videos); const stage = stageFor({ ...input, videos }, metrics, now);
  const shortVideos = videos.filter(video => video.format === 'short'); const longVideos = videos.filter(video => video.format === 'long');
  const shortFormDiagnosis = formatDiagnosis('SHORTS', shortVideos, now); const longFormDiagnosis = formatDiagnosis('LONG_FORM', longVideos, now);
  const issues = detectIssues(videos, metrics, metrics, confidence, now, stage);
  if (shortFormDiagnosis && longFormDiagnosis && Math.max(shortFormDiagnosis.metrics.medianViewsPerDay, longFormDiagnosis.metrics.medianViewsPerDay) >= Math.max(1, Math.min(shortFormDiagnosis.metrics.medianViewsPerDay, longFormDiagnosis.metrics.medianViewsPerDay)) * config.formatImbalanceFactor) {
    const formatIssue = issueBase('FORMAT_CONFUSION', 'Shorts 与长视频表现需要分开判断', '两种内容形态的年龄校正中位表现差异明显。', '混合查看会掩盖其中一种形态的真实问题；公开数据不能证明观众互相蚕食。', confidence, 'MEDIUM', [{ metric: 'format median views/day ratio', currentValue: round(Math.max(shortFormDiagnosis.metrics.medianViewsPerDay, longFormDiagnosis.metrics.medianViewsPerDay) / Math.max(1, Math.min(shortFormDiagnosis.metrics.medianViewsPerDay, longFormDiagnosis.metrics.medianViewsPerDay))), baselineValue: config.formatImbalanceFactor, window: 'Shorts vs long-form', sampleSize: videos.length, evidenceType: 'FACT' }], { title: '分别制定 Shorts 与长视频测试', detail: '不要用一种形态的播放量替另一种形态下结论。', metricToWatch: '各自滚动中位数', window: '未来 3–5 条同形态视频' });
    issues.push(formatIssue);
  }
  const primaryState = stateFor(metrics, issues, stage);
  const secondaryStates = [...new Set([...(longFormDiagnosis ? [longFormDiagnosis.state] : []), ...(shortFormDiagnosis ? [shortFormDiagnosis.state] : [])].filter(state => state !== primaryState))].slice(0, 3);
  const timeValues = videos.map(video => new Date(video.publishedAt).getTime()); const timeSpanDays = timeValues.length ? Math.round((Math.max(...timeValues) - Math.min(...timeValues)) / DAY) : 0;
  const classification = videos.filter(video => video.format !== 'unknown').length / Math.max(1, videos.length);
  const healthScore = videos.length >= config.minSample ? dimensionScore(metrics, issues, Number(Boolean(shortFormDiagnosis)) + Number(Boolean(longFormDiagnosis))) : undefined;
  const breakoutVideos = [...videos].sort((a, b) => viewsPerDay(b, now) - viewsPerDay(a, now)).filter(video => metrics.historicalMedian !== null && viewsPerDay(video, now) >= metrics.historicalMedian * config.breakoutThreshold).slice(0, 5).map(video => ({ videoId: video.id, title: video.title, ratio: round(viewsPerDay(video, now) / Math.max(1, metrics.historicalMedian ?? 1)), followUpFound: videos.some(other => other.id !== video.id && titleSimilarity(other.title, video.title) >= .5) }));
  const actions = issues.map(issue => ({ ...issue.recommendedAction, priority: issue.priority })).slice(0, 3);
  const experiments: DiagnosticExperiment[] = [];
  if (confidence !== 'HIGH' || issues.some(issue => issue.issueCode === 'TOPIC_DRIFT' || issue.issueCode === 'WEAK_RECENT_MOMENTUM')) experiments.push({ hypothesis: '近期表现变化可能与主题漂移或内容匹配变化有关。', plan: ['下一轮 3 条视频中安排 2 条历史强势主题', '安排 1 条当前方向的受控实验', '保持相近时长与发布间隔'], observe: ['24h/72h 年龄校正播放', '对照组与实验组滚动中位数', '主题与格式分类置信度'], decisionRule: '若历史强势主题在 72h 明显高于实验主题，提高主题漂移诊断置信度；否则保留低置信度。', confidence });
  const summaryState = primaryState === 'HEALTHY_GROWTH' ? '频道整体仍在增长' : primaryState === 'HEALTHY_STABLE' ? '频道整体保持稳定' : primaryState === 'INSUFFICIENT_DATA' ? '当前样本不足以生成稳定结论' : `频道当前状态为 ${primaryState}`;
  return {
    channelId: input.channelId,
    diagnosedAt: diagnosedAt.toISOString(),
    diagnosisVersion: config.version,
    algorithmVersion: config.version,
    channelStage: stage,
    primaryState,
    secondaryStates,
    healthScore,
    confidence,
    dataQuality: { sampleSize: videos.length, timeSpanDays, completeness: round(videos.length / Math.max(videos.length, input.videoCount || videos.length) * 100), classificationConfidence: round(classification * 100), notes: videos.length < config.minSample ? ['样本数低于稳定诊断门槛'] : ['公开模式不包含 CTR、留存、曝光或流量来源'] },
    summary: { headline: summaryState, detail: issues.length ? issues[0].fact : '当前公开样本未发现需要优先处理的频道级异常。' },
    topIssues: issues.sort((a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.priority] - ({ P0: 0, P1: 1, P2: 2, P3: 3 }[b.priority]))).slice(0, config.issueLimit),
    overallMetrics: metrics,
    longFormDiagnosis,
    shortFormDiagnosis,
    performanceTrend: trendFor(videos, now),
    breakoutVideos,
    actions,
    experiments,
  };
}

export function channelDoctorReportToInput(report: { channel: { id: string; title: string; subscriberCount?: number; videoCount?: number; createdAt?: string }; videos: Array<{ id: string; title: string; publishedAt: string; views: number; durationSeconds: number; format: 'short' | 'long' | 'unknown'; formatConfidence?: 'high' | 'medium' | 'low' }> }): DiagnosticChannelInput {
  return { channelId: report.channel.id, channelTitle: report.channel.title, subscriberCount: report.channel.subscriberCount, videoCount: report.channel.videoCount, createdAt: report.channel.createdAt, videos: report.videos };
}

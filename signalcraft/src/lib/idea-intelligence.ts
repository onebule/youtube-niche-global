/**
 * P3 Phase 1 — Case → Pattern → Idea Intelligence.
 *
 * This is a deterministic, Long-form-only idea evidence layer. It consumes
 * the canonical P1/P2 contracts and never generates scripts, hooks, titles,
 * thumbnails or Canvas prompts. Public metadata is treated as evidence; any
 * semantic similarity that would require embeddings remains unavailable.
 */
import type { ConfidenceLevel, EntryDecisionStatus } from './entry-decision.ts';
import type { OpportunityAssessment } from './opportunity-engine.ts';
import type {
  ContentPattern,
  ContentPatternReport,
  PatternAggregation,
  PatternConfidence,
} from './content-patterns.ts';
import type {
  ContentPatternTrendReport,
  NichePatternFit,
  PatternTrendAssessment,
  PatternTrendState,
} from './content-pattern-trends.ts';
import type { ContentStrategy, StrategyPatternRole, StrategyPatternSelection } from './content-strategy.ts';
import type { ExperimentValidationReport, PatternValidationState } from './experiment-validation.ts';

export const IDEA_INTELLIGENCE_ALGORITHM_VERSION = 'case-pattern-idea-v1';

/** All v1 thresholds are provisional and must be calibrated against labelled outcomes. */
export const IDEA_INTELLIGENCE_CONFIG = Object.freeze({
  maxIdeas: 7,
  minSourceCases: 1,
  minHighConfidenceCreators: 2,
  tooSimilarSurface: 0.72,
  duplicateSurface: 0.78,
  acceptableVariationSurface: 0.42,
  minDiversityTokens: 2,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type IdeaNoveltyState = 'NOVEL' | 'ACCEPTABLE_VARIATION' | 'TOO_SIMILAR' | 'DUPLICATE' | 'INSUFFICIENT';
export type IdeaValidationReadiness = 'READY' | 'READY_WITH_CAUTION' | 'RESEARCH_ONLY' | 'BLOCKED' | 'INSUFFICIENT';
export type IdeaCandidateState = 'ACTIVE' | 'RESEARCH_ONLY';
export type IdeaEvidenceKind = 'FACT' | 'INFERENCE' | 'LOW_CONFIDENCE';
export type IdeaInputAvailability = 'AVAILABLE' | 'DERIVABLE' | 'PARTIAL' | 'REQUIRES_LLM' | 'REQUIRES_EMBEDDING' | 'REQUIRES_NEW_DATA' | 'UNAVAILABLE';

export type IdeaCaseRole = 'REPRESENTATIVE_CASE' | 'BREAKOUT_CASE' | 'CROSS_CREATOR_CASE';

export type IdeaCaseEvidence = {
  caseId: string;
  videoId: string;
  title: string;
  topic: string | null;
  creatorId: string | null;
  sourceUrl: string | null;
  role: IdeaCaseRole;
  quality: ConfidenceLevel;
  patternIds: string[];
  views: number | null;
  durationSeconds: number | null;
};

export type IdeaConcept = {
  workingLabel: string;
  coreQuestion: string;
  subject: string;
  angle: string;
  contentMechanism: string;
  audiencePromise: string;
  patternReference: string;
  differentiation: string;
  rationale: string;
};

export type IdeaSimilarityDimensions = {
  titleStructureSimilarity: number | null;
  topicSimilarity: number | null;
  entityOverlap: number | null;
  patternOverlap: number | null;
  semanticSimilarity: number | null;
  mechanismOverlap: number | null;
  surfaceSimilarity: number | null;
};

export type IdeaNoveltyAssessment = {
  state: IdeaNoveltyState;
  confidence: ConfidenceLevel;
  closestCaseId: string | null;
  closestSiblingIdeaId: string | null;
  dimensions: IdeaSimilarityDimensions;
  evidence: string[];
  blockers: string[];
  calibrationStatus: typeof IDEA_INTELLIGENCE_CONFIG.calibrationStatus;
};

export type IdeaFitAssessment = {
  status: 'ALIGNED' | 'CONSTRAINED' | 'RESEARCH_ONLY' | 'BLOCKED';
  strategyRole: StrategyPatternRole;
  opportunityDecision: EntryDecisionStatus | 'UNKNOWN';
  patternStatus: string;
  trendState: PatternTrendState;
  nicheFit: string;
  validationState: PatternValidationState | 'NOT_AVAILABLE';
  evidenceRefs: string[];
};

export type IdeaEvidence = { kind: IdeaEvidenceKind; code: string; message: string; refs: string[] };
export type IdeaReason = { code: string; message: string; refs: string[] };
export type IdeaRisk = { code: string; message: string; refs: string[] };
export type IdeaBlocker = { code: string; message: string; refs: string[] };

export type IdeaProvenance = {
  source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM';
  nicheId: string;
  opportunityAlgorithmVersion: string | null;
  entryDecision: EntryDecisionStatus | 'UNKNOWN';
  entryWindow: string | null;
  strategyVersion: string | null;
  strategyRole: StrategyPatternRole;
  patternIds: string[];
  patternVersions: string[];
  patternTrend: PatternTrendState;
  nichePatternFit: string;
  patternValidation: PatternValidationState | 'NOT_AVAILABLE';
  strategyValidation: string;
  sourceCaseIds: string[];
  sourceVideoIds: string[];
  generationMethod: 'DETERMINISTIC_STRUCTURED_TRANSFORMATION';
  noveltyAssessment: IdeaNoveltyState;
  confidence: ConfidenceLevel;
  algorithmVersion: typeof IDEA_INTELLIGENCE_ALGORITHM_VERSION;
  capturedAt: string | null;
  snapshotId: string | null;
};

export type IdeaCandidate = {
  ideaId: string;
  state: IdeaCandidateState;
  nicheId: string;
  patternIds: string[];
  sourceCaseIds: string[];
  strategyRole: StrategyPatternRole;
  concept: IdeaConcept;
  novelty: IdeaNoveltyAssessment;
  fit: IdeaFitAssessment;
  confidence: ConfidenceLevel;
  evidence: IdeaEvidence[];
  reasons: IdeaReason[];
  risks: IdeaRisk[];
  blockers: IdeaBlocker[];
  validationReadiness: IdeaValidationReadiness;
  provenance: IdeaProvenance;
  algorithmVersion: typeof IDEA_INTELLIGENCE_ALGORITHM_VERSION;
};

export type IdeaIntelligenceReport = {
  schemaVersion: 'idea-intelligence.v1';
  algorithmVersion: typeof IDEA_INTELLIGENCE_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  nicheId: string;
  dataAvailability: Record<string, { status: IdeaInputAvailability; note: string }>;
  cases: IdeaCaseEvidence[];
  candidates: IdeaCandidate[];
  blockedCandidates: IdeaCandidate[];
  diversity: { selected: number; distinctPatterns: number; distinctTopics: number; notes: string[] };
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof IDEA_INTELLIGENCE_CONFIG.calibrationStatus };
};

export type IdeaRepresentativeVideo = {
  videoId: string;
  title: string;
  titleZh?: string | null;
  topic?: string | null;
  channelTitle: string | null;
  thumbnail?: string | null;
  views: number | null;
  durationSeconds: number | null;
  sourceUrl: string | null;
  breakoutScore?: number | null;
};

export type IdeaIntelligenceInput = {
  nicheId: string;
  topic?: string | null;
  mechanism?: string | null;
  productionType?: string | null;
  opportunityAssessment?: OpportunityAssessment | null;
  contentPatterns?: ContentPatternReport | null;
  contentPatternTrend?: ContentPatternTrendReport | null;
  contentStrategy?: ContentStrategy | null;
  experimentValidation?: ExperimentValidationReport | null;
  representativeVideos?: readonly IdeaRepresentativeVideo[];
  cases?: readonly IdeaCaseEvidence[];
  capturedAt?: string | null;
  snapshotId?: string | null;
};

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const trendRank: Record<PatternTrendState, number> = { ACCELERATING: 4, GROWING: 3, STABLE: 2, DILUTING: 1, DECLINING: 0, INSUFFICIENT: -1 };
const fitRank: Record<string, number> = { TOP_FIT: 4, STRONG_FIT: 3, MODERATE_FIT: 2, WEAK_FIT: 1, INSUFFICIENT: 0 };
const roleRank: Record<StrategyPatternRole, number> = { PRIMARY: 4, TEST: 3, WATCH: 2, DEPRIORITIZE: 1, AVOID: 0, INSUFFICIENT: -1 };

const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const safeText = (value: string | null | undefined, fallback: string) => clean(value) || fallback;
const lower = (value: string) => value.toLocaleLowerCase();

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function tokens(value: string) {
  const stop = new Set(['the', 'and', 'with', 'this', 'that', 'from', 'for', 'how', 'why', 'what', 'your', 'you', 'into', '的', '了', '是', '与', '和', '及', '中', '在']);
  return new Set((lower(value).match(/[a-z0-9\u4e00-\u9fff]{2,}/g) || []).filter(item => !stop.has(item)));
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (!a.size && !b.size) return 0;
  let intersection = 0;
  a.forEach(item => { if (b.has(item)) intersection += 1; });
  return intersection / (a.size + b.size - intersection || 1);
}

function qualityFor(video: IdeaRepresentativeVideo): ConfidenceLevel {
  const title = clean(video.title);
  const creator = clean(video.channelTitle);
  if (title && creator && (video.views !== null || video.durationSeconds !== null)) return 'HIGH';
  if (title || creator) return 'MEDIUM';
  return 'LOW';
}

function casesFromInput(input: IdeaIntelligenceInput, patternReport: ContentPatternReport | null): IdeaCaseEvidence[] {
  if (input.cases?.length) {
    return input.cases.map(item => ({ ...item, caseId: clean(item.caseId) || `case:${clean(item.videoId)}`, patternIds: uniq(item.patternIds), title: safeText(item.title, 'Untitled public video') }));
  }
  const videos = input.representativeVideos || [];
  const candidatesByVideo = new Map<string, string[]>();
  (patternReport?.candidates || []).forEach(candidate => candidatesByVideo.set(candidate.sourceVideoId, uniq([...(candidatesByVideo.get(candidate.sourceVideoId) || []), candidate.pattern.patternId])));
  const seen = new Set<string>();
  return videos.flatMap(video => {
    const videoId = clean(video.videoId);
    if (!videoId || seen.has(videoId)) return [];
    seen.add(videoId);
    return [{
      caseId: `case:${videoId}`,
      videoId,
      title: safeText(video.titleZh || video.title, 'Untitled public video'),
      topic: clean(video.topic) || null,
      creatorId: clean(video.channelTitle) || null,
      sourceUrl: clean(video.sourceUrl) || null,
      role: video.breakoutScore !== null && video.breakoutScore !== undefined ? 'BREAKOUT_CASE' as const : 'REPRESENTATIVE_CASE' as const,
      quality: qualityFor(video),
      patternIds: candidatesByVideo.get(videoId) || [],
      views: typeof video.views === 'number' && Number.isFinite(video.views) ? video.views : null,
      durationSeconds: typeof video.durationSeconds === 'number' && Number.isFinite(video.durationSeconds) ? video.durationSeconds : null,
    }];
  });
}

function findAggregation(report: ContentPatternReport | null, patternId: string): PatternAggregation | null {
  return report?.aggregations.find(item => item.pattern.patternId === patternId) || null;
}
function findTrend(report: ContentPatternTrendReport | null, patternId: string): PatternTrendAssessment | null {
  return report?.assessments.find(item => item.pattern.patternId === patternId) || null;
}
function findFit(report: ContentPatternTrendReport | null, patternId: string): NichePatternFit | null {
  return report?.nicheFits.find(item => item.pattern.patternId === patternId) || null;
}
function findSelection(strategy: ContentStrategy | null, patternId: string): StrategyPatternSelection | null {
  return [...(strategy?.primaryPatterns || []), ...(strategy?.testPatterns || []), ...(strategy?.watchPatterns || []), ...(strategy?.deprioritizedPatterns || []), ...(strategy?.avoidedPatterns || []), ...(strategy?.insufficientPatterns || [])].find(item => item.patternId === patternId) || null;
}
function findValidation(validation: ExperimentValidationReport | null, patternId: string): PatternValidationState | 'NOT_AVAILABLE' {
  return validation?.patternValidation.find(item => item.patternId === patternId)?.state || 'NOT_AVAILABLE';
}

function patternMechanism(pattern: ContentPattern, fallback: string) {
  const value = pattern.featureValue;
  if (value === 'HOW_TO') return '把一个可执行过程拆成清晰步骤，并在结果处完成验证。';
  if (value === 'QUESTION') return '围绕一个明确问题展开解释，用证据逐步消除误解。';
  if (value === 'LIST_OR_NUMBER') return '用有限数量的判断点组织信息，让观众快速完成筛选。';
  if (value === 'COMPARISON') return '把两种路径放在同一标准下比较，突出取舍而不是只给结论。';
  if (value === 'STORY') return '沿着真实过程推进，在关键转折处解释为什么结果发生。';
  if (pattern.taxonomy === 'DURATION_BAND') return '用稳定时长承载完整上下文，避免只展示结论。';
  return fallback || '用清晰的公开证据回答一个具体问题。';
}

function buildConcept(input: { topic: string; mechanism: string; productionType: string; pattern: ContentPattern; sources: IdeaCaseEvidence[] }): IdeaConcept {
  const patternLabel = input.pattern.label || input.pattern.featureValue;
  const subject = input.topic === '未分类方向' ? '目标赛道中的一个具体问题' : input.topic;
  const contentMechanism = patternMechanism(input.pattern, input.mechanism);
  const coreQuestion = input.pattern.featureValue === 'HOW_TO'
    ? `如何在${subject}中完成一个可验证的过程？`
    : input.pattern.featureValue === 'COMPARISON'
      ? `${subject}里的两种常见路径，真正差异在哪里？`
      : `关于${subject}，观众最需要先验证的关键问题是什么？`;
  const angle = input.productionType && input.productionType !== '待识别形式'
    ? `以${input.productionType}承载${subject}，把${patternLabel}的结构改写成新的场景。`
    : `把${patternLabel}的结构迁移到${subject}，替换案例中的人物、场景与例子。`;
  const sourceNames = input.sources.slice(0, 2).map(item => item.title).join('、');
  return {
    workingLabel: `${subject} · ${patternLabel}研究方向`,
    coreQuestion,
    subject,
    angle,
    contentMechanism,
    audiencePromise: `帮助想了解${subject}的观众，在一次完整观看中得到可复核的判断依据。`,
    patternReference: `${patternLabel}（${input.pattern.patternId}）`,
    differentiation: `保留“${contentMechanism}”这一结构机制，但不复用${sourceNames || '来源案例'}的具体人物、例子、场景或结局。`,
    rationale: `该方向来自${patternLabel}的公开模式证据，并与当前赛道策略保持一致；它是可测试的概念，不是成功保证。`,
  };
}

function compareToCase(concept: IdeaConcept, pattern: ContentPattern, source: IdeaCaseEvidence): IdeaSimilarityDimensions {
  const ideaTitle = tokens(`${concept.workingLabel} ${concept.coreQuestion} ${concept.angle}`);
  const caseTitle = tokens(source.title);
  const ideaTopic = tokens(`${concept.subject} ${concept.coreQuestion}`);
  const caseTopic = tokens(source.topic || source.title);
  const title = jaccard(tokens(concept.workingLabel), caseTitle);
  const topic = jaccard(ideaTopic, caseTopic);
  const entity = jaccard(tokens(concept.subject), tokens(source.title));
  const surface = Math.min(1, title * 0.45 + topic * 0.35 + entity * 0.2);
  return { titleStructureSimilarity: title, topicSimilarity: topic, entityOverlap: entity, patternOverlap: 1, semanticSimilarity: null, mechanismOverlap: 1, surfaceSimilarity: surface };
}

function sameTopicSurface(concept: IdeaConcept, source: IdeaCaseEvidence) {
  const subject = lower(clean(concept.subject));
  const topic = lower(clean(source.topic));
  return Boolean(subject && topic && (subject === topic || subject.includes(topic) || topic.includes(subject)));
}

function compareIdeas(a: IdeaCandidate, b: IdeaCandidate): number {
  const left = tokens(`${a.concept.workingLabel} ${a.concept.coreQuestion} ${a.concept.subject}`);
  const right = tokens(`${b.concept.workingLabel} ${b.concept.coreQuestion} ${b.concept.subject}`);
  return jaccard(left, right);
}

function availability(input: IdeaIntelligenceInput, cases: IdeaCaseEvidence[]): Record<string, { status: IdeaInputAvailability; note: string }> {
  return {
    caseId: { status: cases.length ? 'AVAILABLE' : 'UNAVAILABLE', note: '来源案例使用稳定的 case:<videoId> 身份。' },
    videoId: { status: cases.length ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用代表视频的公开视频 ID。' },
    title: { status: cases.some(item => item.title !== 'Untitled public video') ? 'AVAILABLE' : 'PARTIAL', note: '来源案例标题来自公开视频元数据。' },
    description: { status: 'UNAVAILABLE', note: '当前代表案例契约未提供描述文本。' },
    niche: { status: input.nicheId && input.nicheId !== 'unknown-niche' ? 'AVAILABLE' : 'PARTIAL', note: '赛道身份来自机会评估上下文或方向 key。' },
    patternId: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用现有稳定 Pattern ID。' },
    patternType: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: 'Pattern taxonomy 来自 P2 Phase 1。' },
    patternNormalizedValue: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: 'Pattern featureValue 来自 P2 Phase 1。' },
    patternSourceCases: { status: cases.length ? 'DERIVABLE' : 'UNAVAILABLE', note: '通过 Pattern candidate 与来源案例关联。' },
    patternPerformance: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用 P2 Phase 1 的规范化表现字段。' },
    strategy: { status: input.contentStrategy ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用 P2 Phase 3 策略角色。' },
    strategyRole: { status: input.contentStrategy ? 'AVAILABLE' : 'UNAVAILABLE', note: '策略角色来自 P2 Phase 3，不在 Idea 层重算。' },
    strategyPositioning: { status: input.contentStrategy ? 'AVAILABLE' : 'UNAVAILABLE', note: '策略定位来自 P2 Phase 3。' },
    pattern: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用 P2 Phase 1 Pattern ID 与证据。' },
    patternTrend: { status: input.contentPatternTrend ? 'AVAILABLE' : 'PARTIAL', note: '没有可比较历史时趋势保持 INSUFFICIENT。' },
    nichePatternFit: { status: input.contentPatternTrend?.nicheFits.length ? 'AVAILABLE' : 'PARTIAL', note: '赛道适配来自 P2 Phase 2。' },
    patternRepeatability: { status: input.contentPatterns ? 'AVAILABLE' : 'UNAVAILABLE', note: '复用 Pattern 的跨视频/跨创作者重复性。' },
    patternValidation: { status: input.experimentValidation?.patternValidation.length ? 'AVAILABLE' : 'PARTIAL', note: '复用 P2 Phase 4 Pattern validation。' },
    validation: { status: input.experimentValidation?.observations.length ? 'AVAILABLE' : 'PARTIAL', note: '无真实观察时不把验证当作正向证据。' },
    sourceCases: { status: cases.length ? 'AVAILABLE' : 'UNAVAILABLE', note: cases.length ? '来自代表视频的公开元数据。' : '没有可追溯的来源案例。' },
    embeddings: { status: 'REQUIRES_EMBEDDING', note: 'v1 不伪造语义向量，使用可审计词面代理。' },
    semanticEmbeddings: { status: 'REQUIRES_EMBEDDING', note: '没有真实 embedding，不计算语义相似度。' },
    transcript: { status: 'UNAVAILABLE', note: '未接入字幕、转录或 Hook 数据。' },
    hook: { status: 'UNAVAILABLE', note: '未接入 Hook/转录数据。' },
    thumbnailUnderstanding: { status: 'UNAVAILABLE', note: '没有视觉理解证据。' },
    existingTopicTaxonomy: { status: input.topic ? 'PARTIAL' : 'UNAVAILABLE', note: '使用机会主题字段，不冒充完整语义分类。' },
    privateAnalytics: { status: 'UNAVAILABLE', note: 'CTR、留存、AVD、RPM、收入等私有指标不可用。' },
    savedIdeaCorpus: { status: 'UNAVAILABLE', note: '当前仓库没有持久化 Idea corpus；仅去重本次组合。' },
  };
}

function candidateConfidence(input: { strategy: ContentStrategy | null; selection: StrategyPatternSelection; fit: NichePatternFit | null; trend: PatternTrendAssessment | null; cases: IdeaCaseEvidence[]; novelty: IdeaNoveltyAssessment; validation: PatternValidationState | 'NOT_AVAILABLE'; state: IdeaCandidateState }): ConfidenceLevel {
  const values: ConfidenceLevel[] = [input.strategy?.confidence || 'LOW', input.selection.trendConfidence, input.fit?.confidence || 'LOW', input.novelty.confidence];
  const creatorCount = new Set(input.cases.map(item => item.creatorId).filter(Boolean)).size;
  if (creatorCount < IDEA_INTELLIGENCE_CONFIG.minHighConfidenceCreators) values.push('MEDIUM');
  if (input.validation === 'CONTRADICTED') values.push('LOW');
  if (input.state === 'RESEARCH_ONLY') values.push('LOW');
  const lowest = values.reduce((current, value) => rank[value] < rank[current] ? value : current, 'HIGH' as ConfidenceLevel);
  if (lowest === 'HIGH' && creatorCount < IDEA_INTELLIGENCE_CONFIG.minHighConfidenceCreators) return 'MEDIUM';
  return lowest;
}

function roleEligible(role: StrategyPatternRole, opportunity: EntryDecisionStatus | 'UNKNOWN', trend: PatternTrendState, fit: string, validation: PatternValidationState | 'NOT_AVAILABLE') {
  if (role === 'AVOID' || role === 'DEPRIORITIZE' || role === 'INSUFFICIENT') return { state: 'BLOCKED' as const, reason: '策略角色不允许主动生成 Idea。' };
  if (validation === 'CONTRADICTED') return { state: 'BLOCKED' as const, reason: 'P2 Phase 4 已对该 Pattern 给出矛盾验证反馈。' };
  if (opportunity === 'AVOID') return { state: 'BLOCKED' as const, reason: '上游 EntryDecision 为 AVOID，Idea 层不能覆盖机会门控。' };
  if (trend === 'INSUFFICIENT' || fit === 'INSUFFICIENT') return { state: 'RESEARCH_ONLY' as const, reason: '趋势或赛道适配证据不足，只保留研究用途。' };
  if (trend === 'DECLINING') return { state: 'RESEARCH_ONLY' as const, reason: 'Pattern 正在回落，不作为当前主动进入建议。' };
  if (trend === 'DILUTING') return { state: 'RESEARCH_ONLY' as const, reason: '采用量扩散但表现走弱，附稀释风险。' };
  if (fit === 'WEAK_FIT') return { state: 'RESEARCH_ONLY' as const, reason: '当前赛道适配偏弱，只保留研究用途。' };
  if (opportunity === 'INSUFFICIENT' || opportunity === 'CAUTION') return { state: 'RESEARCH_ONLY' as const, reason: '机会门控要求保守验证，不输出主动进入承诺。' };
  if (role === 'WATCH') return { state: 'RESEARCH_ONLY' as const, reason: 'WATCH 只进入研究池，不与 PRIMARY/TEST 等权。' };
  return { state: 'ACTIVE' as const, reason: role === 'TEST' ? 'TEST Pattern 进入受控实验 Idea。' : 'PRIMARY Pattern 通过主动 Idea 门控。' };
}

function validationReadiness(state: IdeaCandidateState, confidence: ConfidenceLevel, blockers: IdeaBlocker[], novelty: IdeaNoveltyState): IdeaValidationReadiness {
  if (blockers.length || novelty === 'TOO_SIMILAR' || novelty === 'DUPLICATE') return 'BLOCKED';
  if (state === 'RESEARCH_ONLY') return confidence === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'RESEARCH_ONLY';
  if (confidence === 'HIGH' && novelty === 'NOVEL') return 'READY';
  return 'READY_WITH_CAUTION';
}

function buildCandidate(input: { nicheId: string; topic: string; mechanism: string; productionType: string; pattern: ContentPattern; selection: StrategyPatternSelection; aggregation: PatternAggregation | null; trend: PatternTrendAssessment | null; fit: NichePatternFit | null; strategy: ContentStrategy | null; opportunity: OpportunityAssessment | null; validation: PatternValidationState | 'NOT_AVAILABLE'; experimentValidation: ExperimentValidationReport | null; cases: IdeaCaseEvidence[]; capturedAt: string | null; snapshotId: string | null }): IdeaCandidate {
  const gate = roleEligible(input.selection.role, input.opportunity?.decision.status || 'UNKNOWN', input.trend?.state || input.selection.trendState || 'INSUFFICIENT', input.fit?.status || input.selection.fitStatus || 'INSUFFICIENT', input.validation);
  const concept = buildConcept({ topic: input.topic, mechanism: input.mechanism, productionType: input.productionType, pattern: input.pattern, sources: input.cases });
  const comparisons = input.cases.map(source => ({ source, dimensions: compareToCase(concept, input.pattern, source) }));
  const closest = comparisons.sort((a, b) => (b.dimensions.surfaceSimilarity || 0) - (a.dimensions.surfaceSimilarity || 0))[0];
  const surface = closest?.dimensions.surfaceSimilarity ?? null;
  const tooSimilar = surface !== null && (surface >= IDEA_INTELLIGENCE_CONFIG.tooSimilarSurface || ((closest?.dimensions.topicSimilarity || 0) >= 0.85 && (closest?.dimensions.titleStructureSimilarity || 0) >= 0.2) || Boolean(closest && sameTopicSurface(concept, closest.source) && (closest.dimensions.titleStructureSimilarity || 0) >= 0.2));
  const noveltyState: IdeaNoveltyState = !input.cases.length ? 'INSUFFICIENT' : tooSimilar ? 'TOO_SIMILAR' : surface !== null && surface >= IDEA_INTELLIGENCE_CONFIG.acceptableVariationSurface ? 'ACCEPTABLE_VARIATION' : 'NOVEL';
  const creatorCount = new Set(input.cases.map(item => item.creatorId).filter(Boolean)).size;
  const noveltyConfidence: ConfidenceLevel = !input.cases.length ? 'INSUFFICIENT' : creatorCount >= IDEA_INTELLIGENCE_CONFIG.minHighConfidenceCreators && input.cases.every(item => item.quality === 'HIGH') ? 'HIGH' : input.cases.some(item => item.quality === 'HIGH') ? 'MEDIUM' : 'LOW';
  const novelty: IdeaNoveltyAssessment = { state: noveltyState, confidence: noveltyConfidence, closestCaseId: closest?.source.caseId || null, closestSiblingIdeaId: null, dimensions: closest?.dimensions || { titleStructureSimilarity: null, topicSimilarity: null, entityOverlap: null, patternOverlap: null, semanticSimilarity: null, mechanismOverlap: null, surfaceSimilarity: null }, evidence: input.cases.length ? ['使用来源案例标题/主题的可审计词面代理；Pattern 重叠本身不视为复制。'] : [], blockers: input.cases.length ? [] : ['NO_SOURCE_CASES'], calibrationStatus: IDEA_INTELLIGENCE_CONFIG.calibrationStatus };
  const blockers: IdeaBlocker[] = [];
  const risks: IdeaRisk[] = [];
  if (gate.state === 'BLOCKED') blockers.push({ code: input.selection.role === 'AVOID' ? 'PATTERN_AVOIDED_BY_STRATEGY' : input.opportunity?.decision.status === 'AVOID' ? 'ENTRY_DECISION_AVOID' : input.validation === 'CONTRADICTED' ? 'CONTRADICTED_PATTERN_VALIDATION' : 'IDEA_GATE_BLOCKED', message: gate.reason, refs: ['contentStrategy', 'opportunityAssessment', 'experimentValidation'] });
  if (!input.cases.length) blockers.push({ code: 'NO_SOURCE_CASES', message: '没有可追溯的来源案例，无法完成 Case → Pattern → Idea 证据链。', refs: ['cases'] });
  if (noveltyState === 'TOO_SIMILAR') blockers.push({ code: 'TOO_SIMILAR_TO_SOURCE_CASE', message: '候选概念与来源案例的主题/表面表达过近，已阻止主动 Idea。', refs: [closest?.source.caseId || 'novelty'] });
  if (input.trend?.state === 'DILUTING') risks.push({ code: 'PATTERN_DILUTION', message: '采用量扩散但表现或突破率走弱。', refs: [`pattern:${input.pattern.patternId}`] });
  if (input.trend?.state === 'DECLINING') risks.push({ code: 'PATTERN_DECLINING', message: 'Pattern 当前趋势回落。', refs: [`trend:${input.pattern.patternId}`] });
  if ((input.fit?.status || input.selection.fitStatus) === 'WEAK_FIT') risks.push({ code: 'LOW_NICHE_FIT', message: 'Pattern 与当前赛道的适配较弱。', refs: [`fit:${input.pattern.patternId}`] });
  if (input.cases.length < IDEA_INTELLIGENCE_CONFIG.minHighConfidenceCreators) risks.push({ code: 'LOW_CASE_DIVERSITY', message: '来源案例或独立创作者不足，高置信度被封顶。', refs: ['cases'] });
  if (new Set(input.cases.map(item => item.creatorId).filter(Boolean)).size < IDEA_INTELLIGENCE_CONFIG.minHighConfidenceCreators) risks.push({ code: 'ONE_CREATOR_DOMINANCE', message: '当前案例主要来自一个或少数创作者。', refs: ['cases.creatorId'] });
  if (input.validation === 'NOT_AVAILABLE') risks.push({ code: 'VALIDATION_NOT_AVAILABLE', message: '尚无真实实验观察，不能把验证反馈当作正向证据。', refs: ['experimentValidation.observations'] });
  if (input.cases.some(item => item.quality === 'LOW')) risks.push({ code: 'LOW_DATA_QUALITY', message: '部分来源案例公开元数据不完整。', refs: ['cases.quality'] });
  const state = gate.state === 'BLOCKED' || noveltyState === 'TOO_SIMILAR' ? 'RESEARCH_ONLY' : gate.state;
  const confidence = candidateConfidence({ strategy: input.strategy, selection: input.selection, fit: input.fit, trend: input.trend, cases: input.cases, novelty, validation: input.validation, state });
  const evidence: IdeaEvidence[] = [
    { kind: 'FACT', code: 'PATTERN_LINEAGE', message: `继承 Pattern ${input.pattern.patternId}（${input.pattern.label}）。`, refs: [`pattern:${input.pattern.patternId}`] },
    { kind: 'FACT', code: 'STRATEGY_ROLE', message: `当前策略角色为 ${input.selection.role}。`, refs: [`strategy:${input.selection.role}`] },
    { kind: 'FACT', code: 'SOURCE_CASES', message: `来自 ${input.cases.length} 个来源案例、${new Set(input.cases.map(item => item.creatorId).filter(Boolean)).size} 个可识别创作者。`, refs: input.cases.map(item => item.caseId) },
  ];
  if (input.trend) evidence.push({ kind: 'FACT', code: 'PATTERN_TREND', message: `Pattern Trend 为 ${input.trend.state}。`, refs: [`trend:${input.pattern.patternId}`] });
  if (input.fit) evidence.push({ kind: 'FACT', code: 'NICHE_PATTERN_FIT', message: `赛道适配为 ${input.fit.status}。`, refs: [`fit:${input.pattern.patternId}`] });
  if (input.validation !== 'NOT_AVAILABLE') evidence.push({ kind: 'FACT', code: 'VALIDATION_FEEDBACK', message: `P2 Phase 4 验证状态为 ${input.validation}。`, refs: [`validation:${input.pattern.patternId}`] });
  evidence.push({ kind: 'INFERENCE', code: 'WHY_THIS_IDEA', message: concept.rationale, refs: ['concept.rationale'] });
  if (novelty.dimensions.semanticSimilarity === null) evidence.push({ kind: 'LOW_CONFIDENCE', code: 'LEXICAL_SIMILARITY_ONLY', message: '未接入 embeddings；新颖性仅使用确定性的标题/主题词面代理，需校准。', refs: ['novelty.dimensions'] });
  const patternVersion = input.aggregation?.provenance.algorithmVersion || 'content-patterns-v1';
  const opportunityVersion = input.opportunity?.algorithmVersion || null;
  const ideaId = `idea-v1:${stableHash([input.nicheId, input.pattern.patternId, concept.subject, concept.angle, input.selection.role].map(lower).join('|'))}`;
  const fitStatus = input.fit?.status || input.selection.fitStatus || 'INSUFFICIENT';
  const trendState = input.trend?.state || input.selection.trendState || 'INSUFFICIENT';
  return {
    ideaId, state, nicheId: input.nicheId, patternIds: [input.pattern.patternId], sourceCaseIds: input.cases.map(item => item.caseId), strategyRole: input.selection.role, concept, novelty, fit: { status: gate.state === 'BLOCKED' ? 'BLOCKED' : state === 'RESEARCH_ONLY' ? 'RESEARCH_ONLY' : 'ALIGNED', strategyRole: input.selection.role, opportunityDecision: input.opportunity?.decision.status || 'UNKNOWN', patternStatus: input.aggregation?.winningPattern.status || input.selection.patternStatus, trendState, nicheFit: fitStatus, validationState: input.validation, evidenceRefs: [`pattern:${input.pattern.patternId}`, `strategy:${input.selection.role}`] }, confidence, evidence, reasons: [{ code: gate.state === 'ACTIVE' ? 'EVIDENCE_BACKED_TRANSFORMATION' : 'CONSERVATIVE_RESEARCH_ONLY', message: gate.reason, refs: ['contentStrategy', 'opportunityAssessment'] }], risks, blockers, validationReadiness: validationReadiness(state, confidence, blockers, noveltyState), provenance: { source: opportunityVersion ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', nicheId: input.nicheId, opportunityAlgorithmVersion: opportunityVersion, entryDecision: input.opportunity?.decision.status || 'UNKNOWN', entryWindow: input.opportunity?.entryWindow || null, strategyVersion: input.strategy?.strategyVersion || null, strategyRole: input.selection.role, patternIds: [input.pattern.patternId], patternVersions: [patternVersion], patternTrend: trendState, nichePatternFit: fitStatus, patternValidation: input.validation, strategyValidation: input.experimentValidation?.strategyValidation.state || 'INSUFFICIENT', sourceCaseIds: input.cases.map(item => item.caseId), sourceVideoIds: input.cases.map(item => item.videoId), generationMethod: 'DETERMINISTIC_STRUCTURED_TRANSFORMATION', noveltyAssessment: noveltyState, confidence, algorithmVersion: IDEA_INTELLIGENCE_ALGORITHM_VERSION, capturedAt: input.capturedAt, snapshotId: input.snapshotId }, algorithmVersion: IDEA_INTELLIGENCE_ALGORITHM_VERSION,
  };
}

function sortCandidates(a: IdeaCandidate, b: IdeaCandidate) {
  return (roleRank[b.strategyRole] - roleRank[a.strategyRole]) || (rank[b.confidence] - rank[a.confidence]) || (trendRank[b.fit.trendState] - trendRank[a.fit.trendState]) || (fitRank[b.fit.nicheFit] - fitRank[a.fit.nicheFit]) || (a.ideaId.localeCompare(b.ideaId));
}

export function buildIdeaIntelligence(input: IdeaIntelligenceInput): IdeaIntelligenceReport {
  const patternReport = input.contentPatterns || null;
  const trendReport = input.contentPatternTrend || null;
  const strategy = input.contentStrategy || null;
  const opportunity = input.opportunityAssessment || null;
  const cases = casesFromInput(input, patternReport);
  const topic = safeText(input.topic, '未分类方向');
  const mechanism = safeText(input.mechanism, '待识别机制');
  const productionType = safeText(input.productionType, '待识别形式');
  const blockedCandidates: IdeaCandidate[] = [];
  const generated: IdeaCandidate[] = [];
  const selections = [...(strategy?.primaryPatterns || []), ...(strategy?.testPatterns || []), ...(strategy?.watchPatterns || []), ...(strategy?.deprioritizedPatterns || []), ...(strategy?.avoidedPatterns || []), ...(strategy?.insufficientPatterns || [])].sort((a, b) => roleRank[b.role] - roleRank[a.role] || a.patternId.localeCompare(b.patternId));
  for (const selection of selections) {
    const aggregation = findAggregation(patternReport, selection.patternId);
    const trend = findTrend(trendReport, selection.patternId);
    const fit = findFit(trendReport, selection.patternId);
    const patternCases = cases.filter(item => item.patternIds.includes(selection.patternId));
    const validation = findValidation(input.experimentValidation || null, selection.patternId);
    const candidate = buildCandidate({ nicheId: input.nicheId, topic, mechanism, productionType, pattern: selection.pattern, selection, aggregation, trend, fit, strategy, opportunity, validation, experimentValidation: input.experimentValidation || null, cases: patternCases, capturedAt: input.capturedAt || null, snapshotId: input.snapshotId || null });
    if (candidate.novelty.state === 'TOO_SIMILAR' || candidate.blockers.some(item => item.code === 'ENTRY_DECISION_AVOID' || item.code === 'PATTERN_AVOIDED_BY_STRATEGY' || item.code === 'CONTRADICTED_PATTERN_VALIDATION' || item.code === 'NO_SOURCE_CASES')) {
      blockedCandidates.push(candidate);
      continue;
    }
    const sibling = generated.find(item => compareIdeas(item, candidate) >= IDEA_INTELLIGENCE_CONFIG.duplicateSurface);
    if (sibling) {
      candidate.novelty = { ...candidate.novelty, state: 'DUPLICATE', confidence: 'LOW', closestSiblingIdeaId: sibling.ideaId, blockers: ['DUPLICATE_IDEA'] };
      candidate.blockers = [...candidate.blockers, { code: 'DUPLICATE_IDEA', message: '与当前 Idea 组合中的已有候选语义等价，已去重。', refs: [sibling.ideaId] }];
      candidate.validationReadiness = 'BLOCKED';
      blockedCandidates.push(candidate);
      continue;
    }
    generated.push(candidate);
  }
  generated.sort(sortCandidates);
  const selected = generated.slice(0, IDEA_INTELLIGENCE_CONFIG.maxIdeas);
  const overflow = generated.slice(IDEA_INTELLIGENCE_CONFIG.maxIdeas);
  overflow.forEach(candidate => blockedCandidates.push({ ...candidate, state: 'RESEARCH_ONLY', validationReadiness: 'RESEARCH_ONLY', blockers: [...candidate.blockers, { code: 'PORTFOLIO_LIMIT', message: '证据组合已超过当前紧凑 Idea 组合上限。', refs: ['ideaPortfolio'] }] }));
  const distinctPatterns = new Set(selected.flatMap(item => item.patternIds)).size;
  const distinctTopics = new Set(selected.map(item => lower(item.concept.subject))).size;
  const gaps: string[] = [];
  if (!patternReport) gaps.push('缺少 Long-form Pattern 报告，无法建立稳定 Pattern ID lineage。');
  if (!strategy) gaps.push('缺少 P2 Phase 3 策略快照，Idea 不会被默认提升为主动建议。');
  if (!input.experimentValidation?.observations.length) gaps.push('当前没有真实实验观察；验证状态保持未提供，不作正向推断。');
  gaps.push('v1 未接入 embeddings、字幕、Hook、缩略图理解或私有 YouTube analytics。');
  return { schemaVersion: 'idea-intelligence.v1', algorithmVersion: IDEA_INTELLIGENCE_ALGORITHM_VERSION, scope: 'LONG_FORM', nicheId: input.nicheId, dataAvailability: availability(input, cases), cases, candidates: selected, blockedCandidates, diversity: { selected: selected.length, distinctPatterns, distinctTopics, notes: selected.length ? ['按策略角色、验证反馈、趋势、赛道适配与确定性 Idea ID 排序。', '同 Pattern 允许保留，但同一主题/问题的兄弟候选会去重。'] : ['证据不足时不强行生成固定数量的 Idea。'] }, gaps, provenance: { source: opportunity ? 'MIXED_PUBLIC_AND_UPSTREAM' : 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt || null, snapshotId: input.snapshotId || null, algorithmVersions: uniq([IDEA_INTELLIGENCE_ALGORITHM_VERSION, patternReport?.algorithmVersion || '', trendReport?.algorithmVersion || '', strategy?.strategyVersion || '', input.experimentValidation?.algorithmVersion || '']), calibrationStatus: IDEA_INTELLIGENCE_CONFIG.calibrationStatus } };
}

export function normalizeIdeaIntelligenceReport(value: unknown): IdeaIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<IdeaIntelligenceReport>;
  if (raw.schemaVersion !== 'idea-intelligence.v1' || raw.algorithmVersion !== IDEA_INTELLIGENCE_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.candidates) || !Array.isArray(raw.blockedCandidates)) return null;
  return raw as IdeaIntelligenceReport;
}

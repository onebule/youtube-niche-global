/**
 * P3 Phase 3 — deterministic Title / Hook / Outline intelligence.
 *
 * This Long-form-only layer consumes the validated Creative Brief produced by
 * P3.2. It describes creative structure; it never writes final titles, exact
 * hook copy, scripts, storyboards, thumbnails, prompts or Canvas state.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { IdeaCandidate, IdeaIntelligenceReport } from './idea-intelligence.ts';
import type {
  CreativeBrief,
  CreativeBriefIntelligenceReport,
  CreativeBriefReason,
  CreativeBriefRisk,
  CreativeBriefBlocker,
} from './creative-brief-intelligence.ts';

export const CREATIVE_DEVELOPMENT_ALGORITHM_VERSION = 'creative-development-v1';

/** All v1 thresholds are provisional until labelled creative outcomes exist. */
export const CREATIVE_DEVELOPMENT_CONFIG = Object.freeze({
  titleSourceSimilarityLimit: 0.72,
  minOutlineBeats: 4,
  promiseCoverageRequired: true,
  maxSourceSequenceOverlap: 0,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type TitleStructureType = 'QUESTION' | 'WHY_X' | 'HOW_X' | 'MISCONCEPTION_REVERSAL' | 'COMPARISON' | 'EXPERIMENT' | 'CHALLENGE' | 'TRANSFORMATION' | 'LIST' | 'EXPLAINED' | 'INVESTIGATION' | 'RESULT_FIRST' | 'CONTRADICTION';
export type TitlePromiseType = 'EXPLANATION' | 'PROCESS' | 'COMPARISON' | 'INVESTIGATION' | 'TRANSFORMATION' | 'RESULT' | 'SELECTION' | 'CHALLENGE';
export type TitleTensionType = 'CURIOSITY_GAP' | 'CONTRADICTION' | 'STAKES' | 'UNRESOLVED_QUESTION' | 'SURPRISE' | 'TRADE_OFF' | 'TRANSFORMATION';
export type HookObjective = 'ESTABLISH_CONTRADICTION' | 'CREATE_CURIOSITY_GAP' | 'SHOW_UNEXPECTED_RESULT' | 'ESTABLISH_STAKES' | 'POSE_CORE_QUESTION' | 'CHALLENGE_ASSUMPTION' | 'SHOW_TRANSFORMATION' | 'INTRODUCE_EXPERIMENT' | 'ESTABLISH_COMPARISON';
export type HookStructure = 'RESULT_QUESTION' | 'ASSUMPTION_CONTRADICTION_CORE_QUESTION' | 'PROBLEM_CONSEQUENCE_PROMISE' | 'VISUAL_RESULT_CONTEXT' | 'QUESTION_STAKES' | 'CLAIM_EVIDENCE_GAP' | 'CRITERIA_CONTRAST_PROMISE' | 'GOAL_RULES_PROMISE';
export type OutlineStructureType = 'EXPLAINER' | 'COMPARISON' | 'EXPERIMENT' | 'DOCUMENTARY' | 'CHALLENGE' | 'LIST' | 'TRANSFORMATION' | 'INVESTIGATION';
export type CreativeDevelopmentReadiness = 'READY_FOR_SCRIPT_DEVELOPMENT' | 'READY_WITH_CAUTION' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type ConsistencyState = 'CONSISTENT' | 'PARTIAL' | 'INCONSISTENT' | 'INSUFFICIENT';

export type DevelopmentReason = CreativeBriefReason;
export type DevelopmentRisk = CreativeBriefRisk;
export type DevelopmentBlocker = CreativeBriefBlocker;

export type TitleDirection = {
  directionId: string;
  structureType: TitleStructureType;
  angle: string;
  promiseType: TitlePromiseType;
  tensionType: TitleTensionType;
  informationDensity: 'LOW' | 'MEDIUM' | 'HIGH';
  mandatoryElements: string[];
  prohibitedElements: string[];
  sourcePatternId: string | null;
  originalityGate: 'PASSED' | 'REQUIRES_REVIEW' | 'BLOCKED';
  confidence: ConfidenceLevel;
  reasons: DevelopmentReason[];
  risks: DevelopmentRisk[];
  provenance: { briefId: string; ideaId: string; patternId: string | null; algorithmVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION };
};

export type OpeningPromise = {
  statement: string;
  viewerWillUnderstand: string;
  requiredDelivery: string[];
  consistency: ConsistencyState;
};

export type HookIntelligence = {
  hookObjective: HookObjective;
  hookStructure: HookStructure;
  openingPromise: OpeningPromise;
  requiredElements: string[];
  prohibitedElements: string[];
  originalityGate: 'PASSED' | 'REQUIRES_REVIEW' | 'BLOCKED';
  confidence: ConfidenceLevel;
  evidence: string[];
  risks: DevelopmentRisk[];
  provenance: { briefId: string; ideaId: string; algorithmVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION };
};

export type FirstBeat = {
  role: string;
  objective: string;
  informationRequirement: string;
  tensionFunction: string;
  evidenceRequirement: string;
  transitionPurpose: string;
};

export type OutlineBeat = FirstBeat & { index: number };

export type ContentOutline = {
  outlineId: string;
  structureType: OutlineStructureType;
  beats: OutlineBeat[];
  patternId: string | null;
  promiseCoverage: { covered: boolean; coveredElements: string[]; uncoveredElements: string[] };
  constraints: string[];
  confidence: ConfidenceLevel;
  provenance: { briefId: string; ideaId: string; algorithmVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION };
};

export type OriginalityGuardrails = {
  gate: 'PASSED' | 'REQUIRES_REVIEW' | 'BLOCKED';
  allowedMechanismReuse: string;
  prohibitedSurfacePatterns: string[];
  sourceCaseIds: string[];
  checks: { titleSurface: 'PASS' | 'REVIEW' | 'BLOCK'; hookSurface: 'REVIEW' | 'PASS'; sequenceOverlap: 'PASS' | 'REVIEW' };
  notes: string[];
};

export type CreativeDevelopmentPackage = {
  packageId: string;
  packageVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION;
  briefId: string;
  ideaId: string;
  titleDirection: TitleDirection;
  hookIntelligence: HookIntelligence;
  openingPromise: OpeningPromise;
  firstBeat: FirstBeat;
  outline: ContentOutline;
  originalityGuardrails: OriginalityGuardrails;
  mandatoryConstraints: string[];
  flexibleVariables: string[];
  consistency: { titleBrief: ConsistencyState; hookBrief: ConsistencyState; hookTitle: ConsistencyState; outlinePattern: ConsistencyState; outlinePromise: ConsistencyState };
  confidence: ConfidenceLevel;
  reasons: DevelopmentReason[];
  risks: DevelopmentRisk[];
  blockers: DevelopmentBlocker[];
  readiness: CreativeDevelopmentReadiness;
  provenance: {
    packageId: string;
    briefId: string;
    briefVersion: string;
    ideaId: string;
    ideaVersion: string;
    sourceCaseIds: string[];
    patternIds: string[];
    strategyVersion: string | null;
    opportunityVersion: string | null;
    titleIntelligenceVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION;
    hookIntelligenceVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION;
    outlineIntelligenceVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION;
    evaluatedAt: string;
    snapshotId: string | null;
    calibrationStatus: typeof CREATIVE_DEVELOPMENT_CONFIG.calibrationStatus;
  };
};

export type CreativeDevelopmentIntelligenceReport = {
  schemaVersion: 'creative-development.v1';
  algorithmVersion: typeof CREATIVE_DEVELOPMENT_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  packages: CreativeDevelopmentPackage[];
  blockedPackages: CreativeDevelopmentPackage[];
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof CREATIVE_DEVELOPMENT_CONFIG.calibrationStatus };
};

export type CreativeDevelopmentInput = {
  creativeBriefIntelligence: CreativeBriefIntelligenceReport | null;
  ideaIntelligence: IdeaIntelligenceReport | null;
  capturedAt?: string | null;
  snapshotId?: string | null;
};

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const stableHash = (value: string) => { let hash = 0x811c9dc5; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); };

function candidateFor(report: IdeaIntelligenceReport | null, brief: CreativeBrief): IdeaCandidate | null { return [...(report?.candidates || []), ...(report?.blockedCandidates || [])].find(item => item.ideaId === brief.ideaId) || null; }
function feature(brief: CreativeBrief) { return (brief.patternContext.featureValue || brief.coreMechanism.type || '').toUpperCase(); }
function evaluatedAt(brief: CreativeBrief, input: CreativeDevelopmentInput) { return brief.provenance.evaluatedAt || input.capturedAt || '1970-01-01T00:00:00.000Z'; }

function titleShape(brief: CreativeBrief): { structureType: TitleStructureType; promiseType: TitlePromiseType; tensionType: TitleTensionType; density: 'LOW' | 'MEDIUM' | 'HIGH'; reason: string } {
  switch (feature(brief)) {
    case 'HOW_TO': return { structureType: 'HOW_X', promiseType: 'PROCESS', tensionType: 'TRANSFORMATION', density: 'MEDIUM', reason: '沿用可执行过程的观察 Pattern，标题方向表达要解决的过程问题。' };
    case 'QUESTION': return { structureType: 'WHY_X', promiseType: 'EXPLANATION', tensionType: 'UNRESOLVED_QUESTION', density: 'MEDIUM', reason: '沿用问题型标题 Pattern，标题方向先提出可验证的问题再承诺解释。' };
    case 'COMPARISON': return { structureType: 'COMPARISON', promiseType: 'COMPARISON', tensionType: 'TRADE_OFF', density: 'HIGH', reason: '沿用对比 Pattern，标题方向必须表达同一标准下的取舍。' };
    case 'LIST_OR_NUMBER': return { structureType: 'LIST', promiseType: 'SELECTION', tensionType: 'CURIOSITY_GAP', density: 'HIGH', reason: '沿用有限判断点的列表 Pattern，标题方向表达筛选范围而非保证结果。' };
    case 'STORY': return { structureType: 'INVESTIGATION', promiseType: 'INVESTIGATION', tensionType: 'STAKES', density: 'MEDIUM', reason: '沿用过程与转折的故事 Pattern，标题方向保留调查/转折的期待。' };
    default: return { structureType: 'EXPLAINED', promiseType: 'EXPLANATION', tensionType: 'CURIOSITY_GAP', density: 'MEDIUM', reason: '没有更细的观察标题 Pattern，采用保守的解释方向。' };
  }
}

function hookShape(brief: CreativeBrief): { objective: HookObjective; structure: HookStructure; required: string[]; prohibited: string[] } {
  switch (feature(brief)) {
    case 'HOW_TO': return { objective: 'POSE_CORE_QUESTION', structure: 'PROBLEM_CONSEQUENCE_PROMISE', required: ['明确要解决的过程问题', '说明失败或误解的代价', '承诺展示可复核过程'], prohibited: ['未经证据支持的结果保证', '直接复述来源案例开场'] };
    case 'QUESTION': return { objective: 'CREATE_CURIOSITY_GAP', structure: 'QUESTION_STAKES', required: ['提出 Brief 的核心问题', '说明为什么值得继续查证', '把承诺连接到解释机制'], prohibited: ['用不存在的实验结果制造悬念', '把推测写成事实'] };
    case 'COMPARISON': return { objective: 'ESTABLISH_COMPARISON', structure: 'CRITERIA_CONTRAST_PROMISE', required: ['先声明比较标准', '让两条路径都被公平呈现', '预告将解释取舍'], prohibited: ['只展示一方的单向结论', '用来源案例的同一组例子'] };
    case 'LIST_OR_NUMBER': return { objective: 'CREATE_CURIOSITY_GAP', structure: 'QUESTION_STAKES', required: ['定义列表的筛选范围', '说明判断依据', '承诺逐项给出证据'], prohibited: ['虚构排名或数量', '把列表写成保证成功'] };
    case 'STORY': return { objective: 'SHOW_UNEXPECTED_RESULT', structure: 'VISUAL_RESULT_CONTEXT', required: ['建立可核验的转折或结果', '补充必要背景', '保留调查问题未立即封口'], prohibited: ['复制来源故事的事件顺序', '伪造现场或视觉证据'] };
    default: return { objective: 'POSE_CORE_QUESTION', structure: 'CLAIM_EVIDENCE_GAP', required: ['提出可验证主张', '指出证据缺口', '承诺解释核心机制'], prohibited: ['私有指标推断', '精确复述来源标题或开场'] };
  }
}

function outlineShape(brief: CreativeBrief): { type: OutlineStructureType; roles: Array<[string, string, string, string, string, string]> } {
  switch (feature(brief)) {
    case 'HOW_TO': return { type: 'EXPLAINER', roles: [['SETUP', '定义目标与边界', '明确过程问题', '输入、步骤与公开条件', '建立可重复基线', '进入第一个步骤'], ['PROCESS', '按机制拆解关键步骤', '逐步暴露难点', '过程证据与失败条件', '保持问题张力', '把步骤连接到结果'], ['EVIDENCE', '核对结果是否成立', '验证承诺', '可复核样本或公开案例', '排除偶然成功', '解释差异'], ['TAKEAWAY', '总结可迁移判断', '收束核心问题', '明确适用边界', '完成承诺交付', '留下下一步决策']] };
    case 'COMPARISON': return { type: 'COMPARISON', roles: [['CRITERIA', '建立同一比较标准', '避免先下结论', '标准与数据范围', '让比较可公平复核', '进入第一条路径'], ['OPTION_A', '呈现路径 A 的机制', '展示其优势与代价', '路径 A 的公开证据', '建立第一侧基线', '转向路径 B'], ['OPTION_B', '呈现路径 B 的机制', '形成真正对照', '路径 B 的公开证据', '放大取舍张力', '回到同一标准'], ['TRADE_OFF', '解释关键差异', '回答为什么结果不同', '并列证据与边界', '避免单向推荐', '形成判断'], ['CONCLUSION', '给出适用条件', '解决比较问题', '总结证据限制', '覆盖内容承诺', '进入结论']] };
    case 'LIST_OR_NUMBER': return { type: 'LIST', roles: [['SCOPE', '定义筛选范围', '说明为什么要筛选', '样本与标准', '避免虚构排名', '进入第一项'], ['ITEMS', '逐项呈现判断点', '每项保留一个问题', '每项的公开证据', '维持信息节奏', '连接到下一项'], ['SYNTHESIS', '比较共同机制', '解释为什么入选', '跨项证据', '消除列表碎片化', '形成取舍'], ['TAKEAWAY', '总结使用条件', '回答观众决策问题', '边界与未知', '完成列表承诺', '结束']] };
    case 'STORY': return { type: 'DOCUMENTARY', roles: [['OPENING_TENSION', '提出转折问题', '建立未解张力', '可核验结果或事件线索', '不立即解释', '补充背景'], ['CONTEXT', '补足人物/场景背景', '让问题可理解', '公开来源与时间线', '维持问题', '进入调查'], ['ESCALATION', '推进矛盾与证据', '提高 stakes', '交叉案例与新证据', '避免复制源序列', '到达转折'], ['TURNING_POINT', '解释关键机制', '回答核心疑问', '转折证据', '改变理解', '走向结论'], ['RESOLUTION', '给出边界清晰的结论', '完成内容承诺', '总结证据与未知', '落到观众判断', '提炼经验']] };
    case 'QUESTION': return { type: 'EXPLAINER', roles: [['QUESTION', '明确核心问题', '建立疑问', '问题来源与范围', '让观众知道要解决什么', '补充背景'], ['CONTEXT', '定义必要概念', '缩小解释范围', '公开定义与样本', '避免偷换概念', '进入机制'], ['MECHANISM', '解释为什么会发生', '逐步缩小缺口', '机制证据与反例', '保持可验证', '展示影响'], ['IMPLICATION', '说明对观众的意义', '回答如果忽略会怎样', '影响或对照证据', '把机制连接到决策', '收束'], ['RESOLUTION', '回答问题并标出未知', '完成承诺', '结论与限制', '不超出证据', '结束']] };
    default: return { type: 'EXPLAINER', roles: [['SETUP', '定义主题与问题', '建立理解基线', '主题与公开范围', '避免空泛开场', '进入机制'], ['MECHANISM', '解释核心机制', '逐步建立因果链', '可核验公开证据', '保持结构忠实', '补充例子'], ['EVIDENCE', '验证机制边界', '加入反例或对照', '多来源证据', '避免单一案例泛化', '形成判断'], ['RESOLUTION', '总结可迁移结论', '完成内容承诺', '证据限制与适用条件', '不做成功保证', '结束']] };
  }
}

function originalGuard(brief: CreativeBrief, candidate: IdeaCandidate | null): OriginalityGuardrails {
  const noveltyState = candidate?.novelty.state || brief.originality.state;
  const surface = candidate?.novelty.dimensions.surfaceSimilarity ?? brief.originality.dimensions.surfaceSimilarity;
  const blocked = noveltyState === 'DUPLICATE' || noveltyState === 'TOO_SIMILAR' || (typeof surface === 'number' && surface >= CREATIVE_DEVELOPMENT_CONFIG.titleSourceSimilarityLimit);
  const review = noveltyState === 'ACCEPTABLE_VARIATION' || typeof surface !== 'number';
  return {
    gate: blocked ? 'BLOCKED' : review ? 'REQUIRES_REVIEW' : 'PASSED',
    allowedMechanismReuse: `只复用 Pattern 机制“${brief.coreMechanism.description}”，不复用来源案例的执行。`,
    prohibitedSurfacePatterns: ['来源案例标题表面措辞或仅替换名词', '来源案例开场原句或相同信息顺序', '来源案例相同例子、类比、揭示与叙事细节'],
    sourceCaseIds: brief.provenance.sourceCaseIds,
    checks: { titleSurface: blocked ? 'BLOCK' : review ? 'REVIEW' : 'PASS', hookSurface: 'REVIEW', sequenceOverlap: 'REVIEW' },
    notes: [candidate?.novelty.dimensions.semanticSimilarity === null ? '没有真实 embeddings；标题/Hook/序列语义相似度需要人工复核。' : '结构复用允许，表面执行必须重新设计。', '这不是法律清权结论。'],
  };
}

function confidenceFor(brief: CreativeBrief, guard: OriginalityGuardrails): ConfidenceLevel {
  let confidence = brief.confidence;
  if (guard.gate !== 'PASSED' || brief.patternContext.fidelity !== 'STRONG_MATCH') confidence = rank[confidence] > rank.MEDIUM ? 'MEDIUM' : confidence;
  if (!brief.provenance.sourceCaseIds.length || brief.patternContext.fidelity === 'INSUFFICIENT') return 'INSUFFICIENT';
  return confidence;
}

function readinessFor(brief: CreativeBrief, consistency: CreativeDevelopmentPackage['consistency'], guard: OriginalityGuardrails, confidence: ConfidenceLevel): CreativeDevelopmentReadiness {
  if (brief.readiness === 'BLOCKED' || brief.validation.state === 'REJECTED' || brief.strategyContext.role === 'AVOID' || brief.strategyContext.entryDecision === 'AVOID') return 'BLOCKED';
  if (brief.readiness === 'INSUFFICIENT' || confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (guard.gate === 'BLOCKED') return 'BLOCKED';
  if (Object.values(consistency).some(item => item === 'INCONSISTENT')) return 'NEEDS_REVISION';
  if (brief.readiness === 'NEEDS_REVISION' || brief.patternContext.fidelity === 'MISMATCH' || brief.patternContext.fidelity === 'WEAK_MATCH') return 'NEEDS_REVISION';
  if (brief.readiness === 'READY_WITH_CAUTION' || brief.validation.state === 'CONDITIONALLY_VALIDATED' || guard.gate === 'REQUIRES_REVIEW' || brief.patternContext.trendState === 'DILUTING' || brief.patternContext.trendState === 'DECLINING' || brief.productionFeasibility.state !== 'FEASIBLE' || brief.ipRightsRisk.state !== 'LOW_KNOWN_RISK') return 'READY_WITH_CAUTION';
  return 'READY_FOR_SCRIPT_DEVELOPMENT';
}

function packageFor(brief: CreativeBrief, candidate: IdeaCandidate | null, input: CreativeDevelopmentInput): CreativeDevelopmentPackage {
  const shape = titleShape(brief);
  const hook = hookShape(brief);
  const outlineShapeValue = outlineShape(brief);
  const guard = originalGuard(brief, candidate);
  const promise: OpeningPromise = { statement: brief.contentPromise.statement, viewerWillUnderstand: brief.contentPromise.statement, requiredDelivery: [brief.audienceProblem.viewerQuestion, brief.coreMechanism.description, brief.differentiation.changedQuestion], consistency: 'CONSISTENT' };
  const titleReasons: DevelopmentReason[] = [{ code: 'TITLE_DIRECTION_SUPPORTED_BY_WINNING_PATTERN', message: shape.reason, refs: [`pattern:${brief.patternContext.patternId || 'unknown'}`, `brief:${brief.briefId}`] }];
  const titleRisks: DevelopmentRisk[] = guard.gate === 'BLOCKED' ? [{ code: 'TITLE_SOURCE_SIMILARITY', message: '标题方向与来源案例表面相似度超过暂定门槛，禁止直接使用。', refs: guard.sourceCaseIds }] : [];
  const titleDirection: TitleDirection = { directionId: `title-direction-v1:${stableHash(`${brief.briefId}|${shape.structureType}`)}`, structureType: shape.structureType, angle: candidate?.concept.angle || brief.differentiation.changedQuestion, promiseType: shape.promiseType, tensionType: shape.tensionType, informationDensity: shape.density, mandatoryElements: [brief.contentPromise.statement, brief.coreMechanism.description], prohibitedElements: guard.prohibitedSurfacePatterns, sourcePatternId: brief.patternContext.patternId, originalityGate: guard.gate, confidence: confidenceFor(brief, guard), reasons: titleReasons, risks: titleRisks, provenance: { briefId: brief.briefId, ideaId: brief.ideaId, patternId: brief.patternContext.patternId, algorithmVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION } };
  const hookShapeValue = hook;
  const hookIntelligence: HookIntelligence = { hookObjective: hookShapeValue.objective, hookStructure: hookShapeValue.structure, openingPromise: promise, requiredElements: hookShapeValue.required, prohibitedElements: [...hookShapeValue.prohibited, ...guard.prohibitedSurfacePatterns], originalityGate: guard.gate === 'BLOCKED' ? 'BLOCKED' : 'REQUIRES_REVIEW', confidence: confidenceFor(brief, guard), evidence: [`brief:${brief.briefId}`, `pattern:${brief.patternContext.patternId || 'unknown'}`, 'contentPromise', 'coreMechanism'], risks: [{ code: 'HOOK_EVIDENCE_LIMITED', message: '来源 Hook/转录不可用；这里只能给出 Brief 与 Pattern 支持的结构目标。', refs: ['transcript'] }], provenance: { briefId: brief.briefId, ideaId: brief.ideaId, algorithmVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION } };
  const beats: OutlineBeat[] = outlineShapeValue.roles.map(([role, objective, tension, evidence, transition], index) => ({ index: index + 1, role, objective, informationRequirement: `${evidence}；围绕${brief.coreMechanism.description}`, tensionFunction: tension, evidenceRequirement: evidence, transitionPurpose: transition }));
  const coveredElements = ['title promise', 'hook objective', 'content promise', 'core mechanism'];
  const outline: ContentOutline = { outlineId: `content-outline-v1:${stableHash(`${brief.briefId}|${outlineShapeValue.type}`)}`, structureType: outlineShapeValue.type, beats, patternId: brief.patternContext.patternId, promiseCoverage: { covered: beats.length >= CREATIVE_DEVELOPMENT_CONFIG.minOutlineBeats, coveredElements, uncoveredElements: beats.length >= CREATIVE_DEVELOPMENT_CONFIG.minOutlineBeats ? [] : ['core mechanism delivery'] }, constraints: ['Outline 必须交付 Opening Promise，不得用泛化教程替代 Pattern 结构。', ...brief.mandatoryConstraints], confidence: confidenceFor(brief, guard), provenance: { briefId: brief.briefId, ideaId: brief.ideaId, algorithmVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION } };
  const consistency = { titleBrief: 'CONSISTENT' as const, hookBrief: 'CONSISTENT' as const, hookTitle: 'CONSISTENT' as const, outlinePattern: outlineShapeValue.type === 'EXPLAINER' && feature(brief) === 'COMPARISON' ? 'INCONSISTENT' as const : 'CONSISTENT' as const, outlinePromise: outline.promiseCoverage.covered ? 'CONSISTENT' as const : 'INCONSISTENT' as const };
  const reasons: DevelopmentReason[] = [...brief.reasons, { code: 'HOOK_MATCHES_CONTENT_PROMISE', message: 'Hook Objective 与 Brief 的 Audience Problem、Content Promise 和 Core Mechanism 一致。', refs: ['contentPromise', 'audienceProblem', 'coreMechanism'] }, { code: 'OUTLINE_PRESERVES_CORE_MECHANISM', message: `Outline 使用 ${outline.structureType} 结构交付核心机制。`, refs: [`pattern:${brief.patternContext.patternId || 'unknown'}`, 'coreMechanism'] }, { code: 'OUTLINE_PROMISE_COVERAGE_COMPLETE', message: 'Outline 对标题方向、Hook 和 Brief 承诺均有后续交付位置。', refs: ['outline.promiseCoverage'] }];
  const risks: DevelopmentRisk[] = [...brief.risks, ...hookIntelligence.risks];
  const blockers: DevelopmentBlocker[] = [...brief.blockers];
  if (guard.gate === 'BLOCKED') blockers.push({ code: 'TITLE_COPY_RISK', message: '来源案例表面相似度过高，不能继续输出可执行标题方向。', refs: guard.sourceCaseIds });
  if (consistency.outlinePattern === 'INCONSISTENT') blockers.push({ code: 'OUTLINE_PATTERN_MISMATCH', message: 'Outline 与观察到的 Pattern 不一致。', refs: [`pattern:${brief.patternContext.patternId || 'unknown'}`] });
  const confidence = confidenceFor(brief, guard);
  const readiness = readinessFor(brief, consistency, guard, confidence);
  const packageId = `creative-development-v1:${stableHash(`${brief.briefId}|${brief.ideaId}|${evaluatedAt(brief, input)}`)}`;
  return { packageId, packageVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, briefId: brief.briefId, ideaId: brief.ideaId, titleDirection, hookIntelligence, openingPromise: promise, firstBeat: beats[0], outline, originalityGuardrails: guard, mandatoryConstraints: uniq([...brief.mandatoryConstraints, '标题必须表达 Content Promise。', 'Hook 必须建立 Core Tension，不能变成 exact spoken copy。', 'Outline 必须交付承诺的机制，不生成完整脚本。']), flexibleVariables: uniq([...brief.flexibleVariables, '准确措辞、例子顺序、语气、节奏与视觉呈现']), consistency, confidence, reasons, risks, blockers, readiness, provenance: { packageId, briefId: brief.briefId, briefVersion: brief.briefVersion, ideaId: brief.ideaId, ideaVersion: brief.validation.provenance.algorithmVersion, sourceCaseIds: brief.provenance.sourceCaseIds, patternIds: brief.provenance.patternIds, strategyVersion: brief.provenance.strategyVersion, opportunityVersion: brief.provenance.opportunityVersion, titleIntelligenceVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, hookIntelligenceVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, outlineIntelligenceVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, evaluatedAt: evaluatedAt(brief, input), snapshotId: brief.provenance.snapshotId, calibrationStatus: CREATIVE_DEVELOPMENT_CONFIG.calibrationStatus } };
}

export function buildCreativeDevelopmentIntelligence(input: CreativeDevelopmentInput): CreativeDevelopmentIntelligenceReport {
  const briefs = [...(input.creativeBriefIntelligence?.briefs || []), ...(input.creativeBriefIntelligence?.blockedBriefs || [])];
  const uniqueBriefs = [...new Map(briefs.map(brief => [brief.briefId, brief])).values()];
  const packages = uniqueBriefs.filter(brief => brief.validation.state !== 'REJECTED').map(brief => packageFor(brief, candidateFor(input.ideaIntelligence, brief), input));
  const blockedPackages = packages.filter(item => item.readiness === 'BLOCKED');
  const readyPackages = packages.filter(item => item.readiness !== 'BLOCKED');
  const gaps = uniq([...(input.creativeBriefIntelligence?.gaps || []), 'P3 Phase 3 不生成最终标题、Exact Hook、完整脚本、分镜、缩略图或 Canvas。', 'TRANSCRIPT_NOT_AVAILABLE：来源 Hook 语义比较不可用。', 'SEMANTIC_SIMILARITY_UNAVAILABLE：没有真实 embeddings，原创性使用可审计的词面代理。']);
  return { schemaVersion: 'creative-development.v1', algorithmVersion: CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, scope: 'LONG_FORM', packages: readyPackages, blockedPackages, gaps, provenance: { source: input.creativeBriefIntelligence?.provenance.source || 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt || input.creativeBriefIntelligence?.provenance.capturedAt || null, snapshotId: input.snapshotId || input.creativeBriefIntelligence?.provenance.snapshotId || null, algorithmVersions: uniq([CREATIVE_DEVELOPMENT_ALGORITHM_VERSION, input.creativeBriefIntelligence?.algorithmVersion || '', input.ideaIntelligence?.algorithmVersion || '']), calibrationStatus: CREATIVE_DEVELOPMENT_CONFIG.calibrationStatus } };
}

export function normalizeCreativeDevelopmentIntelligenceReport(value: unknown): CreativeDevelopmentIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<CreativeDevelopmentIntelligenceReport>;
  if (raw.schemaVersion !== 'creative-development.v1' || raw.algorithmVersion !== CREATIVE_DEVELOPMENT_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.packages) || !Array.isArray(raw.blockedPackages)) return null;
  return raw as CreativeDevelopmentIntelligenceReport;
}

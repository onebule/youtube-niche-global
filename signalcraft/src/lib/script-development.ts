/**
 * P3 Phase 4 — deterministic script architecture and scene planning.
 *
 * This Long-form-only layer consumes the P3.3 CreativeDevelopmentPackage. It
 * describes future writing and production responsibilities; it never writes
 * final narration, exact hooks, titles, storyboards, camera directions,
 * prompts or Canvas nodes.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { CreativeDevelopmentIntelligenceReport, CreativeDevelopmentPackage, OutlineStructureType } from './creative-development.ts';

export const SCRIPT_DEVELOPMENT_ALGORITHM_VERSION = 'script-development-v1';

/** Provisional safeguards. Every heuristic remains explicitly calibratable. */
export const SCRIPT_DEVELOPMENT_CONFIG = Object.freeze({
  maxSourceSequenceOverlap: 0,
  evidenceGapBlockThreshold: 1,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type ScriptDevelopmentReadiness = 'READY_FOR_SCRIPT_WRITING' | 'READY_WITH_CAUTION' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type EvidenceAvailability = 'AVAILABLE' | 'DERIVABLE' | 'PARTIAL' | 'REQUIRES_LLM' | 'REQUIRES_TRANSCRIPT' | 'REQUIRES_VISION' | 'REQUIRES_NEW_DATA' | 'UNAVAILABLE';
export type ScriptStructureType = 'EXPLAINER' | 'COMPARISON' | 'EXPERIMENT' | 'DOCUMENTARY' | 'CHALLENGE' | 'LIST' | 'TRANSFORMATION' | 'INVESTIGATION';
export type SectionRole = 'OPENING' | 'SETUP' | 'QUESTION' | 'CONTEXT' | 'CRITERIA' | 'OPTION_A' | 'OPTION_B' | 'PROCESS' | 'METHOD' | 'OBSERVATIONS' | 'EVIDENCE' | 'MECHANISM' | 'ESCALATION' | 'TURNING_POINT' | 'TRADE_OFF' | 'IMPLICATION' | 'SYNTHESIS' | 'ITEMS' | 'RESULT' | 'RESOLUTION' | 'TAKEAWAY' | 'CONCLUSION' | 'TRANSITION';
export type EvidenceState = 'AVAILABLE' | 'NEEDS_RESEARCH' | 'PARTIAL' | 'UNAVAILABLE';
export type TensionPhase = 'INTRODUCE' | 'BUILD' | 'ESCALATE' | 'HOLD' | 'RELEASE' | 'RESOLVE' | 'NONE';
export type DeliveryState = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_APPLICABLE';

export type EvidenceRequirement = {
  evidenceId: string;
  kind: 'PUBLIC_METADATA' | 'PUBLIC_CASE' | 'TRANSCRIPT' | 'VISUAL' | 'NEW_RESEARCH' | 'LLM_ASSIST';
  description: string;
  status: EvidenceAvailability;
  state: EvidenceState;
  blocking: boolean;
  sourceRefs: string[];
  note: string;
};

export type NarrationBeat = {
  beatId: string;
  sectionId: string;
  responsibility: string;
  informationGoal: string;
  questionToResolve: string;
  evidenceRefs: string[];
  isFinalProse: false;
};

export type TensionPlan = {
  phase: TensionPhase;
  unresolvedQuestion: string;
  escalationFunction: string;
  releaseCondition: string;
};

export type PayoffPlan = {
  payoffType: 'EXPLANATION' | 'DECISION_FRAMEWORK' | 'RESULT_INTERPRETATION' | 'TAKEAWAY' | 'RESOLUTION' | 'NONE';
  expectedSectionId: string | null;
  deliveryResponsibility: string;
  evidenceBoundary: string;
};

export type PromiseDeliveryPlan = {
  promiseElement: string;
  deliverySectionIds: string[];
  state: DeliveryState;
  note: string;
};

export type SceneRequirement = {
  sceneId: string;
  sectionId: string;
  purpose: string;
  contentNeed: string;
  evidenceNeed: string;
  continuity: string;
  rightsRisk: 'NONE_IDENTIFIED' | 'POTENTIAL_RIGHTS_DEPENDENCY' | 'UNKNOWN';
  status: 'DEFINED' | 'NEEDS_RESEARCH' | 'BLOCKED';
};

export type VisualRequirement = {
  visualId: string;
  sectionId: string;
  visualRole: 'CONTEXT' | 'PROCESS' | 'COMPARISON' | 'EVIDENCE' | 'RESULT' | 'TIMELINE' | 'DIAGRAM' | 'REFERENCE';
  whatMustBeShown: string;
  evidenceStatus: EvidenceAvailability;
  sourceType: 'PUBLIC_METADATA' | 'PUBLIC_SOURCE' | 'NEW_CAPTURE' | 'UNAVAILABLE';
  verification: string;
};

export type PacingPlan = {
  sectionId: string;
  relativeWeight: number;
  function: 'OPEN' | 'BUILD' | 'EXPLAIN' | 'COMPARE' | 'ESCALATE' | 'RELEASE' | 'CLOSE';
  durationHint: 'SHORT' | 'MEDIUM' | 'LONG';
  calibrationStatus: typeof SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus;
};

export type ScriptSection = {
  sectionId: string;
  index: number;
  role: SectionRole;
  objective: string;
  responsibility: string;
  narrationBeats: NarrationBeat[];
  evidenceRequirements: EvidenceRequirement[];
  tensionPlan: TensionPlan;
  payoffPlan: PayoffPlan;
  promiseDelivery: PromiseDeliveryPlan[];
  sceneRequirements: SceneRequirement[];
  visualRequirements: VisualRequirement[];
  transitionPurpose: string;
  pacing: PacingPlan;
};

export type ScriptArchitecture = {
  architectureId: string;
  structureType: ScriptStructureType;
  patternId: string | null;
  sectionIds: string[];
  sections: ScriptSection[];
  openingFunction: string;
  closingFunction: string;
  patternFidelity: 'STRONG' | 'ACCEPTABLE' | 'WEAK' | 'MISMATCH';
  promiseCoverage: { state: DeliveryState; coveredElements: string[]; missingElements: string[] };
  sourceSequenceOverlap: 'PASS' | 'REVIEW' | 'BLOCKED';
  confidence: ConfidenceLevel;
  reasons: string[];
  risks: string[];
  blockers: string[];
};

export type EvidencePlacementPlan = {
  requirements: EvidenceRequirement[];
  available: number;
  gaps: number;
  blockingGaps: number;
};

export type ScriptDevelopmentPackage = {
  packageId: string;
  packageVersion: typeof SCRIPT_DEVELOPMENT_ALGORITHM_VERSION;
  creativeDevelopmentPackageId: string;
  briefId: string;
  ideaId: string;
  scriptArchitecture: ScriptArchitecture;
  sections: ScriptSection[];
  sceneRequirements: SceneRequirement[];
  visualRequirements: VisualRequirement[];
  evidencePlan: EvidencePlacementPlan;
  pacingPlan: PacingPlan[];
  promiseDelivery: PromiseDeliveryPlan[];
  originalityGuardrails: { inheritedGate: CreativeDevelopmentPackage['originalityGuardrails']['gate']; sourceCaseIds: string[]; sequenceRule: string; notes: string[] };
  mandatoryConstraints: string[];
  flexibleVariables: string[];
  confidence: ConfidenceLevel;
  reasons: Array<{ code: string; message: string; refs: string[] }>;
  risks: Array<{ code: string; message: string; refs: string[] }>;
  blockers: Array<{ code: string; message: string; refs: string[] }>;
  readiness: ScriptDevelopmentReadiness;
  provenance: {
    scriptPackageId: string;
    scriptArchitectureVersion: typeof SCRIPT_DEVELOPMENT_ALGORITHM_VERSION;
    creativeDevelopmentPackageId: string;
    creativeDevelopmentVersion: string;
    creativeBriefId: string;
    ideaId: string;
    patternIds: string[];
    strategyVersion: string | null;
    opportunityVersion: string | null;
    sourceCaseIds: string[];
    validationFeedbackVersion: string | null;
    titleDirectionId: string;
    hookStructure: string;
    contentOutlineId: string;
    algorithmVersions: string[];
    evaluatedAt: string;
    snapshotId: string | null;
    calibrationStatus: typeof SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus;
  };
};

export type ScriptDevelopmentInput = {
  creativeDevelopment: CreativeDevelopmentIntelligenceReport | null;
  capturedAt?: string | null;
  snapshotId?: string | null;
  validationFeedbackVersion?: string | null;
  entryDecision?: string | null;
  strategyRole?: string | null;
  productionBlockers?: string[];
};

export type ScriptDevelopmentIntelligenceReport = {
  schemaVersion: 'script-development.v1';
  algorithmVersion: typeof SCRIPT_DEVELOPMENT_ALGORITHM_VERSION;
  scope: 'LONG_FORM';
  packages: ScriptDevelopmentPackage[];
  blockedPackages: ScriptDevelopmentPackage[];
  gaps: string[];
  provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus };
};

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const stableHash = (value: string) => { let hash = 0x811c9dc5; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); };
const structureMap: Record<OutlineStructureType, ScriptStructureType> = { EXPLAINER: 'EXPLAINER', COMPARISON: 'COMPARISON', EXPERIMENT: 'EXPERIMENT', DOCUMENTARY: 'DOCUMENTARY', CHALLENGE: 'CHALLENGE', LIST: 'LIST', TRANSFORMATION: 'TRANSFORMATION', INVESTIGATION: 'INVESTIGATION' };
const text = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

function evidenceFor(description: string, sectionId: string, sourceCaseIds: string[], index: number): EvidenceRequirement {
  const lower = description.toLowerCase();
  const transcript = /transcript|hook|字幕|音频|旁白/.test(lower);
  const visual = /visual|视觉|画面|现场|镜头|image|图像/.test(lower);
  const status: EvidenceAvailability = transcript ? 'REQUIRES_TRANSCRIPT' : visual ? 'REQUIRES_VISION' : sourceCaseIds.length ? 'DERIVABLE' : 'REQUIRES_NEW_DATA';
  const kind = transcript ? 'TRANSCRIPT' : visual ? 'VISUAL' : sourceCaseIds.length ? 'PUBLIC_CASE' : 'NEW_RESEARCH';
  return { evidenceId: `evidence:${sectionId}:${index + 1}`, kind, description, status, state: status === 'DERIVABLE' ? 'PARTIAL' : status === 'REQUIRES_NEW_DATA' ? 'NEEDS_RESEARCH' : 'UNAVAILABLE', blocking: false, sourceRefs: sourceCaseIds.map(id => `case:${id}`), note: transcript ? '没有真实转录语料，不能伪造 Hook 或旁白证据。' : visual ? '没有稳健视觉理解，需人工或未来视觉阶段核验。' : sourceCaseIds.length ? '仅可从已保存的公开视频案例与元数据继续推导。' : '需要新的公开研究输入。' };
}

function templateFor(type: ScriptStructureType): Array<{ role: SectionRole; objective: string; responsibility: string; tension: TensionPhase; payoff: PayoffPlan['payoffType']; visual: VisualRequirement['visualRole'] }> {
  switch (type) {
    case 'COMPARISON': return [{ role: 'CRITERIA', objective: '建立同一比较标准', responsibility: '定义公平比较的范围与口径', tension: 'INTRODUCE', payoff: 'NONE', visual: 'COMPARISON' }, { role: 'OPTION_A', objective: '呈现路径 A 的机制与边界', responsibility: '展示优势、代价与证据', tension: 'BUILD', payoff: 'NONE', visual: 'COMPARISON' }, { role: 'OPTION_B', objective: '呈现路径 B 的机制与边界', responsibility: '形成可复核对照', tension: 'BUILD', payoff: 'NONE', visual: 'COMPARISON' }, { role: 'TRADE_OFF', objective: '解释关键差异与取舍', responsibility: '把证据连接到判断标准', tension: 'ESCALATE', payoff: 'DECISION_FRAMEWORK', visual: 'DIAGRAM' }, { role: 'CONCLUSION', objective: '给出适用条件与限制', responsibility: '完成比较承诺而不做单向保证', tension: 'RESOLVE', payoff: 'TAKEAWAY', visual: 'RESULT' }];
    case 'EXPERIMENT': return [{ role: 'OPENING', objective: '提出结果或核心问题', responsibility: '明确待验证假设', tension: 'INTRODUCE', payoff: 'NONE', visual: 'RESULT' }, { role: 'SETUP', objective: '定义实验边界与变量', responsibility: '说明样本、规则与条件', tension: 'BUILD', payoff: 'NONE', visual: 'CONTEXT' }, { role: 'METHOD', objective: '说明方法与观察口径', responsibility: '让过程可以被复核', tension: 'BUILD', payoff: 'NONE', visual: 'PROCESS' }, { role: 'OBSERVATIONS', objective: '呈现观察与异常', responsibility: '区分事实、缺口与解释', tension: 'ESCALATE', payoff: 'NONE', visual: 'EVIDENCE' }, { role: 'RESULT', objective: '给出结果并解释边界', responsibility: '完成假设检验而不夸大因果', tension: 'RELEASE', payoff: 'RESULT_INTERPRETATION', visual: 'RESULT' }];
    case 'DOCUMENTARY': case 'INVESTIGATION': return [{ role: 'OPENING', objective: '提出转折问题', responsibility: '建立未解张力，不复制来源开场', tension: 'INTRODUCE', payoff: 'NONE', visual: 'RESULT' }, { role: 'CONTEXT', objective: '补足必要背景与时间线', responsibility: '让问题可理解', tension: 'BUILD', payoff: 'NONE', visual: 'TIMELINE' }, { role: 'ESCALATION', objective: '推进矛盾与证据', responsibility: '交叉来源并保留不确定性', tension: 'ESCALATE', payoff: 'NONE', visual: 'EVIDENCE' }, { role: 'TURNING_POINT', objective: '解释关键机制或转折', responsibility: '改变对问题的理解', tension: 'RELEASE', payoff: 'EXPLANATION', visual: 'DIAGRAM' }, { role: 'RESOLUTION', objective: '给出边界清晰的结论', responsibility: '完成承诺并标出未知', tension: 'RESOLVE', payoff: 'RESOLUTION', visual: 'RESULT' }];
    case 'LIST': return [{ role: 'SETUP', objective: '定义筛选范围与标准', responsibility: '说明为什么这些项目值得比较', tension: 'INTRODUCE', payoff: 'NONE', visual: 'CONTEXT' }, { role: 'ITEMS', objective: '逐项呈现判断点', responsibility: '每项保留一个问题与证据', tension: 'BUILD', payoff: 'NONE', visual: 'EVIDENCE' }, { role: 'SYNTHESIS', objective: '比较共同机制与取舍', responsibility: '消除列表碎片化', tension: 'ESCALATE', payoff: 'DECISION_FRAMEWORK', visual: 'DIAGRAM' }, { role: 'TAKEAWAY', objective: '总结使用条件', responsibility: '完成列表承诺并标出边界', tension: 'RESOLVE', payoff: 'TAKEAWAY', visual: 'RESULT' }];
    case 'CHALLENGE': case 'TRANSFORMATION': return [{ role: 'OPENING', objective: '建立目标、规则与 stakes', responsibility: '说明转变或挑战的判断条件', tension: 'INTRODUCE', payoff: 'NONE', visual: 'RESULT' }, { role: 'SETUP', objective: '说明起点与方法', responsibility: '固定过程边界', tension: 'BUILD', payoff: 'NONE', visual: 'PROCESS' }, { role: 'ESCALATION', objective: '呈现阻力、失败或变化', responsibility: '区分观察与解释', tension: 'ESCALATE', payoff: 'NONE', visual: 'EVIDENCE' }, { role: 'RESULT', objective: '呈现结果与限制', responsibility: '解释变化是否支持承诺', tension: 'RELEASE', payoff: 'RESULT_INTERPRETATION', visual: 'RESULT' }, { role: 'TAKEAWAY', objective: '总结可迁移判断', responsibility: '给出适用条件而非成功保证', tension: 'RESOLVE', payoff: 'TAKEAWAY', visual: 'RESULT' }];
    default: return [{ role: 'OPENING', objective: '定义主题与核心问题', responsibility: '建立观看与研究边界', tension: 'INTRODUCE', payoff: 'NONE', visual: 'CONTEXT' }, { role: 'MECHANISM', objective: '解释核心机制', responsibility: '建立可核验的因果链', tension: 'BUILD', payoff: 'EXPLANATION', visual: 'DIAGRAM' }, { role: 'EVIDENCE', objective: '验证机制边界', responsibility: '加入反例或对照，避免单一案例泛化', tension: 'ESCALATE', payoff: 'NONE', visual: 'EVIDENCE' }, { role: 'RESOLUTION', objective: '总结可迁移结论', responsibility: '完成内容承诺并保留证据限制', tension: 'RESOLVE', payoff: 'TAKEAWAY', visual: 'RESULT' }];
  }
}

function normalizeRoles(pkg: CreativeDevelopmentPackage): ReturnType<typeof templateFor> {
  const type = structureMap[pkg.outline.structureType];
  const template = templateFor(type);
  if (pkg.outline.beats.length >= template.length) return pkg.outline.beats.map((beat, index) => { const fallback = template[Math.min(index, template.length - 1)]; return { role: (beat.role as SectionRole) || fallback.role, objective: text(beat.objective, fallback.objective), responsibility: text(beat.informationRequirement, fallback.responsibility), tension: fallback.tension, payoff: fallback.payoff, visual: fallback.visual }; });
  return template;
}

function makePackage(pkg: CreativeDevelopmentPackage, input: ScriptDevelopmentInput): ScriptDevelopmentPackage {
  const type = structureMap[pkg.outline.structureType];
  const roles = normalizeRoles(pkg);
  const sourceCases = pkg.provenance.sourceCaseIds;
  const sections: ScriptSection[] = [];
  const allEvidence: EvidenceRequirement[] = [];
  const allScenes: SceneRequirement[] = [];
  const allVisuals: VisualRequirement[] = [];
  const allPacing: PacingPlan[] = [];
  const promiseElements = uniq([...pkg.openingPromise.requiredDelivery, pkg.openingPromise.statement]);
  roles.forEach((shape, index) => {
    const sectionId = `script-section-v1:${stableHash(`${pkg.packageId}|${index + 1}|${shape.role}`)}`;
    const evidenceDescription = pkg.outline.beats[index]?.evidenceRequirement || `${shape.responsibility}；引用可核验公开证据`;
    const evidenceDescriptions = /transcript|hook|字幕|音频|旁白/i.test(evidenceDescription) && /visual|视觉|画面|现场|镜头|image|图像/i.test(evidenceDescription)
      ? [`${evidenceDescription}（transcript evidence）`, `${evidenceDescription.replace(/transcript|hook|字幕|音频|旁白/gi, '').trim()}（visual evidence）`]
      : [evidenceDescription];
    const evidence = evidenceDescriptions.map((description, evidenceIndex) => evidenceFor(description, sectionId, sourceCases, evidenceIndex));
    allEvidence.push(...evidence);
    const scene: SceneRequirement = { sceneId: `scene-requirement-v1:${stableHash(sectionId)}`, sectionId, purpose: shape.objective, contentNeed: shape.responsibility, evidenceNeed: evidenceDescription, continuity: index === 0 ? '建立主题与范围；不得复制来源案例开场顺序。' : '承接上一段的未解问题并服务本段目标。', rightsRisk: shape.visual === 'REFERENCE' ? 'POTENTIAL_RIGHTS_DEPENDENCY' : 'UNKNOWN', status: evidence.some(item => item.status === 'REQUIRES_NEW_DATA') ? 'NEEDS_RESEARCH' : 'DEFINED' };
    const visual: VisualRequirement = { visualId: `visual-requirement-v1:${stableHash(`${sectionId}|${shape.visual}`)}`, sectionId, visualRole: shape.visual, whatMustBeShown: `${shape.objective}所需的语义证据或上下文`, evidenceStatus: evidence[0].status, sourceType: evidence[0].status === 'REQUIRES_VISION' ? 'UNAVAILABLE' : sourceCases.length ? 'PUBLIC_SOURCE' : 'UNAVAILABLE', verification: evidence[0].status === 'REQUIRES_VISION' ? '需要人工或未来视觉阶段核验，不把画面理解写成事实。' : '仅使用可追溯的公开来源或新采集结果。' };
    allScenes.push(scene); allVisuals.push(visual);
    const beats: NarrationBeat[] = [{ beatId: `narration-beat-v1:${stableHash(`${sectionId}|beat`)}`, sectionId, responsibility: shape.responsibility, informationGoal: text(pkg.outline.beats[index]?.informationRequirement, shape.objective), questionToResolve: text(pkg.outline.beats[index]?.tensionFunction, '本段需要解决的核心疑问'), evidenceRefs: evidence.flatMap(item => item.sourceRefs), isFinalProse: false }];
    const promiseDelivery = promiseElements.map((element, promiseIndex) => { const isClosing = index === roles.length - 1; const isOpening = index === 0; const delivered = isClosing || (promiseIndex === 0 && isOpening); return { promiseElement: element, deliverySectionIds: delivered ? [sectionId] : [], state: delivered ? 'COMPLETE' as const : 'PARTIAL' as const, note: delivered ? '结构位置已定义；仍需未来脚本阶段写出具体表达。' : '承诺元素需在后续段落交付，当前只记录结构位置。' }; });
    const pacing: PacingPlan = { sectionId, relativeWeight: Number((1 / roles.length).toFixed(3)), function: index === 0 ? 'OPEN' : index === roles.length - 1 ? 'CLOSE' : shape.tension === 'ESCALATE' ? 'ESCALATE' : shape.tension === 'BUILD' ? 'BUILD' : 'EXPLAIN', durationHint: index === 0 || index === roles.length - 1 ? 'SHORT' : shape.tension === 'ESCALATE' ? 'LONG' : 'MEDIUM', calibrationStatus: SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus };
    allPacing.push(pacing);
    sections.push({ sectionId, index: index + 1, role: shape.role, objective: shape.objective, responsibility: shape.responsibility, narrationBeats: beats, evidenceRequirements: evidence, tensionPlan: { phase: shape.tension, unresolvedQuestion: text(pkg.outline.beats[index]?.tensionFunction, '本段未解问题'), escalationFunction: shape.responsibility, releaseCondition: index === roles.length - 1 ? '在证据边界内完成承诺交付。' : text(pkg.outline.beats[index]?.transitionPurpose, '进入下一结构段。') }, payoffPlan: { payoffType: shape.payoff, expectedSectionId: shape.payoff === 'NONE' ? null : sectionId, deliveryResponsibility: shape.payoff === 'NONE' ? '本段不做最终结论。' : shape.responsibility, evidenceBoundary: '不得超出已验证的公开证据。' }, promiseDelivery, sceneRequirements: [scene], visualRequirements: [visual], transitionPurpose: text(pkg.outline.beats[index]?.transitionPurpose, '承接下一段结构责任。'), pacing });
  });
  const missingPromise = pkg.outline.promiseCoverage.covered ? [] : ['content promise'];
  const upstreamBlockers = [...pkg.blockers];
  const blockers: ScriptDevelopmentPackage['blockers'] = upstreamBlockers.map(item => ({ code: item.code, message: item.message, refs: item.refs }));
  const productionBlockers = input.productionBlockers || [];
  productionBlockers.forEach(code => blockers.push({ code: 'KNOWN_PRODUCTION_BLOCKER', message: `上游制作门控：${code}`, refs: ['productionFeasibility'] }));
  if (!pkg.outline.promiseCoverage.covered) blockers.push({ code: 'PROMISE_COVERAGE_FAILED', message: 'Outline 没有覆盖 Opening Promise，不能进入后续脚本写作。', refs: ['outline.promiseCoverage'] });
  if (pkg.consistency.outlinePattern === 'INCONSISTENT') blockers.push({ code: 'PATTERN_MISMATCH', message: '创作开发包的 Outline 与 Pattern 不一致。', refs: ['creativeDevelopment.outline'] });
  if (input.entryDecision === 'AVOID') blockers.push({ code: 'ENTRY_DECISION_AVOID', message: '上游进入决策为 AVOID，不生成主动脚本架构。', refs: ['entryDecision'] });
  if (input.strategyRole === 'AVOID') blockers.push({ code: 'STRATEGY_AVOID', message: '上游策略角色为 AVOID，不生成主动脚本架构。', refs: ['strategyRole'] });
  const upstreamReadiness = pkg.readiness;
  if (upstreamReadiness === 'BLOCKED') blockers.push({ code: 'CREATIVE_DEVELOPMENT_BLOCKED', message: 'CreativeDevelopmentPackage 已阻塞。', refs: [`creative-development:${pkg.packageId}`] });
  const sourceSequenceOverlap = pkg.originalityGuardrails.checks.sequenceOverlap === 'PASS' ? 'PASS' : pkg.originalityGuardrails.gate === 'BLOCKED' ? 'BLOCKED' : 'REVIEW';
  const readiness: ScriptDevelopmentReadiness = blockers.length || sourceSequenceOverlap === 'BLOCKED' ? 'BLOCKED' : upstreamReadiness === 'INSUFFICIENT' ? 'INSUFFICIENT' : upstreamReadiness === 'NEEDS_REVISION' ? 'NEEDS_REVISION' : upstreamReadiness === 'READY_WITH_CAUTION' || pkg.originalityGuardrails.gate !== 'PASSED' ? 'READY_WITH_CAUTION' : 'READY_FOR_SCRIPT_WRITING';
  const confidence: ConfidenceLevel = readiness === 'BLOCKED' || readiness === 'INSUFFICIENT' ? 'INSUFFICIENT' : sourceCases.length < 2 ? (rank[pkg.confidence] > rank.MEDIUM ? 'MEDIUM' : pkg.confidence) : pkg.confidence;
  const promiseDelivery = promiseElements.map((element, index) => ({ promiseElement: element, deliverySectionIds: index === promiseElements.length - 1 ? [sections.at(-1)?.sectionId || ''] : [sections[0]?.sectionId || ''], state: missingPromise.length ? 'MISSING' as const : 'COMPLETE' as const, note: missingPromise.length ? '上游 Outline 未覆盖，不能声称承诺已交付。' : '只定义结构交付位置，不生成最终文案。' }));
  const reasons = [{ code: 'SCRIPT_ARCHITECTURE_MATCHES_OUTLINE', message: `脚本架构沿用 ${type} Outline，并为每个结构段分配责任。`, refs: [`outline:${pkg.outline.outlineId}`] }, { code: 'SCRIPT_PROMISE_COVERAGE_COMPLETE', message: missingPromise.length ? '承诺覆盖未完成，已降级为非 ready 状态。' : 'Opening Promise 已有明确的结构交付位置。', refs: ['outline.promiseCoverage'] }, { code: 'SCENE_REQUIREMENTS_DEFINED', message: '场景需求保持语义层，不生成分镜或镜头参数。', refs: allScenes.map(item => item.sceneId) }];
  const risks = [{ code: 'SOURCE_SEQUENCE_SIMILARITY', message: '来源案例执行顺序不可由当前元数据完全判断，需要原创性复核。', refs: sourceCases.map(id => `case:${id}`) }, { code: 'VALIDATION_NOT_AVAILABLE', message: input.validationFeedbackVersion ? `沿用验证反馈版本 ${input.validationFeedbackVersion}。` : '没有真实 P2 Phase 4 反馈，不能把验证当作正向证据。', refs: input.validationFeedbackVersion ? [`validation:${input.validationFeedbackVersion}`] : ['validation'] }, { code: 'CALIBRATION_REQUIRED', message: '段落权重、场景需求和所有阈值仍需真实结果校准。', refs: ['script-development-v1'] }];
  const packageId = `script-development-v1:${stableHash(`${pkg.packageId}|${input.capturedAt || pkg.provenance.evaluatedAt}`)}`;
  const architecture: ScriptArchitecture = { architectureId: `script-architecture-v1:${stableHash(`${packageId}|${type}`)}`, structureType: type, patternId: pkg.outline.patternId, sectionIds: sections.map(item => item.sectionId), sections, openingFunction: sections[0]?.objective || '定义主题与问题', closingFunction: sections.at(-1)?.objective || '完成承诺并标出限制', patternFidelity: pkg.consistency.outlinePattern === 'INCONSISTENT' ? 'MISMATCH' : pkg.outline.beats.length >= 4 ? 'STRONG' : 'WEAK', promiseCoverage: { state: missingPromise.length ? 'MISSING' : 'COMPLETE', coveredElements: missingPromise.length ? [] : promiseElements, missingElements: missingPromise }, sourceSequenceOverlap, confidence, reasons: reasons.map(item => item.code), risks: risks.map(item => item.code), blockers: blockers.map(item => item.code) };
  return { packageId, packageVersion: SCRIPT_DEVELOPMENT_ALGORITHM_VERSION, creativeDevelopmentPackageId: pkg.packageId, briefId: pkg.briefId, ideaId: pkg.ideaId, scriptArchitecture: architecture, sections, sceneRequirements: allScenes, visualRequirements: allVisuals, evidencePlan: { requirements: allEvidence, available: allEvidence.filter(item => item.status === 'AVAILABLE' || item.status === 'DERIVABLE').length, gaps: allEvidence.filter(item => item.status !== 'AVAILABLE' && item.status !== 'DERIVABLE').length, blockingGaps: allEvidence.filter(item => item.blocking).length }, pacingPlan: allPacing, promiseDelivery, originalityGuardrails: { inheritedGate: pkg.originalityGuardrails.gate, sourceCaseIds: sourceCases, sequenceRule: '不得复制来源案例的事件顺序、例子顺序或揭示顺序。', notes: ['结构机制可以复用；执行表面、例子、叙事和视觉必须重新设计。', '这不是法律清权结论。'] }, mandatoryConstraints: uniq([...pkg.mandatoryConstraints, '只输出结构责任，不输出最终旁白或对话。', '场景需求不等于分镜，不包含镜头参数。']), flexibleVariables: uniq([...pkg.flexibleVariables, '段落措辞、例子、转场与视觉实现留给后续阶段']), confidence, reasons, risks, blockers, readiness, provenance: { scriptPackageId: packageId, scriptArchitectureVersion: SCRIPT_DEVELOPMENT_ALGORITHM_VERSION, creativeDevelopmentPackageId: pkg.packageId, creativeDevelopmentVersion: pkg.packageVersion, creativeBriefId: pkg.briefId, ideaId: pkg.ideaId, patternIds: uniq([pkg.titleDirection.sourcePatternId || '', ...pkg.provenance.patternIds]), strategyVersion: pkg.provenance.strategyVersion, opportunityVersion: pkg.provenance.opportunityVersion, sourceCaseIds: sourceCases, validationFeedbackVersion: input.validationFeedbackVersion || null, titleDirectionId: pkg.titleDirection.directionId, hookStructure: pkg.hookIntelligence.hookStructure, contentOutlineId: pkg.outline.outlineId, algorithmVersions: uniq([SCRIPT_DEVELOPMENT_ALGORITHM_VERSION, pkg.packageVersion]), evaluatedAt: pkg.provenance.evaluatedAt || input.capturedAt || '1970-01-01T00:00:00.000Z', snapshotId: input.snapshotId || pkg.provenance.snapshotId || null, calibrationStatus: SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus } };
}

export function buildScriptDevelopmentIntelligence(input: ScriptDevelopmentInput): ScriptDevelopmentIntelligenceReport {
  const source = input.creativeDevelopment;
  const upstream = [...(source?.packages || []), ...(source?.blockedPackages || [])];
  const unique = [...new Map(upstream.map(pkg => [pkg.packageId, pkg])).values()];
  const built = unique.map(pkg => makePackage(pkg, input));
  const packages = built.filter(pkg => pkg.readiness !== 'BLOCKED');
  const blockedPackages = built.filter(pkg => pkg.readiness === 'BLOCKED');
  const gaps = uniq([...(source?.gaps || []), 'P3 Phase 4 不生成完整脚本、逐句旁白、精确 Hook、最终标题、分镜、镜头参数、图片/视频提示词或 Canvas 节点。', 'TRANSCRIPT_UNAVAILABLE：没有真实转录语料，不生成伪造的字幕、Hook 或旁白证据。', 'VISUAL_REQUIREMENT_UNVERIFIED：语义视觉需求需要人工或未来视觉阶段核验。', 'VALIDATION_NOT_AVAILABLE：没有真实 P2 Phase 4 反馈时只保留缺口。']);
  return { schemaVersion: 'script-development.v1', algorithmVersion: SCRIPT_DEVELOPMENT_ALGORITHM_VERSION, scope: 'LONG_FORM', packages, blockedPackages, gaps, provenance: { source: source?.provenance.source || 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt || source?.provenance.capturedAt || null, snapshotId: input.snapshotId || source?.provenance.snapshotId || null, algorithmVersions: uniq([SCRIPT_DEVELOPMENT_ALGORITHM_VERSION, source?.algorithmVersion || '']), calibrationStatus: SCRIPT_DEVELOPMENT_CONFIG.calibrationStatus } };
}

export function normalizeScriptDevelopmentIntelligenceReport(value: unknown): ScriptDevelopmentIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ScriptDevelopmentIntelligenceReport>;
  if (raw.schemaVersion !== 'script-development.v1' || raw.algorithmVersion !== SCRIPT_DEVELOPMENT_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.packages) || !Array.isArray(raw.blockedPackages)) return null;
  return raw as ScriptDevelopmentIntelligenceReport;
}

/**
 * P3 Phase 5 — evidence-grounded Long-form Script Draft intelligence.
 *
 * The writer consumes the P3.4 architecture and produces editable narration
 * sections plus a claim/evidence registry. It does not create storyboards,
 * shots, model prompts, audio or Canvas nodes.
 */
import type { ConfidenceLevel } from './entry-decision.ts';
import type { ScriptDevelopmentIntelligenceReport, ScriptDevelopmentPackage, ScriptSection, EvidenceRequirement, EvidenceAvailability, PromiseDeliveryPlan } from './script-development.ts';

export const SCRIPT_WRITING_ALGORITHM_VERSION = 'script-writing-v1';

export const SCRIPT_WRITING_CONFIG = Object.freeze({
  targetWordsPerMinute: 150,
  repetitionSimilarityThreshold: 0.78,
  maxUnsupportedClaimsForReady: 0,
  maxIntroRatio: 0.2,
  calibrationStatus: 'CALIBRATION_REQUIRED' as const,
});

export type ScriptReadiness = 'READY_FOR_STORYBOARD' | 'READY_WITH_CAUTION' | 'NEEDS_REVISION' | 'BLOCKED' | 'INSUFFICIENT';
export type ScriptClaimType = 'OBSERVED_FACT' | 'SUPPORTED_INFERENCE' | 'HYPOTHESIS' | 'OPINION' | 'UNKNOWN';
export type ClaimSupportStatus = 'SUPPORTED' | 'RESEARCH_REQUIRED' | 'UNSUPPORTED' | 'UNKNOWN';

export type ScriptEvidenceReference = {
  evidenceId: string;
  description: string;
  sourceType: 'PUBLIC_VIDEO_METADATA' | 'PUBLIC_CASE' | 'CREATOR_BASELINE' | 'BREAKOUT_EVIDENCE' | 'PATTERN_EVIDENCE' | 'STRATEGY_EVIDENCE' | 'VALIDATION_OBSERVATION' | 'USER_PROVIDED_SOURCE' | 'EXTERNAL_SOURCE' | 'UNKNOWN';
  availability: EvidenceAvailability;
  sourceRefs: string[];
  note: string;
};

export type ScriptClaim = {
  claimId: string;
  sectionId: string;
  text: string;
  normalizedStatement: string;
  claimType: ScriptClaimType;
  evidenceIds: string[];
  confidence: ConfidenceLevel;
  sourceType: ScriptEvidenceReference['sourceType'];
  supportStatus: ClaimSupportStatus;
};

export type ScriptSectionDraft = {
  sectionId: string;
  index: number;
  sectionRole: ScriptSection['role'];
  sectionObjective: string;
  narration: string;
  keyPoints: string[];
  evidenceRequirements: string[];
  claimIds: string[];
  transitionIn: string;
  transitionOut: string;
  tensionRole: string;
  payoffRole: string;
  pacingTarget: { relativeWeight: number; durationHint: 'SHORT' | 'MEDIUM' | 'LONG' };
  visualRequirements: string[];
  provenance: { architectureSectionId: string; narrationSource: 'DETERMINISTIC_STRUCTURAL_DRAFT' | 'USER_EDITED_DRAFT'; algorithmVersion: typeof SCRIPT_WRITING_ALGORITHM_VERSION };
};

export type PromiseDeliveryAssessment = { state: 'PROMISE_DELIVERED' | 'PROMISE_PARTIALLY_DELIVERED' | 'PROMISE_NOT_DELIVERED' | 'INSUFFICIENT'; promiseElements: PromiseDeliveryPlan[]; unresolvedElements: string[] };
export type ScriptPacingAssessment = { estimatedWords: number; estimatedDurationMinutes: number | null; targetWordsPerMinute: number; introRatio: number | null; sectionCount: number; state: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'; calibrationStatus: typeof SCRIPT_WRITING_CONFIG.calibrationStatus; notes: string[] };
export type ScriptOriginalityAssessment = { state: 'ACCEPTABLE' | 'REQUIRES_REVIEW' | 'BLOCKED' | 'INSUFFICIENT'; sourceTranscriptStatus: 'AVAILABLE' | 'UNAVAILABLE'; semanticSimilarityStatus: 'AVAILABLE' | 'UNAVAILABLE'; sourceCaseIds: string[]; checks: { phraseOverlap: 'NOT_ASSESSED' | 'REVIEW_REQUIRED' | 'PASS'; titlePromise: 'PASS' | 'REVIEW_REQUIRED'; sequenceCopy: 'REVIEW_REQUIRED' | 'PASS' }; notes: string[] };
export type ScriptQaAssessment = { architectureComplete: boolean; supportedClaimCount: number; unsupportedClaimCount: number; researchRequiredCount: number; unknownClaimCount: number; repetitionCount: number; patternFidelity: 'STRONG' | 'ACCEPTABLE' | 'WEAK' | 'MISMATCH'; evidenceCoverage: 'SUFFICIENT' | 'PARTIAL' | 'INSUFFICIENT'; findings: string[] };

export type ScriptDraft = {
  scriptId: string;
  scriptVersion: typeof SCRIPT_WRITING_ALGORITHM_VERSION;
  architectureId: string;
  creativeDevelopmentPackageId: string;
  creativeBriefId: string;
  ideaId: string;
  opening?: ScriptSectionDraft;
  sections: ScriptSectionDraft[];
  closing?: ScriptSectionDraft;
  claimRegistry: ScriptClaim[];
  evidenceRegistry: ScriptEvidenceReference[];
  promiseDelivery: PromiseDeliveryAssessment;
  pacing: ScriptPacingAssessment;
  originality: ScriptOriginalityAssessment;
  qa: ScriptQaAssessment;
  confidence: ConfidenceLevel;
  reasons: Array<{ code: string; message: string; refs: string[] }>;
  risks: Array<{ code: string; message: string; refs: string[] }>;
  blockers: Array<{ code: string; message: string; refs: string[] }>;
  readiness: ScriptReadiness;
  provenance: { scriptId: string; scriptVersion: typeof SCRIPT_WRITING_ALGORITHM_VERSION; architectureId: string; creativeDevelopmentPackageId: string; creativeBriefId: string; ideaId: string; patternIds: string[]; strategyVersion: string | null; opportunityVersion: string | null; sourceCaseIds: string[]; evidenceIds: string[]; validationContext: string | null; algorithmVersions: string[]; generatedAt: string; evaluatedAt: string; snapshotId: string | null; calibrationStatus: typeof SCRIPT_WRITING_CONFIG.calibrationStatus };
};

export type ScriptWritingInput = { scriptDevelopment: ScriptDevelopmentIntelligenceReport | null; capturedAt?: string | null; snapshotId?: string | null; validationFeedbackVersion?: string | null; targetDurationMinutes?: number | null; narrationOverrides?: Record<string, string> };
export type ScriptWritingIntelligenceReport = { schemaVersion: 'script-writing.v1'; algorithmVersion: typeof SCRIPT_WRITING_ALGORITHM_VERSION; scope: 'LONG_FORM'; drafts: ScriptDraft[]; blockedDrafts: ScriptDraft[]; gaps: string[]; provenance: { source: 'PUBLIC_YOUTUBE_METADATA' | 'MIXED_PUBLIC_AND_UPSTREAM'; capturedAt: string | null; snapshotId: string | null; algorithmVersions: string[]; calibrationStatus: typeof SCRIPT_WRITING_CONFIG.calibrationStatus } };
export type ScriptDraftIntelligenceReport = ScriptWritingIntelligenceReport;

const rank: Record<ConfidenceLevel, number> = { INSUFFICIENT: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
const uniq = (values: string[]) => [...new Set(values.filter(Boolean))];
const stableHash = (value: string) => { let hash = 0x811c9dc5; for (let index = 0; index < value.length; index += 1) { hash ^= value.charCodeAt(index); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); };
const words = (value: string) => value.trim() ? value.trim().split(/\s+/u).length : 0;
const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const text = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value.trim() : fallback;

function evidenceType(requirement: EvidenceRequirement): ScriptEvidenceReference['sourceType'] {
  if (requirement.kind === 'PUBLIC_CASE') return 'PUBLIC_CASE';
  if (requirement.kind === 'PUBLIC_METADATA') return 'PUBLIC_VIDEO_METADATA';
  if (requirement.kind === 'TRANSCRIPT') return 'EXTERNAL_SOURCE';
  if (requirement.kind === 'VISUAL') return 'EXTERNAL_SOURCE';
  return 'UNKNOWN';
}

function narrationFor(section: ScriptSection, first: boolean, last: boolean): string {
  const opening = first ? `先把问题说清楚：${section.objective}。` : '';
  const body = `${section.responsibility}。这一段只使用能够核对的证据，不能把未知部分说成结论。`;
  const close = last ? '最后会回到这个问题，说明结论成立的范围和仍然未知的部分。' : `接下来需要${section.transitionPurpose || '进入下一段结构责任'}。`;
  return [opening, body, close].filter(Boolean).join(' ');
}

function claimFor(section: ScriptSectionDraft, requirement: EvidenceRequirement, evidenceId: string, confidence: ConfidenceLevel): ScriptClaim {
  const unavailable = ['REQUIRES_TRANSCRIPT', 'REQUIRES_VISION', 'REQUIRES_NEW_DATA', 'UNAVAILABLE'].includes(requirement.status);
  const textValue = unavailable ? `${requirement.description}仍需要补充证据，当前不作事实结论。` : `${requirement.description}可由已保存的公开来源继续核对。`;
  return { claimId: `script-claim-v1:${stableHash(`${section.sectionId}|${evidenceId}`)}`, sectionId: section.sectionId, text: textValue, normalizedStatement: normalize(textValue), claimType: unavailable ? 'UNKNOWN' : 'SUPPORTED_INFERENCE', evidenceIds: [evidenceId], confidence: unavailable ? 'LOW' : confidence, sourceType: evidenceType(requirement), supportStatus: unavailable ? 'RESEARCH_REQUIRED' : 'SUPPORTED' };
}

function overrideClaims(section: ScriptSectionDraft, narration: string, claims: ScriptClaim[]): ScriptClaim[] {
  const suspicious = /最高留存|最高点击率|CTR|RPM|收入|revenue|retention|proves|证明了|没有人|everyone/iu.test(narration);
  if (!suspicious) return claims;
  return [...claims, { claimId: `script-claim-v1:${stableHash(`${section.sectionId}|unsupported`)}`, sectionId: section.sectionId, text: narration, normalizedStatement: normalize(narration), claimType: 'UNKNOWN', evidenceIds: [], confidence: 'LOW', sourceType: 'UNKNOWN', supportStatus: 'UNSUPPORTED' }];
}

function repetitionCount(sections: ScriptSectionDraft[]) {
  let count = 0;
  for (let left = 0; left < sections.length; left += 1) for (let right = left + 1; right < sections.length; right += 1) {
    const a = new Set(normalize(sections[left].narration).split(' ').filter(Boolean)); const b = new Set(normalize(sections[right].narration).split(' ').filter(Boolean));
    const overlap = [...a].filter(token => b.has(token)).length / Math.max(1, new Set([...a, ...b]).size);
    if (overlap >= SCRIPT_WRITING_CONFIG.repetitionSimilarityThreshold) count += 1;
  }
  return count;
}

function makeDraft(pkg: ScriptDevelopmentPackage, input: ScriptWritingInput): ScriptDraft {
  const architectureSections = pkg.sections;
  const evidenceRegistry: ScriptEvidenceReference[] = [];
  const claimRegistry: ScriptClaim[] = [];
  const drafts = architectureSections.map((architectureSection, index) => {
    const sectionId = architectureSection.sectionId;
    const narration = text(input.narrationOverrides?.[sectionId], narrationFor(architectureSection, index === 0, index === architectureSections.length - 1));
    const section: ScriptSectionDraft = { sectionId, index: architectureSection.index, sectionRole: architectureSection.role, sectionObjective: architectureSection.objective, narration, keyPoints: [architectureSection.objective, architectureSection.responsibility], evidenceRequirements: architectureSection.evidenceRequirements.map(item => item.description), claimIds: [], transitionIn: index === 0 ? 'OPENING' : architectureSections[index - 1].transitionPurpose, transitionOut: architectureSection.transitionPurpose, tensionRole: architectureSection.tensionPlan.escalationFunction, payoffRole: architectureSection.payoffPlan.deliveryResponsibility, pacingTarget: { relativeWeight: architectureSection.pacing.relativeWeight, durationHint: architectureSection.pacing.durationHint }, visualRequirements: architectureSection.visualRequirements.map(item => item.whatMustBeShown), provenance: { architectureSectionId: sectionId, narrationSource: input.narrationOverrides?.[sectionId] ? 'USER_EDITED_DRAFT' : 'DETERMINISTIC_STRUCTURAL_DRAFT', algorithmVersion: SCRIPT_WRITING_ALGORITHM_VERSION } };
    architectureSection.evidenceRequirements.forEach(requirement => { const evidenceId = `script-evidence-v1:${stableHash(`${sectionId}|${requirement.evidenceId}`)}`; evidenceRegistry.push({ evidenceId, description: requirement.description, sourceType: evidenceType(requirement), availability: requirement.status, sourceRefs: requirement.sourceRefs, note: requirement.note }); const claims = overrideClaims(section, narration, [claimFor(section, requirement, evidenceId, pkg.confidence)]); claims.forEach(claim => { const existing = claimRegistry.find(item => item.normalizedStatement === claim.normalizedStatement && item.supportStatus === claim.supportStatus); if (existing) { existing.evidenceIds = uniq([...existing.evidenceIds, ...claim.evidenceIds]); section.claimIds.push(existing.claimId); } else { claimRegistry.push(claim); section.claimIds.push(claim.claimId); } }); });
    return section;
  });
  const repetition = repetitionCount(drafts);
  const promiseElements = pkg.promiseDelivery;
  const unresolved = promiseElements.filter(item => item.state !== 'COMPLETE').map(item => item.promiseElement);
  const promiseState: PromiseDeliveryAssessment['state'] = !promiseElements.length ? 'INSUFFICIENT' : unresolved.length === promiseElements.length ? 'PROMISE_NOT_DELIVERED' : unresolved.length ? 'PROMISE_PARTIALLY_DELIVERED' : 'PROMISE_DELIVERED';
  const supported = claimRegistry.filter(claim => claim.supportStatus === 'SUPPORTED').length;
  const unsupported = claimRegistry.filter(claim => claim.supportStatus === 'UNSUPPORTED').length;
  const research = claimRegistry.filter(claim => claim.supportStatus === 'RESEARCH_REQUIRED').length;
  const unknown = claimRegistry.filter(claim => claim.supportStatus === 'UNKNOWN').length;
  const evidenceCoverage: ScriptQaAssessment['evidenceCoverage'] = unsupported > 0 || research > 0 ? (supported ? 'PARTIAL' : 'INSUFFICIENT') : 'SUFFICIENT';
  const qa: ScriptQaAssessment = { architectureComplete: drafts.length >= 2 && drafts.every(section => Boolean(section.narration && section.sectionObjective)), supportedClaimCount: supported, unsupportedClaimCount: unsupported, researchRequiredCount: research, unknownClaimCount: unknown, repetitionCount: repetition, patternFidelity: pkg.scriptArchitecture.patternFidelity, evidenceCoverage, findings: uniq([unsupported ? 'SCRIPT_UNSUPPORTED_CLAIM' : '', research ? 'SCRIPT_RESEARCH_REQUIRED' : '', repetition ? 'SCRIPT_REDUNDANT_SECTION' : '', pkg.scriptArchitecture.patternFidelity === 'MISMATCH' ? 'SCRIPT_PATTERN_DRIFT' : '']) };
  const blockers: ScriptDraft['blockers'] = pkg.blockers.map(item => ({ code: item.code, message: item.message, refs: item.refs }));
  if (pkg.scriptArchitecture.patternFidelity === 'MISMATCH') blockers.push({ code: 'PATTERN_MISMATCH', message: '脚本 draft 偏离上游 Pattern 结构。', refs: [pkg.scriptArchitecture.architectureId] });
  const estimatedWords = drafts.reduce((sum, section) => sum + words(section.narration), 0);
  const introWords = words(drafts[0]?.narration || '');
  const targetMinutes = input.targetDurationMinutes && input.targetDurationMinutes > 0 ? input.targetDurationMinutes : null;
  const duration = Number((estimatedWords / SCRIPT_WRITING_CONFIG.targetWordsPerMinute).toFixed(2));
  const pacing: ScriptPacingAssessment = { estimatedWords, estimatedDurationMinutes: estimatedWords ? duration : null, targetWordsPerMinute: SCRIPT_WRITING_CONFIG.targetWordsPerMinute, introRatio: estimatedWords ? Number((introWords / estimatedWords).toFixed(3)) : null, sectionCount: drafts.length, state: drafts.length < 2 || !estimatedWords ? 'INSUFFICIENT' : targetMinutes && duration < targetMinutes * 0.35 ? 'PARTIAL' : 'SUFFICIENT', calibrationStatus: SCRIPT_WRITING_CONFIG.calibrationStatus, notes: uniq([targetMinutes && duration < targetMinutes * 0.35 ? 'CONTENT_DEPTH_INSUFFICIENT：当前证据与结构不足以支撑目标时长，不用填充重复内容。' : '', 'WPM 与段落权重是可校准的估计，不是科学测量。']) };
  const originality: ScriptOriginalityAssessment = { state: pkg.originalityGuardrails.inheritedGate === 'BLOCKED' ? 'BLOCKED' : pkg.originalityGuardrails.inheritedGate === 'PASSED' ? 'ACCEPTABLE' : 'REQUIRES_REVIEW', sourceTranscriptStatus: 'UNAVAILABLE', semanticSimilarityStatus: 'UNAVAILABLE', sourceCaseIds: pkg.originalityGuardrails.sourceCaseIds, checks: { phraseOverlap: 'NOT_ASSESSED', titlePromise: promiseState === 'PROMISE_NOT_DELIVERED' ? 'REVIEW_REQUIRED' : 'PASS', sequenceCopy: pkg.scriptArchitecture.sourceSequenceOverlap === 'BLOCKED' ? 'REVIEW_REQUIRED' : 'REVIEW_REQUIRED' }, notes: ['没有来源转录，不能声称完成短语级相似度检测。', '结构机制可复用；案例顺序、独特措辞和例子必须重新设计。'] };
  const needsRevision = !qa.architectureComplete || promiseState === 'PROMISE_NOT_DELIVERED' || qa.patternFidelity === 'MISMATCH' || unsupported > SCRIPT_WRITING_CONFIG.maxUnsupportedClaimsForReady || repetition > 0;
  const readiness: ScriptReadiness = blockers.length ? 'BLOCKED' : !drafts.length ? 'INSUFFICIENT' : needsRevision ? 'NEEDS_REVISION' : research || promiseState === 'PROMISE_PARTIALLY_DELIVERED' || pacing.state === 'PARTIAL' ? 'READY_WITH_CAUTION' : 'READY_FOR_STORYBOARD';
  const confidence: ConfidenceLevel = readiness === 'BLOCKED' || readiness === 'INSUFFICIENT' ? 'INSUFFICIENT' : unsupported ? 'LOW' : research || readiness === 'READY_WITH_CAUTION' ? (rank[pkg.confidence] > rank.MEDIUM ? 'MEDIUM' : pkg.confidence) : pkg.confidence;
  const scriptId = `script-draft-v1:${stableHash(`${pkg.packageId}|${input.capturedAt || pkg.provenance.evaluatedAt}`)}`;
  const reasons = [{ code: 'SCRIPT_ARCHITECTURE_READY', message: 'Script Draft 逐段消费 P3.4 Script Architecture，没有重算上游结构。', refs: [pkg.scriptArchitecture.architectureId] }, { code: promiseState === 'PROMISE_DELIVERED' ? 'SCRIPT_PROMISE_DELIVERED' : 'SCRIPT_PROMISE_NOT_DELIVERED', message: promiseState === 'PROMISE_DELIVERED' ? 'Opening Promise 有明确的结构交付位置。' : 'Promise 交付仍有缺口，未把缺口写成事实。', refs: ['promiseDelivery'] }, { code: qa.patternFidelity === 'STRONG' ? 'SCRIPT_PATTERN_FIDELITY_STRONG' : 'SCRIPT_PATTERN_DRIFT', message: `Pattern fidelity 为 ${qa.patternFidelity}。`, refs: [pkg.scriptArchitecture.patternId || 'pattern:unknown'] }];
  const risks = [{ code: research ? 'RESEARCH_REQUIRED' : '', message: '需要研究的证据保留在 Claim Registry，不用猜测补全。', refs: claimRegistry.filter(claim => claim.supportStatus === 'RESEARCH_REQUIRED').map(claim => claim.claimId) }, { code: 'SOURCE_TRANSCRIPT_UNAVAILABLE', message: '来源转录不可用，未声称完成短语级原创性检测。', refs: ['transcript'] }, { code: 'SEMANTIC_SIMILARITY_UNAVAILABLE', message: '没有真实 embeddings，语义相似度保持不可用。', refs: ['embeddings'] }, { code: 'SCRIPT_CALIBRATION_REQUIRED', message: 'WPM、重复阈值和段落权重需要真实结果校准。', refs: ['script-writing-v1'] }].filter(item => item.code);
  const allSections = drafts;
  return { scriptId, scriptVersion: SCRIPT_WRITING_ALGORITHM_VERSION, architectureId: pkg.scriptArchitecture.architectureId, creativeDevelopmentPackageId: pkg.creativeDevelopmentPackageId, creativeBriefId: pkg.briefId, ideaId: pkg.ideaId, opening: allSections[0], sections: allSections, closing: allSections.at(-1), claimRegistry, evidenceRegistry, promiseDelivery: { state: promiseState, promiseElements, unresolvedElements: unresolved }, pacing, originality, qa, confidence, reasons, risks, blockers, readiness, provenance: { scriptId, scriptVersion: SCRIPT_WRITING_ALGORITHM_VERSION, architectureId: pkg.scriptArchitecture.architectureId, creativeDevelopmentPackageId: pkg.creativeDevelopmentPackageId, creativeBriefId: pkg.briefId, ideaId: pkg.ideaId, patternIds: uniq([pkg.scriptArchitecture.patternId || '', ...pkg.provenance.patternIds]), strategyVersion: pkg.provenance.strategyVersion, opportunityVersion: pkg.provenance.opportunityVersion, sourceCaseIds: pkg.originalityGuardrails.sourceCaseIds, evidenceIds: evidenceRegistry.map(item => item.evidenceId), validationContext: input.validationFeedbackVersion || null, algorithmVersions: uniq([SCRIPT_WRITING_ALGORITHM_VERSION, pkg.packageVersion]), generatedAt: input.capturedAt || pkg.provenance.evaluatedAt, evaluatedAt: pkg.provenance.evaluatedAt, snapshotId: input.snapshotId || pkg.provenance.snapshotId || null, calibrationStatus: SCRIPT_WRITING_CONFIG.calibrationStatus } };
}

export function buildScriptWritingIntelligence(input: ScriptWritingInput): ScriptWritingIntelligenceReport {
  const source = input.scriptDevelopment;
  const upstream = [...(source?.packages || []), ...(source?.blockedPackages || [])];
  const unique = [...new Map(upstream.map(pkg => [pkg.packageId, pkg])).values()];
  const drafts = unique.map(pkg => makeDraft(pkg, input));
  return { schemaVersion: 'script-writing.v1', algorithmVersion: SCRIPT_WRITING_ALGORITHM_VERSION, scope: 'LONG_FORM', drafts: drafts.filter(item => item.readiness !== 'BLOCKED'), blockedDrafts: drafts.filter(item => item.readiness === 'BLOCKED'), gaps: uniq([...(source?.gaps || []), 'P3 Phase 5 只生成可编辑 Script Draft 与证据注册表，不生成最终录音稿、分镜、镜头、图片/视频提示词、音频或 Canvas。', 'SOURCE_TRANSCRIPT_UNAVAILABLE：来源转录缺失时不声称完成短语级原创性检测。', 'SEMANTIC_SIMILARITY_UNAVAILABLE：embeddings 不可用时不伪造语义相似度。', 'SCRIPT_CALIBRATION_REQUIRED：WPM、重复阈值与 pacing 仍需校准。']), provenance: { source: source?.provenance.source || 'PUBLIC_YOUTUBE_METADATA', capturedAt: input.capturedAt || source?.provenance.capturedAt || null, snapshotId: input.snapshotId || source?.provenance.snapshotId || null, algorithmVersions: uniq([SCRIPT_WRITING_ALGORITHM_VERSION, source?.algorithmVersion || '']), calibrationStatus: SCRIPT_WRITING_CONFIG.calibrationStatus } };
}

export const buildScriptDraftIntelligence = buildScriptWritingIntelligence;

export function normalizeScriptWritingIntelligenceReport(value: unknown): ScriptWritingIntelligenceReport | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<ScriptWritingIntelligenceReport>;
  if (raw.schemaVersion !== 'script-writing.v1' || raw.algorithmVersion !== SCRIPT_WRITING_ALGORITHM_VERSION || raw.scope !== 'LONG_FORM' || !Array.isArray(raw.drafts) || !Array.isArray(raw.blockedDrafts)) return null;
  return raw as ScriptWritingIntelligenceReport;
}

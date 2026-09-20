import { accountStorageKey } from './account-storage.ts';
import { authHeaders, getSession } from './auth.ts';
import type { OpportunityUnit } from './product-convergence.ts';

export const AI_PRODUCTION_ANALYSIS_VERSION = 'ai-production-fit.v1';
const CLIENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
type SourceType = 'DATA_BACKED' | 'INFERENCE' | 'LOW_CONFIDENCE';
export type AiProductionLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type PatternLevel = AiProductionLevel | 'UNKNOWN';

export type AiProductionReason = { text: string; stance: 'POSITIVE' | 'NEGATIVE' | 'CAUTION'; sourceType: SourceType; evidenceRef: string };
export type AiProductionClaim = { text: string; sourceType: SourceType; evidenceRef: string };
export type AiProductionScore = { score: number; level: AiProductionLevel; confidence: number; reasons: AiProductionReason[] };
export type AiPatternSignal = { value: number | null; level: PatternLevel; confidence: number; sourceType: SourceType; evidenceRef: string; reason: string };
export type AiWorkflowStep = { stage: string; label: string; why: string; sourceType: SourceType; evidenceRef: string };
export type AiProductionFormat = {
  name: string; description: string; sourceType: SourceType; evidenceRef: string;
  productionFit: AiProductionScore; productionAdvantage: AiProductionScore; originalityCapacity: AiProductionScore;
  confidence: number; shortsSuitability: AiProductionLevel; longFormSuitability: AiProductionLevel;
  reasons: AiProductionClaim[]; risks: AiProductionClaim[]; workflow: AiWorkflowStep[];
};
export type AiProductionAnalysis = {
  version: typeof AI_PRODUCTION_ANALYSIS_VERSION;
  subject: string;
  productionFit: AiProductionScore;
  productionAdvantage: AiProductionScore;
  originalityCapacity: AiProductionScore;
  productionPattern: Record<string, AiPatternSignal>;
  risks: Array<{ text: string; severity: AiProductionLevel; sourceType: SourceType; evidenceRef: string; mitigation: string }>;
  recommendedWorkflow: AiWorkflowStep[];
  formats: AiProductionFormat[];
  evidence: Array<{ source: string; sourceType: SourceType; description: string }>;
};
export type AiProductionAnalysisResult = {
  analysis: AiProductionAnalysis;
  provenance: { source: string; supportBoundary: string; provider: string; model: string; generatedAt: string; analysisVersion: string };
  cache: { state: 'HIT' | 'MISS' | 'CLIENT_HIT'; ttlSeconds: number };
};

const sourceTypes = new Set<SourceType>(['DATA_BACKED', 'INFERENCE', 'LOW_CONFIDENCE']);
const scoreLevels = new Set<AiProductionLevel>(['HIGH', 'MEDIUM', 'LOW']);
const patternLevels = new Set<PatternLevel>(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const stances = new Set<AiProductionReason['stance']>(['POSITIVE', 'NEGATIVE', 'CAUTION']);
const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const score = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;

function requiredText(value: unknown, field: string) {
  const result = text(value); if (!result) throw new Error(`AI 制作适配结果缺少 ${field}。`); return result;
}

function normalizeScore(value: unknown, field: string): AiProductionScore {
  const item = object(value); const numeric = score(item?.score); const confidence = score(item?.confidence); const level = text(item?.level) as AiProductionLevel;
  if (numeric === null || confidence === null || !scoreLevels.has(level)) throw new Error(`AI 制作适配结果中的 ${field} 无效。`);
  const reasons = Array.isArray(item?.reasons) ? item.reasons.map((raw, index) => {
    const reason = object(raw); const stance = text(reason?.stance) as AiProductionReason['stance']; const sourceType = text(reason?.sourceType) as SourceType;
    if (!stances.has(stance) || !sourceTypes.has(sourceType)) throw new Error(`${field} 原因 ${index + 1} 无效。`);
    return { text: requiredText(reason?.text, `${field}.reasons.text`), stance, sourceType, evidenceRef: requiredText(reason?.evidenceRef, `${field}.reasons.evidenceRef`) };
  }).slice(0, 6) : [];
  if (!reasons.length) throw new Error(`${field} 缺少可解释原因。`);
  return { score: numeric, level, confidence, reasons };
}

function normalizeWorkflow(value: unknown, field: string): AiWorkflowStep[] {
  const rows = Array.isArray(value) ? value.slice(0, 8).map((raw, index) => {
    const item = object(raw); const sourceType = text(item?.sourceType) as SourceType;
    if (!sourceTypes.has(sourceType)) throw new Error(`${field} 步骤 ${index + 1} 无效。`);
    return { stage: requiredText(item?.stage, `${field}.stage`), label: requiredText(item?.label, `${field}.label`), why: requiredText(item?.why, `${field}.why`), sourceType, evidenceRef: requiredText(item?.evidenceRef, `${field}.evidenceRef`) };
  }) : [];
  if (rows.length < 3) throw new Error(`${field} 缺少完整步骤。`);
  return rows;
}

function normalizeClaim(value: unknown, field: string): AiProductionClaim {
  const item = object(value); const sourceType = text(item?.sourceType) as SourceType;
  if (!sourceTypes.has(sourceType)) throw new Error(`${field} 来源类型无效。`);
  return { text: requiredText(item?.text, `${field}.text`), sourceType, evidenceRef: requiredText(item?.evidenceRef, `${field}.evidenceRef`) };
}

export function normalizeAiProductionAnalysis(value: unknown): AiProductionAnalysis {
  const root = object(value); if (!root) throw new Error('AI 制作适配结果不是有效对象。');
  const patternInput = object(root.productionPattern); if (!patternInput) throw new Error('AI 制作适配结果缺少生产模式。');
  const productionPattern = Object.fromEntries(Object.entries(patternInput).map(([field, raw]) => {
    const item = object(raw); const numeric = item?.value === null ? null : score(item?.value); const confidence = score(item?.confidence); const level = text(item?.level) as PatternLevel; const sourceType = text(item?.sourceType) as SourceType;
    if ((item?.value !== null && numeric === null) || confidence === null || !patternLevels.has(level) || !sourceTypes.has(sourceType)) throw new Error(`生产模式 ${field} 无效。`);
    return [field, { value: numeric, level, confidence, sourceType, evidenceRef: requiredText(item?.evidenceRef, `productionPattern.${field}.evidenceRef`), reason: requiredText(item?.reason, `productionPattern.${field}.reason`) } satisfies AiPatternSignal];
  }));
  const risks = Array.isArray(root.risks) ? root.risks.slice(0, 6).map((raw, index) => {
    const item = object(raw); const severity = text(item?.severity) as AiProductionLevel; const sourceType = text(item?.sourceType) as SourceType;
    if (!scoreLevels.has(severity) || !sourceTypes.has(sourceType)) throw new Error(`风险 ${index + 1} 无效。`);
    return { text: requiredText(item?.text, 'risks.text'), severity, sourceType, evidenceRef: requiredText(item?.evidenceRef, 'risks.evidenceRef'), mitigation: requiredText(item?.mitigation, 'risks.mitigation') };
  }) : [];
  const formats = Array.isArray(root.formats) ? root.formats.slice(0, 10).map((raw, index) => {
    const item = object(raw); const confidence = score(item?.confidence); const sourceType = text(item?.sourceType) as SourceType; const shortsSuitability = text(item?.shortsSuitability) as AiProductionLevel; const longFormSuitability = text(item?.longFormSuitability) as AiProductionLevel;
    if (confidence === null || !sourceTypes.has(sourceType) || !scoreLevels.has(shortsSuitability) || !scoreLevels.has(longFormSuitability)) throw new Error(`内容形式 ${index + 1} 无效。`);
    const reasons = Array.isArray(item?.reasons) ? item.reasons.slice(0, 4).map((reason, claimIndex) => normalizeClaim(reason, `formats.${index}.reasons.${claimIndex}`)) : [];
    const formatRisks = Array.isArray(item?.risks) ? item.risks.slice(0, 4).map((risk, claimIndex) => normalizeClaim(risk, `formats.${index}.risks.${claimIndex}`)) : [];
    if (!reasons.length || !formatRisks.length) throw new Error(`内容形式 ${index + 1} 缺少原因或风险。`);
    return { name: requiredText(item?.name, `formats.${index}.name`), description: requiredText(item?.description, `formats.${index}.description`), sourceType, evidenceRef: requiredText(item?.evidenceRef, `formats.${index}.evidenceRef`), productionFit: normalizeScore(item?.productionFit, `formats.${index}.productionFit`), productionAdvantage: normalizeScore(item?.productionAdvantage, `formats.${index}.productionAdvantage`), originalityCapacity: normalizeScore(item?.originalityCapacity, `formats.${index}.originalityCapacity`), confidence, shortsSuitability, longFormSuitability, reasons, risks: formatRisks, workflow: normalizeWorkflow(item?.workflow, `formats.${index}.workflow`) };
  }) : [];
  if (formats.length < 5 || !risks.length) throw new Error('AI 制作适配结果缺少内容形式或风险。');
  const evidence = Array.isArray(root.evidence) ? root.evidence.slice(0, 12).map((raw, index) => { const item = object(raw); const sourceType = text(item?.sourceType) as SourceType; if (!sourceTypes.has(sourceType)) throw new Error(`证据 ${index + 1} 无效。`); return { source: requiredText(item?.source, 'evidence.source'), sourceType, description: requiredText(item?.description, 'evidence.description') }; }) : [];
  if (!evidence.length) throw new Error('AI 制作适配结果缺少证据说明。');
  return { version: AI_PRODUCTION_ANALYSIS_VERSION, subject: requiredText(root.subject, 'subject'), productionFit: normalizeScore(root.productionFit, 'productionFit'), productionAdvantage: normalizeScore(root.productionAdvantage, 'productionAdvantage'), originalityCapacity: normalizeScore(root.originalityCapacity, 'originalityCapacity'), productionPattern, risks, recommendedWorkflow: normalizeWorkflow(root.recommendedWorkflow, 'recommendedWorkflow'), formats, evidence };
}

function cacheKey(unit: OpportunityUnit, locale: 'zh' | 'en') {
  const signature = JSON.stringify({ version: AI_PRODUCTION_ANALYSIS_VERSION, locale, id: unit.id, format: unit.format, niche: unit.niche, subNiche: unit.subNiche, audience: unit.audience, pattern: unit.pattern, market: { videos: unit.market.videos, creators: unit.market.creators, previousVideos: unit.market.previousVideos, windowDays: unit.market.windowDays, growth: unit.market.growth, supplyGrowth: unit.market.supplyGrowth, lifecycle: unit.market.lifecycle, confidence: unit.market.confidence, quality: unit.market.quality, facts: unit.market.facts, provenance: unit.market.provenance, capturedAt: unit.market.capturedAt }, representativeVideos: unit.representativeVideos, tests: unit.tests.map(test => ({ direction: test.direction, audienceQuestion: test.audienceQuestion, pattern: test.pattern, promise: test.promise })) });
  let hash = 2166136261;
  for (let index = 0; index < signature.length; index += 1) { hash ^= signature.charCodeAt(index); hash = Math.imul(hash, 16777619); }
  return accountStorageKey(`signalcraft:ai-production:${(hash >>> 0).toString(36)}`, getSession());
}

function readCached(unit: OpportunityUnit, locale: 'zh' | 'en'): AiProductionAnalysisResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(unit, locale)); if (!raw) return null;
    const item = object(JSON.parse(raw)); const expiresAt = typeof item?.expiresAt === 'number' ? item.expiresAt : 0;
    if (expiresAt <= Date.now()) { localStorage.removeItem(cacheKey(unit, locale)); return null; }
    const result = object(item?.result); if (!result) return null;
    const provenance = object(result.provenance);
    return { analysis: normalizeAiProductionAnalysis(result.analysis), provenance: { source: text(provenance?.source), supportBoundary: text(provenance?.supportBoundary), provider: text(provenance?.provider), model: text(provenance?.model), generatedAt: text(provenance?.generatedAt), analysisVersion: text(provenance?.analysisVersion) }, cache: { state: 'CLIENT_HIT', ttlSeconds: Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) } };
  } catch { return null; }
}

function writeCached(unit: OpportunityUnit, locale: 'zh' | 'en', result: AiProductionAnalysisResult) {
  try { localStorage.setItem(cacheKey(unit, locale), JSON.stringify({ expiresAt: Date.now() + CLIENT_CACHE_TTL_MS, result })); } catch { /* Analysis remains usable when browser storage is unavailable. */ }
}

export async function loadAiProductionAnalysis(unit: OpportunityUnit, options: { signal?: AbortSignal; force?: boolean; locale?: 'zh' | 'en' } = {}): Promise<AiProductionAnalysisResult> {
  const locale = options.locale === 'en' ? 'en' : 'zh';
  if (!options.force) { const cached = readCached(unit, locale); if (cached) return cached; }
  const response = await fetch('/api/longform-production', { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', ...authHeaders() }, body: JSON.stringify({ action: 'AI_PRODUCTION_ANALYSIS', opportunity: unit, locale }), cache: 'no-store', signal: options.signal });
  const payload: unknown = await response.json().catch(() => null); const root = object(payload);
  if (!response.ok) throw new Error(text(root?.error) || (response.status === 401 ? '请先登录后查看 AI 制作适配分析。' : 'AI 制作适配分析暂时不可用。'));
  const provenance = object(root?.provenance); const cache = object(root?.cache); const state = text(cache?.state);
  const result: AiProductionAnalysisResult = { analysis: normalizeAiProductionAnalysis(root?.aiProductionAnalysis), provenance: { source: text(provenance?.source), supportBoundary: text(provenance?.supportBoundary), provider: text(provenance?.provider), model: text(provenance?.model), generatedAt: text(provenance?.generatedAt), analysisVersion: text(provenance?.analysisVersion) }, cache: { state: state === 'HIT' ? 'HIT' : 'MISS', ttlSeconds: typeof cache?.ttlSeconds === 'number' ? Math.max(0, Math.round(cache.ttlSeconds)) : 0 } };
  writeCached(unit, locale, result); return result;
}

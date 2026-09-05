import type { OpportunityRadarEvent } from './opportunity-radar.ts';
import type { ShortformRadarEvent } from './shortform-opportunity-radar.ts';
import type { LongformOpportunity } from './longform.ts';
import type { PatternTrendState } from './content-pattern-trends.ts';

export const CONVERGENCE_VERSION = 'discovery.v1';
export type ContentFormat = 'SHORTS' | 'LONG_FORM';
export type Level = 'LOW' | 'MEDIUM' | 'HIGH';
export type CreatorProfile = {
  format?: ContentFormat | 'BOTH';
  presence?: 'FACELESS' | 'ON_CAMERA' | 'EITHER';
  weeklyTime?: Level;
  aiSkill?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  budget?: Level;
  goal?: 'ADS' | 'AFFILIATE' | 'SPONSOR' | 'PRODUCT' | 'TRAFFIC' | 'BRAND' | 'UNSURE';
};
export const PROFILE_OPTIONS = {
  format: ['SHORTS', 'LONG_FORM', 'BOTH'], presence: ['FACELESS', 'ON_CAMERA', 'EITHER'],
  weeklyTime: ['LOW', 'MEDIUM', 'HIGH'], aiSkill: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
  budget: ['LOW', 'MEDIUM', 'HIGH'], goal: ['ADS', 'AFFILIATE', 'SPONSOR', 'PRODUCT', 'TRAFFIC', 'BRAND', 'UNSURE'],
} as const;
export function normalizeProfile(value: unknown): CreatorProfile {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(Object.entries(PROFILE_OPTIONS).flatMap(([key, options]) => {
    const item = (value as Record<string, unknown>)[key];
    return typeof item === 'string' && (options as readonly string[]).includes(item) ? [[key, item]] : [];
  }));
}
export type Decision = 'RECOMMENDED' | 'TEST' | 'WATCH' | 'DEPRIORITIZE' | 'AVOID' | 'INSUFFICIENT';
export type EntryWindow = 'OPEN' | 'NARROWING' | 'CLOSED' | 'UNDETERMINED';
export type OriginalityRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'VERY_HIGH' | 'UNKNOWN';
// Separate rule sets: never compare raw scores or windows across formats.
export const DISCOVERY_RULES = Object.freeze({
  SHORTS: Object.freeze({ minVideos: 6, minCreators: 3, minPrevious: 4, openGrowth: 25, crowdedShare: 75, maxTests: 10, calibrationStatus: 'CALIBRATION_REQUIRED' }),
  LONG_FORM: Object.freeze({ minVideos: 5, minCreators: 3, minPrevious: 3, openGrowth: 15, crowdedShare: 65, maxTests: 3, calibrationStatus: 'CALIBRATION_REQUIRED' }),
});
export type TestDirection = {
  id: string; format: ContentFormat; group: 'CORE' | 'ADAPTATION' | 'EXPLORE';
  direction: string; audienceQuestion: string; patternId: string; pattern: string;
  promise: string; differentiation: string[]; evidenceNeeded: string[];
  visualDirection: string; difficulty: Level | 'UNKNOWN'; mainRisk: string; whyTest: string;
  sourceVideoIds: string[]; sourceIdeaId?: string;
  originalityRisk?: OriginalityRisk;
  originalityReason?: string;
  provenance: 'EXISTING_IDEA_EVIDENCE' | 'METADATA_HYPOTHESIS' | 'USER_CONFIRMED_HYPOTHESIS';
};
export type OpportunityUnit = {
  id: string; format: ContentFormat; niche: string; subNiche: string | null;
  pattern: { id: string; label: string; trend: PatternTrendState; provenance: string } | null;
  market: { videos: number; creators: number; previousVideos: number; windowDays: number | null;
    growth: number | null; concentration: number | null; lifecycle: string; confidence: string;
    quality: string; facts: string[]; evidenceVideoIds: string[]; provenance: string; capturedAt: string | null };
  requirements: { presence?: 'FACELESS' | 'ON_CAMERA'; time?: Level; budget?: Level; aiSkill?: CreatorProfile['aiSkill']; goal?: CreatorProfile['goal']; source?: string };
  originality: { risk: OriginalityRisk; reason: string };
  tests: TestDirection[];
};
const specific = (value: string | undefined | null) => Boolean(value?.trim() && !/^(unknown|unidentified|short_form|long_form|uncertain)$/i.test(value.trim()) && !/未知|未识别|待识别/.test(value));
export function fromRadar(event: OpportunityRadarEvent | ShortformRadarEvent, format: ContentFormat): OpportunityUnit {
  const mechanism = 'mechanism' in event ? event.mechanism : event.format;
  const pattern = specific(mechanism) ? { id: `${format}:${mechanism}`, label: mechanism, trend: 'INSUFFICIENT' as const, provenance: 'RADAR_CLASSIFICATION_NOT_TEMPORAL_PATTERN_EVIDENCE' } : null;
  // The source does not expose a verified sub-niche taxonomy. Do not invent one
  // from a broad category or pretend that a generated event label is a sub-niche.
  return {
    id: event.id, format, niche: event.topic, subNiche: null, pattern,
    market: { videos: event.sampleVideoCount, creators: event.independentChannelCount, previousVideos: event.baseline.previousSampleCount,
      windowDays: event.baseline.windowDays, growth: event.metrics.demandProxyGrowth ?? null,
      concentration: event.creatorConcentrationTop3 ?? null, lifecycle: event.lifecycle, confidence: event.confidence,
      quality: event.dataQuality, facts: [...event.facts], evidenceVideoIds: [...event.evidenceVideoIds], provenance: event.evidence.provenance, capturedAt: event.lastUpdatedAt || null },
    requirements: {}, originality: { risk: 'UNKNOWN', reason: '雷达元数据不包含原创性核验；请检查具体人物、例子、画面和结局。' }, tests: [],
  };
}

export function fromLongform(opportunity: LongformOpportunity): OpportunityUnit {
  const candidates = opportunity.ideaIntelligence?.candidates || [];
  const candidate = candidates.find(item => item.validationReadiness === 'READY' || item.validationReadiness === 'READY_WITH_CAUTION');
  const patternId = candidate?.patternIds[0];
  const aggregation = opportunity.contentPatterns?.aggregations.find(item => item.pattern.patternId === patternId)
    || opportunity.contentPatterns?.aggregations.find(item => item.winningPattern.status === 'WINNING');
  const pattern = aggregation?.pattern;
  const trend = opportunity.contentPatternTrend?.assessments.find(item => item.pattern.patternId === pattern?.patternId);
  const novelty = candidate?.novelty.state;
  const risk: OriginalityRisk = novelty === 'DUPLICATE' ? 'VERY_HIGH' : novelty === 'TOO_SIMILAR' ? 'HIGH' : novelty === 'NOVEL' ? 'LOW' : novelty === 'ACCEPTABLE_VARIATION' ? 'MODERATE' : 'UNKNOWN';
  const tests: TestDirection[] = candidates.filter(item => item.state === 'ACTIVE' && ['READY', 'READY_WITH_CAUTION'].includes(item.validationReadiness) && item.patternIds.includes(pattern?.patternId || '') && item.provenance.sourceVideoIds.length > 0 && item.concept.coreQuestion.trim()).map(item => ({
    id: item.ideaId, sourceIdeaId: item.ideaId, format: 'LONG_FORM', group: 'CORE', direction: item.concept.workingLabel,
    audienceQuestion: item.concept.coreQuestion, patternId: pattern!.patternId, pattern: pattern!.label,
    promise: item.concept.audiencePromise, differentiation: [item.concept.differentiation],
    evidenceNeeded: item.evidence.map(e => e.message).slice(0, 3), visualDirection: '用可核验资料说明观众问题；画面方案待制作阶段确认。',
    difficulty: 'UNKNOWN', mainRisk: item.risks[0]?.message || '公开元数据无法确认内容细节，需要人工复核。',
    whyTest: item.concept.rationale, sourceVideoIds: [...item.provenance.sourceVideoIds], provenance: 'EXISTING_IDEA_EVIDENCE',
    originalityRisk: item.novelty.state === 'DUPLICATE' ? 'VERY_HIGH' : item.novelty.state === 'TOO_SIMILAR' ? 'HIGH' : item.novelty.state === 'NOVEL' ? 'LOW' : item.novelty.state === 'ACCEPTABLE_VARIATION' ? 'MODERATE' : 'UNKNOWN',
    originalityReason: item.novelty.evidence.join('；'),
  }));
  return {
    id: opportunity.key, format: 'LONG_FORM', niche: opportunity.topic, subNiche: specific(candidate?.concept.subject) && candidate?.concept.subject !== opportunity.topic ? candidate!.concept.subject : null,
    pattern: pattern ? { id: pattern.patternId, label: pattern.label, trend: trend?.state || 'INSUFFICIENT', provenance: aggregation!.provenance.algorithmVersion } : null,
    market: { videos: opportunity.sampleSize, creators: opportunity.channelCount,
      previousVideos: opportunity.contentPatternTrend?.previousReport?.input.longFormVideos || 0, windowDays: null,
      growth: opportunity.metrics.demandProxyGrowth ?? null, concentration: opportunity.metrics.creatorConcentrationTop3 ?? null,
      lifecycle: opportunity.nicheLifecycle?.lifecycle.state || 'UNKNOWN', confidence: opportunity.confidenceLevel || opportunity.confidenceLabel,
      quality: opportunity.confidenceLevel === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'PARTIAL', facts: [],
      evidenceVideoIds: opportunity.representativeVideos.map(item => item.videoId),
      provenance: opportunity.upstreamAssessment?.source || 'PUBLIC_YOUTUBE_METADATA', capturedAt: opportunity.upstreamAssessment?.capturedAt || null },
    requirements: {}, originality: { risk, reason: candidate?.novelty.evidence.join('；') || '暂无已核验原创性结论。' }, tests,
  };
}

export function entryWindow(unit: OpportunityUnit): EntryWindow {
  const rules = DISCOVERY_RULES[unit.format];
  const m = unit.market;
  if (m.quality === 'INSUFFICIENT' || m.quality === 'STALE' || m.videos < rules.minVideos || m.creators < rules.minCreators || m.previousVideos < rules.minPrevious) return 'UNDETERMINED';
  if (['DECLINING', 'SATURATING', 'SATURATED'].includes(m.lifecycle)) return 'CLOSED';
  if (m.lifecycle === 'CROWDED' || (m.concentration !== null && m.concentration >= rules.crowdedShare)) return 'NARROWING';
  if (m.growth !== null && m.growth >= rules.openGrowth) return 'OPEN';
  return 'UNDETERMINED';
}
export function marketDecision(unit: OpportunityUnit): Decision {
  const m = unit.market, rules = DISCOVERY_RULES[unit.format];
  if (m.videos < rules.minVideos || m.creators < rules.minCreators || ['INSUFFICIENT', 'STALE'].includes(m.quality) || m.confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  const window = entryWindow(unit);
  if (window === 'CLOSED') return 'AVOID';
  if (unit.pattern?.trend === 'DILUTING' || unit.pattern?.trend === 'DECLINING' || window === 'NARROWING') return 'DEPRIORITIZE';
  if (!unit.pattern || !unit.subNiche) return 'WATCH';
  if (window === 'OPEN' && m.confidence === 'HIGH') return 'RECOMMENDED';
  return 'TEST';
}
export type FitReason = { text: string; source: 'EXPLICIT_PROFILE' | 'MARKET_EVIDENCE'; field: string; evidence: string };
export function creatorFit(unit: OpportunityUnit, profile: CreatorProfile) {
  const reasons: FitReason[] = [], whyNot: FitReason[] = [];
  let rank = 0;
  if (profile.format && profile.format !== 'BOTH') {
    const match = profile.format === unit.format;
    rank += match ? 4 : -8;
    (match ? reasons : whyNot).push({ text: match ? '符合你选择的内容形态' : '不符合你当前选择的内容形态', source: 'EXPLICIT_PROFILE', field: 'format', evidence: `${profile.format} / ${unit.format}` });
  }
  const r = unit.requirements;
  const compare = (field: keyof CreatorProfile, expected: string | undefined, mismatch: boolean) => {
    if (!expected || !r.source || !profile[field]) return;
    rank += mismatch ? -3 : 2;
    (mismatch ? whyNot : reasons).push({ text: mismatch ? `${field} 与已知制作要求不匹配` : `${field} 符合已知制作要求`, source: 'EXPLICIT_PROFILE', field, evidence: `${profile[field]} / ${expected}; ${r.source}` });
  };
  const level = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  compare('presence', r.presence, profile.presence !== 'EITHER' && profile.presence !== r.presence);
  compare('weeklyTime', r.time, Boolean(profile.weeklyTime && r.time && level[profile.weeklyTime] < level[r.time]));
  compare('budget', r.budget, Boolean(profile.budget && r.budget && level[profile.budget] < level[r.budget]));
  const skills = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };
  compare('aiSkill', r.aiSkill, Boolean(profile.aiSkill && r.aiSkill && skills[profile.aiSkill] < skills[r.aiSkill]));
  compare('goal', r.goal, profile.goal !== 'UNSURE' && profile.goal !== r.goal);
  if (unit.market.creators >= DISCOVERY_RULES[unit.format].minCreators) reasons.push({ text: `${unit.market.creators} 个独立频道提供公开样本`, source: 'MARKET_EVIDENCE', field: 'creators', evidence: unit.market.provenance });
  return { level: whyNot.length ? 'CONSTRAINED' : reasons.some(r => r.source === 'EXPLICIT_PROFILE') ? 'ALIGNED' : 'UNKNOWN', rank, reasons: reasons.slice(0, 3), whyNot: whyNot.slice(0, 3) };
}
const priority: Record<Decision, number> = { RECOMMENDED: 6, TEST: 5, WATCH: 3, DEPRIORITIZE: 1, AVOID: -3, INSUFFICIENT: -4 };
export function recommend(units: readonly OpportunityUnit[], profile: CreatorProfile, format: ContentFormat) {
  const unique = [...new Map(units.filter(u => u.format === format).map(unit => [unit.id, unit])).values()];
  const market = unique.map(unit => ({ unit, decision: marketDecision(unit), fit: creatorFit(unit, profile) }))
    .sort((a, b) => priority[b.decision] - priority[a.decision] || a.unit.id.localeCompare(b.unit.id));
  const ranked = [...market].sort((a, b) => (priority[b.decision] + b.fit.rank) - (priority[a.decision] + a.fit.rank) || a.unit.id.localeCompare(b.unit.id));
  const eligible = ranked.filter(item => !['AVOID', 'INSUFFICIENT', 'DEPRIORITIZE'].includes(item.decision) && item.fit.level !== 'CONSTRAINED');
  const top = eligible.slice(0, 3);
  const rest = eligible.filter(item => !top.includes(item));
  const explore = rest.find(item => !top.some(t => t.unit.niche === item.unit.niche)) || rest[0] || null;
  return { top, explore, market, ranked };
}
export function differentiation(unit: OpportunityUnit, alternative = false) {
  const highRisk = ['HIGH', 'VERY_HIGH'].includes(unit.originality.risk);
  return { requiresReview: highRisk, retain: unit.pattern?.label || '先核验可复用机制',
    axes: alternative ? [
      { axis: 'AUDIENCE', suggestion: '改为一个具体受众的问题，不照搬原案例的人物。' },
      { axis: 'POV', suggestion: '用相反或被忽略的观察角度重新验证同一机制。' },
      { axis: 'VISUAL_STYLE', suggestion: '使用自己的资料与视觉表达，不复刻镜头。' },
    ] : [
      { axis: 'TOPIC', suggestion: '保留机制，换一个你能独立研究的具体对象。' },
      { axis: 'EVIDENCE', suggestion: '补充自己的来源、实验或可核验证据。' },
      { axis: 'PAYOFF', suggestion: '用新证据得出自己的结论，不复制原结局。' },
    ], provenance: 'RULE_BASED_SUGGESTION_NOT_OBSERVED_FACT' };
}
export function firstTests(unit: OpportunityUnit) {
  const seen = new Set<string>(), groups = { CORE: 0, ADAPTATION: 0, EXPLORE: 0 };
  const cap = { CORE: 4, ADAPTATION: 3, EXPLORE: 3 };
  return unit.tests.filter(test => {
    const key = test.audienceQuestion.trim().toLowerCase();
    if (test.format !== unit.format || !key || seen.has(key) || !test.sourceVideoIds.length || test.patternId !== unit.pattern?.id) return false;
    if (unit.format === 'SHORTS' && groups[test.group] >= cap[test.group]) return false;
    seen.add(key); groups[test.group]++; return true;
  }).slice(0, DISCOVERY_RULES[unit.format].maxTests);
}
export function addReviewedShortTest(unit: OpportunityUnit, input: { id: string; subNiche: string; question: string; promise: string; sourceVideoId: string; group: TestDirection['group'] }): OpportunityUnit | null {
  if (unit.format !== 'SHORTS' || !unit.pattern || !['CORE', 'ADAPTATION', 'EXPLORE'].includes(input.group) || !input.subNiche.trim() || input.subNiche.trim() === unit.niche || !input.question.trim() || !input.promise.trim() || !unit.market.evidenceVideoIds.includes(input.sourceVideoId)) return null;
  if (unit.tests.some(test => test.audienceQuestion.trim() === input.question.trim())) return null;
  const test: TestDirection = { id: input.id, format: 'SHORTS', group: input.group, direction: input.subNiche.trim(),
    audienceQuestion: input.question.trim(), pattern: unit.pattern.label, patternId: unit.pattern.id, promise: input.promise.trim(),
    differentiation: differentiation(unit).axes.map(axis => axis.suggestion), evidenceNeeded: ['复核来源视频，仅保留机制；用自己的素材验证观众问题。'],
    visualDirection: '首个画面说明问题，中段展示原创证据，结尾兑现承诺；具体镜头待制作。', difficulty: 'UNKNOWN',
    mainRisk: '这是用户确认的待测假设，不是已证明的爆款规律。', whyTest: '用一条有来源的小样本验证明确的观众问题。',
    sourceVideoIds: [input.sourceVideoId], provenance: 'USER_CONFIRMED_HYPOTHESIS' };
  return { ...unit, subNiche: input.subNiche.trim(), tests: [...unit.tests, test] };
}
export type ProductionHandoff = { version: typeof CONVERGENCE_VERSION; opportunity: OpportunityUnit; test: TestDirection; decision: Decision; entryWindow: EntryWindow; creatorProfile: CreatorProfile; differentiation: ReturnType<typeof differentiation>; originalityReviewed: boolean; source: 'EXPLICIT_TEST_SELECTION'; automaticGeneration: false };
export function buildProductionHandoff(unit: OpportunityUnit, profile: CreatorProfile, testId: string, reviewed: boolean, alternative = false): ProductionHandoff | null {
  const test = firstTests(unit).find(item => item.id === testId);
  const selectedUnit = test?.originalityRisk ? { ...unit, originality: { risk: test.originalityRisk, reason: test.originalityReason || unit.originality.reason } } : unit;
  if (!test || !['RECOMMENDED', 'TEST', 'WATCH'].includes(marketDecision(unit)) || (differentiation(selectedUnit).requiresReview && !reviewed)) return null;
  return { version: CONVERGENCE_VERSION, opportunity: selectedUnit, test, decision: marketDecision(unit), entryWindow: entryWindow(unit), creatorProfile: normalizeProfile(profile), differentiation: differentiation(selectedUnit, alternative), originalityReviewed: reviewed, source: 'EXPLICIT_TEST_SELECTION', automaticGeneration: false };
}

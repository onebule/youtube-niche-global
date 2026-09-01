import type { LongformOpportunity, LongformResponse } from './longform';
import { DATA_QUALITY_SCHEMA_VERSION, deriveDataQuality, normalizeDataQuality, normalizeEvidence } from './evidence-contract.ts';
import { evaluateLongformEntryDecision } from './entry-decision.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const textOr = (value: unknown, fallback: string) => typeof value === 'string' && value.trim() ? value : fallback;
const nullableText = (value: unknown) => typeof value === 'string' && value.trim() ? value : null;
const numberOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const nullableNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const textList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const recommendationValues = new Set<NonNullable<LongformOpportunity['recommendation']>>(['BUILD', 'TEST', 'WATCH', 'AVOID', 'INSUFFICIENT_DATA']);
const confidenceValues = new Set<LongformOpportunity['confidenceLabel']>(['HIGH', 'MEDIUM', 'LOW']);

function normalizeRepresentativeVideo(value: unknown, index: number): LongformOpportunity['representativeVideos'][number] {
  const raw = isRecord(value) ? value : {};
  return {
    videoId: textOr(raw.videoId, `unknown-video-${index + 1}`),
    title: textOr(raw.title, 'Untitled public video'),
    titleZh: nullableText(raw.titleZh),
    channelTitle: nullableText(raw.channelTitle),
    thumbnail: nullableText(raw.thumbnail),
    channelAvatar: nullableText(raw.channelAvatar),
    views: nullableNumber(raw.views),
    durationSeconds: nullableNumber(raw.durationSeconds),
    sourceMarket: nullableText(raw.sourceMarket),
    growthRate: nullableNumber(raw.growthRate),
    breakoutScore: nullableNumber(raw.breakoutScore),
    sourceUrl: nullableText(raw.sourceUrl),
  };
}

function normalizeOpportunity(value: unknown, index: number): LongformOpportunity | null {
  if (!isRecord(value)) return null;
  const rawMetrics = isRecord(value.metrics) ? value.metrics : {};
  const metrics = Object.fromEntries(Object.entries(rawMetrics).flatMap(([key, metricValue]): Array<[string, number | null]> => {
    if (metricValue === null) return [[key, null]];
    return typeof metricValue === 'number' && Number.isFinite(metricValue) ? [[key, metricValue]] : [];
  })) as Record<string, number | null>;
  const execution = isRecord(value.execution) ? value.execution : {};
  const rawConfidenceLabel = textOr(value.confidenceLabel, 'LOW') as LongformOpportunity['confidenceLabel'];
  const rawRecommendation = textOr(value.recommendation, '') as NonNullable<LongformOpportunity['recommendation']>;
  return {
    key: textOr(value.key, `longform-direction-${index + 1}`),
    topic: textOr(value.topic, '未分类方向'),
    mechanism: textOr(value.mechanism, '待识别机制'),
    productionType: textOr(value.productionType, '待识别形式'),
    sampleSize: Math.max(0, Math.round(numberOr(value.sampleSize, 0))),
    channelCount: Math.max(0, Math.round(numberOr(value.channelCount, 0))),
    medianViews: nullableNumber(value.medianViews),
    marketOpportunity: nullableNumber(value.marketOpportunity),
    executionFit: nullableNumber(value.executionFit),
    entryScore: nullableNumber(value.entryScore),
    confidence: Math.max(0, Math.min(100, Math.round(numberOr(value.confidence, 0)))),
    confidenceLabel: confidenceValues.has(rawConfidenceLabel) ? rawConfidenceLabel : 'LOW',
    recommendation: recommendationValues.has(rawRecommendation) ? rawRecommendation : undefined,
    lanes: textList(value.lanes),
    metrics,
    execution: { score: nullableNumber(execution.score), coverage: Math.max(0, Math.min(100, Math.round(numberOr(execution.coverage, 0)))), rationale: textOr(execution.rationale, '暂无执行适配说明。') },
    representativeVideos: Array.isArray(value.representativeVideos) ? value.representativeVideos.map(normalizeRepresentativeVideo) : [],
  };
}

/**
 * Normalizes older/partial upstream responses at the long-form boundary.
 * Missing data remains null or an empty collection so the UI can show UNKNOWN.
 */
export function normalizeLongformResponse(payload: unknown): LongformResponse {
  const raw = isRecord(payload) ? payload : {};
  const rawScope = isRecord(raw.dataScope) ? raw.dataScope : {};
  const rawAudit = isRecord(raw.availabilityAudit) ? raw.availabilityAudit : {};
  const rawFields = isRecord(rawAudit.fields) ? rawAudit.fields : {};
  const fields = Object.fromEntries(Object.entries(rawFields).flatMap(([key, value]) => {
    if (!isRecord(value)) return [];
    return [[key, { available: value.available === true, provenance: textOr(value.provenance, 'upstream field audit'), confidence: textOr(value.confidence, 'UNKNOWN'), note: nullableText(value.note) }]];
  }));
  const availableFields = Object.values(fields).filter(field => field.available).length;
  const unavailableFields = Math.max(0, Object.keys(fields).length - availableFields);
  const rawLanes = isRecord(raw.lanes) ? raw.lanes : {};
  const opportunities = Array.isArray(raw.opportunities) ? raw.opportunities.map(normalizeOpportunity).filter((item): item is LongformOpportunity => Boolean(item)) : [];
  const rawQuota = isRecord(raw.quota) ? raw.quota : null;
  const topLevel = raw as Record<string, unknown>;
  const evidence = normalizeEvidence(raw.evidence, { source: textOr(rawScope.source, 'unknown'), algorithmVersion: nullableText(topLevel.algorithmVersion), snapshotId: nullableText(topLevel.snapshotId), inputSnapshotId: nullableText(topLevel.inputSnapshotId), requestId: nullableText(topLevel.requestId), capturedAt: nullableText(topLevel.capturedAt) || nullableText(rawScope.latestCapturedAt) });
  const derivedQuality = deriveDataQuality({
    sampleVideos: Math.max(Number(rawScope.longformRows) || 0, opportunities.reduce((sum, opportunity) => sum + opportunity.sampleSize, 0)),
    sampleChannels: Number.isFinite(Number(rawScope.sampleChannels)) ? Number(rawScope.sampleChannels) : null,
    completeness: Number.isFinite(Number(rawScope.classificationCoverage)) ? Number(rawScope.classificationCoverage) : null,
    capturedAt: nullableText(rawScope.latestCapturedAt),
    source: textOr(rawScope.source, 'unknown'),
    missingFields: [...new Set([...textList(raw.gaps), ...Object.entries(fields).filter(([, field]) => !field.available).map(([key]) => key)])],
  });
  const dataQuality = normalizeDataQuality(raw.dataQuality, derivedQuality);
  const maxOpportunityChannels = opportunities.reduce((max, opportunity) => Math.max(max, opportunity.channelCount), 0);
  const effectiveDataQuality = dataQuality.sampleChannels === null && maxOpportunityChannels > 0
    ? normalizeDataQuality(dataQuality, { sampleChannels: maxOpportunityChannels })
    : dataQuality;
  const enrichedOpportunities = opportunities.map(opportunity => {
    const assessment = evaluateLongformEntryDecision({
      sampleSize: opportunity.sampleSize,
      channelCount: opportunity.channelCount,
      representativeVideoCount: opportunity.representativeVideos.length,
      metrics: opportunity.metrics,
      marketOpportunity: opportunity.marketOpportunity,
      executionFit: opportunity.executionFit,
      entryScore: opportunity.entryScore,
      recommendation: opportunity.recommendation,
      dataQuality: effectiveDataQuality,
      evidence,
    });
    return {
      ...opportunity,
      confidenceLevel: assessment.confidence,
      performance: assessment.performance,
      entryDecision: assessment.decision,
      upstreamAssessment: {
        source: 'UPSTREAM_OPAQUE' as const,
        algorithmVersion: evidence.algorithmVersion || null,
        snapshotId: evidence.snapshotId || null,
        inputSnapshotId: evidence.inputSnapshotId || null,
        capturedAt: evidence.capturedAt || null,
        scores: { marketOpportunity: opportunity.marketOpportunity, executionFit: opportunity.executionFit, entryScore: opportunity.entryScore },
        recommendation: opportunity.recommendation || null,
        decisionReasons: evidence.decisionReasons || [],
      },
    };
  });
  return {
    schemaVersion: textOr(raw.schemaVersion, DATA_QUALITY_SCHEMA_VERSION),
    evidence,
    dataQuality: effectiveDataQuality,
    available: raw.available === true,
    engineVersion: textOr(raw.engineVersion, 'unknown'),
    dataScope: {
      source: textOr(rawScope.source, 'unknown'),
      markets: textList(rawScope.markets),
      window: textOr(rawScope.window, '28d'),
      latestCapturedAt: nullableText(rawScope.latestCapturedAt),
      collectedRows: Math.max(0, Math.round(numberOr(rawScope.collectedRows, 0))),
      longformRows: Math.max(0, Math.round(numberOr(rawScope.longformRows, 0))),
      uncertainRows: Math.max(0, Math.round(numberOr(rawScope.uncertainRows, 0))),
      classificationCoverage: Math.max(0, Math.min(100, Math.round(numberOr(rawScope.classificationCoverage, 0)))),
      longformShare: nullableNumber(rawScope.longformShare) ?? undefined,
      calculationPoolLimit: nullableNumber(rawScope.calculationPoolLimit) ?? undefined,
      visibleOpportunityLimit: nullableNumber(rawScope.visibleOpportunityLimit),
      marketSampleLimit: nullableNumber(rawScope.marketSampleLimit) ?? undefined,
      failedMarkets: textList(rawScope.failedMarkets),
      note: textOr(rawScope.note, '暂无数据范围说明。'),
    },
    availabilityAudit: {
      coverage: Math.max(0, Math.min(100, Math.round(numberOr(rawAudit.coverage, Object.keys(fields).length ? (availableFields / Object.keys(fields).length) * 100 : 0)))),
      availableFields: Math.max(0, Math.round(numberOr(rawAudit.availableFields, availableFields))),
      unavailableFields: Math.max(0, Math.round(numberOr(rawAudit.unavailableFields, unavailableFields))),
      fields,
    },
    lanes: Object.fromEntries(Object.entries(rawLanes).map(([key, value]) => [key, Math.max(0, Math.round(numberOr(value, 0)))])),
    opportunities: enrichedOpportunities,
    gaps: textList(raw.gaps),
    quota: rawQuota ? { access_tier: nullableText(rawQuota.access_tier) || undefined, ranking_limit: nullableNumber(rawQuota.ranking_limit), ranking_unlimited: rawQuota.ranking_unlimited === true } : undefined,
  };
}

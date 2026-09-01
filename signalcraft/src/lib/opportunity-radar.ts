import { authHeaders } from './auth.ts';
import { clientErrorMessage } from './client-error.ts';
import { DATA_QUALITY_SCHEMA_VERSION, deriveDataQuality, normalizeDataQuality, normalizeEvidence, type DataQuality, type EvidenceContract } from './evidence-contract.ts';
import type { ConfidenceLevel } from './entry-decision.ts';

export type RadarEventType = 'EMERGING_TOPIC' | 'SMALL_CREATOR_BREAKOUT' | 'FORMAT_MIGRATION' | 'SUPPLY_GAP' | 'SATURATION_WARNING';
export type RadarLifecycle = 'WATCH' | 'EMERGING' | 'CONFIRMED' | 'CROWDED' | 'SATURATING' | 'DECLINING';
/** Shared confidence vocabulary; Radar payloads still omit INSUFFICIENT for compatibility. */
export type RadarConfidence = Exclude<ConfidenceLevel, 'INSUFFICIENT'>;

export type OpportunityRadarEvent = {
  id: string;
  eventType: RadarEventType;
  title: string;
  topic: string;
  format: string;
  lifecycle: RadarLifecycle;
  whyNowScore: number | null;
  whyNowLevel: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  confidence: RadarConfidence;
  confidenceNote: string;
  sampleVideoCount: number;
  independentChannelCount: number;
  smallCreatorBreakoutCount: number;
  medianViews: number | null;
  medianVpd: number | null;
  outlierDensity: number | null;
  vpdAcceleration: number | null;
  creatorConcentration: number | null;
  creatorConcentrationTop3?: number | null;
  creatorConcentrationTop5?: number | null;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  lifecycleHistory?: Array<{
    previousState: RadarLifecycle | null;
    newState: RadarLifecycle;
    changedAt: string | null;
    reason: string | null;
  }>;
  evidenceVideoIds: string[];
  evidenceChannelIds: string[];
  weakEvidenceVideoIds: string[];
  facts: string[];
  inferences: string[];
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'STALE' | 'INSUFFICIENT';
  baseline: { windowDays: number; previousSampleCount: number; label: string; multiWindow: boolean };
  metrics: Record<string, number | null>;
  evidence: { successfulVideoIds: string[]; independentWinnerVideoIds: string[]; weakVideoIds: string[]; provenance: string };
  migration?: { fromTopic: string; toTopic: string; format: string; stage: string; sourceSampleCount: number; targetSampleCount: number };
  debug?: { rulesFired: string[]; scoreContributors: Record<string, number | null>; scoreDraggers: string[]; baseline: Record<string, unknown> };
  representativeVideos: Array<{
    videoId: string;
    title: string;
    channelTitle: string | null;
    thumbnail: string | null;
    channelAvatar: string | null;
    views: number | null;
    subscribers: number | null;
    sourceMarket: string | null;
    sourceUrl: string | null;
    isBreakout: boolean;
    vpd: number | null;
  }>;
};

export type OpportunityRadarResponse = {
  schemaVersion?: string;
  evidence?: EvidenceContract;
  dataQuality?: DataQuality;
  available: boolean;
  engineVersion: string;
  window: '7d' | '14d' | '30d';
  dataScope: {
    source: string;
    markets: string[];
    historyDays: number;
    currentWindowDays: number;
    currentRows: number;
    historicalRows: number;
    latestCapturedAt: string | null;
    calculationPoolLimit?: number;
    visibleEventLimit?: number | null;
    note: string;
  };
  lanes: Record<string, number>;
  events: OpportunityRadarEvent[];
  gaps: string[];
  quota?: { access_tier?: string; ranking_limit?: number | null; ranking_unlimited?: boolean };
};

export function normalizeOpportunityRadarResponse(payload: unknown): OpportunityRadarResponse {
  const raw = payload && typeof payload === 'object' ? payload as Partial<OpportunityRadarResponse> : {};
  const scope = raw.dataScope;
  const rawRecord = raw as Record<string, unknown>;
  const quality = deriveDataQuality({
    sampleVideos: typeof scope?.currentRows === 'number' ? scope.currentRows : null,
    sampleChannels: null,
    completeness: scope && typeof scope.historicalRows === 'number' && scope.currentRows > 0 ? Math.min(100, (scope.historicalRows / scope.currentRows) * 100) : null,
    capturedAt: scope?.latestCapturedAt || null,
    source: scope?.source || 'unknown',
  });
  return { ...raw, schemaVersion: typeof raw.schemaVersion === 'string' ? raw.schemaVersion : DATA_QUALITY_SCHEMA_VERSION, evidence: normalizeEvidence(rawRecord.evidence, { source: scope?.source || 'unknown', algorithmVersion: typeof rawRecord.algorithmVersion === 'string' ? rawRecord.algorithmVersion : null, snapshotId: typeof rawRecord.snapshotId === 'string' ? rawRecord.snapshotId : null, requestId: typeof rawRecord.requestId === 'string' ? rawRecord.requestId : null, capturedAt: typeof rawRecord.capturedAt === 'string' ? rawRecord.capturedAt : scope?.latestCapturedAt || null }), dataQuality: normalizeDataQuality(rawRecord.dataQuality, quality), available: raw.available === true, engineVersion: typeof raw.engineVersion === 'string' ? raw.engineVersion : 'unknown', window: raw.window || '14d', dataScope: scope || { source: 'unknown', markets: [], historyDays: 0, currentWindowDays: 14, currentRows: 0, historicalRows: 0, latestCapturedAt: null, note: '暂无数据范围说明。' }, lanes: raw.lanes || {}, events: Array.isArray(raw.events) ? raw.events : [], gaps: Array.isArray(raw.gaps) ? raw.gaps.filter((item): item is string => typeof item === 'string') : [] };
}

export async function fetchOpportunityRadar(input: { market?: string; window?: '7d' | '14d' | '30d'; limit?: number } = {}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ market: input.market || 'all', window: input.window || '14d' });
  if (input.limit) params.set('limit', String(Math.min(Math.max(Math.round(input.limit), 1), 500)));
  const response = await fetch(`/api/opportunity-radar?${params.toString()}`, {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
    signal: options.signal,
  });
  const payload = await response.json().catch(() => ({})) as OpportunityRadarResponse & { error?: unknown };
  if (!response.ok) throw new Error(clientErrorMessage(payload.error, '长视频趋势雷达数据暂时不可用。'));
  return normalizeOpportunityRadarResponse(payload);
}

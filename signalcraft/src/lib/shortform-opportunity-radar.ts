import { authHeaders } from './auth.ts';
import { clientErrorMessage } from './client-error.ts';
import { DATA_QUALITY_SCHEMA_VERSION, deriveDataQuality, normalizeDataQuality, normalizeEvidence, type DataQuality, type EvidenceContract } from './evidence-contract.ts';
import type { ConfidenceLevel } from './entry-decision.ts';

export type ShortformRadarEvent = {
  id: string;
  eventType: 'SHORTS_BREAKOUT' | 'SHORTS_EMERGING' | 'SHORTS_CROWDED';
  title: string;
  topic: string;
  mechanism: string;
  format: 'SHORT_FORM';
  lifecycle: 'WATCH' | 'EMERGING' | 'CONFIRMED' | 'CROWDED';
  opportunityScore: number;
  whyNowScore: number;
  whyNowLevel: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  confidence: Exclude<ConfidenceLevel, 'INSUFFICIENT'>;
  confidenceNote: string;
  sampleVideoCount: number;
  independentChannelCount: number;
  breakoutCount: number;
  medianViews: number | null;
  medianVpd: number | null;
  vpdAcceleration: number | null;
  creatorConcentration: number | null;
  creatorConcentrationTop3: number | null;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  evidenceVideoIds: string[];
  evidenceChannelIds: string[];
  weakEvidenceVideoIds: string[];
  facts: string[];
  inferences: string[];
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  baseline: { windowDays: number; previousSampleCount: number; label: string; multiWindow: boolean };
  metrics: {
    currentSample: number;
    previousSample: number;
    currentChannels: number;
    previousChannels: number;
    demandProxyGrowth: number | null;
    supplyGrowth: number | null;
    creatorGrowth: number | null;
    freshness: number;
    breakoutDensity: number;
  };
  evidence: { successfulVideoIds: string[]; independentWinnerVideoIds: string[]; weakVideoIds: string[]; provenance: string };
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

export type ShortformRadarResponse = {
  schemaVersion?: string;
  evidence?: EvidenceContract;
  dataQuality?: DataQuality;
  available: boolean;
  engine: string;
  engineVersion: string;
  format: 'SHORT_FORM';
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
  events: ShortformRadarEvent[];
  gaps: string[];
  quota?: { access_tier?: string; ranking_limit?: number | null; ranking_unlimited?: boolean };
};

export function normalizeShortformRadarResponse(payload: unknown): ShortformRadarResponse {
  const raw = payload && typeof payload === 'object' ? payload as Partial<ShortformRadarResponse> : {};
  const scope = raw.dataScope;
  const rawRecord = raw as Record<string, unknown>;
  const quality = deriveDataQuality({
    sampleVideos: typeof scope?.currentRows === 'number' ? scope.currentRows : null,
    sampleChannels: null,
    completeness: scope && typeof scope.historicalRows === 'number' && scope.currentRows > 0 ? Math.min(100, (scope.historicalRows / scope.currentRows) * 100) : null,
    capturedAt: scope?.latestCapturedAt || null,
    source: scope?.source || 'unknown',
  });
  return { ...raw, schemaVersion: typeof raw.schemaVersion === 'string' ? raw.schemaVersion : DATA_QUALITY_SCHEMA_VERSION, evidence: normalizeEvidence(rawRecord.evidence, { source: scope?.source || 'unknown', algorithmVersion: typeof rawRecord.algorithmVersion === 'string' ? rawRecord.algorithmVersion : null, snapshotId: typeof rawRecord.snapshotId === 'string' ? rawRecord.snapshotId : null, inputSnapshotId: typeof rawRecord.inputSnapshotId === 'string' ? rawRecord.inputSnapshotId : null, requestId: typeof rawRecord.requestId === 'string' ? rawRecord.requestId : null, capturedAt: typeof rawRecord.capturedAt === 'string' ? rawRecord.capturedAt : scope?.latestCapturedAt || null }), dataQuality: normalizeDataQuality(rawRecord.dataQuality, quality), available: raw.available === true, engine: typeof raw.engine === 'string' ? raw.engine : 'unknown', engineVersion: typeof raw.engineVersion === 'string' ? raw.engineVersion : 'unknown', format: 'SHORT_FORM', window: raw.window || '14d', dataScope: scope || { source: 'unknown', markets: [], historyDays: 0, currentWindowDays: 14, currentRows: 0, historicalRows: 0, latestCapturedAt: null, note: '暂无数据范围说明。' }, lanes: raw.lanes || {}, events: Array.isArray(raw.events) ? raw.events : [], gaps: Array.isArray(raw.gaps) ? raw.gaps.filter((item): item is string => typeof item === 'string') : [] };
}

export async function fetchShortformOpportunityRadar(input: { market?: string; window?: '7d' | '14d' | '30d'; limit?: number } = {}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ market: input.market || 'all', window: input.window || '14d' });
  if (input.limit) params.set('limit', String(Math.min(Math.max(Math.round(input.limit), 1), 500)));
  const response = await fetch(`/api/shortform-opportunity-radar?${params.toString()}`, {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
    signal: options.signal,
  });
  const payload = await response.json().catch(() => ({})) as ShortformRadarResponse & { error?: unknown };
  if (!response.ok) throw new Error(clientErrorMessage(payload.error, 'Shorts 趋势雷达数据暂时不可用。'));
  return normalizeShortformRadarResponse(payload);
}

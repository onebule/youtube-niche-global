import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';

export type RadarEventType = 'EMERGING_TOPIC' | 'SMALL_CREATOR_BREAKOUT' | 'FORMAT_MIGRATION' | 'SUPPLY_GAP' | 'SATURATION_WARNING';
export type RadarLifecycle = 'WATCH' | 'EMERGING' | 'CONFIRMED' | 'CROWDED' | 'SATURATING' | 'DECLINING';
export type RadarConfidence = 'LOW' | 'MEDIUM' | 'HIGH';

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

export async function fetchOpportunityRadar(input: { market?: string; window?: '7d' | '14d' | '30d'; limit?: number } = {}, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ market: input.market || 'all', window: input.window || '14d' });
  if (input.limit) params.set('limit', String(Math.min(Math.max(Math.round(input.limit), 1), 500)));
  const response = await fetch(`/api/opportunity-radar?${params.toString()}`, {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
    signal: options.signal,
  });
  const payload = await response.json().catch(() => ({})) as OpportunityRadarResponse & { error?: unknown };
  if (!response.ok) throw new Error(clientErrorMessage(payload.error, '机会雷达数据暂时不可用。'));
  return payload;
}

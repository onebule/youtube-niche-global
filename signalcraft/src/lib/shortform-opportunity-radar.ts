import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';

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
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
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
  return payload;
}

import { authHeaders } from './auth';

export type LongformOpportunity = {
  key: string;
  topic: string;
  mechanism: string;
  productionType: string;
  sampleSize: number;
  channelCount: number;
  medianViews: number | null;
  marketOpportunity: number | null;
  executionFit: number | null;
  entryScore: number | null;
  confidence: number;
  confidenceLabel: 'HIGH' | 'MEDIUM' | 'LOW';
  lanes: string[];
  metrics: Record<string, number | null>;
  execution: { score: number | null; coverage: number; rationale: string };
  representativeVideos: Array<{ videoId: string; title: string; channelTitle: string | null; thumbnail: string | null; channelAvatar: string | null; views: number | null; durationSeconds: number | null; sourceMarket: string | null; growthRate: number | null; breakoutScore: number | null; sourceUrl: string | null }>;
};

export type LongformResponse = {
  available: boolean;
  engineVersion: string;
  dataScope: { source: string; markets: string[]; window: string; latestCapturedAt: string | null; collectedRows: number; longformRows: number; uncertainRows: number; classificationCoverage: number; longformShare?: number; calculationPoolLimit?: number; visibleOpportunityLimit?: number | null; marketSampleLimit?: number; failedMarkets?: string[]; note: string };
  availabilityAudit: { coverage: number; availableFields: number; unavailableFields: number; fields: Record<string, { available: boolean; provenance: string; confidence: string; note: string | null }> };
  lanes: Record<string, number>;
  opportunities: LongformOpportunity[];
  gaps: string[];
  quota?: { access_tier?: string; ranking_limit?: number | null; ranking_unlimited?: boolean };
};

export async function fetchLongformOpportunities(input: { market: string; window: string; category?: string; limit?: number } = { market: 'all', window: '28d' }) {
  const params = new URLSearchParams({ market: input.market, window: input.window });
  if (input.category && input.category !== 'all') params.set('category', input.category);
  if (input.limit) params.set('limit', String(Math.min(Math.max(Math.round(input.limit), 1), 500)));
  const response = await fetch(`/api/longform-opportunities?${params.toString()}`, { headers: { accept: 'application/json', ...authHeaders() }, cache: 'no-store' });
  const payload = await response.json() as LongformResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error || '长视频机会数据暂时不可用。');
  return payload;
}

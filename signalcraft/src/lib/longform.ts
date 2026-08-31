import { authHeaders } from './auth';
import { clientErrorMessage } from './client-error';

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
  recommendation?: 'BUILD' | 'TEST' | 'WATCH' | 'AVOID' | 'INSUFFICIENT_DATA';
  lanes: string[];
  metrics: Record<string, number | null>;
  execution: { score: number | null; coverage: number; rationale: string };
  representativeVideos: Array<{ videoId: string; title: string; titleZh?: string | null; channelTitle: string | null; thumbnail: string | null; channelAvatar: string | null; views: number | null; durationSeconds: number | null; sourceMarket: string | null; growthRate: number | null; breakoutScore: number | null; sourceUrl: string | null }>;
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

export async function fetchLongformOpportunities(input: { market: string; window: string; category?: string; limit?: number; locale?: 'zh' | 'en' } = { market: 'all', window: '28d' }, options: { signal?: AbortSignal } = {}) {
  const params = new URLSearchParams({ market: input.market, window: input.window });
  if (input.locale) params.set('locale', input.locale);
  if (input.category && input.category !== 'all') params.set('category', input.category);
  if (input.limit) params.set('limit', String(Math.min(Math.max(Math.round(input.limit), 1), 500)));
  const response = await fetch(`/api/longform-opportunities?${params.toString()}`, { headers: { accept: 'application/json', ...authHeaders() }, cache: 'no-store', signal: options.signal });
  const payload = await response.json().catch(() => ({})) as LongformResponse & { error?: unknown };
  if (!response.ok) throw new Error(clientErrorMessage(payload.error, '长视频机会数据暂时不可用。'));
  return payload;
}

import { authHeaders } from './auth.ts';
import { clientErrorMessage } from './client-error.ts';
import { normalizeLongformResponse } from './longform-response';
import type { DataQuality, EvidenceContract, EvidenceDecisionReason } from './evidence-contract.ts';
import type { ConfidenceLevel, EntryDecision, PerformanceAssessment } from './entry-decision.ts';
import type { NicheBreakoutSummary } from './niche-signals.ts';
import type { NicheLifecycleSummary } from './niche-lifecycle.ts';
import type { OpportunityAssessment } from './opportunity-engine.ts';
import type { ContentPatternReport } from './content-patterns.ts';
import type { ContentPatternTrendReport } from './content-pattern-trends.ts';
import type { ContentStrategy } from './content-strategy.ts';
import type { ExperimentValidationReport } from './experiment-validation.ts';
import type { IdeaIntelligenceReport } from './idea-intelligence.ts';
import type { CreativeBriefIntelligenceReport } from './creative-brief-intelligence.ts';
import type { CreativeDevelopmentIntelligenceReport } from './creative-development.ts';
import type { ScriptDevelopmentIntelligenceReport } from './script-development.ts';
import type { ScriptWritingIntelligenceReport } from './script-writing.ts';
import type { StoryboardIntelligenceReport } from './storyboard-planning.ts';
import type { VisualAssetIntelligenceReport } from './visual-asset-intelligence.ts';
import type { VisualGenerationSpecificationReport } from './visual-generation-specification.ts';
import type { ProviderRoutingReport } from './provider-routing.ts';

// The production frontend is served from niqivo.top while the verified data
// gateway lives on the API deployment. Calling it directly avoids the stale
// same-origin Next proxy returning a Vercel HTML error page. The backend CORS
// boundary allows the browser Authorization header and keeps credentials
// server-side.
const LONGFORM_OPPORTUNITIES_ENDPOINT = process.env.NEXT_PUBLIC_LONGFORM_OPPORTUNITIES_URL
  || 'https://youtube-niche-global-api.vercel.app/api/longform-opportunities';

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
  /** Canonical Phase 2 confidence; confidenceLabel remains for compatibility. */
  confidenceLevel?: ConfidenceLevel;
  performance?: PerformanceAssessment;
  entryDecision?: EntryDecision;
  upstreamAssessment?: {
    source: 'UPSTREAM_OPAQUE';
    algorithmVersion: string | null;
    snapshotId: string | null;
    inputSnapshotId?: string | null;
    capturedAt: string | null;
    scores: { marketOpportunity: number | null; executionFit: number | null; entryScore: number | null };
    recommendation: string | null;
    decisionReasons?: EvidenceDecisionReason[];
  };
  /** Optional upstream Phase 2 evidence; absent when the public API has no creator-level inputs. */
  nicheSignals?: NicheBreakoutSummary;
  /** Optional upstream Phase 3 temporal evidence; absent when comparable windows are unavailable. */
  nicheLifecycle?: NicheLifecycleSummary;
  /** Canonical Phase 4 local decision; computed at the response boundary. */
  opportunityAssessment?: OpportunityAssessment;
  /** Optional P2 Phase 1 content-pattern evidence; Long-form only. */
  contentPatterns?: ContentPatternReport;
  /** Optional P2 Phase 2 pattern history/trend and niche-fit evidence. */
  contentPatternTrend?: ContentPatternTrendReport;
  /** Canonical P2 Phase 3 strategy; Long-form only. */
  contentStrategy?: ContentStrategy;
  /** P2 Phase 4 validation; empty until real Long-form observations arrive. */
  experimentValidation?: ExperimentValidationReport;
  /** P3 Phase 1 Case → Pattern → Idea intelligence; Long-form only. */
  ideaIntelligence?: IdeaIntelligenceReport;
  /** P3 Phase 2 deterministic Idea Validation → Creative Brief hand-off; Long-form only. */
  creativeBriefIntelligence?: CreativeBriefIntelligenceReport;
  /** P3 Phase 3 deterministic Title / Hook / Outline intelligence; Long-form only. */
  creativeDevelopment?: CreativeDevelopmentIntelligenceReport;
  /** P3 Phase 4 deterministic script architecture and semantic scene requirements; Long-form only. */
  scriptDevelopment?: ScriptDevelopmentIntelligenceReport;
  /** P3 Phase 5 editable evidence-grounded narration draft; Long-form only. */
  scriptWriting?: ScriptWritingIntelligenceReport;
  /** Canonical P3 Phase 5 Script Draft alias; same report as scriptWriting. */
  scriptDraft?: ScriptWritingIntelligenceReport;
  /** P4 Phase 1 model-independent Storyboard and Shot Planning; Long-form only. */
  storyboardIntelligence?: StoryboardIntelligenceReport;
  /** P4 Phase 2 canonical visual asset/reference intelligence; Long-form only. */
  visualAssetIntelligence?: VisualAssetIntelligenceReport;
  /** P4 Phase 3 provider-independent generation intent; Long-form only. */
  visualGenerationSpecifications?: VisualGenerationSpecificationReport;
  /** P4 Phase 4 provider compatibility/routing; Long-form only and execution-free. */
  providerRouting?: ProviderRoutingReport;
  recommendation?: 'BUILD' | 'TEST' | 'WATCH' | 'AVOID' | 'INSUFFICIENT_DATA';
  lanes: string[];
  metrics: Record<string, number | null>;
  execution: { score: number | null; coverage: number; rationale: string };
  representativeVideos: Array<{ videoId: string; title: string; titleZh?: string | null; topic?: string | null; channelTitle: string | null; thumbnail: string | null; channelAvatar: string | null; views: number | null; durationSeconds: number | null; sourceMarket: string | null; growthRate: number | null; breakoutScore: number | null; sourceUrl: string | null }>;
};

export type LongformResponse = {
  schemaVersion?: string;
  evidence?: EvidenceContract;
  dataQuality?: DataQuality;
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
  const response = await fetch(`${LONGFORM_OPPORTUNITIES_ENDPOINT}?${params.toString()}`, { headers: { accept: 'application/json', ...authHeaders() }, cache: 'no-store', signal: options.signal });
  const body = await response.text();
  let payload = {} as LongformResponse & { error?: unknown; code?: string };
  try {
    const parsed: unknown = body ? JSON.parse(body) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed as LongformResponse & { error?: unknown; code?: string };
  } catch {
    throw new Error(response.status >= 500
      ? '长视频机会数据服务暂时不可用，请稍后重试。'
      : '长视频机会数据返回了无法识别的响应。');
  }
  if (!response.ok) throw new Error(clientErrorMessage(payload.error, '长视频机会数据暂时不可用。'));
  return normalizeLongformResponse(payload);
}

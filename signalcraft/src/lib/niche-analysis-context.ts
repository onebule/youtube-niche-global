/**
 * Lightweight hand-off between the long-form Trend Radar and Niche Evaluation.
 *
 * The URL carries only stable identifiers and a few routing hints.  The richer
 * evidence/return state lives in sessionStorage so we do not create a second
 * database (or leak a user's workspace state into another account).
 */

export type NicheContextSource = 'TREND_RADAR' | 'NICHE_EVALUATION';

export type RadarReturnState = {
  scrollPosition?: number;
  page?: number;
  sort?: string;
  activeTab?: string;
  filters?: Record<string, unknown>;
};

export type NicheAnalysisContext = {
  nicheId?: string;
  nicheName: string;
  topicId?: string;
  topicName?: string;
  contentType?: string;
  platformType?: string;
  format?: string;
  timeWindow?: string;
  filters?: Record<string, unknown>;
  sort?: string;
  trendSignals?: unknown;
  breakoutSignals?: unknown;
  smallCreatorSignals?: unknown;
  representativeVideos?: unknown[];
  representativeChannels?: unknown[];
  confidence?: number | string;
  source: NicheContextSource;
  returnState?: RadarReturnState;
};

export const NICHE_CONTEXT_STORAGE_KEY = 'signalcraft:niche-analysis-context:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrUndefined(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function cleanRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function cleanContext(value: unknown): NicheAnalysisContext | null {
  if (!isRecord(value)) return null;
  const nicheName = stringOrUndefined(value.nicheName);
  const source = value.source === 'NICHE_EVALUATION' ? value.source : value.source === 'TREND_RADAR' ? value.source : null;
  if (!nicheName || !source) return null;
  const returnState = cleanRecord(value.returnState);
  return {
    nicheId: stringOrUndefined(value.nicheId),
    nicheName,
    topicId: stringOrUndefined(value.topicId),
    topicName: stringOrUndefined(value.topicName),
    contentType: stringOrUndefined(value.contentType),
    platformType: stringOrUndefined(value.platformType),
    format: stringOrUndefined(value.format),
    timeWindow: stringOrUndefined(value.timeWindow),
    filters: cleanRecord(value.filters),
    sort: stringOrUndefined(value.sort),
    trendSignals: value.trendSignals,
    breakoutSignals: value.breakoutSignals,
    smallCreatorSignals: value.smallCreatorSignals,
    representativeVideos: Array.isArray(value.representativeVideos) ? value.representativeVideos : undefined,
    representativeChannels: Array.isArray(value.representativeChannels) ? value.representativeChannels : undefined,
    confidence: typeof value.confidence === 'number' || typeof value.confidence === 'string' ? value.confidence : undefined,
    source,
    returnState: returnState ? {
      scrollPosition: typeof returnState.scrollPosition === 'number' && Number.isFinite(returnState.scrollPosition) ? returnState.scrollPosition : undefined,
      page: typeof returnState.page === 'number' && Number.isFinite(returnState.page) ? returnState.page : undefined,
      sort: stringOrUndefined(returnState.sort),
      activeTab: stringOrUndefined(returnState.activeTab),
      filters: cleanRecord(returnState.filters),
    } : undefined,
  };
}

export function readNicheAnalysisContext(): NicheAnalysisContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(NICHE_CONTEXT_STORAGE_KEY);
    return cleanContext(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

export function saveNicheAnalysisContext(context: NicheAnalysisContext) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(NICHE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Storage can be disabled in private browsing; the URL hand-off still works.
  }
}

export function clearNicheAnalysisContext() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(NICHE_CONTEXT_STORAGE_KEY); } catch { /* ignore */ }
}

function queryValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Build the small URL used for a radar -> evaluation hand-off. */
export function buildNicheEvaluationHref(context: NicheAnalysisContext) {
  const query = new URLSearchParams();
  if (context.nicheId) query.set('nicheId', context.nicheId);
  query.set('nicheName', context.nicheName);
  if (context.topicName) query.set('topic', context.topicName);
  if (context.contentType) query.set('type', context.contentType.toLowerCase().includes('short') ? 'short' : 'long');
  if (context.format) query.set('format', context.format);
  if (context.timeWindow) query.set('window', context.timeWindow);
  query.set('source', 'trend-radar');
  return `/longform?${query.toString()}`;
}

/** Build a focused radar URL, restoring the previous scan when requested. */
export function buildTrendRadarHref(context: NicheAnalysisContext, restore = false, lane?: string) {
  const query = new URLSearchParams();
  const topic = context.topicName || context.nicheName;
  if (topic) query.set('topic', topic);
  query.set('source', 'niche-evaluation');
  if (restore) {
    query.set('restore', '1');
    if (context.returnState?.activeTab) query.set('lane', context.returnState.activeTab);
    const filters = context.returnState?.filters || context.filters;
    const market = filters && queryValue(filters.market);
    if (market) query.set('market', market);
    if (context.timeWindow) query.set('window', context.timeWindow);
  }
  if (lane) query.set('lane', lane);
  return `/radar?${query.toString()}`;
}

export function contextFromQuery(params: URLSearchParams) {
  const legacyRadar = Boolean(params.get('opportunityId'));
  const source = params.get('source') === 'trend-radar' || legacyRadar ? 'TREND_RADAR' : params.get('source') === 'niche-evaluation' ? 'NICHE_EVALUATION' : undefined;
  const nicheName = queryValue(params.get('nicheName')) || queryValue(params.get('topic'));
  if (!source || !nicheName) return null;
  const previous = readNicheAnalysisContext();
  const context = cleanContext({
    ...(previous && previous.nicheName === nicheName ? previous : {}),
    nicheId: queryValue(params.get('nicheId')) || queryValue(params.get('opportunityId')) || previous?.nicheId,
    nicheName,
    topicName: queryValue(params.get('topic')) || previous?.topicName,
    contentType: queryValue(params.get('type')) || previous?.contentType,
    format: queryValue(params.get('format')) || previous?.format,
    timeWindow: queryValue(params.get('window')) || previous?.timeWindow,
    source,
  });
  return context;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clientErrorMessage } from '@/src/lib/client-error';
import { fetchShortformOpportunityRadar, type ShortformRadarEvent, type ShortformRadarResponse } from '@/src/lib/shortform-opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';
import type { RadarReturnState } from '@/src/lib/niche-analysis-context';
import SignalSparkline from './signal-sparkline';

const compact = (value: number | null, locale: UiLocale) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const mediaUrl = (value: string | null | undefined) => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
const eventLabels: Record<ShortformRadarEvent['eventType'], { zh: string; en: string }> = {
  SHORTS_BREAKOUT: { zh: '中小频道突破', en: 'Creator breakout' },
  SHORTS_EMERGING: { zh: '短视频形式形成中', en: 'Emerging short-form' },
  SHORTS_CROWDED: { zh: '供给拥挤预警', en: 'Crowding warning' },
};
const confidenceLabels: Record<ShortformRadarEvent['confidence'], { zh: string; en: string }> = {
  LOW: { zh: '低置信度', en: 'Low confidence' }, MEDIUM: { zh: '中置信度', en: 'Medium confidence' }, HIGH: { zh: '高置信度', en: 'High confidence' },
};
const lifecycleLabels: Record<ShortformRadarEvent['lifecycle'], { zh: string; en: string }> = {
  WATCH: { zh: '观察', en: 'Watch' }, EMERGING: { zh: '形成中', en: 'Emerging' }, CONFIRMED: { zh: '已验证', en: 'Confirmed' }, CROWDED: { zh: '拥挤', en: 'Crowded' },
};

function ShortformVideo({ video, locale }: { video: ShortformRadarEvent['representativeVideos'][number]; locale: UiLocale }) {
  const thumbnail = mediaUrl(video.thumbnail);
  const avatar = mediaUrl(video.channelAvatar);
  const content = <>
    <span className="shortform-radar-video-thumb">{thumbnail ? <img src={thumbnail} alt="" width={152} height={86} loading="lazy"/> : <i aria-hidden="true">▶</i>}{video.isBreakout ? <em>{locale === 'zh' ? '突破' : 'Breakout'}</em> : null}</span>
    <span className="shortform-radar-video-copy"><strong>{video.title || (locale === 'zh' ? '未命名短视频' : 'Untitled short')}</strong><small><span className="shortform-radar-avatar">{avatar ? <img src={avatar} alt="" width={20} height={20}/> : 'CH'}</span>{video.channelTitle || (locale === 'zh' ? '公开频道' : 'Public channel')} · {compact(video.views, locale)} {locale === 'zh' ? '播放' : 'views'}</small></span>
  </>;
  return video.sourceUrl ? <a className="shortform-radar-video" href={video.sourceUrl} target="_blank" rel="noreferrer">{content}</a> : <div className="shortform-radar-video">{content}</div>;
}

export type ShortformRadarActions = {
  onShortResearch?: (event: ShortformRadarEvent, returnState?: RadarReturnState) => void;
};

function RadarCard({ event, locale, onResearch }: { event: ShortformRadarEvent; locale: UiLocale; onResearch?: (event: ShortformRadarEvent) => void }) {
  const zh = locale === 'zh';
  const label = eventLabels[event.eventType];
  const confidence = confidenceLabels[event.confidence];
  const lifecycle = lifecycleLabels[event.lifecycle];
  const guardrail = event.independentChannelCount < 2
    ? (zh ? '单频道证据：不作为跨频道机会结论。' : 'Single-channel evidence: not a cross-channel opportunity conclusion.')
    : event.sampleVideoCount < 5
      ? (zh ? '样本偏少：先观察下一次采集。' : 'Small sample: confirm on the next capture.')
      : event.creatorConcentrationTop3 !== null && event.creatorConcentrationTop3 >= 65
        ? (zh ? `Top 3 频道占 ${event.creatorConcentrationTop3}% 流量，开放度可能被高估。` : `Top 3 channels hold ${event.creatorConcentrationTop3}% of views; openness may be overstated.`)
        : null;
  return <article className="shortform-radar-card">
    <header className="shortform-radar-card-head"><div><span className="shortform-radar-event-type">{label[zh ? 'zh' : 'en']}</span><h2>{event.title}</h2><p>{event.topic} · {event.mechanism} · Shorts only</p></div><span className={`shortform-radar-lifecycle ${event.lifecycle.toLowerCase()}`}>{lifecycle[zh ? 'zh' : 'en']}</span></header>
    <div className="shortform-radar-score"><div><small>{zh ? '机会分' : 'OPPORTUNITY'}</small><strong>{event.opportunityScore}</strong><span>{event.whyNowLevel.replace('_', ' ')}</span></div><div><small>{zh ? '置信度' : 'CONFIDENCE'}</small><b className={`shortform-radar-confidence ${event.confidence.toLowerCase()}`}>{confidence[zh ? 'zh' : 'en']}</b><span>{event.dataQuality}</span></div><div><small>{zh ? '对照窗口' : 'BASELINE'}</small><b>{event.baseline.windowDays}D</b><span>{event.sampleVideoCount} {zh ? '条短视频' : 'shorts'}</span></div></div>
    <div className="shortform-radar-metrics"><div><small>{zh ? '独立频道' : 'Channels'}</small><b>{event.independentChannelCount}</b></div><div><small>{zh ? '突破候选' : 'Breakouts'}</small><b>{event.breakoutCount}</b></div><div><small>{zh ? '中位播放' : 'Median views'}</small><b>{compact(event.medianViews, locale)}</b></div><div><small>{zh ? '播放/订阅' : 'Median VPD'}</small><b>{event.medianVpd === null ? '—' : `${event.medianVpd.toFixed(1)}×`}</b></div><div><small>{zh ? '需求代理' : 'Demand proxy'}</small><b>{event.metrics.demandProxyGrowth === null ? '—' : `${event.metrics.demandProxyGrowth >= 0 ? '+' : ''}${event.metrics.demandProxyGrowth}%`}</b></div><div><small>{zh ? '新鲜度' : 'Freshness'}</small><b>{event.metrics.freshness}%</b></div></div>
    <section className="shortform-radar-changed"><div className="shortform-radar-changed-head"><small>{zh ? '为什么现在看' : 'WHY NOW'}</small><SignalSparkline points={[event.metrics.previousSample, event.metrics.currentSample]} tone={event.metrics.currentSample >= event.metrics.previousSample ? 'teal' : 'coral'} label={zh ? '历史到当前样本量对照' : 'Historical to current sample comparison'}/></div><p>{event.facts[1] || (zh ? '当前窗口出现了可观察的跨频道变化。' : 'The current window shows a measurable cross-channel change.')}</p><p className="shortform-radar-note">{event.confidenceNote}</p>{guardrail ? <p className="shortform-radar-guardrail">! {guardrail}</p> : null}</section>
    <div className="shortform-radar-proof"><span>✓ {event.independentChannelCount} {zh ? '个独立频道' : 'independent channels'}</span><span>✓ {event.metrics.breakoutDensity}% {zh ? '突破密度' : 'breakout density'}</span><span>! {event.weakEvidenceVideoIds.length} {zh ? '条普通证据' : 'standard examples'}</span></div>
    <details className="shortform-radar-details"><summary>{zh ? '查看证据与代表视频' : 'View evidence and representative videos'}</summary><div className="shortform-radar-facts"><div><h3>{zh ? '可验证事实' : 'FACTS'}</h3>{event.facts.map(fact => <p key={fact}>{fact}</p>)}</div><div><h3>{zh ? '推断' : 'INFERENCE'}</h3>{event.inferences.length ? event.inferences.map(item => <p key={item}>{item}</p>) : <p>{zh ? '暂无额外推断。' : 'No additional inference.'}</p>}</div></div><div className="shortform-radar-video-list">{event.representativeVideos.map(video => <ShortformVideo key={video.videoId} video={video} locale={locale}/>)}</div><p className="shortform-radar-provenance">{event.evidence.provenance}</p></details>
    {onResearch ? <div className="shortform-radar-actions"><button type="button" onClick={() => onResearch(event)}>{zh ? '进入 Shorts 赛道评估 →' : 'Open Shorts niche evaluation →'}</button></div> : null}
  </article>;
}

export default function ShortformOpportunityRadar({ locale, embedded = false, onShortResearch }: { locale: UiLocale; embedded?: boolean } & ShortformRadarActions) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [market, setMarket] = useState('all');
  const [data, setData] = useState<ShortformRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const restoreScrollRef = useRef<number | null>(null);
  useEffect(() => {
    const syncRadarContext = () => {
      const params = new URLSearchParams(globalThis.window.location.search);
      const topic = params.get('topic') || params.get('nicheName');
      if (topic) setFocusTopic(topic);
      if (params.get('restore') === '1') {
        try {
          const raw = globalThis.window.sessionStorage.getItem('signalcraft:niche-analysis-context:v1');
          const saved = raw ? JSON.parse(raw) as { returnState?: { scrollPosition?: number; filters?: { market?: string } }; timeWindow?: string } : null;
          const returnState = saved?.returnState;
          restoreScrollRef.current = typeof returnState?.scrollPosition === 'number' && Number.isFinite(returnState.scrollPosition) ? returnState.scrollPosition : null;
          const restoredMarket = returnState?.filters?.market;
          if (typeof restoredMarket === 'string' && restoredMarket) setMarket(restoredMarket);
          if (saved?.timeWindow === '7d' || saved?.timeWindow === '14d' || saved?.timeWindow === '30d') setWindow(saved.timeWindow);
        } catch {
          // The URL still opens the radar if session storage is unavailable.
        }
      } else {
        const queryMarket = params.get('market');
        if (queryMarket) setMarket(queryMarket);
        const queryWindow = params.get('window');
        if (queryWindow === '7d' || queryWindow === '14d' || queryWindow === '30d') setWindow(queryWindow);
      }
      setContextReady(true);
    };
    const timer = globalThis.window.setTimeout(syncRadarContext, 0);
    return () => globalThis.window.clearTimeout(timer);
  }, []);
  const research = useCallback((event: ShortformRadarEvent) => {
    if (!onShortResearch) return;
    onShortResearch(event, {
      scrollPosition: typeof globalThis.window === 'undefined' ? 0 : globalThis.window.scrollY,
      page: 1,
      sort: 'opportunityScore',
      activeTab: 'ALL',
      filters: { market, window },
    });
  }, [market, onShortResearch, window]);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null);
    try { setData(await fetchShortformOpportunityRadar({ market, window, limit: 500 }, { signal: controller.signal })); }
    catch (reason) { if (!controller.signal.aborted) setError(clientErrorMessage(reason, zh ? 'Shorts 趋势雷达数据暂时不可用。' : 'Shorts Trend Radar is temporarily unavailable.')); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [market, window, zh]);
  useEffect(() => { if (!contextReady) return; const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [contextReady, load]);
  useEffect(() => {
    if (!data || restoreScrollRef.current === null || typeof globalThis.window === 'undefined') return;
    const scrollPosition = restoreScrollRef.current;
    restoreScrollRef.current = null;
    const timer = globalThis.window.setTimeout(() => globalThis.window.scrollTo({ top: scrollPosition, behavior: 'auto' }), 0);
    return () => globalThis.window.clearTimeout(timer);
  }, [data]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const events = (data?.events || []).slice().sort((left, right) => {
    if (!focusTopic) return 0;
    const leftMatch = left.topic.toLowerCase() === focusTopic.toLowerCase() || left.title.toLowerCase().includes(focusTopic.toLowerCase());
    const rightMatch = right.topic.toLowerCase() === focusTopic.toLowerCase() || right.title.toLowerCase().includes(focusTopic.toLowerCase());
    return Number(rightMatch) - Number(leftMatch);
  });
  const Container = embedded ? 'section' : 'main';
  return <Container className="shortform-radar-page">
    <section className="shortform-radar-hero"><div><span className="shortform-radar-kicker">SHORTS TREND RADAR</span><h1>{zh ? '识别 Shorts 最近出现的变化。' : 'Detect recent changes in Shorts.'}</h1><p>{zh ? '独立读取 Shorts 数据，观察跨频道扩散、中小频道突破和供给变化。这里是变化监测引擎，不会改变现有 Shorts 榜单、筛选、历史数据或评分。' : 'A separate Shorts-only engine for cross-channel spread, creator breakouts, and supply change. Existing Shorts rankings, filters, history, and scoring remain untouched.'}</p></div><div className="shortform-radar-stamp"><strong>SHORTS</strong><span>{zh ? '独立数据范围' : 'isolated data scope'}</span><i/></div></section>
    <section className="shortform-radar-toolbar" aria-label={zh ? '短视频雷达筛选' : 'Short-form radar filters'}><label><span>{zh ? '市场' : 'Market'}</span><select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部市场' : 'All markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="IN">IN</option><option value="BR">BR</option><option value="JP">JP</option></select></label><label><span>{zh ? '时间窗口' : 'Window'}</span><select value={window} onChange={event => setWindow(event.target.value as '7d' | '14d' | '30d')}><option value="7d">7D</option><option value="14d">14D</option><option value="30d">30D</option></select></label><div className="shortform-radar-scope"><b>{data?.dataScope.currentRows ?? '—'}</b><span>{zh ? '当前短视频样本' : 'current Shorts sample'}</span></div><button type="button" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '计算中…' : 'Computing…') : (zh ? '刷新雷达' : 'Refresh radar')}</button></section>
    <div className="shortform-radar-boundary"><span>{zh ? '边界明确' : 'BOUNDARY'}</span><p>{zh ? 'Shorts 趋势雷达只回答“最近发生了什么变化”；长视频赛道评估回答“一个方向是否值得长期进入”。两者的数据范围、事件和指标彼此独立，现有 Shorts 产品行为保持不变。' : 'Shorts Trend Radar answers what changed recently; Long-form Niche Evaluation asks whether a direction is worth entering over time. Their scopes, events, and metrics stay separate, and the existing Shorts product remains unchanged.'}</p></div>
    {focusTopic ? <div className="shortform-radar-focus"><span>{zh ? '已定位赛道' : 'Focused niche'}</span><b>{focusTopic}</b><button type="button" onClick={() => setFocusTopic(null)}>{zh ? '清除定位' : 'Clear focus'}</button></div> : null}
    {error ? <div className="shortform-radar-state"><b>{error}</b><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="shortform-radar-state"><b>{zh ? '正在读取 Shorts 跨频道变化…' : 'Reading cross-channel Shorts changes…'}</b></div> : events.length ? <div className="shortform-radar-grid">{events.map(event => <RadarCard key={event.id} event={event} locale={locale} onResearch={onShortResearch ? research : undefined}/>)}</div> : <div className="shortform-radar-state"><b>{zh ? '当前窗口没有足够强的 Shorts 趋势事件' : 'No strong Shorts trend events for this window'}</b><p>{zh ? '请扩大市场或时间窗口，等待更多 Shorts 快照。' : 'Expand the market or window and wait for more Shorts snapshots.'}</p></div>}
    {data?.gaps?.length ? <section className="shortform-radar-gaps"><h2>{zh ? '数据边界' : 'Data boundaries'}</h2>{data.gaps.map(gap => <p key={gap}>→ {gap}</p>)}</section> : null}
  </Container>;
}

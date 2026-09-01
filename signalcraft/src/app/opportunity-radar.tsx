'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientErrorMessage } from '@/src/lib/client-error';
import { fetchOpportunityRadar, type OpportunityRadarEvent, type OpportunityRadarResponse } from '@/src/lib/opportunity-radar';
import { beginnerAccessForRadar, competitionForRadar, opportunityStatusForRadar } from '@/src/lib/opportunity-presentation';
import { getRpmBenchmarkForTopic } from '@/src/lib/rpm-benchmarks';
import type { UiLocale } from '@/src/lib/ui-language';
import type { RadarReturnState } from '@/src/lib/niche-analysis-context';
import SignalSparkline from './signal-sparkline';

const number = (value: number | null, locale: UiLocale) => value === null || !Number.isFinite(value)
  ? locale === 'zh' ? '—' : '—'
  : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const eventTypeLabel: Record<string, { zh: string; en: string }> = {
  EMERGING_TOPIC: { zh: '新兴主题', en: 'Emerging topic' }, SMALL_CREATOR_BREAKOUT: { zh: '中小频道突破', en: 'Small creator breakout' },
  SATURATION_WARNING: { zh: '拥挤预警', en: 'Saturation warning' }, FORMAT_MIGRATION: { zh: '格式迁移', en: 'Format migration' }, SUPPLY_GAP: { zh: '供给缺口', en: 'Supply gap' },
};
const confidenceLabel: Record<string, { zh: string; en: string }> = { LOW: { zh: '低', en: 'Low' }, MEDIUM: { zh: '中', en: 'Medium' }, HIGH: { zh: '高', en: 'High' } };
const lifecycleLabel: Record<string, { zh: string; en: string }> = {
  WATCH: { zh: '早期信号', en: 'Early signal' }, EMERGING: { zh: '形成中', en: 'Emerging' }, CONFIRMED: { zh: '已验证', en: 'Validated' },
  CROWDED: { zh: '竞争拥挤', en: 'Crowded' }, SATURATING: { zh: '趋于饱和', en: 'Saturating' }, DECLINING: { zh: '正在降温', en: 'Declining' },
};
const mediaUrl = (value: string | null | undefined) => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
const formatDate = (value: string | null | undefined, locale: UiLocale) => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
};

function EvidenceVideo({ video, locale }: { video: OpportunityRadarEvent['representativeVideos'][number]; locale: UiLocale }) {
  const zh = locale === 'zh';
  const thumbnail = mediaUrl(video.thumbnail);
  const avatar = mediaUrl(video.channelAvatar);
  const content = <><span className="radar-v2-video-thumb">{thumbnail ? <img src={thumbnail} alt="" width={160} height={90} loading="lazy"/> : <i>▶</i>}{video.isBreakout ? <em>{zh ? '突破' : 'Breakout'}</em> : null}</span><span className="radar-v2-video-copy"><strong>{video.title || (zh ? '未命名公开视频' : 'Untitled public video')}</strong><small><span className="radar-v2-avatar">{avatar ? <img src={avatar} alt="" width={22} height={22}/> : 'CH'}</span>{video.channelTitle || (zh ? '公开频道' : 'Public channel')} · {number(video.views, locale)} {zh ? '播放' : 'views'}</small></span></>;
  return video.sourceUrl ? <a className="radar-v2-video" href={video.sourceUrl} target="_blank" rel="noreferrer">{content}</a> : <div className="radar-v2-video">{content}</div>;
}

export type OpportunityRadarActions = {
  onWatch?: (event: OpportunityRadarEvent) => void;
  onCreateIdea?: (event: OpportunityRadarEvent) => void;
  onResearch?: (event: OpportunityRadarEvent, returnState?: RadarReturnState) => void;
  onSwitchFormat?: (format: 'ALL' | 'SHORTS' | 'LONG_FORM') => void;
};

function RadarCard({ event, locale, onWatch, onCreateIdea, onResearch, onSelect, focused }: { event: OpportunityRadarEvent; locale: UiLocale; onSelect: (event: OpportunityRadarEvent) => void; focused?: boolean } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const kind = eventTypeLabel[event.eventType] || eventTypeLabel.EMERGING_TOPIC;
  const confidence = confidenceLabel[event.confidence] || confidenceLabel.LOW;
  const decision = opportunityStatusForRadar(event);
  const benchmark = getRpmBenchmarkForTopic(event.topic);
  const rpmRange = benchmark.lowUsd !== null && benchmark.highUsd !== null ? `$${benchmark.lowUsd} – $${benchmark.highUsd}` : null;
  const changed = event.metrics.breakoutAcceleration !== null ? `${event.metrics.breakoutAcceleration >= 0 ? '+' : ''}${event.metrics.breakoutAcceleration}%` : '—';
  const previousSample = typeof event.metrics.previousSample === 'number' ? event.metrics.previousSample : null;
  const currentSample = typeof event.metrics.currentSample === 'number' ? event.metrics.currentSample : event.sampleVideoCount;
  const guardrail = event.independentChannelCount < 2
    ? (zh ? '单频道证据：不作为跨频道机会结论。' : 'Single-channel evidence: not a cross-channel opportunity conclusion.')
    : event.sampleVideoCount < 5
      ? (zh ? '样本偏少：先观察下一次采集。' : 'Small sample: confirm on the next capture.')
      : event.creatorConcentrationTop3 !== null && event.creatorConcentrationTop3 !== undefined && event.creatorConcentrationTop3 >= 65
        ? (zh ? `Top 3 频道占 ${event.creatorConcentrationTop3}% 流量，开放度可能被高估。` : `Top 3 channels hold ${event.creatorConcentrationTop3}% of views; openness may be overstated.`)
        : null;
  const lifecycle = lifecycleLabel[event.lifecycle] || { zh: event.lifecycle, en: event.lifecycle };
  return <article className={`radar-v2-card${focused ? ' focused' : ''}`}>
    <header className="radar-v2-card-head"><div><span className="radar-v2-kicker">{kind[zh ? 'zh' : 'en']}</span><h2>{event.title}</h2><p>{event.topic} · {zh ? '长视频趋势' : 'long-form trend'}</p><span className={`radar-v2-lifecycle ${event.lifecycle.toLowerCase()}`}>{zh ? `生命周期 · ${lifecycle.zh}` : `Lifecycle · ${lifecycle.en}`}</span></div><span className={`radar-v2-decision ${decision.key.toLowerCase()}`}>{decision[zh ? 'zh' : 'en']}</span></header>
    <section className="radar-v2-decision-brief"><div><small>{zh ? '为什么值得看' : 'WHY CONSIDER IT'}</small><b>{event.facts[0] || (zh ? '公开快照中出现了可观察的跨频道变化。' : 'A measurable cross-channel change appeared in public snapshots.')}</b></div><span className={`confidence-${event.confidence.toLowerCase()}`}>{zh ? `${confidence.zh}置信度 · ${event.sampleVideoCount} 条样本` : `${confidence.en} confidence · ${event.sampleVideoCount} samples`}</span></section>
    <div className="radar-v2-decision-facts"><div><small>{zh ? '新人机会' : 'BEGINNER ACCESS'}</small><b>{beginnerAccessForRadar(event, locale)}</b><span>{event.smallCreatorBreakoutCount ? (zh ? `${event.smallCreatorBreakoutCount} 个小频道突破样本` : `${event.smallCreatorBreakoutCount} creator breakout samples`) : (zh ? '暂无突破证据' : 'No breakout proof yet')}</span></div><div><small>{zh ? '竞争程度' : 'COMPETITION'}</small><b>{competitionForRadar(event, locale)}</b><span>{event.creatorConcentrationTop3 === null || event.creatorConcentrationTop3 === undefined ? (zh ? '集中度暂无数据' : 'Concentration unavailable') : (zh ? `Top 3 占 ${event.creatorConcentrationTop3}% 播放` : `Top 3 hold ${event.creatorConcentrationTop3}% of views`)}</span></div><div><small>{zh ? '收益潜力' : 'MONETIZATION'}</small><b>{rpmRange || (zh ? '暂不估算' : 'Not estimated')}</b><span>{rpmRange ? (zh ? '公开市场 RPM 参考 / 1,000 播放' : 'Public market RPM reference / 1,000 views') : (zh ? '无可匹配公开基准' : 'No matching public benchmark')}</span></div></div>
    <section className="radar-v2-changed"><div className="radar-v2-changed-head"><small>{zh ? 'WHAT CHANGED' : 'WHAT CHANGED'}</small><SignalSparkline points={[previousSample, currentSample]} tone={currentSample >= (previousSample ?? currentSample) ? 'teal' : 'coral'} label={zh ? '历史到当前样本量对照' : 'Historical to current sample comparison'}/></div><p>{event.facts[1] || (zh ? '当前窗口出现了可观察的跨频道变化。' : 'The current window shows a measurable cross-channel change.')}</p><p className="radar-v2-baseline">{previousSample ?? 0} → {currentSample} {zh ? '历史/当前样本 · 突破变化' : 'historical/current samples · breakout change'} {changed}</p>{guardrail ? <p className="radar-v2-guardrail">! {guardrail}</p> : null}</section>
    <section className="radar-v2-guidance"><div><small>{zh ? '最大风险' : 'MAIN RISK'}</small><p>{guardrail || (decision.key === 'AVOID' ? (zh ? '供给拥挤或头部集中，不建议普通新手直接投入。' : 'Supply is crowded or concentrated; not a direct entry for most beginners.') : (zh ? '先核验代表视频，再安排小规模验证。' : 'Verify the representative videos before running a small test.'))}</p></div><div><small>{zh ? '下一步' : 'NEXT STEP'}</small><p>{decision.key === 'AVOID' ? (zh ? '保留观察，不要仅因播放量高就进入。' : 'Keep watching; do not enter solely because views are high.') : (zh ? '进入赛道评估，确认长期制作与变现边界。' : 'Open niche evaluation to confirm durable making and monetization limits.')}</p></div></section>
    <div className="radar-v2-proof"><span>✓ {event.independentChannelCount} {zh ? '个独立频道' : 'independent channels'}</span><span>✓ {event.smallCreatorBreakoutCount} {zh ? '个中小突破' : 'small creator breakouts'}</span><span>! {event.weakEvidenceVideoIds.length} {zh ? '条弱证据' : 'weak examples'}</span></div>
    <div className="radar-v2-actions" aria-label={zh ? '事件操作' : 'Event actions'}><button type="button" onClick={() => onSelect(event)}>{zh ? '查看证据' : 'View evidence'}</button>{onWatch && <button type="button" onClick={() => onWatch(event)}>{zh ? '关注事件' : 'Watch event'}</button>}{onCreateIdea && <button type="button" className="primary" onClick={() => onCreateIdea(event)}>{zh ? '创建行动草稿' : 'Create action draft'}</button>}{onResearch && <button type="button" className="research" onClick={() => onResearch(event)}>{zh ? '查看赛道评估 →' : 'Evaluate this niche →'}</button>}</div>
  </article>;
}

function SignalBar({ label, value, detail, tone = 'teal' }: { label: string; value: number | null; detail: string; tone?: 'teal' | 'coral' | 'gold' }) {
  const safe = value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, Math.round(value)));
  return <div className="radar-v2-signal"><div><span>{label}</span><b>{safe === null ? '—' : safe}</b></div><div className="radar-v2-signal-track"><i className={tone} style={{ width: `${safe === null ? 0 : safe}%` }} /></div><small>{detail}</small></div>;
}

function RadarDrawer({ event, locale, onClose, onResearch }: { event: OpportunityRadarEvent; locale: UiLocale; onClose: () => void; onResearch?: (event: OpportunityRadarEvent) => void }) {
  const zh = locale === 'zh';
  const demand = event.metrics.demandProxyGrowth;
  const supply = event.metrics.supplyGrowth;
  const breakout = event.metrics.smallCreatorSignal ?? (event.smallCreatorBreakoutCount > 0 ? Math.min(100, event.smallCreatorBreakoutCount * 20) : null);
  const openness = event.creatorConcentrationTop3 === null || event.creatorConcentrationTop3 === undefined ? null : Math.max(0, 100 - event.creatorConcentrationTop3);
  const risks = [
    event.confidence === 'LOW' ? (zh ? '置信度偏低，当前结论不适合直接扩大投入。' : 'Low confidence: do not scale investment from this signal alone.') : null,
    event.weakEvidenceVideoIds.length ? (zh ? `${event.weakEvidenceVideoIds.length} 条证据较弱，建议人工复核来源。` : `${event.weakEvidenceVideoIds.length} weak examples need manual source review.`) : null,
    event.creatorConcentrationTop3 !== null && event.creatorConcentrationTop3 !== undefined && event.creatorConcentrationTop3 >= 65 ? (zh ? `Top 3 频道占 ${event.creatorConcentrationTop3}% 流量，机会开放度可能被高估。` : `Top 3 channels hold ${event.creatorConcentrationTop3}% of views; openness may be overstated.`) : null,
    !event.baseline.multiWindow ? (zh ? '历史对照窗口不足，趋势方向仍需下一次采集确认。' : 'The comparison window is incomplete; confirm direction on the next capture.') : null,
  ].filter((item): item is string => Boolean(item));
  useEffect(() => {
    const onKeyDown = (keyboardEvent: KeyboardEvent) => { if (keyboardEvent.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
  return <div className="radar-v2-drawer-layer" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="radar-v2-drawer" role="dialog" aria-modal="true" aria-label={zh ? '机会事件详情' : 'Opportunity event details'}>
      <header className="radar-v2-drawer-head"><div><span className="radar-v2-kicker">{zh ? '机会事件详情' : 'OPPORTUNITY EVENT'}</span><h2>{event.title}</h2><p>{event.topic} · {event.format}</p></div><button type="button" className="radar-v2-drawer-close" onClick={onClose} aria-label={zh ? '关闭详情' : 'Close details'}>×</button></header>
      <div className="radar-v2-drawer-summary"><div><small>{zh ? '机会信号' : 'OPPORTUNITY SIGNAL'}</small><strong>{event.whyNowScore === null ? '—' : event.whyNowScore}</strong><span>{event.whyNowLevel.replace('_', ' ')}</span></div><div><small>{zh ? '置信度' : 'CONFIDENCE'}</small><b className={`confidence-${event.confidence.toLowerCase()}`}>{confidenceLabel[event.confidence]?.[zh ? 'zh' : 'en'] || event.confidence}</b><span>{event.sampleVideoCount} {zh ? '条样本 · ' : ' samples · '}{event.independentChannelCount} {zh ? '个频道' : ' channels'}</span></div></div>
      <section className="radar-v2-drawer-section"><h3>{zh ? '信号分解' : 'Signal breakdown'}</h3><div className="radar-v2-signal-grid"><SignalBar label={zh ? '需求变化' : 'Demand change'} value={demand === null ? null : Math.max(0, Math.min(100, 50 + demand / 2))} detail={demand === null ? (zh ? '公开代理不可用' : 'Public proxy unavailable') : `${demand >= 0 ? '+' : ''}${demand}% ${zh ? '需求代理增长' : 'demand proxy growth'}`} tone="coral"/><SignalBar label={zh ? '供给变化' : 'Supply change'} value={supply === null ? null : Math.max(0, Math.min(100, 50 + supply / 2))} detail={supply === null ? (zh ? '上传供给不可用' : 'Upload supply unavailable') : `${supply >= 0 ? '+' : ''}${supply}% ${zh ? '上传变化' : 'upload change'}`} tone="gold"/><SignalBar label={zh ? '中小频道突破' : 'Small creator breakout'} value={breakout} detail={`${event.smallCreatorBreakoutCount} ${zh ? '个突破样本' : 'breakout samples'}`}/><SignalBar label={zh ? '竞争开放度' : 'Competition openness'} value={openness} detail={openness === null ? (zh ? '频道集中度不可用' : 'Concentration unavailable') : `${openness}% ${zh ? '非 Top 3 流量' : 'views outside Top 3'}`} tone="gold"/></div></section>
      <section className="radar-v2-drawer-section"><h3>{zh ? '为什么现在出现' : 'Why this appeared'}</h3>{event.facts.slice(0, 3).map(fact => <p className="radar-v2-drawer-copy" key={fact}>{fact}</p>)}{event.inferences.slice(0, 2).map(inference => <p className="radar-v2-drawer-copy inference" key={inference}>{inference}</p>)}</section>
      <section className="radar-v2-drawer-section"><h3>{zh ? '证据范围' : 'Proof coverage'}</h3><div className="radar-v2-drawer-facts"><span><b>{event.sampleVideoCount}</b><small>{zh ? '视频样本' : 'video samples'}</small></span><span><b>{event.independentChannelCount}</b><small>{zh ? '独立频道' : 'independent channels'}</small></span><span><b>{event.weakEvidenceVideoIds.length}</b><small>{zh ? '弱证据' : 'weak examples'}</small></span><span><b>{formatDate(event.firstDetectedAt, locale)}</b><small>{zh ? '首次发现' : 'first detected'}</small></span></div></section>
      <section className="radar-v2-drawer-section"><h3>{zh ? '风险与下一步' : 'Risks and next step'}</h3>{risks.length ? <ul className="radar-v2-risk-list">{risks.map(risk => <li key={risk}>{risk}</li>)}</ul> : <p className="radar-v2-drawer-copy">{zh ? '当前没有额外风险提示；仍请回到代表视频核验。' : 'No additional risk flags; still verify against representative videos.'}</p>}</section>
      <section className="radar-v2-drawer-section"><h3>{zh ? '代表视频' : 'Proof videos'}</h3><div className="radar-v2-video-list">{event.representativeVideos.length ? event.representativeVideos.slice(0, 4).map(video => <EvidenceVideo key={video.videoId} video={video} locale={locale}/>) : <p className="radar-v2-drawer-copy">{zh ? '当前没有可展示的公开视频。' : 'No public videos available for this event.'}</p>}</div></section>
      <footer className="radar-v2-drawer-footer"><button type="button" onClick={onClose}>{zh ? '返回趋势雷达' : 'Back to trend radar'}</button>{onResearch && <button type="button" className="primary" onClick={() => onResearch(event)}>{zh ? '打开赛道评估 →' : 'Evaluate this niche →'}</button>}</footer>
    </aside>
  </div>;
}

function matchesRadarLane(event: OpportunityRadarEvent, lane: string) {
  const decision = opportunityStatusForRadar(event);
  if (lane === 'ALL') return decision.key !== 'AVOID';
  if (lane === 'RECENT') return (event.lifecycle === 'EMERGING' || event.lifecycle === 'CONFIRMED') && decision.key !== 'AVOID';
  if (lane === 'BEGINNER') return beginnerAccessForRadar(event, 'zh') === '较高';
  if (lane === 'SMALL_CREATOR') return event.eventType === 'SMALL_CREATOR_BREAKOUT' || event.smallCreatorBreakoutCount > 0;
  if (lane === 'HIGH_RPM') {
    const benchmark = getRpmBenchmarkForTopic(event.topic);
    return benchmark.highUsd !== null && benchmark.highUsd >= 8;
  }
  if (lane === 'CAUTION') return decision.key === 'CAUTION' || decision.key === 'AVOID';
  return false;
}

export default function OpportunityRadar({ locale, embedded = false, onWatch, onCreateIdea, onResearch, onSwitchFormat }: { locale: UiLocale; embedded?: boolean } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [market, setMarket] = useState('all');
  const [lane, setLane] = useState('ALL');
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<OpportunityRadarEvent | null>(null);
  const [data, setData] = useState<OpportunityRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const restoreScrollRef = useRef<number | null>(null);
  const research = useCallback((event: OpportunityRadarEvent) => {
    if (!onResearch) return;
    onResearch(event, {
      scrollPosition: typeof globalThis.window === 'undefined' ? 0 : globalThis.window.scrollY,
      page: 1,
      sort: 'whyNowScore',
      activeTab: lane,
      filters: { market, window },
    });
  }, [lane, market, onResearch, window]);
  const [contextReady, setContextReady] = useState(false);
  useEffect(() => {
    const syncRadarContext = () => {
      const params = new URLSearchParams(globalThis.window.location.search);
      const topic = params.get('topic') || params.get('nicheName');
      const shouldRestore = params.get('restore') === '1';
      const restoreContext = shouldRestore ? (() => {
        try {
          const raw = globalThis.window.sessionStorage.getItem('signalcraft:niche-analysis-context:v1');
          return raw ? JSON.parse(raw) as { returnState?: { scrollPosition?: number; activeTab?: string; filters?: { market?: string }; }; timeWindow?: string } : null;
        } catch { return null; }
      })() : null;
      if (topic) setFocusTopic(topic);
      if (shouldRestore && restoreContext?.returnState) {
        const state = restoreContext.returnState;
        restoreScrollRef.current = typeof state.scrollPosition === 'number' && Number.isFinite(state.scrollPosition) ? state.scrollPosition : null;
        if (state.activeTab && ['ALL', 'RECENT', 'BEGINNER', 'SMALL_CREATOR', 'HIGH_RPM', 'CAUTION'].includes(state.activeTab)) setLane(state.activeTab);
        const restoredMarket = state.filters?.market;
        if (typeof restoredMarket === 'string' && restoredMarket) setMarket(restoredMarket);
        const restoredWindow = restoreContext.timeWindow;
        if (restoredWindow === '7d' || restoredWindow === '14d' || restoredWindow === '30d') setWindow(restoredWindow);
      } else {
        const queryWindow = params.get('window');
        if (queryWindow === '7d' || queryWindow === '14d' || queryWindow === '30d') setWindow(queryWindow);
        const queryMarket = params.get('market');
        if (queryMarket) setMarket(queryMarket);
        const queryLane = params.get('lane');
        if (queryLane) setLane(queryLane);
      }
      setContextReady(true);
    };
    const timer = globalThis.window.setTimeout(syncRadarContext, 0);
    return () => globalThis.window.clearTimeout(timer);
  }, []);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null);
    try { const next = await fetchOpportunityRadar({ market, window, limit: 500 }, { signal: controller.signal }); setData(next); }
    catch (reason) { if (!controller.signal.aborted) setError(clientErrorMessage(reason, zh ? '长视频趋势雷达数据暂时不可用。' : 'Long-form Trend Radar is temporarily unavailable.')); }
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
  const allEvents = useMemo(() => data?.events || [], [data]);
  const laneCount = useCallback((key: string) => allEvents.filter(event => matchesRadarLane(event, key)).length, [allEvents]);
  const laneOptions = useMemo(() => [{ key: 'ALL', zh: '最近有机会', en: 'Worth a look' }, { key: 'BEGINNER', zh: '新人更友好', en: 'Beginner friendly' }, { key: 'SMALL_CREATOR', zh: '小频道正在跑出来', en: 'Small creators breaking out' }, { key: 'HIGH_RPM', zh: '高收益参考', en: 'Higher RPM reference' }, { key: 'CAUTION', zh: '需要谨慎', en: 'Use caution' }], []);
  const events = allEvents.filter(event => matchesRadarLane(event, lane)).sort((left, right) => {
    if (!focusTopic) return 0;
    const leftMatch = left.topic.toLowerCase() === focusTopic.toLowerCase() || left.title.toLowerCase().includes(focusTopic.toLowerCase());
    const rightMatch = right.topic.toLowerCase() === focusTopic.toLowerCase() || right.title.toLowerCase().includes(focusTopic.toLowerCase());
    return Number(rightMatch) - Number(leftMatch);
  });
  const Container = embedded ? 'section' : 'main';
  return <Container className="radar-v2-page"><section className="radar-v2-hero"><div><span className="radar-v2-kicker">LONG-FORM TREND RADAR · CHANGE DETECTION</span><h1>{zh ? '识别正在形成的长视频趋势变化。' : 'Detect long-form trend changes before they become obvious.'}</h1><p>{zh ? '长视频趋势雷达的对象是趋势事件，而不是单条爆款。它用历史基线、跨频道证据和中小频道突破回答：发生了什么、为什么是现在、是不是已经拥挤。' : 'Long-form Trend Radar tracks trend events, not isolated viral videos. Historical baselines, independent channels, and small-creator proof show what changed and whether it is too late.'}</p></div><div className="radar-v2-hero-stamp"><strong>14D</strong><span>{zh ? '默认主窗口' : 'default window'}</span><i/></div></section>
    {onSwitchFormat ? <nav className="radar-v2-format-tabs" aria-label={zh ? '内容形态' : 'Content format'}><button type="button" onClick={() => onSwitchFormat('ALL')}>{zh ? '全部' : 'All'}</button><button type="button" onClick={() => onSwitchFormat('SHORTS')}>Shorts</button><button type="button" className="active" aria-current="page">{zh ? '长视频' : 'Long-form'}</button></nav> : null}
    <section className="radar-v2-toolbar"><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value as typeof window)}><option value="7d">7D</option><option value="14d">14D · {zh ? '推荐' : 'recommended'}</option><option value="30d">30D</option></select></label><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><button type="button" className="primary" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '读取中…' : 'Loading…') : (zh ? '更新雷达' : 'Refresh radar')}</button></section>
    {data && <section className="radar-v2-scope"><div><span className="radar-v2-kicker">DATA SCOPE</span><b>{data.dataScope.currentRows} {zh ? '条当前长视频 · ' : 'current long-form · '}{data.dataScope.historicalRows} {zh ? '条历史基线' : 'historical baseline'}</b><small>{data.dataScope.note}</small></div><div><strong>{data.events.length}</strong><span>{zh ? '个事件' : 'events'}</span></div></section>}
    {focusTopic ? <div className="radar-v2-focus"><span>{zh ? '已定位赛道' : 'Focused niche'}</span><b>{focusTopic}</b><button type="button" onClick={() => setFocusTopic(null)}>{zh ? '清除定位' : 'Clear focus'}</button></div> : null}
    <nav className="radar-v2-tabs" aria-label={zh ? '雷达事件类型' : 'Radar event type'}>{laneOptions.map(option => <button key={option.key} type="button" className={lane === option.key ? 'active' : ''} onClick={() => setLane(option.key)}>{option[zh ? 'zh' : 'en']}{data ? <small>{laneCount(option.key)}</small> : null}</button>)}</nav>
    {error ? <div className="radar-v2-state error"><b>{zh ? '暂时无法读取长视频趋势雷达' : 'Long-form Trend Radar unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="radar-v2-state"><b>{zh ? '正在计算跨频道变化…' : 'Computing cross-channel changes…'}</b></div> : events.length ? <div className="radar-v2-grid">{events.map(event => <RadarCard key={event.id} event={event} locale={locale} onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch ? research : undefined} onSelect={setSelectedEvent} focused={Boolean(focusTopic && (event.topic.toLowerCase() === focusTopic.toLowerCase() || event.title.toLowerCase().includes(focusTopic.toLowerCase())))}/>)}</div> : <div className="radar-v2-state"><b>{zh ? '当前窗口没有足够强的趋势事件' : 'No strong trend events for this window'}</b><p>{zh ? '宁缺毋滥：请扩大市场或时间窗口，等待更多长视频历史快照。' : 'No threshold lowering: expand the market or window and wait for comparable long-form snapshots.'}</p></div>}
    <section className="radar-v2-boundary"><div><span className="radar-v2-kicker">READ THE SIGNAL</span><h2>{zh ? '这不是长视频赛道评估。' : 'This is not long-form niche evaluation.'}</h2></div><div><p>{zh ? '长视频赛道评估回答“这个方向是否值得长期进入”；长视频趋势雷达回答“最近发生了什么变化”。两套评分与证据链独立。' : 'Long-form Niche Evaluation asks whether a direction is worth entering over time. Long-form Trend Radar asks what changed recently. Their scores and evidence chains stay separate.'}</p>{(data?.gaps || []).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
    {selectedEvent ? <RadarDrawer event={selectedEvent} locale={locale} onClose={() => setSelectedEvent(null)} onResearch={onResearch ? research : undefined}/> : null}
  </Container>;
}

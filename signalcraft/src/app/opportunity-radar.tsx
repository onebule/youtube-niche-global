'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clientErrorMessage } from '@/src/lib/client-error';
import { fetchOpportunityRadar, type OpportunityRadarEvent, type OpportunityRadarResponse } from '@/src/lib/opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';

const number = (value: number | null, locale: UiLocale) => value === null || !Number.isFinite(value)
  ? locale === 'zh' ? '—' : '—'
  : new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const lifecycleLabel: Record<string, { zh: string; en: string }> = {
  WATCH: { zh: '观察', en: 'Watch' }, EMERGING: { zh: '形成中', en: 'Emerging' }, CONFIRMED: { zh: '已验证', en: 'Confirmed' },
  CROWDED: { zh: '拥挤', en: 'Crowded' }, SATURATING: { zh: '趋于饱和', en: 'Saturating' }, DECLINING: { zh: '回落', en: 'Declining' },
};
const eventTypeLabel: Record<string, { zh: string; en: string }> = {
  EMERGING_TOPIC: { zh: '新兴主题', en: 'Emerging topic' }, SMALL_CREATOR_BREAKOUT: { zh: '中小频道突破', en: 'Small creator breakout' },
  SATURATION_WARNING: { zh: '拥挤预警', en: 'Saturation warning' }, FORMAT_MIGRATION: { zh: '格式迁移', en: 'Format migration' }, SUPPLY_GAP: { zh: '供给缺口', en: 'Supply gap' },
};
const confidenceLabel: Record<string, { zh: string; en: string }> = { LOW: { zh: '低', en: 'Low' }, MEDIUM: { zh: '中', en: 'Medium' }, HIGH: { zh: '高', en: 'High' } };
const mediaUrl = (value: string | null | undefined) => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
const formatDate = (value: string | null | undefined, locale: UiLocale) => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' }).format(date);
};

function Metric({ label, value, suffix = '' }: { label: string; value: string | number; suffix?: string }) {
  return <div className="radar-v2-metric"><small>{label}</small><b>{value}{suffix}</b></div>;
}

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
  onResearch?: (event: OpportunityRadarEvent) => void;
};

function RadarCard({ event, locale, onWatch, onCreateIdea, onResearch, onSelect }: { event: OpportunityRadarEvent; locale: UiLocale; onSelect: (event: OpportunityRadarEvent) => void } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const lifecycle = lifecycleLabel[event.lifecycle] || lifecycleLabel.WATCH;
  const kind = eventTypeLabel[event.eventType] || eventTypeLabel.EMERGING_TOPIC;
  const confidence = confidenceLabel[event.confidence] || confidenceLabel.LOW;
  const changed = event.metrics.breakoutAcceleration !== null ? `${event.metrics.breakoutAcceleration >= 0 ? '+' : ''}${event.metrics.breakoutAcceleration}%` : '—';
  return <article className="radar-v2-card">
    <header className="radar-v2-card-head"><div><span className="radar-v2-kicker">{kind[zh ? 'zh' : 'en']}</span><h2>{event.title}</h2><p>{event.topic} · {event.format}</p></div><span className={`radar-v2-lifecycle ${event.lifecycle.toLowerCase()}`}>{lifecycle[zh ? 'zh' : 'en']}</span></header>
    <div className="radar-v2-score-row"><div><small>{zh ? '机会信号' : 'OPPORTUNITY SIGNAL'}</small><strong>{event.whyNowScore === null ? '—' : event.whyNowScore}</strong><span>{event.whyNowLevel.replace('_', ' ')}</span></div><div><small>{zh ? '置信度' : 'CONFIDENCE'}</small><strong className={`confidence-${event.confidence.toLowerCase()}`}>{confidence[zh ? 'zh' : 'en']}</strong><span>{event.dataQuality}</span></div><div><small>{zh ? '窗口' : 'WINDOW'}</small><strong>{event.baseline.windowDays}D</strong><span>{event.sampleVideoCount} {zh ? '样本' : 'samples'}</span></div></div>
    <div className="radar-v2-metrics"><Metric label={zh ? '独立频道' : 'Independent channels'} value={event.independentChannelCount}/><Metric label={zh ? '中小频道突破' : 'Small creator breakouts'} value={event.smallCreatorBreakoutCount}/><Metric label={zh ? '中位 VPD' : 'Median VPD'} value={number(event.medianVpd, locale)} suffix={event.vpdAcceleration === null ? '' : ` (${event.vpdAcceleration >= 0 ? '+' : ''}${event.vpdAcceleration}%)`}/><Metric label={zh ? '异常密度' : 'Outlier density'} value={event.outlierDensity === null ? '—' : event.outlierDensity} suffix="%"/></div>
    <section className="radar-v2-changed"><small>{zh ? 'WHAT CHANGED' : 'WHAT CHANGED'}</small><p>{event.facts[1] || (zh ? '当前窗口出现了可观察的跨频道变化。' : 'The current window shows a measurable cross-channel change.')}</p><p className="radar-v2-baseline">{event.metrics.previousSample ?? 0} → {event.metrics.currentSample} {zh ? '历史/当前样本 · 突破变化' : 'historical/current samples · breakout change'} {changed}</p></section>
    <div className="radar-v2-proof"><span>✓ {event.independentChannelCount} {zh ? '个独立频道' : 'independent channels'}</span><span>✓ {event.smallCreatorBreakoutCount} {zh ? '个中小突破' : 'small creator breakouts'}</span><span>! {event.weakEvidenceVideoIds.length} {zh ? '条弱证据' : 'weak examples'}</span></div>
    <div className="radar-v2-actions" aria-label={zh ? '事件操作' : 'Event actions'}><button type="button" onClick={() => onSelect(event)}>{zh ? '查看证据' : 'View evidence'}</button>{onWatch && <button type="button" onClick={() => onWatch(event)}>{zh ? '关注事件' : 'Watch event'}</button>}{onCreateIdea && <button type="button" className="primary" onClick={() => onCreateIdea(event)}>{zh ? '创建行动草稿' : 'Create action draft'}</button>}{onResearch && <button type="button" className="research" onClick={() => onResearch(event)}>{zh ? '深入赛道研究 →' : 'Research this niche →'}</button>}</div>
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
      <footer className="radar-v2-drawer-footer"><button type="button" onClick={onClose}>{zh ? '返回雷达' : 'Back to radar'}</button>{onResearch && <button type="button" className="primary" onClick={() => onResearch(event)}>{zh ? '深入赛道研究 →' : 'Research this niche →'}</button>}</footer>
    </aside>
  </div>;
}

function matchesRadarLane(event: OpportunityRadarEvent, lane: string) {
  if (lane === 'ALL') return true;
  if (lane === 'ACCELERATING') return event.lifecycle === 'EMERGING' || event.lifecycle === 'CONFIRMED' || (event.metrics.demandProxyGrowth !== null && event.metrics.demandProxyGrowth > 0) || (event.vpdAcceleration !== null && event.vpdAcceleration > 0);
  if (lane === 'EMERGING') return event.lifecycle === 'EMERGING';
  if (lane === 'SMALL_CREATOR') return event.eventType === 'SMALL_CREATOR_BREAKOUT';
  if (lane === 'SUPPLY_GAP') return event.eventType === 'SUPPLY_GAP';
  if (lane === 'FORMAT_MIGRATION') return event.eventType === 'FORMAT_MIGRATION';
  if (lane === 'SATURATION') return event.eventType === 'SATURATION_WARNING' || event.lifecycle === 'SATURATING';
  return false;
}

export default function OpportunityRadar({ locale, embedded = false, onWatch, onCreateIdea, onResearch }: { locale: UiLocale; embedded?: boolean } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [market, setMarket] = useState('all');
  const [lane, setLane] = useState('ALL');
  const [selectedEvent, setSelectedEvent] = useState<OpportunityRadarEvent | null>(null);
  const [data, setData] = useState<OpportunityRadarResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController(); requestRef.current = controller;
    setLoading(true); setError(null);
    try { const next = await fetchOpportunityRadar({ market, window, limit: 500 }, { signal: controller.signal }); setData(next); }
    catch (reason) { if (!controller.signal.aborted) setError(clientErrorMessage(reason, zh ? '机会雷达数据暂时不可用。' : 'Opportunity Radar is temporarily unavailable.')); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [market, window, zh]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const allEvents = data?.events || [];
  const laneCount = useCallback((key: string) => allEvents.filter(event => matchesRadarLane(event, key)).length, [allEvents]);
  const laneOptions = useMemo(() => [{ key: 'ALL', zh: '全部事件', en: 'All events' }, { key: 'ACCELERATING', zh: '正在加速', en: 'Accelerating' }, { key: 'EMERGING', zh: '新机会', en: 'Emerging' }, { key: 'SMALL_CREATOR', zh: '小频道突破', en: 'Small creator breakout' }, { key: 'SUPPLY_GAP', zh: '供需缺口', en: 'Supply gap' }, ...(allEvents.some(event => event.eventType === 'FORMAT_MIGRATION') ? [{ key: 'FORMAT_MIGRATION', zh: '格式迁移', en: 'Format migration' }] : []), ...(allEvents.some(event => event.eventType === 'SATURATION_WARNING' || event.lifecycle === 'SATURATING') ? [{ key: 'SATURATION', zh: '饱和预警', en: 'Saturation' }] : [])], [allEvents]);
  const events = allEvents.filter(event => matchesRadarLane(event, lane));
  const Container = embedded ? 'section' : 'main';
  return <Container className="radar-v2-page"><section className="radar-v2-hero"><div><span className="radar-v2-kicker">LONG-FORM OPPORTUNITY RADAR · MARKET SIGNAL INTELLIGENCE</span><h1>{zh ? '发现正在形成的长视频机会。' : 'Detect long-form changes before they become obvious.'}</h1><p>{zh ? '长视频机会雷达的对象是 Opportunity Event，而不是单条爆款。它用历史基线、跨频道证据和中小频道突破回答：发生了什么、为什么是现在、是不是已经拥挤。' : 'The long-form radar tracks Opportunity Events, not isolated viral videos. Historical baselines, independent channels and small creator proof show what changed and whether it is too late.'}</p></div><div className="radar-v2-hero-stamp"><strong>14D</strong><span>{zh ? '默认主窗口' : 'default window'}</span><i/></div></section>
    <section className="radar-v2-toolbar"><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value as typeof window)}><option value="7d">7D</option><option value="14d">14D · {zh ? '推荐' : 'recommended'}</option><option value="30d">30D</option></select></label><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><button type="button" className="primary" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '读取中…' : 'Loading…') : (zh ? '更新雷达' : 'Refresh radar')}</button></section>
    {data && <section className="radar-v2-scope"><div><span className="radar-v2-kicker">DATA SCOPE</span><b>{data.dataScope.currentRows} {zh ? '条当前长视频 · ' : 'current long-form · '}{data.dataScope.historicalRows} {zh ? '条历史基线' : 'historical baseline'}</b><small>{data.dataScope.note}</small></div><div><strong>{data.events.length}</strong><span>{zh ? '个事件' : 'events'}</span></div></section>}
    <nav className="radar-v2-tabs" aria-label={zh ? '雷达事件类型' : 'Radar event type'}>{laneOptions.map(option => <button key={option.key} type="button" className={lane === option.key ? 'active' : ''} onClick={() => setLane(option.key)}>{option[zh ? 'zh' : 'en']}{data ? <small>{laneCount(option.key)}</small> : null}</button>)}</nav>
    {error ? <div className="radar-v2-state error"><b>{zh ? '暂时无法读取机会雷达' : 'Opportunity Radar unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="radar-v2-state"><b>{zh ? '正在计算跨频道变化…' : 'Computing cross-channel changes…'}</b></div> : events.length ? <div className="radar-v2-grid">{events.map(event => <RadarCard key={event.id} event={event} locale={locale} onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} onSelect={setSelectedEvent}/>)}</div> : <div className="radar-v2-state"><b>{zh ? '当前窗口没有足够强的机会事件' : 'No strong opportunity events for this window'}</b><p>{zh ? '宁缺毋滥：请扩大市场或时间窗口，等待更多长视频历史快照。' : 'No threshold lowering: expand the market or window and wait for comparable long-form snapshots.'}</p></div>}
    <section className="radar-v2-boundary"><div><span className="radar-v2-kicker">READ THE SIGNAL</span><h2>{zh ? '这不是长视频机会排行榜。' : 'This is not a long-form leaderboard.'}</h2></div><div><p>{zh ? '长视频机会页回答“哪个赛道整体值得做”；机会雷达回答“最近发生了什么变化”。两套分数与证据链独立。' : 'Long-form Opportunities asks which niches are attractive overall. Radar asks what changed recently. Their scores and evidence chains stay separate.'}</p>{(data?.gaps || []).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
    {selectedEvent ? <RadarDrawer event={selectedEvent} locale={locale} onClose={() => setSelectedEvent(null)} onResearch={onResearch}/> : null}
  </Container>;
}

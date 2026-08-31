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
};

function RadarCard({ event, locale, onWatch, onCreateIdea }: { event: OpportunityRadarEvent; locale: UiLocale } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const lifecycle = lifecycleLabel[event.lifecycle] || lifecycleLabel.WATCH;
  const kind = eventTypeLabel[event.eventType] || eventTypeLabel.EMERGING_TOPIC;
  const confidence = confidenceLabel[event.confidence] || confidenceLabel.LOW;
  const changed = event.metrics.breakoutAcceleration !== null ? `${event.metrics.breakoutAcceleration >= 0 ? '+' : ''}${event.metrics.breakoutAcceleration}%` : '—';
  return <article className="radar-v2-card">
    <header className="radar-v2-card-head"><div><span className="radar-v2-kicker">{kind[zh ? 'zh' : 'en']}</span><h2>{event.title}</h2><p>{event.topic} · {event.format}</p></div><span className={`radar-v2-lifecycle ${event.lifecycle.toLowerCase()}`}>{lifecycle[zh ? 'zh' : 'en']}</span></header>
    <div className="radar-v2-score-row"><div><small>WHY NOW</small><strong>{event.whyNowScore === null ? '—' : event.whyNowScore}</strong><span>{event.whyNowLevel.replace('_', ' ')}</span></div><div><small>{zh ? '置信度' : 'CONFIDENCE'}</small><strong className={`confidence-${event.confidence.toLowerCase()}`}>{confidence[zh ? 'zh' : 'en']}</strong><span>{event.dataQuality}</span></div><div><small>{zh ? '窗口' : 'WINDOW'}</small><strong>{event.baseline.windowDays}D</strong><span>{event.sampleVideoCount} {zh ? '样本' : 'samples'}</span></div></div>
    <div className="radar-v2-metrics"><Metric label={zh ? '独立频道' : 'Independent channels'} value={event.independentChannelCount}/><Metric label={zh ? '中小频道突破' : 'Small creator breakouts'} value={event.smallCreatorBreakoutCount}/><Metric label={zh ? '中位 VPD' : 'Median VPD'} value={number(event.medianVpd, locale)} suffix={event.vpdAcceleration === null ? '' : ` (${event.vpdAcceleration >= 0 ? '+' : ''}${event.vpdAcceleration}%)`}/><Metric label={zh ? '异常密度' : 'Outlier density'} value={event.outlierDensity === null ? '—' : event.outlierDensity} suffix="%"/><Metric label={zh ? '需求代理' : 'Demand proxy'} value={event.metrics.demandProxyGrowth === null ? '—' : `${event.metrics.demandProxyGrowth >= 0 ? '+' : ''}${event.metrics.demandProxyGrowth}%`}/><Metric label={zh ? '上传供给' : 'Upload supply'} value={event.metrics.supplyGrowth === null ? '—' : `${event.metrics.supplyGrowth >= 0 ? '+' : ''}${event.metrics.supplyGrowth}%`}/><Metric label={zh ? 'Top 3 流量占比' : 'Top 3 view share'} value={event.creatorConcentrationTop3 === null || event.creatorConcentrationTop3 === undefined ? '—' : event.creatorConcentrationTop3} suffix="%"/></div>
    <section className="radar-v2-changed"><small>{zh ? 'WHAT CHANGED' : 'WHAT CHANGED'}</small><p>{event.facts[1] || (zh ? '当前窗口出现了可观察的跨频道变化。' : 'The current window shows a measurable cross-channel change.')}</p><p className="radar-v2-baseline">{event.metrics.previousSample ?? 0} → {event.metrics.currentSample} {zh ? '历史/当前样本 · 突破变化' : 'historical/current samples · breakout change'} {changed}</p></section>
    <div className="radar-v2-proof"><span>✓ {event.independentChannelCount} {zh ? '个独立频道' : 'independent channels'}</span><span>✓ {event.smallCreatorBreakoutCount} {zh ? '个中小突破' : 'small creator breakouts'}</span><span>! {event.weakEvidenceVideoIds.length} {zh ? '条弱证据' : 'weak examples'}</span></div>
    {(onWatch || onCreateIdea) && <div className="radar-v2-actions" aria-label={zh ? '事件操作' : 'Event actions'}>{onWatch && <button type="button" onClick={() => onWatch(event)}>{zh ? '关注事件' : 'Watch event'}</button>}{onCreateIdea && <button type="button" className="primary" onClick={() => onCreateIdea(event)}>{zh ? '创建行动草稿' : 'Create action draft'}</button>}</div>}
    <details className="radar-v2-details"><summary>{zh ? '查看证据与判断依据' : 'View evidence and reasoning'}</summary><div className="radar-v2-detail-grid"><div><h3>{zh ? 'FACT · 可验证事实' : 'FACT · Verifiable'}</h3>{event.facts.map(fact => <p key={fact}>{fact}</p>)}</div><div><h3>{zh ? 'INFERENCE · 推断' : 'INFERENCE · Inference'}</h3>{event.inferences.length ? event.inferences.map(item => <p key={item}>{item}</p>) : <p>{zh ? '暂无额外推断。' : 'No additional inference.'}</p>}</div></div><p className="radar-v2-confidence-note">{event.confidenceNote}</p><section className="radar-v2-lifecycle-history"><h3>{zh ? '生命周期轨迹' : 'Lifecycle history'}</h3><ol>{(event.lifecycleHistory?.length ? event.lifecycleHistory : [{ previousState: null, newState: event.lifecycle, changedAt: event.firstDetectedAt, reason: zh ? '首次在当前窗口检测到该事件。' : 'First detected in the current window.' }]).map((item, index) => { const next = lifecycleLabel[item.newState] || lifecycleLabel.WATCH; const previous = item.previousState ? lifecycleLabel[item.previousState] || lifecycleLabel.WATCH : null; return <li key={`${item.changedAt || 'unknown'}-${item.newState}-${index}`}><time>{formatDate(item.changedAt, locale)}</time><b>{next[zh ? 'zh' : 'en']}</b><span>{previous ? `${previous[zh ? 'zh' : 'en']} → ${next[zh ? 'zh' : 'en']}` : (zh ? '首次检测' : 'First detected')}</span>{item.reason ? <small>{item.reason}</small> : null}</li>; })}</ol></section><div className="radar-v2-video-list">{event.representativeVideos.map(video => <EvidenceVideo key={video.videoId} video={video} locale={locale}/>)}</div><details className="radar-v2-debug"><summary>{zh ? '开发调试：为什么检测到？' : 'Debug: why was this detected?'}</summary><pre>{JSON.stringify({ eventType: event.eventType, lifecycle: event.lifecycle, lifecycleHistory: event.lifecycleHistory || [], baseline: event.baseline, metrics: event.metrics, evidenceVideoIds: event.evidenceVideoIds, evidenceChannelIds: event.evidenceChannelIds }, null, 2)}</pre></details></details>
  </article>;
}

export default function OpportunityRadar({ locale, onWatch, onCreateIdea }: { locale: UiLocale } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [market, setMarket] = useState('all');
  const [lane, setLane] = useState('ALL');
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
  const laneOptions = useMemo(() => [{ key: 'ALL', zh: '全部事件', en: 'All events' }, { key: 'EMERGING', zh: '形成中', en: 'Emerging' }, { key: 'SMALL_CREATOR', zh: '中小频道突破', en: 'Small creator' }, ...(data?.lanes.FORMAT_MIGRATION ? [{ key: 'FORMAT_MIGRATION', zh: '格式迁移', en: 'Format migration' }] : []), ...(data?.lanes.SUPPLY_GAP ? [{ key: 'SUPPLY_GAP', zh: '供给缺口', en: 'Supply gap' }] : []), ...(data?.lanes.SATURATION ? [{ key: 'SATURATION', zh: '饱和预警', en: 'Saturation' }] : [])], [data]);
  const events = (data?.events || []).filter(event => lane === 'ALL' || (lane === 'SMALL_CREATOR' ? event.eventType === 'SMALL_CREATOR_BREAKOUT' : lane === 'FORMAT_MIGRATION' ? event.eventType === 'FORMAT_MIGRATION' : lane === 'SUPPLY_GAP' ? event.eventType === 'SUPPLY_GAP' : lane === 'SATURATION' ? event.eventType === 'SATURATION_WARNING' || event.lifecycle === 'SATURATING' : event.lifecycle === lane));
  return <main className="radar-v2-page"><section className="radar-v2-hero"><div><span className="radar-v2-kicker">OPPORTUNITY RADAR · MARKET SIGNAL INTELLIGENCE</span><h1>{zh ? '发现正在形成的内容机会。' : 'Detect what is changing before it becomes obvious.'}</h1><p>{zh ? '雷达的对象是 Opportunity Event，而不是单条爆款。它用历史基线、跨频道证据和中小频道突破回答：发生了什么、为什么是现在、是不是已经拥挤。' : 'Radar tracks Opportunity Events, not isolated viral videos. Historical baselines, independent channels and small creator proof show what changed and whether it is too late.'}</p></div><div className="radar-v2-hero-stamp"><strong>14D</strong><span>{zh ? '默认主窗口' : 'default window'}</span><i/></div></section>
    <section className="radar-v2-toolbar"><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value as typeof window)}><option value="7d">7D</option><option value="14d">14D · {zh ? '推荐' : 'recommended'}</option><option value="30d">30D</option></select></label><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><button type="button" className="primary" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '读取中…' : 'Loading…') : (zh ? '更新雷达' : 'Refresh radar')}</button></section>
    {data && <section className="radar-v2-scope"><div><span className="radar-v2-kicker">DATA SCOPE</span><b>{data.dataScope.currentRows} {zh ? '条当前长视频 · ' : 'current long-form · '}{data.dataScope.historicalRows} {zh ? '条历史基线' : 'historical baseline'}</b><small>{data.dataScope.note}</small></div><div><strong>{data.events.length}</strong><span>{zh ? '个事件' : 'events'}</span></div></section>}
    <nav className="radar-v2-tabs" aria-label={zh ? '雷达事件类型' : 'Radar event type'}>{laneOptions.map(option => <button key={option.key} type="button" className={lane === option.key ? 'active' : ''} onClick={() => setLane(option.key)}>{option[zh ? 'zh' : 'en']}{option.key !== 'ALL' && data ? <small>{data.lanes[option.key] || 0}</small> : null}</button>)}</nav>
    {error ? <div className="radar-v2-state error"><b>{zh ? '暂时无法读取机会雷达' : 'Opportunity Radar unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="radar-v2-state"><b>{zh ? '正在计算跨频道变化…' : 'Computing cross-channel changes…'}</b></div> : events.length ? <div className="radar-v2-grid">{events.map(event => <RadarCard key={event.id} event={event} locale={locale} onWatch={onWatch} onCreateIdea={onCreateIdea}/>)}</div> : <div className="radar-v2-state"><b>{zh ? '当前窗口没有足够强的机会事件' : 'No strong opportunity events for this window'}</b><p>{zh ? '宁缺毋滥：请扩大市场或时间窗口，等待更多长视频历史快照。' : 'No threshold lowering: expand the market or window and wait for comparable long-form snapshots.'}</p></div>}
    <section className="radar-v2-boundary"><div><span className="radar-v2-kicker">READ THE SIGNAL</span><h2>{zh ? '这不是长视频机会排行榜。' : 'This is not a long-form leaderboard.'}</h2></div><div><p>{zh ? '长视频机会页回答“哪个赛道整体值得做”；机会雷达回答“最近发生了什么变化”。两套分数与证据链独立。' : 'Long-form Opportunities asks which niches are attractive overall. Radar asks what changed recently. Their scores and evidence chains stay separate.'}</p>{(data?.gaps || []).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
  </main>;
}

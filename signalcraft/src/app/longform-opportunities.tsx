'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLongformOpportunities, type LongformOpportunity, type LongformResponse } from '@/src/lib/longform';
import type { UiLocale } from '@/src/lib/ui-language';

const formatNumber = (value: number | null, locale: UiLocale) => {
  if (value === null || !Number.isFinite(value)) return locale === 'zh' ? '未知' : 'Unknown';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

const score = (value: number | null) => value === null ? '—' : Math.round(value);

function Score({ label, value, tone = 'teal' }: { label: string; value: number | null; tone?: 'teal' | 'coral' | 'ink' }) {
  return <div className={`longform-score ${tone}`}><span>{label}</span><b>{score(value)}</b><small>/100</small></div>;
}

function OpportunityCard({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  return <article className="longform-opportunity">
    <div className="longform-opportunity-head"><div><span className="longform-kicker">{opportunity.topic}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2></div><span className={`longform-confidence ${opportunity.confidenceLabel.toLowerCase()}`}>{zh ? `置信度 ${opportunity.confidence}` : `${opportunity.confidence} confidence`}</span></div>
    <div className="longform-stats"><span><b>{opportunity.sampleSize}</b>{zh ? '条视频' : ' videos'}</span><span><b>{opportunity.channelCount}</b>{zh ? '个频道' : ' channels'}</span><span><b>{formatNumber(opportunity.medianViews, locale)}</b>{zh ? '中位播放' : ' median views'}</span></div>
    <div className="longform-score-grid"><Score label={zh ? '市场机会' : 'Market'} value={opportunity.marketOpportunity} tone="coral"/><Score label={zh ? '执行适配' : 'Execution'} value={opportunity.executionFit}/><Score label={zh ? '进入分' : 'Entry'} value={opportunity.entryScore} tone="ink"/></div>
    <div className="longform-lanes">{opportunity.lanes.map(lane => <span key={lane}>{lane.replace('_', ' ')}</span>)}</div>
    <div className="longform-evidence"><div><b>{zh ? '可验证证据' : 'Evidence'}</b><small>{zh ? '基于 YouTube 公开元数据与采集快照' : 'YouTube public metadata and saved snapshots'}</small></div><span>{zh ? '样本' : 'Sample'} {opportunity.sampleSize} · {zh ? '频道' : 'Creators'} {opportunity.channelCount}</span></div>
    <details className="longform-representatives"><summary>{zh ? '查看代表视频' : 'View representative videos'}</summary>{opportunity.representativeVideos.map(video => {
      const content = <><span>{video.title}</span><small>{video.channelTitle || (zh ? '公开频道' : 'Public channel')} · {formatNumber(video.views, locale)}</small></>;
      return video.sourceUrl ? <a key={video.videoId} href={video.sourceUrl} target="_blank" rel="noreferrer">{content}</a> : <div key={video.videoId} className="longform-representative-missing">{content}</div>;
    })}</details>
  </article>;
}

export default function LongformOpportunities({ locale }: { locale: UiLocale }) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState('28d');
  const [market, setMarket] = useState('all');
  const [lane, setLane] = useState('ALL');
  const [data, setData] = useState<LongformResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await fetchLongformOpportunities({ market, window, limit: 100 })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : (zh ? '数据暂时不可用。' : 'Data is temporarily unavailable.')); }
    finally { setLoading(false); }
  }, [market, window, zh]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const laneOptions = useMemo(() => [{ key: 'ALL', label: zh ? '全部机会' : 'All opportunities' }, { key: 'BREAKOUT', label: zh ? '爆发信号' : 'Breakout' }, { key: 'UNDERSERVED', label: zh ? '低粉机会' : 'Underserved' }, { key: 'EVERGREEN', label: zh ? '长期需求' : 'Evergreen' }, { key: 'FORMAT_GAP', label: zh ? '形态空位' : 'Format gaps' }], [zh]);
  const opportunities = (data?.opportunities || []).filter(item => lane === 'ALL' || item.lanes.includes(lane));
  return <main className="longform-page">
    <section className="longform-hero"><div><span className="longform-kicker">LONG-FORM DISCOVERY ENGINE</span><h1>{zh ? '找到值得长期制作的长视频方向。' : 'Find long-form directions worth making.'}</h1><p>{zh ? '市场机会与执行适配分开计算。每个结论都回到公开样本、采集时间和置信度，不把不可见的 CTR、留存或收益伪装成事实。' : 'Market opportunity and execution fit stay separate. Every conclusion points back to public samples, capture time, and confidence.'}</p></div><div className="longform-hero-mark"><span>28</span><small>{zh ? '天窗口' : 'day window'}</small><i /></div></section>
    <section className="longform-toolbar"><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value)}><option value="7d">{zh ? '近 7 天' : '7 days'}</option><option value="28d">{zh ? '近 28 天' : '28 days'}</option><option value="90d">{zh ? '近 90 天' : '90 days'}</option><option value="365d">{zh ? '近 1 年' : '1 year'}</option></select></label><button type="button" className="longform-refresh" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '更新中…' : 'Refreshing…') : (zh ? '更新数据' : 'Refresh')}</button></section>
    {data && <section className="longform-scope"><div><span className="longform-kicker">DATA SCOPE</span><b>{zh ? `${data.dataScope.longformRows} 条长视频 · ${data.dataScope.collectedRows} 条已采集样本` : `${data.dataScope.longformRows} long-form · ${data.dataScope.collectedRows} collected rows`}</b><small>{data.dataScope.latestCapturedAt ? `${zh ? '最近采集' : 'Latest capture'} ${new Date(data.dataScope.latestCapturedAt).toLocaleString()}` : (zh ? '尚无采集时间' : 'No capture timestamp')}</small></div><div className="longform-coverage"><b>{data.availabilityAudit.coverage}%</b><small>{zh ? '可用字段覆盖' : 'field coverage'}</small></div></section>}
    <nav className="longform-lane-tabs" aria-label={zh ? '机会类型' : 'Opportunity lanes'}>{laneOptions.map(item => <button type="button" key={item.key} className={lane === item.key ? 'active' : ''} onClick={() => setLane(item.key)}>{item.label}{item.key !== 'ALL' && data ? <small>{data.lanes[item.key] || 0}</small> : null}</button>)}</nav>
    {error ? <div className="longform-state error"><b>{zh ? '暂时无法读取长视频数据' : 'Long-form data is unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="longform-state"><b>{zh ? '正在整理公开长视频样本…' : 'Preparing public long-form samples…'}</b></div> : opportunities.length ? <div className="longform-grid">{opportunities.map(item => <OpportunityCard key={item.key} opportunity={item} locale={locale}/>)}</div> : <div className="longform-state"><b>{zh ? '当前窗口还没有足够的长视频样本' : 'Not enough long-form samples for this window'}</b><p>{zh ? '这不是演示数据。请扩大市场或时间窗口，等采集任务积累可比较的快照。' : 'This is not demo data. Expand the market or window and wait for comparable snapshots.'}</p></div>}
    <section className="longform-boundary"><div><span className="longform-kicker">READ THE SIGNAL</span><h2>{zh ? '哪些数据目前不能回答？' : 'What can this data not answer yet?'}</h2></div><div>{(data?.gaps || [zh ? '字幕、CTR、留存、RPM/CPM 和收入不属于公开字段。' : 'Transcripts, CTR, retention, RPM/CPM and revenue are not public fields.']).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
  </main>;
}

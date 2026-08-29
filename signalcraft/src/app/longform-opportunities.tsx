'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchLongformOpportunities, type LongformOpportunity, type LongformResponse } from '@/src/lib/longform';
import type { UiLocale } from '@/src/lib/ui-language';

const formatNumber = (value: number | null, locale: UiLocale) => {
  if (value === null || !Number.isFinite(value)) return locale === 'zh' ? '未知' : 'Unknown';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

const score = (value: number | null) => value === null ? '—' : Math.round(value);

const mediaUrl = (value: string | null | undefined) => typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;

const formatDuration = (seconds: number | null, locale: UiLocale) => {
  if (seconds === null || !Number.isFinite(seconds)) return locale === 'zh' ? '时长未知' : 'Duration unknown';
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  if (minutes === 0) return locale === 'zh' ? `${remainder} 秒` : `${remainder}s`;
  const hours = Math.floor(minutes / 60);
  const minutePart = minutes % 60;
  if (hours) return locale === 'zh' ? `${hours} 小时 ${minutePart} 分` : `${hours}h ${minutePart}m`;
  return locale === 'zh' ? `${minutes} 分 ${String(remainder).padStart(2, '0')} 秒` : `${minutes}m ${String(remainder).padStart(2, '0')}s`;
};

const initials = (value: string | null, locale: UiLocale) => {
  const fallback = locale === 'zh' ? '频' : 'CH';
  const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.slice(0, 2).map(part => part[0]).join('').toUpperCase();
};

function RepresentativeVideoRow({ video, locale }: { video: LongformOpportunity['representativeVideos'][number]; locale: UiLocale }) {
  const zh = locale === 'zh';
  const thumbnail = mediaUrl(video.thumbnail);
  const channelAvatar = mediaUrl(video.channelAvatar);
  const channelTitle = video.channelTitle || (zh ? '公开频道' : 'Public channel');
  const content = <>
    <span className="longform-representative-thumb">
      {thumbnail ? <img src={thumbnail} alt={zh ? `${video.title} 视频缩略图` : `${video.title} video thumbnail`} width={192} height={108} loading="lazy" decoding="async"/> : <span className="longform-representative-placeholder" aria-hidden="true">▶</span>}
      <small className="longform-representative-duration">{formatDuration(video.durationSeconds, locale)}</small>
    </span>
    <span className="longform-representative-copy">
      <strong className="longform-representative-title" title={video.title}>{video.title}</strong>
      <span className="longform-representative-meta">
        <span className="longform-representative-avatar" aria-hidden="true">
          {channelAvatar ? <img src={channelAvatar} alt="" width={32} height={32} loading="lazy" decoding="async"/> : initials(channelTitle, locale)}
        </span>
        <span className="longform-representative-channel" title={channelTitle}>{channelTitle}</span>
        <small className="longform-representative-views">{formatNumber(video.views, locale)} {zh ? '播放' : 'views'}</small>
      </span>
    </span>
  </>;
  return video.sourceUrl ? <a className="longform-representative-row" href={video.sourceUrl} target="_blank" rel="noreferrer" aria-label={zh ? `在新标签页打开：${video.title}` : `Open in a new tab: ${video.title}`}>{content}</a> : <div className="longform-representative-row longform-representative-missing">{content}</div>;
}

function Score({ label, value, tone = 'teal' }: { label: string; value: number | null; tone?: 'teal' | 'coral' | 'ink' }) {
  return <div className={`longform-score ${tone}`}><span>{label}</span><b>{score(value)}</b><small>/100</small></div>;
}

function OpportunityCard({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const representativeCount = opportunity.representativeVideos.length;
  return <article className="longform-opportunity">
    <div className="longform-opportunity-head"><div><span className="longform-kicker">{opportunity.topic}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2></div><span className={`longform-confidence ${opportunity.confidenceLabel.toLowerCase()}`}>{zh ? `置信度 ${opportunity.confidence}` : `${opportunity.confidence} confidence`}</span></div>
    <div className="longform-stats"><span><b>{opportunity.sampleSize}</b>{zh ? '条视频' : ' videos'}</span><span><b>{opportunity.channelCount}</b>{zh ? '个频道' : ' channels'}</span><span><b>{formatNumber(opportunity.medianViews, locale)}</b>{zh ? '中位播放' : ' median views'}</span></div>
    <div className="longform-score-grid"><Score label={zh ? '市场机会' : 'Market'} value={opportunity.marketOpportunity} tone="coral"/><Score label={zh ? '执行适配' : 'Execution'} value={opportunity.executionFit}/><Score label={zh ? '进入分' : 'Entry'} value={opportunity.entryScore} tone="ink"/></div>
    <div className="longform-lanes">{opportunity.lanes.map(lane => <span key={lane}>{lane.replace('_', ' ')}</span>)}</div>
    <div className="longform-evidence"><div><b>{zh ? '可验证证据' : 'Evidence'}</b><small>{zh ? '基于 YouTube 公开元数据与采集快照' : 'YouTube public metadata and saved snapshots'}</small></div><span>{zh ? '样本' : 'Sample'} {opportunity.sampleSize} · {zh ? '频道' : 'Creators'} {opportunity.channelCount}</span></div>
    <details className="longform-representatives"><summary>{representativeCount ? (zh ? `查看 ${representativeCount} 条代表视频` : `View ${representativeCount} representative videos`) : (zh ? '暂无代表视频' : 'No representative videos yet')}</summary>{representativeCount ? opportunity.representativeVideos.map(video => <RepresentativeVideoRow key={video.videoId} video={video} locale={locale}/>) : <p className="longform-representatives-empty">{zh ? '当前样本还没有可展开的公开视频。' : 'No public videos are available for this sample yet.'}</p>}</details>
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
    try { setData(await fetchLongformOpportunities({ market, window, limit: 500 })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : (zh ? '数据暂时不可用。' : 'Data is temporarily unavailable.')); }
    finally { setLoading(false); }
  }, [market, window, zh]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  const laneOptions = useMemo(() => [{ key: 'ALL', label: zh ? '全部机会' : 'All opportunities' }, { key: 'BREAKOUT', label: zh ? '爆发信号' : 'Breakout' }, { key: 'UNDERSERVED', label: zh ? '低粉机会' : 'Underserved' }, { key: 'EVERGREEN', label: zh ? '长期需求' : 'Evergreen' }, { key: 'FORMAT_GAP', label: zh ? '形态空位' : 'Format gaps' }], [zh]);
  const opportunities = (data?.opportunities || []).filter(item => lane === 'ALL' || item.lanes.includes(lane));
  return <main className="longform-page">
    <section className="longform-hero"><div><span className="longform-kicker">LONG-FORM DISCOVERY ENGINE</span><h1>{zh ? '找到值得长期制作的长视频方向。' : 'Find long-form directions worth making.'}</h1><p>{zh ? '市场机会与执行适配分开计算。每个结论都回到公开样本、采集时间和置信度，不把不可见的 CTR、留存或收益伪装成事实。' : 'Market opportunity and execution fit stay separate. Every conclusion points back to public samples, capture time, and confidence.'}</p></div><div className="longform-hero-mark"><span>28</span><small>{zh ? '天窗口' : 'day window'}</small><i /></div></section>
    <section className="longform-toolbar"><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value)}><option value="7d">{zh ? '近 7 天' : '7 days'}</option><option value="28d">{zh ? '近 28 天' : '28 days'}</option><option value="90d">{zh ? '近 90 天' : '90 days'}</option><option value="365d">{zh ? '近 1 年' : '1 year'}</option></select></label><button type="button" className="longform-refresh" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '更新中…' : 'Refreshing…') : (zh ? '更新数据' : 'Refresh')}</button></section>
    {data && <section className="longform-scope"><div><span className="longform-kicker">DATA SCOPE</span><b>{zh ? `${data.dataScope.longformRows} 条长视频 · ${data.dataScope.collectedRows} 条已采集样本` : `${data.dataScope.longformRows} long-form · ${data.dataScope.collectedRows} collected rows`}</b><small>{data.dataScope.source === 'longform_video_features' ? (zh ? '独立长视频候选池 · 不与 Shorts 共用排名样本' : 'Independent long-form pool · isolated from Shorts ranking samples') : (zh ? '兼容读取现有公开信号池 · 独立采集尚未启用' : 'Compatibility read from the existing public signal pool · independent collector not enabled')}</small><small>{data.dataScope.latestCapturedAt ? `${zh ? '最近采集' : 'Latest capture'} ${new Date(data.dataScope.latestCapturedAt).toLocaleString()}` : (zh ? '尚无采集时间' : 'No capture timestamp')}</small><small>{data.dataScope.marketSampleLimit ? (zh ? `按市场分层取样：每个市场最多 ${data.dataScope.marketSampleLimit} 条` : `Market-stratified pool: up to ${data.dataScope.marketSampleLimit} rows per market`) : null}</small>{data.dataScope.failedMarkets?.length ? <small className="longform-partial-warning">{zh ? `部分市场读取失败：${data.dataScope.failedMarkets.join('、')}` : `Partial market read failure: ${data.dataScope.failedMarkets.join(', ')}`}</small> : null}</div><div className="longform-coverage"><b>{data.availabilityAudit.coverage}%</b><small>{zh ? '可用字段覆盖' : 'field coverage'}</small></div></section>}
    <nav className="longform-lane-tabs" aria-label={zh ? '机会类型' : 'Opportunity lanes'}>{laneOptions.map(item => <button type="button" key={item.key} className={lane === item.key ? 'active' : ''} onClick={() => setLane(item.key)}>{item.label}{item.key !== 'ALL' && data ? <small>{data.lanes[item.key] || 0}</small> : null}</button>)}</nav>
    {error ? <div className="longform-state error"><b>{zh ? '暂时无法读取长视频数据' : 'Long-form data is unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="longform-state"><b>{zh ? '正在整理公开长视频样本…' : 'Preparing public long-form samples…'}</b></div> : opportunities.length ? <div className="longform-grid">{opportunities.map(item => <OpportunityCard key={item.key} opportunity={item} locale={locale}/>)}</div> : <div className="longform-state"><b>{zh ? '当前窗口还没有足够的长视频样本' : 'Not enough long-form samples for this window'}</b><p>{zh ? '这不是演示数据。请扩大市场或时间窗口，等采集任务积累可比较的快照。' : 'This is not demo data. Expand the market or window and wait for comparable snapshots.'}</p></div>}
    <section className="longform-boundary"><div><span className="longform-kicker">READ THE SIGNAL</span><h2>{zh ? '哪些数据目前不能回答？' : 'What can this data not answer yet?'}</h2></div><div>{(data?.gaps || [zh ? '字幕、CTR、留存、RPM/CPM 和收入不属于公开字段。' : 'Transcripts, CTR, retention, RPM/CPM and revenue are not public fields.']).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
  </main>;
}

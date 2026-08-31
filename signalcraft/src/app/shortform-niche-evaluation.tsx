'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildTrendRadarHref, contextFromQuery, saveNicheAnalysisContext, type NicheAnalysisContext } from '@/src/lib/niche-analysis-context';
import type { UiLocale } from '@/src/lib/ui-language';

type ShortEvidenceVideo = {
  videoId: string;
  title: string;
  channelTitle: string | null;
  thumbnail: string | null;
  channelAvatar: string | null;
  views: number | null;
  sourceUrl: string | null;
  isBreakout: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, fallback = '—') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function number(value: unknown, locale: UiLocale) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function mediaUrl(value: unknown) {
  return typeof value === 'string' && /^https:\/\//i.test(value) ? value : null;
}

function routeNavigate(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('signalcraft:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function normalizeVideo(value: unknown): ShortEvidenceVideo | null {
  if (!isRecord(value)) return null;
  const videoId = text(value.videoId, 'unknown-video');
  return {
    videoId,
    title: text(value.title, '未命名短视频'),
    channelTitle: typeof value.channelTitle === 'string' ? value.channelTitle : null,
    thumbnail: mediaUrl(value.thumbnail),
    channelAvatar: mediaUrl(value.channelAvatar),
    views: typeof value.views === 'number' && Number.isFinite(value.views) ? value.views : null,
    sourceUrl: mediaUrl(value.sourceUrl),
    isBreakout: value.isBreakout === true,
  };
}

function trendLabels(value: string, locale: UiLocale) {
  const labels: Record<string, { zh: string; en: string }> = {
    SHORTS_BREAKOUT: { zh: '中小频道突破', en: 'Creator breakout' },
    SHORTS_EMERGING: { zh: '短视频形式形成中', en: 'Emerging short-form' },
    SHORTS_CROWDED: { zh: '供给拥挤预警', en: 'Crowding warning' },
    WATCH: { zh: '观察', en: 'Watch' },
    EMERGING: { zh: '形成中', en: 'Emerging' },
    CONFIRMED: { zh: '已验证', en: 'Confirmed' },
    CROWDED: { zh: '拥挤', en: 'Crowded' },
    LOW: { zh: '低置信度', en: 'Low confidence' },
    MEDIUM: { zh: '中置信度', en: 'Medium confidence' },
    HIGH: { zh: '高置信度', en: 'High confidence' },
  };
  return labels[value]?.[locale === 'zh' ? 'zh' : 'en'] || value || '—';
}

function verdictFor(lifecycle: string, confidence: string, eventType: string, locale: UiLocale) {
  const zh = locale === 'zh';
  if (lifecycle === 'CROWDED' || eventType === 'SHORTS_CROWDED') return { key: 'caution', label: zh ? '谨慎验证' : 'Validate cautiously', body: zh ? '需求仍可见，但供给拥挤或头部集中度较高；先做小样本测试。' : 'Demand is visible, but supply or creator concentration is high; test with a small sample first.' };
  if (confidence === 'LOW') return { key: 'observe', label: zh ? '继续观察' : 'Keep observing', body: zh ? '证据置信度偏低，先等待下一次 Shorts 快照确认方向。' : 'Evidence confidence is low; confirm the direction on the next Shorts snapshot.' };
  return { key: 'validate', label: zh ? '值得验证' : 'Worth validating', body: zh ? '跨频道或突破信号已经出现，下一步是验证可复用的内容形式，而不是直接扩大投入。' : 'Cross-channel or breakout evidence is present; validate a repeatable format before scaling.' };
}

function EvidenceVideo({ video, locale }: { video: ShortEvidenceVideo; locale: UiLocale }) {
  const zh = locale === 'zh';
  const channel = video.channelTitle || (zh ? '公开频道' : 'Public channel');
  const content = <><span className="short-evaluation-video-thumb">{video.thumbnail ? <img src={video.thumbnail} alt="" width={180} height={101} loading="lazy"/> : <i aria-hidden="true">▶</i>}{video.isBreakout ? <em>{zh ? '突破样本' : 'Breakout'}</em> : null}</span><span className="short-evaluation-video-copy"><strong>{video.title}</strong><small><span className="short-evaluation-avatar">{video.channelAvatar ? <img src={video.channelAvatar} alt="" width={24} height={24}/> : 'CH'}</span>{channel} · {number(video.views, locale)} {zh ? '播放' : 'views'}</small></span></>;
  return video.sourceUrl ? <a className="short-evaluation-video" href={video.sourceUrl} target="_blank" rel="noreferrer">{content}</a> : <div className="short-evaluation-video">{content}</div>;
}

export default function ShortformNicheEvaluation({ locale }: { locale: UiLocale }) {
  const zh = locale === 'zh';
  const [context, setContext] = useState<NicheAnalysisContext | null>(null);
  useEffect(() => {
    const sync = () => setContext(contextFromQuery(new URLSearchParams(globalThis.window.location.search)));
    sync();
    globalThis.window.addEventListener('popstate', sync);
    globalThis.window.addEventListener('signalcraft:navigate', sync);
    return () => { globalThis.window.removeEventListener('popstate', sync); globalThis.window.removeEventListener('signalcraft:navigate', sync); };
  }, []);
  const trend = isRecord(context?.trendSignals) ? context.trendSignals : {};
  const breakout = isRecord(context?.breakoutSignals) ? context.breakoutSignals : {};
  const smallCreator = isRecord(context?.smallCreatorSignals) ? context.smallCreatorSignals : {};
  const videos = useMemo(() => (context?.representativeVideos || []).map(normalizeVideo).filter((item): item is ShortEvidenceVideo => Boolean(item)).slice(0, 8), [context]);
  const lifecycle = text(trend.lifecycle, 'WATCH').toUpperCase();
  const eventType = text(trend.eventType, 'SHORTS_EMERGING').toUpperCase();
  const confidence = text(context?.confidence, '—').toUpperCase();
  const verdict = verdictFor(lifecycle, confidence, eventType, locale);
  const returnToRadar = () => {
    if (!context) return;
    saveNicheAnalysisContext(context);
    routeNavigate(buildTrendRadarHref(context, true));
  };
  if (!context) return <main className="short-evaluation-page"><section className="short-evaluation-empty"><span className="shortform-radar-kicker">SHORTS NICHE EVALUATION</span><h1>{zh ? '先从 Shorts 趋势雷达选择一个方向。' : 'Choose a direction from Shorts Trend Radar first.'}</h1><p>{zh ? '评估页只展示已选趋势事件的公开证据，不会凭空生成 Shorts 分数。' : 'This view only evaluates public evidence from a selected Shorts trend event; it does not invent a Shorts score.'}</p><button type="button" onClick={() => routeNavigate('/short-radar')}>{zh ? '返回 Shorts 趋势雷达 →' : 'Back to Shorts Trend Radar →'}</button></section></main>;
  return <main className="short-evaluation-page">
    <header className="short-evaluation-hero"><div><span className="shortform-radar-kicker">SHORTS NICHE EVALUATION · EVIDENCE BRIEF</span><h1>{zh ? '把一个 Shorts 变化，评估成可验证方向。' : 'Turn a Shorts change into a testable direction.'}</h1><p>{zh ? '这里承接趋势雷达的证据，判断下一步该验证什么；不复用长视频评分、不读取长视频候选池，也不改变现有 Shorts 产品。' : 'This brief carries Trend Radar evidence into the next validation step. It does not reuse long-form scores or candidate pools, and it leaves the existing Shorts product unchanged.'}</p></div><div className="short-evaluation-stamp"><strong>SHORTS</strong><span>{zh ? '独立评估' : 'isolated evaluation'}</span><i/></div></header>
    <section className="short-evaluation-context"><div><span className="shortform-radar-kicker">SELECTED SIGNAL</span><h2>{context.nicheName}</h2><p>{context.topicName || context.nicheName} · {context.format || 'SHORT_FORM'} · {context.timeWindow || '—'}</p></div><button type="button" onClick={returnToRadar}>{zh ? '← 返回趋势雷达' : '← Back to Trend Radar'}</button></section>
    <section className={`short-evaluation-verdict ${verdict.key}`}><div><span className="shortform-radar-kicker">NEXT DECISION</span><h2>{verdict.label}</h2><p>{verdict.body}</p></div><div className="short-evaluation-verdict-note"><b>{zh ? '这不是长期进入分' : 'Not a durable-entry score'}</b><span>{zh ? '结论只用于安排下一轮 Shorts 验证。' : 'The conclusion only schedules the next Shorts validation step.'}</span></div></section>
    <section className="short-evaluation-metrics" aria-label={zh ? 'Shorts 评估证据' : 'Shorts evaluation evidence'}><article><span>{zh ? '趋势状态' : 'Trend state'}</span><b>{trendLabels(lifecycle, locale)}</b><small>{trendLabels(eventType, locale)}</small></article><article><span>{zh ? '趋势机会信号' : 'Trend opportunity signal'}</span><b>{number(trend.whyNowScore, locale)}</b><small>{zh ? '来自雷达，不是赛道评分' : 'From Radar, not niche scoring'}</small></article><article><span>{zh ? '置信度' : 'Confidence'}</span><b>{trendLabels(confidence, locale)}</b><small>{text(trend.dataQuality, zh ? '证据质量未知' : 'Evidence quality unavailable')}</small></article><article><span>{zh ? '对照窗口' : 'Baseline'}</span><b>{context.timeWindow || '—'}</b><small>{zh ? '与雷达保持同一窗口' : 'Same window as Radar'}</small></article></section>
    <section className="short-evaluation-grid"><article><span className="shortform-radar-kicker">01 · DEMAND / SPREAD</span><h2>{zh ? '需求是否跨频道出现？' : 'Is the demand spreading across channels?'}</h2><p>{Array.isArray(trend.facts) && trend.facts[0] ? String(trend.facts[0]) : (zh ? '当前没有额外需求事实；回到代表视频核验。' : 'No extra demand fact was carried over; verify the representative videos.')}</p><div className="short-evaluation-stat-row"><div><b>{number(trend.sampleVideoCount ?? context.representativeVideos?.length, locale)}</b><span>{zh ? '视频样本' : 'video samples'}</span></div><div><b>{number(trend.independentChannelCount, locale)}</b><span>{zh ? '独立频道' : 'independent channels'}</span></div><div><b>{number(trend.demandProxyGrowth, locale)}{trend.demandProxyGrowth !== undefined && trend.demandProxyGrowth !== null ? '%' : ''}</b><span>{zh ? '需求代理变化' : 'demand proxy change'}</span></div></div></article><article><span className="shortform-radar-kicker">02 · CREATOR ACCESS</span><h2>{zh ? '小频道是否有切入证据？' : 'Is there an opening for smaller creators?'}</h2><p>{zh ? '只读雷达已识别的突破与集中度证据，不把它解释成保证。' : 'Read the Radar breakout and concentration evidence without turning it into a guarantee.'}</p><div className="short-evaluation-stat-row"><div><b>{number(breakout.count ?? smallCreator.count, locale)}</b><span>{zh ? '突破样本' : 'breakout samples'}</span></div><div><b>{number(smallCreator.signal, locale)}</b><span>{zh ? '小频道信号' : 'creator signal'}</span></div><div><b>{number(trend.creatorConcentrationTop3, locale)}{trend.creatorConcentrationTop3 !== undefined && trend.creatorConcentrationTop3 !== null ? '%' : ''}</b><span>{zh ? 'Top 3 集中度' : 'Top 3 concentration'}</span></div></div></article></section>
    <section className="short-evaluation-evidence"><div className="short-evaluation-section-head"><div><span className="shortform-radar-kicker">03 · PUBLIC PROOF</span><h2>{zh ? '代表视频证据' : 'Representative video evidence'}</h2></div><span>{videos.length ? `${videos.length} ${zh ? '条已带入' : 'carried over'}` : (zh ? '暂无' : 'None')}</span></div>{videos.length ? <div className="short-evaluation-video-list">{videos.map(video => <EvidenceVideo key={video.videoId} video={video} locale={locale}/>)}</div> : <p className="short-evaluation-muted">{zh ? '当前事件没有可展示的公开视频；不要用空白补成结论。' : 'No public videos were carried over for this event; do not fill the gap with an invented conclusion.'}</p>}</section>
    <section className="short-evaluation-facts"><div><span className="shortform-radar-kicker">04 · WHY NOW</span><h2>{zh ? '为什么现在值得验证？' : 'Why validate now?'}</h2>{Array.isArray(trend.facts) && trend.facts.length ? trend.facts.slice(0, 3).map(fact => <p key={String(fact)}>✓ {String(fact)}</p>) : <p>{zh ? '当前没有额外事实。' : 'No additional facts were carried over.'}</p>}</div><div><span className="shortform-radar-kicker">05 · GUARDRAIL</span><h2>{zh ? '进入前先确认' : 'Confirm before entering'}</h2><p>→ {zh ? '趋势机会信号不是收益承诺，RPM、留存、CTR 仍不可由公开数据回答。' : 'Trend opportunity signals are not a revenue promise; RPM, retention, and CTR remain unavailable from public data.'}</p><p>→ {zh ? '先做一轮小样本 Shorts 测试，再决定是否扩大制作。' : 'Run a small Shorts test before expanding production.'}</p><button type="button" onClick={returnToRadar}>{zh ? '回到雷达看同方向变化 →' : 'Return to Radar for the next change →'}</button></div></section>
  </main>;
}

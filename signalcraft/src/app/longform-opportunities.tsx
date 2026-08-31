'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLongformOpportunities, type LongformOpportunity, type LongformResponse } from '@/src/lib/longform';
import { buildLongformEvidenceLayer, type LongformEvidenceSignal, type LongformRiskFlag } from '@/src/lib/longform-intelligence';
import { clientErrorMessage } from '@/src/lib/client-error';
import type { UiLocale } from '@/src/lib/ui-language';

const formatNumber = (value: number | null, locale: UiLocale) => {
  if (value === null || !Number.isFinite(value)) return locale === 'zh' ? '未知' : 'Unknown';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
};

const score = (value: number | null) => value === null ? '—' : Math.round(value);

const laneLabels: Record<string, { zh: string; en: string }> = {
  BREAKOUT: { zh: '爆发信号', en: 'Breakout' },
  UNDERSERVED: { zh: '低粉机会', en: 'Underserved' },
  EVERGREEN: { zh: '长期需求', en: 'Evergreen' },
  FORMAT_GAP: { zh: '形态空位', en: 'Format gap' },
};

const windowLabels: Record<string, { value: string; zh: string; en: string }> = {
  '7d': { value: '7', zh: '天窗口', en: 'day window' },
  '28d': { value: '28', zh: '天窗口', en: 'day window' },
  '90d': { value: '90', zh: '天窗口', en: 'day window' },
  '365d': { value: '1', zh: '年窗口', en: 'year window' },
};

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

function RepresentativeVideoRow({ video, locale, priority = false }: { video: LongformOpportunity['representativeVideos'][number]; locale: UiLocale; priority?: boolean }) {
  const zh = locale === 'zh';
  const thumbnail = mediaUrl(video.thumbnail);
  const channelAvatar = mediaUrl(video.channelAvatar);
  const channelTitle = video.channelTitle || (zh ? '公开频道' : 'Public channel');
  const titleZh = zh && video.titleZh && video.titleZh.trim() && video.titleZh.trim() !== video.title.trim() ? video.titleZh.trim() : null;
  const content = <>
    <span className="longform-representative-thumb">
      {thumbnail ? <img src={thumbnail} alt={zh ? `${video.title} 视频缩略图` : `${video.title} video thumbnail`} width={192} height={108} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"/> : <span className="longform-representative-placeholder" aria-hidden="true">▶</span>}
      <small className="longform-representative-duration">{formatDuration(video.durationSeconds, locale)}</small>
    </span>
    <span className="longform-representative-copy">
      <span className="longform-representative-title" title={titleZh ? `${video.title} · ${titleZh}` : video.title}>
        <strong>{video.title}</strong>
        {titleZh ? <small aria-label={`中文翻译：${titleZh}`}>{titleZh}</small> : null}
      </span>
      <span className="longform-representative-meta">
        <span className="longform-representative-avatar" aria-hidden="true">
          {channelAvatar ? <img src={channelAvatar} alt="" width={32} height={32} loading={priority ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : 'auto'} decoding="async"/> : initials(channelTitle, locale)}
        </span>
        <span className="longform-representative-channel" title={channelTitle}>{channelTitle}</span>
        <small className="longform-representative-views">{formatNumber(video.views, locale)} {zh ? '播放' : 'views'}</small>
      </span>
    </span>
  </>;
  return video.sourceUrl ? <a className="longform-representative-row" href={video.sourceUrl} target="_blank" rel="noreferrer" aria-label={zh ? `在新标签页打开：${video.title}` : `Open in a new tab: ${video.title}`}>{content}</a> : <div className="longform-representative-row longform-representative-missing">{content}</div>;
}

function Score({ label, value, tone = 'teal', hint }: { label: string; value: number | null; tone?: 'teal' | 'coral' | 'ink'; hint: string }) {
  return <div className={`longform-score ${tone}`} title={`${label}：${hint}`} aria-label={`${label} ${score(value)} / 100，${hint}`}><span>{label}</span><b>{score(value)}</b><small>/100</small><em>{hint}</em></div>;
}

function decisionFor(opportunity: LongformOpportunity, locale: UiLocale) {
  const zh = locale === 'zh';
  if (opportunity.entryScore === null || opportunity.confidenceLabel === 'LOW') return { key: 'thin', label: zh ? '证据偏薄' : 'Evidence thin' };
  if (opportunity.entryScore >= 70 && opportunity.confidenceLabel === 'HIGH') return { key: 'priority', label: zh ? '优先验证' : 'Prioritize validation' };
  if (opportunity.entryScore >= 55) return { key: 'watch', label: zh ? '值得观察' : 'Worth watching' };
  return { key: 'thin', label: zh ? '证据偏薄' : 'Evidence thin' };
}

function recommendationFor(opportunity: LongformOpportunity | null, locale: UiLocale) {
  if (!opportunity) return { key: 'insufficient', label: locale === 'zh' ? '数据不足' : 'INSUFFICIENT DATA' };
  if (opportunity.recommendation) {
    const labels: Record<NonNullable<LongformOpportunity['recommendation']>, { key: string; zh: string; en: string }> = {
      BUILD: { key: 'build', zh: '可以建设', en: 'BUILD' },
      TEST: { key: 'test', zh: '值得测试', en: 'TEST' },
      WATCH: { key: 'watch', zh: '谨慎测试', en: 'WATCH' },
      AVOID: { key: 'avoid', zh: '暂不建议', en: 'AVOID' },
      INSUFFICIENT_DATA: { key: 'insufficient', zh: '数据不足', en: 'INSUFFICIENT DATA' },
    };
    const remote = labels[opportunity.recommendation];
    return { key: remote.key, label: locale === 'zh' ? remote.zh : remote.en };
  }
  const decision = decisionFor(opportunity, locale);
  if (decision.key === 'priority') return { key: 'test', label: locale === 'zh' ? '值得测试' : 'TEST' };
  if (decision.key === 'watch') return { key: 'watch', label: locale === 'zh' ? '谨慎测试' : 'WATCH' };
  return { key: 'insufficient', label: locale === 'zh' ? '数据不足' : 'INSUFFICIENT DATA' };
}

function summaryMetric(value: number | null | undefined, locale: UiLocale) {
  return value === null || value === undefined || !Number.isFinite(value) ? (locale === 'zh' ? '数据不足' : 'N/A') : String(Math.round(value));
}

const evidenceSignalLabels: Record<LongformEvidenceSignal['source'], { zh: string; en: string }> = {
  growth_proxy: { zh: '近期样本增长代理', en: 'Recent-sample growth proxy' },
  competition_proxy: { zh: '竞争开放度代理', en: 'Competition openness proxy' },
  small_creator_proxy: { zh: '小频道表现代理', en: 'Small-creator performance proxy' },
  creator_diversity_proxy: { zh: '频道多样性代理', en: 'Creator diversity proxy' },
};

const riskFlagLabels: Record<LongformRiskFlag, { zh: string; en: string }> = {
  SMALL_SAMPLE: { zh: '样本少于 5 条', en: 'Fewer than 5 samples' },
  NARROW_CREATOR_BASE: { zh: '频道覆盖少于 3 个', en: 'Fewer than 3 creators' },
  LOW_CONFIDENCE: { zh: '置信度偏低', en: 'Low confidence' },
  NO_REPRESENTATIVE_EVIDENCE: { zh: '暂无代表视频证据', en: 'No representative video evidence' },
  AVOID_RECOMMENDATION: { zh: '当前建议不要直接进入', en: 'Current recommendation is not to enter directly' },
};

function LongformEvidenceLayer({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const layer = buildLongformEvidenceLayer(opportunity);
  const signals = [
    { key: 'demand', label: zh ? '需求趋势' : 'Demand trend', signal: layer.signals.demand, note: zh ? '只能作为公开增长代理' : 'Public growth proxy only' },
    { key: 'supply', label: zh ? '供给空位' : 'Supply gap', signal: layer.signals.supply, note: zh ? '不是完整的市场供给量' : 'Not total market supply' },
    { key: 'smallCreator', label: zh ? '小频道机会' : 'Small-creator access', signal: layer.signals.smallCreator, note: zh ? '用于判断是否只由大频道占据' : 'Checks whether large channels dominate' },
    { key: 'diversity', label: zh ? '创作者多样性' : 'Creator diversity', signal: layer.signals.diversity, note: zh ? '用于确认跨频道重复出现' : 'Cross-channel confirmation' },
  ];
  return <section className="longform-evidence-layer" aria-label={zh ? '长视频机会证据层' : 'Long-form opportunity evidence layer'}>
    <div className="longform-evidence-layer-head"><div><span className="longform-kicker">P1 · EVIDENCE LAYER</span><b>{zh ? '供需、竞争与收益边界' : 'Demand, competition and revenue boundaries'}</b><small>{zh ? '代理指标用于解释排序，不等于完整业务事实。' : 'Proxy metrics explain ranking; they are not complete business facts.'}</small></div><span>{zh ? '只读真实字段' : 'Observed fields only'}</span></div>
    <div className="longform-evidence-layer-grid">
      {signals.map(({ key, label, signal, note }) => <article key={key}><div><span>{label}</span><em>{signal.value === null ? 'UNKNOWN' : `${Math.round(signal.value)}/100`}</em></div><small>{signal.value === null ? (zh ? '当前样本没有可用代理' : 'No usable proxy in this sample') : note}</small><i>{zh ? evidenceSignalLabels[signal.source].zh : evidenceSignalLabels[signal.source].en}</i></article>)}
      <article className="unknown"><div><span>{zh ? 'RPM / 收益潜力' : 'RPM / revenue potential'}</span><em>UNKNOWN</em></div><small>{zh ? '公开视频不包含频道收益、RPM、CPM 或留存。' : 'Public videos do not expose revenue, RPM, CPM or retention.'}</small><i>{zh ? '需要创作者 Studio 或一方数据' : 'Requires Creator Studio or first-party data'}</i></article>
    </div>
    {layer.riskFlags.length ? <div className="longform-risk-strip"><b>{zh ? '进入前风险' : 'Before entering'}</b>{layer.riskFlags.map(flag => <span key={flag}>{zh ? riskFlagLabels[flag].zh : riskFlagLabels[flag].en}</span>)}</div> : <div className="longform-risk-strip clear"><b>{zh ? '进入前风险' : 'Before entering'}</b><span>{zh ? '当前样本没有触发稀疏证据警报，但仍需先做小规模验证。' : 'No sparse-evidence alert fired, but validate with a small test first.'}</span></div>}
  </section>;
}

function DecisionSummary({ opportunity, locale }: { opportunity: LongformOpportunity | null; locale: UiLocale }) {
  const zh = locale === 'zh';
  const recommendation = recommendationFor(opportunity, locale);
  if (!opportunity) return <section className="longform-decision-summary insufficient"><div className="longform-decision-summary-head"><div><span className="longform-kicker">DECISION SUMMARY</span><h2>{zh ? '先确认数据，再决定是否进入。' : 'Confirm the evidence before deciding whether to enter.'}</h2></div><span className="longform-recommendation insufficient">{recommendation.label}</span></div><p className="longform-summary-empty">{zh ? '当前筛选没有可用于决策的长视频方向；不会用演示数据填充结论。' : 'There is no long-form direction in the current filter; this decision stays empty rather than using demo data.'}</p></section>;
  const growth = opportunity.metrics?.growth ?? null;
  const supplyProxy = opportunity.metrics?.lowCompetition ?? null;
  const diversity = opportunity.metrics?.creatorDiversity ?? null;
  const why = opportunity.sampleSize && opportunity.channelCount
    ? (zh ? `当前方向由 ${opportunity.sampleSize} 条视频、${opportunity.channelCount} 个频道支持，${recommendation.key === 'build' ? '市场机会与执行适配都达到建设门槛。' : recommendation.key === 'avoid' ? '市场机会或竞争条件不足，不建议直接投入。' : '证据仍适合先做小规模验证。'}` : `${opportunity.sampleSize} videos across ${opportunity.channelCount} channels support this direction; ${recommendation.key === 'build' ? 'market and execution both clear the build bar.' : recommendation.key === 'avoid' ? 'market or competition conditions are not strong enough for direct investment.' : 'evidence still calls for a small validation test.'}`)
    : (zh ? '样本或频道覆盖不足，暂不把分数解释为确定性机会。' : 'Sample or channel coverage is incomplete, so the score is not treated as a certain opportunity.');
  return <section className={`longform-decision-summary ${recommendation.key}`}><div className="longform-decision-summary-head"><div><span className="longform-kicker">DECISION SUMMARY · {zh ? '当前研究方向' : 'CURRENT RESEARCH SUBJECT'}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2><p>{opportunity.topic} · {zh ? '由左侧方向索引选择，可随时切换' : 'selected from the direction index and switchable at any time'}</p></div><span className={`longform-recommendation ${recommendation.key}`}>{recommendation.label}</span></div><div className="longform-decision-summary-grid"><div className="longform-summary-verdict"><small>{zh ? '为什么现在判断' : 'WHY THIS DECISION'}</small><b>{why}</b><span>{zh ? `置信度 ${opportunity.confidence} · ${opportunity.sampleSize} 条样本 · ${opportunity.channelCount} 个频道` : `${opportunity.confidence} confidence · ${opportunity.sampleSize} samples · ${opportunity.channelCount} channels`}</span></div><div className="longform-summary-score"><small>{zh ? '市场机会' : 'MARKET OPPORTUNITY'}</small><strong>{score(opportunity.marketOpportunity)}</strong><span>{zh ? '需求、供给空位与多样性' : 'Demand, supply gap and diversity'}</span></div><div className="longform-summary-score execution"><small>{zh ? '执行适配' : 'EXECUTION FIT'}</small><strong>{score(opportunity.executionFit)}</strong><span>{zh ? '可复用制作结构' : 'Repeatable production fit'}</span></div></div><div className="longform-demand-supply"><div><small>{zh ? '需求趋势代理' : 'DEMAND TREND PROXY'}</small><b>{summaryMetric(growth, locale)}<em>{growth === null ? '' : '/100'}</em></b><span>{growth === null ? (zh ? '公开增长代理不可用' : 'Public growth proxy unavailable') : (zh ? '由近期增长与样本推断' : 'Derived from recent growth and samples')}</span></div><div><small>{zh ? '供给空位代理' : 'SUPPLY GAP PROXY'}</small><b>{summaryMetric(supplyProxy, locale)}<em>{supplyProxy === null ? '' : '/100'}</em></b><span>{supplyProxy === null ? (zh ? '竞争代理不可用' : 'Competition proxy unavailable') : (zh ? '分数越高表示相对更开放' : 'Higher means relatively more open')}</span></div><div><small>{zh ? '创作者多样性' : 'CREATOR DIVERSITY'}</small><b>{summaryMetric(diversity, locale)}<em>{diversity === null ? '' : '/100'}</em></b><span>{diversity === null ? (zh ? '频道覆盖不足' : 'Channel coverage unavailable') : (zh ? '跨频道确认程度' : 'Cross-channel confirmation')}</span></div></div></section>;
}

function DataBoundary({ data, locale }: { data: LongformResponse; locale: UiLocale }) {
  const zh = locale === 'zh';
  const fields = data.availabilityAudit.fields;
  const unavailable = Object.entries(fields).filter(([, field]) => !field.available);
  if (!unavailable.length) return null;
  const labels: Record<string, { zh: string; en: string; actionZh: string; actionEn: string }> = {
    growth: { zh: '增长趋势', en: 'Growth trend', actionZh: '等待更多历史快照', actionEn: 'Wait for more history' },
    transcripts: { zh: '字幕 / 转录', en: 'Transcripts', actionZh: '不用于当前判断', actionEn: 'Excluded from this decision' },
    retention: { zh: '留存', en: 'Retention', actionZh: '公开视频不可用', actionEn: 'Not public on YouTube' },
    revenue: { zh: 'RPM / 收益', en: 'RPM / revenue', actionZh: '收益潜力 = 未知', actionEn: 'Revenue potential = unknown' },
    ctr: { zh: '缩略图点击率', en: 'Thumbnail CTR', actionZh: '不用于当前判断', actionEn: 'Excluded from this decision' },
  };
  return <section className="longform-data-boundary" aria-label={zh ? '数据缺口与可信边界' : 'Data gaps and confidence boundaries'}><div className="longform-data-boundary-head"><div><span className="longform-kicker">DATA GAP · NO FALSE PRECISION</span><b>{zh ? '这些问题当前没有公开数据支持。' : 'These questions are not answered by public data yet.'}</b><small>{zh ? '缺失字段不会被 LLM 或默认值补齐；它们不会污染市场机会与执行适配。' : 'Missing fields are not filled by an LLM or default values, and do not contaminate market opportunity or execution fit.'}</small></div><strong>{data.availabilityAudit.coverage}%<small>{zh ? '字段可用率' : 'field coverage'}</small></strong></div><div className="longform-data-gap-grid">{unavailable.map(([key, field]) => { const label = labels[key] || { zh: key, en: key, actionZh: '暂不可用', actionEn: 'Unavailable' }; return <article key={key}><span>{zh ? label.zh : label.en}</span><b>{zh ? 'UNKNOWN' : 'UNKNOWN'}</b><small>{zh ? label.actionZh : label.actionEn}</small><em>{field.provenance}</em></article>; })}</div></section>;
}

function OpportunityCard({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const representativeCount = opportunity.representativeVideos.length;
  const decision = recommendationFor(opportunity, locale);
  return <article className={`longform-opportunity ${decision.key}`}>
    <div className="longform-opportunity-head"><div><span className="longform-kicker">{opportunity.topic}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2></div><div className="longform-head-badges"><span className={`longform-decision ${decision.key}`}>{decision.label}</span><span className={`longform-confidence ${opportunity.confidenceLabel.toLowerCase()}`}>{zh ? `置信度 ${opportunity.confidence}` : `${opportunity.confidence} confidence`}</span></div></div>
    <div className="longform-stats"><span><b>{opportunity.sampleSize}</b>{zh ? '条视频' : ' videos'}</span><span><b>{opportunity.channelCount}</b>{zh ? '个频道' : ' channels'}</span><span><b>{formatNumber(opportunity.medianViews, locale)}</b>{zh ? '中位播放' : ' median views'}</span></div>
    <div className="longform-score-grid" id="research-demand"><Score label={zh ? '市场机会' : 'Market'} value={opportunity.marketOpportunity} tone="coral" hint={zh ? '需求强度与供给空位' : 'Demand and supply gap'}/><Score label={zh ? '执行适配' : 'Execution'} value={opportunity.executionFit} hint={zh ? '结构是否容易复用' : 'Repeatable production fit'}/><Score label={zh ? '进入分' : 'Entry'} value={opportunity.entryScore} tone="ink" hint={zh ? '综合验证优先级' : 'Combined validation priority'}/></div>
    <LongformEvidenceLayer opportunity={opportunity} locale={locale}/>
    <div className="longform-lanes" id="research-pattern">{opportunity.lanes.map(lane => <span key={lane}>{laneLabels[lane]?.[zh ? 'zh' : 'en'] || lane.replace('_', ' ')}</span>)}</div>
    <div className="longform-evidence" id="research-competition"><div><b>{zh ? '可验证证据' : 'Evidence'}</b><small>{zh ? '基于 YouTube 公开元数据与采集快照' : 'YouTube public metadata and saved snapshots'}</small></div><span>{zh ? '样本' : 'Sample'} {opportunity.sampleSize} · {zh ? '频道' : 'Creators'} {opportunity.channelCount}</span></div>
    <details className="longform-representatives" id="research-evidence"><summary>{representativeCount ? (zh ? `查看 ${representativeCount} 条代表视频` : `View ${representativeCount} representative videos`) : (zh ? '暂无代表视频' : 'No representative videos yet')}</summary>{representativeCount ? opportunity.representativeVideos.map((video, index) => <RepresentativeVideoRow key={video.videoId} video={video} locale={locale} priority={index < 2}/>) : <p className="longform-representatives-empty">{zh ? '当前样本还没有可展开的公开视频。' : 'No public videos are available for this sample yet.'}</p>}</details>
  </article>;
}

export default function LongformOpportunities({ locale, embedded = false }: { locale: UiLocale; embedded?: boolean }) {
  const zh = locale === 'zh';
  const [window, setWindow] = useState('28d');
  const [market, setMarket] = useState('all');
  const [lane, setLane] = useState('ALL');
  const [data, setData] = useState<LongformResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [researchContext, setResearchContext] = useState<{ opportunityId: string; topic: string; format: string; signalType: string; window: string; confidence: string; videoIds: string[]; channelIds: string[]; reason: string } | null>(null);
  const [selectedOpportunityKey, setSelectedOpportunityKey] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const load = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const sequence = ++requestSequence.current;
    setLoading(true); setError(null);
    try {
      const nextData = await fetchLongformOpportunities({ market, window, limit: 500, locale }, { signal: controller.signal });
      if (sequence === requestSequence.current) setData(nextData);
    } catch (reason) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setError(clientErrorMessage(reason, zh ? '数据暂时不可用。' : 'Data is temporarily unavailable.'));
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [market, window, locale, zh]);
  useEffect(() => { const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    const syncContext = () => {
      const params = new URLSearchParams(globalThis.window.location.search);
      const opportunityId = params.get('opportunityId');
      if (!opportunityId) { setResearchContext(null); return; }
      setResearchContext({ opportunityId, topic: params.get('topic') || '', format: params.get('format') || '', signalType: params.get('signalType') || '', window: params.get('window') || '', confidence: params.get('confidence') || '', videoIds: (params.get('videoIds') || '').split(',').filter(Boolean), channelIds: (params.get('channelIds') || '').split(',').filter(Boolean), reason: params.get('reason') || '' });
    };
    syncContext();
    globalThis.window.addEventListener('popstate', syncContext);
    globalThis.window.addEventListener('signalcraft:navigate', syncContext);
    return () => { globalThis.window.removeEventListener('popstate', syncContext); globalThis.window.removeEventListener('signalcraft:navigate', syncContext); };
  }, []);
  const laneOptions = useMemo(() => [{ key: 'ALL', label: zh ? '全部机会' : 'All opportunities' }, { key: 'BREAKOUT', label: zh ? '爆发信号' : 'Breakout' }, { key: 'UNDERSERVED', label: zh ? '低粉机会' : 'Underserved' }, { key: 'EVERGREEN', label: zh ? '长期需求' : 'Evergreen' }, { key: 'FORMAT_GAP', label: zh ? '形态空位' : 'Format gaps' }], [zh]);
  const opportunities = (data?.opportunities || []).filter(item => lane === 'ALL' || item.lanes.includes(lane));
  const leadOpportunity = opportunities[0] || null;
  const firstOpportunityKey = opportunities[0]?.key || null;
  const opportunityKeysSignature = opportunities.map(item => item.key).join('|');
  useEffect(() => {
    if (!firstOpportunityKey) { setSelectedOpportunityKey(null); return; }
    if (!selectedOpportunityKey || !opportunities.some(item => item.key === selectedOpportunityKey)) setSelectedOpportunityKey(firstOpportunityKey);
  }, [firstOpportunityKey, opportunityKeysSignature, selectedOpportunityKey, lane]);
  const selectedOpportunity = opportunities.find(item => item.key === selectedOpportunityKey) || leadOpportunity;
  const heroWindow = windowLabels[window] || windowLabels['28d'];
  const Container = embedded ? 'section' : 'main';
  return <Container className="longform-page">
    <section className="longform-hero"><div><span className="longform-kicker">LONG-FORM DISCOVERY ENGINE</span><h1>{zh ? '找到值得长期制作的长视频方向。' : 'Find long-form directions worth making.'}</h1><p>{zh ? '市场机会与执行适配分开计算。每个结论都回到公开样本、采集时间和置信度，不把不可见的 CTR、留存或收益伪装成事实。' : 'Market opportunity and execution fit stay separate. Every conclusion points back to public samples, capture time, and confidence.'}</p></div><div className="longform-hero-mark"><span>{heroWindow.value}</span><small>{zh ? heroWindow.zh : heroWindow.en}</small><i /></div></section>
    {researchContext && <section className="longform-research-context" aria-label={zh ? '机会雷达研究上下文' : 'Opportunity Radar research context'}><div><span className="longform-kicker">RADAR → RESEARCH</span><b>{zh ? '已带入机会雷达证据上下文' : 'Opportunity Radar evidence context loaded'}</b><small>{researchContext.topic || (zh ? '未命名主题' : 'Untitled topic')} · {researchContext.format || (zh ? '未识别形态' : 'Format unavailable')} · {researchContext.signalType || '—'}</small>{researchContext.reason ? <small>{researchContext.reason}</small> : null}</div><div><span>{zh ? '事件 ID' : 'Event ID'} <b>{researchContext.opportunityId}</b></span><span>{zh ? '窗口' : 'Window'} <b>{researchContext.window || '—'}</b></span><span>{zh ? '置信度' : 'Confidence'} <b>{researchContext.confidence || '—'}</b></span><span>{zh ? '证据' : 'Proof'} <b>{researchContext.videoIds.length}V · {researchContext.channelIds.length}C</b></span></div></section>}
    <section className="longform-toolbar"><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => setMarket(event.target.value)}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => setWindow(event.target.value)}><option value="7d">{zh ? '近 7 天' : '7 days'}</option><option value="28d">{zh ? '近 28 天' : '28 days'}</option><option value="90d">{zh ? '近 90 天' : '90 days'}</option><option value="365d">{zh ? '近 1 年' : '1 year'}</option></select></label><button type="button" className="longform-refresh" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '更新中…' : 'Refreshing…') : (zh ? '更新数据' : 'Refresh')}</button></section>
    {data && <section className="longform-scope"><div className="longform-scope-copy"><span className="longform-kicker">DATA SCOPE</span><b>{zh ? '这次判断基于哪一批公开样本？' : 'Which public sample powers this view?'}</b><small>{data.dataScope.source === 'longform_video_features' ? (zh ? '独立长视频候选池 · 不与 Shorts 共用排名样本' : 'Independent long-form pool · isolated from Shorts ranking samples') : (zh ? '兼容读取现有公开信号池 · 独立采集尚未启用' : 'Compatibility read from the existing public signal pool · independent collector not enabled')}</small><small>{data.dataScope.latestCapturedAt ? `${zh ? '最近采集' : 'Latest capture'} ${new Date(data.dataScope.latestCapturedAt).toLocaleString()}` : (zh ? '尚无采集时间' : 'No capture timestamp')}</small>{data.dataScope.marketSampleLimit ? <small>{zh ? `按市场分层取样：每个市场最多 ${data.dataScope.marketSampleLimit} 条` : `Market-stratified pool: up to ${data.dataScope.marketSampleLimit} rows per market`}</small> : null}{data.dataScope.failedMarkets?.length ? <small className="longform-partial-warning">{zh ? `部分市场读取失败：${data.dataScope.failedMarkets.join('、')}` : `Partial market read failure: ${data.dataScope.failedMarkets.join(', ')}`}</small> : null}</div><div className="longform-scope-facts"><span><small>{zh ? '长视频候选' : 'Long-form pool'}</small><b>{data.dataScope.longformRows}</b></span><span><small>{zh ? '已采集样本' : 'Collected rows'}</small><b>{data.dataScope.collectedRows}</b></span><span><small>{zh ? '覆盖市场' : 'Markets'}</small><b>{data.dataScope.markets.length || '—'}</b></span></div><div className="longform-coverage"><b>{data.availabilityAudit.coverage}%</b><small>{zh ? '字段可用率' : 'field availability'}</small></div></section>}
    {data && <DataBoundary data={data} locale={locale} />}
    <DecisionSummary opportunity={selectedOpportunity} locale={locale} />
    <section className="longform-reading-guide" aria-label={zh ? '机会台读法' : 'How to read the opportunity desk'}><div className="longform-reading-guide-title"><span className="longform-kicker">HOW TO READ</span><b>{zh ? '三步判断，不把一个分数当结论' : 'Three checks before treating a score as a decision'}</b><small>{zh ? '分数用于排序，证据用于确认。' : 'Scores sort the list; evidence confirms the decision.'}</small></div><ol><li><b>01</b><span>{zh ? '先看市场机会' : 'Market first'}</span><small>{zh ? '需求与供给' : 'Demand and supply'}</small></li><li><b>02</b><span>{zh ? '再看执行适配' : 'Then execution'}</span><small>{zh ? '制作是否可复用' : 'Repeatable format'}</small></li><li><b>03</b><span>{zh ? '最后看代表证据' : 'Then evidence'}</span><small>{zh ? '样本、时间、置信度' : 'Sample, recency, confidence'}</small></li></ol></section>
    <nav className="longform-lane-tabs" aria-label={zh ? '机会类型' : 'Opportunity lanes'}>{laneOptions.map(item => <button type="button" key={item.key} className={lane === item.key ? 'active' : ''} onClick={() => setLane(item.key)}>{item.label}{item.key !== 'ALL' && data ? <small>{data.lanes[item.key] || 0}</small> : null}</button>)}<span className="longform-lane-note">{opportunities.length ? (zh ? `当前显示 ${opportunities.length} 个方向 · 按进入分排序，置信度辅助判断` : `${opportunities.length} directions · sorted by entry score, with confidence as a guide`) : (zh ? '当前筛选暂无方向' : 'No directions match this filter')}</span></nav>
    {error ? <div className="longform-state error"><b>{zh ? '暂时无法读取长视频数据' : 'Long-form data is unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="longform-state"><b>{zh ? '正在整理公开长视频样本…' : 'Preparing public long-form samples…'}</b></div> : opportunities.length ? <>
      <nav className="longform-research-navigation" aria-label={zh ? '赛道研究导航' : 'Niche research navigation'}>
        <span className="longform-kicker">RESEARCH WORKSPACE</span>
        <a href="#research-decision">01 {zh ? '决策' : 'Decision'}</a>
        <a href="#research-demand">02 {zh ? '需求 / 供给' : 'Demand / supply'}</a>
        <a href="#research-pattern">03 {zh ? '内容模式' : 'Content pattern'}</a>
        <a href="#research-competition">04 {zh ? '竞争 / 小频道' : 'Competition / creators'}</a>
        <a href="#research-evidence">05 {zh ? '视频证据' : 'Video evidence'}</a>
      </nav>
      <section className="longform-research-workspace">
        <aside className="longform-direction-index" aria-label={zh ? '选择研究赛道' : 'Choose a niche to research'}>
          <div><span className="longform-kicker">DIRECTIONS</span><b>{zh ? '选择一个赛道深入研究' : 'Choose one direction to research'}</b><small>{zh ? '研究页只展开一个方向，避免把决策信息变成机会列表。' : 'Research stays focused on one direction instead of becoming another opportunity feed.'}</small></div>
          <div className="longform-direction-list">{opportunities.map((item, index) => { const selected = item.key === selectedOpportunity?.key; const recommendation = recommendationFor(item, locale); return <button type="button" key={item.key} className={selected ? 'active' : ''} onClick={() => setSelectedOpportunityKey(item.key)} aria-current={selected ? 'true' : undefined}><span><b>{String(index + 1).padStart(2, '0')}</b><strong>{item.mechanism} · {item.productionType}</strong><small>{item.topic}</small></span><em className={recommendation.key}>{recommendation.label}</em></button>; })}</div>
        </aside>
        <div className="longform-research-main" id="research-decision"><div className="longform-workspace-heading"><span className="longform-kicker">SINGLE-NICHE DECISION</span><b>{zh ? '当前研究对象' : 'Current research subject'}</b><small>{selectedOpportunity ? `${selectedOpportunity.topic} · ${selectedOpportunity.mechanism}` : (zh ? '尚未选择赛道' : 'No direction selected')}</small></div>{selectedOpportunity ? <OpportunityCard opportunity={selectedOpportunity} locale={locale}/> : <div className="longform-state"><b>{zh ? '当前没有可研究的方向' : 'No direction to research'}</b></div>}</div>
      </section>
    </> : <div className="longform-state"><b>{zh ? '当前窗口还没有足够的长视频样本' : 'Not enough long-form samples for this window'}</b><p>{zh ? '这不是演示数据。请扩大市场或时间窗口，等采集任务积累可比较的快照。' : 'This is not demo data. Expand the market or window and wait for comparable snapshots.'}</p></div>}
    <section className="longform-boundary"><div><span className="longform-kicker">READ THE SIGNAL</span><h2>{zh ? '哪些数据目前不能回答？' : 'What can this data not answer yet?'}</h2></div><div>{(data?.gaps || [zh ? '字幕、CTR、留存、RPM/CPM 和收入不属于公开字段。' : 'Transcripts, CTR, retention, RPM/CPM and revenue are not public fields.']).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
  </Container>;
}

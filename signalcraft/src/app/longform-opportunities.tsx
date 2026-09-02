'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchLongformOpportunities, type LongformOpportunity, type LongformResponse } from '@/src/lib/longform';
import { buildLongformEvidenceLayer, type LongformEvidenceSignal, type LongformRiskFlag } from '@/src/lib/longform-intelligence';
import { calculateLongformIncomeScenario } from '@/src/lib/longform-planner';
import { buildLongformValidationPlan } from '@/src/lib/longform-validation';
import { buildRpmPublicContext, getRpmBenchmarkForTopic, type RpmBenchmarkResult, type RpmPublicContext } from '@/src/lib/rpm-benchmarks';
import { clientErrorMessage } from '@/src/lib/client-error';
import type { UiLocale } from '@/src/lib/ui-language';
import { buildTrendRadarHref, contextFromQuery, saveNicheAnalysisContext, type NicheAnalysisContext } from '@/src/lib/niche-analysis-context';
import { readResearchUrlState, writeResearchUrlState } from '@/src/lib/research-url-state';
import type { StrategyPatternRole } from '@/src/lib/content-strategy';
import type { CreativeBriefIntelligenceReport, CreativeBriefReadiness, IdeaValidationState } from '@/src/lib/creative-brief-intelligence';
import type { CreativeDevelopmentIntelligenceReport, CreativeDevelopmentReadiness } from '@/src/lib/creative-development';

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

function Score({ label, value, tone = 'teal', hint, displayValue }: { label: string; value: number | null; tone?: 'teal' | 'coral' | 'ink'; hint: string; displayValue?: string }) {
  const shown = displayValue || score(value);
  return <div className={`longform-score ${tone}`} title={`${label}：${hint}`} aria-label={`${label} ${shown}${displayValue ? '' : ' / 100'}，${hint}`}><span>{label}</span><b>{shown}</b>{displayValue ? null : <small>/100</small>}<em>{hint}</em></div>;
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
  if (opportunity.opportunityAssessment) {
    const labels: Record<NonNullable<LongformOpportunity['opportunityAssessment']>['decision']['status'], { key: string; zh: string; en: string }> = {
      INSUFFICIENT: { key: 'insufficient', zh: '数据不足', en: 'INSUFFICIENT' },
      CAUTION: { key: 'watch', zh: '谨慎', en: 'CAUTION' },
      TEST: { key: 'test', zh: '值得测试', en: 'TEST' },
      RECOMMENDED: { key: 'build', zh: '推荐', en: 'RECOMMENDED' },
      AVOID: { key: 'avoid', zh: '暂不建议', en: 'AVOID' },
    };
    const canonical = labels[opportunity.opportunityAssessment.decision.status];
    return { key: canonical.key, label: locale === 'zh' ? canonical.zh : canonical.en };
  }
  if (opportunity.entryDecision) {
    const labels: Record<NonNullable<LongformOpportunity['entryDecision']>['status'], { key: string; zh: string; en: string }> = {
      INSUFFICIENT: { key: 'insufficient', zh: '数据不足', en: 'INSUFFICIENT' },
      CAUTION: { key: 'watch', zh: '谨慎', en: 'CAUTION' },
      TEST: { key: 'test', zh: '值得测试', en: 'TEST' },
      RECOMMENDED: { key: 'build', zh: '推荐', en: 'RECOMMENDED' },
      AVOID: { key: 'avoid', zh: '暂不建议', en: 'AVOID' },
    };
    const canonical = labels[opportunity.entryDecision.status];
    return { key: canonical.key, label: locale === 'zh' ? canonical.zh : canonical.en };
  }
  if (opportunity.recommendation) {
    const labels: Record<NonNullable<LongformOpportunity['recommendation']>, { key: string; zh: string; en: string }> = {
      BUILD: { key: 'build', zh: '推荐', en: 'RECOMMENDED' },
      TEST: { key: 'test', zh: '值得测试', en: 'TEST' },
      WATCH: { key: 'watch', zh: '谨慎', en: 'CAUTION' },
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

const evaluationWindows = new Set(['7d', '28d', '90d', '365d']);
const normalizeEvaluationWindow = (value: string | undefined) => value && evaluationWindows.has(value) ? value : '28d';
const evaluationWindowNote = (value: string | undefined) => value && !evaluationWindows.has(value) ? `28d (${value} radar)` : value || '28d';
const normalizedText = (value: string | null | undefined) => String(value || '').trim().toLocaleLowerCase();
const trendStateLabels: Record<string, { zh: string; en: string }> = {
  EMERGING: { zh: '早期机会', en: 'Emerging' },
  CONFIRMED: { zh: '持续增长', en: 'Sustained growth' },
  CROWDED: { zh: '竞争拥挤', en: 'Crowded' },
  SATURATING: { zh: '趋于饱和', en: 'Saturating' },
  DECLINING: { zh: '正在降温', en: 'Cooling' },
  SMALL_CREATOR_BREAKOUT: { zh: '小频道突破', en: 'Small-creator breakout' },
  EMERGING_TOPIC: { zh: '新兴主题', en: 'Emerging topic' },
  SUPPLY_GAP: { zh: '供给缺口', en: 'Supply gap' },
  FORMAT_MIGRATION: { zh: '格式迁移', en: 'Format migration' },
  SATURATION_WARNING: { zh: '饱和预警', en: 'Saturation warning' },
};
const trendStateLabel = (value: unknown, locale: UiLocale) => trendStateLabels[String(value || '')]?.[locale === 'zh' ? 'zh' : 'en'] || String(value || '—');

function routeNavigate(path: string) {
  if (typeof window === 'undefined') return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('signalcraft:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function LongformEvidenceLayer({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const layer = buildLongformEvidenceLayer(opportunity);
  const signals = [
    { key: 'demand', label: zh ? '需求趋势' : 'Demand trend', signal: layer.signals.demand, note: zh ? '只能作为公开增长代理' : 'Public growth proxy only' },
    { key: 'supply', label: zh ? '供给空位' : 'Supply gap', signal: layer.signals.supply, note: zh ? '不是完整的市场供给量' : 'Not total market supply' },
    { key: 'smallCreator', label: zh ? '小频道机会' : 'Small-creator access', signal: layer.signals.smallCreator, note: zh ? '用于判断是否只由大频道占据' : 'Checks whether large channels dominate' },
    { key: 'diversity', label: zh ? '创作者多样性' : 'Creator diversity', signal: layer.signals.diversity, note: zh ? '用于确认跨频道重复出现' : 'Cross-channel confirmation' },
  ];
  return <section className="longform-evidence-layer" aria-label={zh ? '长视频赛道评估证据层' : 'Long-form niche evaluation evidence layer'}>
    <div className="longform-evidence-layer-head"><div><span className="longform-kicker">P1 · EVIDENCE LAYER</span><b>{zh ? '供需、竞争与收益边界' : 'Demand, competition and revenue boundaries'}</b><small>{zh ? '代理指标用于解释排序，不等于完整业务事实。' : 'Proxy metrics explain ranking; they are not complete business facts.'}</small></div><span>{zh ? '只读真实字段' : 'Observed fields only'}</span></div>
    <div className="longform-evidence-layer-grid">
      {signals.map(({ key, label, signal, note }) => <article key={key}><div><span>{label}</span><em>{signal.value === null ? 'UNKNOWN' : `${Math.round(signal.value)}/100`}</em></div><small>{signal.value === null ? (zh ? '当前样本没有可用代理' : 'No usable proxy in this sample') : note}</small><i>{zh ? evidenceSignalLabels[signal.source].zh : evidenceSignalLabels[signal.source].en}</i></article>)}
      <article className="unknown"><div><span>{zh ? 'RPM / 收益潜力' : 'RPM / revenue potential'}</span><em>UNKNOWN</em></div><small>{zh ? '公开视频不包含频道收益、RPM、CPM 或留存。' : 'Public videos do not expose revenue, RPM, CPM or retention.'}</small><i>{zh ? '需要创作者 Studio 或一方数据' : 'Requires Creator Studio or first-party data'}</i></article>
    </div>
    {layer.riskFlags.length ? <div className="longform-risk-strip"><b>{zh ? '进入前风险' : 'Before entering'}</b>{layer.riskFlags.map(flag => <span key={flag}>{zh ? riskFlagLabels[flag].zh : riskFlagLabels[flag].en}</span>)}</div> : <div className="longform-risk-strip clear"><b>{zh ? '进入前风险' : 'Before entering'}</b><span>{zh ? '当前样本没有触发稀疏证据警报，但仍需先做小规模验证。' : 'No sparse-evidence alert fired, but validate with a small test first.'}</span></div>}
  </section>;
}

function plannerNumber(value: number | null, locale: UiLocale) {
  if (value === null || !Number.isFinite(value)) return locale === 'zh' ? 'UNKNOWN' : 'UNKNOWN';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function rpmLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `$${Number.isInteger(value) ? value : value.toFixed(1)}`;
}

function percentLabel(value: number | null) {
  return value === null || !Number.isFinite(value) ? 'UNKNOWN' : `${Math.round(value * 100)}%`;
}

function RpmBenchmarkPanel({ benchmark, context, locale, mode, onModeChange }: { benchmark: RpmBenchmarkResult; context: RpmPublicContext; locale: UiLocale; mode: 'market' | 'manual'; onModeChange: (mode: 'market' | 'manual') => void }) {
  const zh = locale === 'zh';
  const hasBenchmark = benchmark.status === 'BENCHMARK' && benchmark.lowUsd !== null && benchmark.highUsd !== null;
  return <div className="longform-rpm-benchmark" aria-label={zh ? '市场工具 RPM 基准' : 'Market-tool RPM benchmark'}>
    <div className="longform-rpm-benchmark-head"><div><span className="longform-kicker">MARKET BENCHMARK · RPM</span><b>{zh ? '市场工具区间预估' : 'Market-tool range estimate'}</b><small>{zh ? '这是规划基准，不是频道真实收益；真实 RPM 以 YouTube Studio 为准。' : 'Planning benchmark, not channel revenue; YouTube Studio remains the source of truth.'}</small></div><span className={`longform-rpm-confidence ${benchmark.confidence.toLowerCase()}`}>{hasBenchmark ? `${benchmark.confidence} ${zh ? '置信度' : 'confidence'}` : 'UNKNOWN'}</span></div>
    {hasBenchmark ? <>
      <div className="longform-rpm-benchmark-summary"><strong>{rpmLabel(benchmark.lowUsd)} – {rpmLabel(benchmark.highUsd)}</strong><span>{zh ? `合并中位 ${rpmLabel(benchmark.midpointUsd)} / 1,000 播放` : `Combined midpoint ${rpmLabel(benchmark.midpointUsd)} / 1,000 views`}</span><small>{zh ? `${benchmark.sourceCount} 个公开工具来源；区间取来源外包络，中心值取中位数。快照 ${benchmark.rows[0]?.capturedAt || '未知'}` : `${benchmark.sourceCount} public tool sources; envelope of ranges with median midpoint. Snapshot ${benchmark.rows[0]?.capturedAt || 'unknown'}`}</small></div>
      <div className="longform-rpm-source-grid">{benchmark.rows.map(row => <article key={row.sourceId}><div><b>{row.sourceName}</b><span>{rpmLabel(row.lowUsd)} – {rpmLabel(row.highUsd)}</span></div><small>{row.note}</small><a href={row.sourceUrl} target="_blank" rel="noreferrer">{zh ? '查看来源 ↗' : 'View source ↗'}</a></article>)}</div>
      <div className="longform-rpm-mode" role="group" aria-label={zh ? 'RPM 规划来源' : 'RPM planning source'}><button type="button" className={mode === 'market' ? 'active' : ''} aria-pressed={mode === 'market'} onClick={() => onModeChange('market')}>{zh ? '使用市场基准' : 'Use market benchmark'}</button><button type="button" className={mode === 'manual' ? 'active' : ''} aria-pressed={mode === 'manual'} onClick={() => onModeChange('manual')}>{zh ? '改用自定义 RPM' : 'Use custom RPM'}</button></div>
    </> : <div className="longform-rpm-empty"><b>{zh ? '该方向暂无可匹配的公开区间' : 'No public range matches this direction yet'}</b><small>{zh ? '可在下方直接填写 Studio / 自定义 RPM；系统不会拿其他赛道强行补齐。' : 'Enter a Studio / custom RPM below; the system will not force a range from another niche.'}</small></div>}
    <div className="longform-rpm-context-grid">
      <article><span>{zh ? '赛道匹配' : 'Niche match'}</span><b>{benchmark.matchedNiche || 'UNKNOWN'}</b><small>{zh ? '只按公开基准中可识别的赛道映射' : 'Mapped only to a recognizable public benchmark niche'}</small></article>
      <article><span>{zh ? '来源共识' : 'Source consensus'}</span><b>{benchmark.overlapLowUsd !== null ? `${rpmLabel(benchmark.overlapLowUsd)} – ${rpmLabel(benchmark.overlapHighUsd)}` : 'UNKNOWN'}</b><small>{benchmark.spreadPct === null ? (zh ? '不足两个数值来源' : 'Fewer than two numeric sources') : (zh ? `来源中点分歧 ${percentLabel(benchmark.spreadPct)}` : `Source-midpoint spread ${percentLabel(benchmark.spreadPct)}`)}</small></article>
      <article><span>{zh ? '8 分钟以上覆盖' : '8+ minute coverage'}</span><b>{context.durationKnownCount ? `${context.midrollEligibleCount}/${context.durationKnownCount}` : 'UNKNOWN'}</b><small>{context.midrollEligibleShare === null ? (zh ? '没有可用时长' : 'No usable duration') : (zh ? `${percentLabel(context.midrollEligibleShare)} 样本具备中贴片资格代理；不代表广告填充` : `${percentLabel(context.midrollEligibleShare)} of samples meet a mid-roll eligibility proxy; not ad fill`)}</small></article>
      <article><span>{zh ? '采集市场' : 'Collection markets'}</span><b>{context.sourceMarkets.length ? context.sourceMarkets.join(' · ') : 'UNKNOWN'}</b><small>{context.videoCount ? (zh ? `${context.marketKnownCount}/${context.videoCount} 条带市场标签；不是观众国家，不调整 RPM` : `${context.marketKnownCount}/${context.videoCount} carry a market label; not viewer geography or an RPM adjustment`) : (zh ? '没有代表视频' : 'No representative videos')}</small></article>
    </div>
    <div className="longform-rpm-references">{zh ? '校准参考：' : 'Calibration references: '}<a href="https://support.google.com/youtube/answer/9314357?hl=en-6" target="_blank" rel="noreferrer">{zh ? 'YouTube RPM 定义' : 'YouTube RPM definition'}</a><span>·</span><a href="https://www.tubebuddy.com/youtube-monetization-calculator/" target="_blank" rel="noreferrer">{zh ? 'TubeBuddy 分类计算器' : 'TubeBuddy category calculator'}</a><span>·</span><a href="https://www.tubeanalytics.net/blog/youtube-rpm-benchmarks-by-niche" target="_blank" rel="noreferrer">{zh ? 'TubeAnalytics Studio 校准说明' : 'TubeAnalytics Studio calibration'}</a></div>
  </div>;
}

function LongformPlanningPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const [targetUsd, setTargetUsd] = useState(1000);
  const [rpmLowInput, setRpmLowInput] = useState('');
  const [rpmHighInput, setRpmHighInput] = useState('');
  const [rpmMode, setRpmMode] = useState<'market' | 'manual'>('market');
  const [videosPerMonth, setVideosPerMonth] = useState(4);
  const benchmark = useMemo(() => getRpmBenchmarkForTopic(opportunity.topic), [opportunity.topic]);
  const publicContext = useMemo(() => buildRpmPublicContext(opportunity.representativeVideos), [opportunity.representativeVideos]);
  const useMarketBenchmark = rpmMode === 'market' && benchmark.status === 'BENCHMARK';
  const effectiveRpmLow = useMarketBenchmark ? benchmark.lowUsd : rpmLowInput ? Number(rpmLowInput) : null;
  const effectiveRpmHigh = useMarketBenchmark ? benchmark.highUsd : rpmHighInput ? Number(rpmHighInput) : null;
  const scenario = calculateLongformIncomeScenario({ targetUsd, rpmLowUsd: effectiveRpmLow, rpmHighUsd: effectiveRpmHigh, videosPerMonth, baselineViewsPerVideo: opportunity.medianViews });
  const monthlyViews = scenario.monthlyViewsLow === null ? 'UNKNOWN' : `${plannerNumber(scenario.monthlyViewsLow, locale)} – ${plannerNumber(scenario.monthlyViewsHigh, locale)}`;
  const viewsPerVideo = scenario.viewsPerVideoLow === null ? 'UNKNOWN' : `${plannerNumber(scenario.viewsPerVideoLow, locale)} – ${plannerNumber(scenario.viewsPerVideoHigh, locale)}`;
  const baselineVideos = scenario.baselineVideosLow === null ? 'UNKNOWN' : `${plannerNumber(scenario.baselineVideosLow, locale)} – ${plannerNumber(scenario.baselineVideosHigh, locale)}`;
  const baselineRevenue = scenario.baselineRevenueLowUsd === null ? 'UNKNOWN' : `${rpmLabel(scenario.baselineRevenueLowUsd)} – ${rpmLabel(scenario.baselineRevenueHighUsd)}`;
  return <section className="longform-planning-panel" aria-label={zh ? '长视频目标收益规划与 AI 生产边界' : 'Long-form income planner and AI production boundaries'}>
    <div className="longform-planning-head"><div><span className="longform-kicker">P2 · SCENARIO PLANNER</span><b>{zh ? '目标收益规划（仅作场景推演）' : 'Target income planner (scenario only)'}</b><small>{zh ? 'RPM 优先采用公开市场工具的区间基准，也可切换为你输入的 Studio / 自定义区间。' : 'RPM uses a public market-tool range by default, or your Studio / custom range after switching.'}</small></div><span>{zh ? '不写入账号' : 'Not saved to account'}</span></div>
    <RpmBenchmarkPanel benchmark={benchmark} context={publicContext} locale={locale} mode={rpmMode} onModeChange={setRpmMode}/>
    <div className="longform-planning-inputs">
      <label><span>{zh ? '月目标' : 'Monthly target'}</span><select value={targetUsd} onChange={event => setTargetUsd(Number(event.target.value))}>{[500, 1000, 3000, 5000, 10000].map(value => <option key={value} value={value}>${value.toLocaleString()} / mo</option>)}</select></label>
      <label><span>{zh ? 'RPM 下限假设' : 'RPM low assumption'}</span><input className={useMarketBenchmark ? 'is-derived' : ''} type="number" min="0" step="0.5" inputMode="decimal" placeholder={zh ? '例如 4' : 'e.g. 4'} value={rpmLowInput} onChange={event => setRpmLowInput(event.target.value)} disabled={useMarketBenchmark}/><small>{useMarketBenchmark ? (zh ? `市场基准 ${rpmLabel(benchmark.lowUsd)}` : `Market ${rpmLabel(benchmark.lowUsd)}`) : (zh ? 'Studio 或自定义输入' : 'Studio or custom input')}</small></label>
      <label><span>{zh ? 'RPM 上限假设' : 'RPM high assumption'}</span><input className={useMarketBenchmark ? 'is-derived' : ''} type="number" min="0" step="0.5" inputMode="decimal" placeholder={zh ? '例如 8' : 'e.g. 8'} value={rpmHighInput} onChange={event => setRpmHighInput(event.target.value)} disabled={useMarketBenchmark}/><small>{useMarketBenchmark ? (zh ? `市场基准 ${rpmLabel(benchmark.highUsd)}` : `Market ${rpmLabel(benchmark.highUsd)}`) : (zh ? 'Studio 或自定义输入' : 'Studio or custom input')}</small></label>
      <label><span>{zh ? '每月计划视频' : 'Videos / month'}</span><input type="number" min="1" step="1" inputMode="numeric" value={videosPerMonth} onChange={event => setVideosPerMonth(Number(event.target.value))}/></label>
    </div>
    <div className="longform-planning-results">
      <article className={!scenario.isScenario ? 'unknown' : ''}><span>{zh ? '需要月播放' : 'Required monthly views'}</span><b>{monthlyViews}</b><small>{scenario.isScenario ? `${rpmLabel(scenario.rpmLowUsd)} – ${rpmLabel(scenario.rpmHighUsd)} RPM · ${useMarketBenchmark ? (zh ? '市场基准' : 'market benchmark') : (zh ? '用户假设' : 'user assumption')}` : (zh ? '填写 RPM 区间后计算' : 'Enter an RPM range to calculate')}</small></article>
      <article className={!scenario.isScenario ? 'unknown' : ''}><span>{zh ? '每条视频目标播放' : 'Views per video'}</span><b>{viewsPerVideo}</b><small>{zh ? '按月计划产量均摊，不代表成功率' : 'Distributed across planned output; not a success rate'}</small></article>
      <article className={scenario.baselineVideosLow === null ? 'unknown' : ''}><span>{zh ? '按样本中位播放需多少条' : 'Videos at sample median'}</span><b>{baselineVideos}</b><small>{opportunity.medianViews === null ? (zh ? '当前方向没有中位播放数据' : 'No median-view data for this direction') : (zh ? `以样本中位 ${formatNumber(opportunity.medianViews, locale)} 播放作参考` : `Using sample median of ${formatNumber(opportunity.medianViews, locale)} views`)}</small></article>
      <article className={scenario.baselineRevenueLowUsd === null ? 'unknown' : ''}><span>{zh ? '样本中位情景月收入' : 'Revenue at sample median'}</span><b>{baselineRevenue}</b><small>{scenario.baselineMonthlyViews === null ? (zh ? '缺少样本中位播放或计划产量' : 'Missing median views or planned output') : (zh ? `假设每条都达到样本中位，共 ${formatNumber(scenario.baselineMonthlyViews, locale)} 月播放` : `Assumes every video reaches the sample median: ${formatNumber(scenario.baselineMonthlyViews, locale)} monthly views`)}</small></article>
    </div>
    <div className="longform-production-boundary"><div className="longform-planning-head"><div><span className="longform-kicker">AI PRODUCTION</span><b>{zh ? '生产可行性边界' : 'Production feasibility boundary'}</b><small>{zh ? '当前接口没有重试率、延迟、质量或真实制作成本，以下结论保持未知。' : 'The current API has no retry, latency, quality or real production-cost evidence, so these stay unknown.'}</small></div></div><div className="longform-production-grid">{[zh ? 'AI 适配性' : 'AI suitability', zh ? 'AI 可规模化' : 'AI scalability', zh ? '制作成本' : 'Production cost', zh ? '返工 / 重试风险' : 'Rework / retry risk'].map(label => <article key={label}><span>{label}</span><b>UNKNOWN</b></article>)}</div><p>{zh ? `已知制作形式：${opportunity.productionType}；公开执行适配分：${score(opportunity.execution.score)}。这不等同于 AI 成本或规模化结论。` : `Observed production type: ${opportunity.productionType}; public execution-fit score: ${score(opportunity.execution.score)}. This is not an AI cost or scalability conclusion.`}</p></div>
  </section>;
}

function LongformValidationPlan({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const plan = buildLongformValidationPlan(opportunity);
  const reason = plan.reason === 'DO_NOT_ENTER' ? (zh ? '当前结论不支持直接进入，先保留观察。' : 'The current evidence does not support entering directly; keep watching.') : plan.reason === 'THIN_EVIDENCE' ? (zh ? '证据偏薄，先用更大的最小批次确认可重复性。' : 'Evidence is thin; use a larger bounded batch to confirm repeatability.') : (zh ? '证据已达到小规模验证门槛，但仍不能直接 BUILD。' : 'Evidence clears a small-test bar, but it is not a BUILD decision.');
  return <details className="longform-validation-plan"><summary><span className="longform-kicker">TEST → VALIDATE</span><b>{plan.recommendedVideos === null ? (zh ? '当前不创建测试批次' : 'No test batch yet') : (zh ? `建议先验证 ${plan.recommendedVideos} 条长视频` : `Start with ${plan.recommendedVideos} long-form videos`)}</b></summary><div className="longform-validation-body"><p>{reason}</p><div className="longform-validation-columns"><div><span>{zh ? '成功判据' : 'Success criteria'}</span><ul>{plan.successCriteria.map(item => <li key={item}>{item}</li>)}</ul></div><div><span>{zh ? '必须回收的指标' : 'Metrics to collect'}</span><ul>{plan.requiredMetrics.map(item => <li key={item}>{item}</li>)}</ul></div></div><div className="longform-validation-unknown"><b>{zh ? '测试结果：UNKNOWN' : 'Test result: UNKNOWN'}</b><small>{zh ? '完成批次并回填真实数据后，才判断 CONTINUE / BUILD / WATCH / AVOID。' : 'Only after the batch is completed and real data is returned can the system decide CONTINUE / BUILD / WATCH / AVOID.'}</small></div></div></details>;
}

function DecisionSummary({ opportunity, locale }: { opportunity: LongformOpportunity | null; locale: UiLocale }) {
  const zh = locale === 'zh';
  const recommendation = recommendationFor(opportunity, locale);
  if (!opportunity) return <section className="longform-decision-summary insufficient"><div className="longform-decision-summary-head"><div><span className="longform-kicker">DECISION SUMMARY</span><h2>{zh ? '先确认数据，再决定是否进入。' : 'Confirm the evidence before deciding whether to enter.'}</h2></div><span className="longform-recommendation insufficient">{recommendation.label}</span></div><p className="longform-summary-empty">{zh ? '当前筛选没有可用于决策的长视频方向；不会用演示数据填充结论。' : 'There is no long-form direction in the current filter; this decision stays empty rather than using demo data.'}</p></section>;
  const benchmark = getRpmBenchmarkForTopic(opportunity.topic);
  const rpm = benchmark.lowUsd !== null && benchmark.highUsd !== null ? `$${benchmark.lowUsd} – $${benchmark.highUsd}` : (zh ? '暂不估算' : 'Not estimated');
  const openness = opportunity.metrics?.lowCompetition ?? null;
  const competition = openness === null
    ? (zh ? '数据不足' : 'Data insufficient')
    : openness >= 70 ? (zh ? '较低' : 'Lower')
      : openness >= 45 ? (zh ? '中等' : 'Medium')
        : (zh ? '较高' : 'Higher');
  const beginner = opportunity.execution.score === null
    ? (zh ? '先小批验证' : 'Validate in a small batch')
    : opportunity.execution.score >= 60 ? (zh ? '可以先试' : 'Ready to test') : (zh ? '门槛偏高' : 'Higher bar');
  const why = opportunity.sampleSize && opportunity.channelCount
    ? (zh ? `当前方向由 ${opportunity.sampleSize} 条视频、${opportunity.channelCount} 个频道支持，${recommendation.key === 'build' ? '市场机会与执行适配都达到建设门槛。' : recommendation.key === 'avoid' ? '市场机会或竞争条件不足，不建议直接投入。' : '证据仍适合先做小规模验证。'}` : `${opportunity.sampleSize} videos across ${opportunity.channelCount} channels support this direction; ${recommendation.key === 'build' ? 'market and execution both clear the build bar.' : recommendation.key === 'avoid' ? 'market or competition conditions are not strong enough for direct investment.' : 'evidence still calls for a small validation test.'}`)
    : (zh ? '样本或频道覆盖不足，暂不把分数解释为确定性机会。' : 'Sample or channel coverage is incomplete, so the score is not treated as a certain opportunity.');
  return <section className={`longform-decision-summary ${recommendation.key}`}><div className="longform-decision-summary-head"><div><span className="longform-kicker">DECISION SUMMARY · {zh ? '当前研究方向' : 'CURRENT RESEARCH SUBJECT'}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2><p>{opportunity.topic} · {zh ? '由左侧方向索引选择，可随时切换' : 'selected from the direction index and switchable at any time'}</p></div><span className={`longform-recommendation ${recommendation.key}`}>{recommendation.label}</span></div><div className="longform-decision-summary-grid"><div className="longform-summary-verdict"><small>{zh ? '一句话建议' : 'ONE-SENTENCE ADVICE'}</small><b>{why}</b><span>{zh ? `置信度 ${opportunity.confidence} · ${opportunity.sampleSize} 条样本 · ${opportunity.channelCount} 个频道` : `${opportunity.confidence} confidence · ${opportunity.sampleSize} samples · ${opportunity.channelCount} channels`}</span></div><div className="longform-summary-score"><small>{zh ? '新人起点' : 'BEGINNER START'}</small><strong>{beginner}</strong><span>{zh ? '由公开制作结构代理判断' : 'From public production-fit proxy'}</span></div><div className="longform-summary-score execution"><small>{zh ? '竞争程度' : 'COMPETITION'}</small><strong>{competition}</strong><span>{openness === null ? (zh ? '公开代理不可用' : 'Public proxy unavailable') : (zh ? '由公开供给空位代理判断' : 'From public supply-gap proxy')}</span></div><div className="longform-summary-score revenue"><small>{zh ? '预估 RPM' : 'ESTIMATED RPM'}</small><strong>{rpm}</strong><span>{benchmark.lowUsd === null ? (zh ? '无可匹配公开基准' : 'No matching public benchmark') : (zh ? '公开市场参考，不是频道收入' : 'Public market reference, not channel income')}</span></div></div></section>;
}

function TrendRadarConnection({ context, opportunity, locale, onReturn, onOpenRadar }: { context: NicheAnalysisContext | null; opportunity: LongformOpportunity | null; locale: UiLocale; onReturn: () => void; onOpenRadar: (lane?: string) => void }) {
  const zh = locale === 'zh';
  const signals = context?.trendSignals && typeof context.trendSignals === 'object' ? context.trendSignals as Record<string, unknown> : null;
  const breakout = context?.breakoutSignals && typeof context.breakoutSignals === 'object' ? context.breakoutSignals as Record<string, unknown> : null;
  const smallCreator = context?.smallCreatorSignals && typeof context.smallCreatorSignals === 'object' ? context.smallCreatorSignals as Record<string, unknown> : null;
  if (!context && !opportunity) return null;
  return <section className="longform-trend-connection" aria-label={zh ? '趋势雷达联动' : 'Trend Radar connection'}>
    <div className="longform-trend-connection-copy"><span className="longform-kicker">{context ? 'TREND RADAR DISCOVERY' : 'CONTINUE EXPLORING'}</span><b>{context ? (zh ? '这条赛道为什么进入评估？' : 'Why this niche reached evaluation') : (zh ? '评估完成后继续寻找' : 'Keep exploring after evaluation')}</b><small>{context ? (zh ? '趋势信号只作为发现入口；赛道评估仍独立判断长期制作价值。' : 'Trend signals are a discovery input; evaluation independently judges durable making value.') : (zh ? '回到趋势雷达，可按当前方向定位相关趋势事件。' : 'Return to Trend Radar to locate related trend events for this direction.')}</small>{context && Array.isArray(signals?.facts) && signals.facts[0] ? <small className="longform-trend-why">{zh ? 'Why：' : 'Why: '}{String(signals.facts[0])}</small> : null}</div>
    {context ? <div className="longform-trend-connection-facts"><span><small>{zh ? '趋势状态' : 'Trend state'}</small><b>{trendStateLabel(signals?.lifecycle || signals?.eventType, locale)}</b></span><span><small>{zh ? '窗口' : 'Window'}</small><b>{evaluationWindowNote(context.timeWindow)}</b></span><span><small>{zh ? '小频道突破' : 'Small creator breakouts'}</small><b>{String(breakout?.count ?? smallCreator?.count ?? '—')}</b></span><span><small>{zh ? '置信度' : 'Confidence'}</small><b>{String(context.confidence || '—')}</b></span></div> : null}
    <div className="longform-trend-connection-actions">{context ? <button type="button" onClick={onReturn}>{zh ? '← 返回趋势雷达' : '← Back to Trend Radar'}</button> : null}<button type="button" className="primary" onClick={() => onOpenRadar()}>{zh ? '在趋势雷达中查看 →' : 'View in Trend Radar →'}</button><button type="button" onClick={() => onOpenRadar('SUPPLY_GAP')}>{zh ? '找更低竞争方向' : 'Find lower competition'}</button><button type="button" onClick={() => onOpenRadar('SMALL_CREATOR')}>{zh ? '找小频道突破' : 'Find creator breakouts'}</button></div>
  </section>;
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

function DecisionFirstBrief({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const recommendation = recommendationFor(opportunity, locale);
  const format = zh
    ? { primary: '长视频优先', secondary: 'Shorts 可作为验证入口，但不能据此推断长视频收益。' }
    : { primary: 'Long-form first', secondary: 'Shorts can validate an angle, but cannot establish long-form revenue.' };
  const benchmark = getRpmBenchmarkForTopic(opportunity.topic);
  const rpm = benchmark.lowUsd !== null && benchmark.highUsd !== null ? `$${benchmark.lowUsd} – $${benchmark.highUsd}` : (zh ? '暂不估算' : 'Not estimated');
  const openness = opportunity.metrics?.lowCompetition ?? null;
  const competition = openness === null
    ? (zh ? '未知' : 'Unknown')
    : openness >= 70 ? (zh ? '较低' : 'Lower')
      : openness >= 45 ? (zh ? '中等' : 'Medium')
        : (zh ? '较高' : 'Higher');
  const execution = opportunity.execution.score === null
    ? (zh ? '需小批验证' : 'Validate with a small batch')
    : opportunity.execution.score >= 60 ? (zh ? '可先验证' : 'Ready to validate') : (zh ? '制作门槛偏高' : 'Higher production bar');
  const reason = opportunity.recommendation === 'AVOID'
    ? (zh ? '当前公开样本不支持直接进入；不要因为单次高播放就投入。' : 'Public samples do not support a direct entry; do not commit based on isolated high views.')
    : opportunity.sampleSize < 5 || opportunity.channelCount < 3
      ? (zh ? '先补充样本与频道覆盖，再决定是否扩大制作。' : 'Build more sample and creator coverage before scaling production.')
      : (zh ? '先围绕一个明确观众问题做小批长视频，再用真实表现决定是否扩大。' : 'Start with a small long-form batch around one clear viewer problem, then scale only with real results.');
  return <section className={`longform-decision-first ${recommendation.key}`} aria-label={zh ? '新手决策摘要' : 'Beginner decision summary'}>
    <div className="longform-decision-first-head"><div><span className="longform-kicker">START HERE · DECISION FIRST</span><h3>{recommendation.label}</h3><p>{reason}</p></div><span className={`longform-decision ${recommendation.key}`}>{zh ? '长视频评估' : 'LONG-FORM'}</span></div>
    <div className="longform-decision-first-grid"><div><small>{zh ? '更推荐的形态' : 'RECOMMENDED FORMAT'}</small><b>{format.primary}</b><span>{format.secondary}</span></div><div><small>{zh ? '竞争程度' : 'COMPETITION'}</small><b>{competition}</b><span>{openness === null ? (zh ? '公开代理不可用' : 'Public proxy unavailable') : (zh ? '由公开供给空位代理判断' : 'From public supply-gap proxy')}</span></div><div><small>{zh ? '制作起点' : 'STARTING POINT'}</small><b>{execution}</b><span>{zh ? `当前形式：${opportunity.productionType}` : `Current form: ${opportunity.productionType}`}</span></div><div><small>{zh ? '预估 RPM' : 'ESTIMATED RPM'}</small><b>{rpm}</b><span>{benchmark.lowUsd !== null ? (zh ? `${benchmark.confidence === 'MEDIUM' ? '中' : '低'}可信度 · 公开市场参考` : `${benchmark.confidence.toLowerCase()} confidence · public market reference`) : (zh ? '无可匹配公开基准' : 'No matching public benchmark')}</span></div></div>
    <div className="longform-decision-first-actions"><button type="button" onClick={() => document.getElementById('research-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{zh ? '先看代表视频' : 'Review proof videos'}</button><button type="button" onClick={() => document.getElementById('research-pattern')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{zh ? '查看验证计划' : 'View validation plan'}</button><button type="button" onClick={() => routeNavigate(`/short-radar?topic=${encodeURIComponent(opportunity.topic)}`)}>{zh ? '用 Shorts 验证这个角度 →' : 'Validate this angle with Shorts →'}</button></div>
  </section>;
}

const opportunityDimensionLabels: Record<string, { zh: string; en: string }> = {
  DEMAND_STRENGTH: { zh: '需求强度', en: 'Demand strength' }, DEMAND_MOMENTUM: { zh: '需求动能', en: 'Demand momentum' },
  CREATOR_ACCESSIBILITY: { zh: '创作者可达性', en: 'Creator accessibility' }, BREAKOUT_BREADTH: { zh: '突破广度', en: 'Breakout breadth' },
  COMPETITION_PRESSURE: { zh: '竞争压力', en: 'Competition pressure' }, SATURATION_RISK: { zh: '饱和风险', en: 'Saturation risk' },
  CREATOR_CONCENTRATION: { zh: '创作者集中度', en: 'Creator concentration' }, LIFECYCLE_POSITION: { zh: '生命周期位置', en: 'Lifecycle position' },
  EXECUTION_FIT: { zh: '执行适配', en: 'Execution fit' }, EVIDENCE_STRENGTH: { zh: '证据强度', en: 'Evidence strength' },
};
const opportunityStateLabels: Record<string, { zh: string; en: string }> = {
  VERY_WEAK: { zh: '很弱', en: 'Very weak' }, WEAK: { zh: '弱', en: 'Weak' }, MODERATE: { zh: '中等', en: 'Moderate' }, STRONG: { zh: '强', en: 'Strong' }, VERY_STRONG: { zh: '很强', en: 'Very strong' },
  RISING: { zh: '上升', en: 'Rising' }, STABLE: { zh: '稳定', en: 'Stable' }, FALLING: { zh: '回落', en: 'Falling' }, ONE_CREATOR: { zh: '单一创作者', en: 'One creator' }, MULTIPLE_CREATORS: { zh: '多个创作者', en: 'Multiple creators' }, REPEATED_ACROSS_CREATORS: { zh: '跨创作者重复', en: 'Repeated across creators' }, LOW: { zh: '低', en: 'Low' }, HIGH: { zh: '高', en: 'High' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' }, EMERGING: { zh: '新兴', en: 'Emerging' }, GROWING: { zh: '增长', en: 'Growing' }, MATURE: { zh: '成熟', en: 'Mature' }, SATURATED: { zh: '拥挤/饱和', en: 'Saturated' }, DECLINING: { zh: '回落', en: 'Declining' }, UPSTREAM_OPAQUE: { zh: '上游不可审计', en: 'Upstream opaque' },
};

function OpportunityAssessmentPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const assessment = opportunity.opportunityAssessment;
  if (!assessment) return null;
  const windowLabels: Record<string, { zh: string; en: string }> = { OPEN: { zh: '开放', en: 'OPEN' }, NARROWING: { zh: '收窄', en: 'NARROWING' }, CLOSED: { zh: '关闭', en: 'CLOSED' }, UNDETERMINED: { zh: '未确定', en: 'UNDETERMINED' } };
  const decision = assessment.decision.status;
  const shownReasons = assessment.reasons.filter(item => item.type === 'SUPPORTING').slice(0, 3);
  const shownRisks = [...assessment.blockers, ...assessment.reasons.filter(item => item.type === 'RISK' || item.type === 'BLOCKING')].slice(0, 3);
  return <section className={`longform-opportunity-assessment ${decision.toLowerCase()}`} aria-label={zh ? '统一机会评估' : 'Unified opportunity assessment'}>
    <div className="longform-assessment-head"><div><span className="longform-kicker">P1 PHASE 4 · OPPORTUNITY ENGINE</span><b>{zh ? '统一机会判断' : 'Unified opportunity assessment'}</b><small>{zh ? '维度由既有证据组成，不是新的 0–100 总分。' : 'Composed from existing evidence; not a new 0–100 score.'}</small></div><div className="longform-assessment-verdict"><span>{zh ? '进入决策' : 'Entry decision'}</span><strong>{zh ? ({ INSUFFICIENT: '数据不足', CAUTION: '谨慎', TEST: '值得测试', RECOMMENDED: '推荐', AVOID: '暂不建议' } as Record<string, string>)[decision] : decision}</strong></div><div className="longform-assessment-window"><span>{zh ? '进入窗口' : 'Entry window'}</span><strong>{windowLabels[assessment.entryWindow][zh ? 'zh' : 'en']}</strong><small>{zh ? '当前结构条件，不是剩余月份预测' : 'Current structure, not a months-remaining forecast'}</small></div></div>
    <div className="longform-assessment-dimensions">{Object.values(assessment.dimensions).map(item => <div key={item.name}><span>{opportunityDimensionLabels[item.name]?.[zh ? 'zh' : 'en'] || item.name}</span><b>{opportunityStateLabels[item.state]?.[zh ? 'zh' : 'en'] || item.state}</b><small>{item.confidence} · {item.provenance[0] || (zh ? '暂无来源' : 'No source')}</small></div>)}</div>
    <div className="longform-assessment-reasons"><div><b>{zh ? '支持依据' : 'Why'}</b>{shownReasons.length ? shownReasons.map(item => <span key={item.code}>✓ {item.message}</span>) : <span>{zh ? '暂无足够的正向证据。' : 'No sufficient supporting evidence yet.'}</span>}</div><div><b>{zh ? '风险与阻塞' : 'Risks / blockers'}</b>{shownRisks.length ? shownRisks.map(item => <span key={item.code}>! {item.message}</span>) : <span>{zh ? '未触发额外风险。' : 'No additional risks fired.'}</span>}</div></div>
    <small className="longform-assessment-provenance">{zh ? `来源：${assessment.provenance.sources.join(' · ')}；生命周期：${assessment.provenance.lifecycle}；阈值：需校准。` : `Sources: ${assessment.provenance.sources.join(' · ')}; lifecycle: ${assessment.provenance.lifecycle}; thresholds: calibration required.`}</small>
  </section>;
}

const patternStatusLabels: Record<string, { zh: string; en: string }> = {
  WINNING: { zh: '赢面模式', en: 'WINNING PATTERN' },
  CANDIDATE: { zh: '候选模式', en: 'CANDIDATE' },
  INSUFFICIENT: { zh: '证据不足', en: 'INSUFFICIENT' },
  REPEATED_ACROSS_CREATORS: { zh: '跨频道重复', en: 'Repeated across creators' },
  MULTI_CREATOR_ONE_OFF: { zh: '多频道一次性', en: 'Multi-creator one-off' },
  ONE_CREATOR: { zh: '单频道', en: 'One creator' },
};
const patternFeatureLabels: Record<string, { zh: string; en: string }> = {
  TITLE_STRUCTURE: { zh: '标题结构', en: 'Title structure' },
  TITLE_SIGNAL: { zh: '标题信号', en: 'Title signal' },
  DURATION_BAND: { zh: '时长带', en: 'Duration band' },
};
const patternValueLabels: Record<string, { zh: string; en: string }> = {
  HOW_TO: { zh: '教程/方法', en: 'How-to' }, QUESTION: { zh: '问题式', en: 'Question' }, LIST_OR_NUMBER: { zh: '清单/数字', en: 'List / number' }, COMPARISON: { zh: '对比式', en: 'Comparison' }, STORY: { zh: '故事/实录', en: 'Story / documentary' }, PLAIN: { zh: '普通陈述', en: 'Plain statement' }, UNDER_10_MIN: { zh: '10 分钟内', en: 'Under 10 min' }, '10_TO_30_MIN': { zh: '10–30 分钟', en: '10–30 min' }, OVER_30_MIN: { zh: '30 分钟以上', en: 'Over 30 min' }, true: { zh: '有', en: 'Yes' },
};

function ContentPatternPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report = opportunity.contentPatterns;
  if (!report) return null;
  const shown = report.aggregations.slice(0, 4);
  const available = report.dataAvailability;
  const valueLabel = (value: string) => patternValueLabels[value]?.[zh ? 'zh' : 'en'] || value.replaceAll('_', ' ');
  return <section className="longform-content-patterns" aria-label={zh ? '长视频内容模式证据' : 'Long-form content pattern evidence'}>
    <div className="longform-content-patterns-head"><div><span className="longform-kicker">P2 PHASE 1 · CONTENT INTELLIGENCE</span><b>{zh ? '内容结构证据' : 'Content structure evidence'}</b><small>{zh ? '只从长视频公开元数据提取候选模式；频率、表现、跨创作者和重复性分开显示。' : 'Candidates use Long-form public metadata only; frequency, performance, creator breadth and repeatability stay separate.'}</small></div><span>{report.winningPatterns.length ? `${report.winningPatterns.length} ${zh ? '个赢面模式' : 'winning'}` : (zh ? '暂无赢面模式' : 'No winning pattern yet')}</span></div>
    <div className="longform-content-patterns-summary"><span>{zh ? '候选' : 'Candidates'} <b>{report.aggregations.length}</b></span><span>{zh ? '可用长视频' : 'Long-form'} <b>{report.input.longFormVideos}</b></span><span>{zh ? '频道' : 'Creators'} <b>{report.input.uniqueCreators}</b></span><span>{zh ? '字段可用率' : 'Field coverage'} <b>{Math.round(available.coverage)}%</b></span></div>
    {shown.length ? <div className="longform-content-pattern-list">{shown.map(item => { const status = item.winningPattern.status; const performance = item.performance.medianNormalizedPerformance === null ? 'UNKNOWN' : `${item.performance.medianNormalizedPerformance.toFixed(2)}×`; const breakout = item.breakoutEvidence.breakoutRate === null ? 'UNKNOWN' : `${Math.round(item.breakoutEvidence.breakoutRate * 100)}%`; return <article key={item.pattern.patternId}><div className="longform-content-pattern-title"><b>{patternFeatureLabels[item.pattern.taxonomy]?.[zh ? 'zh' : 'en'] || item.pattern.taxonomy} · {valueLabel(item.pattern.featureValue)}</b><span className={`pattern-status ${status.toLowerCase()}`}>{patternStatusLabels[status]?.[zh ? 'zh' : 'en'] || status}</span></div><div className="longform-content-pattern-metrics"><span>{zh ? '出现' : 'Used'} <b>{item.frequency.occurrences}</b></span><span>{zh ? '频道' : 'Creators'} <b>{item.creatorBreadth.distinctCreators}</b></span><span>{zh ? '中位表现' : 'Median'} <b>{performance}</b></span><span>{zh ? '突破率' : 'Breakout'} <b>{breakout}</b></span><span>{zh ? '重复性' : 'Repeatability'} <b>{patternStatusLabels[item.repeatability.status]?.[zh ? 'zh' : 'en'] || item.repeatability.status}</b></span></div></article>; })}</div> : <p className="longform-content-pattern-empty">{zh ? '当前代表视频没有足够的标题或时长字段可提取。' : 'No title or duration fields are available in the current representative sample.'}</p>}
    <small className="longform-content-pattern-note">{zh ? '赢面模式门槛：至少 5 条长视频、3 个独立频道、跨频道突破与可比较的创作者基线；原始播放量不会单独触发。当前阈值需校准。Hook、故事、剪辑、视觉和音频未接入，不做推断。' : 'Winning requires at least 5 Long-form videos, 3 independent creators, cross-creator breakout evidence and comparable creator baselines; raw views alone never qualify. Thresholds require calibration. Hooks, story, editing, visual and audio are not inferred.'}</small>
  </section>;
}

const patternTrendLabels: Record<string, { zh: string; en: string }> = {
  ACCELERATING: { zh: '加速', en: 'Accelerating' }, GROWING: { zh: '增长', en: 'Growing' }, STABLE: { zh: '稳定', en: 'Stable' }, DILUTING: { zh: '稀释/拥挤', en: 'Diluting' }, DECLINING: { zh: '回落', en: 'Declining' }, INSUFFICIENT: { zh: '历史不足', en: 'Insufficient history' },
  TOP_FIT: { zh: '顶级适配', en: 'Top fit' }, STRONG_FIT: { zh: '强适配', en: 'Strong fit' }, MODERATE_FIT: { zh: '中等适配', en: 'Moderate fit' }, WEAK_FIT: { zh: '弱适配', en: 'Weak fit' },
};

function trendChange(value: number | null, suffix = '%') {
  if (value === null || !Number.isFinite(value)) return 'UNKNOWN';
  const amount = Math.round(value * 100);
  return `${amount > 0 ? '+' : ''}${amount}${suffix}`;
}

function PatternTrendPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report = opportunity.contentPatternTrend;
  if (!report) return null;
  const shown = report.assessments.slice(0, 4);
  const fitByPattern = new Map(report.nicheFits.map(fit => [fit.pattern.patternId, fit]));
  return <section className="longform-pattern-trends" aria-label={zh ? '长视频内容模式趋势与赛道适配' : 'Long-form pattern trends and niche fit'}>
    <div className="longform-pattern-trends-head"><div><span className="longform-kicker">P2 PHASE 2 · PATTERN TREND</span><b>{zh ? '模式趋势与赛道适配' : 'Pattern trend & niche fit'}</b><small>{report.comparableWindow.comparable ? (zh ? `${report.comparableWindow.current.key} 对比 ${report.comparableWindow.previous?.key || 'previous'}` : `${report.comparableWindow.current.key} vs ${report.comparableWindow.previous?.key || 'previous'}`) : (zh ? '历史窗口不可比，趋势保持未知' : 'Comparable history is unavailable; trend remains unknown')}</small></div><span>{report.comparableWindow.comparable ? (zh ? '可比窗口' : 'Comparable windows') : (zh ? '待补历史' : 'History needed')}</span></div>
    {shown.length ? <div className="longform-pattern-trend-list">{shown.map(item => { const fit = fitByPattern.get(item.pattern.patternId); return <article key={item.pattern.patternId}><div className="longform-pattern-trend-title"><b>{item.pattern.label}</b><span className={`trend-state ${item.state.toLowerCase()}`}>{patternTrendLabels[item.state]?.[zh ? 'zh' : 'en'] || item.state}</span></div><div className="longform-pattern-trend-metrics"><span>{zh ? '采用' : 'Adoption'} <b>{trendChange(item.evidence.adoption.changePct)}</b></span><span>{zh ? '频道' : 'Creators'} <b>{trendChange(item.evidence.creatorBreadth.changePct)}</b></span><span>{zh ? '表现' : 'Performance'} <b>{trendChange(item.evidence.normalizedPerformance.changePct)}</b></span><span>{zh ? '突破' : 'Breakout'} <b>{trendChange(item.evidence.breakoutRate.delta)}</b></span>{fit ? <span>{zh ? '赛道适配' : 'Niche fit'} <b>{patternTrendLabels[fit.status]?.[zh ? 'zh' : 'en'] || fit.status}</b></span> : null}</div></article>; })}</div> : <p className="longform-pattern-trend-empty">{zh ? '当前没有可比较的 Pattern 历史。' : 'No comparable Pattern history is available yet.'}</p>}
    <small className="longform-pattern-trend-note">{zh ? '趋势不等于赢面，赛道适配不等于策略。采用量上升但表现下降会标记为稀释；本阶段只提供后续选择证据，不生成选题或策略。' : 'Trend is not the same as winning, and niche fit is not a strategy. Rising adoption with weakening performance is marked as dilution; this phase only prepares selection evidence.'}</small>
  </section>;
}

const strategyRoleLabels: Record<StrategyPatternRole, { zh: string; en: string }> = {
  PRIMARY: { zh: '主推', en: 'Primary' }, TEST: { zh: '测试', en: 'Test' }, WATCH: { zh: '观察', en: 'Watch' }, DEPRIORITIZE: { zh: '降优先级', en: 'Deprioritize' }, AVOID: { zh: '回避', en: 'Avoid' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};
const strategyStatusLabels: Record<string, { zh: string; en: string }> = {
  ACTIONABLE: { zh: '可进入验证', en: 'Actionable' }, VALIDATION: { zh: '受控验证', en: 'Validation' }, RESEARCH_ONLY: { zh: '仅供研究', en: 'Research only' }, BLOCKED: { zh: '上游阻塞', en: 'Blocked' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};

function ContentStrategyPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report = opportunity.contentStrategy;
  if (!report) return null;
  const all = [...report.primaryPatterns, ...report.testPatterns, ...report.watchPatterns, ...report.deprioritizedPatterns, ...report.avoidedPatterns, ...report.insufficientPatterns];
  const shown = all.slice(0, 6);
  const status = strategyStatusLabels[report.strategyStatus]?.[zh ? 'zh' : 'en'] || report.strategyStatus;
  const decision = report.opportunityContext.decision;
  return <section className="longform-content-strategy" aria-label={zh ? '长视频内容策略' : 'Long-form content strategy'}>
    <div className="longform-content-strategy-head"><div><span className="longform-kicker">P2 PHASE 3 · CONTENT STRATEGY</span><b>{zh ? '证据驱动内容策略' : 'Evidence-backed content strategy'}</b><small>{zh ? '策略只选择模式角色与验证边界，不生成选题、脚本或画面。' : 'Roles and validation guardrails only; no ideas, scripts or creative assets are generated.'}</small></div><div className="strategy-verdict"><strong>{status}</strong><span>{zh ? `机会上下文：${decision}` : `Opportunity: ${decision}`}</span><span>{zh ? `策略置信度：${report.confidence}` : `Strategy confidence: ${report.confidence}`}</span></div></div>
    <div className="longform-content-strategy-summary"><span>{zh ? '主推' : 'Primary'} <b>{report.primaryPatterns.length}</b></span><span>{zh ? '测试' : 'Test'} <b>{report.testPatterns.length}</b></span><span>{zh ? '观察' : 'Watch'} <b>{report.watchPatterns.length}</b></span><span>{zh ? '降级' : 'Deprioritized'} <b>{report.deprioritizedPatterns.length}</b></span><span>{zh ? '回避' : 'Avoid'} <b>{report.avoidedPatterns.length}</b></span></div>
    {shown.length ? <div className="longform-content-strategy-list">{shown.map(item => <article key={item.patternId}><div><b>{item.pattern.label}</b><span className={`strategy-role ${item.role.toLowerCase()}`}>{strategyRoleLabels[item.role]?.[zh ? 'zh' : 'en'] || item.role}</span></div><small>{item.patternStatus} · {item.trendState} · {item.fitStatus || (zh ? '适配未知' : 'fit unknown')} · {item.repeatability}</small><p>{item.reasons[0]?.message || item.blockers[0]?.message || (zh ? '暂无可展示依据。' : 'No reason available.')}</p></article>)}</div> : <p className="longform-content-strategy-empty">{zh ? '当前没有可分配的模式。' : 'No patterns are eligible for a strategy role yet.'}</p>}
    <div className="longform-content-strategy-positioning"><b>{zh ? '结构性定位' : 'Structural positioning'}</b><span>{report.positioning.summary}</span><small>{zh ? `实验计划：${report.experimentPlan.status} · 最少 ${report.experimentPlan.minimumEligibleSample} 条合格长视频样本（阈值需校准）` : `Experiment plan: ${report.experimentPlan.status} · minimum ${report.experimentPlan.minimumEligibleSample} eligible Long-form videos (calibration required)`}</small></div>
    {report.risks.length ? <small className="longform-content-strategy-note">{zh ? `风险：${report.risks.slice(0, 2).map(item => item.message).join('；')}` : `Risks: ${report.risks.slice(0, 2).map(item => item.message).join('; ')}`}</small> : null}
  </section>;
}

const validationStateLabels: Record<string, { zh: string; en: string }> = {
  VALIDATED: { zh: '已验证', en: 'Validated' }, PARTIALLY_VALIDATED: { zh: '部分验证', en: 'Partially validated' }, INCONCLUSIVE: { zh: '尚无定论', en: 'Inconclusive' }, UNDERPERFORMING: { zh: '表现不足', en: 'Underperforming' }, FAILED: { zh: '失败', en: 'Failed' }, INSUFFICIENT: { zh: '样本不足', en: 'Insufficient' },
};

const ideaNoveltyLabels: Record<string, { zh: string; en: string }> = {
  NOVEL: { zh: '新颖', en: 'Novel' }, ACCEPTABLE_VARIATION: { zh: '可接受改写', en: 'Acceptable variation' }, TOO_SIMILAR: { zh: '过近，已拦截', en: 'Too similar' }, DUPLICATE: { zh: '兄弟候选重复', en: 'Duplicate' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};
const ideaReadinessLabels: Record<string, { zh: string; en: string }> = {
  READY: { zh: '可进入测试', en: 'Ready' }, READY_WITH_CAUTION: { zh: '谨慎测试', en: 'Ready with caution' }, RESEARCH_ONLY: { zh: '仅供研究', en: 'Research only' }, BLOCKED: { zh: '已阻止', en: 'Blocked' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};

function IdeaIntelligencePanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report = opportunity.ideaIntelligence;
  if (!report) return null;
  const label = (map: Record<string, { zh: string; en: string }>, value: string) => map[value]?.[zh ? 'zh' : 'en'] || value;
  return <section className="longform-idea-intelligence" aria-label={zh ? '长视频 Idea Intelligence' : 'Long-form Idea Intelligence'}>
    <div className="longform-idea-head"><div><span className="longform-kicker">P3 PHASE 1 · IDEA INTELLIGENCE</span><b>{zh ? '从案例到可测试选题' : 'From cases to testable ideas'}</b><small>{zh ? '每个候选都保留 Case → Pattern → Strategy → Idea 的证据链；不生成脚本、Hook、缩略图或 Canvas 提示词。' : 'Every candidate preserves Case → Pattern → Strategy → Idea lineage; no scripts, hooks, thumbnails or Canvas prompts are generated.'}</small></div><div className="idea-verdict"><strong>{report.candidates.length}</strong><span>{zh ? '条可展示候选' : 'candidates shown'}</span><small>{zh ? `来源案例 ${report.cases.length} · 已拦截 ${report.blockedCandidates.length}` : `${report.cases.length} source cases · ${report.blockedCandidates.length} blocked`}</small></div></div>
    {report.candidates.length ? <div className="longform-idea-list">{report.candidates.map(item => <article key={item.ideaId} className={`idea-card ${item.state.toLowerCase()}`}><div className="idea-card-top"><span className="idea-role">{strategyRoleLabels[item.strategyRole]?.[zh ? 'zh' : 'en'] || item.strategyRole}</span><span className="idea-ready">{label(ideaReadinessLabels, item.validationReadiness)}</span></div><h4>{item.concept.workingLabel}</h4><p className="idea-question">{item.concept.coreQuestion}</p><div className="idea-meta"><span>{zh ? '新颖性' : 'Novelty'} <b>{label(ideaNoveltyLabels, item.novelty.state)}</b></span><span>{zh ? '置信度' : 'Confidence'} <b>{item.confidence}</b></span><span>{zh ? '来源案例' : 'Cases'} <b>{item.sourceCaseIds.length}</b></span><span>{zh ? 'Pattern' : 'Pattern'} <b>{item.patternIds[0]?.replace('content-pattern-v1:', '').slice(0, 8) || '—'}</b></span></div><p className="idea-difference"><b>{zh ? '如何不同' : 'How it differs'}：</b>{item.concept.differentiation}</p>{item.risks.length ? <small className="idea-risk">{zh ? '风险：' : 'Risk: '}{item.risks.slice(0, 2).map(risk => risk.message).join('；')}</small> : null}</article>)}</div> : <div className="longform-idea-empty"><b>{zh ? '当前没有可负责生成的 Idea' : 'No responsible Idea candidates yet'}</b><span>{zh ? '请先补齐可追溯案例、Pattern 趋势与赛道适配证据；系统不会用随机文本填充。' : 'Add traceable cases, Pattern trend and niche-fit evidence first; the system will not fill this with random text.'}</span></div>}
    <div className="longform-idea-foot"><span>{zh ? `多样性：${report.diversity.distinctPatterns} 个 Pattern · ${report.diversity.distinctTopics} 个主题` : `Diversity: ${report.diversity.distinctPatterns} patterns · ${report.diversity.distinctTopics} topics`}</span><small>{zh ? '相似度为词面代理，未接入 embeddings；所有 v1 阈值均需校准。' : 'Similarity uses an auditable lexical proxy; embeddings are not connected and v1 thresholds require calibration.'}</small></div>
  </section>;
}

const briefValidationLabels: Record<IdeaValidationState, { zh: string; en: string }> = {
  VALIDATED: { zh: '已验证', en: 'Validated' }, CONDITIONALLY_VALIDATED: { zh: '条件验证', en: 'Conditionally validated' }, NEEDS_REVISION: { zh: '需要修改', en: 'Needs revision' }, REJECTED: { zh: '已拒绝', en: 'Rejected' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};
const briefReadinessLabels: Record<CreativeBriefReadiness, { zh: string; en: string }> = {
  READY_FOR_CREATIVE_DEVELOPMENT: { zh: '可进入创作开发', en: 'Ready for creative development' }, READY_WITH_CAUTION: { zh: '谨慎进入开发', en: 'Ready with caution' }, NEEDS_REVISION: { zh: '先修改', en: 'Needs revision' }, BLOCKED: { zh: '已阻塞', en: 'Blocked' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};

function CreativeBriefPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report: CreativeBriefIntelligenceReport | undefined = opportunity.creativeBriefIntelligence;
  if (!report) return null;
  const shown = report.briefs.slice(0, 4);
  const validationLabel = (value: IdeaValidationState) => briefValidationLabels[value]?.[zh ? 'zh' : 'en'] || value;
  const readinessLabel = (value: CreativeBriefReadiness) => briefReadinessLabels[value]?.[zh ? 'zh' : 'en'] || value;
  return <section className="longform-creative-brief" aria-label={zh ? '长视频创作简报验证' : 'Long-form creative brief validation'}>
    <div className="longform-creative-brief-head"><div><span className="longform-kicker">P3 PHASE 2 · IDEA VALIDATION</span><b>{zh ? '已验证的创作简报基础' : 'Validated creative brief foundation'}</b><small>{zh ? '把 Idea 对齐到策略、Pattern、原创性与制作边界；此处不生成最终标题、Hook、脚本、分镜或 Canvas。' : 'Aligns each Idea with strategy, Pattern, originality and production boundaries; no final titles, hooks, scripts, storyboards or Canvas are generated.'}</small></div><div className="brief-verdict"><strong>{report.briefs.length}</strong><span>{zh ? '条可进入 Brief' : 'briefs available'}</span><small>{zh ? `验证 ${report.validations.length} · 阻塞 ${report.blockedBriefs.length}` : `${report.validations.length} validations · ${report.blockedBriefs.length} blocked`}</small></div></div>
    {shown.length ? <div className="longform-creative-brief-list">{shown.map(brief => <article key={brief.briefId} className={`creative-brief-card ${brief.readiness.toLowerCase()}`}><div className="creative-brief-card-top"><span>{validationLabel(brief.validation.state)}</span><b>{readinessLabel(brief.readiness)}</b></div><h4>{brief.audienceProblem.viewerQuestion}</h4><p><strong>{zh ? '内容承诺' : 'Promise'}：</strong>{brief.contentPromise.statement}</p><div className="creative-brief-meta"><span>{zh ? '策略' : 'Strategy'} <b>{brief.strategyContext.role}</b></span><span>{zh ? 'Pattern Fidelity' : 'Pattern fidelity'} <b>{brief.patternContext.fidelity}</b></span><span>{zh ? '原创性' : 'Originality'} <b>{brief.originality.state}</b></span><span>{zh ? '制作' : 'Production'} <b>{brief.productionFeasibility.state}</b></span><span>{zh ? '置信度' : 'Confidence'} <b>{brief.confidence}</b></span></div><p className="creative-brief-difference"><strong>{zh ? '差异化' : 'Differentiation'}：</strong>{brief.differentiation.changedContext} {brief.differentiation.changedEvidence}</p>{brief.risks.length ? <small>{zh ? '风险：' : 'Risks: '}{brief.risks.slice(0, 2).map(item => item.message).join('；')}</small> : null}</article>)}</div> : <div className="longform-creative-brief-empty"><b>{zh ? '当前还没有可进入创作开发的 Brief' : 'No Brief is ready for creative development yet'}</b><span>{zh ? '证据不足或上游门控阻塞时，系统会保留验证结果，不用随机文本填充。' : 'When evidence is insufficient or upstream gates block, the validation is preserved without invented copy.'}</span></div>}
    <div className="longform-creative-brief-foot"><span>{zh ? `评估时间：${report.context.evaluatedAt}` : `Evaluated ${report.context.evaluatedAt}`}</span><small>{zh ? '原创性使用 P3.1 词面代理；embeddings、私有指标、版权清权与真实制作成本仍不可用。' : 'Originality reuses the P3.1 lexical proxy; embeddings, private metrics, rights clearance and real production costs remain unavailable.'}</small></div>
  </section>;
}

const creativeDevelopmentReadinessLabels: Record<CreativeDevelopmentReadiness, { zh: string; en: string }> = {
  READY_FOR_SCRIPT_DEVELOPMENT: { zh: '可进入脚本开发', en: 'Ready for script development' }, READY_WITH_CAUTION: { zh: '谨慎进入脚本开发', en: 'Ready with caution' }, NEEDS_REVISION: { zh: '先修改结构', en: 'Needs revision' }, BLOCKED: { zh: '已阻塞', en: 'Blocked' }, INSUFFICIENT: { zh: '证据不足', en: 'Insufficient' },
};
const structureLabels: Record<string, { zh: string; en: string }> = {
  HOW_X: { zh: 'How-to 过程', en: 'How-to process' }, WHY_X: { zh: 'Why / 解释', en: 'Why / explanation' }, COMPARISON: { zh: '对比取舍', en: 'Comparison' }, LIST: { zh: '列表筛选', en: 'Curated list' }, INVESTIGATION: { zh: '调查转折', en: 'Investigation' }, EXPLAINED: { zh: '解释结构', en: 'Explainer' },
};

function CreativeDevelopmentPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report: CreativeDevelopmentIntelligenceReport | undefined = opportunity.creativeDevelopment;
  if (!report) return null;
  const shown = report.packages.slice(0, 3);
  const readinessLabel = (value: CreativeDevelopmentReadiness) => creativeDevelopmentReadinessLabels[value]?.[zh ? 'zh' : 'en'] || value;
  const structureLabel = (value: string) => structureLabels[value]?.[zh ? 'zh' : 'en'] || value;
  return <section className="longform-creative-development" aria-label={zh ? '长视频创作结构开发' : 'Long-form creative development'}>
    <div className="longform-creative-development-head"><div><span className="longform-kicker">P3 PHASE 3 · CREATIVE STRUCTURE</span><b>{zh ? '从创作简报到标题、开场与大纲' : 'From brief to title, hook and outline'}</b><small>{zh ? '这里只给出证据支持的结构方向，不生成最终标题、Exact Hook、完整脚本、分镜或 Canvas。' : 'Evidence-backed structure directions only; no final titles, exact hook copy, full scripts, storyboards or Canvas.'}</small></div><div className="creative-development-verdict"><strong>{report.packages.length}</strong><span>{zh ? '条可开发结构' : 'packages'}</span><small>{zh ? `阻塞 ${report.blockedPackages.length}` : `${report.blockedPackages.length} blocked`}</small></div></div>
    {shown.length ? <div className="longform-creative-development-list">{shown.map(item => <article key={item.packageId} className={`creative-development-card ${item.readiness.toLowerCase()}`}><div className="creative-development-card-top"><span>{readinessLabel(item.readiness)}</span><b>{item.confidence}</b></div><h4>{structureLabel(item.titleDirection.structureType)} · {item.titleDirection.angle}</h4><div className="creative-development-grid"><div><small>{zh ? '标题方向' : 'Title direction'}</small><strong>{item.titleDirection.structureType}</strong><span>{item.titleDirection.promiseType} · {item.titleDirection.tensionType}</span></div><div><small>{zh ? 'Hook 目标' : 'Hook objective'}</small><strong>{item.hookIntelligence.hookObjective}</strong><span>{item.hookIntelligence.hookStructure}</span></div><div><small>{zh ? '内容大纲' : 'Outline'}</small><strong>{item.outline.structureType}</strong><span>{item.outline.beats.length} {zh ? '个结构段' : 'beats'} · {item.outline.promiseCoverage.covered ? (zh ? '承诺已覆盖' : 'promise covered') : (zh ? '承诺未覆盖' : 'promise gap')}</span></div></div><p><strong>{zh ? 'Opening Promise：' : 'Opening promise: '}</strong>{item.openingPromise.statement}</p><p className="creative-development-guardrail"><strong>{zh ? '原创性护栏：' : 'Originality guardrail: '}</strong>{item.originalityGuardrails.allowedMechanismReuse} {item.originalityGuardrails.notes[0]}</p><details><summary>{zh ? '查看结构段与约束' : 'View beats and constraints'}</summary><ol>{item.outline.beats.map(beat => <li key={beat.index}><b>{beat.index}. {beat.role}</b><span>{beat.objective} · {beat.evidenceRequirement}</span></li>)}</ol><small>{zh ? `固定约束：${item.mandatoryConstraints.slice(0, 3).join('；')}` : `Fixed constraints: ${item.mandatoryConstraints.slice(0, 3).join('; ')}`}</small></details></article>)}</div> : <div className="longform-creative-development-empty"><b>{zh ? '当前没有可进入结构开发的 Brief' : 'No brief is ready for creative structure development'}</b><span>{zh ? '上游拒绝、证据不足或原创性门控会保留在阻塞列表中。' : 'Rejected, insufficient or originality-gated briefs remain in the blocked list.'}</span></div>}
    <div className="longform-creative-development-foot"><span>{zh ? `阻塞结构 ${report.blockedPackages.length} 条` : `${report.blockedPackages.length} blocked structures`}</span><small>{zh ? 'Hook 证据受转录不可用限制；相似度使用 P3.1 词面代理；阈值需校准。' : 'Hook evidence is limited by unavailable transcripts; similarity uses the P3.1 lexical proxy; thresholds require calibration.'}</small></div>
  </section>;
}

function ExperimentValidationPanel({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const report = opportunity.experimentValidation;
  if (!report) return null;
  const validation = validationStateLabels[report.strategyValidation.state]?.[zh ? 'zh' : 'en'] || report.strategyValidation.state;
  const sample = report.sampleSufficiency;
  return <section className="longform-experiment-validation" aria-label={zh ? '长视频策略验证' : 'Long-form strategy validation'}>
    <div className="longform-experiment-validation-head"><div><span className="longform-kicker">P2 PHASE 4 · VALIDATION</span><b>{zh ? '策略验证' : 'Strategy validation'}</b><small>{zh ? '只接受真实观察；没有观察时保持“未开始/样本不足”，不会改写历史策略。' : 'Only real observations count; without observations this remains planned/insufficient and never rewrites history.'}</small></div><div className="validation-verdict"><strong>{validation}</strong><span>{zh ? `实验状态：${report.status}` : `Experiment: ${report.status}`}</span><span>{zh ? `置信度：${report.confidence}` : `Confidence: ${report.confidence}`}</span></div></div>
    <div className="longform-experiment-validation-summary"><span>{zh ? '合格观察' : 'Eligible observations'} <b>{sample.eligibleVideos}</b></span><span>{zh ? '独立频道' : 'Creators'} <b>{sample.eligibleCreators}</b></span><span>{zh ? '样本状态' : 'Sample'} <b>{sample.state}</b></span><span>{zh ? '模式结果' : 'Pattern results'} <b>{report.patternValidation.length}</b></span></div>
    {report.patternValidation.length ? <div className="longform-experiment-validation-list">{report.patternValidation.slice(0, 4).map(item => <article key={item.patternId}><div><b>{item.patternId}</b><span>{validationStateLabels[item.state]?.[zh ? 'zh' : 'en'] || item.state}</span></div><small>{zh ? `合格 ${item.eligibleVideos} 条 · ${item.eligibleCreators} 个频道 · 高于/达到 ${item.aboveExpectation + item.meetsExpectation} 条` : `${item.eligibleVideos} eligible · ${item.eligibleCreators} creators · ${item.aboveExpectation + item.meetsExpectation} at/above expectation`}</small></article>)}</div> : <p className="longform-experiment-validation-empty">{zh ? '尚无实验观察。先创建实验并接入公开视频快照；当前仅保留策略快照与期望。' : 'No experiment observations yet. Start an experiment and attach public observation snapshots; strategy and expectations are preserved for now.'}</p>}
    {report.blockers.length ? <small className="longform-experiment-validation-note">{zh ? `阻塞：${report.blockers.slice(0, 2).join('、')}` : `Blockers: ${report.blockers.slice(0, 2).join(', ')}`}</small> : null}
  </section>;
}

function OpportunityCard({ opportunity, locale }: { opportunity: LongformOpportunity; locale: UiLocale }) {
  const zh = locale === 'zh';
  const representativeCount = opportunity.representativeVideos.length;
  const decision = recommendationFor(opportunity, locale);
  const canonicalConfidence = opportunity.confidenceLevel || opportunity.confidenceLabel;
  const nicheSignals = opportunity.nicheSignals;
  const signalLabels: Record<string, string> = {
    SMALL_CREATOR_BREAKOUT: zh ? '小创作者突破' : 'Small-creator breakout',
    CROSS_CREATOR_BREAKOUT: zh ? '跨创作者突破' : 'Cross-creator breakout',
    REPEATED_BREAKOUT: zh ? '重复突破' : 'Repeated breakout',
    BREAKOUT_DENSITY_HIGH: zh ? '突破密度偏高' : 'High breakout density',
    CREATOR_CONCENTRATION_HIGH: zh ? '创作者集中度高' : 'High creator concentration',
    CREATOR_CONCENTRATION_LOW: zh ? '创作者分布分散' : 'Low creator concentration',
  };
  const strengthLabels: Record<string, string> = { INSUFFICIENT: zh ? '证据不足' : 'Insufficient', WEAK: zh ? '弱' : 'Weak', MODERATE: zh ? '中' : 'Moderate', STRONG: zh ? '强' : 'Strong' };
  const lifecycle = opportunity.nicheLifecycle;
  const lifecycleLabels: Record<string, string> = { INSUFFICIENT: zh ? '证据不足' : 'Insufficient', EMERGING: zh ? '新兴' : 'Emerging', GROWING: zh ? '增长' : 'Growing', MATURE: zh ? '成熟' : 'Mature', SATURATED: zh ? '拥挤/饱和' : 'Saturated', DECLINING: zh ? '回落' : 'Declining' };
  const supplyDemandLabels: Record<string, string> = { INSUFFICIENT: zh ? '证据不足' : 'Insufficient', DEMAND_OUTPACING_SUPPLY: zh ? '需求表现快于供给' : 'Demand outpacing supply', BALANCED_GROWTH: zh ? '供需同步增长' : 'Balanced growth', SUPPLY_OUTPACING_DEMAND: zh ? '供给快于需求表现' : 'Supply outpacing demand', BOTH_DECLINING: zh ? '供需共同回落' : 'Both declining', MIXED: zh ? '混合信号' : 'Mixed' };
  return <article className={`longform-opportunity ${decision.key}`}>
    <div className="longform-opportunity-head"><div><span className="longform-kicker">{opportunity.topic}</span><h2>{opportunity.mechanism} · {opportunity.productionType}</h2></div><div className="longform-head-badges"><span className={`longform-decision ${decision.key}`}>{decision.label}</span><span className={`longform-confidence ${canonicalConfidence.toLowerCase()}`}>{zh ? `置信度 ${opportunity.confidence}` : `${opportunity.confidence} confidence`}</span></div></div>
    <OpportunityAssessmentPanel opportunity={opportunity} locale={locale}/><ContentPatternPanel opportunity={opportunity} locale={locale}/><PatternTrendPanel opportunity={opportunity} locale={locale}/><ContentStrategyPanel opportunity={opportunity} locale={locale}/><ExperimentValidationPanel opportunity={opportunity} locale={locale}/><IdeaIntelligencePanel opportunity={opportunity} locale={locale}/><div className="longform-stats"><span><b>{opportunity.sampleSize}</b>{zh ? '条视频' : ' videos'}</span><span><b>{opportunity.channelCount}</b>{zh ? '个频道' : ' channels'}</span><span><b>{formatNumber(opportunity.medianViews, locale)}</b>{zh ? '中位播放' : ' median views'}</span></div>
    <DecisionFirstBrief opportunity={opportunity} locale={locale}/>
    <CreativeBriefPanel opportunity={opportunity} locale={locale}/><CreativeDevelopmentPanel opportunity={opportunity} locale={locale}/>
    <div className="longform-score-grid" id="research-demand"><Score label={zh ? '市场机会（外部）' : 'Market (external)'} value={opportunity.marketOpportunity} tone="coral" hint={zh ? '上游公开信号，公式不可审计' : 'Opaque upstream signal; formula is not locally auditable'}/><Score label={zh ? '执行适配（外部）' : 'Execution (external)'} value={opportunity.executionFit} hint={zh ? '上游公开信号，公式不可审计' : 'Opaque upstream signal; formula is not locally auditable'}/><Score label={zh ? '表现' : 'Performance'} value={opportunity.performance?.score ?? null} tone="teal" hint={zh ? '基于可用公开表现指标，不回答是否进入' : 'Observed public performance; does not answer whether to enter'}/><Score label={zh ? '进入决策' : 'Entry decision'} value={null} tone="ink" displayValue={opportunity.opportunityAssessment?.decision.status || opportunity.entryDecision?.status || (zh ? '待判断' : 'Pending')} hint={zh ? '由证据与置信度门控，不是单一分数' : 'Gated by evidence and confidence, not a single score'}/></div>
    <LongformEvidenceLayer opportunity={opportunity} locale={locale}/>
    {nicheSignals ? <section className="longform-niche-signals" aria-label={zh ? '跨创作者赛道信号' : 'Cross-creator niche signals'}><div className="longform-evidence-heading"><b>{zh ? '跨创作者赛道信号' : 'Cross-creator niche signals'}</b><small>{zh ? `${nicheSignals.eligibleCreators} 个独立创作者 · ${nicheSignals.eligibleVideos} 条可比较视频` : `${nicheSignals.eligibleCreators} independent creators · ${nicheSignals.eligibleVideos} eligible videos`}</small></div><div className="longform-niche-signal-list">{nicheSignals.signals.filter(signal => signal.strength !== 'INSUFFICIENT').map(signal => <span key={signal.type} className={`signal-${signal.strength.toLowerCase()}`}>{signalLabels[signal.type] || signal.type} · {strengthLabels[signal.strength] || signal.strength}</span>)}</div><div className="longform-niche-signal-metrics"><span>{zh ? '突破密度' : 'Breakout density'} {nicheSignals.breakoutDensity === null ? '—' : `${Math.round(nicheSignals.breakoutDensity * 100)}%`}</span><span>{zh ? '重复突破创作者' : 'Repeated-breakout creators'} {nicheSignals.repeatedBreakoutCreators}</span><span>{zh ? 'Top 3 播放占比' : 'Top 3 view share'} {nicheSignals.concentration.top3Share === null ? '—' : `${Math.round(nicheSignals.concentration.top3Share * 100)}%`}</span></div><small className="longform-niche-signal-note">{zh ? '这是跨创作者证据，不等于机会分数或进入建议。阈值状态：需校准。' : 'Cross-creator evidence only; not an opportunity score or entry recommendation. Thresholds require calibration.'}</small></section> : null}
    {lifecycle ? <section className="longform-lifecycle-evidence" aria-label={zh ? '赛道生命周期证据' : 'Niche lifecycle evidence'}><div className="longform-evidence-heading"><b>{zh ? '赛道生命周期' : 'Niche lifecycle'}</b><small>{lifecycle.lifecycle.provenance === 'RETROSPECTIVE' ? (zh ? '回顾性 cohort 证据' : 'Retrospective cohort evidence') : lifecycle.lifecycle.provenance}</small></div><div className="longform-lifecycle-state"><strong>{lifecycleLabels[lifecycle.lifecycle.state] || lifecycle.lifecycle.state}</strong><span>{zh ? `置信度 ${lifecycle.lifecycle.confidence}` : `${lifecycle.lifecycle.confidence} confidence`}</span><span>{zh ? `供需关系：${supplyDemandLabels[lifecycle.supplyDemandRelationship] || lifecycle.supplyDemandRelationship}` : `Supply/demand: ${supplyDemandLabels[lifecycle.supplyDemandRelationship] || lifecycle.supplyDemandRelationship}`}</span></div><small className="longform-niche-signal-note">{zh ? '生命周期只提供时间证据，不等于 AVOID 或进入决策；当前窗口与对比窗口必须保持可比。' : 'Lifecycle is temporal evidence only; it is not AVOID or an entry decision. Windows must remain comparable.'}</small></section> : null}
    <LongformPlanningPanel opportunity={opportunity} locale={locale}/>
    <LongformValidationPlan opportunity={opportunity} locale={locale}/>
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
  const [researchContext, setResearchContext] = useState<NicheAnalysisContext | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const [selectedOpportunityKey, setSelectedOpportunityKey] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const updateUrl = (patch: Parameters<typeof writeResearchUrlState>[1]) => {
    if (typeof globalThis.window === 'undefined') return;
    const search = writeResearchUrlState(globalThis.window.location.search, patch);
    globalThis.window.history.replaceState({}, '', `${globalThis.window.location.pathname}${search}`);
  };
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
  useEffect(() => {
    const syncContext = () => {
      const params = new URLSearchParams(globalThis.window.location.search);
      const urlState = readResearchUrlState(globalThis.window.location.search);
      const context = contextFromQuery(params);
      setResearchContext(context);
      if (urlState.window && ['7d', '28d', '90d', '365d'].includes(urlState.window)) setWindow(urlState.window);
      if (urlState.market && ['all', 'US', 'GB', 'JP', 'IN'].includes(urlState.market)) setMarket(urlState.market);
      if (urlState.lane && ['ALL', 'BREAKOUT', 'UNDERSERVED', 'EVERGREEN', 'FORMAT_GAP'].includes(urlState.lane)) setLane(urlState.lane);
      if (urlState.direction) setSelectedOpportunityKey(urlState.direction);
      if (context) {
        setWindow(normalizeEvaluationWindow(context.timeWindow));
        const contextMarket = context.filters && typeof context.filters.market === 'string' ? context.filters.market : undefined;
        if (contextMarket) setMarket(contextMarket);
      }
      setContextReady(true);
    };
    syncContext();
    globalThis.window.addEventListener('popstate', syncContext);
    globalThis.window.addEventListener('signalcraft:navigate', syncContext);
    return () => { globalThis.window.removeEventListener('popstate', syncContext); globalThis.window.removeEventListener('signalcraft:navigate', syncContext); };
  }, []);
  useEffect(() => { if (!contextReady) return; const timer = setTimeout(() => { void load(); }, 0); return () => clearTimeout(timer); }, [contextReady, load]);
  useEffect(() => () => requestRef.current?.abort(), []);
  const laneOptions = useMemo(() => [{ key: 'ALL', label: zh ? '全部机会' : 'All opportunities' }, { key: 'BREAKOUT', label: zh ? '爆发信号' : 'Breakout' }, { key: 'UNDERSERVED', label: zh ? '低粉机会' : 'Underserved' }, { key: 'EVERGREEN', label: zh ? '长期需求' : 'Evergreen' }, { key: 'FORMAT_GAP', label: zh ? '形态空位' : 'Format gaps' }], [zh]);
  const opportunities = (data?.opportunities || []).filter(item => lane === 'ALL' || item.lanes.includes(lane));
  const leadOpportunity = opportunities[0] || null;
  const contextOpportunity = useMemo(() => {
    if (!researchContext || !data) return null;
    const target = normalizedText(researchContext.nicheName || researchContext.topicName);
    if (!target) return null;
    return data.opportunities.find(item => {
      const values = [item.key, item.topic, item.mechanism, `${item.mechanism} · ${item.productionType}`].map(normalizedText);
      return values.some(value => value === target || value.includes(target) || target.includes(value));
    }) || null;
  }, [data, researchContext]);
  const selectedOpportunity = opportunities.find(item => item.key === selectedOpportunityKey) || contextOpportunity || leadOpportunity;
  const heroWindow = windowLabels[window] || windowLabels['28d'];
  const contextTrendSignals = researchContext?.trendSignals && typeof researchContext.trendSignals === 'object' ? researchContext.trendSignals as Record<string, unknown> : null;
  const contextBreakoutSignals = researchContext?.breakoutSignals && typeof researchContext.breakoutSignals === 'object' ? researchContext.breakoutSignals as Record<string, unknown> : null;
  const contextSmallCreatorSignals = researchContext?.smallCreatorSignals && typeof researchContext.smallCreatorSignals === 'object' ? researchContext.smallCreatorSignals as Record<string, unknown> : null;
  const returnToRadar = () => {
    if (!researchContext) return;
    saveNicheAnalysisContext(researchContext);
    routeNavigate(buildTrendRadarHref(researchContext, true));
  };
  const openRelatedRadar = (lane?: string) => {
    const context: NicheAnalysisContext = researchContext || {
      nicheName: selectedOpportunity?.topic || '',
      topicName: selectedOpportunity?.topic,
      contentType: 'LONG_FORM',
      platformType: 'YOUTUBE',
      timeWindow: window,
      source: 'NICHE_EVALUATION',
    };
    if (!context.nicheName) return;
    saveNicheAnalysisContext({ ...context, source: 'NICHE_EVALUATION' });
    routeNavigate(buildTrendRadarHref({ ...context, source: 'NICHE_EVALUATION' }, false, lane));
  };
  const Container = embedded ? 'section' : 'main';
  return <Container className="longform-page">
    <section className="longform-hero"><div><span className="longform-kicker">LONG-FORM DISCOVERY ENGINE</span><h1>{zh ? '找到值得长期制作的长视频方向。' : 'Find long-form directions worth making.'}</h1><p>{zh ? '市场机会与执行适配分开计算。每个结论都回到公开样本、采集时间和置信度，不把不可见的 CTR、留存或收益伪装成事实。' : 'Market opportunity and execution fit stay separate. Every conclusion points back to public samples, capture time, and confidence.'}</p></div><div className="longform-hero-mark"><span>{heroWindow.value}</span><small>{zh ? heroWindow.zh : heroWindow.en}</small><i /></div></section>
    {researchContext && <section className="longform-research-context" aria-label={zh ? '趋势雷达评估上下文' : 'Trend Radar evaluation context'}><div><span className="longform-kicker">TREND → EVALUATION</span><b>{zh ? '趋势雷达发现 · 已自动带入' : 'Found by Trend Radar · loaded automatically'}</b><small>{researchContext.nicheName} · {researchContext.contentType || 'LONG_FORM'} · {researchContext.format || (zh ? '未识别形态' : 'Format unavailable')} · {researchContext.topicName || (zh ? '未识别主题' : 'Topic unavailable')}</small><small>{Array.isArray(researchContext.representativeVideos) ? `${researchContext.representativeVideos.length}${zh ? ' 条代表视频证据' : ' representative videos'}` : (zh ? '代表视频未提供' : 'Representative videos unavailable')}</small></div><div><span>{zh ? '趋势状态' : 'Trend state'} <b>{trendStateLabel(contextTrendSignals?.lifecycle || contextTrendSignals?.eventType, locale)}</b></span><span>{zh ? '窗口' : 'Window'} <b>{evaluationWindowNote(researchContext.timeWindow)}</b></span><span>{zh ? '小频道突破' : 'Small creators'} <b>{String(contextBreakoutSignals?.count ?? contextSmallCreatorSignals?.count ?? '—')}</b></span><span>{zh ? '置信度' : 'Confidence'} <b>{String(researchContext.confidence || '—')}</b></span><button type="button" onClick={returnToRadar}>{zh ? '← 返回趋势雷达' : '← Back to Trend Radar'}</button></div></section>}
    <section className="longform-toolbar"><label>{zh ? '市场' : 'Market'}<select value={market} onChange={event => { const next = event.target.value; setMarket(next); updateUrl({ market: next }); }}><option value="all">{zh ? '全部已采集市场' : 'All collected markets'}</option><option value="US">US</option><option value="GB">GB</option><option value="JP">JP</option><option value="IN">IN</option></select></label><label>{zh ? '时间窗口' : 'Window'}<select value={window} onChange={event => { const next = event.target.value; setWindow(next); updateUrl({ window: next }); }}><option value="7d">{zh ? '近 7 天' : '7 days'}</option><option value="28d">{zh ? '近 28 天' : '28 days'}</option><option value="90d">{zh ? '近 90 天' : '90 days'}</option><option value="365d">{zh ? '近 1 年' : '1 year'}</option></select></label><button type="button" className="longform-refresh" onClick={() => void load()} disabled={loading}>{loading ? (zh ? '更新中…' : 'Refreshing…') : (zh ? '更新数据' : 'Refresh')}</button></section>
    {data && <section className="longform-scope"><div className="longform-scope-copy"><span className="longform-kicker">DATA SCOPE</span><b>{zh ? '这次判断基于哪一批公开样本？' : 'Which public sample powers this view?'}</b><small>{data.dataScope.source === 'longform_video_features' ? (zh ? '独立长视频候选池 · 不与 Shorts 共用排名样本' : 'Independent long-form pool · isolated from Shorts ranking samples') : (zh ? '兼容读取现有公开信号池 · 独立采集尚未启用' : 'Compatibility read from the existing public signal pool · independent collector not enabled')}</small><small>{data.dataScope.latestCapturedAt ? `${zh ? '最近采集' : 'Latest capture'} ${new Date(data.dataScope.latestCapturedAt).toLocaleString()}` : (zh ? '尚无采集时间' : 'No capture timestamp')}</small>{data.dataScope.marketSampleLimit ? <small>{zh ? `按市场分层取样：每个市场最多 ${data.dataScope.marketSampleLimit} 条` : `Market-stratified pool: up to ${data.dataScope.marketSampleLimit} rows per market`}</small> : null}{data.dataScope.failedMarkets?.length ? <small className="longform-partial-warning">{zh ? `部分市场读取失败：${data.dataScope.failedMarkets.join('、')}` : `Partial market read failure: ${data.dataScope.failedMarkets.join(', ')}`}</small> : null}</div><div className="longform-scope-facts"><span><small>{zh ? '长视频候选' : 'Long-form pool'}</small><b>{data.dataScope.longformRows}</b></span><span><small>{zh ? '已采集样本' : 'Collected rows'}</small><b>{data.dataScope.collectedRows}</b></span><span><small>{zh ? '覆盖市场' : 'Markets'}</small><b>{data.dataScope.markets.length || '—'}</b></span></div><div className="longform-coverage"><b>{data.availabilityAudit.coverage}%</b><small>{zh ? '字段可用率' : 'field availability'}</small></div></section>}
    {data && <DataBoundary data={data} locale={locale} />}
    <DecisionSummary opportunity={selectedOpportunity} locale={locale} />
    <TrendRadarConnection context={researchContext} opportunity={selectedOpportunity} locale={locale} onReturn={returnToRadar} onOpenRadar={openRelatedRadar} />
    <section className="longform-reading-guide" aria-label={zh ? '机会台读法' : 'How to read the opportunity desk'}><div className="longform-reading-guide-title"><span className="longform-kicker">HOW TO READ</span><b>{zh ? '三步判断，不把一个分数当结论' : 'Three checks before treating a score as a decision'}</b><small>{zh ? '分数用于排序，证据用于确认。' : 'Scores sort the list; evidence confirms the decision.'}</small></div><ol><li><b>01</b><span>{zh ? '先看市场机会' : 'Market first'}</span><small>{zh ? '需求与供给' : 'Demand and supply'}</small></li><li><b>02</b><span>{zh ? '再看执行适配' : 'Then execution'}</span><small>{zh ? '制作是否可复用' : 'Repeatable format'}</small></li><li><b>03</b><span>{zh ? '最后看代表证据' : 'Then evidence'}</span><small>{zh ? '样本、时间、置信度' : 'Sample, recency, confidence'}</small></li></ol></section>
    <nav className="longform-lane-tabs" aria-label={zh ? '机会类型' : 'Opportunity lanes'}>{laneOptions.map(item => <button type="button" key={item.key} className={lane === item.key ? 'active' : ''} onClick={() => { setLane(item.key); setSelectedOpportunityKey(null); updateUrl({ lane: item.key, direction: undefined }); }}>{item.label}{item.key !== 'ALL' && data ? <small>{data.lanes[item.key] || 0}</small> : null}</button>)}<span className="longform-lane-note">{opportunities.length ? (zh ? `当前显示 ${opportunities.length} 个方向 · 按进入分排序，置信度辅助判断` : `${opportunities.length} directions · sorted by entry score, with confidence as a guide`) : (zh ? '当前筛选暂无方向' : 'No directions match this filter')}</span></nav>
    {error ? <div className="longform-state error"><b>{zh ? '暂时无法读取长视频数据' : 'Long-form data is unavailable'}</b><p>{error}</p><button type="button" onClick={() => void load()}>{zh ? '重试' : 'Try again'}</button></div> : loading && !data ? <div className="longform-state"><b>{zh ? '正在整理公开长视频样本…' : 'Preparing public long-form samples…'}</b></div> : opportunities.length ? <>
      <nav className="longform-research-navigation" aria-label={zh ? '长视频赛道评估导航' : 'Long-form niche evaluation navigation'}>
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
          <div className="longform-direction-list">{opportunities.map((item, index) => { const selected = item.key === selectedOpportunity?.key; const recommendation = recommendationFor(item, locale); return <button type="button" key={item.key} className={selected ? 'active' : ''} onClick={() => { setSelectedOpportunityKey(item.key); updateUrl({ direction: item.key }); }} aria-current={selected ? 'true' : undefined}><span><b>{String(index + 1).padStart(2, '0')}</b><strong>{item.mechanism} · {item.productionType}</strong><small>{item.topic}</small></span><em className={recommendation.key}>{recommendation.label}</em></button>; })}</div>
        </aside>
        <div className="longform-research-main" id="research-decision"><div className="longform-workspace-heading"><span className="longform-kicker">SINGLE-NICHE DECISION</span><b>{zh ? '当前研究对象' : 'Current research subject'}</b><small>{selectedOpportunity ? `${selectedOpportunity.topic} · ${selectedOpportunity.mechanism}` : (zh ? '尚未选择赛道' : 'No direction selected')}</small></div>{selectedOpportunity ? <OpportunityCard opportunity={selectedOpportunity} locale={locale}/> : <div className="longform-state"><b>{zh ? '当前没有可研究的方向' : 'No direction to research'}</b></div>}</div>
      </section>
    </> : <div className="longform-state"><b>{zh ? '当前窗口还没有足够的长视频样本' : 'Not enough long-form samples for this window'}</b><p>{zh ? '这不是演示数据。请扩大市场或时间窗口，等采集任务积累可比较的快照。' : 'This is not demo data. Expand the market or window and wait for comparable snapshots.'}</p></div>}
    <section className="longform-boundary"><div><span className="longform-kicker">READ THE SIGNAL</span><h2>{zh ? '哪些数据目前不能回答？' : 'What can this data not answer yet?'}</h2></div><div>{(data?.gaps || [zh ? '字幕、CTR、留存、RPM/CPM 和收入不属于公开字段。' : 'Transcripts, CTR, retention, RPM/CPM and revenue are not public fields.']).map(gap => <p key={gap}>→ {gap}</p>)}</div></section>
  </Container>;
}

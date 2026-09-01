'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import LongformOpportunities from './longform-opportunities';
import ShortformOpportunityRadar, { type ShortformRadarActions } from './shortform-opportunity-radar';
import AllOpportunityRadar from './all-opportunity-radar';
import { languageCopy, type UiLocale } from '@/src/lib/ui-language';

type DeskView = 'opportunities' | 'radar' | 'short-radar' | 'all-radar';

type LongformResearchDeskProps = {
  locale: UiLocale;
  initialView: DeskView;
} & OpportunityRadarActions & ShortformRadarActions;

function setRoute(path: string) {
  if (typeof window === 'undefined') return;
  const current = new URL(window.location.href);
  const next = new URL(path, current.origin);
  // Keep the current desk filters/focus when switching research jobs. The
  // child surface validates each key; unknown keys are harmless and preserve
  // backwards-compatible deep links.
  next.search = current.search;
  if (current.pathname === next.pathname && current.search === next.search) return;
  window.history.pushState({}, '', `${next.pathname}${next.search}`);
  window.dispatchEvent(new Event('signalcraft:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export default function LongformResearchDesk({ locale, initialView, onWatch, onCreateIdea, onResearch, onShortResearch }: LongformResearchDeskProps) {
  const zh = locale === 'zh';
  const view = initialView;
  const shortRadar = view === 'short-radar';
  const allRadar = view === 'all-radar';
  const viewCopy = languageCopy[locale].researchViews;

  const chooseView = (next: DeskView) => {
    setRoute(next === 'radar' ? '/radar' : next === 'short-radar' ? '/short-radar' : next === 'all-radar' ? '/radar/all' : '/longform');
  };
  const switchRadarFormat = (format: 'ALL' | 'SHORTS' | 'LONG_FORM') => {
    chooseView(format === 'ALL' ? 'all-radar' : format === 'SHORTS' ? 'short-radar' : 'radar');
  };

  const decisionLenses: Array<[string, string]> = allRadar
    ? zh
      ? [['范围先分开', '长视频与 Shorts 独立 feed'], ['信号再核验', '各自窗口、基线与置信度'], ['最后行动', '进入对应的研究或制作路径']]
      : [['Separate scope', 'Independent long-form and Shorts feeds'], ['Verify signal', 'Own windows, baselines and confidence'], ['Then act', 'Open the matching research or studio path']]
    : shortRadar
    ? zh
      ? [['样本边界', '只读取 Shorts 样本'], ['变化信号', '扩散、突破与供给'], ['产品边界', '不改变 Shorts 榜单']]
      : [['Sample boundary', 'Shorts samples only'], ['Change signals', 'Spread, breakout, supply'], ['Product boundary', 'Shorts rankings unchanged']]
    : view === 'radar'
      ? zh
        ? [['先看变化', '新兴、升温、突破、拥挤、回落'], ['再看证据', 'Why Now、历史基线、跨频道'], ['最后行动', '加入监控或进入工作室']]
        : [['Start with change', 'Emerging, heating, breakout, crowded, decline'], ['Then verify', 'Why Now, baselines, cross-channel proof'], ['Then act', 'Watch it or send to Studio']]
      : zh
        ? [['先看市场', '需求与供给是否匹配'], ['再看执行', '制作难度与进入门槛'], ['最后判断', '证据覆盖是否足够']]
        : [['Start with market', 'Demand and supply fit'], ['Then execution', 'Production difficulty and entry bar'], ['Then decide', 'Evidence coverage']];

  return <main className={`longform-research-desk ${view === 'radar' || view === 'all-radar' ? 'radar-desk-shell' : view === 'opportunities' ? 'research-desk-shell' : 'short-radar-desk-shell'}`}>
    <header className="longform-research-header">
      <div>
        <span className="longform-research-kicker">{allRadar ? 'CROSS-FORMAT SIGNAL OVERVIEW' : shortRadar ? 'SHORTS TREND RADAR' : view === 'radar' ? 'LONG-FORM TREND RADAR' : 'LONG-FORM NICHE EVALUATION'}</span>
        <h1>{allRadar ? (zh ? '并列查看长视频与 Shorts 信号。' : 'Read long-form and Shorts signals side by side.') : shortRadar ? (zh ? '识别 Shorts 最近出现的变化。' : 'Detect recent changes in Shorts.') : view === 'radar' ? (zh ? '识别长视频市场最近发生的变化。' : 'Detect recent changes in long-form markets.') : (zh ? '判断一个长视频方向是否值得进入。' : 'Decide whether a long-form niche is worth entering.')}</h1>
        <p>{allRadar ? (zh ? '总览同时读取长视频与 Shorts 两个独立引擎，只用于扫描范围；两种形态仍按各自的窗口、基线和证据链计算，不比较原始播放量或评分。' : 'The overview scans two independent engines. Each format keeps its own window, baseline, and evidence chain; raw views and scores are never compared.') : shortRadar ? (zh ? 'Shorts 趋势雷达只观察跨频道扩散、中小频道突破和供给变化；原有 Shorts 榜单、筛选、历史与评分保持不变。' : 'Shorts Trend Radar tracks cross-channel spread, creator breakouts, and supply change; existing Shorts rankings, filters, history, and scoring stay unchanged.') : view === 'radar' ? (zh ? '长视频趋势雷达只回答“最近发生了什么变化”：新兴、升温、突破、拥挤或回落。它不替代排行榜，也不复用赛道评估分。' : 'Long-form Trend Radar answers what changed recently: emerging, heating up, breaking out, crowded, or declining. It does not replace Rankings or reuse niche-evaluation scores.') : (zh ? '长视频赛道评估回答这个方向是否值得长期制作，展示市场机会、执行适配、证据覆盖与代表视频；近期变化请切换到长视频趋势雷达。' : 'Long-form Niche Evaluation assesses durable making value with market opportunity, execution fit, evidence coverage, and representative videos; use Trend Radar for recent change.')}</p>
      </div>
      <div className="longform-research-stamp" aria-label={zh ? '四个独立研究任务' : 'Four distinct research jobs'}><b>04</b><span>{zh ? '独立研究任务' : 'distinct research jobs'}</span><i /></div>
    </header>
    <nav className="longform-research-tabs" aria-label={zh ? '研究任务' : 'Research jobs'}>
      <button type="button" role="tab" className={view === 'opportunities' ? 'active' : ''} aria-selected={view === 'opportunities'} onClick={() => chooseView('opportunities')}><span>{viewCopy.evaluation.label}</span><small>{viewCopy.evaluation.hint}</small></button>
      <button type="button" role="tab" className={view === 'radar' ? 'active' : ''} aria-selected={view === 'radar'} onClick={() => chooseView('radar')}><span>{viewCopy.longformRadar.label}</span><small>{viewCopy.longformRadar.hint}</small></button>
      <button type="button" role="tab" className={view === 'short-radar' ? 'active' : ''} aria-selected={view === 'short-radar'} onClick={() => chooseView('short-radar')}><span>{viewCopy.shortformRadar.label}</span><small>{viewCopy.shortformRadar.hint}</small></button>
      <button type="button" role="tab" className={view === 'all-radar' ? 'active' : ''} aria-selected={view === 'all-radar'} onClick={() => chooseView('all-radar')}><span>{viewCopy.overview.label}</span><small>{viewCopy.overview.hint}</small></button>
    </nav>
    {view !== 'radar' && <div className="longform-research-boundary"><span>{allRadar ? (zh ? '内容范围边界' : 'CONTENT SCOPE') : zh ? '同一张研究桌 · 四种不同任务' : 'ONE DESK · FOUR DISTINCT JOBS'}</span><p>{allRadar ? (zh ? '信号总览只是扫描入口；长视频和 Shorts 仍沿各自基线、窗口和 guardrail 计算。' : 'The signal overview is only a scanning entry; long-form and Shorts still use their own baselines, windows, and guardrails.') : view === 'opportunities' ? (zh ? '当前任务：长视频赛道评估。市场机会、执行适配和进入分只回答长期制作价值。' : 'Current job: Long-form Niche Evaluation. Market, execution, and entry scores answer durable making value only.') : (zh ? '当前任务：Shorts 趋势雷达。只读取 Shorts 样本，独立计算跨频道扩散、突破和供给变化；原有 Shorts 产品保持不变。' : 'Current job: Shorts Trend Radar. It reads Shorts samples only and independently computes spread, breakout, and supply change; the existing Shorts product is unchanged.')}</p></div>}
    {view !== 'radar' && <div className="research-lens-grid" aria-label={zh ? '当前视角的判断顺序' : 'Decision order for this view'}>{decisionLenses.map(([label, body]) => <article key={label}><span>{label}</span><b>{body}</b></article>)}</div>}
    <section className="longform-research-content" aria-live="polite">
      {view === 'opportunities' ? <LongformOpportunities locale={locale} embedded /> : view === 'radar' ? <OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} onSwitchFormat={switchRadarFormat} /> : view === 'short-radar' ? <ShortformOpportunityRadar locale={locale} embedded onShortResearch={onShortResearch} onSwitchFormat={switchRadarFormat} /> : <AllOpportunityRadar locale={locale} onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} onShortResearch={onShortResearch} />}
    </section>
  </main>;
}

'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import LongformOpportunities from './longform-opportunities';
import ShortformOpportunityRadar from './shortform-opportunity-radar';
import AllOpportunityRadar from './all-opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';

type DeskView = 'opportunities' | 'radar' | 'short-radar' | 'all-radar';

type LongformResearchDeskProps = {
  locale: UiLocale;
  initialView: DeskView;
} & OpportunityRadarActions;

function setRoute(path: string) {
  if (typeof window === 'undefined' || window.location.pathname === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event('signalcraft:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export default function LongformResearchDesk({ locale, initialView, onWatch, onCreateIdea, onResearch }: LongformResearchDeskProps) {
  const zh = locale === 'zh';
  const view = initialView;
  const shortRadar = view === 'short-radar';
  const allRadar = view === 'all-radar';

  const chooseView = (next: DeskView) => {
    setRoute(next === 'radar' ? '/radar' : next === 'short-radar' ? '/short-radar' : next === 'all-radar' ? '/radar/all' : '/longform');
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
        <span className="longform-research-kicker">{allRadar ? 'ALL OPPORTUNITY SIGNALS' : shortRadar ? 'SHORT-FORM OPPORTUNITY DESK' : view === 'radar' ? 'OPPORTUNITY RADAR' : 'TRACK RESEARCH'}</span>
        <h1>{allRadar ? (zh ? '把全部机会信号分开看清楚。' : 'Read every opportunity signal without mixing universes.') : shortRadar ? (zh ? '把短视频机会放在变化发生之前。' : 'Read short-form opportunities before the change is obvious.') : view === 'radar' ? (zh ? '发现正在形成的机会变化。' : 'See opportunity changes while they are forming.') : (zh ? '把赛道长期价值拆成可验证的判断。' : 'Turn durable track value into verifiable decisions.')}</h1>
        <p>{allRadar ? (zh ? '全部视角同时读取长视频与 Shorts 两个独立引擎。它只帮助你扫描范围，不跨类型比较原始播放量或机会分。' : 'The all view reads two independent engines for scanning. It never compares raw views or opportunity scores across content types.') : shortRadar ? (zh ? '短视频机会雷达单独读取 Shorts 样本，观察跨频道扩散、中小频道突破和供给变化；原有 Shorts 榜单、筛选、历史与评分保持不变。' : 'The short-form radar reads Shorts samples separately to track cross-channel spread, creator breakouts and supply change; existing Shorts rankings, filters, history and scoring stay unchanged.') : view === 'radar' ? (zh ? '机会雷达只回答最近发生了什么变化：新兴、升温、突破、拥挤或回落。它不替代排行榜，也不复用赛道机会分。' : 'Opportunity Radar answers what changed recently: emerging, heating up, breaking out, crowded or declining. It does not replace Rankings or reuse Track Opportunity scores.') : (zh ? '赛道研究回答这个方向是否值得长期制作，并展示市场机会、执行适配、证据覆盖与代表视频；近期变化请切换到机会雷达。' : 'Track Research answers whether a direction is worth making over time, with market opportunity, execution fit, evidence coverage and representative videos; switch to Opportunity Radar for recent change.')}</p>
      </div>
      <div className="longform-research-stamp" aria-label={zh ? '三个独立研究视角' : 'Three independent research lenses'}><b>03</b><span>{zh ? '独立研究视角' : 'research lenses'}</span><i /></div>
    </header>
    <nav className="longform-research-tabs" aria-label={zh ? '研究视角' : 'Research views'}>
      <button type="button" role="tab" className={view === 'opportunities' ? 'active' : ''} aria-selected={view === 'opportunities'} onClick={() => chooseView('opportunities')}><span>{zh ? '赛道研究' : 'Track Research'}</span><small>{zh ? '看长期是否值得做' : 'Durable direction'}</small></button>
      <button type="button" role="tab" className={view === 'radar' ? 'active' : ''} aria-selected={view === 'radar'} onClick={() => chooseView('radar')}><span>{zh ? '机会雷达' : 'Opportunity Radar'}</span><small>{zh ? '看最近发生了什么变化' : 'Recent change'}</small></button>
      <button type="button" role="tab" className={view === 'short-radar' ? 'active' : ''} aria-selected={view === 'short-radar'} onClick={() => chooseView('short-radar')}><span>{zh ? '短视频机会雷达' : 'Short-form Opportunity Radar'}</span><small>{zh ? 'Shorts 独立引擎' : 'Shorts-only engine'}</small></button>
      <button type="button" role="tab" className={view === 'all-radar' ? 'active' : ''} aria-selected={view === 'all-radar'} onClick={() => chooseView('all-radar')}><span>{zh ? '全部机会' : 'All signals'}</span><small>{zh ? '分开读取两种形态' : 'Separate feeds'}</small></button>
    </nav>
    {view !== 'radar' && <div className="longform-research-boundary"><span>{allRadar ? (zh ? '内容范围边界' : 'CONTENT SCOPE') : zh ? '同一张研究桌 · 三条判断链' : 'ONE DESK · THREE DECISION CHAINS'}</span><p>{allRadar ? (zh ? '全部视角只是扫描入口；长视频和 Shorts 仍沿各自基线、窗口和 guardrail 计算。' : 'All is a scanning entry point; long-form and Shorts still use their own baselines, windows and guardrails.') : view === 'opportunities' ? (zh ? '当前视角：赛道研究。市场机会、执行适配和进入分只回答长期制作价值。' : 'Current view: Track Research. Market, execution, and entry scores answer long-term making value.') : (zh ? '当前视角：短视频机会雷达。只读取 Shorts 样本，独立计算跨频道扩散、突破和供给变化；原有 Shorts 产品保持不变。' : 'Current view: short-form opportunity radar. It reads Shorts samples only and computes spread, breakout and supply signals independently; the existing Shorts product is unchanged.')}</p></div>}
    {view !== 'radar' && <div className="research-lens-grid" aria-label={zh ? '当前视角的判断顺序' : 'Decision order for this view'}>{decisionLenses.map(([label, body]) => <article key={label}><span>{label}</span><b>{body}</b></article>)}</div>}
    <section className="longform-research-content" aria-live="polite">
      {view === 'opportunities' ? <LongformOpportunities locale={locale} embedded /> : view === 'radar' ? <OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} /> : view === 'short-radar' ? <ShortformOpportunityRadar locale={locale} embedded /> : <AllOpportunityRadar locale={locale} onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} />}
    </section>
  </main>;
}

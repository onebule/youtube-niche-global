'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import LongformOpportunities from './longform-opportunities';
import ShortformOpportunityRadar from './shortform-opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';

type DeskView = 'opportunities' | 'radar' | 'short-radar';

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

  const chooseView = (next: DeskView) => {
    setRoute(next === 'radar' ? '/radar' : next === 'short-radar' ? '/short-radar' : '/longform');
  };

  const decisionLenses: Array<[string, string]> = shortRadar
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

  return <main className="longform-research-desk">
    <header className="longform-research-header">
      <div>
        <span className="longform-research-kicker">{shortRadar ? 'SHORT-FORM OPPORTUNITY DESK' : view === 'radar' ? 'OPPORTUNITY RADAR' : 'TRACK RESEARCH'}</span>
        <h1>{shortRadar ? (zh ? '把短视频机会放在变化发生之前。' : 'Read short-form opportunities before the change is obvious.') : view === 'radar' ? (zh ? '发现正在形成的机会变化。' : 'See opportunity changes while they are forming.') : (zh ? '把赛道长期价值拆成可验证的判断。' : 'Turn durable track value into verifiable decisions.')}</h1>
        <p>{shortRadar ? (zh ? '短视频机会雷达单独读取 Shorts 样本，观察跨频道扩散、中小频道突破和供给变化；原有 Shorts 榜单、筛选、历史与评分保持不变。' : 'The short-form radar reads Shorts samples separately to track cross-channel spread, creator breakouts and supply change; existing Shorts rankings, filters, history and scoring stay unchanged.') : view === 'radar' ? (zh ? '机会雷达只回答最近发生了什么变化：新兴、升温、突破、拥挤或回落。它不替代排行榜，也不复用赛道机会分。' : 'Opportunity Radar answers what changed recently: emerging, heating up, breaking out, crowded or declining. It does not replace Rankings or reuse Track Opportunity scores.') : (zh ? '赛道研究回答这个方向是否值得长期制作，并展示市场机会、执行适配、证据覆盖与代表视频；近期变化请切换到机会雷达。' : 'Track Research answers whether a direction is worth making over time, with market opportunity, execution fit, evidence coverage and representative videos; switch to Opportunity Radar for recent change.')}</p>
      </div>
      <div className="longform-research-stamp" aria-label={zh ? '三个独立研究视角' : 'Three independent research lenses'}><b>03</b><span>{zh ? '独立研究视角' : 'research lenses'}</span><i /></div>
    </header>
    <nav className="longform-research-tabs" aria-label={zh ? '研究视角' : 'Research views'}>
      <button type="button" role="tab" className={view === 'opportunities' ? 'active' : ''} aria-selected={view === 'opportunities'} onClick={() => chooseView('opportunities')}><span>{zh ? '赛道研究' : 'Track Research'}</span><small>{zh ? '看长期是否值得做' : 'Durable direction'}</small></button>
      <button type="button" role="tab" className={view === 'radar' ? 'active' : ''} aria-selected={view === 'radar'} onClick={() => chooseView('radar')}><span>{zh ? '机会雷达' : 'Opportunity Radar'}</span><small>{zh ? '看最近发生了什么变化' : 'Recent change'}</small></button>
      <button type="button" role="tab" className={view === 'short-radar' ? 'active' : ''} aria-selected={view === 'short-radar'} onClick={() => chooseView('short-radar')}><span>{zh ? '短视频机会雷达' : 'Short-form Opportunity Radar'}</span><small>{zh ? 'Shorts 独立引擎' : 'Shorts-only engine'}</small></button>
    </nav>
    <div className="longform-research-boundary"><span>{zh ? '同一张研究桌 · 三条判断链' : 'ONE DESK · THREE DECISION CHAINS'}</span><p>{view === 'opportunities' ? (zh ? '当前视角：赛道研究。市场机会、执行适配和进入分只回答长期制作价值。' : 'Current view: Track Research. Market, execution, and entry scores answer long-term making value.') : view === 'radar' ? (zh ? '当前视角：机会雷达。Why Now、历史基线和跨频道证据只回答长视频最近变化。' : 'Current view: Opportunity Radar. Why Now, historical baselines, and cross-channel proof answer recent long-form change.') : (zh ? '当前视角：短视频机会雷达。只读取 Shorts 样本，独立计算跨频道扩散、突破和供给变化；原有 Shorts 产品保持不变。' : 'Current view: short-form opportunity radar. It reads Shorts samples only and computes spread, breakout and supply signals independently; the existing Shorts product is unchanged.')}</p></div>
    <div className="research-lens-grid" aria-label={zh ? '当前视角的判断顺序' : 'Decision order for this view'}>{decisionLenses.map(([label, body]) => <article key={label}><span>{label}</span><b>{body}</b></article>)}</div>
    <section className="longform-research-content" aria-live="polite">
      {view === 'opportunities' ? <LongformOpportunities locale={locale} embedded /> : view === 'radar' ? <OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch} /> : <ShortformOpportunityRadar locale={locale} embedded />}
    </section>
  </main>;
}

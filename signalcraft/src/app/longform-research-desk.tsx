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

export default function LongformResearchDesk({ locale, initialView, onWatch, onCreateIdea }: LongformResearchDeskProps) {
  const zh = locale === 'zh';
  const view = initialView;
  const shortRadar = view === 'short-radar';

  const chooseView = (next: DeskView) => {
    setRoute(next === 'radar' ? '/radar' : next === 'short-radar' ? '/short-radar' : '/longform');
  };

  return <main className="longform-research-desk">
    <header className="longform-research-header">
      <div>
        <span className="longform-research-kicker">{shortRadar ? 'SHORT-FORM OPPORTUNITY DESK' : 'LONG-FORM RESEARCH DESK'}</span>
        <h1>{shortRadar ? (zh ? '把短视频机会放在变化发生之前。' : 'Read short-form opportunities before the change is obvious.') : (zh ? '把长期机会和近期变化放在一起判断。' : 'Read long-form opportunity and change in one desk.')}</h1>
        <p>{shortRadar ? (zh ? '短视频机会雷达单独读取 Shorts 样本，观察跨频道扩散、中小频道突破和供给变化；原有 Shorts 榜单、筛选、历史与评分保持不变。' : 'The short-form radar reads Shorts samples separately to track cross-channel spread, creator breakouts and supply change; existing Shorts rankings, filters, history and scoring stay unchanged.') : (zh ? '先用长视频机会判断哪个方向值得长期制作，再用机会雷达确认最近是否正在形成、突破或拥挤。两套引擎共用公开长视频样本，但评分和证据链保持独立。' : 'Use Long-form Opportunities to choose durable directions, then use Opportunity Radar to see what is forming, breaking out, or getting crowded now. Both read public long-form samples, while scores and evidence chains stay separate.')}</p>
      </div>
      <div className="longform-research-stamp" aria-label={zh ? '三个独立研究视角' : 'Three independent research lenses'}><b>03</b><span>{zh ? '独立研究视角' : 'research lenses'}</span><i /></div>
    </header>
    <nav className="longform-research-tabs" aria-label={zh ? '研究视角' : 'Research views'}>
      <button type="button" role="tab" className={view === 'opportunities' ? 'active' : ''} aria-selected={view === 'opportunities'} onClick={() => chooseView('opportunities')}><span>{zh ? '长视频机会' : 'Long-form Opportunities'}</span><small>{zh ? '看整体是否值得做' : 'Durable direction'}</small></button>
      <button type="button" role="tab" className={view === 'radar' ? 'active' : ''} aria-selected={view === 'radar'} onClick={() => chooseView('radar')}><span>{zh ? '长视频机会雷达' : 'Long-form Opportunity Radar'}</span><small>{zh ? '看最近长视频发生了什么' : 'Recent long-form change'}</small></button>
      <button type="button" role="tab" className={view === 'short-radar' ? 'active' : ''} aria-selected={view === 'short-radar'} onClick={() => chooseView('short-radar')}><span>{zh ? '短视频机会雷达' : 'Short-form Opportunity Radar'}</span><small>{zh ? 'Shorts 独立引擎' : 'Shorts-only engine'}</small></button>
    </nav>
    <div className="longform-research-boundary"><span>{zh ? '同一张研究桌 · 三条判断链' : 'ONE DESK · THREE DECISION CHAINS'}</span><p>{view === 'opportunities' ? (zh ? '当前视角：长期机会。市场机会、执行适配和进入分只回答长期制作价值。' : 'Current view: durable opportunity. Market, execution, and entry scores answer long-term making value.') : view === 'radar' ? (zh ? '当前视角：长视频机会雷达。Why Now、历史基线和跨频道证据只回答长视频最近变化。' : 'Current view: long-form opportunity radar. Why Now, historical baselines, and cross-channel proof answer recent long-form change.') : (zh ? '当前视角：短视频机会雷达。只读取 Shorts 样本，独立计算跨频道扩散、突破和供给变化；原有 Shorts 产品保持不变。' : 'Current view: short-form opportunity radar. It reads Shorts samples only and computes spread, breakout and supply signals independently; the existing Shorts product is unchanged.')}</p></div>
    <section className="longform-research-content" aria-live="polite">
      {view === 'opportunities' ? <LongformOpportunities locale={locale} embedded /> : view === 'radar' ? <OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} /> : <ShortformOpportunityRadar locale={locale} embedded />}
    </section>
  </main>;
}

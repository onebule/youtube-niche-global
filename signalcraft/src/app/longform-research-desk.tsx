'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import LongformOpportunities from './longform-opportunities';
import type { UiLocale } from '@/src/lib/ui-language';

type DeskView = 'opportunities' | 'radar';

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

  const chooseView = (next: DeskView) => {
    setRoute(next === 'radar' ? '/radar' : '/longform');
  };

  return <main className="longform-research-desk">
    <header className="longform-research-header">
      <div>
        <span className="longform-research-kicker">LONG-FORM RESEARCH DESK</span>
        <h1>{zh ? '把长期机会和近期变化放在一起判断。' : 'Read long-form opportunity and change in one desk.'}</h1>
        <p>{zh ? '先用长视频机会判断哪个方向值得长期制作，再用机会雷达确认最近是否正在形成、突破或拥挤。两套引擎共用公开长视频样本，但评分和证据链保持独立。' : 'Use Long-form Opportunities to choose durable directions, then use Opportunity Radar to see what is forming, breaking out, or getting crowded now. Both read public long-form samples, while scores and evidence chains stay separate.'}</p>
      </div>
      <div className="longform-research-stamp" aria-label={zh ? '两个独立研究视角' : 'Two independent research lenses'}><b>02</b><span>{zh ? '独立研究视角' : 'research lenses'}</span><i /></div>
    </header>
    <nav className="longform-research-tabs" aria-label={zh ? '长视频研究视角' : 'Long-form research views'}>
      <button type="button" role="tab" className={view === 'opportunities' ? 'active' : ''} aria-selected={view === 'opportunities'} onClick={() => chooseView('opportunities')}><span>{zh ? '长视频机会' : 'Long-form Opportunities'}</span><small>{zh ? '看整体是否值得做' : 'Durable direction'}</small></button>
      <button type="button" role="tab" className={view === 'radar' ? 'active' : ''} aria-selected={view === 'radar'} onClick={() => chooseView('radar')}><span>{zh ? '长视频机会雷达' : 'Long-form Opportunity Radar'}</span><small>{zh ? '看最近长视频发生了什么' : 'Recent long-form change'}</small></button>
    </nav>
    <div className="longform-research-boundary"><span>{zh ? '同一张研究桌 · 两条判断链' : 'ONE DESK · TWO DECISION CHAINS'}</span><p>{view === 'opportunities' ? (zh ? '当前视角：长期机会。市场机会、执行适配和进入分只回答长期制作价值。' : 'Current view: durable opportunity. Market, execution, and entry scores answer long-term making value.') : (zh ? '当前视角：长视频机会雷达。Why Now、历史基线和跨频道证据只回答长视频最近变化。' : 'Current view: long-form opportunity radar. Why Now, historical baselines, and cross-channel proof answer recent long-form change.')}</p></div>
    <section className="longform-research-content" aria-live="polite">
      {view === 'opportunities' ? <LongformOpportunities locale={locale} embedded /> : <OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} />}
    </section>
  </main>;
}

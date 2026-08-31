'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import ShortformOpportunityRadar from './shortform-opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';

/**
 * The all-scope view deliberately keeps two feeds instead of merging scores.
 * Shorts and long-form use different universes, baselines and guardrails; a
 * shared shell must not imply that their raw views or signals are comparable.
 */
export default function AllOpportunityRadar({ locale, onWatch, onCreateIdea, onResearch }: { locale: UiLocale } & OpportunityRadarActions) {
  const zh = locale === 'zh';
  return <section className="all-radar-page" aria-label={zh ? '全部机会雷达' : 'All opportunity radar'}>
    <header className="all-radar-boundary"><div><span className="longform-research-kicker">ALL SIGNALS · SEPARATE UNIVERSES</span><h2>{zh ? '全部机会信号，分开看清楚。' : 'All opportunity signals, kept legible.'}</h2><p>{zh ? '这里同时读取长视频与 Shorts 两个独立引擎；不把不同内容形态的播放量、窗口或机会分直接混排。' : 'This view reads the long-form and Shorts engines together without mixing their views, windows or opportunity scores.'}</p></div><div className="all-radar-legend"><span><i className="long" />{zh ? '长视频 · Opportunity Signal' : 'Long-form · Opportunity Signal'}</span><span><i className="short" />{zh ? '短视频 · Opportunity Signal' : 'Short-form · Opportunity Signal'}</span></div></header>
    <section className="all-radar-feed all-radar-feed-long"><header><div><span className="longform-research-kicker">LONG-FORM</span><h3>{zh ? '长视频机会雷达' : 'Long-form opportunity radar'}</h3></div><span>{zh ? '持续需求 · 供需缺口 · 中小频道' : 'Sustained demand · supply gap · small creators'}</span></header><OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch}/></section>
    <section className="all-radar-feed all-radar-feed-short"><header><div><span className="longform-research-kicker">SHORT-FORM</span><h3>{zh ? '短视频机会雷达' : 'Short-form opportunity radar'}</h3></div><span>{zh ? '扩散 · 突破 · 供给变化' : 'Spread · breakout · supply change'}</span></header><ShortformOpportunityRadar locale={locale} embedded/></section>
  </section>;
}

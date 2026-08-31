'use client';

import OpportunityRadar, { type OpportunityRadarActions } from './opportunity-radar';
import ShortformOpportunityRadar, { type ShortformRadarActions } from './shortform-opportunity-radar';
import type { UiLocale } from '@/src/lib/ui-language';

/**
 * The all-scope view deliberately keeps two feeds instead of merging scores.
 * Shorts and long-form use different universes, baselines and guardrails; a
 * shared shell must not imply that their raw views or signals are comparable.
 */
export default function AllOpportunityRadar({ locale, onWatch, onCreateIdea, onResearch, onShortResearch }: { locale: UiLocale } & OpportunityRadarActions & ShortformRadarActions) {
  const zh = locale === 'zh';
  return <section className="all-radar-page" aria-label={zh ? '双形态信号总览' : 'Cross-format signal overview'}>
    <header className="all-radar-boundary"><div><span className="longform-research-kicker">CROSS-FORMAT SIGNALS · SEPARATE UNIVERSES</span><h2>{zh ? '两种内容形态，并列查看。' : 'Two content formats, read side by side.'}</h2><p>{zh ? '这里同时读取长视频与 Shorts 两个独立引擎；不把不同内容形态的播放量、窗口或评分直接混排。' : 'This view reads the long-form and Shorts engines together without mixing their views, windows, or scores.'}</p></div><div className="all-radar-legend"><span><i className="long" />{zh ? '长视频 · 趋势事件' : 'Long-form · trend events'}</span><span><i className="short" />{zh ? 'Shorts · 趋势事件' : 'Shorts · trend events'}</span></div></header>
    <section className="all-radar-feed all-radar-feed-long"><header><div><span className="longform-research-kicker">LONG-FORM</span><h3>{zh ? '长视频趋势信号' : 'Long-form trend signals'}</h3></div><span>{zh ? '新兴 · 升温 · 突破 · 拥挤 · 回落' : 'Emerging · heating · breakout · crowded · decline'}</span></header><OpportunityRadar locale={locale} embedded onWatch={onWatch} onCreateIdea={onCreateIdea} onResearch={onResearch}/></section>
    <section className="all-radar-feed all-radar-feed-short"><header><div><span className="longform-research-kicker">SHORTS</span><h3>{zh ? 'Shorts 趋势信号' : 'Shorts trend signals'}</h3></div><span>{zh ? '扩散 · 突破 · 供给变化' : 'Spread · breakout · supply change'}</span></header><ShortformOpportunityRadar locale={locale} embedded onShortResearch={onShortResearch}/></section>
  </section>;
}

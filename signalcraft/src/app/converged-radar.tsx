'use client';

import { useEffect, useState } from 'react';
import { fetchOpportunityRadar } from '@/src/lib/opportunity-radar';
import { fetchShortformOpportunityRadar } from '@/src/lib/shortform-opportunity-radar';
import { fromRadar, type ContentFormat, type OpportunityUnit } from '@/src/lib/product-convergence';
import { buildNicheEvaluationHref, readNicheAnalysisContext, saveNicheAnalysisContext, type NicheAnalysisContext } from '@/src/lib/niche-analysis-context';
import { clientErrorMessage } from '@/src/lib/client-error';
import { CreatorProfileFilters, DiscoveryCards, GoldenPath, useCreatorProfile } from './discovery-workbench';
import type { UiLocale } from '@/src/lib/ui-language';

export function discoveryNavigate(path: string) {
  window.history.pushState({}, '', path); window.dispatchEvent(new Event('signalcraft:navigate')); window.scrollTo({ top: 0 });
}
type Feed = { loading: boolean; units: OpportunityUnit[]; error: string | null; gaps: string[]; scope?: string };
const empty: Feed = { loading: true, units: [], error: null, gaps: [] };
export default function ConvergedRadar({ locale, format }: { locale: UiLocale; format: ContentFormat | 'ALL' }) {
  const zh = locale === 'zh'; const { profile } = useCreatorProfile();
  const [market, setMarket] = useState('all'); const [timeWindow, setWindow] = useState<'7d' | '14d' | '30d'>('14d');
  const [ready, setReady] = useState(false); const [refresh, setRefresh] = useState(0);
  const [feeds, setFeeds] = useState<Record<ContentFormat, Feed>>({ SHORTS: empty, LONG_FORM: empty });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search); const previous = params.get('restore') === '1' ? readNicheAnalysisContext() : null;
    const rawMarket = previous?.returnState?.filters?.market || params.get('market');
    const rawWindow = previous?.timeWindow || params.get('window');
    const timer = setTimeout(() => { if (typeof rawMarket === 'string') setMarket(rawMarket); if (rawWindow === '7d' || rawWindow === '14d' || rawWindow === '30d') setWindow(rawWindow); setReady(true); }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const formats: ContentFormat[] = format === 'ALL' ? ['SHORTS', 'LONG_FORM'] : [format];
    const timer = setTimeout(() => {
      for (const scope of formats) {
        setFeeds(previous => ({ ...previous, [scope]: empty }));
        const request = scope === 'SHORTS' ? fetchShortformOpportunityRadar : fetchOpportunityRadar;
        void request({ market, window: timeWindow, limit: 500 }, { signal: controller.signal }).then(data => {
          if (controller.signal.aborted) return;
          setFeeds(previous => ({ ...previous, [scope]: { loading: false, units: data.available ? data.events.map(event => fromRadar(event, scope)) : [], error: !data.available ? (zh ? '当前数据服务没有可用结果。' : 'The data service has no available result.') : null, gaps: data.gaps, scope: zh ? `本期 ${data.dataScope.currentRows} 条样本 · 历史 ${data.dataScope.historicalRows} 条 · 最近采集 ${data.dataScope.latestCapturedAt || '未提供'}` : `Current rows: ${data.dataScope.currentRows} · Historical rows: ${data.dataScope.historicalRows} · Captured: ${data.dataScope.latestCapturedAt || 'unavailable'}` } }));
        }).catch(error => { if (!controller.signal.aborted) setFeeds(previous => ({ ...previous, [scope]: { ...empty, loading: false, error: clientErrorMessage(error, zh ? '暂时无法读取市场数据。' : 'Market data is unavailable.') } })); });
      }
    }, 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [ready, format, market, timeWindow, refresh, zh]);
  const evaluate = (unit: OpportunityUnit) => {
    const context: NicheAnalysisContext = { nicheId: unit.id, nicheName: unit.niche, topicName: unit.niche,
      contentType: unit.format === 'SHORTS' ? 'SHORT_FORM' : 'LONG_FORM', platformType: 'YOUTUBE', format: unit.pattern?.label,
      timeWindow: `${unit.market.windowDays || 14}d`, source: 'TREND_RADAR', confidence: unit.market.confidence,
      filters: { market, window: timeWindow }, trendSignals: { lifecycle: unit.market.lifecycle, facts: unit.market.facts },
      discovery: { unit, creatorProfile: profile }, returnState: { scrollPosition: window.scrollY, filters: { market, window: timeWindow }, activeTab: 'PERSONAL' } };
    saveNicheAnalysisContext(context); discoveryNavigate(buildNicheEvaluationHref(context));
  };
  const visible: ContentFormat[] = format === 'ALL' ? ['SHORTS', 'LONG_FORM'] : [format];
  return <main className="discovery-workbench"><GoldenPath step={0} locale={locale}/><header className="discovery-header"><span className="discovery-eyebrow">DISCOVERY · {zh ? '从第一条有效信号开始' : 'START WITH A GROUNDED SIGNAL'}</span><h1>{zh ? '找到值得你验证的方向。' : 'Find a direction worth testing.'}</h1><p>{zh ? '先看市场证据，再判断对你是否适合。推荐只是起点，不是收益或成功承诺。' : 'Start with market evidence, then assess your fit. Recommendations are starting points, not promises.'}</p></header>
    <nav className="discovery-format" aria-label={zh ? '内容形态' : 'Content format'}>{[['ALL', '全部', 'All'], ['SHORTS', 'Shorts', 'Shorts'], ['LONG_FORM', '长视频', 'Long-form']].map(([key, cn, en]) => <button key={key} type="button" aria-pressed={format === key} onClick={() => discoveryNavigate(`${key === 'ALL' ? '/radar/all' : key === 'SHORTS' ? '/short-radar' : '/radar'}?market=${encodeURIComponent(market)}&window=${timeWindow}`)}>{zh ? cn : en}</button>)}</nav>
    <CreatorProfileFilters locale={locale}/><div className="discovery-toolbar"><label>{zh ? '市场' : 'Market'}<select value={market} onChange={e => setMarket(e.target.value)}><option value="all">{zh ? '全部采集市场' : 'All collected markets'}</option>{['US', 'GB', 'IN', 'JP', 'BR'].map(value => <option key={value}>{value}</option>)}</select></label><label>{zh ? '观察窗口' : 'Window'}<select value={timeWindow} onChange={e => setWindow(e.target.value as typeof timeWindow)}><option value="7d">7 {zh ? '天' : 'days'}</option><option value="14d">14 {zh ? '天' : 'days'}</option><option value="30d">30 {zh ? '天' : 'days'}</option></select></label><button type="button" onClick={() => setRefresh(value => value + 1)} disabled={!ready || visible.some(scope => feeds[scope].loading)}>{zh ? '更新证据' : 'Refresh evidence'}</button></div>
    {format === 'ALL' && <p className="discovery-caption">{zh ? '全部仅汇总浏览：Shorts 与长视频独立取数、独立筛选，不混排原始评分。选择形态后查看个性化推荐。' : 'All is an aggregate browser: independent feeds and thresholds, no cross-format score ranking. Choose a format for recommendations.'}</p>}
    {visible.map(scope => <section key={scope} className="discovery-format-feed"><h2>{scope === 'SHORTS' ? 'Shorts' : (zh ? '长视频' : 'Long-form')}</h2>{feeds[scope].scope && !feeds[scope].loading && <p className="discovery-caption">{feeds[scope].scope}</p>}{feeds[scope].loading ? <p role="status">{zh ? '正在读取真实市场证据…' : 'Loading market evidence…'}</p> : feeds[scope].error ? <p role="alert" className="discovery-error">{feeds[scope].error}</p> : <DiscoveryCards units={feeds[scope].units} format={scope} locale={locale} onEvaluate={evaluate} marketOnly={format === 'ALL'}/>}<details className="decision-evidence"><summary>{zh ? '数据范围与缺口' : 'Data scope and gaps'}</summary>{feeds[scope].gaps.map(gap => <p key={gap}>{gap}</p>)}<p>{zh ? '只读公开数据。没有每卡 AI 请求，也不会自动启动制作。' : 'Public data only. No per-card AI calls or automatic production.'}</p></details></section>)}
  </main>;
}

import { interpolate, languageCopy, type UiLocale } from '@/src/lib/ui-language';
import type { PublicRankingScope } from '@/src/lib/youtube';

export default function RankingDataScope({ scope, locale }: { scope: PublicRankingScope; locale: UiLocale }) {
  const copy = languageCopy[locale].ranking;
  const capturedAt = scope.latestCapturedAt && Number.isFinite(new Date(scope.latestCapturedAt).getTime())
    ? new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(scope.latestCapturedAt))
    : null;
  const freshnessMessage = scope.freshness === 'verified'
    ? (locale === 'zh' ? '已向 YouTube 实时核验' + (scope.revalidatedCount ? ' ' + scope.revalidatedCount + ' 条候选' : '') : 'Verified with YouTube' + (scope.revalidatedCount ? ' for ' + scope.revalidatedCount + ' candidates' : ''))
    : (locale === 'zh' ? '展示上次成功采集的公开快照' : 'Showing the last successful public capture');

  return <section className="ranking-data-scope" aria-label={copy.scopeLabel} aria-live="polite">
    <div><span className="eyebrow">{copy.scopeEyebrow}</span><b>{scope.source === 'stored-corpus' ? copy.storedCorpus : copy.liveChart}</b><p>{scope.source === 'stored-corpus' ? copy.storedCorpusDescription : copy.liveChartDescription}</p></div>
    <ul><li>{freshnessMessage}</li><li>{interpolate(copy.scopeMarkets, { count: scope.marketCount })}</li>{scope.source === 'stored-corpus' && <li>{interpolate(copy.scopeCollectionWindow, { days: scope.collectionLookbackDays })}</li>}<li>{interpolate(copy.scopePublishedWindow, { days: scope.publishedWindowDays })}</li>{scope.source === 'stored-corpus' && <li>{scope.growthComparableCount ? interpolate(copy.scopeGrowthComparable, { count: scope.growthComparableCount }) : copy.scopeGrowthWaiting}</li>}<li>{capturedAt ? <time dateTime={scope.latestCapturedAt!}>{interpolate(copy.scopeUpdatedAt, { time: capturedAt })}</time> : copy.scopeLiveNow}</li></ul>
  </section>;
}

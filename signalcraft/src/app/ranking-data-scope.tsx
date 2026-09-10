import { deriveRankingTrust, type RankingConfidence, type RankingCoverageStatus } from '@/src/lib/ranking-trust';
import type { UiLocale } from '@/src/lib/ui-language';
import type { PublicRankingScope } from '@/src/lib/youtube';

const coverageLabel: Record<RankingCoverageStatus, Record<UiLocale, string>> = {
  FULL: { zh: '完整覆盖', en: 'Full coverage' },
  PARTIAL: { zh: '部分覆盖', en: 'Partial coverage' },
  LIMITED: { zh: '数据有限', en: 'Limited data' },
};

const confidenceLabel: Record<RankingConfidence, Record<UiLocale, string>> = {
  HIGH: { zh: '高', en: 'High' },
  MEDIUM: { zh: '中', en: 'Medium' },
  LOW: { zh: '低', en: 'Low' },
};

function sourceCopy(scope: PublicRankingScope, source: ReturnType<typeof deriveRankingTrust>['source'], locale: UiLocale) {
  if (locale === 'en') {
    if (source === 'LIVE') return { label: 'Live YouTube public data', description: 'This result was read from the current public chart.' };
    if (source === 'STORED_WITH_LIVE_ENRICHMENT') return { label: 'Stored public data + live verification', description: 'Stored records were rechecked with YouTube before this result was shown.' };
    if (scope.source === 'longform_video_features') return { label: 'Dedicated long-form collection', description: 'This result comes from the latest successful long-form collection.' };
    return { label: 'Last successful public snapshot', description: 'The result remains available from a previously successful public collection.' };
  }
  if (source === 'LIVE') return { label: 'YouTube 实时公开数据', description: '当前结果来自本次对公开榜单的读取。' };
  if (source === 'STORED_WITH_LIVE_ENRICHMENT') return { label: '已采集公开数据 + 实时核验', description: '已收录样本在展示前已向 YouTube 重新核验。' };
  if (scope.source === 'longform_video_features') return { label: '独立长视频采集样本', description: '当前结果来自最近一次成功的长视频采集。' };
  return { label: '最近成功采集快照', description: '当前结果保留自上一次成功采集的公开数据。' };
}

function formatCapturedAt(value: string | null, locale: UiLocale) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return locale === 'zh' ? '未提供' : 'Not provided';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function emptyStateCopy(state: ReturnType<typeof deriveRankingTrust>['emptyState'], locale: UiLocale) {
  if (!state) return null;
  const copy = {
    NO_MATCH: { zh: '当前已收录样本中，没有视频满足这组筛选条件。', en: 'No recorded public video matches this filter.' },
    DATA_LIMITED: { zh: '当前筛选范围内的已收录样本不足，暂不能给出稳定排名。', en: 'The recorded sample is insufficient for a stable ranking in this scope.' },
    DATA_STALE: { zh: '当前可用快照较早，暂不将它当作最新榜单。', en: 'The available snapshot is older and is not presented as the latest ranking.' },
    LIVE_UPDATE_FAILED: { zh: '实时补充暂不可用，当前没有可展示的最近成功采集结果。', en: 'Live enrichment is unavailable and there is no recent successful result to show.' },
  } as const;
  return copy[state][locale];
}

export default function RankingDataScope({ scope, locale, resultCount, comparableGrowthCount }: {
  scope: PublicRankingScope;
  locale: UiLocale;
  resultCount: number;
  comparableGrowthCount: number;
}) {
  const trust = deriveRankingTrust({ scope, resultCount, comparableGrowthCount });
  const source = sourceCopy(scope, trust.source, locale);
  const emptyMessage = emptyStateCopy(trust.emptyState, locale);
  const isChinese = locale === 'zh';
  const countText = isChinese ? `当前筛选匹配 ${resultCount} 条已收录公开视频` : `${resultCount} recorded public videos match this filter`;
  const marketText = scope.markets.length ? scope.markets.join(' · ') : (isChinese ? '当前请求市场' : 'Requested market');

  return <section className="ranking-data-scope ranking-trust-layer" aria-label={isChinese ? '排行榜数据范围' : 'Ranking data scope'} aria-live="polite">
    <div className="ranking-trust-head">
      <div>
        <span className="eyebrow">DATA SCOPE · TRUST LAYER</span>
        <strong>{countText}</strong>
        <p>{source.description}</p>
      </div>
      <div className="ranking-trust-statuses">
        <span className={`ranking-trust-badge is-${trust.coverage.toLowerCase()}`}>{coverageLabel[trust.coverage][locale]}</span>
        <small>{isChinese ? `数据可信度：${confidenceLabel[trust.confidence][locale]}` : `Data confidence: ${confidenceLabel[trust.confidence][locale]}`}</small>
      </div>
    </div>
    <dl className="ranking-trust-facts">
      <div><dt>{isChinese ? '数据来源' : 'Source'}</dt><dd>{source.label}</dd></div>
      <div><dt>{isChinese ? '覆盖市场' : 'Markets'}</dt><dd>{marketText}</dd></div>
      <div><dt>{isChinese ? '分析窗口' : 'Window'}</dt><dd>{isChinese ? `近 ${scope.publishedWindowDays} 天` : `${scope.publishedWindowDays} days`}</dd></div>
      <div><dt>{isChinese ? '最后成功更新' : 'Last successful update'}</dt><dd><time dateTime={scope.latestCapturedAt || undefined}>{formatCapturedAt(scope.latestCapturedAt, locale)}</time></dd></div>
    </dl>
    {trust.liveUpdateFailed && !trust.emptyState && <p className="ranking-trust-notice">{isChinese ? '实时补充暂不可用，当前展示最近成功采集的数据。' : 'Live enrichment is unavailable; showing the most recent successful collection.'}</p>}
    {trust.stale && !emptyMessage && <p className="ranking-trust-notice is-stale">{isChinese ? '这批公开快照较早，建议点击“更新排行榜”重新核验。' : 'This public snapshot is older; refresh the ranking to recheck it.'}</p>}
    {emptyMessage && <p className="ranking-trust-notice" data-empty-state={trust.emptyState}>{emptyMessage}</p>}
    <details className="ranking-trust-details">
      <summary>{isChinese ? '数据详情' : 'Data details'}</summary>
      <div>
        <span>{isChinese ? `当前可比较增长：${trust.comparableCount} 条` : `Comparable growth: ${trust.comparableCount}`}</span>
        <span>{isChinese ? `本次返回：${scope.returnedCount ?? resultCount} 条` : `Returned: ${scope.returnedCount ?? resultCount}`}</span>
        <span>{isChinese ? `采集市场数：${scope.marketCount}` : `Markets collected: ${scope.marketCount}`}</span>
      </div>
    </details>
  </section>;
}

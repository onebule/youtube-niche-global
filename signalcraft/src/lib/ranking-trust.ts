import type { PublicRankingScope } from './youtube.ts';

export const RANKING_SNAPSHOT_MAX_AGE_HOURS = 36;

export type RankingCoverageStatus = 'FULL' | 'PARTIAL' | 'LIMITED';
export type RankingConfidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type RankingEmptyState = 'NO_MATCH' | 'DATA_LIMITED' | 'DATA_STALE' | 'LIVE_UPDATE_FAILED';

type RankingTrustInput = {
  scope: PublicRankingScope;
  resultCount: number;
  comparableGrowthCount: number;
  now?: number;
};

function validTimestamp(value: string | null | undefined) {
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function rankingSnapshotIsStale(scope: PublicRankingScope, now = Date.now()) {
  if (scope.freshness !== 'snapshot') return false;
  const capturedAt = validTimestamp(scope.latestCapturedAt);
  return capturedAt === null || now - capturedAt > RANKING_SNAPSHOT_MAX_AGE_HOURS * 60 * 60 * 1000;
}

export function deriveRankingTrust({ scope, resultCount, comparableGrowthCount, now }: RankingTrustInput) {
  const stale = rankingSnapshotIsStale(scope, now);
  const liveEnrichmentVerified = scope.liveEnrichmentStatus === 'VERIFIED';
  const liveUpdateFailed = scope.liveEnrichmentStatus === 'FAILED_USING_SNAPSHOT';
  const comparableCount = Math.max(0, Math.min(resultCount, comparableGrowthCount));
  // The service samples selected public markets, not the entire YouTube
  // population. Keep FULL as a possible contract value, but do not claim it
  // until a verified global-coverage signal exists.
  const coverage: RankingCoverageStatus = resultCount === 0 || stale ? 'LIMITED' : 'PARTIAL';
  const confidence: RankingConfidence = resultCount === 0 || stale || !scope.latestCapturedAt
    ? 'LOW'
    : (scope.freshness === 'verified' && comparableCount === resultCount && resultCount > 0 ? 'HIGH' : 'MEDIUM');
  const emptyState: RankingEmptyState | null = resultCount > 0
    ? null
    : liveUpdateFailed
      ? 'LIVE_UPDATE_FAILED'
      : stale
        ? 'DATA_STALE'
        : scope.corpusStatus === 'NO_MATCHING_STORED_RESULTS'
          ? 'DATA_LIMITED'
          : 'NO_MATCH';

  const source = scope.source === 'live-chart'
    ? 'LIVE'
    : scope.source === 'longform_video_features'
      ? 'LAST_SUCCESSFUL_SNAPSHOT'
      : liveEnrichmentVerified
        ? 'STORED_WITH_LIVE_ENRICHMENT'
        : scope.freshness === 'snapshot'
          ? 'LAST_SUCCESSFUL_SNAPSHOT'
          : 'STORED_CORPUS';

  return { coverage, confidence, emptyState, stale, comparableCount, liveUpdateFailed, source };
}

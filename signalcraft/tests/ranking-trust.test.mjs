import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRankingTrust, rankingSnapshotIsStale } from '../src/lib/ranking-trust.ts';

const capturedAt = '2026-09-10T00:00:00.000Z';
const scope = (patch = {}) => ({
  source: 'stored-corpus',
  markets: ['US', 'GB'],
  marketCount: 2,
  publishedWindowDays: 28,
  collectionLookbackDays: 56,
  latestCapturedAt: capturedAt,
  freshness: 'snapshot',
  corpusStatus: 'SAMPLED_RESULTS_AVAILABLE',
  liveEnrichmentStatus: 'NOT_REQUESTED',
  ...patch,
});

test('stored rankings stay conservatively partial without a global coverage claim', () => {
  const result = deriveRankingTrust({ scope: scope(), resultCount: 12, comparableGrowthCount: 3, now: Date.parse(capturedAt) + 60_000 });
  assert.equal(result.coverage, 'PARTIAL');
  assert.equal(result.confidence, 'MEDIUM');
  assert.equal(result.source, 'LAST_SUCCESSFUL_SNAPSHOT');
  assert.equal(result.emptyState, null);
});

test('only an actual successful revalidation may use the enriched source label', () => {
  const result = deriveRankingTrust({ scope: scope({ freshness: 'verified', liveEnrichmentStatus: 'VERIFIED' }), resultCount: 2, comparableGrowthCount: 2, now: Date.parse(capturedAt) + 60_000 });
  assert.equal(result.source, 'STORED_WITH_LIVE_ENRICHMENT');
  assert.equal(result.confidence, 'HIGH');
});

test('failed live enrichment preserves the snapshot and reports the correct empty state', () => {
  const result = deriveRankingTrust({ scope: scope({ liveEnrichmentStatus: 'FAILED_USING_SNAPSHOT' }), resultCount: 0, comparableGrowthCount: 0, now: Date.parse(capturedAt) + 60_000 });
  assert.equal(result.source, 'LAST_SUCCESSFUL_SNAPSHOT');
  assert.equal(result.emptyState, 'LIVE_UPDATE_FAILED');
  assert.equal(result.coverage, 'LIMITED');
});

test('a stale snapshot is limited data, not a failed generation or an invented live result', () => {
  const now = Date.parse(capturedAt) + 37 * 60 * 60 * 1000;
  assert.equal(rankingSnapshotIsStale(scope(), now), true);
  const result = deriveRankingTrust({ scope: scope(), resultCount: 1, comparableGrowthCount: 0, now });
  assert.equal(result.coverage, 'LIMITED');
  assert.equal(result.confidence, 'LOW');
  assert.equal(deriveRankingTrust({ scope: scope(), resultCount: 0, comparableGrowthCount: 0, now }).emptyState, 'DATA_STALE');
});

test('a missing stored corpus is shown as data limited rather than a false no-match', () => {
  const result = deriveRankingTrust({ scope: scope({ corpusStatus: 'NO_MATCHING_STORED_RESULTS' }), resultCount: 0, comparableGrowthCount: 0, now: Date.parse(capturedAt) + 60_000 });
  assert.equal(result.emptyState, 'DATA_LIMITED');
});

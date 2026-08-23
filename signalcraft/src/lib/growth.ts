import type { Video } from './types';

const MINIMUM_COMPARISON_HOURS = 12;

export type RecordedGrowth = {
  views: number;
  hours: number;
  viewsPerHour: number;
  baselineCapturedAt: string;
  currentCapturedAt: string;
};

/**
 * Derive a growth value only when this exact public video has two valid
 * captures far enough apart to be meaningful. One API response is never
 * converted into an invented "real-time" trend.
 */
export function getRecordedGrowth(video: Video): RecordedGrowth | null {
  const captures = [...video.snapshots]
    .map(snapshot => ({ ...snapshot, timestamp: new Date(snapshot.capturedAt).getTime() }))
    .filter(snapshot => Number.isFinite(snapshot.timestamp) && Number.isFinite(snapshot.views))
    .sort((a, b) => a.timestamp - b.timestamp);
  const current = captures.at(-1);
  if (!current) return null;

  const baseline = [...captures.slice(0, -1)].reverse().find(snapshot =>
    current.timestamp - snapshot.timestamp >= MINIMUM_COMPARISON_HOURS * 60 * 60 * 1000,
  );
  // Keep the browser-side rule consistent with the service: a downward
  // correction is not silently replaced with an older positive comparison.
  if (!baseline || current.views < baseline.views) return null;

  const hours = (current.timestamp - baseline.timestamp) / (60 * 60 * 1000);
  const views = current.views - baseline.views;
  return {
    views,
    hours,
    viewsPerHour: views / hours,
    baselineCapturedAt: baseline.capturedAt,
    currentCapturedAt: current.capturedAt,
  };
}

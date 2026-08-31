export type LongformIncomeScenarioInput = {
  targetUsd: number;
  rpmLowUsd: number | null;
  rpmHighUsd: number | null;
  videosPerMonth: number;
  baselineViewsPerVideo: number | null;
};

export type LongformIncomeScenario = {
  monthlyViewsLow: number | null;
  monthlyViewsHigh: number | null;
  viewsPerVideoLow: number | null;
  viewsPerVideoHigh: number | null;
  baselineVideosLow: number | null;
  baselineVideosHigh: number | null;
  rpmLowUsd: number | null;
  rpmHighUsd: number | null;
  isScenario: boolean;
};

const positive = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

/**
 * Calculates a transparent long-form income scenario. RPM is always user-supplied;
 * the function never chooses or estimates an RPM on the user's behalf.
 */
export function calculateLongformIncomeScenario(input: LongformIncomeScenarioInput): LongformIncomeScenario {
  const targetUsd = positive(input.targetUsd);
  const rpmValues = [positive(input.rpmLowUsd), positive(input.rpmHighUsd)].filter((value): value is number => value !== null).sort((a, b) => a - b);
  const rpmLowUsd = rpmValues[0] ?? null;
  const rpmHighUsd = rpmValues.at(-1) ?? null;
  const videosPerMonth = positive(input.videosPerMonth);
  const baselineViewsPerVideo = positive(input.baselineViewsPerVideo);
  if (targetUsd === null || rpmLowUsd === null || rpmHighUsd === null) {
    return { monthlyViewsLow: null, monthlyViewsHigh: null, viewsPerVideoLow: null, viewsPerVideoHigh: null, baselineVideosLow: null, baselineVideosHigh: null, rpmLowUsd, rpmHighUsd, isScenario: false };
  }
  const monthlyViewsLow = targetUsd / rpmHighUsd * 1000;
  const monthlyViewsHigh = targetUsd / rpmLowUsd * 1000;
  return {
    monthlyViewsLow,
    monthlyViewsHigh,
    viewsPerVideoLow: videosPerMonth === null ? null : monthlyViewsLow / videosPerMonth,
    viewsPerVideoHigh: videosPerMonth === null ? null : monthlyViewsHigh / videosPerMonth,
    baselineVideosLow: baselineViewsPerVideo === null ? null : monthlyViewsLow / baselineViewsPerVideo,
    baselineVideosHigh: baselineViewsPerVideo === null ? null : monthlyViewsHigh / baselineViewsPerVideo,
    rpmLowUsd,
    rpmHighUsd,
    isScenario: true,
  };
}

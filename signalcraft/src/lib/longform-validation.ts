import type { LongformOpportunity } from './longform';

export type LongformValidationPlan = {
  recommendedVideos: number | null;
  reason: 'READY_FOR_SMALL_TEST' | 'THIN_EVIDENCE' | 'DO_NOT_ENTER';
  successCriteria: string[];
  requiredMetrics: string[];
};

/** Keeps validation separate from the research score and never declares success. */
export function buildLongformValidationPlan(opportunity: LongformOpportunity): LongformValidationPlan {
  const requiredMetrics = ['CTR', '7D views', '30D views', 'channel baseline', 'production cost', 'RPM'];
  const successCriteria = ['Median uplift across the batch', 'P75 uplift without one viral outlier', 'Cross-video consistency', 'Production feasibility', 'Revenue evidence'];
  if (opportunity.recommendation === 'AVOID' || opportunity.recommendation === 'INSUFFICIENT_DATA') return { recommendedVideos: null, reason: 'DO_NOT_ENTER', successCriteria, requiredMetrics };
  if (opportunity.sampleSize < 5 || opportunity.channelCount < 3 || opportunity.confidenceLabel === 'LOW') return { recommendedVideos: 5, reason: 'THIN_EVIDENCE', successCriteria, requiredMetrics };
  return { recommendedVideos: 3, reason: 'READY_FOR_SMALL_TEST', successCriteria, requiredMetrics };
}

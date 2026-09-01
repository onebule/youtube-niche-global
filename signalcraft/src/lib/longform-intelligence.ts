import type { LongformOpportunity } from './longform';
import { LONG_FORM_OPPORTUNITY_CONFIG } from './opportunity-config.ts';

export type LongformEvidenceSignal = {
  value: number | null;
  source: 'growth_proxy' | 'competition_proxy' | 'small_creator_proxy' | 'creator_diversity_proxy';
};

export type LongformRiskFlag =
  | 'SMALL_SAMPLE'
  | 'NARROW_CREATOR_BASE'
  | 'LOW_CONFIDENCE'
  | 'NO_REPRESENTATIVE_EVIDENCE'
  | 'AVOID_RECOMMENDATION';

export type LongformEvidenceLayer = {
  signals: {
    demand: LongformEvidenceSignal;
    supply: LongformEvidenceSignal;
    smallCreator: LongformEvidenceSignal;
    diversity: LongformEvidenceSignal;
  };
  riskFlags: LongformRiskFlag[];
  revenue: { available: false; value: null };
};

function metric(opportunity: LongformOpportunity, key: string) {
  const value = opportunity.metrics?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Build the explainability layer from real long-form response fields only.
 * Missing metrics deliberately remain null; no score or default is inferred here.
 */
export function buildLongformEvidenceLayer(opportunity: LongformOpportunity): LongformEvidenceLayer {
  const riskFlags: LongformRiskFlag[] = [];
  if (opportunity.sampleSize < LONG_FORM_OPPORTUNITY_CONFIG.confidence.cautionMinVideos) riskFlags.push('SMALL_SAMPLE');
  if (opportunity.channelCount < LONG_FORM_OPPORTUNITY_CONFIG.confidence.cautionMinChannels) riskFlags.push('NARROW_CREATOR_BASE');
  if (opportunity.confidenceLabel === 'LOW') riskFlags.push('LOW_CONFIDENCE');
  if (opportunity.representativeVideos.length === 0) riskFlags.push('NO_REPRESENTATIVE_EVIDENCE');
  if (opportunity.recommendation === 'AVOID' || opportunity.recommendation === 'INSUFFICIENT_DATA') riskFlags.push('AVOID_RECOMMENDATION');

  return {
    signals: {
      demand: { value: metric(opportunity, 'growth'), source: 'growth_proxy' },
      supply: { value: metric(opportunity, 'lowCompetition'), source: 'competition_proxy' },
      smallCreator: { value: metric(opportunity, 'smallCreator'), source: 'small_creator_proxy' },
      diversity: { value: metric(opportunity, 'creatorDiversity'), source: 'creator_diversity_proxy' },
    },
    riskFlags,
    revenue: { available: false, value: null },
  };
}

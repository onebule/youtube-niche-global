/**
 * Versioned guardrails for the two opportunity engines.
 *
 * The API remains the source of ranking scores. These configs only define
 * presentation/evidence gates, so the public discovery UI cannot turn a thin
 * sample into an overconfident recommendation.
 */
export const LONG_FORM_OPPORTUNITY_CONFIG = Object.freeze({
  version: 'LongFormOpportunityV1',
  confidence: Object.freeze({
    recommendedMinVideos: 20,
    recommendedMinChannels: 5,
    cautionMinVideos: 5,
    cautionMinChannels: 3,
  }),
  concentration: Object.freeze({ cautionTop3Share: 65 }),
});

export const SHORTS_OPPORTUNITY_CONFIG = Object.freeze({
  version: 'ShortsOpportunityV1',
  confidence: Object.freeze({
    recommendedMinVideos: 20,
    recommendedMinChannels: 5,
    cautionMinVideos: 5,
    cautionMinChannels: 3,
  }),
  concentration: Object.freeze({ cautionTop3Share: 65 }),
});

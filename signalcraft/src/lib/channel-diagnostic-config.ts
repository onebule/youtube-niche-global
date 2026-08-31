/**
 * Central configuration for the public channel diagnostic engine.
 *
 * These thresholds are deliberately conservative: public YouTube data can
 * describe observable performance, but it cannot prove impressions, CTR,
 * retention, traffic sources, or platform-level distribution decisions.
 */
export const channelDiagnosticConfig = {
  version: 'channel-diagnostic-v3.0',
  minSample: 5,
  highConfidenceSample: 15,
  highConfidenceTimeSpanDays: 90,
  recentWindowSize: 10,
  previousWindowSize: 20,
  issueLimit: 3,
  breakoutThreshold: 2.5,
  declineThreshold: 0.34,
  volatilityMadRatio: 0.85,
  hitTop1Share: 0.45,
  hitTop3Share: 0.72,
  anomalyThreshold: 0.8,
  topicDriftThreshold: 0.62,
  inactivityDays: 90,
  uploadGapWatchDays: 28,
  uploadGapHighDays: 60,
  formatImbalanceFactor: 2.5,
  weights: {
    growthMomentum: 0.25,
    performanceStability: 0.20,
    contentFit: 0.20,
    publishingHealth: 0.15,
    repeatability: 0.15,
    formatStructure: 0.05,
  },
} as const;

export type ChannelDiagnosticConfig = typeof channelDiagnosticConfig;

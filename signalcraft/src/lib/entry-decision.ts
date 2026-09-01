import type { DataQuality, EvidenceContract } from './evidence-contract.ts';

export const ENTRY_DECISION_ALGORITHM_VERSION = 'entry-decision-v1';

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
export type EntryDecisionStatus = 'INSUFFICIENT' | 'CAUTION' | 'TEST' | 'RECOMMENDED' | 'AVOID';
export type DecisionReasonSeverity = 'SUPPORTING' | 'BLOCKING' | 'CONTEXT';

export type DecisionReason = {
  code: string;
  severity: DecisionReasonSeverity;
  message: string;
};

export type PerformanceAssessment = {
  level: 'UNKNOWN' | 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  score: number | null;
  sourceMetric: string | null;
  metrics: Record<string, number | null>;
  reasons: string[];
};

export type EntryDecision = {
  status: EntryDecisionStatus;
  confidence: ConfidenceLevel;
  reasons: DecisionReason[];
  blockers: DecisionReason[];
  evidenceId: string | null;
  algorithmVersion: string;
};

export type LongformDecisionInput = {
  sampleSize: number;
  channelCount: number;
  representativeVideoCount: number;
  metrics: Record<string, number | null | undefined>;
  marketOpportunity?: number | null;
  executionFit?: number | null;
  entryScore?: number | null;
  recommendation?: string | null;
  baselineStatus?: 'VERIFIED' | 'INSUFFICIENT' | 'UNAVAILABLE' | null;
  dataQuality: DataQuality | null;
  evidence?: EvidenceContract | null;
};

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const clamp = (value: number) => Math.max(0, Math.min(100, value));

function firstMetric(metrics: LongformDecisionInput['metrics']): [string, number] | null {
  const candidates = [
    ['growth', metrics.growth],
    ['viewsPerDay', metrics.viewsPerDay],
    ['viewsPerHour', metrics.viewsPerHour],
    ['velocity', metrics.velocity],
  ] as const;
  for (const [key, value] of candidates) {
    const numeric = finite(value);
    if (numeric !== null) return [key, numeric];
  }
  return null;
}

export function derivePerformanceAssessment(metrics: LongformDecisionInput['metrics']): PerformanceAssessment {
  const source = firstMetric(metrics);
  const observed = source ? clamp(source[1]) : null;
  const level: PerformanceAssessment['level'] = observed === null
    ? 'UNKNOWN'
    : observed >= 80 ? 'VERY_HIGH'
      : observed >= 60 ? 'HIGH'
        : observed >= 40 ? 'MEDIUM'
          : observed >= 20 ? 'LOW'
            : 'VERY_LOW';
  return {
    level,
    score: observed === null ? null : Math.round(observed),
    sourceMetric: source?.[0] || null,
    metrics: {
      growth: finite(metrics.growth),
      viewsPerDay: finite(metrics.viewsPerDay),
      viewsPerHour: finite(metrics.viewsPerHour),
      velocity: finite(metrics.velocity),
    },
    reasons: source ? [`${source[0]} is observed at ${Math.round(source[1])}.`] : ['No supported public performance metric is available.'],
  };
}

export function confidenceFromDataQuality(input: Pick<LongformDecisionInput, 'sampleSize' | 'channelCount' | 'dataQuality'>): ConfidenceLevel {
  const quality = input.dataQuality?.level;
  if (!quality || quality === 'INSUFFICIENT' || input.sampleSize <= 0 || input.channelCount <= 0) return 'INSUFFICIENT';
  if (input.sampleSize < 5 || input.channelCount < 2 || quality === 'LOW') return 'LOW';
  if (input.sampleSize < 20 || input.channelCount < 5 || quality === 'MEDIUM') return 'MEDIUM';
  return 'HIGH';
}

function reason(code: string, severity: DecisionReasonSeverity, message: string): DecisionReason {
  return { code, severity, message };
}

/**
 * Long-form-only decision gate. Upstream scores are retained as opaque context;
 * they cannot override weak evidence or missing creator coverage.
 */
export function evaluateLongformEntryDecision(input: LongformDecisionInput): { performance: PerformanceAssessment; confidence: ConfidenceLevel; decision: EntryDecision } {
  const performance = derivePerformanceAssessment(input.metrics);
  const confidence = confidenceFromDataQuality(input);
  const reasons: DecisionReason[] = [];
  const blockers: DecisionReason[] = [];
  const quality = input.dataQuality?.level || 'INSUFFICIENT';

  if (input.sampleSize < 5) blockers.push(reason('LOW_SAMPLE_SIZE', 'BLOCKING', `Only ${input.sampleSize} usable videos are available.`));
  if (input.channelCount < 2) blockers.push(reason('LOW_CREATOR_COVERAGE', 'BLOCKING', `Only ${input.channelCount} independent channels are available.`));
  if (quality === 'INSUFFICIENT') blockers.push(reason('DATA_QUALITY_INSUFFICIENT', 'BLOCKING', 'Evidence quality is insufficient for an entry decision.'));
  if (quality === 'LOW') blockers.push(reason('DATA_QUALITY_LOW', 'BLOCKING', 'Evidence quality is low; confirm more complete samples before scaling.'));
  if (input.baselineStatus !== 'VERIFIED') blockers.push(reason('BASELINE_UNVERIFIED', 'BLOCKING', 'No verified multi-window creator baseline is available.'));
  if (input.representativeVideoCount <= 0) blockers.push(reason('NO_REPRESENTATIVE_EVIDENCE', 'BLOCKING', 'No representative public videos are available for review.'));

  if (performance.level === 'HIGH' || performance.level === 'VERY_HIGH') reasons.push(reason('STRONG_PERFORMANCE', 'SUPPORTING', 'Observed public performance is strong on the available metric.'));
  else if (performance.level === 'MEDIUM') reasons.push(reason('MEDIUM_PERFORMANCE', 'CONTEXT', 'Observed public performance is moderate and needs a controlled test.'));
  else if (performance.level === 'UNKNOWN') reasons.push(reason('PERFORMANCE_UNKNOWN', 'CONTEXT', 'Performance cannot be assessed from supported public metrics.'));

  if (input.marketOpportunity !== null && input.marketOpportunity !== undefined) reasons.push(reason('UPSTREAM_MARKET_SIGNAL', 'CONTEXT', `Upstream market signal preserved as opaque evidence (${Math.round(input.marketOpportunity)}/100).`));
  if (input.executionFit !== null && input.executionFit !== undefined) reasons.push(reason('UPSTREAM_EXECUTION_SIGNAL', 'CONTEXT', `Upstream execution signal preserved as opaque evidence (${Math.round(input.executionFit)}/100).`));
  if (input.recommendation) reasons.push(reason('UPSTREAM_RECOMMENDATION', 'CONTEXT', `Upstream recommendation “${input.recommendation}” is retained but cannot bypass this local gate.`));

  const lowSupplyGap = finite(input.metrics.lowCompetition);
  const explicitAvoid = input.recommendation === 'AVOID';
  const supportedAvoid = lowSupplyGap !== null && lowSupplyGap <= 20;
  let status: EntryDecisionStatus;
  if (confidence === 'INSUFFICIENT' || input.sampleSize < 5 || input.channelCount < 2 || input.representativeVideoCount <= 0) {
    status = 'INSUFFICIENT';
  } else if ((explicitAvoid || supportedAvoid) && confidence === 'HIGH') {
    status = 'AVOID';
    blockers.push(reason(explicitAvoid ? 'UPSTREAM_AVOID' : 'LOW_SUPPLY_GAP', 'BLOCKING', explicitAvoid ? 'Upstream evidence flags poor entry conditions.' : 'The available supply-gap proxy is very low.'));
  } else if (confidence === 'LOW' || quality === 'LOW') {
    status = 'CAUTION';
  } else if (confidence === 'HIGH' && performance.level !== 'UNKNOWN' && (performance.level === 'HIGH' || performance.level === 'VERY_HIGH') && (input.marketOpportunity ?? 0) >= 70 && (input.executionFit ?? 0) >= 60 && (input.entryScore ?? 0) >= 70 && input.sampleSize >= 20 && input.channelCount >= 5 && input.baselineStatus === 'VERIFIED') {
    status = 'RECOMMENDED';
  } else {
    status = 'TEST';
  }

  if (status === 'TEST') reasons.push(reason('CONTROLLED_TEST', 'SUPPORTING', 'Evidence supports a bounded test, not a proven scale decision.'));
  if (status === 'CAUTION') reasons.push(reason('UNCERTAINTY_MATERIAL', 'BLOCKING', 'Uncertainty is material; collect more evidence before testing at scale.'));
  if (status === 'INSUFFICIENT') reasons.push(reason('WE_DO_NOT_KNOW_YET', 'BLOCKING', 'The current evidence is too weak to responsibly decide.'));
  if (status === 'RECOMMENDED') reasons.push(reason('MULTI_SIGNAL_CONFIRMATION', 'SUPPORTING', 'Performance, coverage, baseline and external signals clear the local recommendation gate.'));

  return {
    performance,
    confidence,
    decision: {
      status,
      confidence,
      reasons,
      blockers,
      evidenceId: input.evidence?.snapshotId || null,
      algorithmVersion: ENTRY_DECISION_ALGORITHM_VERSION,
    },
  };
}

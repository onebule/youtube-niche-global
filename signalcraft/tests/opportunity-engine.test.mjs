import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunityAssessment, OPPORTUNITY_ENGINE_ALGORITHM_VERSION } from '../src/lib/opportunity-engine.ts';

const quality = (level = 'HIGH') => ({ schemaVersion: 'data-quality.v1', level, sampleVideos: 24, sampleChannels: 8, completeness: 92, source: 'fixture' });
const signals = ({ breakoutCreators = 6, small = 'STRONG', concentration = 'LOW' } = {}) => ({
  algorithmVersion: 'niche-signals-v1', nicheId: 'niche-a', format: 'long', temporalWindow: 'current-public-corpus', eligibleVideos: 24, eligibleCreators: 8,
  breakoutVideos: breakoutCreators + 2, breakoutCreators, strongBreakoutVideos: 4, strongBreakoutCreators: 3, breakoutDensity: .25, strongBreakoutDensity: .16,
  knownCreatorSizeCount: 8, unknownCreatorSizeCount: 0, eligibleSmallCreators: 5, smallBreakoutCreators: small === 'INSUFFICIENT' ? 0 : 3, smallCreatorBreakoutRate: small === 'INSUFFICIENT' ? null : .6, repeatedBreakoutCreators: 2,
  crossCreatorRepeatStatus: breakoutCreators >= 5 ? 'REPEATED_CROSS_CREATOR' : 'ONE_OFF_CROSS_CREATOR',
  concentration: { scope: 'eligible_video_views_by_creator', totalEligibleViews: 1_000_000, top1Share: concentration === 'HIGH' ? .62 : .18, top3Share: concentration === 'HIGH' ? .82 : .36, level: concentration, uniqueCreators: 8 },
  signals: [
    { type: 'CROSS_CREATOR_BREAKOUT', strength: breakoutCreators >= 5 ? 'STRONG' : breakoutCreators >= 3 ? 'MODERATE' : 'WEAK', confidence: 'HIGH', evidence: {}, reasons: [], blockers: [], algorithmVersion: 'niche-signals-v1' },
    { type: 'SMALL_CREATOR_BREAKOUT', strength: small, confidence: small === 'INSUFFICIENT' ? 'INSUFFICIENT' : 'HIGH', evidence: {}, reasons: [], blockers: [], algorithmVersion: 'niche-signals-v1' },
  ], confidence: 'HIGH', dataQuality: quality('HIGH'), evidence: { schemaVersion: 'evidence.v1', algorithmVersion: 'niche-signals-v1' },
});

const lifecycle = ({ state = 'GROWING', provenance = 'TRUE_SNAPSHOT_HISTORY', relationship = 'DEMAND_OUTPACING_SUPPLY', performanceDirection = 'RISING', supplyDirection = 'RISING', saturation = null } = {}) => ({
  algorithmVersion: 'niche-lifecycle-v1', nicheId: 'niche-a', format: 'long', confidence: 'HIGH',
  currentWindow: { start: '2026-08-01', end: '2026-08-31', durationDays: 30, timeSemantics: 'TRUE_SNAPSHOT_HISTORY' }, comparisonWindow: { start: '2026-07-01', end: '2026-07-31', durationDays: 30, timeSemantics: 'TRUE_SNAPSHOT_HISTORY' },
  comparison: { comparable: true, provenance, confidence: 'HIGH', coverage: 1, blockers: [], current: {}, comparison: {}, durationDays: 30 },
  supply: { current: { breakout: { concentration: { level: 'LOW', top3Share: .36 } } }, comparison: {}, videoSupplyTrend: { direction: supplyDirection, relativeChange: .2, confidence: 'HIGH' }, creatorTrend: { direction: 'RISING', relativeChange: .2, confidence: 'HIGH' }, performanceTrend: { direction: performanceDirection, relativeChange: performanceDirection === 'FALLING' ? -.3 : .3, confidence: 'HIGH' } },
  observedDemand: { current: {}, comparison: {}, trend: { direction: performanceDirection, relativeChange: performanceDirection === 'FALLING' ? -.3 : .3, confidence: 'HIGH' } },
  supplyDemandRelationship: relationship,
  breakoutTrend: {}, concentrationTrend: {},
  signals: saturation ? [{ type: 'SATURATION_RISING', strength: saturation, confidence: 'HIGH', evidence: { relativeChange: null }, reasons: [], blockers: [], algorithmVersion: 'niche-lifecycle-v1' }] : [],
  lifecycle: { state, confidence: 'HIGH', provenance, reasons: [], blockers: [] }, dataQuality: quality('HIGH'), evidence: { schemaVersion: 'evidence.v1', algorithmVersion: 'niche-lifecycle-v1' },
});

const base = (overrides = {}) => ({ key: 'niche-a', topic: 'Home repair', sampleSize: 24, channelCount: 8, representativeVideoCount: 5, metrics: { growth: 82 }, baselineStatus: 'VERIFIED', dataQuality: quality(), nicheSignals: signals(), nicheLifecycle: lifecycle(), ...overrides });

test('strong emerging/growing evidence opens a testable window', () => {
  const result = buildOpportunityAssessment(base());
  assert.equal(result.entryWindow, 'OPEN');
  assert.ok(['TEST', 'RECOMMENDED'].includes(result.decision.status));
  assert.equal(result.algorithmVersion, OPPORTUNITY_ENGINE_ALGORITHM_VERSION);
});

test('famous but concentrated and saturated evidence closes the window', () => {
  const result = buildOpportunityAssessment(base({ nicheSignals: signals({ breakoutCreators: 1, small: 'WEAK', concentration: 'HIGH' }), nicheLifecycle: lifecycle({ state: 'SATURATED', relationship: 'SUPPLY_OUTPACING_DEMAND', performanceDirection: 'FALLING', saturation: 'STRONG' }) }));
  assert.equal(result.entryWindow, 'CLOSED');
  assert.equal(result.decision.status, 'AVOID');
});

test('weak evidence cannot become recommended from an opaque upstream score', () => {
  const result = buildOpportunityAssessment(base({ sampleSize: 4, channelCount: 1, representativeVideoCount: 1, dataQuality: quality('LOW'), marketOpportunity: 95, executionFit: 95, entryScore: 95, nicheSignals: null, nicheLifecycle: null }));
  assert.equal(result.decision.status, 'INSUFFICIENT');
  assert.ok(result.blockers.some(item => item.code === 'EVIDENCE_GATE_FAILED'));
});

test('positive breakout with rising saturation resolves to test, not recommended', () => {
  const result = buildOpportunityAssessment(base({ nicheLifecycle: lifecycle({ relationship: 'SUPPLY_OUTPACING_DEMAND', saturation: 'MODERATE' }) }));
  assert.equal(result.entryWindow, 'NARROWING');
  assert.equal(result.decision.status, 'TEST');
});

test('mature but accessible niche remains testable', () => {
  const result = buildOpportunityAssessment(base({ sampleSize: 12, nicheLifecycle: lifecycle({ state: 'MATURE', relationship: 'BALANCED_GROWTH', performanceDirection: 'STABLE', supplyDirection: 'STABLE' }) }));
  assert.equal(result.entryWindow, 'OPEN');
  assert.equal(result.decision.status, 'TEST');
});

test('declining niche with falling demand and weak access can avoid', () => {
  const result = buildOpportunityAssessment(base({ nicheSignals: signals({ breakoutCreators: 1, small: 'WEAK', concentration: 'HIGH' }), nicheLifecycle: lifecycle({ state: 'DECLINING', relationship: 'BOTH_DECLINING', performanceDirection: 'FALLING', supplyDirection: 'STABLE' }) }));
  assert.equal(result.decision.status, 'AVOID');
});

test('retrospective evidence is labelled and does not forecast months', () => {
  const result = buildOpportunityAssessment(base({ nicheLifecycle: lifecycle({ provenance: 'RETROSPECTIVE' }) }));
  assert.ok(['OPEN', 'NARROWING', 'UNDETERMINED'].includes(result.entryWindow));
  assert.equal(result.provenance.lifecycle, 'RETROSPECTIVE');
  assert.ok(result.reasons.some(item => item.code === 'RETROSPECTIVE_WINDOW'));
});

test('missing lifecycle produces an undetermined entry window while current evidence remains explainable', () => {
  const result = buildOpportunityAssessment(base({ nicheLifecycle: null }));
  assert.equal(result.entryWindow, 'UNDETERMINED');
  assert.ok(result.reasons.some(item => item.code === 'ENTRY_WINDOW_HISTORY_INSUFFICIENT'));
});

test('replay is deterministic and preserves Shorts isolation by contract', () => {
  const input = base();
  const first = buildOpportunityAssessment(input);
  const second = buildOpportunityAssessment(input);
  assert.deepEqual(second, first);
  assert.equal(first.provenance.sources.some(source => /Shorts/i.test(source)), false);
});

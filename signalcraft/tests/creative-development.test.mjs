import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreativeDevelopmentIntelligence, CREATIVE_DEVELOPMENT_ALGORITHM_VERSION } from '../src/lib/creative-development.ts';

const candidate = (overrides = {}) => ({
  ideaId: 'idea-1', state: 'ACTIVE', nicheId: 'niche-1', patternIds: ['pattern:how-to'], sourceCaseIds: ['case-1', 'case-2'], strategyRole: 'PRIMARY',
  concept: { workingLabel: 'A new process', coreQuestion: 'How does this work?', subject: 'A new process', angle: 'Move the mechanism to a new setting', contentMechanism: 'HOW_TO', audiencePromise: 'Understand the process', patternReference: 'pattern:how-to', differentiation: 'New subject and evidence', rationale: 'Pattern evidence' },
  novelty: { state: 'NOVEL', confidence: 'HIGH', closestCaseId: 'case-1', closestSiblingIdeaId: null, dimensions: { titleStructureSimilarity: 0.1, topicSimilarity: 0.1, entityOverlap: 0, patternOverlap: 1, semanticSimilarity: null, mechanismOverlap: 1, surfaceSimilarity: 0.1 }, evidence: [], blockers: [], calibrationStatus: 'CALIBRATION_REQUIRED' },
  fit: { status: 'ALIGNED', strategyRole: 'PRIMARY', opportunityDecision: 'RECOMMENDED', patternStatus: 'WINNING', trendState: 'ACCELERATING', nicheFit: 'TOP_FIT', validationState: 'NOT_AVAILABLE', evidenceRefs: [] },
  confidence: 'HIGH', evidence: [], reasons: [], risks: [], blockers: [], validationReadiness: 'READY', provenance: { algorithmVersion: 'case-pattern-idea-v1' }, algorithmVersion: 'case-pattern-idea-v1', ...overrides,
});

const brief = (overrides = {}) => ({
  briefId: 'brief-1', briefVersion: 'creative-brief-v1', ideaId: 'idea-1', nicheId: 'niche-1',
  strategyContext: { role: 'PRIMARY', strategyVersion: 'strategy-v1', positioning: 'Evidence-backed format', entryDecision: 'RECOMMENDED', entryWindow: 'OPEN' },
  patternContext: { patternId: 'pattern:how-to', label: 'How-to', taxonomy: 'TITLE_STRUCTURE', featureValue: 'HOW_TO', trendState: 'ACCELERATING', fitStatus: 'TOP_FIT', fidelity: 'STRONG_MATCH' },
  validation: { state: 'VALIDATED', confidence: 'HIGH', provenance: { algorithmVersion: 'idea-validation-v1' } },
  audienceProblem: { viewerQuestion: 'How does this work?', problem: 'Viewers need a repeatable process.', curiosityGap: 'The mechanism is unclear.' },
  contentPromise: { statement: 'Understand the process and its limits.', value: 'A verifiable decision' },
  coreMechanism: { type: 'HOW_TO', description: 'Break the process into verifiable steps.', patternId: 'pattern:how-to' },
  differentiation: { changedSubject: 'A new subject', changedContext: 'A new setting', changedQuestion: 'How does this work?', changedEvidence: 'Use new public evidence.', sourceCaseDistance: 'Low lexical overlap.' },
  mandatoryConstraints: ['Keep the HOW_TO mechanism.'], flexibleVariables: ['Examples'], productionFeasibility: { state: 'FEASIBLE' }, originality: { state: 'NOVEL', dimensions: { semanticSimilarity: null, surfaceSimilarity: 0.1 } }, ipRightsRisk: { state: 'LOW_KNOWN_RISK' }, confidence: 'HIGH', reasons: [], risks: [], blockers: [], readiness: 'READY_FOR_CREATIVE_DEVELOPMENT', provenance: { briefId: 'brief-1', ideaId: 'idea-1', sourceCaseIds: ['case-1', 'case-2'], patternIds: ['pattern:how-to'], strategyVersion: 'strategy-v1', opportunityVersion: 'opportunity-v1', ideaGenerationVersion: 'case-pattern-idea-v1', ideaValidationVersion: 'idea-validation-v1', creativeBriefVersion: 'creative-brief-v1', patternTrend: 'ACCELERATING', nicheFit: 'TOP_FIT', patternValidation: 'NOT_AVAILABLE', confidence: 'HIGH', evaluatedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' }, ...overrides,
});

const input = (briefOverrides = {}, candidateOverrides = {}) => ({ creativeBriefIntelligence: { schemaVersion: 'creative-brief-intelligence.v1', algorithmVersion: 'creative-brief-v1', scope: 'LONG_FORM', briefs: [brief(briefOverrides)], blockedBriefs: [], validations: [], gaps: [], provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1', algorithmVersions: ['creative-brief-v1'], calibrationStatus: 'CALIBRATION_REQUIRED' } }, ideaIntelligence: { candidates: [candidate(candidateOverrides)], blockedCandidates: [], algorithmVersion: 'case-pattern-idea-v1' } });

test('strong brief produces a deterministic script-development package', () => {
  const first = buildCreativeDevelopmentIntelligence(input());
  const second = buildCreativeDevelopmentIntelligence(input());
  assert.equal(first.algorithmVersion, CREATIVE_DEVELOPMENT_ALGORITHM_VERSION);
  assert.equal(first.packages[0].readiness, 'READY_FOR_SCRIPT_DEVELOPMENT');
  assert.equal(first.packages[0].titleDirection.structureType, 'HOW_X');
  assert.equal(first.packages[0].hookIntelligence.hookObjective, 'POSE_CORE_QUESTION');
  assert.equal(first.packages[0].outline.structureType, 'EXPLAINER');
  assert.deepEqual(first.packages, second.packages);
});

test('comparison pattern receives a real comparison outline', () => {
  const result = buildCreativeDevelopmentIntelligence(input({ patternContext: { ...brief().patternContext, featureValue: 'COMPARISON' }, coreMechanism: { type: 'COMPARISON', description: 'Compare two paths on the same criteria.', patternId: 'pattern:comparison' } }, { patternIds: ['pattern:comparison'], concept: { ...candidate().concept, contentMechanism: 'COMPARISON', patternReference: 'pattern:comparison' } }));
  assert.equal(result.packages[0].titleDirection.structureType, 'COMPARISON');
  assert.equal(result.packages[0].outline.structureType, 'COMPARISON');
  assert.ok(result.packages[0].outline.beats.some(beat => beat.role === 'TRADE_OFF'));
});

test('rejected brief is not emitted as a usable package', () => {
  const result = buildCreativeDevelopmentIntelligence(input({ readiness: 'BLOCKED', validation: { state: 'REJECTED', confidence: 'LOW', provenance: { algorithmVersion: 'idea-validation-v1' } }, strategyContext: { ...brief().strategyContext, role: 'AVOID', entryDecision: 'AVOID' } }));
  assert.equal(result.packages.length, 0);
  assert.equal(result.blockedPackages.length, 0);
});

test('source-title clone is blocked while same pattern with a new idea remains reviewable', () => {
  const clone = buildCreativeDevelopmentIntelligence(input({}, { novelty: { ...candidate().novelty, state: 'TOO_SIMILAR', dimensions: { ...candidate().novelty.dimensions, surfaceSimilarity: 0.9 } } }));
  assert.equal(clone.blockedPackages[0].titleDirection.originalityGate, 'BLOCKED');
  assert.equal(clone.blockedPackages[0].readiness, 'BLOCKED');
  const newIdea = buildCreativeDevelopmentIntelligence(input({}, { novelty: { ...candidate().novelty, state: 'NOVEL', dimensions: { ...candidate().novelty.dimensions, surfaceSimilarity: 0.1 } } }));
  assert.notEqual(newIdea.packages[0].titleDirection.originalityGate, 'BLOCKED');
});

test('needs-revision briefs remain visible as non-ready structure packages', () => {
  const base = input({ readiness: 'NEEDS_REVISION', validation: { state: 'NEEDS_REVISION', confidence: 'MEDIUM', provenance: { algorithmVersion: 'idea-validation-v1' } } });
  base.creativeBriefIntelligence.briefs = [];
  base.creativeBriefIntelligence.blockedBriefs = [base.creativeBriefIntelligence.blockedBriefs[0] || { ...brief({ readiness: 'NEEDS_REVISION', validation: { state: 'NEEDS_REVISION', confidence: 'MEDIUM', provenance: { algorithmVersion: 'idea-validation-v1' } } }) }];
  const result = buildCreativeDevelopmentIntelligence(base);
  assert.equal(result.packages.length, 1);
  assert.equal(result.packages[0].readiness, 'NEEDS_REVISION');
});

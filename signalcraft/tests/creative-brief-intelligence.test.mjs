import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreativeBriefIntelligence, CREATIVE_BRIEF_ALGORITHM_VERSION } from '../src/lib/creative-brief-intelligence.ts';

const pattern = { patternId: 'content-pattern-v1:how-to', taxonomy: 'TITLE_STRUCTURE', featureKey: 'titleStructure', featureValue: 'HOW_TO', label: '教程/方法', derivation: 'DETERMINISTIC_METADATA' };
const candidate = (overrides = {}) => ({
  ideaId: 'idea-v1:test', state: 'ACTIVE', nicheId: 'niche-a', patternIds: [pattern.patternId], sourceCaseIds: ['case:v1', 'case:v2'], strategyRole: 'PRIMARY',
  concept: { workingLabel: '家庭工作台 · 教程/方法研究方向', coreQuestion: '如何在家庭工作台中完成一个可验证的过程？', subject: '家庭工作台', angle: '以教程承载家庭工作台，保留教程/方法结构', contentMechanism: '把一个可执行过程拆成清晰步骤，并在结果处完成验证。', audiencePromise: '帮助想了解家庭工作台的观众，在一次完整观看中得到可复核的判断依据。', patternReference: `教程/方法（${pattern.patternId}）`, differentiation: '改变主体、场景与例子。', rationale: '来自公开模式证据。' },
  novelty: { state: 'NOVEL', confidence: 'HIGH', closestCaseId: 'case:v1', closestSiblingIdeaId: null, dimensions: { titleStructureSimilarity: 0.1, topicSimilarity: 0.1, entityOverlap: 0, patternOverlap: 1, semanticSimilarity: null, mechanismOverlap: 1, surfaceSimilarity: 0.1 }, evidence: [], blockers: [], calibrationStatus: 'CALIBRATION_REQUIRED' },
  fit: { status: 'ALIGNED', strategyRole: 'PRIMARY', opportunityDecision: 'RECOMMENDED', patternStatus: 'WINNING', trendState: 'ACCELERATING', nicheFit: 'TOP_FIT', validationState: 'NOT_AVAILABLE', evidenceRefs: [] }, confidence: 'HIGH', evidence: [], reasons: [], risks: [], blockers: [], validationReadiness: 'READY', provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', nicheId: 'niche-a', opportunityAlgorithmVersion: 'opportunity-engine-v1', entryDecision: 'RECOMMENDED', entryWindow: 'OPEN', strategyVersion: 'content-strategy-v1', strategyRole: 'PRIMARY', patternIds: [pattern.patternId], patternVersions: ['content-patterns-v1'], patternTrend: 'ACCELERATING', nichePatternFit: 'TOP_FIT', patternValidation: 'NOT_AVAILABLE', strategyValidation: 'INSUFFICIENT', sourceCaseIds: ['case:v1', 'case:v2'], sourceVideoIds: ['v1', 'v2'], generationMethod: 'DETERMINISTIC_STRUCTURED_TRANSFORMATION', noveltyAssessment: 'NOVEL', confidence: 'HIGH', algorithmVersion: 'case-pattern-idea-v1', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap' }, algorithmVersion: 'case-pattern-idea-v1', ...overrides,
});
const selection = { patternId: pattern.patternId, pattern, role: 'PRIMARY', priority: 'HIGH', patternStatus: 'WINNING', trendState: 'ACCELERATING', trendConfidence: 'HIGH', fitStatus: 'TOP_FIT', fitConfidence: 'HIGH', repeatability: 'REPEATED_ACROSS_CREATORS', creatorBreadth: 3, breakoutEvidence: { videos: 3, creators: 3, rate: 1 }, normalizedPerformance: { median: 1.3, p75: 1.5, samples: 3 }, reasons: [], risks: [], blockers: [], evidenceRefs: [] };
const input = (overrides = {}) => ({
  nicheId: 'niche-a', topic: '家庭工作台', mechanism: '解释一个实用过程', productionType: 'tutorial', ideaIntelligence: { algorithmVersion: 'case-pattern-idea-v1', candidates: [candidate()], blockedCandidates: [], cases: [], schemaVersion: 'idea-intelligence.v1', scope: 'LONG_FORM', nicheId: 'niche-a', dataAvailability: {}, diversity: { selected: 1, distinctPatterns: 1, distinctTopics: 1, notes: [] }, gaps: [], provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap', algorithmVersions: ['case-pattern-idea-v1'], calibrationStatus: 'CALIBRATION_REQUIRED' } },
  opportunityAssessment: { algorithmVersion: 'opportunity-engine-v1', decision: { status: 'RECOMMENDED' }, entryWindow: 'OPEN', confidence: 'HIGH', dimensions: {}, reasons: [], blockers: [], provenance: { sources: [], evidenceId: null, lifecycle: 'NOT_PROVIDED', algorithmVersions: [] } },
  contentPatternTrend: { algorithmVersion: 'content-pattern-trend-v1', assessments: [{ pattern, state: 'ACCELERATING', confidence: 'HIGH', provenance: { algorithmVersion: 'content-pattern-trend-v1' } }], nicheFits: [{ pattern, status: 'TOP_FIT', confidence: 'HIGH' }], currentReport: { aggregations: [{ pattern }] } },
  contentStrategy: { strategyVersion: 'content-strategy-v1', primaryPatterns: [selection], testPatterns: [], watchPatterns: [], deprioritizedPatterns: [], avoidedPatterns: [], insufficientPatterns: [], positioning: { summary: 'evidence-backed' } }, experimentValidation: { algorithmVersion: 'experiment-validation-v1', observations: [], patternValidation: [] }, capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap', ...overrides,
});

test('strong primary idea becomes a traceable Creative Brief', () => {
  const report = buildCreativeBriefIntelligence(input());
  assert.equal(report.algorithmVersion, CREATIVE_BRIEF_ALGORITHM_VERSION);
  assert.equal(report.validations[0].state, 'CONDITIONALLY_VALIDATED');
  assert.equal(report.briefs[0].readiness, 'READY_WITH_CAUTION');
  assert.equal(report.briefs[0].ideaId, 'idea-v1:test');
  assert.ok(report.briefs[0].mandatoryConstraints.length >= 3);
});

test('avoid, duplicate, mismatch and insufficient evidence never become ready', () => {
  const avoid = buildCreativeBriefIntelligence(input({ opportunityAssessment: { ...input().opportunityAssessment, decision: { status: 'AVOID' } } }));
  assert.equal(avoid.validations[0].state, 'REJECTED');
  assert.equal(avoid.briefs.length, 0);
  const duplicate = buildCreativeBriefIntelligence(input({ ideaIntelligence: { ...input().ideaIntelligence, candidates: [candidate({ novelty: { ...candidate().novelty, state: 'DUPLICATE', closestSiblingIdeaId: 'idea-v1:other' } })] } }));
  assert.equal(duplicate.validations[0].state, 'REJECTED');
  const insufficient = buildCreativeBriefIntelligence(input({ contentPatternTrend: null, contentStrategy: null, ideaIntelligence: null }));
  assert.equal(insufficient.validations.length, 0);
  assert.equal(insufficient.briefs.length, 0);
});

test('replay is deterministic and exposes unavailable validation/embeddings honestly', () => {
  const first = buildCreativeBriefIntelligence(input());
  const second = buildCreativeBriefIntelligence(input());
  assert.deepEqual(first, second);
  assert.ok(first.gaps.some(item => item.includes('VALIDATION_NOT_AVAILABLE')));
  assert.ok(first.validations[0].risks.some(item => item.code === 'SEMANTIC_SIMILARITY_UNAVAILABLE'));
  assert.equal(first.validations[0].sourceCaseDistance.semanticSimilarity, null);
});

test('shorts and Canvas are outside the report scope', () => {
  const report = buildCreativeBriefIntelligence(input());
  assert.equal(report.scope, 'LONG_FORM');
  assert.equal('canvas' in report, false);
  assert.equal('shorts' in report, false);
});

test('test ideas, source-copy risk and pattern mismatch stay gated', () => {
  const testCandidate = candidate({ strategyRole: 'TEST', fit: { ...candidate().fit, strategyRole: 'TEST', opportunityDecision: 'TEST' } });
  const testReport = buildCreativeBriefIntelligence(input({ ideaIntelligence: { ...input().ideaIntelligence, candidates: [testCandidate] }, contentStrategy: { ...input().contentStrategy, primaryPatterns: [], testPatterns: [{ ...selection, role: 'TEST', priority: 'MEDIUM' }] }, opportunityAssessment: { ...input().opportunityAssessment, decision: { status: 'TEST' } } }));
  assert.equal(testReport.validations[0].state, 'CONDITIONALLY_VALIDATED');
  assert.equal(testReport.briefs[0].readiness, 'READY_WITH_CAUTION');
  const similar = buildCreativeBriefIntelligence(input({ ideaIntelligence: { ...input().ideaIntelligence, candidates: [candidate({ novelty: { ...candidate().novelty, state: 'TOO_SIMILAR' } })] } }));
  assert.equal(similar.validations[0].state, 'NEEDS_REVISION');
  assert.equal(similar.briefs.length, 0);
  const mismatch = buildCreativeBriefIntelligence(input({ ideaIntelligence: { ...input().ideaIntelligence, candidates: [candidate({ concept: { ...candidate().concept, patternReference: 'unrelated' } })] } }));
  assert.equal(mismatch.validations[0].patternFidelity.state, 'MISMATCH');
  assert.equal(mismatch.briefs.length, 0);
});

test('positive validation can strengthen a brief, while production blockers stop it', () => {
  const positive = buildCreativeBriefIntelligence(input({ ideaIntelligence: { ...input().ideaIntelligence, candidates: [candidate({ fit: { ...candidate().fit, validationState: 'VALIDATED' } })] }, experimentValidation: { algorithmVersion: 'experiment-validation-v1', observations: [{ observationId: 'obs-1' }], patternValidation: [{ patternId: pattern.patternId, state: 'VALIDATED' }] } }));
  assert.equal(positive.validations[0].state, 'VALIDATED');
  assert.equal(positive.briefs[0].readiness, 'READY_FOR_CREATIVE_DEVELOPMENT');
  const blocked = buildCreativeBriefIntelligence(input({ productionType: 'blocked licensed footage' }));
  assert.equal(blocked.briefs.length, 0);
  assert.ok(blocked.blockedBriefs[0].blockers.some(item => item.code === 'KNOWN_PRODUCTION_BLOCKER'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIdeaIntelligence, IDEA_INTELLIGENCE_ALGORITHM_VERSION } from '../src/lib/idea-intelligence.ts';

const pattern = (id, value = 'HOW_TO') => ({ patternId: id, taxonomy: 'TITLE_STRUCTURE', featureKey: 'titleStructure', featureValue: value, label: value === 'HOW_TO' ? '教程/方法' : value, derivation: 'DETERMINISTIC_METADATA' });
const aggregation = (p, status = 'WINNING') => ({ pattern: p, frequency: { occurrences: 8, eligibleVideos: 8, share: 0.5 }, creatorBreadth: { distinctCreators: 3, shareOfCreators: 0.5 }, performance: { sampleSize: 8, normalizedPerformanceCount: 6, medianNormalizedPerformance: 1.3, p75NormalizedPerformance: 1.7, unit: 'CREATOR_BASELINE_MULTIPLE', rawViewsUsed: false }, breakoutEvidence: { assessableVideos: 6, breakoutVideos: 4, breakoutRate: 0.66, breakoutCreators: 3 }, crossCreatorEvidence: { distinctCreators: 3, creatorsWithBreakout: 3, creatorIds: ['c1', 'c2', 'c3'], breakoutCreatorIds: ['c1', 'c2', 'c3'], status: 'REPEATED_ACROSS_CREATORS' }, repeatability: { eligibleVideos: 8, successfulVideos: 4, distinctCreators: 3, successfulCreators: 3, repeatedAcrossVideos: true, repeatedAcrossCreators: true, status: 'REPEATED_ACROSS_CREATORS' }, confidence: 'HIGH', winningPattern: { pattern: p, status, confidence: 'HIGH', reasonCodes: [], evidence: { eligibleVideos: 8, creators: 3, breakoutVideos: 4, breakoutCreators: 3, normalizedPerformanceSamples: 6 } }, provenance: { algorithmVersion: 'content-patterns-v1', source: 'PUBLIC_YOUTUBE_METADATA', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap', inputVideoIds: ['v1', 'v2', 'v3'], supportedFields: ['videoTitle'], unavailableFields: [], calibrationStatus: 'CALIBRATION_REQUIRED' } });
const trend = (p, state = 'ACCELERATING') => ({ pattern: p, state, confidence: 'HIGH', evidence: { adoption: { current: 8, previous: 4, delta: 4, changePct: 1 }, creatorBreadth: { current: 3, previous: 2, delta: 1, changePct: 0.5 }, normalizedPerformance: { current: 1.3, previous: 1.1, delta: 0.2, changePct: 0.18 }, p75Performance: { current: 1.7, previous: 1.2, delta: 0.5, changePct: 0.4 }, breakoutRate: { current: 0.66, previous: 0.4, delta: 0.26, changePct: 0.65 }, creatorConcentration: { current: 0.4, previous: 0.5, delta: -0.1, changePct: -0.2 } }, repeatability: { current: 'REPEATED_ACROSS_CREATORS', previous: 'MULTI_CREATOR_ONE_OFF' }, reasons: [], blockers: [], provenance: { algorithmVersion: 'content-pattern-trend-v1', timeSemantics: 'PUBLICATION_COHORT', currentWindow: 'current', previousWindow: 'previous', sourcePatternIds: [p.patternId] } });
const fit = (p, status = 'TOP_FIT') => ({ nicheId: 'niche-a', pattern: p, status, confidence: 'HIGH', inside: { videos: 8, creators: 3, medianPerformance: 1.3, breakoutRate: 0.66, repeatability: 'REPEATED_ACROSS_CREATORS' }, outside: { videos: 8, creators: 3, medianPerformance: 1, breakoutRate: 0.3, repeatability: 'MULTI_CREATOR_ONE_OFF' }, performanceAdvantage: 0.3, breakoutAdvantage: 0.36, reasons: [], blockers: [], provenance: { algorithmVersion: 'content-pattern-trend-v1', source: 'PUBLIC_YOUTUBE_METADATA', window: 'current', patternId: p.patternId, nicheId: 'niche-a' } });
const selection = (p, role = 'PRIMARY', status = 'WINNING') => ({ patternId: p.patternId, pattern: p, role, priority: role === 'PRIMARY' ? 'HIGH' : 'MEDIUM', patternStatus: status, trendState: 'ACCELERATING', trendConfidence: 'HIGH', fitStatus: 'TOP_FIT', fitConfidence: 'HIGH', repeatability: 'REPEATED_ACROSS_CREATORS', creatorBreadth: 3, breakoutEvidence: { videos: 4, creators: 3, rate: 0.66 }, normalizedPerformance: { median: 1.3, p75: 1.7, samples: 6 }, reasons: [], risks: [], blockers: [], evidenceRefs: [`pattern:${p.patternId}`] });
const base = ({ role = 'PRIMARY', decision = 'RECOMMENDED', patternStatus = 'WINNING', patternValue = 'HOW_TO', validationState, sourceTitles = ['How to build a quiet desk', 'How to build a quiet studio'], sourceTopics = ['desk setup', 'studio setup'] } = {}) => {
  const p = pattern('content-pattern-v1:test', patternValue);
  const videos = sourceTitles.map((title, index) => ({ videoId: `v${index + 1}`, title, topic: sourceTopics[index] || sourceTopics[0], channelTitle: `Creator ${index + 1}`, sourceUrl: `https://youtube.com/watch?v=v${index + 1}`, views: 1000, durationSeconds: 900 }));
  const cases = videos.map((video, index) => ({ caseId: `case:${video.videoId}`, videoId: video.videoId, title: video.title, topic: video.topic, creatorId: video.channelTitle, sourceUrl: video.sourceUrl, role: 'REPRESENTATIVE_CASE', quality: 'HIGH', patternIds: [p.patternId], views: video.views, durationSeconds: video.durationSeconds }));
  const s = selection(p, role, patternStatus);
  const strategy = { schemaVersion: 'content-strategy.v1', strategyVersion: 'content-strategy-v1', scope: 'LONG_FORM', nicheId: 'niche-a', strategyStatus: role === 'AVOID' ? 'BLOCKED' : 'ACTIONABLE', opportunityContext: { decision, confidence: 'HIGH', entryWindow: 'OPEN', lifecycle: 'GROWING', evidenceRefs: [] }, primaryPatterns: role === 'PRIMARY' ? [s] : [], testPatterns: role === 'TEST' ? [{ ...s, role: 'TEST', priority: 'MEDIUM' }] : [], watchPatterns: role === 'WATCH' ? [{ ...s, role: 'WATCH', priority: 'LOW' }] : [], deprioritizedPatterns: [], avoidedPatterns: role === 'AVOID' ? [{ ...s, role: 'AVOID', priority: 'LOW' }] : [], insufficientPatterns: [], positioning: { direction: 'EVIDENCE_BACKED_FORMAT', summary: 'test', supportingPatternIds: [p.patternId], guardrails: [] }, experimentPlan: { status: 'READY_FOR_VALIDATION', primaryPatternIds: [p.patternId], testPatternIds: [], priorities: [], minimumEligibleSample: 5, sampleSemantics: 'ELIGIBLE_LONG_FORM_VIDEOS', evaluationMetrics: [], successCriteria: [], failureCriteria: [], calibrationStatus: 'CALIBRATION_REQUIRED' }, confidence: 'HIGH', reasons: [], risks: [], blockers: [], evidenceAudit: {}, provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', algorithmVersions: ['content-strategy-v1'], nicheId: 'niche-a', opportunityDecision: decision, opportunityEvidenceRefs: [], patternIds: [p.patternId], currentWindow: 'current', comparisonWindow: 'previous', historicalSemantics: 'PUBLICATION_COHORT', calibrationStatus: 'CALIBRATION_REQUIRED' } };
  const opportunityAssessment = { decision: { status: decision }, entryWindow: 'OPEN', confidence: 'HIGH', algorithmVersion: 'opportunity-engine-v1', dimensions: {}, reasons: [], blockers: [], provenance: { sources: [], evidenceId: null, lifecycle: 'NOT_PROVIDED', algorithmVersions: [] } };
  const patterns = { schemaVersion: 'content-patterns.v1', algorithmVersion: 'content-patterns-v1', scope: 'LONG_FORM', dataAvailability: {}, input: { receivedVideos: videos.length, longFormVideos: videos.length, excludedShorts: 0, uniqueCreators: videos.length }, candidates: cases.map(c => ({ pattern: p, sourceVideoId: c.videoId, creatorId: c.creatorId, evidence: { eligibleVideoIds: [c.videoId], creatorIds: [c.creatorId], performanceVideoIds: [], breakoutVideoIds: [], breakoutCreatorIds: [], observedFields: ['videoTitle'], missingFields: [] } })), aggregations: [aggregation(p, patternStatus)], winningPatterns: patternStatus === 'WINNING' ? [aggregation(p).winningPattern] : [], gaps: [], provenance: { source: 'PUBLIC_YOUTUBE_METADATA', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap', calibrationStatus: 'CALIBRATION_REQUIRED' } };
  const trendReport = { schemaVersion: 'content-pattern-trends.v1', algorithmVersion: 'content-pattern-trend-v1', scope: 'LONG_FORM', timeSemantics: 'PUBLICATION_COHORT', comparableWindow: { comparable: true, reason: 'ok', current: { key: 'current', start: '2026-08-01', end: '2026-08-31', timeSemantics: 'PUBLICATION_COHORT' }, previous: { key: 'previous', start: '2026-07-01', end: '2026-07-31', timeSemantics: 'PUBLICATION_COHORT' } }, currentReport: patterns, previousReport: null, assessments: [trend(p)], nicheFits: [fit(p)], selectionEvidence: [], gaps: [], provenance: { source: 'PUBLIC_YOUTUBE_METADATA', currentWindow: 'current', previousWindow: 'previous', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap', calibrationStatus: 'CALIBRATION_REQUIRED' } };
  const validation = validationState ? { algorithmVersion: 'experiment-validation-v1', observations: [{}], patternValidation: [{ patternId: p.patternId, state: validationState }], strategyValidation: { state: validationState === 'VALIDATED' ? 'PARTIALLY_VALIDATED' : 'UNDERPERFORMING' } } : { algorithmVersion: 'experiment-validation-v1', observations: [], patternValidation: [], strategyValidation: { state: 'INSUFFICIENT' } };
  return { nicheId: 'niche-a', topic: 'home studio', mechanism: 'explain a practical process', productionType: 'tutorial', opportunityAssessment, contentPatterns: patterns, contentPatternTrend: trendReport, contentStrategy: strategy, experimentValidation: validation, cases };
};

test('Primary Pattern produces traceable active Idea', () => {
  const report = buildIdeaIntelligence(base());
  assert.equal(report.algorithmVersion, IDEA_INTELLIGENCE_ALGORITHM_VERSION);
  assert.equal(report.candidates.length, 1);
  assert.equal(report.candidates[0].state, 'ACTIVE');
  assert.equal(report.candidates[0].strategyRole, 'PRIMARY');
  assert.equal(report.candidates[0].sourceCaseIds.length, 2);
  assert.equal(report.candidates[0].novelty.state, 'NOVEL');
  assert.ok(report.candidates[0].provenance.patternIds.length);
});

test('TEST Pattern is experimental and AVOID is blocked', () => {
  const testReport = buildIdeaIntelligence(base({ role: 'TEST' }));
  assert.equal(testReport.candidates[0].strategyRole, 'TEST');
  assert.ok(['READY', 'READY_WITH_CAUTION'].includes(testReport.candidates[0].validationReadiness));
  const avoidReport = buildIdeaIntelligence(base({ role: 'AVOID' }));
  assert.equal(avoidReport.candidates.length, 0);
  assert.equal(avoidReport.blockedCandidates[0].blockers[0].code, 'PATTERN_AVOIDED_BY_STRATEGY');
});

test('Entry AVOID and contradicted validation cannot produce active ideas', () => {
  const avoid = buildIdeaIntelligence(base({ decision: 'AVOID' }));
  assert.equal(avoid.candidates.length, 0);
  assert.equal(avoid.blockedCandidates[0].blockers[0].code, 'ENTRY_DECISION_AVOID');
  const contradicted = buildIdeaIntelligence(base({ validationState: 'CONTRADICTED' }));
  assert.equal(contradicted.candidates.length, 0);
  assert.ok(contradicted.blockedCandidates[0].blockers.some(item => item.code === 'CONTRADICTED_PATTERN_VALIDATION'));
});

test('same Case surface is too similar, while a different subject remains a variation', () => {
  const copied = buildIdeaIntelligence(base({ sourceTitles: ['Home studio · How to build a quiet desk'], sourceTopics: ['home studio'] }));
  assert.equal(copied.candidates.length, 0);
  assert.equal(copied.blockedCandidates[0].novelty.state, 'TOO_SIMILAR');
  const variation = buildIdeaIntelligence(base({ sourceTitles: ['How to build a garden greenhouse', 'How to build a rain barrel'], sourceTopics: ['garden', 'water collection'] }));
  assert.equal(variation.candidates.length, 1);
  assert.notEqual(variation.candidates[0].novelty.state, 'TOO_SIMILAR');
});

test('replay is deterministic and no validation data is fabricated', () => {
  const input = base();
  const first = buildIdeaIntelligence(input);
  const second = buildIdeaIntelligence(input);
  assert.deepEqual(first, second);
  assert.ok(first.gaps.some(item => item.includes('真实实验观察')));
  assert.equal(first.provenance.calibrationStatus, 'CALIBRATION_REQUIRED');
});

test('WATCH, declining trend, and one-creator evidence stay conservative', () => {
  const watch = buildIdeaIntelligence(base({ role: 'WATCH' }));
  assert.equal(watch.candidates[0].state, 'RESEARCH_ONLY');
  assert.equal(watch.candidates[0].validationReadiness, 'RESEARCH_ONLY');
  const declining = base();
  declining.contentPatternTrend.assessments[0] = trend(declining.contentPatterns.aggregations[0].pattern, 'DECLINING');
  declining.contentStrategy.primaryPatterns[0].trendState = 'DECLINING';
  const declined = buildIdeaIntelligence(declining);
  assert.equal(declined.candidates[0].state, 'RESEARCH_ONLY');
  assert.ok(declined.candidates[0].risks.some(item => item.code === 'PATTERN_DECLINING'));
  const oneCreator = base({ sourceTitles: ['How to build a quiet desk', 'How to build a studio shelf'], sourceTopics: ['desk setup', 'studio setup'] });
  oneCreator.cases.forEach(item => { item.creatorId = 'same-creator'; });
  const single = buildIdeaIntelligence(oneCreator);
  assert.notEqual(single.candidates[0].confidence, 'HIGH');
  assert.ok(single.candidates[0].risks.some(item => item.code === 'ONE_CREATOR_DOMINANCE'));
});

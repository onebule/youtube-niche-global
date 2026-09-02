import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStoryboardIntelligence, STORYBOARD_PLANNING_ALGORITHM_VERSION } from '../src/lib/storyboard-planning.ts';

const provenance = { scriptId: 'script-1', scriptVersion: 'script-writing-v1', architectureId: 'arch-1', creativeDevelopmentPackageId: 'dev-1', creativeBriefId: 'brief-1', ideaId: 'idea-1', patternIds: ['pattern:how-to'], strategyVersion: 'strategy-v1', opportunityVersion: 'opportunity-v1', sourceCaseIds: ['case-1'], evidenceIds: [], validationContext: null, algorithmVersions: ['script-writing-v1'], generatedAt: '2026-09-02T00:00:00.000Z', evaluatedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1', calibrationStatus: 'CALIBRATION_REQUIRED' };
const section = (overrides = {}) => ({ sectionId: 'section-1', index: 1, sectionRole: 'OPENING', sectionObjective: 'Explain the mechanism', narration: 'A grounded explanation.', keyPoints: ['mechanism'], evidenceRequirements: [], claimIds: [], transitionIn: 'OPENING', transitionOut: 'Enter evidence', tensionRole: 'Open question', payoffRole: 'Explain', pacingTarget: { relativeWeight: 1, durationHint: 'MEDIUM' }, visualRequirements: [], provenance: { architectureSectionId: 'section-1', narrationSource: 'DETERMINISTIC_STRUCTURAL_DRAFT', algorithmVersion: 'script-writing-v1' }, ...overrides });
const script = (overrides = {}) => ({ scriptId: 'script-1', scriptVersion: 'script-writing-v1', architectureId: 'arch-1', creativeDevelopmentPackageId: 'dev-1', creativeBriefId: 'brief-1', ideaId: 'idea-1', sections: [section()], claimRegistry: [], evidenceRegistry: [], promiseDelivery: { state: 'PROMISE_DELIVERED', promiseElements: [], unresolvedElements: [] }, pacing: { estimatedWords: 100, estimatedDurationMinutes: 1, targetWordsPerMinute: 150, introRatio: 0.1, sectionCount: 1, state: 'SUFFICIENT', calibrationStatus: 'CALIBRATION_REQUIRED', notes: [] }, originality: { state: 'ACCEPTABLE', sourceTranscriptStatus: 'UNAVAILABLE', semanticSimilarityStatus: 'UNAVAILABLE', sourceCaseIds: [], checks: { phraseOverlap: 'NOT_ASSESSED', titlePromise: 'PASS', sequenceCopy: 'PASS' }, notes: [] }, qa: { architectureComplete: true, supportedClaimCount: 0, unsupportedClaimCount: 0, researchRequiredCount: 0, unknownClaimCount: 0, repetitionCount: 0, patternFidelity: 'STRONG', evidenceCoverage: 'SUFFICIENT', findings: [] }, confidence: 'HIGH', reasons: [], risks: [], blockers: [], readiness: 'READY_FOR_STORYBOARD', provenance, ...overrides });
const run = (draft) => buildStoryboardIntelligence({ scriptDraft: draft, capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' });
const first = (draft) => run(draft).storyboards[0] || run(draft).blockedStoryboards[0];

test('ready Script Draft creates a production-planning Storyboard', () => {
  const result = first(script());
  assert.equal(result.readiness, 'READY_FOR_PRODUCTION_PLANNING');
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].shots[0].purpose, 'REVEAL');
  assert.equal(result.provenance.storyboardVersion, STORYBOARD_PLANNING_ALGORITHM_VERSION);
});

test('caution and blocked script states never become falsely ready', () => {
  assert.equal(first(script({ readiness: 'READY_WITH_CAUTION' })).readiness, 'READY_WITH_CAUTION');
  const blocked = run(script({ readiness: 'BLOCKED' }));
  assert.equal(blocked.storyboards.length, 0);
  assert.equal(blocked.blockedStoryboards[0].readiness, 'BLOCKED');
  assert.ok(blocked.blockedStoryboards[0].blockers.some(item => item.code === 'SCRIPT_BLOCKED'));
});

test('needs-revision script remains needs revision', () => assert.equal(first(script({ readiness: 'NEEDS_REVISION' })).readiness, 'NEEDS_REVISION'));

test('simple section is not split, complex independent responsibilities are split', () => {
  assert.equal(first(script()).scenes.length, 1);
  const complex = first(script({ sections: [section({ sectionRole: 'EVIDENCE', visualRequirements: ['show context; compare options; show data; reveal result'] })] }));
  assert.ok(complex.scenes.length > 1);
  assert.ok(complex.risks.some(item => item.code === 'STORYBOARD_CALIBRATION_REQUIRED') || complex.reasons.some(item => item.code === 'STORYBOARD_CALIBRATION_REQUIRED'));
});

test('supported evidence gets a traceable evidence visualization, unavailable evidence is never fabricated', () => {
  const supported = script({ sections: [section({ sectionRole: 'EVIDENCE', visualRequirements: ['show chart data'] })], claimRegistry: [{ claimId: 'claim-1', sectionId: 'section-1', text: 'The observed rate is 42%', normalizedStatement: 'the observed rate is 42', claimType: 'OBSERVED_FACT', evidenceIds: ['evidence-1'], confidence: 'HIGH', sourceType: 'PUBLIC_CASE', supportStatus: 'SUPPORTED' }], evidenceRegistry: [{ evidenceId: 'evidence-1', description: 'Public case metric', sourceType: 'PUBLIC_CASE', availability: 'DERIVABLE', sourceRefs: ['case-1'], note: 'public' }] });
  const storyboard = first(supported);
  assert.equal(storyboard.evidenceVisualizations[0].visualizationType, 'CHART');
  assert.equal(storyboard.evidenceVisualizations[0].evidenceKind, 'EVIDENCE_VISUAL');
  const unavailable = first(script({ sections: [section({ sectionRole: 'EVIDENCE', visualRequirements: ['show source screenshot'] })], claimRegistry: [{ claimId: 'claim-2', sectionId: 'section-1', text: 'Private retention proves the result', normalizedStatement: 'private retention proves result', claimType: 'UNKNOWN', evidenceIds: [], confidence: 'LOW', sourceType: 'UNKNOWN', supportStatus: 'UNKNOWN' }] }));
  assert.equal(unavailable.evidenceVisualizations[0].visualizationType, 'UNKNOWN');
  assert.notEqual(unavailable.evidenceVisualizations[0].availability, 'AVAILABLE');
});

test('illustrative B-roll stays separate from evidence visuals', () => {
  const storyboard = first(script({ sections: [section({ visualRequirements: ['supporting B-roll of a workshop'] })] }));
  assert.equal(storyboard.evidenceVisualizations.length, 0);
  assert.equal(storyboard.illustrativeVisuals[0].evidenceKind, 'ILLUSTRATIVE_VISUAL');
});

test('quantitative data without a source does not invent a chart', () => {
  const storyboard = first(script({ sections: [section({ sectionRole: 'EVIDENCE', visualRequirements: ['chart of retention metrics'] })] }));
  assert.equal(storyboard.scenes[0].semanticScene.suggestedVisualMode, 'UNKNOWN');
  assert.ok(!storyboard.scenes[0].shots.some(shot => shot.visualMode === 'CHART'));
});

test('recurring character, environment and prop requirements deduplicate', () => {
  const repeated = script({ sections: [section({ visualRequirements: ['host in the workshop uses the key tool'] }), section({ sectionId: 'section-2', index: 2, sectionRole: 'PROCESS', visualRequirements: ['host returns to the workshop with the key tool'] })] });
  const storyboard = first(repeated);
  assert.equal(storyboard.continuity.characters.length, 1);
  assert.equal(storyboard.continuity.environments.length, 1);
  assert.equal(storyboard.continuity.props.length, 1);
  assert.equal(storyboard.assetRequirements.filter(item => item.type === 'CHARACTER').length, 1);
});

test('temporal shift, archive rights and AI-generatable visual remain explicit', () => {
  const storyboard = first(script({ sections: [section({ visualRequirements: ['historical archive footage; later show an AI-generated visual'] }), section({ sectionId: 'section-2', index: 2, sectionRole: 'RESULT', transitionIn: 'next day', visualRequirements: ['show the result'] })] }));
  assert.ok(storyboard.continuity.relations.some(item => item.relation === 'TIME_SHIFT'));
  assert.ok(storyboard.assetRequirements.some(item => item.type === 'ARCHIVE' && item.rightsStatus === 'RIGHTS_REVIEW_REQUIRED'));
  assert.ok(storyboard.assetRequirements.some(item => item.source === 'AI_GENERATABLE'));
  assert.ok(storyboard.risks.some(item => item.code === 'RIGHTS_STATUS_UNKNOWN'));
});

test('known rights blocker blocks the storyboard', () => {
  const result = run(script({ sections: [section({ visualRequirements: ['known rights blocker for source footage'] })] }));
  assert.equal(result.storyboards.length, 0);
  assert.equal(result.blockedStoryboards[0].readiness, 'BLOCKED');
  assert.ok(result.blockedStoryboards[0].blockers.some(item => item.code === 'KNOWN_RIGHTS_BLOCKER'));
});

test('replay is deterministic and no Canvas/prompt integration exists', () => {
  const draft = script({ sections: [section({ visualRequirements: ['show evidence chart'] })] });
  const a = run(draft).storyboards[0];
  const b = run(draft).storyboards[0];
  assert.deepEqual(a, b);
  assert.equal('canvas' in a, false);
  assert.equal(a.scenes.some(scene => scene.shots.some(shot => /prompt/i.test(JSON.stringify(shot)))), false);
});

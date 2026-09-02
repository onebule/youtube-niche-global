import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScriptWritingIntelligence, SCRIPT_WRITING_ALGORITHM_VERSION } from '../src/lib/script-writing.ts';

const packageFixture = (overrides = {}) => ({
  packageId: 'script-architecture-package-1', packageVersion: 'script-development-v1', creativeDevelopmentPackageId: 'creative-package-1', briefId: 'brief-1', ideaId: 'idea-1',
  scriptArchitecture: { architectureId: 'architecture-1', structureType: 'EXPLAINER', patternId: 'pattern:how-to', sectionIds: ['section-1', 'section-2', 'section-3', 'section-4'], patternFidelity: 'STRONG', sourceSequenceOverlap: 'REVIEW' },
  sections: [
    { sectionId: 'section-1', index: 1, role: 'OPENING', objective: 'Define the question', responsibility: 'Establish the viewer question', narrationBeats: [], evidenceRequirements: [{ evidenceId: 'e1', kind: 'PUBLIC_CASE', description: 'Public case evidence', status: 'DERIVABLE', state: 'PARTIAL', blocking: false, sourceRefs: ['case:c1'], note: 'Public case' }], tensionPlan: { phase: 'INTRODUCE', unresolvedQuestion: 'What is the mechanism?', escalationFunction: 'Open the question', releaseCondition: 'Enter mechanism' }, payoffPlan: { payoffType: 'NONE', expectedSectionId: null, deliveryResponsibility: 'No final conclusion here', evidenceBoundary: 'Public evidence only' }, promiseDelivery: [{ promiseElement: 'Explain the mechanism', deliverySectionIds: ['section-4'], state: 'COMPLETE', note: 'Mapped' }], sceneRequirements: [], visualRequirements: [], transitionPurpose: 'Enter mechanism', pacing: { relativeWeight: 0.25, durationHint: 'SHORT' } },
    { sectionId: 'section-2', index: 2, role: 'MECHANISM', objective: 'Explain the mechanism', responsibility: 'Build the causal explanation', narrationBeats: [], evidenceRequirements: [{ evidenceId: 'e2', kind: 'PUBLIC_CASE', description: 'Mechanism evidence', status: 'DERIVABLE', state: 'PARTIAL', blocking: false, sourceRefs: ['case:c1'], note: 'Public case' }], tensionPlan: { phase: 'BUILD', unresolvedQuestion: 'How does it work?', escalationFunction: 'Build explanation', releaseCondition: 'Test evidence' }, payoffPlan: { payoffType: 'EXPLANATION', expectedSectionId: 'section-2', deliveryResponsibility: 'Explain the mechanism', evidenceBoundary: 'Public evidence only' }, promiseDelivery: [], sceneRequirements: [], visualRequirements: [], transitionPurpose: 'Test evidence', pacing: { relativeWeight: 0.25, durationHint: 'MEDIUM' } },
    { sectionId: 'section-3', index: 3, role: 'EVIDENCE', objective: 'Check the evidence', responsibility: 'Test boundaries and counterexamples', narrationBeats: [], evidenceRequirements: [{ evidenceId: 'e3', kind: 'PUBLIC_CASE', description: 'Comparable public case', status: 'DERIVABLE', state: 'PARTIAL', blocking: false, sourceRefs: ['case:c2'], note: 'Public case' }], tensionPlan: { phase: 'ESCALATE', unresolvedQuestion: 'Where does it fail?', escalationFunction: 'Test the claim', releaseCondition: 'Resolve' }, payoffPlan: { payoffType: 'NONE', expectedSectionId: null, deliveryResponsibility: 'No final conclusion here', evidenceBoundary: 'Public evidence only' }, promiseDelivery: [], sceneRequirements: [], visualRequirements: [], transitionPurpose: 'Summarize', pacing: { relativeWeight: 0.25, durationHint: 'MEDIUM' } },
    { sectionId: 'section-4', index: 4, role: 'RESOLUTION', objective: 'State the limits', responsibility: 'Resolve the question with boundaries', narrationBeats: [], evidenceRequirements: [{ evidenceId: 'e4', kind: 'PUBLIC_CASE', description: 'Public boundary evidence', status: 'DERIVABLE', state: 'PARTIAL', blocking: false, sourceRefs: ['case:c1', 'case:c2'], note: 'Public case' }], tensionPlan: { phase: 'RESOLVE', unresolvedQuestion: 'What can we conclude?', escalationFunction: 'Close the question', releaseCondition: 'State limitations' }, payoffPlan: { payoffType: 'TAKEAWAY', expectedSectionId: 'section-4', deliveryResponsibility: 'Complete the promise', evidenceBoundary: 'Public evidence only' }, promiseDelivery: [], sceneRequirements: [], visualRequirements: [], transitionPurpose: 'End', pacing: { relativeWeight: 0.25, durationHint: 'SHORT' } },
  ],
  evidencePlan: {}, promiseDelivery: [{ promiseElement: 'Explain the mechanism', deliverySectionIds: ['section-4'], state: 'COMPLETE', note: 'Mapped' }], pacingPlan: [], originalityGuardrails: { inheritedGate: 'PASSED', sourceCaseIds: ['c1', 'c2'] }, mandatoryConstraints: [], flexibleVariables: [], confidence: 'HIGH', blockers: [], risks: [], readiness: 'READY_FOR_SCRIPT_WRITING', provenance: { packageId: 'script-architecture-package-1', patternIds: ['pattern:how-to'], strategyVersion: 'strategy-v1', opportunityVersion: 'opportunity-v1', sourceCaseIds: ['c1', 'c2'], evaluatedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' }, ...overrides,
});
const report = (packages) => ({ schemaVersion: 'script-development.v1', algorithmVersion: 'script-development-v1', scope: 'LONG_FORM', packages, blockedPackages: [], gaps: [], provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' } });

test('strong architecture creates an editable draft ready for storyboard', () => {
  const result = buildScriptWritingIntelligence({ scriptDevelopment: report([packageFixture()]), validationFeedbackVersion: 'validation-v1' });
  assert.equal(result.algorithmVersion, SCRIPT_WRITING_ALGORITHM_VERSION);
  const draft = result.drafts[0];
  assert.equal(draft.readiness, 'READY_FOR_STORYBOARD');
  assert.equal(draft.promiseDelivery.state, 'PROMISE_DELIVERED');
  assert.ok(draft.opening.narration.length > 0);
  assert.equal(draft.claimRegistry.length, 4);
});

test('unsupported narration is flagged and cannot remain ready', () => {
  const result = buildScriptWritingIntelligence({ scriptDevelopment: report([packageFixture()]), narrationOverrides: { 'section-1': 'This format has the highest retention and proves everything.' } });
  const draft = result.drafts[0];
  assert.equal(draft.readiness, 'NEEDS_REVISION');
  assert.ok(draft.qa.unsupportedClaimCount > 0);
  assert.ok(draft.qa.findings.includes('SCRIPT_UNSUPPORTED_CLAIM'));
});

test('research-required claims stay explicit without invented facts', () => {
  const missing = packageFixture({ sections: packageFixture().sections.map(section => ({ ...section, evidenceRequirements: [{ ...section.evidenceRequirements[0], status: 'REQUIRES_TRANSCRIPT', kind: 'TRANSCRIPT', description: 'Transcript evidence' }] })) });
  const draft = buildScriptWritingIntelligence({ scriptDevelopment: report([missing]) }).drafts[0];
  assert.equal(draft.qa.researchRequiredCount, 1);
  assert.equal(draft.readiness, 'READY_WITH_CAUTION');
  assert.ok(draft.claimRegistry.every(claim => claim.claimType === 'UNKNOWN'));
});

test('promise failure requires revision and duplicate sections are surfaced', () => {
  const broken = packageFixture({ promiseDelivery: [{ promiseElement: 'Missing promise', deliverySectionIds: [], state: 'MISSING', note: 'No delivery' }], sections: packageFixture().sections.map(section => ({ ...section, narrationBeats: [], responsibility: 'Repeat the same explanation' })) });
  const draft = buildScriptWritingIntelligence({ scriptDevelopment: report([broken]), narrationOverrides: Object.fromEntries(packageFixture().sections.map(section => [section.sectionId, 'Repeat the same explanation every time.'])) }).drafts[0];
  assert.equal(draft.promiseDelivery.state, 'PROMISE_NOT_DELIVERED');
  assert.equal(draft.readiness, 'NEEDS_REVISION');
  assert.ok(draft.qa.repetitionCount > 0);
});

test('replay is deterministic and transcript/embedding gaps are visible', () => {
  const input = { scriptDevelopment: report([packageFixture()]), capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' };
  const first = buildScriptWritingIntelligence(input);
  const second = buildScriptWritingIntelligence(input);
  assert.deepEqual(first, second);
  assert.ok(first.gaps.some(gap => gap.includes('SOURCE_TRANSCRIPT_UNAVAILABLE')));
  assert.ok(first.gaps.some(gap => gap.includes('SEMANTIC_SIMILARITY_UNAVAILABLE')));
});

test('identical claims are merged while retaining all evidence links', () => {
  const duplicate = packageFixture({ sections: packageFixture().sections.map(section => ({ ...section, evidenceRequirements: [{ ...section.evidenceRequirements[0], description: 'Same public claim' }] })) });
  const draft = buildScriptWritingIntelligence({ scriptDevelopment: report([duplicate]) }).drafts[0];
  assert.equal(draft.claimRegistry.length, 1);
  assert.equal(draft.claimRegistry[0].evidenceIds.length, 4);
});

test('Long-form script writing remains isolated from Shorts and Canvas', () => {
  const result = buildScriptWritingIntelligence({ scriptDevelopment: report([packageFixture()]) });
  assert.equal(result.scope, 'LONG_FORM');
  assert.ok(result.gaps.some(gap => gap.includes('Canvas')));
  assert.equal(result.drafts[0].scriptVersion, 'script-writing-v1');
});

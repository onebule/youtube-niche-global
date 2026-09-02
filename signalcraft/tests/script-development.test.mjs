import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScriptDevelopmentIntelligence, SCRIPT_DEVELOPMENT_ALGORITHM_VERSION } from '../src/lib/script-development.ts';

const pkg = (overrides = {}) => ({
  packageId: 'creative-development-v1:pkg-1', packageVersion: 'creative-development-v1', briefId: 'brief-1', ideaId: 'idea-1',
  titleDirection: { directionId: 'title-1', structureType: 'HOW_X', angle: 'A new process', sourcePatternId: 'pattern:how-to', promiseType: 'PROCESS', tensionType: 'TRANSFORMATION' },
  hookIntelligence: { hookStructure: 'PROBLEM_CONSEQUENCE_PROMISE' }, openingPromise: { statement: 'Understand the process', requiredDelivery: ['Understand the process'] },
  firstBeat: {}, outline: { outlineId: 'outline-1', structureType: 'EXPLAINER', beats: [{ role: 'SETUP', objective: 'Define the goal', informationRequirement: 'Public inputs', tensionFunction: 'Open question', evidenceRequirement: 'Public metadata', transitionPurpose: 'Enter process' }, { role: 'PROCESS', objective: 'Explain steps', informationRequirement: 'Process evidence', tensionFunction: 'Expose difficulty', evidenceRequirement: 'Public case', transitionPurpose: 'Check result' }, { role: 'EVIDENCE', objective: 'Verify result', informationRequirement: 'Comparable sample', tensionFunction: 'Test promise', evidenceRequirement: 'Public case', transitionPurpose: 'Summarize' }, { role: 'TAKEAWAY', objective: 'Summarize limits', informationRequirement: 'Boundary', tensionFunction: 'Close question', evidenceRequirement: 'Public metadata', transitionPurpose: 'End' }], promiseCoverage: { covered: true, coveredElements: ['content promise'], uncoveredElements: [] } },
  originalityGuardrails: { gate: 'PASSED', checks: { sequenceOverlap: 'REVIEW' }, sourceCaseIds: ['case-1', 'case-2'] }, mandatoryConstraints: [], flexibleVariables: [], consistency: { outlinePattern: 'CONSISTENT' }, confidence: 'HIGH', blockers: [], risks: [], readiness: 'READY_FOR_SCRIPT_DEVELOPMENT', provenance: { packageId: 'creative-development-v1:pkg-1', briefId: 'brief-1', briefVersion: 'creative-brief-v1', ideaId: 'idea-1', ideaVersion: 'idea-validation-v1', sourceCaseIds: ['case-1', 'case-2'], patternIds: ['pattern:how-to'], strategyVersion: 'strategy-v1', opportunityVersion: 'opportunity-v1', evaluatedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' }, ...overrides,
});

const report = (packages) => ({ schemaVersion: 'creative-development.v1', algorithmVersion: 'creative-development-v1', scope: 'LONG_FORM', packages, blockedPackages: [], gaps: [], provenance: { source: 'MIXED_PUBLIC_AND_UPSTREAM', capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' } });

test('strong explainer creates a ready architecture without final prose', () => {
  const result = buildScriptDevelopmentIntelligence({ creativeDevelopment: report([pkg()]) });
  assert.equal(result.algorithmVersion, SCRIPT_DEVELOPMENT_ALGORITHM_VERSION);
  const item = result.packages[0];
  assert.equal(item.readiness, 'READY_FOR_SCRIPT_WRITING');
  assert.equal(item.scriptArchitecture.structureType, 'EXPLAINER');
  assert.equal(item.sections.length, 4);
  assert.equal(item.sections[0].narrationBeats[0].isFinalProse, false);
  assert.equal(item.sections[0].narrationBeats[0].isFinalProse, false);
  assert.match(item.mandatoryConstraints.join(' '), /不输出最终旁白/);
});

test('comparison keeps criteria, options, trade-off and conclusion', () => {
  const comparison = pkg({ outline: { ...pkg().outline, structureType: 'COMPARISON', beats: [] }, titleDirection: { ...pkg().titleDirection, structureType: 'COMPARISON' } });
  const item = buildScriptDevelopmentIntelligence({ creativeDevelopment: report([comparison]) }).packages[0];
  assert.deepEqual(item.sections.map(section => section.role), ['CRITERIA', 'OPTION_A', 'OPTION_B', 'TRADE_OFF', 'CONCLUSION']);
});

test('promise failure and upstream block never become ready', () => {
  const broken = pkg({ outline: { ...pkg().outline, promiseCoverage: { covered: false, coveredElements: [], uncoveredElements: ['content promise'] } } });
  const result = buildScriptDevelopmentIntelligence({ creativeDevelopment: report([broken]), entryDecision: 'AVOID' });
  assert.equal(result.packages.length, 0);
  assert.equal(result.blockedPackages[0].readiness, 'BLOCKED');
  assert.ok(result.blockedPackages[0].blockers.some(item => item.code === 'PROMISE_COVERAGE_FAILED'));
});

test('transcript and visual limits remain explicit', () => {
  const item = buildScriptDevelopmentIntelligence({ creativeDevelopment: report([pkg({ outline: { ...pkg().outline, beats: [{ role: 'OPENING', objective: 'Hook transcript', informationRequirement: 'Transcript and visual evidence', tensionFunction: 'Question', evidenceRequirement: 'Transcript and visual', transitionPurpose: 'Continue' }] } })]) }).packages[0];
  assert.ok(item.evidencePlan.requirements.some(req => req.status === 'REQUIRES_TRANSCRIPT'));
  assert.ok(item.evidencePlan.requirements.some(req => req.status === 'REQUIRES_VISION'));
  assert.ok(item && item.evidencePlan.gaps > 0);
});

test('replay is deterministic and sequence overlap is review, not a fabricated pass', () => {
  const input = { creativeDevelopment: report([pkg()]), capturedAt: '2026-09-02T00:00:00.000Z', snapshotId: 'snap-1' };
  const first = buildScriptDevelopmentIntelligence(input);
  const second = buildScriptDevelopmentIntelligence(input);
  assert.deepEqual(first, second);
  assert.equal(first.packages[0].scriptArchitecture.sourceSequenceOverlap, 'REVIEW');
});

test('Shorts and Canvas are isolated by Long-form scope and explicit gaps', () => {
  const result = buildScriptDevelopmentIntelligence({ creativeDevelopment: report([pkg()]) });
  assert.equal(result.scope, 'LONG_FORM');
  assert.ok(result.gaps.some(gap => gap.includes('Canvas')));
  assert.equal(result.packages[0].provenance.scriptArchitectureVersion, 'script-development-v1');
});

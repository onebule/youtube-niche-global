import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeLongformProduction } from '../src/lib/production-materialization.ts';

const base = (overrides = {}) => ({
  key: '教育|explainer|UNKNOWN_PRODUCTION', topic: '教育', mechanism: 'explainer', productionType: '待识别制作方式', sampleSize: 3, channelCount: 1,
  representativeVideos: [], lanes: [], confidence: 54, confidenceLabel: 'MEDIUM', metrics: {}, execution: { score: 39, coverage: 50, rationale: '' },
  ...overrides,
});

test('an opportunity without P3/P4 production objects remains explicitly insufficient', () => {
  const result = materializeLongformProduction({ opportunity: base(), now: '2026-09-02T03:00:00.000Z' });
  assert.equal(result.selection, 'EXPLICIT_USER_SELECTED');
  assert.equal(result.state, 'INSUFFICIENT_UPSTREAM_DATA');
  assert.deepEqual(result.blockers, ['CREATIVE_BRIEF_REQUIRED']);
  assert.equal(result.stages.creativeBrief.id, null);
  assert.equal(result.stages.generationUnit.id, null);
});

test('materialization is deterministic for the same opportunity snapshot', () => {
  const opportunity = base({ upstreamAssessment: { snapshotId: 'snapshot-1', capturedAt: '2026-09-02T02:00:00.000Z' } });
  const a = materializeLongformProduction({ opportunity, now: '2026-09-02T03:00:00.000Z' });
  const b = materializeLongformProduction({ opportunity, now: '2026-09-02T04:00:00.000Z' });
  assert.equal(a.productionDraftId, b.productionDraftId);
  assert.equal(a.opportunityId, opportunity.key);
  assert.equal(a.stages.providerRouting.availableRoutes, 0);
});

test('a complete real chain is represented without provider execution', () => {
  const opportunity = base({
    creativeBriefIntelligence: { briefs: [{ briefId: 'brief:real', readiness: 'READY_FOR_CREATIVE_DEVELOPMENT' }] },
    scriptWriting: { drafts: [{ scriptId: 'script:real', architectureId: 'arch:real', readiness: 'READY_FOR_STORYBOARD' }] },
    storyboardIntelligence: { storyboards: [{ storyboardId: 'storyboard:real', readiness: 'READY_FOR_PRODUCTION_PLANNING', scenes: [{ feasibility: 'FEASIBLE', shots: [{ shotId: 'shot:real' }] }] }] },
    visualAssetIntelligence: { packages: [{ readiness: 'READY_FOR_PROMPT_PLANNING', assets: [], references: [], missingAssets: [], rightsReviews: [] }] },
    visualGenerationSpecifications: { specifications: [{ specificationId: 'vgs:real', readiness: 'READY_WITH_CAUTION', units: [{ unitId: 'vgs:real:unit:1', referenceDependencyIds: [] }] }] },
    providerRouting: { routes: [{ decisions: [{ compatibleModels: [{ modelId: 'minimax-h3', state: 'COMPATIBLE' }] }] }] },
  });
  const result = materializeLongformProduction({ opportunity, now: '2026-09-02T03:00:00.000Z' });
  assert.equal(result.state, 'READY_FOR_MANUAL_SMOKE_TEST');
  assert.equal(result.stages.generationUnit.id, 'vgs:real:unit:1');
  assert.deepEqual(result.stages.providerRouting.compatibleModels, ['minimax-h3']);
  assert.equal(result.stages.execution, 'RUNTIME_GATES_REQUIRED');
});

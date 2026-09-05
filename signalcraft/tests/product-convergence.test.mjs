import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProfile, DISCOVERY_RULES, entryWindow, marketDecision, creatorFit, recommend, differentiation, firstTests, buildProductionHandoff, addReviewedShortTest, fromRadar } from '../src/lib/product-convergence.ts';
import { buildNicheEvaluationHref, contextFromQuery, saveNicheAnalysisContext, readNicheAnalysisContext } from '../src/lib/niche-analysis-context.ts';

function unit(id = 'a', format = 'SHORTS', patch = {}) {
  return { id, format, niche: 'Science', subNiche: 'Everyday materials', pattern: { id: 'pattern-1', label: 'Compare evidence', trend: 'GROWING', provenance: 'TEST_FIXTURE' },
    market: { videos: 12, creators: 5, previousVideos: 8, windowDays: 14, growth: 30, concentration: 20, lifecycle: 'CONFIRMED', confidence: 'HIGH', quality: 'COMPLETE', facts: ['Public evidence'], evidenceVideoIds: ['aaaaaaaaaaa'], provenance: 'TEST_FIXTURE', capturedAt: null },
    requirements: {}, originality: { risk: 'UNKNOWN', reason: 'No evidence' }, tests: [], ...patch };
}
function testItem(id, format = 'SHORTS', patch = {}) {
  return { id, format, group: 'CORE', direction: 'Materials', audienceQuestion: 'Question ' + id, patternId: 'pattern-1', pattern: 'Compare evidence', promise: 'Check a claim', differentiation: ['Use new evidence'], evidenceNeeded: ['Independent source'], visualDirection: 'Show evidence', difficulty: 'UNKNOWN', mainRisk: 'Unverified claim', whyTest: 'Evidence gap', sourceVideoIds: ['aaaaaaaaaaa'], provenance: 'EXISTING_IDEA_EVIDENCE', ...patch };
}
test('profile stays six fields and rejects unknown/invalid values', () => {
  assert.deepEqual(normalizeProfile({ format: 'BOTH', aiSkill: 'EXPERT', email: 'private', goal: 'ADS' }), { format: 'BOTH', goal: 'ADS' });
});
test('format-specific pools and thresholds never cross', () => {
  assert.notEqual(DISCOVERY_RULES.SHORTS, DISCOVERY_RULES.LONG_FORM);
  assert.notEqual(DISCOVERY_RULES.SHORTS.openGrowth, DISCOVERY_RULES.LONG_FORM.openGrowth);
  const short = unit('short'), long = unit('long', 'LONG_FORM');
  assert.equal(recommend([short, long], {}, 'SHORTS').market.length, 1);
  assert.equal(recommend([short, long], {}, 'SHORTS').market[0].unit.id, 'short');
  assert.equal(DISCOVERY_RULES.LONG_FORM.calibrationStatus, 'CALIBRATION_REQUIRED');
});
test('entry windows have independent growth thresholds and require baselines', () => {
  const a = unit(); a.market.growth = 20;
  assert.equal(entryWindow(a), 'UNDETERMINED');
  assert.equal(entryWindow({ ...a, format: 'LONG_FORM' }), 'OPEN');
  a.market.previousVideos = 0; a.market.lifecycle = 'DECLINING';
  assert.equal(entryWindow(a), 'UNDETERMINED');
});
test('missing and stale evidence are INSUFFICIENT, never AVOID', () => {
  const a = unit(); a.market.quality = 'INSUFFICIENT'; a.market.lifecycle = 'DECLINING';
  assert.equal(marketDecision(a), 'INSUFFICIENT');
  a.market.quality = 'STALE'; assert.equal(marketDecision(a), 'INSUFFICIENT');
});
test('diluting patterns cannot be shown as growing recommendations', () => {
  const a = unit(); a.pattern.trend = 'DILUTING';
  assert.equal(marketDecision(a), 'DEPRIORITIZE'); assert.equal(a.pattern.trend, 'DILUTING');
});
test('broad categories are research leads, not final actionable recommendations', () => {
  assert.equal(marketDecision(unit('a', 'SHORTS', { subNiche: null })), 'WATCH');
  assert.equal(marketDecision(unit('a', 'SHORTS', { pattern: null })), 'WATCH');
});
test('deterministic 3+1 with no duplicate or padded opportunities', () => {
  const input = ['e', 'd', 'c', 'b', 'a'].map(id => unit(id, 'SHORTS', { niche: id === 'd' ? 'Pets' : 'Science' }));
  const a = recommend(input, {}, 'SHORTS'), b = recommend([...input].reverse(), {}, 'SHORTS');
  assert.deepEqual(a.top.map(x => x.unit.id), ['a', 'b', 'c']);
  assert.equal(a.explore.unit.id, 'd'); assert.deepEqual(a.top, b.top);
  assert.equal(recommend(input.slice(0, 1), {}, 'SHORTS').explore, null);
});
test('creator conditions can reorder known production requirements without changing global market order', () => {
  const a = unit('a', 'LONG_FORM', { requirements: { presence: 'ON_CAMERA', source: 'Reviewed production requirements' } });
  const b = unit('b', 'LONG_FORM', { requirements: { presence: 'FACELESS', source: 'Reviewed production requirements' } });
  const before = JSON.stringify([a, b]);
  const face = recommend([a, b], { presence: 'FACELESS' }, 'LONG_FORM');
  const camera = recommend([a, b], { presence: 'ON_CAMERA' }, 'LONG_FORM');
  assert.equal(face.top[0].unit.id, 'b'); assert.equal(camera.top[0].unit.id, 'a');
  assert.deepEqual(face.market.map(x => x.unit.id), camera.market.map(x => x.unit.id));
  assert.equal(JSON.stringify([a, b]), before);
});
test('blank profile and unknown production requirements never become strong fit', () => {
  const a = unit(); assert.equal(creatorFit(a, {}).level, 'UNKNOWN');
  assert.equal(creatorFit(a, { weeklyTime: 'HIGH', aiSkill: 'ADVANCED', budget: 'HIGH' }).level, 'UNKNOWN');
  const result = creatorFit(a, { format: 'SHORTS' });
  assert.ok(result.reasons.every(reason => reason.source && reason.evidence && reason.field));
  assert.ok(result.reasons.length <= 3);
});
test('high originality requires explicit review and offers only 2–3 changes', () => {
  const a = unit('a', 'SHORTS', { originality: { risk: 'HIGH', reason: 'Too similar' }, tests: [testItem('t')] });
  assert.equal(differentiation(a).requiresReview, true); assert.equal(differentiation(a).axes.length, 3);
  assert.equal(buildProductionHandoff(a, {}, 't', false), null);
  const handoff = buildProductionHandoff(a, {}, 't', true);
  assert.equal(handoff.test.id, 't'); assert.equal(handoff.automaticGeneration, false);
  assert.equal(handoff.originalityReviewed, true);
});
test('selected test risk wins over the first low-risk candidate', () => {
  const a = unit('a', 'SHORTS', { originality: { risk: 'LOW', reason: 'First candidate only' }, tests: [testItem('low'), testItem('high', 'SHORTS', { originalityRisk: 'HIGH', originalityReason: 'Selected candidate is too similar' })] });
  assert.equal(buildProductionHandoff(a, {}, 'high', false), null);
  const out = buildProductionHandoff(a, {}, 'high', true);
  assert.equal(out.test.id, 'high');
  assert.equal(out.opportunity.originality.risk, 'HIGH');
});
test('test plans deduplicate audience questions, require evidence and never pad', () => {
  const a = unit('a', 'SHORTS', { tests: [testItem('a'), testItem('a'), testItem('bad', 'LONG_FORM'), testItem('missing', 'SHORTS', { sourceVideoIds: [] })] });
  assert.equal(firstTests(a).length, 1);
  assert.equal(firstTests(unit()).length, 0);
});
test('Shorts 4/3/3 and long-form First 3 stay independent', () => {
  const many = Array.from({ length: 15 }, (_, i) => testItem('t' + i, 'SHORTS', { group: i < 5 ? 'CORE' : i < 10 ? 'ADAPTATION' : 'EXPLORE' }));
  const selected = firstTests(unit('a', 'SHORTS', { tests: many }));
  assert.equal(selected.length, 10);
  assert.deepEqual(['CORE', 'ADAPTATION', 'EXPLORE'].map(group => selected.filter(t => t.group === group).length), [4, 3, 3]);
  const longs = many.map(t => ({ ...t, format: 'LONG_FORM' }));
  assert.equal(firstTests(unit('b', 'LONG_FORM', { tests: longs })).length, 3);
});
test('reviewed Shorts hypotheses preserve all market facts and require a real carried source', () => {
  const a = unit('a', 'SHORTS', { subNiche: null });
  const input = { id: 't', subNiche: 'Kitchen materials', question: 'What melts first?', promise: 'Compare two materials', sourceVideoId: 'aaaaaaaaaaa', group: 'CORE' };
  assert.equal(addReviewedShortTest(a, { ...input, sourceVideoId: 'wrong' }), null);
  const next = addReviewedShortTest(a, input);
  assert.deepEqual(next.market, a.market); assert.equal(a.tests.length, 0);
  assert.equal(next.tests[0].provenance, 'USER_CONFIRMED_HYPOTHESIS');
  assert.equal(addReviewedShortTest(next, input), null);
});
test('production handoff is explicit, format-locked, complete and blocks avoid decisions', () => {
  const a = unit('a', 'LONG_FORM', { tests: [testItem('a', 'LONG_FORM')] });
  const out = buildProductionHandoff(a, { format: 'LONG_FORM' }, 'a', false);
  assert.equal(out.opportunity.id, 'a'); assert.equal(out.test.format, 'LONG_FORM');
  assert.equal(out.entryWindow, 'OPEN'); assert.equal(out.creatorProfile.format, 'LONG_FORM');
  assert.deepEqual(out.opportunity.market, a.market);
  a.market.lifecycle = 'DECLINING'; assert.equal(buildProductionHandoff(a, {}, 'a', true), null);
});
test('radar does not invent sub-niches, patterns, originality, or tests', () => {
  const e = { id: 'e', topic: 'Pets', format: 'LONG_FORM', lifecycle: 'CONFIRMED', sampleVideoCount: 8, independentChannelCount: 4, baseline: { previousSampleCount: 4, windowDays: 14 }, metrics: {}, confidence: 'HIGH', dataQuality: 'COMPLETE', facts: [], evidenceVideoIds: ['aaaaaaaaaaa'], evidence: { provenance: 'Public' } };
  const a = fromRadar(e, 'LONG_FORM');
  assert.equal(a.subNiche, null); assert.equal(a.pattern, null); assert.equal(a.originality.risk, 'UNKNOWN'); assert.deepEqual(a.tests, []);
});
test('account-scoped handoff rejects another identity, same-title different format, or different event', () => {
  const oldWindow = globalThis.window, oldStorage = globalThis.localStorage;
  const local = new Map(), session = new Map();
  globalThis.localStorage = { getItem: key => local.get(key) || null };
  globalThis.window = { sessionStorage: { getItem: key => session.get(key) || null, setItem: (key, value) => session.set(key, value) } };
  try {
    local.set('signalcraft-auth-v1', JSON.stringify({ accessToken: 'unit-test-only', userId: 'alice', email: 'alice@example.test' }));
    const context = { nicheId: 'a', nicheName: 'Science', contentType: 'SHORT_FORM', source: 'TREND_RADAR', discovery: { unit: unit(), creatorProfile: { budget: 'LOW' } } };
    saveNicheAnalysisContext(context);
    const url = new URL(buildNicheEvaluationHref(context), 'https://local.test');
    assert.equal(contextFromQuery(url.searchParams).discovery.unit.id, 'a');
    url.searchParams.set('type', 'long'); assert.equal(contextFromQuery(url.searchParams).discovery, undefined);
    url.searchParams.set('type', 'short'); url.searchParams.set('nicheId', 'b'); assert.equal(contextFromQuery(url.searchParams).discovery, undefined);
    local.set('signalcraft-auth-v1', JSON.stringify({ accessToken: 'unit-test-only', userId: 'bob', email: 'bob@example.test' }));
    assert.equal(readNicheAnalysisContext(), null);
  } finally { globalThis.window = oldWindow; globalThis.localStorage = oldStorage; }
});

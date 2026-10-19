import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfiniteProject, createInfiniteNode } from '../src/lib/infinite-canvas-graph.ts';
import { bridgePreexistingVideoAgentPlan } from '../src/lib/studio-agent-plan-bridge.ts';
import { confirmStudioAgentPatch } from '../src/lib/studio-agent-tools.ts';

function fixture() {
  const project = createInfiniteProject('studio');
  const node = createInfiniteNode('v1', 'video', 300, 200);
  project.nodes.push(node);
  return project;
}
function source(overrides = {}) {
  return {
    kind: 'video-generation-plan',
    autoGenerate: false,
    model: 'minimax-h3',
    director: { id: 'gpt', mode: 'agent-v1' },
    prompt: 'Nilo repairs a weathered brass bell. Keep his ivory panels and teal joints consistent.',
    reasoning: 'Character Bible is the continuity reference.',
    suggestedActions: [{ type:'shot.create' }],
    warnings: ['Review subject identity'],
    agentFallback: false,
    ...overrides,
  };
}
function ids() { let i = 0; return () => 'bridge-id-' + ++i; }
test('adapts real-plan-shaped JSON without network or changing prior project', () => {
  const base = fixture(), snapshot = JSON.stringify(base);
  const review = bridgePreexistingVideoAgentPlan(base, 'v1', JSON.stringify({plan:source()}), ids());
  assert.equal(review.modelSuggestion, 'minimax-h3');
  assert.equal(review.ignoredLegacyActions, 1);
  assert.equal(review.proposal.providerCalls, 0);
  assert.equal(review.proposal.executionEnabled, false);
  assert.equal(review.proposal.next.nodes[0].video.model, null);
  assert.equal(review.proposal.next.nodes[0].video.prompt, source().prompt);
  assert.equal(review.proposal.next.nodes.at(-1).kind, 'note');
  assert.equal(review.proposal.next.edges.length, 0);
  assert.equal(JSON.stringify(base), snapshot);
  assert.equal(confirmStudioAgentPatch(base, review.proposal).nodes.length, 2);
});
test('legacy actions are ignored, not reinterpreted as paid or destructive graph commands', () => {
  const base = fixture();
  const review = bridgePreexistingVideoAgentPlan(base,'v1',source({
    suggestedActions:[{ type:'shot.delete' },{ type:'canvas.organize' }],
  }),ids());
  assert.equal(review.ignoredLegacyActions,2);
  assert.equal(review.proposal.next.nodes.some(n=>n.kind==='video-result'),false);
  assert.equal(review.proposal.next.nodes.find(n=>n.id==='v1').kind,'video');
});
test('locked model mismatch stops conversion atomically', () => {
  const base=fixture();
  base.nodes[0].video.model='kling-3';
  const before=JSON.stringify(base);
  assert.throws(()=>bridgePreexistingVideoAgentPlan(base,'v1',source(),ids()),/锁定模型/);
  assert.equal(JSON.stringify(base),before);
});
test('auto generation is always denied and untrusted prompt is bounded', () => {
  const base=fixture();
  for(const invalid of [
    {autoGenerate:true},
    {autoGenerate:undefined},
    {prompt:'a'.repeat(1201)},
    {prompt:''},
    {model:42},
    {kind:'other'},
  ]) assert.throws(()=>bridgePreexistingVideoAgentPlan(base,'v1',source(invalid),ids()));
});
test('wrong node, missing selection and invalid JSON are rejected', () => {
  const base=fixture();
  base.nodes.push(createInfiniteNode('t1','text',0,0));
  assert.throws(()=>bridgePreexistingVideoAgentPlan(base,'t1',source(),ids()),/视频生成节点/);
  assert.throws(()=>bridgePreexistingVideoAgentPlan(base,null,source(),ids()),/先选择/);
  assert.throws(()=>bridgePreexistingVideoAgentPlan(base,'v1','{broken}',ids()),/JSON/);
  assert.throws(()=>bridgePreexistingVideoAgentPlan(base,'v1','x'.repeat(40001),ids()),/40000/);
});
test('rule fallback labeled as such and does not impersonate live LLM',()=>{
  const review=bridgePreexistingVideoAgentPlan(fixture(),'v1',source({agentFallback:true}),ids());
  assert.equal(review.fallback,true);
  assert.ok(review.warnings.some(x=>x.includes('规则回退')));
});
test('review fails closed when graph changes before approval',()=>{
  const base=fixture(),review=bridgePreexistingVideoAgentPlan(base,'v1',source(),ids());
  const changed={...base,title:'new title'};
  assert.throws(()=>confirmStudioAgentPatch(changed,review.proposal),/变化/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { previewStudioWorkflow } from '../src/lib/studio-workflow-plan.ts';

function video(id, prompt = '', mode = 'text', model = 'minimax-h3') {
  return { id, kind: 'video', title: id, text: '', video: {
    model, mode, modeSelection: 'manual', prompt, duration: '5s',
    aspectRatio: '9:16', resolution: '720p',
  }};
}
function result(id, assetId = null) {
  return { id, kind: 'video-result', title: id, assetId };
}
function draft(nodes = [], edges = []) {
  return { id: 'preview-project', version: 1, title: 'Preview', nodes, edges,
    view: { x: 0, y: 0, scale: 1 }, updatedAt: new Date(0).toISOString() };
}
function link(source, target, port = 'reference') {
  return { id: `${source}:${target}:${port}`, source, target, port };
}
test('dry run never creates a paid task, quotes a price or enables execution', () => {
  const plan = previewStudioWorkflow(draft([video('shot-1', 'Camera dolly-in')]));
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.estimatedCredits, null);
  assert.equal(plan.paidJobs, 0);
  assert.equal(plan.videos[0].state, 'READY_FOR_MANUAL_PREFLIGHT');
});
test('stable dependency order follows generator to result to subsequent shot', () => {
  const plan = previewStudioWorkflow(draft(
    [video('shot-2', 'Next shot', 'omni'), video('shot-1', 'First shot'), result('first-result', 'saved-video')],
    [link('shot-1', 'first-result'), link('first-result', 'shot-2')],
  ));
  assert.deepEqual(plan.videos.map(x => x.nodeId), ['shot-1', 'shot-2']);
  assert.deepEqual(plan.videos[1].dependsOn, ['shot-1']);
  assert.equal(plan.hasCycle, false);
});
test('missing reference assets blocks manual preflight', () => {
  const plan = previewStudioWorkflow(draft([video('a', 'Scene', 'start-end')]));
  assert.equal(plan.videos[0].state, 'NEEDS_ASSETS');
  assert.match(plan.videos[0].issues.join(' '), /首帧/);
});
test('missing prompt and model are distinguishable', () => {
  const plan = previewStudioWorkflow(draft([
    video('a', '', 'text', 'minimax-h3'),
    video('b', 'Visible prompt', 'text', null),
  ]));
  assert.equal(plan.videos[0].state, 'NEEDS_PROMPT');
  assert.equal(plan.videos[1].state, 'NEEDS_MODEL');
});
test('cycles and dangling edges produce diagnostics, never execute', () => {
  const plan = previewStudioWorkflow(draft(
    [video('a', 'A', 'omni'), video('b', 'B', 'omni'), result('r1', 'asset1'), result('r2', 'asset2')],
    [link('a', 'r1'), link('r1', 'b'), link('b', 'r2'), link('r2', 'a'), link('missing', 'a')],
  ));
  assert.equal(plan.hasCycle, true);
  assert.equal(plan.invalidEdges, 1);
  assert.equal(plan.executionEnabled, false);
  assert.ok(plan.issues.some(issue => issue.includes('循环依赖')));
});
test('empty graph is reported as empty, not a success', () => {
  const plan = previewStudioWorkflow(draft());
  assert.equal(plan.videos.length, 0);
  assert.ok(plan.issues.some(issue => issue.includes('没有视频任务')));
});

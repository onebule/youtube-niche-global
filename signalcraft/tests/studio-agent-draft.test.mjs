import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planStudioRequest, appendStudioRuleDraft,
} from '../src/lib/studio-agent-draft.ts';
import {
  createInfiniteProject, createInfiniteNode, collectInfiniteGenerationInputs,
} from '../src/lib/infinite-canvas-graph.ts';

function ids() {
  let n = 0;
  return () => 'new-id-' + (++n);
}

test('offline agent extracts explicit 6-shot, 30-second vertical video brief', () => {
  const plan = planStudioRequest('制作一条30秒英文 Shorts，分成6个镜头，9:16，角色 Nilo 保持一致。');
  assert.equal(plan.shotCount, 6);
  assert.equal(plan.durationSeconds, 30);
  assert.equal(plan.aspectRatio, '9:16');
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.providerCalls, 0);
  assert.equal(plan.mode, 'LOCAL_RULES_ONLY');
});

test('english landscape instructions and implicit count are deterministic', () => {
  const plan = planStudioRequest('Create a 20 seconds landscape commercial in 16:9');
  assert.equal(plan.durationSeconds, 20);
  assert.equal(plan.shotCount, 4);
  assert.equal(plan.aspectRatio, '16:9');
});

test('invalid empty, giant, unreasonable shot and duration requests are rejected', () => {
  assert.throws(() => planStudioRequest('  '), /创作需求/);
  assert.throws(() => planStudioRequest('a'.repeat(2001)), /创作需求/);
  assert.throws(() => planStudioRequest('制作 20 个镜头'), /2–8/);
  assert.throws(() => planStudioRequest('做一个 300秒 视频'), /4–240/);
});

test('apply appends a brief, storyboard and video per shot without touching existing data', () => {
  const base = createInfiniteProject('test-project');
  base.nodes.push(createInfiniteNode('existing', 'note', 8, 7));
  const prior = JSON.stringify(base);
  const draft = planStudioRequest('30秒，分成6个镜头，9:16，机器人 Nilo');
  const next = appendStudioRuleDraft(base, draft, ids());
  assert.equal(next.nodes.length, 1 + 1 + 6 * 2);
  assert.equal(next.edges.length, 6);
  assert.equal(next.nodes.find(node => node.id === 'existing').kind, 'note');
  assert.equal(next.nodes.filter(node => node.kind === 'video').length, 6);
  assert.equal(next.nodes.filter(node => node.kind === 'video').every(node => node.video.model === null), true);
  assert.equal(next.nodes.filter(node => node.kind === 'video').every(node => node.video.aspectRatio === '9:16'), true);
  assert.equal(JSON.stringify(base), prior);
  const first = next.nodes.find(node => node.title === 'Shot 01 视频');
  const input = collectInfiniteGenerationInputs(next, first.id);
  assert.match(input.prompt, /创作需求/);
  assert.equal(input.mode, 'text');
});

test('reject duplicate IDs, invalid plans and saturated graph atomically', () => {
  const p = createInfiniteProject('test-project');
  const draft = planStudioRequest('6 个镜头制作一个视频');
  assert.throws(() => appendStudioRuleDraft(p, draft, () => 'duplicate'), /重复或非法/);
  assert.equal(p.nodes.length, 0);
  assert.throws(() => appendStudioRuleDraft(p, {...draft, executionEnabled: true}, ids()), /不合法/);
  assert.equal(p.edges.length, 0);
  for (let i = 0; i < 397; i++) p.nodes.push(createInfiniteNode('existing-' + i, 'note', 0, 0));
  assert.throws(() => appendStudioRuleDraft(p, draft, ids()), /容量不足/);
});

test('every video remains manually gated and no synthetic result is introduced', () => {
  const draft = planStudioRequest('短剧，4镜头，9:16，人物始终穿同一件衣服');
  const result = appendStudioRuleDraft(createInfiniteProject('project'), draft, ids());
  assert.equal(result.nodes.some(node => node.kind === 'video-result'), false);
  assert.equal(result.nodes.some(node => node.runs.length !== 0), false);
  assert.equal(result.nodes.filter(node => node.kind === 'video').every(node => node.video.model === null), true);
});


test('planned shot durations preserve total seconds without silent clamping', () => {
  const draft = planStudioRequest('制作29秒短片，分成5个镜头，16:9');
  const graph = appendStudioRuleDraft(createInfiniteProject('project'), draft, ids());
  const videos = graph.nodes.filter(node => node.kind === 'video');
  assert.deepEqual(videos.map(node => Number.parseInt(node.video.duration, 10)), [6, 6, 6, 6, 5]);
  assert.equal(videos.reduce((sum, node) => sum + Number.parseInt(node.video.duration, 10), 0), 29);
});

test('incompatible per-shot duration rejects instead of changing user constraints', () => {
  assert.throws(() => planStudioRequest('100秒，分成2个镜头'), /时长与镜头数/);
  assert.throws(() => planStudioRequest('8秒，分成8个镜头'), /时长与镜头数/);
});

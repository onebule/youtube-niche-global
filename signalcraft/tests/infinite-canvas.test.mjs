import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfiniteProject, createInfiniteNode, normalizeInfiniteWorkspace, connectInfiniteNodes,
  connectionIssue, collectInfiniteGenerationInputs, usableInfiniteModel, infiniteAssetIssue,
  createInfiniteAttemptGuard, infiniteAssetKey } from '../src/lib/infinite-canvas-graph.ts';

function graph() {
  const project = createInfiniteProject('project');
  project.nodes = ['image', 'image', 'text', 'audio', 'video'].map((kind, i) => createInfiniteNode(`n${i}`, kind, i * 300, 0));
  project.nodes[0] = { ...project.nodes[0], assetId: 'start', width: 1024, height: 1024 };
  project.nodes[2].text = 'Linked scene description';
  project.nodes[4].video.prompt = 'Camera moves forward';
  return project;
}
test('new projects are blank and have no paid jobs or selected model', () => {
  const empty = normalizeInfiniteWorkspace(null);
  assert.equal(empty.projects[0].nodes.length, 0);
  assert.equal(createInfiniteNode('v', 'video', 0, 0).video.model, null);
});

test('account switch during delayed asset or model checks cancels before any submission', async () => {
  for (const stage of ['asset', 'model']) {
    let scope = 'account-a'; let submissions = 0; let release;
    const guard = createInfiniteAttemptGuard(scope, () => scope);
    const pending = new Promise(resolve => { release = resolve; });
    const attempt = (async () => {
      await guard.run(() => stage === 'asset' ? pending : Promise.resolve());
      await guard.run(() => stage === 'model' ? pending : Promise.resolve());
      await guard.run(async () => { submissions++; });
    })();
    await Promise.resolve(); scope = 'account-b'; release();
    await assert.rejects(attempt, /Account changed/);
    assert.equal(submissions, 0);
  }
});

test('unmount cancels and shared assets retain independent project and node verification', async () => {
  let mounted = true;
  const guard = createInfiniteAttemptGuard('a', () => mounted ? 'a' : null);
  mounted = false;
  await assert.rejects(guard.run(async () => assert.fail('must not submit')), /Account changed/);
  const issues = { [infiniteAssetKey('p1','n1')]: null, [infiniteAssetKey('p2','n1')]: 'wrong media' };
  assert.equal(issues[infiniteAssetKey('p1','n1')], null);
  assert.equal(issues[infiniteAssetKey('p2','n1')], 'wrong media');
});
test('single input replacement leaves unrelated references intact', () => {
  let p = graph();
  p = connectInfiniteNodes(p, 'a', 'n0', 'n4', 'start');
  p = connectInfiniteNodes(p, 'b', 'n0', 'n4', 'reference');
  p = connectInfiniteNodes(p, 'c', 'n1', 'n4', 'start');
  assert.equal(p.edges.length, 2);
  assert.equal(p.edges.find(e => e.port === 'start').source, 'n1');
  assert.throws(() => connectInfiniteNodes(p, 'dup', 'n0', 'n4', 'reference'));
});
test('invalid port, media types, self loops and nonexistent nodes are rejected', () => {
  const p = graph();
  for (const args of [['n0','n4','prompt'], ['n3','n4','start'], ['n2','n4','end'], ['n4','n4','prompt'], ['missing','n4','start'], ['n0','n4','invalid'], ['n4','n0','start']]) {
    assert.ok(connectionIssue(p, ...args));
  }
});
test('text mode ignores stale image and audio inputs while merging connected prompt', () => {
  let p = graph();
  p.nodes[4].video.mode = 'text';
  p = connectInfiniteNodes(p, 'a', 'n1', 'n4', 'reference');
  p = connectInfiniteNodes(p, 'b', 'n3', 'n4', 'reference');
  p = connectInfiniteNodes(p, 'c', 'n2', 'n4', 'prompt');
  const input = collectInfiniteGenerationInputs(p, 'n4');
  assert.deepEqual(input.errors, []);
  assert.equal(input.referenceFrames.length, 0);
  assert.equal(input.referenceAudios.length, 0);
  assert.equal(input.startFrame, null);
  assert.match(input.prompt, /Linked scene description/);
});
test('start/end needs a real uploaded start and rejects an unuploaded end', () => {
  let p = graph();
  assert.ok(collectInfiniteGenerationInputs(p, 'n4').errors.length);
  p = connectInfiniteNodes(p, 'a', 'n0', 'n4', 'start');
  assert.deepEqual(collectInfiniteGenerationInputs(p, 'n4').errors, []);
  p = connectInfiniteNodes(p, 'b', 'n1', 'n4', 'end');
  assert.ok(collectInfiniteGenerationInputs(p, 'n4').errors.some(e => e.includes('尾帧')));
});
test('reference audio is rejected for adapters without reference audio support', () => {
  let p = graph(); p.nodes[4].video.mode = 'omni'; p.nodes[4].video.model = 'seedance-2'; p.nodes[3].assetId = 'audio';
  p = connectInfiniteNodes(p, 'a', 'n0', 'n4', 'reference');
  p = connectInfiniteNodes(p, 'b', 'n3', 'n4', 'reference');
  assert.ok(collectInfiniteGenerationInputs(p, 'n4').errors.some(e => e.includes('音频')));
  p.nodes[4].video.model = 'minimax-h3';
  assert.deepEqual(collectInfiniteGenerationInputs(p, 'n4').errors, []);
});
test('recovery filters duplicate nodes, invalid edges and non-finite zoom', () => {
  const p = graph(); p.nodes.push(p.nodes[0]); p.view.scale = NaN;
  p.edges = [{id:'wrong',source:'n0',target:'n4',port:'prompt'}, {id:'valid',source:'n0',target:'n4',port:'start'}, {id:'duplicate',source:'n0',target:'n4',port:'start'}];
  const saved = normalizeInfiniteWorkspace({version:1,activeProjectId:p.id,projects:[p]});
  assert.equal(saved.projects[0].nodes.length, 5);
  assert.equal(saved.projects[0].edges.length, 1);
  assert.equal(saved.projects[0].view.scale, 1);
});
test('project, job history and explicit locked model survive JSON restore', () => {
  const p = graph(); p.nodes[4].video.model = 'minimax-h3';
  p.nodes[4].runs.push({jobId:'job',generationId:'generation',state:'PROCESSING',videoAssetId:null,error:null,submittedAt:'2026-09-26T00:00:00Z'});
  const empty = createInfiniteProject('empty');
  const restored = normalizeInfiniteWorkspace(JSON.parse(JSON.stringify({version:1,activeProjectId:p.id,projects:[p,empty]})));
  assert.equal(restored.projects[0].nodes[4].video.model, 'minimax-h3');
  assert.equal(restored.projects[0].nodes[4].runs[0].jobId, 'job');
  assert.equal(restored.projects[1].nodes.length, 0);
});

test('restore preserves generation history beyond twelve results', () => {
  const p = graph();
  p.nodes[4].runs = Array.from({length:20}, (_, i) => ({jobId:`job-${i}`,state:'SUCCEEDED',submittedAt:'2026-09-26T00:00:00Z'}));
  const restored = normalizeInfiniteWorkspace({version:1,activeProjectId:p.id,projects:[p]});
  assert.equal(restored.projects[0].nodes[4].runs.length, 20);
  assert.equal(restored.projects[0].nodes[4].runs[0].jobId, 'job-0');
});
test('only supported and enabled models may run the requested task', () => {
  assert.equal(usableInfiniteModel({id:'minimax-h3',enabled:false}, 'omni'), false);
  assert.equal(usableInfiniteModel({id:'auto',enabled:true}, 'text'), false);
  assert.equal(usableInfiniteModel({id:'new-provider',enabled:true}, 'start-end'), false);
  assert.equal(usableInfiniteModel({id:'kling-3',enabled:true}, 'omni'), false);
  assert.equal(usableInfiniteModel({id:'veo-3.1-lite',enabled:true}, 'text'), true);
  assert.equal(usableInfiniteModel({id:'minimax-h3',enabled:true}, 'omni'), true);
});
test('expired, foreign, wrong media and forged dimensions fail private asset verification', () => {
  const image = createInfiniteNode('i','image',0,0);
  assert.ok(infiniteAssetIssue(image, null));
  assert.ok(infiniteAssetIssue(image, {contentType:'video/mp4',width:1024,height:1024}));
  assert.ok(infiniteAssetIssue(image, {contentType:'image/png',width:NaN,height:1024}));
  assert.equal(infiniteAssetIssue(image, {contentType:'image/png',width:1024,height:1024}), null);
  const audio = createInfiniteNode('a','audio',0,0);
  assert.ok(infiniteAssetIssue(audio, {contentType:'image/png'}));
  assert.equal(infiniteAssetIssue(audio, {contentType:'audio/mpeg'}), null);
});

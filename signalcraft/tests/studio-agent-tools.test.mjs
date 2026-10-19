import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStudioAgentOperations,
  prepareStudioAgentPatch,
  confirmStudioAgentPatch,
  suggestStudioAgentEdits,
} from '../src/lib/studio-agent-tools.ts';
import {
  createInfiniteProject, createInfiniteNode, collectInfiniteGenerationInputs,
} from '../src/lib/infinite-canvas-graph.ts';

const ids = () => { let i = 0; return () => 'safe-command-' + ++i; };
const project = () => {
  const p = createInfiniteProject('id');
  const video = createInfiniteNode('video-1', 'video', 450, 150);
  video.video.prompt = 'Original motion';
  p.nodes.push(video);
  return p;
};
test('untrusted tool contract accepts only explicit safe commands', () => {
  const accepted = validateStudioAgentOperations([
    { type:'node.create', ref:'tmp:board1', kind:'storyboard', title:'Intro', text:'Opening beat', x:10, y:20 },
    { type:'edge.connect', source:'tmp:board1', target:'video-1', port:'prompt' },
  ]);
  assert.equal(accepted.length, 2);
  assert.equal(accepted[0].kind, 'storyboard');
  for (const unsupported of [
    [{ type:'video.generate', ref:'video-1', model:'minimax-h3' }],
    [{ type:'node.delete', ref:'video-1' }],
    [{ type:'node.create', ref:'tmp:x', kind:'image', title:'Image', x:0,y:0 }],
    [{ type:'node.create', ref:'tmp:x', kind:'note', title:'N', x:0,y:0, assetId:'private' }],
    [{ type:'node.create', ref:'tmp:x', kind:'note', title:'N', x:0,y:0, runs:[] }],
    [{ type:'edge.connect', source:'video-1', target:'video-1', port:'start' }],
    [{ type:'node.move', ref:'video-1', x:Infinity, y:0 }],
    [{ type:'node.set_video_prompt', ref:'video-1', prompt:'x', apiKey:'secret' }],
  ]) assert.throws(() => validateStudioAgentOperations(unsupported));
});

test('atomic preview creates connected storyboard but does not mutate the old graph', () => {
  const before = project();
  const unchanged = JSON.stringify(before);
  const operations = suggestStudioAgentEdits(before, 'video-1', 'Keep Nilo ivory, teal and charcoal.');
  const preview = prepareStudioAgentPatch(before, operations, ids());
  assert.equal(preview.executionEnabled, false);
  assert.equal(preview.providerCalls, 0);
  assert.equal(before.nodes.length, 1);
  assert.equal(JSON.stringify(before), unchanged);
  assert.equal(preview.next.nodes.length, 2);
  assert.equal(preview.next.edges.length, 1);
  assert.equal(preview.next.nodes[0].video.prompt, 'Original motion');
  assert.match(collectInfiniteGenerationInputs(preview.next, 'video-1').prompt, /Keep Nilo/);
  assert.strictEqual(confirmStudioAgentPatch(before, preview), preview.next);
});

test('stale-review protection rejects changed graph', () => {
  const before = project();
  const draft = prepareStudioAgentPatch(before, suggestStudioAgentEdits(before, 'video-1', 'New storyboard'), ids());
  const modified = { ...before, title: 'Changed before approval' };
  assert.throws(() => confirmStudioAgentPatch(modified, draft), /变化/);
  assert.equal(modified.nodes.length, 1);
});

test('a failed late command rolls back all proposed changes', () => {
  const before = project();
  const bytes = JSON.stringify(before);
  const commands = [
    { type:'node.create', ref:'tmp:note', kind:'note', title:'Safe note', text:'New note', x:12, y:30 },
    { type:'node.set_video_prompt', ref:'tmp:note', prompt:'Attempt to misapply' },
  ];
  assert.throws(() => prepareStudioAgentPatch(before, commands, ids()), /仅视频生成节点/);
  assert.equal(JSON.stringify(before), bytes);
});

test('duplicate temporary aliases and existing IDs are rejected', () => {
  const before = project();
  const op = { type:'node.create', ref:'tmp:n', kind:'note', title:'N', x:10, y:10 };
  assert.throws(() => prepareStudioAgentPatch(before, [op, op], ids()), /重复/);
  assert.throws(() => prepareStudioAgentPatch(before, [op], () => 'video-1'), /冲突/);
  assert.equal(before.nodes.length, 1);
});

test('text changes are reviewable, but protected result metadata cannot be rewritten', () => {
  const before = project();
  before.nodes.push(createInfiniteNode('note', 'note', 0, 0));
  const commands = [
    { type:'node.set_text', ref:'note', text:'Character identity is locked.' },
    { type:'node.set_title', ref:'note', title:'Character Bible' },
    { type:'node.move', ref:'note', x:80, y:-40 },
  ];
  const patch = prepareStudioAgentPatch(before, commands, ids());
  const added = patch.next.nodes.find(n => n.id === 'note');
  assert.equal(added.text, 'Character identity is locked.');
  assert.equal(added.title, 'Character Bible');
  assert.equal(added.x, 80);
  assert.equal(before.nodes.find(n => n.id === 'note').title, '便签');
  const result = createInfiniteNode('result', 'video-result', 0, 0);
  before.nodes.push(result);
  assert.throws(() => prepareStudioAgentPatch(before,
    [{ type:'node.set_title', ref:'result', title:'Fake output' }], ids()), /不可/);
});

test('invalid prompt connection causes no partial mutation', () => {
  const before = project();
  const original = JSON.stringify(before);
  assert.throws(() => prepareStudioAgentPatch(before, [
    { type:'node.create', ref:'tmp:subject', kind:'video', title:'Generator', x:0, y:0 },
    { type:'edge.connect', source:'tmp:subject', target:'video-1', port:'prompt' },
  ], ids()), /视频|提示词/);
  assert.equal(JSON.stringify(before), original);
});

test('tool set cannot modify private assets, histories or generation states', () => {
  const before = project();
  for (const op of [
    { type:'node.set_asset', ref:'video-1', assetId:'foreign' },
    { type:'node.set_text', ref:'video-1', text:'bypass' },
    { type:'node.create', ref:'tmp:result', kind:'video-result', title:'Fake', x:0, y:0 },
    { type:'node.set_video_prompt', ref:'video-1', prompt:'Hi', credits:0 },
  ]) assert.throws(() => prepareStudioAgentPatch(before, [op], ids()));
  assert.equal(before.nodes[0].video.prompt, 'Original motion');
});

test('invalid/missing selections degrade to a safe non-executing text note', () => {
  const before = project();
  const patch = prepareStudioAgentPatch(before,
    suggestStudioAgentEdits(before, 'missing', 'A new original idea.'), ids());
  assert.equal(patch.next.nodes.at(-1).kind, 'text');
  assert.equal(patch.next.edges.length, 0);
});

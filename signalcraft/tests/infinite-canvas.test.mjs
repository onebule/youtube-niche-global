import test from 'node:test';
import assert from 'node:assert/strict';
import { createInfiniteProject, createInfiniteNode, normalizeInfiniteWorkspace, connectInfiniteNodes,
  connectionIssue, collectInfiniteGenerationInputs, upsertInfiniteVideoResult, usableInfiniteModel, infiniteAssetIssue,
  createInfiniteAttemptGuard, infiniteAssetKey } from '../src/lib/infinite-canvas-graph.ts';
import { readInfiniteScriptFile, resolveInfiniteScript, scriptAssetStillCurrent } from '../src/lib/infinite-canvas-scripts.ts';
import { parseScriptLayout } from '../src/lib/script-layout.ts';

test('layout preview keeps table columns, blank cells and surrounding text without executing markup', () => {
  const original = '  标题\n\n| 镜号 | 时长 | 动作 | 对白 |\n| --- | --- | --- | --- |\n| 1 | 3.0s | 第一段<br>第二段 | |\n| 2 | 4s | 原文\\|竖线 | <script>alert(1)</script> |\n\n  结尾';
  const blocks = parseScriptLayout(original);
  assert.deepEqual(blocks[0], { type: 'text', text: '  标题\n' });
  assert.deepEqual(blocks[1].header, ['镜号', '时长', '动作', '对白']);
  assert.deepEqual(blocks[1].rows, [['1', '3.0s', '第一段<br>第二段', ''], ['2', '4s', '原文|竖线', '<script>alert(1)</script>']]);
  assert.deepEqual(blocks[2], { type: 'text', text: '\n  结尾' });
  const malformed = '| A | B |\n| --- | --- |\n| one |';
  assert.deepEqual(parseScriptLayout(malformed), [{ type: 'text', text: malformed }]);
  assert.deepEqual(parseScriptLayout('  A\tB\t\n\n\nend  '), [{ type: 'text', text: '  A\tB\t\n\n\nend  ' }]);
  assert.deepEqual(parseScriptLayout('| A | B |\n| --- | --- |\n|   indented\t  | \t |')[0].rows, [['  indented\t ', '\t']]);
});

function scriptGraph() {
  const project = createInfiniteProject('scripts');
  const script = createInfiniteNode('script', 'script', 0, 0);
  script.text = 'A traveller enters the forest.\nClose-up on the map.\nPull back to reveal the mountains.';
  project.nodes = [script, createInfiniteNode('v', 'video', 300, 0), createInfiniteNode('v2', 'video', 800, 0)];
  return connectInfiniteNodes(project, 'script-v', 'script', 'v', 'script');
}

test('script edges feed actual prompt text, but never select a video media mode', () => {
  const project = scriptGraph();
  project.nodes[0].assetId = 'private-script-screenshot';
  const input = collectInfiniteGenerationInputs(project, 'v');
  assert.equal(input.mode, 'text');
  assert.match(input.prompt, /traveller enters/);
  assert.equal(input.scriptReference.nodeId, 'script');
  assert.deepEqual(input.referenceFrames, []);
  assert.equal(input.startFrame, null);
  assert.match(connectionIssue(project, 'script', 'v2', 'reference'), /脚本/);
  project.nodes.push(createInfiniteNode('image', 'image', 0, 200));
  assert.match(connectionIssue(project, 'image', 'v2', 'script'), /脚本/);
});

test('script references preserve original indentation, tabs and blank lines after restore', () => {
  const project = scriptGraph();
  const original = '  镜号\t时长\t对白\t\n1\t3.0s\t\t\n\n\n  动作原文  ';
  project.nodes[0].text = original;
  project.nodes[0].textResult = original;
  const restored = normalizeInfiniteWorkspace(JSON.parse(JSON.stringify({ version: 1, projects: [project] }))).projects[0];
  assert.equal(restored.nodes[0].textResult, original);
  assert.equal(resolveInfiniteScript(restored.nodes[0]).text, original);
  assert.equal(resolveInfiniteScript(restored.nodes[0], { startLine: 1, endLine: 1 }).text, '  镜号\t时长\t对白\t');
  assert.ok(collectInfiniteGenerationInputs(restored, 'v').prompt.includes(original));
  restored.nodes[0].text = ' \t\n';
  assert.match(resolveInfiniteScript(restored.nodes[0]).error, /已确认文字/);
});

test('OCR proposal does not change connected text until explicitly adopted', () => {
  const project = scriptGraph();
  project.nodes[0].textResult = 'UNREVIEWED OCR';
  assert.doesNotMatch(collectInfiniteGenerationInputs(project, 'v').prompt, /UNREVIEWED/);
  project.nodes[0].text = project.nodes[0].textResult;
  project.nodes[0].textResult = '';
  assert.match(collectInfiniteGenerationInputs(project, 'v').prompt, /UNREVIEWED OCR/);
  project.nodes[0].text = '';
  project.nodes[0].textResult = 'Still pending review';
  assert.match(collectInfiniteGenerationInputs(project, 'v').errors.join(), /已确认文字/);
});

test('each video independently selects script lines; full script and edges survive restore', () => {
  let project = scriptGraph();
  project = connectInfiniteNodes(project, 'script-v2', 'script', 'v2', 'script');
  project.nodes[1].video.scriptRange = { startLine: 2, endLine: 2 };
  project.nodes[2].video.scriptRange = { startLine: 3, endLine: 3 };
  project.nodes[0].textResult = 'OCR draft';
  const restored = normalizeInfiniteWorkspace(JSON.parse(JSON.stringify({ version: 1, activeProjectId: project.id, projects: [project] }))).projects[0];
  assert.equal(restored.edges.length, 2);
  assert.deepEqual(restored.nodes[1].video.scriptRange, { startLine: 2, endLine: 2 });
  assert.equal(restored.nodes[0].text, project.nodes[0].text);
  assert.equal(restored.nodes[0].textResult, 'OCR draft');
  assert.match(collectInfiniteGenerationInputs(restored, 'v').prompt, /Close-up/);
  assert.doesNotMatch(collectInfiniteGenerationInputs(restored, 'v').prompt, /traveller|mountains/);
  assert.match(collectInfiniteGenerationInputs(restored, 'v2').prompt, /mountains/);
  restored.nodes[0].text = restored.nodes[0].text.replace('map', 'compass');
  assert.match(collectInfiniteGenerationInputs(restored, 'v').prompt, /compass/);
});

test('long scripts are retained but block oversized prompts; line selection fixes the request', () => {
  const project = scriptGraph();
  project.nodes[0].text = `${'x'.repeat(1500)}\nSelected scene`;
  assert.match(collectInfiniteGenerationInputs(project, 'v').errors.join(), /1200/);
  assert.ok(collectInfiniteGenerationInputs(project, 'v').prompt.length > 1500);
  project.nodes[1].video.scriptRange = { startLine: 2, endLine: 2 };
  assert.deepEqual(collectInfiniteGenerationInputs(project, 'v').errors, []);
  assert.equal(collectInfiniteGenerationInputs(project, 'v').scriptReference.text, 'Selected scene');
  for (const range of [{ startLine: 0, endLine: 1 }, { startLine: 2, endLine: 1 }, { startLine: 1, endLine: 20 }, { startLine: 1.2, endLine: 2 }]) {
    assert.match(resolveInfiniteScript(project.nodes[0], range).error, /行号/);
  }
});

test('replacing or disconnecting a script does not leak old script selections or content', () => {
  let project = scriptGraph();
  project.nodes[1].video.scriptRange = { startLine: 2, endLine: 2 };
  const replacement = createInfiniteNode('s2', 'script', 0, 0); replacement.text = 'New scene';
  project.nodes.push(replacement);
  project = connectInfiniteNodes(project, 'new-edge', 's2', 'v', 'script');
  assert.equal(project.nodes[1].video.scriptRange, undefined);
  assert.match(collectInfiniteGenerationInputs(project, 'v').prompt, /New scene/);
  assert.doesNotMatch(collectInfiniteGenerationInputs(project, 'v').prompt, /Close-up/);
  project.edges = [];
  assert.equal(collectInfiniteGenerationInputs(project, 'v').scriptReference, null);
  assert.equal(collectInfiniteGenerationInputs(project, 'v').prompt, '');
});

test('UTF-8 text import rejects unsupported, binary, malformed or oversized files without truncation', async () => {
  const file = (name, data) => ({ name, size: data.length, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
  const bytes = text => new TextEncoder().encode(text);
  assert.equal(await readInfiniteScriptFile(file('story.md', bytes('镜头一\n镜头二'))), '镜头一\n镜头二');
  await assert.rejects(readInfiniteScriptFile(file('story.pdf', bytes('text'))), /TXT/);
  await assert.rejects(readInfiniteScriptFile(file('story.txt', new Uint8Array([255, 254]))), /UTF-8/);
  await assert.rejects(readInfiniteScriptFile(file('story.txt', bytes('a\0b'))), /可用文字/);
  await assert.rejects(readInfiniteScriptFile(file('story.txt', bytes('x'.repeat(12001)))), /12000/);
  await assert.rejects(readInfiniteScriptFile({ name: 'story.txt', size: 96001, arrayBuffer: async () => assert.fail('must not read oversized file') }), /96000/);
});

test('deleted or replaced script image rejects stale OCR results and private image validation stays intact', () => {
  const script = createInfiniteNode('script', 'script', 0, 0); script.assetId = 'current';
  assert.equal(scriptAssetStillCurrent(script, 'current'), true);
  assert.equal(scriptAssetStillCurrent(undefined, 'current'), false);
  assert.equal(scriptAssetStillCurrent(script, 'old'), false);
  assert.match(infiniteAssetIssue(script, { contentType: 'video/mp4' }), /不是图片/);
});

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

test('text model choice and review result survive draft restore without replacing the original', () => {
  const project = createInfiniteProject('text-project');
  const node = createInfiniteNode('text', 'text', 0, 0);
  Object.assign(node, { text: 'Original', textModel: 'claude-opus-5-5', textResult: 'Generated' });
  project.nodes.push(node);
  const saved = normalizeInfiniteWorkspace({ version: 1, activeProjectId: project.id, projects: [project] });
  assert.equal(saved.projects[0].nodes[0].text, 'Original');
  assert.equal(saved.projects[0].nodes[0].textModel, 'claude-opus-5-5');
  assert.equal(saved.projects[0].nodes[0].textResult, 'Generated');
  for (const model of ['gpt-6-sol', 'gpt-6-astra']) {
    node.textModel = model;
    const restored = normalizeInfiniteWorkspace({ version: 1, projects: [project] });
    assert.equal(restored.projects[0].nodes[0].textModel, model);
    assert.equal(restored.projects[0].nodes[0].text, 'Original');
    assert.equal(restored.projects[0].nodes[0].textResult, 'Generated');
  }
  node.textModel = 'untrusted-model';
  assert.equal(normalizeInfiniteWorkspace({ version: 1, projects: [project] }).projects[0].nodes[0].textModel, null);
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
  p.nodes[4].video.modeSelection = 'manual';
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
  p.nodes[4].video.modeSelection = 'manual';
  assert.ok(collectInfiniteGenerationInputs(p, 'n4').errors.length);
  p = connectInfiniteNodes(p, 'a', 'n0', 'n4', 'start');
  assert.deepEqual(collectInfiniteGenerationInputs(p, 'n4').errors, []);
  p = connectInfiniteNodes(p, 'b', 'n1', 'n4', 'end');
  assert.ok(collectInfiniteGenerationInputs(p, 'n4').errors.some(e => e.includes('尾帧')));
});
test('explicit end port never silently becomes the start frame', () => {
  let p = graph();
  p.nodes[1].assetId = 'end';
  p = connectInfiniteNodes(p, 'tail', 'n1', 'n4', 'end');
  const input = collectInfiniteGenerationInputs(p, 'n4');
  assert.equal(input.mode, 'start-end');
  assert.equal(input.startFrame, null);
  assert.equal(input.endFrame.assetId, 'end');
  assert.ok(input.errors.some(error => error.includes('首帧')));
});
test('automatic mode resolves zero, one, two and three images from incoming edges', () => {
  let p = graph();
  p.nodes[1].assetId = 'end';
  p.nodes.push({ ...createInfiniteNode('n5', 'image', 0, 0), assetId: 'third' });
  assert.equal(collectInfiniteGenerationInputs(p, 'n4').mode, 'text');
  assert.equal(usableInfiniteModel({ id: 'minimax-h3', enabled: true }, 'text'), true);
  p = connectInfiniteNodes(p, 'a', 'n0', 'n4', 'reference');
  assert.equal(collectInfiniteGenerationInputs(p, 'n4').startFrame.assetId, 'start');
  assert.equal(collectInfiniteGenerationInputs(p, 'n4').mode, 'start-end');
  p = connectInfiniteNodes(p, 'b', 'n1', 'n4', 'reference');
  assert.equal(collectInfiniteGenerationInputs(p, 'n4').endFrame.assetId, 'end');
  p = connectInfiniteNodes(p, 'c', 'n5', 'n4', 'reference');
  assert.equal(collectInfiniteGenerationInputs(p, 'n4').mode, 'omni');
  assert.deepEqual(collectInfiniteGenerationInputs(p, 'n4').referenceFrames.map(node => node.assetId), ['start', 'end', 'third']);
});
test('successful generation creates one reusable result and preserves chain after restore', () => {
  let p = graph();
  p.nodes[4].video.model = 'minimax-h3';
  p.nodes.push(createInfiniteNode('next', 'video', 1100, 0));
  p.nodes.find(node => node.id === 'next').video.model = 'minimax-h3';
  const run = { jobId: 'job-1', generationId: 'gen-1', model: 'minimax-h3', prompt: 'Camera moves forward',
    state: 'SUCCEEDED', videoAssetId: 'asset-1', error: null, submittedAt: new Date().toISOString() };
  p.nodes[4].video.prompt = 'Later edit should not rewrite result';
  p = upsertInfiniteVideoResult(p, 'n4', run);
  p = upsertInfiniteVideoResult(p, 'n4', run);
  const result = p.nodes.find(node => node.kind === 'video-result');
  assert.equal(p.nodes.filter(node => node.kind === 'video-result').length, 1);
  assert.deepEqual(result.output, { type: 'video', assetId: 'asset-1', generationId: 'gen-1', model: 'minimax-h3', prompt: 'Camera moves forward' });
  assert.ok(p.edges.some(edge => edge.source === 'n4' && edge.target === result.id));
  p = connectInfiniteNodes(p, 'chain', result.id, 'next', 'reference');
  assert.equal(collectInfiniteGenerationInputs(p, 'next').mode, 'omni');
  assert.deepEqual(collectInfiniteGenerationInputs(p, 'next').referenceVideos.map(node => node.assetId), ['asset-1']);
  assert.ok(connectionIssue(p, result.id, 'n4', 'reference'));
  const restored = normalizeInfiniteWorkspace({ version: 1, activeProjectId: p.id, projects: [p] }).projects[0];
  assert.equal(restored.nodes.find(node => node.id === result.id).output.assetId, 'asset-1');
  assert.equal(restored.nodes.find(node => node.id === result.id).output.prompt, 'Camera moves forward');
  assert.equal(restored.edges.length, 2);
  assert.deepEqual(collectInfiniteGenerationInputs(restored, 'next').referenceVideos.map(node => node.assetId), ['asset-1']);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudioMockRun, stepStudioMockRun, finishStudioMockRun,
  retryStudioMockRun, cancelStudioMockRun, mockGraphFingerprint,
} from '../src/lib/studio-mock-runtime.ts';
import {
  createInfiniteProject, createInfiniteNode, connectInfiniteNodes,
} from '../src/lib/infinite-canvas-graph.ts';

const video = (id, prompt = 'Cinematic Nilo workshop scene') => {
  const node = createInfiniteNode(id, 'video', 100, 100);
  node.title = id;
  node.video.mode = 'text';
  node.video.modeSelection = 'manual';
  node.video.prompt = prompt;
  node.video.model = null; // mock driver never calls an actual model
  return node;
};
const graph = (...nodes) => {
  const p = createInfiniteProject('mock-project');
  p.nodes.push(...nodes);
  return p;
};
const states = run => Object.fromEntries(run.tasks.map(t => [t.nodeId, t.status]));

test('one video can run as a mock without a real model or paid calls', () => {
  const project = graph(video('shot-1'));
  const bytes = JSON.stringify(project);
  const run = createStudioMockRun(project, {id:'run-1'});
  assert.equal(run.status, 'READY');
  assert.equal(run.executionEnabled, false);
  assert.equal(run.providerCalls, 0);
  assert.equal(run.paidJobs, 0);
  assert.equal(run.estimatedCredits, null);
  assert.equal(run.generatedAssets, 0);
  const started = stepStudioMockRun(run, project);
  assert.equal(started.status, 'RUNNING');
  assert.equal(started.tasks[0].status, 'RUNNING');
  assert.equal(started.tasks[0].attempts, 1);
  const completed = stepStudioMockRun(started, project);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.tasks[0].status, 'SUCCEEDED');
  assert.deepEqual(completed.events.map(event => event.type),
    ['CREATED','STEP_STARTED','STEP_SUCCEEDED','COMPLETED']);
  assert.equal(JSON.stringify(project), bytes);
  assert.equal(project.nodes[0].runs.length, 0);
  assert.equal(project.nodes[0].assetId, null);
});

test('stable independent shot order, bounded finish and step no-op after completion', () => {
  const project = graph(video('first'),video('second'),video('third'));
  const run = finishStudioMockRun(createStudioMockRun(project), project);
  assert.equal(run.status, 'COMPLETED');
  assert.deepEqual(run.tasks.map(task => task.nodeId), ['first','second','third']);
  assert.deepEqual(run.events.filter(event => event.type === 'STEP_STARTED').map(event => event.nodeId),
    ['first','second','third']);
  assert.deepEqual(states(run), {first:'SUCCEEDED',second:'SUCCEEDED',third:'SUCCEEDED'});
  assert.equal(stepStudioMockRun(run, project), run);
});

test('video-result reference expresses a real DAG dependency without generating an asset', () => {
  let project = graph(video('downstream'),video('upstream'));
  const downstream = project.nodes.find(node => node.id === 'downstream');
  downstream.video.mode = 'omni';
  downstream.video.model = 'minimax-h3';
  const result = createInfiniteNode('prior-result','video-result',220,220);
  result.assetId = 'previous-asset';
  project.nodes.push(result);
  project = connectInfiniteNodes(project,'edge-1','upstream','prior-result','reference');
  project = connectInfiniteNodes(project,'edge-2','prior-result','downstream','reference');
  const run = createStudioMockRun(project);
  assert.deepEqual(run.tasks.map(task => task.nodeId), ['upstream','downstream']);
  assert.deepEqual(run.tasks[1].dependsOn, ['upstream']);
  const final = finishStudioMockRun(run,project);
  assert.deepEqual(final.events.filter(e=>e.type==='STEP_STARTED').map(e=>e.nodeId),
    ['upstream','downstream']);
  assert.equal(final.generatedAssets,0);
});

test('fail once pauses, explicit retry resumes only failed step without rerunning successes', () => {
  const project = graph(video('first'),video('second'));
  const failed = finishStudioMockRun(createStudioMockRun(project,{failOnceNodeId:'second'}),project);
  assert.equal(failed.status,'PAUSED');
  assert.deepEqual(states(failed),{first:'SUCCEEDED',second:'FAILED'});
  assert.equal(failed.tasks[1].attempts,1);
  assert.throws(()=>retryStudioMockRun(createStudioMockRun(project),project),/失败暂停/);
  const retried = retryStudioMockRun(failed,project);
  assert.deepEqual(states(retried),{first:'SUCCEEDED',second:'PENDING'});
  const finished = finishStudioMockRun(retried,project);
  assert.equal(finished.status,'COMPLETED');
  assert.deepEqual(finished.tasks.map(task=>task.attempts),[1,2]);
  assert.equal(finished.events.filter(event=>event.type==='STEP_FAILED').length,1);
  assert.equal(finished.events.filter(event=>event.type==='RETRY_APPROVED').length,1);
  assert.throws(()=>retryStudioMockRun(finished,project),/失败暂停/);
});

test('cancellation is terminal and cannot create outputs', () => {
  const project=graph(video('a'),video('b'));
  const started=stepStudioMockRun(createStudioMockRun(project),project);
  const cancelled=cancelStudioMockRun(started,project);
  assert.equal(cancelled.status,'CANCELLED');
  assert.deepEqual(states(cancelled),{a:'CANCELLED',b:'CANCELLED'});
  assert.equal(stepStudioMockRun(cancelled,project),cancelled);
  assert.equal(finishStudioMockRun(cancelled,project),cancelled);
  assert.equal(cancelStudioMockRun(cancelled,project),cancelled);
  assert.throws(()=>retryStudioMockRun(cancelled,project),/失败暂停/);
  assert.equal(cancelled.providerCalls,0);
  assert.equal(cancelled.generatedAssets,0);
});

test('preflight rejects missing prompts even in mock mode', () => {
  const project=graph(video('no-prompt',''));
  assert.throws(()=>createStudioMockRun(project),/提示词/);
});

test('missing reference asset and invalid mode are never bypassed in mock mode', () => {
  const project=graph(video('needs-first-frame'));
  project.nodes[0].video.mode='start-end';
  assert.throws(()=>createStudioMockRun(project),/首帧/);
});

test('invalid edges, cycles, empty graph and nonexistent failure target are blocked', () => {
  assert.throws(()=>createStudioMockRun(graph()),/至少添加/);
  const dangling=graph(video('one'));
  dangling.edges.push({id:'edge',source:'unknown',target:'one',port:'prompt'});
  assert.throws(()=>createStudioMockRun(dangling),/悬空连线/);
  const cycle=graph(video('one'),video('two'),
    createInfiniteNode('out-1','video-result',0,0),
    createInfiniteNode('out-2','video-result',0,0));
  cycle.edges.push(
    {id:'1',source:'one',target:'out-1',port:'reference'},
    {id:'2',source:'out-1',target:'two',port:'reference'},
    {id:'3',source:'two',target:'out-2',port:'reference'},
    {id:'4',source:'out-2',target:'one',port:'reference'},
  );
  assert.throws(()=>createStudioMockRun(cycle),/循环依赖/);
  assert.throws(()=>createStudioMockRun(graph(video('one')),{failOnceNodeId:'ghost'}),/不存在/);
});

test('changing a node or edge invalidates the run; camera zoom does not', () => {
  const project=graph(video('v1'));
  const run=createStudioMockRun(project);
  const cameraOnly={...project,view:{x:50,y:-20,scale:1.3}};
  assert.equal(mockGraphFingerprint(project),mockGraphFingerprint(cameraOnly));
  assert.equal(stepStudioMockRun(run,cameraOnly).status,'RUNNING');
  const edited={...project,nodes:project.nodes.map(n=>({...n,title:'edited'}))};
  assert.throws(()=>stepStudioMockRun(run,edited),/画布节点或连线/);
  assert.throws(()=>finishStudioMockRun(run,edited),/画布节点或连线/);
  assert.throws(()=>cancelStudioMockRun(run,edited),/画布节点或连线/);
});

test('tampered runtime safety flags are fail-closed',()=>{
  const project=graph(video('v1'));
  const run=createStudioMockRun(project);
  for(const update of [
    {executionEnabled:true},{providerCalls:1},{paidJobs:1},
    {estimatedCredits:12},{generatedAssets:1},{mode:'REAL_PROVIDER'},
  ]) assert.throws(()=>stepStudioMockRun({...run,...update},project),/安全协议/);
});

test('mock hard cap prevents runaway graphs and generated outputs',()=>{
  const p=graph(...Array.from({length:65},(_,i)=>video('shot-'+i)));
  assert.throws(()=>createStudioMockRun(p),/64/);
  assert.equal(p.nodes.some(n=>n.kind==='video-result'),false);
});

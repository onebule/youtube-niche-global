import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudioMockJournal,
  appendStudioMockCommand,
  restoreStudioMockJournal,
  serializeStudioMockJournal,
  mockGraphToken,
} from '../src/lib/studio-mock-checkpoint.ts';
import { createInfiniteProject, createInfiniteNode, normalizeInfiniteWorkspace } from '../src/lib/infinite-canvas-graph.ts';

function project(...ids) {
  const p = createInfiniteProject('mock-checkpoint-project');
  p.title = 'Sensitive draft title that must not be stored';
  for (const id of ids.length ? ids : ['video-1']) {
    const video = createInfiniteNode(id,'video',120,210);
    video.video.mode = 'text';
    video.video.modeSelection = 'manual';
    video.video.prompt = 'A PRIVATE PROMPT BELONGING ONLY IN THE CANVAS';
    video.title = 'Confidential scene';
    p.nodes.push(video);
  }
  return p;
}
const scope = 'account-abc012';
function issue(state,p,action,requestId) {
  return appendStudioMockCommand(state.journal,p,scope,{
    action,requestId,expectedRevision:state.journal.revision,
  });
}

test('fresh journal stores only graph token, not private prompts or raw media nodes', () => {
  const p=project('shot-1','shot-2');
  const initial=createStudioMockJournal(p,scope,{runId:'mock-run-1'});
  const json=serializeStudioMockJournal(initial.journal,p,scope);
  assert.equal(initial.run.status,'READY');
  assert.equal(initial.journal.revision,0);
  assert.equal(initial.journal.mode,'MOCK_ONLY');
  assert.ok(json.includes('"graphToken":"fnv1a32-'));
  assert.ok(!json.includes('A PRIVATE PROMPT'));
  assert.ok(!json.includes('Confidential scene'));
  assert.ok(!json.includes('Sensitive draft'));
  assert.ok(!json.includes('assetId'));
  assert.ok(!json.includes('credentials'));
});

test('resume after page reload replays commands to exactly the same Mock state',()=>{
  const p=project('one','two');
  let state=createStudioMockJournal(p,scope,{runId:'stable-run'});
  state=issue(state,p,'STEP','request-1');
  assert.equal(state.run.tasks[0].status,'RUNNING');
  state=issue(state,p,'STEP','request-2');
  assert.equal(state.run.tasks[0].status,'SUCCEEDED');
  state=issue(state,p,'FINISH','request-3');
  assert.equal(state.run.status,'COMPLETED');
  const restored=restoreStudioMockJournal(serializeStudioMockJournal(state.journal,p,scope),p,scope);
  assert.deepEqual(restored.run,state.run);
  assert.deepEqual(restored.journal,state.journal);
  assert.equal(restored.run.providerCalls,0);
  assert.equal(restored.run.generatedAssets,0);
  assert.equal(p.nodes[0].runs.length,0);
});

test('same request ID is idempotent, but conflicting reuse is rejected',()=>{
  const p=project();
  const initial=createStudioMockJournal(p,scope,{runId:'mock-run'});
  const first=issue(initial,p,'STEP','request-123');
  const replay=appendStudioMockCommand(first.journal,p,scope,{
    action:'STEP',requestId:'request-123',expectedRevision:0,
  });
  assert.deepEqual(replay,first);
  assert.equal(replay.journal.revision,1);
  assert.deepEqual(replay.run.events.map(e=>e.type),['CREATED','STEP_STARTED']);
  assert.throws(()=>appendStudioMockCommand(first.journal,p,scope,{
    action:'CANCEL',requestId:'request-123',expectedRevision:0,
  }),/同一请求 ID/);
});

test('optimistic concurrency blocks stale writers and enforces monotonic revisions',()=>{
  const p=project();
  const initial=createStudioMockJournal(p,scope,{runId:'mock-run'});
  const one=issue(initial,p,'STEP','a');
  assert.throws(()=>appendStudioMockCommand(one.journal,p,scope,{
    action:'STEP',requestId:'b',expectedRevision:0,
  }),/修订号过期/);
  const two=issue(one,p,'STEP','b');
  assert.equal(two.journal.revision,2);
  assert.equal(two.run.status,'COMPLETED');
});

test('one-time failure can be rehydrated before explicit retry',()=>{
  const p=project('first','second');
  let state=createStudioMockJournal(p,scope,{runId:'mock-run',failOnceNodeId:'second'});
  state=issue(state,p,'FINISH','finish-1');
  assert.equal(state.run.status,'PAUSED');
  assert.deepEqual(state.run.tasks.map(t=>t.status),['SUCCEEDED','FAILED']);
  const paused=restoreStudioMockJournal(JSON.stringify(state.journal),p,scope);
  assert.equal(paused.run.status,'PAUSED');
  state=issue(paused,p,'RETRY','retry-1');
  state=issue(state,p,'FINISH','finish-2');
  assert.equal(state.run.status,'COMPLETED');
  assert.deepEqual(state.run.tasks.map(t=>t.attempts),[1,2]);
  assert.equal(state.run.events.filter(e=>e.type==='STEP_FAILED').length,1);
  const restored=restoreStudioMockJournal(JSON.stringify(state.journal),p,scope);
  assert.deepEqual(restored.run,state.run);
});

test('cancelled sessions rehydrate in terminal state and never submit provider calls',()=>{
  const p=project();
  let state=createStudioMockJournal(p,scope,{runId:'mock-run'});
  state=issue(state,p,'STEP','a');
  state=issue(state,p,'CANCEL','b');
  const restored=restoreStudioMockJournal(JSON.stringify(state.journal),p,scope);
  assert.equal(restored.run.status,'CANCELLED');
  assert.equal(restored.run.providerCalls,0);
  assert.equal(restored.run.paidJobs,0);
  assert.throws(()=>issue(restored,p,'FINISH','c'),/终态|没有状态变化/);
});

test('account isolation and changed graph block checkpoint reuse; camera-only edits survive',()=>{
  const p=project();
  const state=createStudioMockJournal(p,scope,{runId:'mock-run'});
  assert.throws(()=>restoreStudioMockJournal(state.journal,p,'account-different'),/其他账号/);
  const changed={...p,nodes:p.nodes.map(node=>({...node,title:'changed'}))};
  assert.notEqual(mockGraphToken(p),mockGraphToken(changed));
  assert.throws(()=>restoreStudioMockJournal(state.journal,changed,scope),/图版本/);
  const camera={...p,view:{x:500,y:70,scale:.7}};
  assert.equal(mockGraphToken(p),mockGraphToken(camera));
  assert.equal(restoreStudioMockJournal(state.journal,camera,scope).run.status,'READY');
});

test('tampered journal cannot forge success, change scope, insert dangerous commands or duplicate IDs',()=>{
  const p=project();
  const state=createStudioMockJournal(p,scope,{runId:'mock-run'});
  const base=state.journal;
  for(const candidate of [
    {...base,mode:'REAL_PROVIDER'},
    {...base,generatedAssets:100},
    {...base,revision:1},
    {...base,commands:[{requestId:'id1',action:'SET_SUCCESS',expectedRevision:0}],revision:1},
    {...base,commands:[{requestId:'id1',action:'STEP',expectedRevision:3}],revision:1},
    {...base,scope:'account-victim',revision:0},
  ]) assert.throws(()=>restoreStudioMockJournal(candidate,p,scope));
  const first=issue(state,p,'STEP','dup');
  const duplicated={...first.journal,revision:2,
    commands:[...first.journal.commands,first.journal.commands[0]]};
  assert.throws(()=>restoreStudioMockJournal(duplicated,p,scope),/重复请求|顺序不一致/);
});

test('noncanonical terminal command histories are refused, not treated as successful',()=>{
  const p=project();
  const base=createStudioMockJournal(p,scope,{runId:'mock-run'}).journal;
  const forged={
    ...base,revision:2,
    commands:[
      {requestId:'one',action:'FINISH',expectedRevision:0},
      {requestId:'two',action:'STEP',expectedRevision:1},
    ],
  };
  assert.throws(()=>restoreStudioMockJournal(forged,p,scope),/终态重复/);
});

test('invalid JSON, excess checkpoint size and wrong schema are rejected',()=>{
  const p=project();
  assert.throws(()=>restoreStudioMockJournal('{broken',p,scope),/JSON/);
  assert.throws(()=>restoreStudioMockJournal(' '.repeat(96*1024+1),p,scope),/容量/);
  const base=createStudioMockJournal(p,scope,{runId:'mock-run'}).journal;
  assert.throws(()=>restoreStudioMockJournal({...base,schemaVersion:3},p,scope),/协议/);
  assert.throws(()=>createStudioMockJournal(p,'../../other-account',{runId:'mock-run'}),/范围/);
});

test('replay refuses unavailable graph after failed original preflight',()=>{
  const p=project();
  const original=createStudioMockJournal(p,scope,{runId:'mock-run'}).journal;
  const modified={...p,nodes:p.nodes.map(n=>({...n,video:{...n.video,prompt:''}}))};
  assert.throws(()=>restoreStudioMockJournal(original,modified,scope),/图版本/);
});


test('checkpoint graph token survives canonical Graph v1 draft normalization on reload',()=>{
  const p=project('alpha','beta');
  const hydrated=normalizeInfiniteWorkspace({
    version:1, activeProjectId:p.id, projects:[p],
  }).projects[0];
  // Restored nodes gain canonical optional fields, even without semantic edits.
  assert.notEqual(JSON.stringify(p.nodes),JSON.stringify(hydrated.nodes));
  assert.equal(mockGraphToken(p),mockGraphToken(hydrated));
  let state=createStudioMockJournal(p,scope,{runId:'roundtrip'});
  state=issue(state,p,'STEP','first-start');
  const recovered=restoreStudioMockJournal(JSON.stringify(state.journal),hydrated,scope);
  assert.equal(recovered.run.tasks[0].status,'RUNNING');
  const finished=issue(recovered,hydrated,'FINISH','finish');
  assert.equal(finished.run.status,'COMPLETED');
  assert.equal(finished.run.generatedAssets,0);
});

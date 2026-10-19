import test from 'node:test';
import assert from 'node:assert/strict';
import {
  studioActiveProject, studioWorkspaceFromProject,
  studioCreateProject, studioSwitchProject, studioRenameProject,
  studioDuplicateProject, studioRemoveProject, studioImportWorkspaceTemplates, STUDIO_MAX_PROJECTS,
} from '../src/lib/studio-project-workspace.ts';
import {
  createInfiniteNode, createInfiniteProject, connectInfiniteNodes,
  normalizeInfiniteWorkspace,
} from '../src/lib/infinite-canvas-graph.ts';

function original() {
  const p = createInfiniteProject('alpha', 'Nilo Project');
  const prompt = createInfiniteNode('text-original','text',100,200);
  prompt.text = 'Nilo uses ivory panels and teal joints.';
  prompt.textResult = 'A prior paid text result';
  const video = createInfiniteNode('video-original','video',510,200);
  video.video = {...video.video, mode:'text',modeSelection:'manual',prompt:'Slow dolly into the workshop'};
  video.runs = [{jobId:'previous-provider-task',generationId:'paid-generation',model:'minimax-h3',
    prompt:'old',state:'SUCCEEDED',videoAssetId:'secret-output',error:null,submittedAt:new Date(0).toISOString()}];
  const frame = createInfiniteNode('frame-original','image',150,460);
  frame.assetId = 'secret-account-scope-media';
  frame.assetName = 'private-image.png';
  frame.output = {type:'image',assetId:'secret-account-scope-media'};
  frame.width=1024;frame.height=1024;
  const result = createInfiniteNode('result-original','video-result',900,200);
  result.assetId = 'old-provider-result';
  result.output = {type:'video',assetId:'old-provider-result'};
  p.nodes.push(prompt,video,frame,result);
  let next = connectInfiniteNodes(p,'edge-text',prompt.id,video.id,'prompt');
  next = connectInfiniteNodes(next,'edge-frame',frame.id,video.id,'reference');
  next = connectInfiniteNodes(next,'edge-video',video.id,result.id,'reference');
  return next;
}
const workspace = () => studioWorkspaceFromProject(original());
const idFactory=()=>{
  let counter=0;
  return ()=> 'copy-node-'+(++counter);
};

test('create, switch and rename preserve all existing project graphs',()=>{
  const before=workspace(), snapshot=JSON.stringify(before);
  const added=studioCreateProject(before,'beta','  My Second Project  ');
  assert.equal(studioActiveProject(added).title,'My Second Project');
  assert.equal(added.projects.length,2);
  assert.equal(added.projects[1].nodes.length,0);
  assert.equal(added.projects[0].nodes.length,4);
  const renamed=studioRenameProject(added,'alpha','Renamed Nilo');
  assert.equal(renamed.projects[0].title,'Renamed Nilo');
  assert.equal(renamed.projects[0].nodes.length,4);
  const switched=studioSwitchProject(renamed,'alpha');
  assert.equal(studioActiveProject(switched).id,'alpha');
  assert.equal(studioActiveProject(switched).nodes.length,4);
  assert.equal(JSON.stringify(before),snapshot);
});

test('templates remap IDs, retain prompt and connections but never share asset or paid result',()=>{
  const before=workspace(), snapshot=JSON.stringify(before);
  const duplicated=studioDuplicateProject(before,'alpha','nilo-copy',idFactory());
  const copy=studioActiveProject(duplicated);
  assert.equal(copy.id,'nilo-copy');
  assert.equal(copy.title,'Nilo Project · 副本');
  assert.equal(copy.nodes.length,3);
  assert.equal(copy.edges.length,2);
  const priorIds=new Set(before.projects[0].nodes.map(n=>n.id));
  for(const node of copy.nodes){
    assert.ok(!priorIds.has(node.id));
    assert.equal(node.assetId,null);
    assert.equal(node.output,null);
    assert.equal(node.assetName,null);
    assert.deepEqual(node.runs,[]);
    assert.ok(node.kind!=='video-result');
    assert.equal(node.textResult,'');
  }
  assert.equal(copy.nodes.find(n=>n.kind==='text').text,'Nilo uses ivory panels and teal joints.');
  assert.equal(copy.nodes.find(n=>n.kind==='video').video.prompt,'Slow dolly into the workshop');
  assert.equal(copy.edges.every(edge=>copy.nodes.some(n=>n.id===edge.source)&&copy.nodes.some(n=>n.id===edge.target)),true);
  assert.deepEqual(copy.edges.map(edge=>edge.port),['prompt','reference']);
  assert.equal(JSON.stringify(before),snapshot);
});

test('copy safe on repeated export and normalization roundtrip',()=>{
  const copied=studioDuplicateProject(workspace(),'alpha','safe-copy',idFactory());
  const hydrated=normalizeInfiniteWorkspace(copied);
  assert.equal(hydrated.activeProjectId,'safe-copy');
  assert.equal(hydrated.projects.length,2);
  assert.equal(hydrated.projects[1].nodes.length,3);
  assert.equal(hydrated.projects[1].edges.length,2);
  assert.ok(!JSON.stringify(hydrated.projects[1]).includes('secret-account-scope-media'));
  assert.ok(!JSON.stringify(hydrated.projects[1]).includes('previous-provider-task'));
});

test('deleting inactive project preserves selected active, deleting active chooses surviving project',()=>{
  const initial=studioCreateProject(workspace(),'beta','Second');
  const alphaSelected=studioSwitchProject(initial,'alpha');
  const removedInactive=studioRemoveProject(alphaSelected,'beta');
  assert.equal(removedInactive.activeProjectId,'alpha');
  assert.equal(removedInactive.projects.length,1);
  const removedActive=studioRemoveProject(initial,'beta');
  assert.equal(removedActive.activeProjectId,'alpha');
  assert.equal(removedActive.projects.length,1);
  assert.equal(removedActive.projects[0].nodes.length,4);
});

test('last project deletion and foreign IDs are rejected atomically',()=>{
  const initial=workspace(), snapshot=JSON.stringify(initial);
  assert.throws(()=>studioRemoveProject(initial,'alpha'),/至少保留/);
  assert.throws(()=>studioRemoveProject(initial,'missing'),/不存在/);
  assert.throws(()=>studioSwitchProject(initial,'missing'),/不存在/);
  assert.throws(()=>studioRenameProject(initial,'missing','Renamed'),/不存在/);
  assert.throws(()=>studioDuplicateProject(initial,'missing','copy',idFactory()),/不存在/);
  assert.equal(JSON.stringify(initial),snapshot);
});

test('project IDs and names must be unique, bounded and nonblank',()=>{
  const initial=workspace();
  for(const [id,name] of [['alpha','New'],['','New'],['bad\nid','New'],['b',' '],['b','x'.repeat(86)]]) {
    assert.throws(()=>studioCreateProject(initial,id,name));
  }
  assert.throws(()=>studioRenameProject(initial,'alpha','\u0000Attack'));
  assert.throws(()=>studioDuplicateProject(initial,'alpha','alpha',idFactory()),/冲突/);
});

test('invalid fresh node IDs stop the entire project copy without altering source',()=>{
  const initial=workspace(), snapshot=JSON.stringify(initial);
  assert.throws(()=>studioDuplicateProject(initial,'alpha','copy',()=> 'text-original'),/重复/);
  assert.throws(()=>studioDuplicateProject(initial,'alpha','copy',()=> ''),/无效/);
  assert.throws(()=>studioDuplicateProject(initial,'alpha','copy',()=> 'same-id'),/重复/);
  assert.equal(JSON.stringify(initial),snapshot);
});

test('project limit matches canonical Graph v1 normalizer 40-item storage ceiling',()=>{
  let state=workspace();
  for(let i=1;i<STUDIO_MAX_PROJECTS;i++)state=studioCreateProject(state,'p-'+i,'Project '+i);
  assert.equal(state.projects.length,40);
  assert.throws(()=>studioCreateProject(state,'overflow','Overflow'),/40/);
  assert.throws(()=>studioDuplicateProject(state,'alpha','overflow',idFactory()),/40/);
  assert.equal(normalizeInfiniteWorkspace(state).projects.length,40);
});

test('project-specific graph edits remain isolated across switching',()=>{
  const initial=studioCreateProject(workspace(),'beta','Beta');
  const state=studioSwitchProject(initial,'alpha');
  const beforeBeta=JSON.stringify(state.projects.find(p=>p.id==='beta'));
  const renamed=studioRenameProject(state,'alpha','Alpha renamed');
  assert.equal(JSON.stringify(renamed.projects.find(p=>p.id==='beta')),beforeBeta);
  assert.equal(renamed.activeProjectId,'alpha');
});

test('clone rejects malformed dangling project graph rather than pretending connections were copied',()=>{
  const malformed=workspace();
  malformed.projects[0].edges.push({id:'bad-edge',source:'missing',target:'video-original',port:'prompt'});
  assert.throws(()=>studioDuplicateProject(malformed,'alpha','copy',idFactory()),/不兼容/);
});


test('external workspace imports ALL projects as independent sanitized templates, leaving current intact',()=>{
  const current=studioCreateProject(workspace(),'beta','Keep My Beta');
  const source=studioCreateProject(workspace(),'other','Another Source');
  const bytes=JSON.stringify(current);
  let count=0;
  let countNodes=0;
  const merged=studioImportWorkspaceTemplates(current,source,
    ()=> 'imported-project-'+(++count),
    ()=> 'imported-node-'+(++countNodes));
  assert.equal(merged.projects.length,4);
  assert.equal(merged.activeProjectId,'imported-project-2');
  assert.equal(merged.projects[0].id,'alpha');
  assert.equal(merged.projects[1].id,'beta');
  assert.equal(merged.projects[2].nodes.length,3);
  assert.equal(merged.projects[2].edges.length,2);
  assert.ok(!JSON.stringify(merged.projects[2]).includes('previous-provider-task'));
  assert.ok(!JSON.stringify(merged.projects[2]).includes('secret-account-scope-media'));
  assert.equal(JSON.stringify(current),bytes);
});

test('bulk import failure remains atomic, never partly appends projects',()=>{
  const current=workspace();
  const source=studioCreateProject(workspace(),'other','Second Imported');
  const before=JSON.stringify(current);
  let i=0;
  assert.throws(()=>studioImportWorkspaceTemplates(current,source,
    ()=> 'new-project-'+(++i),
    ()=> 'text-original'),/无效|重复/);
  assert.equal(JSON.stringify(current),before);
});

test('bulk import capacity is enforced before any imported IDs are generated',()=>{
  let current=workspace();
  for(let i=1;i<40;i++)current=studioCreateProject(current,'p-'+i,'Existing '+i);
  let idCalls=0;
  assert.throws(()=>studioImportWorkspaceTemplates(current,workspace(),
    ()=>{idCalls++;return 'new';},()=> 'id'),/40/);
  assert.equal(idCalls,0);
});

test('cross-project imported ID collisions do not leak or mutate any existing project',()=>{
  const current=workspace();
  assert.throws(()=>studioImportWorkspaceTemplates(current,workspace(),
    ()=> 'text-original',()=> 'another'),/冲突/);
  assert.equal(current.projects.length,1);
});

test('max-length project titles are truncated safely for duplicate/import labels',()=>{
  const current=studioRenameProject(workspace(),'alpha','N'.repeat(85));
  const copied=studioDuplicateProject(current,'alpha','copy-id',idFactory());
  assert.equal(studioActiveProject(copied).title.length,85);
  const merged=studioImportWorkspaceTemplates(workspace(),current,()=> 'import-id',idFactory());
  assert.equal(studioActiveProject(merged).title.length,85);
});

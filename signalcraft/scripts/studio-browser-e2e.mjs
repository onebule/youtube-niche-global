import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const port=Number(process.env.STUDIO_BROWSER_CDP_PORT||9223);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let tab;
for(let i=0;i<60;i++){
  try{const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
      tab=tabs.find(x=>x.type==='page'&&x.webSocketDebuggerUrl);if(tab)break;
  }catch{} await sleep(500);
}
if(!tab)throw Error('Chrome CDP did not start');
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('CDP connection timeout')),12000);
  ws.onopen=()=>{clearTimeout(timeout);resolve();};
  ws.onerror=()=>{clearTimeout(timeout);reject(Error('CDP socket error'));};
});
let nextId=0;const waiting=new Map();
ws.onmessage=event=>{
  const msg=JSON.parse(String(event.data));if(!msg.id||!waiting.has(msg.id))return;
  const {resolve,reject,timeout}=waiting.get(msg.id);
  clearTimeout(timeout);waiting.delete(msg.id);
  if(msg.error)reject(Error(JSON.stringify(msg.error)));else resolve(msg.result||{});
};
function cdp(method,params={}){
  const id=++nextId;
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{waiting.delete(id);reject(Error('CDP timeout: '+method));},12000);
    waiting.set(id,{resolve,reject,timeout});ws.send(JSON.stringify({id,method,params}));
  });
}
async function evaluate(expression){
  const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error('Browser JS exception: '+result.exceptionDetails.text);
  return result.result?.value;
}
async function until(expression,expected,label){
  let last;
  for(let i=0;i<65;i++){
    last=await evaluate(expression);
    if(last===expected)return;
    await sleep(120);
  }
  throw Error(label+'; expected '+expected+', got '+last);
}
async function click(label){
  const expression='(()=>{const b=[...document.querySelectorAll("button")].find(x=>x.textContent?.trim().includes('+JSON.stringify(label)+')&&!x.disabled);if(!b)return false;b.click();return true;})()';
  assert.equal(await evaluate(expression),true,'missing button '+label);
}
async function input(id,text){
  const expression='(()=>{const e=document.getElementById('+JSON.stringify(id)+');if(!(e instanceof HTMLTextAreaElement))return false;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,'+JSON.stringify(text)+');e.dispatchEvent(new Event("input",{bubbles:true}));return true;})()';
  assert.equal(await evaluate(expression),true,'missing textarea '+id);
}
await cdp('Page.enable');await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
assert.equal((await evaluate('location.pathname')),'/studio-parity/canvas');
await until('document.querySelectorAll("[data-canvas-node]").length',0,'initial canvas');
await sleep(900); // allow Next hydration before dispatching DOM click events
await evaluate('window.confirm=()=>true');
await click('创建 Nilo 示例流程');
await until('document.querySelectorAll("[data-canvas-node]").length',3,'example nodes');
await click('撤销');await until('document.querySelectorAll("[data-canvas-node]").length',0,'undo');
await click('重做');await until('document.querySelectorAll("[data-canvas-node]").length',3,'redo');

// Real Chrome input events, not synthetic DOM pointer callbacks.
async function dragMouse(x,y,dx,dy){
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x,y});
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x,y,button:'left',buttons:1,clickCount:1});
  for(let i=1;i<=5;i++){
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:x+dx*i/5,y:y+dy*i/5,button:'left',buttons:1});
  }
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:x+dx,y:y+dy,button:'left',buttons:0,clickCount:1});
}
const nodePosition='Number.parseFloat(document.querySelector("[data-canvas-node]").style.left)';
const originalX=await evaluate(nodePosition);
const titleHandle=await evaluate('(()=>{const r=document.querySelector("[data-canvas-node] [role=button]").getBoundingClientRect();return {x:r.left+Math.min(45,r.width/3),y:r.top+r.height/2};})()');
await dragMouse(titleHandle.x,titleHandle.y,90,25);
await until(nodePosition,originalX+90,'node pointer drag');
await click('撤销');await until(nodePosition,originalX,'drag undo');
await click('重做');await until(nodePosition,originalX+90,'drag redo');

const panTransform='document.querySelector("[class*=world]").style.transform';
const transformBefore=await evaluate(panTransform);
const bg=await evaluate('(()=>{const r=document.querySelector("[class*=viewport]").getBoundingClientRect();return {x:r.right-38,y:r.bottom-38};})()');
await dragMouse(bg.x,bg.y,-45,-22);
const moved=await evaluate(panTransform);
assert.notEqual(moved,transformBefore,'viewport pan must change camera');
const zoomText='document.querySelector("section[aria-label=\\"节点创作画布\\"] output").textContent';
const zoomBefore=await evaluate(zoomText);
await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',x:bg.x,y:bg.y,deltaX:0,deltaY:-180});
for(let i=0;i<35 && await evaluate(zoomText)===zoomBefore;i++)await sleep(100);
assert.notEqual(await evaluate(zoomText),zoomBefore,'wheel zoom must change camera scale');

// Verify inspector changes are visually reconciled after history operations.
assert.equal(await evaluate('(()=>{const el=document.querySelector("[data-canvas-node]");el.querySelectorAll("button")[1].click();return true;})()'),true);
await until('Boolean(document.querySelector("aside[aria-label=\\"节点属性面板\\"] input"))',true,'node inspector');
const nameBefore=await evaluate('document.querySelector("aside[aria-label=\\"节点属性面板\\"] input").value');
const rename='浏览器拖拽验收节点';
const renameExpression='(()=>{const el=document.querySelector("aside[aria-label=\\"节点属性面板\\"] input");el.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,'+JSON.stringify(rename)+');el.dispatchEvent(new Event("input",{bubbles:true}));el.blur();return true;})()';
assert.equal(await evaluate(renameExpression),true);
await until('document.querySelector("[data-canvas-node] [role=button] strong").textContent',rename,'inspector rename');
await click('撤销');
await until('document.querySelector("[data-canvas-node] [role=button] strong").textContent',nameBefore,'rename undo');
await until('document.querySelector("aside[aria-label=\\"节点属性面板\\"] input").value',nameBefore,'inspector shows undone title');
await click('重做');
await until('document.querySelector("aside[aria-label=\\"节点属性面板\\"] input").value',rename,'inspector shows redone title');

const edgePath='document.querySelector("[class*=edges] path").getAttribute("d")';
const initialEdge=await evaluate(edgePath);
assert.equal(await evaluate('(()=>{document.querySelector("[data-canvas-node][data-kind=storyboard] button").click();return true;})()'),true);
assert.equal(await evaluate('(()=>{document.querySelector("[data-canvas-node][data-kind=video] button:last-child").click();return true;})()'),true);
await until('Boolean([...document.querySelectorAll("aside[aria-label=\\"节点属性面板\\"] button")].find(b=>b.textContent.includes("提示词")&&!b.disabled))',true,'prompt port ready');
const clickedPort=await evaluate('(()=>{const inspector=document.querySelector("aside[aria-label=\\\"节点属性面板\\\"]");const port=[...inspector.querySelectorAll("button")].find(b=>b.textContent.trim().startsWith("提示词")&&!b.disabled);if(!port)return false;port.click();return true;})()');
assert.equal(clickedPort,true,'prompt input port click should target inspector only');
await until(edgePath+' !== '+JSON.stringify(initialEdge),true,'connection replaced by storyboard edge');
const connectedEdge=await evaluate(edgePath);
await click('撤销');await until(edgePath,initialEdge,'connection undo');
await click('重做');await until(edgePath,connectedEdge,'connection redo');

const cameraBeforeFit=await evaluate(panTransform);
await click('适配全部节点');
await until(panTransform+' !== '+JSON.stringify(cameraBeforeFit),true,'fit-to-content camera');
assert.ok((await evaluate(zoomText)).includes('%'),'fit zoom output must remain readable');


await click('生成节点草稿');
await until('Boolean(document.getElementById("studio-agent-idea"))',true,'agent panel');
await input('studio-agent-idea','制作一条30秒英文 Shorts，分成6个镜头，9:16，机器人 Nilo 角色保持一致。');
await click('预览多镜头规划');
await until('document.body.textContent.includes("6 个镜头")',true,'shot preview');
await click('确认添加到画布（不执行生成）');
await until('document.querySelectorAll("[data-canvas-node]").length',16,'inserted nodes');
await until('Boolean(document.getElementById("studio-workflow-preview"))',true,'dry run panel');
await click('生成节点草稿');
await until('Boolean(document.querySelector("#studio-existing-plan-json"))',true,'plan bridge panel');
await evaluate('document.querySelector("#studio-existing-plan-json").closest("details").open=true');
const plan={plan:{kind:'video-generation-plan',autoGenerate:false,model:'minimax-h3',director:{id:'gpt'},agentFallback:false,prompt:'Nilo repairs the brass farewell bell in a warm workshop. Gentle camera dolly in.',reasoning:'Retain ivory panels, teal joints and copper antenna.',suggestedActions:[{type:'shot.reorder',direction:'up'}]}};
await input('studio-existing-plan-json',JSON.stringify(plan));
await click('验证并预演已有 Agent 规划');
await until('document.body.textContent.includes("模型建议：minimax-h3")',true,'bridge preview');
await click('审核通过并应用操作');
await until('document.querySelectorAll("[data-canvas-node]").length',17,'approved patch');
assert.equal(await evaluate('[...document.querySelectorAll("[data-canvas-node][data-kind=video]")].some(n=>n.textContent.includes("Nilo repairs the brass farewell bell"))'),true,'Agent prompt applied');
assert.equal(await evaluate('document.querySelector("aside[aria-label=\\"节点属性面板\\"] textarea")?.value.includes("Nilo repairs the brass farewell bell")'),true,'inspector reflects Agent prompt');
// Phase 3: mock-only workflow runs must not create new graph nodes/assets.
await click('Mock Runtime');
await until('Boolean(document.getElementById("studio-mock-runtime"))',true,'Mock panel');
await click('创建 Mock 运行');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("READY")',true,'Mock initialized');
await click('单步推进');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("RUNNING")',true,'Mock first step');
await click('模拟运行全部');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("COMPLETED")',true,'Mock all finished');
assert.equal(await evaluate('document.querySelectorAll("[data-canvas-node]").length'),17,'Mock must not create real nodes');

// Deliberate one-time failure, explicit retry, then all steps completed.
const chosenFail=await evaluate('document.querySelector("select[aria-label=\\"Mock 故障注入节点\\"] option:nth-child(2)")?.value');
assert.ok(chosenFail,'Mock test needs a video node');
const selectFailure='(()=>{const el=document.querySelector("select[aria-label=\\"Mock 故障注入节点\\"]");el.value='+JSON.stringify(chosenFail)+';el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()';
assert.equal(await evaluate(selectFailure),true);
await click('创建 Mock 运行');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("READY")',true,'fault-run initialized');
await click('模拟运行全部');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("PAUSED")',true,'Mock expected fail');
// Persisted Mock journal must be compact and account-scoped (anonymous => sessionStorage).
const journalCheck='(()=>{const key=Object.keys(sessionStorage).find(k=>k.startsWith("signalcraft-studio-parity-mock-journal-v1:anonymous"));if(!key)return false;const raw=sessionStorage.getItem(key);const journal=JSON.parse(raw);return journal.mode==="MOCK_ONLY"&&journal.revision===1&&journal.commands[0].action==="FINISH"&&!raw.includes("Nilo repairs the brass farewell bell");})()';
assert.equal(await evaluate(journalCheck),true,'scoped Mock checkpoint must exist and omit prompt text');
assert.equal(await evaluate('Object.keys(localStorage).some(k=>k.startsWith("signalcraft-studio-parity-mock-journal-v1"))'),false,'anonymous Mock journal must not use durable account localStorage');
await cdp('Page.reload',{ignoreCache:true});
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("PAUSED")',true,'paused Mock recovered from journal');
await until('document.querySelectorAll("[data-canvas-node]").length',17,'graph restored alongside paused Mock');
assert.equal(await evaluate(journalCheck),true,'recovered Mock checkpoint retains only approved command log');
await click('重试失败节点');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("READY")',true,'Mock retry approved');
await click('模拟运行全部');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("COMPLETED")',true,'Mock retried finished');
await click('创建 Mock 运行');
await click('取消 Mock');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("CANCELLED")',true,'Mock cancelled');
assert.equal(await evaluate('document.querySelectorAll("[data-canvas-node]").length'),17,'Mock never writes generated outputs');
await cdp('Page.reload',{ignoreCache:true});
await until('document.querySelectorAll("[data-canvas-node]").length',17,'draft persistence');
await until('document.querySelector("#studio-mock-runtime [aria-live=polite]")?.textContent.includes("CANCELLED")',true,'cancelled Mock recovered after reload');
assert.equal(await evaluate('document.querySelector("#studio-mock-runtime .mockCheckpointLabel")?.textContent.includes("第 1 版") || document.querySelector("#studio-mock-runtime [class*=mockCheckpointLabel]")?.textContent.includes("第 1 版")'),true,'cancelled Mock persisted at revision 1');
const dir=process.env.STUDIO_BROWSER_ARTIFACT_DIR||'/tmp';await fs.mkdir(dir,{recursive:true});
const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
await fs.writeFile(dir+'/studio-browser-validated.png',Buffer.from(screenshot.data,'base64'));
console.log('PASS: pointer drag, Agent bridge, idempotent Mock checkpoint persistence, paused retry, cancelled reload, no outputs');
ws.close();

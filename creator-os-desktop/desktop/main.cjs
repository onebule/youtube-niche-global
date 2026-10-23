const {app,BrowserWindow,protocol,net,shell,dialog,Menu}=require('electron');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'creator',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.setName('Creator OS');
if(app.commandLine.hasSwitch('smoke-test'))app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'creator-smoke-')));
let window,server,base,stopLocalWork,localWorkActive,updater,googleAuth,updateInstallBusy=false;
const root=path.resolve(__dirname,'..');
const token=randomBytes(32).toString('hex');
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.show();window.focus()}});
function external(url){try{const u=new URL(url);if(u.protocol==='https:')void shell.openExternal(u.href)}catch{}}
async function openWindow(){
 window=new BrowserWindow({width:1440,height:940,minWidth:900,minHeight:640,title:'Creator OS',backgroundColor:'#f6f7fb',show:false,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,spellcheck:false}});
 window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'}});
 window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('creator://app/')){event.preventDefault();external(url)}});
 window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(contents.getURL().startsWith('creator://app/')&&permission==='clipboard-sanitized-write'));
 window.once('ready-to-show',()=>{if(!app.commandLine.hasSwitch('smoke-test'))window.show()});
 window.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(window,{type:'question',buttons:['继续使用','退出应用'],defaultId:0,cancelId:0,title:'有正在执行的任务',message:'退出会停止本机处理和后续队列提交；已提交到云端的任务可能继续运行。确定退出？'});if(choice===1)event.preventDefault()});
 window.on('closed',()=>window=null);
 await window.loadURL('creator://app/');
}
if(single)app.whenReady().then(async()=>{
 // User records survive app upgrades; no writable files inside the application bundle.
 process.env.CREATOR_DATA_DIR=path.join(app.getPath('userData'),'data');
 process.env.CREATOR_DESKTOP_TOKEN=token;
 const tools=app.isPackaged?path.join(process.resourcesPath,'tools'):path.join(root,'tools');
 process.env.PATH=tools+path.delimiter+(process.env.PATH||'');
 const loaded=await import(pathToFileURL(path.join(root,'server.mjs')).href);server=loaded.server;loaded.setUpstreamFetch((url,options)=>net.fetch(url,options));
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 base=`http://127.0.0.1:${server.address().port}`;
 const composition=await import(pathToFileURL(path.join(root,'compose.mjs')).href);stopLocalWork=composition.stopLocalWork;localWorkActive=composition.localWorkActive;
 const {UpdateManager}=require('./updater.cjs');updater=new UpdateManager({fetch:(...args)=>net.fetch(...args),cacheDirectory:path.join(app.getPath('userData'),'update-cache'),version:app.getVersion(),platform:process.platform,arch:process.arch});
 const {GoogleAuth}=require('./google-auth.cjs');googleAuth=new GoogleAuth({fetch:(...args)=>net.fetch(...args),openExternal:url=>shell.openExternal(url),onComplete:()=>{if(window){if(!app.commandLine.hasSwitch('smoke-test')){window.show();window.focus()}if(!window.webContents.getURL().startsWith('creator://app/generation.html'))void window.loadURL('creator://app/generation.html')}}});
 protocol.handle('creator',async request=>{
  const url=new URL(request.url);
  if(url.hostname!=='app')return new Response('Not found',{status:404});
  const headers={'x-creator-desktop':token};
  for(const key of ['content-type','authorization','idempotency-key','range']){const value=request.headers.get(key);if(value)headers[key]=value}
  if(url.pathname.startsWith('/local/google-auth/'))return googleAuthRequest(request,url);
  if(url.pathname.startsWith('/local/updates'))return updateRequest(request,url);
  const method=request.method;const body=['GET','HEAD'].includes(method)?undefined:await request.arrayBuffer();
  try{return await net.fetch(base+url.pathname+url.search,{method,headers,body,redirect:'error'})}
  catch{return Response.json({error:'本机服务连接中断，请重新启动应用。'},{status:503})}
 });
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]}]:[]),
  {label:'文件',submenu:[{label:'检查软件更新',click:()=>{void window?.loadURL('creator://app/setup.html');void updater.check()}},{label:'使用与备份',click:()=>window?.loadURL('creator://app/setup.html')},{label:'打开数据文件夹',click:()=>shell.openPath(process.env.CREATOR_DATA_DIR)},{type:'separator'},process.platform==='darwin'?{role:'close'}:{role:'quit'}]},
  {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'视图',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));
 await openWindow();
 if(app.commandLine.hasSwitch('smoke-test')){const response=await net.fetch('creator://app/local/environment');const state=await response.json();if(!response.ok||!state.desktop)throw Error('Desktop protocol smoke test failed');loaded.setUpstreamFetch(async()=>Response.json({code:'AUTH_EMAIL_INVALID'},{status:400}));const connectionProbe=await net.fetch('creator://app/local/connection-check');if(!(await connectionProbe.json()).ready)throw Error('System transport connection probe failed');loaded.setUpstreamFetch((url,options)=>net.fetch(url,options));const updateResponse=await net.fetch('creator://app/local/updates');if(!updateResponse.ok||(await updateResponse.json()).currentVersion!==app.getVersion())throw Error('Update status route failed');const rejectedUpdate=await net.fetch('creator://app/local/updates/install',{method:'POST'});if(rejectedUpdate.status!==403)throw Error('Update mutation protection failed');await smokeGoogleLogin(loaded);await window.loadURL('creator://app/library.html#ideas');const smoke=require('./library-smoke.cjs');await window.webContents.executeJavaScript('('+smoke.toString()+')()');await window.loadURL('creator://app/research.html');const researchSmoke=require('./research-smoke.cjs');await window.webContents.executeJavaScript('('+researchSmoke.toString()+')()');await window.loadURL('creator://app/compose.html');const speechSmoke=require('./speech-smoke.cjs');await window.webContents.executeJavaScript('('+speechSmoke.toString()+')()');await window.webContents.executeJavaScript(`(()=>{const s=document.getElementById('subtitles');if(!s.oninput)throw Error('Finishing UI not initialized');s.value='1\\n00:00:00,000 --> 00:00:01,000\\n中文';s.dispatchEvent(new Event('input'));if(!document.getElementById('subtitle-status').textContent.includes('1 条字幕'))throw Error('Subtitle validation UI failed');return true})()`);await window.loadURL('creator://app/setup.html');const originalUpdateFetch=updater.fetch;updater.fetch=async()=>Response.json({schema:1,version:app.getVersion(),notes:'smoke',assets:{[process.platform+'-'+process.arch]:{url:`https://github.com/onebule/youtube-niche-global/releases/download/creator-os-v${app.getVersion()}/Creator-OS-${app.getVersion()}-${process.platform==='win32'?'win':'mac'}-${process.arch}.${process.platform==='win32'?'exe':'dmg'}`,size:1,sha256:'0'.repeat(64)}}});await window.webContents.executeJavaScript(`(async()=>{for(let i=0;i<100&&document.getElementById('updates').hidden;i++)await new Promise(r=>setTimeout(r,20));if(document.getElementById('updates').hidden)throw Error('Update panel not initialized');document.getElementById('updatecheck').click();for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,20));if(document.getElementById('updatestatus').textContent.includes('当前已是最新版本'))return true}throw Error('Update panel native check failed: '+document.getElementById('updatestatus').textContent)})()`);updater.fetch=originalUpdateFetch;console.log('Desktop window, libraries, research and update UI ready.');window.destroy();server.close(()=>app.exit(0));return}
 const updateTimer=setTimeout(()=>{void updater.check().then(async state=>{if(!window||!['available','ready'].includes(state.stage))return;const result=await dialog.showMessageBox(window,{type:'info',buttons:['稍后','查看更新'],defaultId:1,cancelId:0,title:'Creator OS 有新版本',message:'可更新到 '+state.newVersion,detail:'更新保留本机数据。可在使用与备份页查看说明、下载和安装。'});if(result.response===1&&window)await window.loadURL('creator://app/setup.html')}).catch(()=>{})},10000);updateTimer.unref();
 app.on('activate',()=>{if(!window)void openWindow()});
}).catch(e=>{if(app.commandLine.hasSwitch('smoke-test')){console.error(e);app.exit(1);return}dialog.showErrorBox('Creator OS 启动失败',e.message);app.quit()});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('will-quit',()=>{googleAuth?.cancel();stopLocalWork?.();server?.close()});

async function updateRequest(request,url){
 const json=(d,status=200)=>Response.json(d,{status});
 if(request.method==='GET'&&url.pathname==='/local/updates')return json(updater.status());
 const origin=request.headers.get('origin');
 if(request.method!=='POST'||request.headers.get('x-creator-update')!=='1'||origin&&origin!=='creator://app')return json({error:'不允许此更新请求'},403);
 try{
  const action=url.pathname.slice('/local/updates/'.length);
  if(action==='check')return json(await updater.check());
  if(action==='download'){void updater.download().catch(()=>{});return json(updater.status())}
  if(action==='cancel')return json(updater.cancel());
  if(action==='install'){
   if(updateInstallBusy)throw Error('正在处理更新安装');updateInstallBusy=true;
   try{
   if(localWorkActive())throw Error('请先等待视频上传或本地合并完成');
   if(updater.status().stage!=='ready')throw Error('请先完成更新下载');
   const backup=await window.webContents.executeJavaScript(`(async()=>{const locks=await navigator.locks?.query();if(locks?.held.some(x=>x.name.startsWith('creator-batch:')))throw Error('请先暂停生成队列');if(!window.Workbench)throw Error('请在使用与备份页执行更新');return Workbench.backup()})()`);
   await (await import(pathToFileURL(path.join(root,'backups.mjs')).href)).saveSnapshot(backup);
   const result=await dialog.showMessageBox(window,{type:'question',buttons:['取消','继续更新'],defaultId:0,cancelId:0,title:'更新 Creator OS',message:process.platform==='win32'?'将退出应用并启动安装。请先暂停生成队列、等待本地视频合并完成。':'将打开 DMG 安装包。请退出应用，再拖入“应用程序”覆盖安装。',detail:'本机编辑数据已在确认前保存为磁盘备份。'});
   if(result.response!==1)return json(updater.status());
   const file=await updater.prepareInstall();
   if(process.platform==='win32'){
    const child=require('node:child_process').spawn(file,['/S','--updated','--force-run'],{detached:true,stdio:'ignore'});
    await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject)});child.unref();updater.installing();setTimeout(()=>app.quit(),500);
   }else{const error=await shell.openPath(file);if(error)throw Error(error)}
   return json(updater.status());
   }finally{updateInstallBusy=false}
  }
  return json({error:'更新操作不存在'},404);
 }catch(e){return json({error:e.message},400)}
}

async function googleAuthRequest(request,url){
 const origin=request.headers.get('origin');
 if(origin&&origin!=='creator://app')return Response.json({error:'无效请求来源'},{status:403});
 const action=url.pathname.slice('/local/google-auth/'.length);
 if(request.method==='GET'&&action==='status')return Response.json(googleAuth.status(),{headers:{'cache-control':'no-store'}});
 if(request.method!=='POST'||request.headers.get('x-creator-auth')!=='1')return Response.json({error:'不允许此授权请求'},{status:403});
 try{if(action==='start')return Response.json(await googleAuth.start());if(action==='cancel')return Response.json(googleAuth.cancel());if(action==='result')return Response.json({session:googleAuth.consume()},{headers:{'cache-control':'no-store'}});return Response.json({error:'授权操作不存在'},{status:404})}catch{return Response.json({error:'授权结果不存在或已过期，请重新登录。'},{status:400})}
}

async function smokeGoogleLogin(loaded){
 let authorizationURL;const actualOpen=googleAuth.openExternal,actualFetch=googleAuth.fetch;
 googleAuth.openExternal=async url=>{authorizationURL=new URL(url)};
 googleAuth.fetch=async url=>url.includes('/token?')?Response.json({access_token:'smoke-google-access',refresh_token:'smoke-google-refresh',expires_in:3600,token_type:'bearer'}):Response.json({id:'smoke-google-user',email:'google-smoke@example.invalid'});
 loaded.setUpstreamFetch(async()=>Response.json({models:[{id:'gpt-image-2',enabled:true,resolutions:['1k','2k']}]}));
 try{
  await window.loadURL('creator://app/generation.html');
  await window.webContents.executeJavaScript(`document.getElementById('googlelogin').click()`);
  for(let i=0;i<100&&!authorizationURL;i++)await new Promise(r=>setTimeout(r,20));
  if(!authorizationURL)throw Error('Google login button did not open system authorization');
  const callback=new URL(authorizationURL.searchParams.get('redirect_to'));callback.searchParams.set('code','smoke-google-code');
  const response=await net.fetch(callback.href);if(!response.ok)throw Error('Google callback exchange smoke failed');
  await window.webContents.executeJavaScript(`(async()=>{for(let i=0;i<150;i++){if(document.getElementById('account').textContent==='google-smoke@example.invalid'){document.getElementById('logout').click();return true}await new Promise(r=>setTimeout(r,20))}throw Error('Google login session did not reach renderer')})()`);
 }finally{googleAuth.cancel();googleAuth.openExternal=actualOpen;googleAuth.fetch=actualFetch;loaded.setUpstreamFetch((url,options)=>net.fetch(url,options))}
}

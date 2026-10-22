const {app,BrowserWindow,protocol,net,shell,dialog,Menu}=require('electron');
const {randomBytes}=require('node:crypto');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
protocol.registerSchemesAsPrivileged([{scheme:'creator',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
app.setName('Creator OS');
if(app.commandLine.hasSwitch('smoke-test'))app.setPath('userData',require('node:fs').mkdtempSync(path.join(require('node:os').tmpdir(),'creator-smoke-')));
let window,server,base,stopLocalWork;
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
 window.webContents.on('will-prevent-unload',event=>{const choice=dialog.showMessageBoxSync(window,{type:'question',buttons:['继续使用','退出应用'],defaultId:0,cancelId:0,title:'正在进行生成任务',message:'退出后不再提交后续任务，已提交到原站的任务会继续运行。确定退出？'});if(choice===1)event.preventDefault()});
 window.on('closed',()=>window=null);
 await window.loadURL('creator://app/');
}
if(single)app.whenReady().then(async()=>{
 // User records survive app upgrades; no writable files inside the application bundle.
 process.env.CREATOR_DATA_DIR=path.join(app.getPath('userData'),'data');
 process.env.CREATOR_DESKTOP_TOKEN=token;
 const tools=app.isPackaged?path.join(process.resourcesPath,'tools'):path.join(root,'tools');
 process.env.PATH=tools+path.delimiter+(process.env.PATH||'');
 const loaded=await import(pathToFileURL(path.join(root,'server.mjs')).href);server=loaded.server;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
 base=`http://127.0.0.1:${server.address().port}`;
 stopLocalWork=(await import(pathToFileURL(path.join(root,'compose.mjs')).href)).stopLocalWork;
 protocol.handle('creator',async request=>{
  const url=new URL(request.url);
  if(url.hostname!=='app')return new Response('Not found',{status:404});
  const headers={'x-creator-desktop':token};
  for(const key of ['content-type','authorization','idempotency-key','range']){const value=request.headers.get(key);if(value)headers[key]=value}
  const method=request.method;const body=['GET','HEAD'].includes(method)?undefined:await request.arrayBuffer();
  try{return await net.fetch(base+url.pathname+url.search,{method,headers,body,redirect:'error'})}
  catch{return Response.json({error:'本机服务连接中断，请重新启动应用。'},{status:503})}
 });
 Menu.setApplicationMenu(Menu.buildFromTemplate([
  ...(process.platform==='darwin'?[{label:app.name,submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]}]:[]),
  {label:'文件',submenu:[{label:'使用与备份',click:()=>window?.loadURL('creator://app/setup.html')},{label:'打开数据文件夹',click:()=>shell.openPath(process.env.CREATOR_DATA_DIR)},{type:'separator'},process.platform==='darwin'?{role:'close'}:{role:'quit'}]},
  {label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
  {label:'视图',submenu:[{role:'reload'},{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{role:'togglefullscreen'}]}
 ]));
 await openWindow();
 if(app.commandLine.hasSwitch('smoke-test')){const response=await net.fetch('creator://app/local/environment');const state=await response.json();if(!response.ok||!state.desktop)throw Error('Desktop protocol smoke test failed');await window.loadURL('creator://app/library.html#ideas');const smoke=require('./library-smoke.cjs');await window.webContents.executeJavaScript('('+smoke.toString()+')()');console.log('Desktop window, library tasks and backup restore ready.');window.destroy();server.close(()=>app.exit(0));return}
 app.on('activate',()=>{if(!window)void openWindow()});
}).catch(e=>{if(app.commandLine.hasSwitch('smoke-test')){console.error(e);app.exit(1);return}dialog.showErrorBox('Creator OS 启动失败',e.message);app.quit()});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
app.on('will-quit',()=>{stopLocalWork?.();server?.close()});

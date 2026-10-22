import http from 'node:http';
import {APP_VERSION,APP_ID} from './app-info.mjs';
import {backupRoute} from './backups.mjs';
import {localRoute} from './compose.mjs';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const operations=new Set(['canvas-text-models','canvas-text-generate','models','capabilities','image-models','image-generate','image-status','upload-intent','generate','status','cancel','history','asset-url']);
export async function handleRequest(req,res){
 const u=new URL(req.url,'http://localhost');
 if(process.env.CREATOR_DESKTOP_TOKEN&&req.headers['x-creator-desktop']!==process.env.CREATOR_DESKTOP_TOKEN){res.writeHead(403);res.end();return}
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
 if(u.pathname==='/local/backups'){await backupRoute(req,res,u);return}
 if(u.pathname==='/local/environment'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({version:APP_VERSION,product:APP_ID,desktop:!!process.env.CREATOR_DESKTOP_TOKEN,dataDirectory:process.env.CREATOR_DATA_DIR||null,node:process.versions.node,platform:process.platform,localOnly:true}));return}
 if(u.pathname.startsWith('/local/')){await localRoute(req,res,u);return}
 if(u.pathname.startsWith('/gateway/')){
  res.setHeader('Cache-Control','no-store');
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`){res.writeHead(403);res.end();return}
  const op=u.pathname.slice('/gateway/'.length);const auth=op==='auth';
  if(!auth&&!operations.has(op)){res.writeHead(404);res.end();return}
  if(!['GET','POST'].includes(req.method)||auth&&req.method!=='POST'){res.writeHead(405);res.end();return}
  try{
   const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>1024*1024){res.writeHead(413);res.end();return}chunks.push(c)}
   const response=await fetch(`https://youtube-niche-global-api.vercel.app/api/${auth?'auth':'video/'+op}${u.search}`,{method:req.method,headers:{accept:'application/json',...(req.headers.authorization?{authorization:req.headers.authorization}:{}),...(req.headers['idempotency-key']?{'idempotency-key':req.headers['idempotency-key']}:{}),...(req.method==='POST'?{'content-type':'application/json'}:{})},body:req.method==='POST'?Buffer.concat(chunks):undefined,signal:AbortSignal.timeout(60000)});
   const text=await response.text();let data;try{data=JSON.parse(text)}catch{data={error:'上游服务返回了非 JSON 响应，请稍后查询任务状态。'}}res.writeHead(response.status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));
  }catch{res.writeHead(502,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'连接原站服务失败；若已提交生成，请查询已有任务，避免重复提交。'}))}return;
 }
 const files={'/library.html':'library.html','/library.js':'library.js','/library-model.mjs':'library-model.mjs','/':'index.html','/index.html':'index.html','/generation.html':'generation.html','/compose.html':'compose.html','/setup.html':'setup.html','/setup.js':'setup.js','/compose.js':'compose.js','/generation.js':'generation.js','/workspace.js':'workspace.js','/analytics.js':'analytics.js','/queue.mjs':'queue.mjs','/generation-config.mjs':'generation-config.mjs'};
 if(/^\/vendor\/(tabler-icons\.min\.css|fonts\/tabler-icons\.(woff2?|ttf|eot|svg))$/.test(u.pathname)){try{const data=await readFile(path.join(root,u.pathname.slice(1)));res.setHeader('Content-Type',u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.woff2')?'font/woff2':'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end()}return}
 if(!files[u.pathname]){res.writeHead(404);res.end();return}
 try{const file=files[u.pathname];res.setHeader('Content-Type',(file.endsWith('.js')||file.endsWith('.mjs'))?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(path.join(root,file)))}catch{res.writeHead(500);res.end('页面读取失败')}
}
export const server=http.createServer((req,res)=>handleRequest(req,res).catch(()=>{if(!res.headersSent){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:'本地服务未完成请求。'}))}else res.destroy()}));
if(process.argv[1]===fileURLToPath(import.meta.url))server.listen(Number(process.env.PORT)||4173,process.env.HOST||'127.0.0.1',()=>{const url='http://127.0.0.1:'+(process.env.PORT||4173);console.log('Creator OS running at '+url);if(process.argv.includes('--open')){const cmd=process.platform==='win32'?'rundll32':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(cmd,args,{stdio:'ignore'});child.on('error',()=>console.log('Open your browser at '+url));child.unref()}});

if(process.argv[1]===fileURLToPath(import.meta.url))server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port is in use. Close the existing app or choose another PORT.':e.message);process.exitCode=1});

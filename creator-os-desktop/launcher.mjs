import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,appendFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';import path from 'node:path';
import {APP_VERSION,APP_ID} from './app-info.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
export function openBrowser(url){const command=process.platform==='win32'?'rundll32':process.platform==='darwin'?'open':'xdg-open';const args=process.platform==='win32'?['url.dll,FileProtocolHandler',url]:[url];const child=spawn(command,args,{stdio:'ignore'});child.on('error',()=>console.log('Open your browser at '+url));child.unref()}
export async function chooseServer({preferred=4173,probe,listen,open=()=>{},version=APP_VERSION}){
 for(let offset=0;offset<10;offset++){
  const port=preferred+offset;if(port>65535)break;
  const existing=await probe(port);
  if(existing?.product===APP_ID){if(existing.version!==version)throw Error('An older Creator OS is running. Stop its startup window with Ctrl+C, then launch this version.');const url=`http://127.0.0.1:${port}`;open(url);return {port,url,reused:true}}
  if(existing?.legacyCreator)throw Error('An older Creator OS is running. Stop it with Ctrl+C before upgrading, to keep the same browser data address.');
  try{await listen(port)}catch(e){if(e.code==='EADDRINUSE')continue;throw e}
  const url=`http://127.0.0.1:${port}`;open(url);return {port,url,reused:false};
 }
 throw Error('No free local port was found. Close other instances and try again.');
}
async function probe(port){try{const r=await fetch(`http://127.0.0.1:${port}/local/environment`,{signal:AbortSignal.timeout(900)});if(!r.ok)return null;const d=await r.json();if(d.product===APP_ID)return d;if(d.localOnly&&d.node&&d.platform&&d.version)return {legacyCreator:true};return null}catch{return null}}
async function start(){if(Number(process.versions.node.split('.')[0])<22)throw Error('Node.js 22 or newer is required.');for(const file of ['server.mjs','index.html','generation.html','workspace.js','setup.html'])await stat(path.join(root,file));
 if(process.argv.includes('--check')){console.log(`Creator OS ${APP_VERSION}: runtime OK (${process.version}, ${process.platform}/${process.arch}).`);return}
 // Optional local FFmpeg tools can be copied here without a global install.
 process.env.PATH=path.join(root,'tools')+path.delimiter+(process.env.PATH||'');
 const {server}=await import('./server.mjs');let preferred=4173;try{const settings=JSON.parse(await readFile(path.join(root,'data','launcher.json'),'utf8'));if(Number.isInteger(settings.port)&&settings.port>=1024&&settings.port<=65525)preferred=settings.port}catch{}
 const result=await chooseServer({preferred,probe,listen:port=>new Promise((resolve,reject)=>{const fail=e=>{server.off('listening',ready);reject(e)};const ready=()=>{server.off('error',fail);resolve()};server.once('error',fail);server.once('listening',ready);server.listen(port,'127.0.0.1')}),open:process.argv.includes('--no-open')?()=>{}:openBrowser});
 console.log(`Creator OS ${APP_VERSION} ${result.reused?'is already running':'started'}: ${result.url}`);
 if(result.port!==4173)console.log('A different port was selected. Browser storage belongs to each address; your previous data remains at its previous address.');
 if(result.reused)return;
 console.log('Keep this window open. Press Ctrl+C to stop.');
 try{const dataDir=path.join(root,'data');await mkdir(dataDir,{recursive:true});await writeFile(path.join(dataDir,'launcher.json'),JSON.stringify({port:result.port}));const log=path.join(dataDir,'startup.log');try{if((await stat(log)).size>100000)await writeFile(log,'')}catch{}await appendFile(log,`${new Date().toISOString()} v${APP_VERSION} ${process.platform}/${process.arch} Node ${process.versions.node} ${result.url}\n`)}catch{console.log('Startup log could not be saved. Check folder write permissions.')}
}
if(process.argv[1]===fileURLToPath(import.meta.url))start().catch(e=>{console.error('Startup failed: '+e.message);process.exitCode=1});

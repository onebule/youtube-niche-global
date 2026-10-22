const fs=require('node:fs/promises');
const {createReadStream,createWriteStream}=require('node:fs');
const {createHash}=require('node:crypto');
const {Transform}=require('node:stream');
const {pipeline}=require('node:stream/promises');
const path=require('node:path');
const REPOSITORY='onebule/youtube-niche-global';
const FEED=`https://github.com/${REPOSITORY}/releases/latest/download/creator-update.json`;
const versionPattern=/^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/;
function compare(a,b){if(!versionPattern.test(a)||!versionPattern.test(b))throw Error('版本号无效');const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++)if(x[i]!==y[i])return Math.sign(x[i]-y[i]);return 0}
function validateManifest(d,platform,arch){
 if(!d||d.schema!==1||!versionPattern.test(d.version)||typeof d.notes!=='string'||d.notes.length>12000)throw Error('更新清单格式无效');
 const asset=d.assets?.[platform+'-'+arch],ext=platform==='win32'?'exe':'dmg',os=platform==='win32'?'win':'mac';
 if(!asset||!Number.isSafeInteger(asset.size)||asset.size<1||asset.size>1024*1024*1024||!/^([a-f0-9]{64})$/.test(asset.sha256))throw Error('未找到此系统对应的有效安装包');
 const name=`Creator-OS-${d.version}-${os}-${arch}.${ext}`;
 const expected=`https://github.com/${REPOSITORY}/releases/download/creator-os-v${d.version}/${name}`;
 if(asset.url!==expected)throw Error('更新安装包地址不受信任');
 return {...asset,name,version:d.version,notes:d.notes};
}
async function verifyFile(file,asset){try{const stat=await fs.stat(file);if(!stat.isFile()||stat.size!==asset.size)return false;const hash=createHash('sha256');for await(const c of createReadStream(file))hash.update(c);return hash.digest('hex')===asset.sha256}catch{return false}}
class UpdateManager{
 constructor({fetch,cacheDirectory,version,platform,arch}){this.fetch=fetch;this.directory=cacheDirectory;this.currentVersion=version;this.platform=platform;this.arch=arch;this.asset=null;this.file=null;this.busy=false;this.state={stage:'idle',currentVersion:version,newVersion:null,notes:'',percent:0,received:0,total:0,message:'尚未检查更新',installMode:platform==='win32'?'automatic':'manual',supported:(platform==='win32'&&arch==='x64')||(platform==='darwin'&&['x64','arm64'].includes(arch))}}
 status(){return {...this.state}}
 async check(){
  if(this.busy||this.state.stage==='installing')return this.status();if(!this.state.supported){this.state.message='暂不支持此系统架构的在线更新';return this.status()}
  this.busy=true;this.state={...this.state,stage:'checking',message:'正在检查正式发布版本…'};
  try{const r=await this.fetch(FEED,{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error(r.status===404?'尚无可用的正式更新，请稍后重试':`更新服务暂不可用（${r.status}）`);const text=await r.text();if(Buffer.byteLength(text)>100000)throw Error('更新清单过大');const d=JSON.parse(text);const asset=validateManifest(d,this.platform,this.arch);if(compare(asset.version,this.currentVersion)<=0){this.asset=null;this.file=null;this.state={...this.state,stage:'current',newVersion:null,notes:'',message:'当前已是最新版本'};return this.status()}this.asset=asset;this.file=path.join(this.directory,asset.name);const cached=await verifyFile(this.file,asset);this.state={...this.state,stage:cached?'ready':'available',newVersion:asset.version,notes:asset.notes,percent:cached?100:0,received:cached?asset.size:0,total:asset.size,message:cached?'更新已下载并通过校验':'发现新版本，确认后下载'};
  }catch(e){this.state={...this.state,stage:'error',message:e.message}}finally{this.busy=false}return this.status()
 }
 async download(){
  if(this.busy)throw Error('已有更新操作正在进行');if(!this.asset||!['available','error'].includes(this.state.stage))throw Error('请先检查更新');
  this.busy=true;this.controller=new AbortController();const temporary=this.file+'.part';const asset=this.asset;this.state={...this.state,stage:'downloading',received:0,percent:0,message:'正在下载安装包…'};
  try{await fs.mkdir(this.directory,{recursive:true});const r=await this.fetch(asset.url,{signal:AbortSignal.any([this.controller.signal,AbortSignal.timeout(15*60*1000)])});if(!r.ok||!r.body)throw Error(`安装包下载失败（${r.status}）`);const declared=r.headers.get('content-length');if(declared&&Number(declared)!==asset.size)throw Error('安装包大小与清单不一致');const hash=createHash('sha256');let received=0;const manager=this;const meter=new Transform({transform(chunk,encoding,done){received+=chunk.length;if(received>asset.size){done(Error('安装包超过预期大小'));return}hash.update(chunk);manager.state={...manager.state,received,percent:Math.min(99,Math.floor(received/asset.size*100))};done(null,chunk)}});await pipeline(r.body,meter,createWriteStream(temporary,{mode:0o600}),{signal:this.controller.signal});if(received!==asset.size||hash.digest('hex')!==asset.sha256)throw Error('安装包校验失败，已拒绝安装，请重新下载');await fs.rm(this.file,{force:true});await fs.rename(temporary,this.file);this.state={...this.state,stage:'ready',percent:100,message:'下载完成，SHA-256 校验通过'};
  }catch(e){await fs.rm(temporary,{force:true}).catch(()=>{});this.state={...this.state,stage:'available',percent:0,received:0,message:this.controller.signal.aborted?'已取消下载':e.message};throw Error(this.state.message)}finally{this.controller=null;this.busy=false}return this.status()
 }
 cancel(){this.controller?.abort();return this.status()}
 async prepareInstall(){if(this.busy||this.state.stage!=='ready'||!this.asset)throw Error('安装包尚未准备好');this.busy=true;try{if(!await verifyFile(this.file,this.asset)){this.state={...this.state,stage:'available',message:'安装包已变更或损坏，请重新下载'};throw Error(this.state.message)}return this.file}finally{this.busy=false}}
 installing(){this.state={...this.state,stage:'installing',message:'正在退出并启动更新安装程序'}}
}
module.exports={UpdateManager,validateManifest,verifyFile,compare,FEED,REPOSITORY};

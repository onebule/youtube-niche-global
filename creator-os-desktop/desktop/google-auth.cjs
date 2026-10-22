const http=require('node:http');
const {randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const config=require('./auth-config.cjs');
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&/^[a-f0-9]+$/.test(a)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))}
class GoogleAuth{
 constructor({fetch,openExternal,now=Date.now,timeoutMs=5*60*1000,onComplete=()=>{}}){this.fetch=fetch;this.openExternal=openExternal;this.onComplete=onComplete;this.now=now;this.timeoutMs=timeoutMs;this.state={stage:'idle',message:''};this.sequence=0;this.server=null;this.secret=null;this.session=null;this.abort=null;this.timer=null}
 status(){return {...this.state}}
 closeListener(){clearTimeout(this.timer);this.timer=null;if(this.server){this.server.close();this.server.closeAllConnections?.();this.server=null}}
 cancel(message='已取消 Google 登录'){this.sequence++;this.abort?.abort();this.abort=null;this.closeListener();this.secret=null;this.session=null;this.state={stage:'cancelled',message};return this.status()}
 async start(){
  if(['opening','waiting','exchanging'].includes(this.state.stage))return this.status();
  this.cancel();const sequence=++this.sequence;this.state={stage:'opening',message:'正在打开系统浏览器…'};const verifier=randomBytes(32).toString('base64url'),nonce=randomBytes(24).toString('hex');this.secret={verifier,nonce};this.abort=new AbortController();
  try{this.server=http.createServer((req,res)=>{void this.callback(req,res,sequence).catch(()=>{if(!res.headersSent)this.reply(res,400,'登录未完成，请返回 Creator OS 重试。');else res.destroy()})});await new Promise((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve)});if(sequence!==this.sequence)return this.status();const port=this.server.address().port;this.callbackOrigin='http://127.0.0.1:'+port;const redirect=this.callbackOrigin+'/desktop-auth/callback?desktop_state='+nonce;const url=new URL(config.url+'/auth/v1/authorize');url.search=new URLSearchParams({provider:'google',redirect_to:redirect,flow_type:'pkce',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'s256',prompt:'select_account'}).toString();this.state={stage:'waiting',message:'请在系统浏览器完成 Google 登录，授权后会自动连接桌面版。'};this.timer=setTimeout(()=>{if(sequence===this.sequence)this.cancel('Google 登录等待超时，请重试。')},this.timeoutMs);this.timer.unref?.();await this.openExternal(url.href);return this.status()
  }catch{if(sequence===this.sequence){this.cancel();this.state={stage:'error',message:'无法打开系统浏览器或本机授权回调，请重试。'}}return this.status()}
 }
 reply(res,status,message){res.writeHead(status,{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'",'x-content-type-options':'nosniff'});res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Creator OS 登录</title><h1>Creator OS</h1><p>'+message+'</p><p>可以关闭此页面，返回桌面应用。</p></html>')}
 async callback(req,res,sequence){
  if(req.method!=='GET'||req.headers.host!==new URL(this.callbackOrigin).host){this.reply(res,400,'无效的授权回调。');return}
  const url=new URL(req.url,this.callbackOrigin);if(url.pathname!=='/desktop-auth/callback'||sequence!==this.sequence||!this.secret||!equal(url.searchParams.get('desktop_state'),this.secret.nonce)){this.reply(res,400,'此授权链接无效或已过期，请返回应用重试。');return}
  if(this.state.stage!=='waiting'){this.reply(res,409,'此授权请求已处理，请返回应用。');return}
  if(url.searchParams.has('error')){res.once('finish',()=>this.cancel('Google 授权未完成或已取消，请重新登录。'));this.reply(res,200,'已取消本次 Google 授权。');return}
  const code=url.searchParams.get('code');if(!code||code.length>4096){this.reply(res,400,'未收到授权码，请重新登录。');return}
  this.state={stage:'exchanging',message:'Google 已返回授权码，正在验证原站账号…'};
  try{
   const headers={apikey:config.publishableKey,'content-type':'application/json'};
   const response=await this.fetch(config.url+'/auth/v1/token?grant_type=pkce',{method:'POST',headers,body:JSON.stringify({auth_code:code,code_verifier:this.secret.verifier}),signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(25000)]),credentials:'omit',redirect:'error'});
   const d=await response.json().catch(()=>null);if(!response.ok||!d?.access_token||!d.refresh_token||d.token_type?.toLowerCase()!=='bearer'||!Number.isFinite(d.expires_in)||d.expires_in<=0)throw Error('授权会话交换未完成，请重新登录。');
   const verified=await this.fetch(config.url+'/auth/v1/user',{headers:{apikey:config.publishableKey,authorization:'Bearer '+d.access_token},signal:AbortSignal.any([this.abort.signal,AbortSignal.timeout(20000)]),credentials:'omit',redirect:'error'});const user=await verified.json().catch(()=>null);if(!verified.ok||typeof user?.id!=='string'||!user.id||typeof user.email!=='string'||!user.email)throw Error('原站账号验证失败，请重新登录。');
   if(sequence!==this.sequence){this.reply(res,400,'登录请求已取消。');return}
   this.session={accessToken:d.access_token,refreshToken:d.refresh_token,userId:user.id,email:user.email,name:typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:user.email,expiresAt:this.now()+d.expires_in*1000,authProvider:'google'};this.secret=null;clearTimeout(this.timer);this.state={stage:'completed',message:'Google 登录成功，正在连接桌面工作台…'};this.onComplete();this.reply(res,200,'登录成功，请返回 Creator OS。');this.timer=setTimeout(()=>{if(sequence===this.sequence){this.session=null;this.state={stage:'error',message:'登录结果等待超时，请重新登录。'}}},120000);this.timer.unref?.();res.once('finish',()=>{this.server?.close();this.server=null});
  }catch{if(sequence===this.sequence){this.secret=null;this.state={stage:'error',message:'Google 授权未能完成会话验证。请检查网络后重新登录，不要重复使用旧授权页面。'};this.reply(res,400,'登录验证未完成，请返回应用重试。');res.once('finish',()=>this.closeListener())}}
 }
 consume(){if(this.state.stage!=='completed'||!this.session)throw Error('没有可接收的 Google 登录结果');const session=this.session;this.session=null;clearTimeout(this.timer);this.state={stage:'consumed',message:'Google 会话已连接'};return session}
}
module.exports={GoogleAuth};

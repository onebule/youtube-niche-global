export type AccountSession={accessToken:string;email:string;name:string;userId?:string;refreshToken?:string;expiresAt?:number;authProvider?:'google'|'password'};
export type PasswordAuthInput={action:'login'|'register';email:string;password:string;name?:string};
export type PasswordAuthResult={ok:boolean;session?:AccountSession;requiresEmailConfirmation?:boolean;email?:string;error?:string;code?:string};

const AUTH_ENDPOINT = process.env.NEXT_PUBLIC_AUTH_URL || 'https://youtube-niche-global-api.vercel.app/api/auth';

const key='signalcraft-auth-v1';
const legacyFrontendHosts=new Set(['youtube-niche-global.vercel.app','www.youtube-niche-global.vercel.app']);
// This URL is public by design. The hosted client only needs it to start the
// OAuth redirect; it never contains a service-role key or OAuth secret.
const supabaseUrl=(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://fkapfjnecdcbggazyncb.supabase.co').replace(/\/$/,'');

function payload(token:string){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}

function valid(value:AccountSession|null){return Boolean(value?.accessToken&&(!value.expiresAt||value.expiresAt>Date.now()))}

function saveSession(session:AccountSession){
  if(typeof window!=='undefined')localStorage.setItem(key,JSON.stringify(session));
  return session;
}

function sessionFromPayload(value:unknown, authProvider:'google'|'password'='password'){
  const session=(value as {session?:Partial<AccountSession>}|null)?.session;
  if(!session?.accessToken||!session.email)return null;
  return saveSession({
    accessToken:String(session.accessToken),
    refreshToken:session.refreshToken?String(session.refreshToken):undefined,
    userId:session.userId?String(session.userId):undefined,
    email:String(session.email),
    name:String(session.name||session.email),
    expiresAt:typeof session.expiresAt==='number'?session.expiresAt:undefined,
    authProvider,
  });
}

export function getSession():AccountSession|null{
  if(typeof window==='undefined')return null;
  const saved=getStoredSession();
  return valid(saved)?saved:null;
}

/** Read the persisted session for the refresh path without treating an expired
 * access token as authenticated UI state. */
export function getStoredSession():AccountSession|null{
  if(typeof window==='undefined')return null;
  try{return JSON.parse(localStorage.getItem(key)||'null') as AccountSession|null}catch{return null}
}

/** Supabase's implicit OAuth return lands on the app URL with a short-lived
 * access token in the fragment. Store only the session values needed to call
 * our API, then remove the fragment from the address bar. */
export function captureOAuthReturn(){
  if(typeof window==='undefined')return getSession();
  const hash=new URLSearchParams(location.hash.slice(1));
  const accessToken=hash.get('access_token');
  if(!accessToken)return getSession();
  const claims=payload(accessToken)||{};
  const refreshToken=hash.get('refresh_token');
  const next:AccountSession={accessToken,userId:claims.sub?String(claims.sub):undefined,refreshToken:refreshToken||undefined,email:String(claims.email||'已登录账号'),name:String(claims.user_metadata?.full_name||claims.email||'创作者'),expiresAt:claims.exp?Number(claims.exp)*1000:undefined,authProvider:'google'};
  saveSession(next);
  history.replaceState({},'',`${location.pathname}${location.search}`);
  return next;
}

export function authHeaders():Record<string,string>{const session=getSession();return session?{authorization:`Bearer ${session.accessToken}`}:{} }

export function signOut(){if(typeof window!=='undefined')localStorage.removeItem(key)}

export function startGoogleSignIn({direct=false}:{direct?:boolean}={}){
  if(!supabaseUrl)return false;
  if(typeof window!=='undefined'&&!direct&&location.pathname!=='/login'){
    location.assign('/login');
    return true;
  }
  // Keep OAuth on the custom frontend host even when a user starts from an
  // old Vercel bookmark. Local/preview hosts continue to use their own origin.
  const origin=legacyFrontendHosts.has(location.hostname.toLowerCase())?'https://niqivo.top':location.origin;
  const redirectTo=`${origin}${location.pathname}`;
  location.assign(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  return true;
}

async function postPasswordAuth(input:PasswordAuthInput|{action:'refresh';refreshToken:string}):Promise<PasswordAuthResult>{
  try{
    const response=await fetch(AUTH_ENDPOINT,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(input),cache:'no-store'});
    const payload=await response.json().catch(()=>({})) as PasswordAuthResult;
    if(!response.ok)return {ok:false,error:typeof payload.error==='string'?payload.error:'账号操作未完成，请稍后重试。',code:payload.code};
    const session=sessionFromPayload(payload,'password');
    return {...payload,ok:true,session:session||undefined};
  }catch{return {ok:false,error:'认证服务暂时不可用，请稍后重试。',code:'AUTH_NETWORK_ERROR'};}
}

export function passwordSignIn(input:{email:string;password:string}){return postPasswordAuth({action:'login',...input});}

export function passwordSignUp(input:{email:string;password:string;name?:string}){return postPasswordAuth({action:'register',...input});}

export async function refreshSession(refreshToken:string){
  const result=await postPasswordAuth({action:'refresh',refreshToken});
  return result.session||null;
}

export const refreshPasswordSession=refreshSession;

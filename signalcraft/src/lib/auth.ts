export type AccountSession={accessToken:string;email:string;name:string;expiresAt?:number};

const key='signalcraft-auth-v1';
// This URL is public by design. The hosted client only needs it to start the
// OAuth redirect; it never contains a service-role key or OAuth secret.
const supabaseUrl=(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://fkapfjnecdcbggazyncb.supabase.co').replace(/\/$/,'');

function payload(token:string){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return null}}

function valid(value:AccountSession|null){return Boolean(value?.accessToken&&(!value.expiresAt||value.expiresAt>Date.now()))}

export function getSession():AccountSession|null{
  if(typeof window==='undefined')return null;
  try{const saved=JSON.parse(localStorage.getItem(key)||'null') as AccountSession|null;return valid(saved)?saved:null}catch{return null}
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
  const next:AccountSession={accessToken,email:String(claims.email||'已登录账号'),name:String(claims.user_metadata?.full_name||claims.email||'创作者'),expiresAt:claims.exp?Number(claims.exp)*1000:undefined};
  localStorage.setItem(key,JSON.stringify(next));
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
  const redirectTo=`${location.origin}${location.pathname}`;
  location.assign(`${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`);
  return true;
}

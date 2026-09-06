import { authHeaders } from './auth';

const BILLING_ENDPOINT = (process.env.NEXT_PUBLIC_BILLING_URL || 'https://youtube-niche-global-api.vercel.app/api/billing').replace(/\/$/, '');
export type BillingStatus = { plan:'free'|'pro'; status:string; billingCycle?:'monthly'|'yearly'|null; currentPeriodEnd:string|null; cancelAtPeriodEnd:boolean; portalUrl:string|null; billing:{enabled:boolean;environment:'test'|'prod';cycles:string[];reason?:string} };
export class BillingClientError extends Error { code:string; status:number; constructor(message:string,code='BILLING_REQUEST_FAILED',status=500){super(message);this.name='BillingClientError';this.code=code;this.status=status;} }
async function request<T>(path:string, options:RequestInit={}) : Promise<T>{
  const response=await fetch(`${BILLING_ENDPOINT}${path}`,{...options,headers:{accept:'application/json','content-type':'application/json',...authHeaders(),...(options.headers||{})},cache:'no-store'});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new BillingClientError(typeof payload.error==='string'?payload.error:'结算服务暂时不可用。',typeof payload.code==='string'?payload.code:'BILLING_REQUEST_FAILED',response.status);
  return payload as T;
}
export function getBillingStatus(){return request<BillingStatus>('/status');}
export function startProCheckout(billingCycle:'monthly'|'yearly'){return request<{checkoutUrl:string;expiresAt:string;billingCycle:'monthly'|'yearly';environment:'test'|'prod'}>('/checkout',{method:'POST',body:JSON.stringify({billingCycle})});}
export function getBillingPortal(){return request<{portalUrl:string}>('/portal');}

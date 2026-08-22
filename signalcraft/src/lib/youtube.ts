import type { Channel, Video } from './types';
import { authHeaders } from './auth';

type ApiOpportunity = {
  title:string; topic?:string; languageCode?:string; channelId?:string; channelTitle:string; channelUrl?:string; thumbnail?:string; videoUrl?:string; views:number; subscribers:number;
  ageDays:number; publishedAt?:string; durationSeconds?:number; likes?:number; comments?:number;
  format:'short'|'long'; breakoutRatio?:number; viralLabel?:string; isMadeForKids?:boolean;
};

type ApiResponse = {
  longOpportunities?:ApiOpportunity[];
  shortOpportunities?:ApiOpportunity[];
  recentDays?:number;
  noCandidatesMessage?:string;
  error?:string;
  quota?:{allowed:boolean;remaining?:number|null;used?:number;daily_limit?:number;configured?:boolean;account?:{email?:string}|null};
};

const languageCode:Record<string,string>={ '英语':'en','西班牙语':'es','葡萄牙语':'pt','all':'en' };
const displayLanguage=(code?:string)=>{const normalized=String(code||'').toLowerCase();if(normalized.startsWith('en'))return '英语';if(normalized.startsWith('es'))return '西班牙语';if(normalized.startsWith('pt'))return '葡萄牙语';if(normalized.startsWith('zh'))return '中文';if(normalized.startsWith('ja'))return '日语';if(normalized.startsWith('ko'))return '韩语';if(normalized.startsWith('hi'))return '印地语';if(normalized.startsWith('ar'))return '阿拉伯语';return '未标注'};
const displayRegion:Record<string,string>={US:'美国',GB:'英国',JP:'日本',BR:'巴西',MX:'墨西哥',IN:'印度',ID:'印度尼西亚'};
// Use the project alias rather than an immutable Vercel deployment URL. The
// alias survives redeployments and is the only backend origin the frontend
// should depend on in production.
const productionEndpoint='https://youtube-niche-global-api.vercel.app/api/youtube-signals';
// Route browser requests through our own deployment. This removes browser CORS
// from the equation and returns useful upstream errors instead of TypeError:
// Failed to fetch.
const endpoint='/api/youtube-signals';
const thumbnailEndpoint = productionEndpoint.replace('/api/youtube-signals','/api/thumbnail');

/** Public YouTube data only. A single fetch is deliberately kept as one snapshot,
 * so the UI can distinguish average performance from a measured growth trend. */
export async function searchYouTubeSignals(input:{query:string;language:string;region?:string;window:string;maxSubscribers?:string;minimumViews?:string;format?:'short'|'long';category?:string;ranking?:boolean;limit?:number}){
  const days = input.window==='24h'?1:input.window==='7d'?7:input.window==='28d'?28:input.window==='90d'?90:input.window==='180d'?180:365;
  const maxSubscribers=input.maxSubscribers==='all'?'all':input.maxSubscribers||'100000';
  // A 1M-view floor made newer, smaller channels disappear before the
  // opportunity score could evaluate them. Keep the public sample broad,
  // then let the UI's channel-size and score filters do the ranking.
  const region=input.region||'US';
  const minimumViews=Number(input.minimumViews||0)>0?String(input.minimumViews):'10000';
  const params=new URLSearchParams({query:input.query,language:languageCode[input.language]||'en',region,recentDays:String(days),maxSubscribers,minimumViews});
  if(input.format) params.set('format',input.format);
  if(input.category && input.category!=='all') params.set('category',input.category);
  if(input.ranking) params.set('ranking','1');
  if(input.limit) params.set('limit',String(Math.min(Math.max(Math.round(input.limit),1),100)));
  const response=await fetch(`${endpoint}?${params}`,{headers:{accept:'application/json',...authHeaders()}});
  const payload=await response.json() as ApiResponse;
  if(!response.ok) throw new Error(payload.error||'YouTube 公开数据请求失败。');
  const source=[...(payload.longOpportunities||[]),...(payload.shortOpportunities||[])];
  if(!source.length) throw new Error(payload.noCandidatesMessage||'没有找到符合条件的公开样本。');
  const channels:Channel[]=[];
  const videos:Video[]=source.map((item,index)=>{
    const bucket=input.format||'all';
    const channelId=item.channelId||`yt-channel-${bucket}-${index}`;
    const publishedAt=item.publishedAt || new Date(Date.now()-Math.max(item.ageDays,1)*86400000).toISOString();
    const videoLanguage=displayLanguage(item.languageCode);
    const market=displayRegion[region]||region;
    // A search/ranking response contains one video per channel, not a channel
    // history. Do not manufacture a "median" by reversing views/subscribers:
    // that turns the subscriber count into a misleading performance baseline.
    channels.push({id:channelId,title:item.channelTitle,handle:'公开频道',url:item.channelUrl,subscribers:item.subscribers,language:videoLanguage,region:market,medianViews:Math.max(item.views,1),health:0,tags:['YouTube 公开数据','单样本基线'],owner:'未分配',lastSync:'刚刚'});
    const thumbnail=item.thumbnail?`${thumbnailEndpoint}?url=${encodeURIComponent(item.thumbnail)}`:'';
    return {id:`yt-${bucket}-${index}-${item.title.slice(0,18)}`,channelId,title:item.title,topic:item.topic||input.query||'公开趋势',language:videoLanguage,region:market,format:item.format,durationSeconds:item.durationSeconds || (item.format==='short'?55:480),thumbnail,sourceUrl:item.videoUrl,publishedAt,risk:'medium',tags:['YouTube 公开数据','单次快照',item.isMadeForKids?'儿童内容':'非儿童内容',item.viralLabel||''],snapshots:[{capturedAt:new Date().toISOString(),views:item.views,likes:item.likes||0,comments:item.comments||0,subscribers:item.subscribers}]};
  });
  return {videos,channels,requestedDays:payload.recentDays||days,quota:payload.quota};
}

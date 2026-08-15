import type { Channel, Video } from './types';

type ApiOpportunity = {
  title:string; channelTitle:string; thumbnail?:string; videoUrl?:string; views:number; subscribers:number;
  ageDays:number; publishedAt?:string; durationSeconds?:number; likes?:number; comments?:number;
  format:'short'|'long'; breakoutRatio?:number; viralLabel?:string;
};

type ApiResponse = {
  longOpportunities?:ApiOpportunity[];
  shortOpportunities?:ApiOpportunity[];
  recentDays?:number;
  noCandidatesMessage?:string;
  error?:string;
};

const languageCode:Record<string,string>={ '英语':'en','西班牙语':'es','葡萄牙语':'pt','all':'en' };
const endpoint = process.env.NEXT_PUBLIC_YOUTUBE_SIGNALS_URL || 'https://youtube-niche-global-api.vercel.app/api/youtube-signals';

/** Public YouTube data only. A single fetch is deliberately kept as one snapshot,
 * so the UI can distinguish average performance from a measured growth trend. */
export async function searchYouTubeSignals(input:{query:string;language:string;window:string;maxSubscribers?:string;format?:'short'|'long';ranking?:boolean}){
  const days = input.window==='24h'?1:input.window==='7d'?7:28;
  const maxSubscribers=input.maxSubscribers==='all'?'all':input.maxSubscribers||'100000';
  const params=new URLSearchParams({query:input.query,language:languageCode[input.language]||'en',region:'US',recentDays:String(days),maxSubscribers});
  if(input.format) params.set('format',input.format);
  if(input.ranking) params.set('ranking','1');
  const response=await fetch(`${endpoint}?${params}`,{headers:{accept:'application/json'}});
  const payload=await response.json() as ApiResponse;
  if(!response.ok) throw new Error(payload.error||'YouTube 公开数据请求失败。');
  const source=[...(payload.longOpportunities||[]),...(payload.shortOpportunities||[])];
  if(!source.length) throw new Error(payload.noCandidatesMessage||'没有找到符合条件的公开样本。');
  const channels:Channel[]=[];
  const videos:Video[]=source.map((item,index)=>{
    const bucket=input.format||'all';
    const channelId=`yt-channel-${bucket}-${index}`;
    const publishedAt=item.publishedAt || new Date(Date.now()-Math.max(item.ageDays,1)*86400000).toISOString();
    channels.push({id:channelId,title:item.channelTitle,handle:'公开频道',subscribers:item.subscribers,language:input.language==='all'?'英语':input.language,region:'美国',medianViews:Math.max(Math.round(item.views/Math.max(item.breakoutRatio||1,1)),1),health:0,tags:['YouTube 公开数据'],owner:'未分配',lastSync:'刚刚'});
    return {id:`yt-${bucket}-${index}-${item.title.slice(0,18)}`,channelId,title:item.title,topic:input.query,language:input.language==='all'?'英语':input.language,region:'美国',format:item.format,durationSeconds:item.durationSeconds || (item.format==='short'?55:480),thumbnail:item.thumbnail||'',sourceUrl:item.videoUrl,publishedAt,risk:'medium',tags:['YouTube 公开数据','单次快照',item.viralLabel||''],snapshots:[{capturedAt:new Date().toISOString(),views:item.views,likes:item.likes||0,comments:item.comments||0,subscribers:item.subscribers}]};
  });
  return {videos,channels,requestedDays:payload.recentDays||days};
}

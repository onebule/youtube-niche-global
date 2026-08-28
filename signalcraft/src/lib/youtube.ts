import type { AnalysisClass, Channel, ContentType, PlatformType, Video } from './types';
import { authHeaders } from './auth';

type ApiOpportunity = {
  title:string; topic?:string; languageCode?:string; marketCode?:string; channelId?:string; channelTitle:string; channelUrl?:string; channelThumbnail?:string; thumbnail?:string; videoUrl?:string; views:number; subscribers:number;
  ageDays:number; publishedAt?:string; durationSeconds?:number; likes?:number; comments?:number;
  format:'short'|'long'|'unknown'; formatConfidence?:'high'|'medium'|'low'; formatSource?:string; formatVersion?:number; formatSignals?:string[]; platformType?:PlatformType; platformTypeSource?:string; contentType?:ContentType; analysisClass?:AnalysisClass; formatConfidenceScore?:number; aspectRatio?:string|null; shortScore?:number|null; longScore?:number|null; evidenceUsed?:string[]; missingEvidence?:string[]; classificationReason?:string[]; needsSecondaryAnalysis?:boolean; classificationVersion?:string; breakoutRatio?:number; viralLabel?:string; isMadeForKids?:boolean; latestCapturedAt?:string|null; baselineViews?:number|null; baselineCapturedAt?:string|null;
};

export type PublicRankingScope = {
  source:'stored-corpus'|'live-chart';
  markets:string[];
  marketCount:number;
  publishedWindowDays:number;
  collectionLookbackDays:number;
  latestCapturedAt:string|null;
  growthComparableCount?:number;
  freshness?:'verified'|'snapshot';
  revalidatedCount?:number;
};

const isPublicRankingScope=(value:unknown):value is PublicRankingScope=>{
  if(!value||typeof value!=='object')return false;
  const scope=value as Partial<PublicRankingScope>;
  return (scope.source==='stored-corpus'||scope.source==='live-chart')
    && Array.isArray(scope.markets)
    && Number.isFinite(scope.marketCount)
    && Number.isFinite(scope.publishedWindowDays)
    && Number.isFinite(scope.collectionLookbackDays)
    && (scope.latestCapturedAt===null||typeof scope.latestCapturedAt==='string')
    && (scope.growthComparableCount===undefined||Number.isFinite(scope.growthComparableCount))
    && (scope.freshness===undefined||scope.freshness==='verified'||scope.freshness==='snapshot')
    && (scope.revalidatedCount===undefined||Number.isFinite(scope.revalidatedCount));
};

type ApiResponse = {
  longOpportunities?:ApiOpportunity[];
  shortOpportunities?:ApiOpportunity[];
  recentDays?:number;
  noCandidatesMessage?:string;
  nextPageToken?:string|null;
  dataScope?:PublicRankingScope;
  error?:string;
  quota?:{allowed:boolean;remaining?:number|null;used?:number;daily_limit?:number|null;configured?:boolean;owner?:boolean;authenticated?:boolean;access_tier?:'guest'|'signed-in'|'opened'|'owner';ranking_limit?:number|null;ranking_unlimited?:boolean;account?:{email?:string}|null};
};

const languageCode:Record<string,string>={ '英语':'en','西班牙语':'es','葡萄牙语':'pt','all':'en' };
const displayLanguage=(code?:string)=>{const normalized=String(code||'').toLowerCase();if(normalized.startsWith('en'))return '英语';if(normalized.startsWith('es'))return '西班牙语';if(normalized.startsWith('pt'))return '葡萄牙语';if(normalized.startsWith('zh'))return '中文';if(normalized.startsWith('ja'))return '日语';if(normalized.startsWith('ko'))return '韩语';if(normalized.startsWith('hi'))return '印地语';if(normalized.startsWith('ar'))return '阿拉伯语';return '未标注'};
const displayRegion:Record<string,string>={all:'全部国家',US:'美国',GB:'英国',JP:'日本',BR:'巴西',MX:'墨西哥',IN:'印度',ID:'印度尼西亚'};
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
export async function searchYouTubeSignals(input:{query:string;language:string;region?:string;window:string;maxSubscribers?:string;minimumViews?:string;format?:'short'|'long';category?:string;entity?:'videos'|'channels';ranking?:boolean;refresh?:boolean;limit?:number;pageToken?:string}){
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
  if(input.entity==='channels') params.set('entity','channels');
  if(input.refresh) params.set('refresh','1');
  if(input.limit) params.set('limit',String(Math.min(Math.max(Math.round(input.limit),1),100)));
  if(input.pageToken) params.set('pageToken',input.pageToken);
  const response=await fetch(`${endpoint}?${params}`,{headers:{accept:'application/json',...authHeaders()}});
  const payload=await response.json() as ApiResponse;
  if(!response.ok) throw new Error(payload.error||'YouTube 公开数据请求失败。');
  const source=[...(payload.longOpportunities||[]),...(payload.shortOpportunities||[])].filter(item=>Boolean(item.channelId&&item.channelTitle&&item.channelUrl)&&Number.isFinite(Number(item.subscribers))&&Number(item.subscribers)>0);
  const channels:Channel[]=[];
  const videos:Video[]=source.map((item,index)=>{
    const bucket=input.format||'all';
    const channelId=item.channelId||`yt-channel-${bucket}-${index}`;
    const publishedAt=item.publishedAt || new Date(Date.now()-Math.max(item.ageDays,1)*86400000).toISOString();
    const channelThumbnail=item.channelThumbnail?thumbnailEndpoint+'?url='+encodeURIComponent(item.channelThumbnail):'';
    const videoLanguage=displayLanguage(item.languageCode);
    const market=displayRegion[item.marketCode||region]||item.marketCode||region;
    // A search/ranking response contains one video per channel, not a channel
    // history. Do not manufacture a "median" by reversing views/subscribers:
    // that turns the subscriber count into a misleading performance baseline.
    channels.push({id:channelId,title:item.channelTitle,handle:'公开频道',url:item.channelUrl,thumbnail:channelThumbnail,subscribers:item.subscribers,language:videoLanguage,region:market,medianViews:Math.max(item.views,1),health:0,tags:['YouTube 公开数据','单条视频基线'],owner:'未分配',lastSync:'刚刚'});
    // The API already selects a card-appropriate thumbnail URL. The proxy
    // keeps that public YouTube URL off the client and preserves its cache.
    const thumbnail=item.thumbnail?`${thumbnailEndpoint}?url=${encodeURIComponent(item.thumbnail)}`:'';
    const sourceId=(item.videoUrl||`${bucket}-${index}`).split('v=').at(-1)||`${bucket}-${index}`;
    const currentCapturedAt=typeof item.latestCapturedAt==='string'&&Number.isFinite(new Date(item.latestCapturedAt).getTime())?item.latestCapturedAt:new Date().toISOString();
    const hasBaseline=Number.isFinite(Number(item.baselineViews))&&Number(item.baselineViews)>=0&&Number(item.baselineViews)<=item.views&&typeof item.baselineCapturedAt==='string'&&Number.isFinite(new Date(item.baselineCapturedAt).getTime())&&new Date(item.baselineCapturedAt).getTime()<new Date(currentCapturedAt).getTime();
    const snapshots=hasBaseline
      ? [{capturedAt:item.baselineCapturedAt!,views:Number(item.baselineViews),likes:0,comments:0,subscribers:item.subscribers},{capturedAt:currentCapturedAt,views:item.views,likes:item.likes||0,comments:item.comments||0,subscribers:item.subscribers}]
      : [{capturedAt:currentCapturedAt,views:item.views,likes:item.likes||0,comments:item.comments||0,subscribers:item.subscribers}];
    return {id:`yt-${sourceId}`,channelId,title:item.title,topic:item.topic||input.query||'公开趋势',language:videoLanguage,region:market,format:item.format,formatConfidence:item.formatConfidence,formatSource:item.formatSource,formatVersion:item.formatVersion,formatSignals:item.formatSignals,platformType:item.platformType,platformTypeSource:item.platformTypeSource,contentType:item.contentType,analysisClass:item.analysisClass,formatConfidenceScore:item.formatConfidenceScore,aspectRatio:item.aspectRatio,shortScore:item.shortScore,longScore:item.longScore,evidenceUsed:item.evidenceUsed,missingEvidence:item.missingEvidence,classificationReason:item.classificationReason,needsSecondaryAnalysis:item.needsSecondaryAnalysis,classificationVersion:item.classificationVersion,durationSeconds:item.durationSeconds || (item.format==='short'?55:480),thumbnail,sourceUrl:item.videoUrl,publishedAt,risk:'medium',tags:['YouTube 公开数据',hasBaseline?'两次采集对比':'单次快照',item.isMadeForKids?'儿童内容':'非儿童内容',item.viralLabel||''],snapshots};
  });
  return {videos,channels,requestedDays:payload.recentDays||days,quota:payload.quota,nextPageToken:payload.nextPageToken||null,dataScope:isPublicRankingScope(payload.dataScope)?payload.dataScope:null,noCandidatesMessage:source.length||input.pageToken?null:payload.noCandidatesMessage||'当前筛选条件下暂无可用的公开视频。请调整市场、时间范围或内容形态后重试。'};
}

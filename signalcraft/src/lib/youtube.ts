import type { AnalysisClass, Channel, ContentType, PlatformType, Video } from './types';
import { authHeaders } from './auth.ts';
import { clientErrorMessage } from './client-error.ts';
import { DATA_QUALITY_SCHEMA_VERSION, deriveDataQuality, type DataQuality, type EvidenceContract } from './evidence-contract.ts';

type ApiOpportunity = {
  videoId?:string|null; title?:string|null; titleZh?:string|null; topic?:string; languageCode?:string; marketCode?:string; channelId?:string|null; channelTitle?:string|null; channelUrl?:string|null; channelThumbnail?:string|null; thumbnail?:string|null; videoUrl?:string|null; views?:number|null; subscribers?:number|null;
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
  error?:unknown;
  quota?:{allowed:boolean;remaining?:number|null;used?:number;daily_limit?:number|null;configured?:boolean;owner?:boolean;authenticated?:boolean;access_tier?:'guest'|'signed-in'|'opened'|'owner';ranking_limit?:number|null;ranking_unlimited?:boolean;account?:{email?:string}|null};
};

const languageCode:Record<string,string>={ '英语':'en','西班牙语':'es','葡萄牙语':'pt','all':'en' };
const displayLanguage=(code?:string)=>{const normalized=String(code||'').toLowerCase();if(normalized.startsWith('en'))return '英语';if(normalized.startsWith('es'))return '西班牙语';if(normalized.startsWith('pt'))return '葡萄牙语';if(normalized.startsWith('zh'))return '中文';if(normalized.startsWith('ja'))return '日语';if(normalized.startsWith('ko'))return '韩语';if(normalized.startsWith('hi'))return '印地语';if(normalized.startsWith('ar'))return '阿拉伯语';return '未标注'};
const displayRegion:Record<string,string>={all:'全部国家',US:'美国',GB:'英国',JP:'日本',BR:'巴西',MX:'墨西哥',IN:'印度',ID:'印度尼西亚'};
// Use the project alias rather than an immutable Vercel deployment URL. The
// alias survives redeployments and is the only backend origin the frontend
// should depend on in production.
const productionEndpoint=process.env.NEXT_PUBLIC_YOUTUBE_SIGNALS_URL||'https://youtube-niche-global-api.vercel.app/api/youtube-signals';
// Route browser requests through our own deployment. This removes browser CORS
// from the equation and returns useful upstream errors instead of TypeError:
// Failed to fetch.
const endpoint='/api/youtube-signals';
const thumbnailEndpoint = productionEndpoint.replace('/api/youtube-signals','/api/thumbnail');

/** Public YouTube data only. A single fetch is deliberately kept as one snapshot,
 * so the UI can distinguish average performance from a measured growth trend. */
export async function searchYouTubeSignals(input:{query:string;language:string;locale?:'zh'|'en';region?:string;window:string;maxSubscribers?:string;minimumViews?:string;format?:'short'|'long';category?:string;entity?:'videos'|'channels';ranking?:boolean;refresh?:boolean;limit?:number;pageToken?:string}){
  const days = input.window==='24h'?1:input.window==='7d'?7:input.window==='28d'?28:input.window==='90d'?90:input.window==='180d'?180:365;
  const maxSubscribers=input.maxSubscribers==='all'?'all':input.maxSubscribers||'100000';
  // A 1M-view floor made newer, smaller channels disappear before the
  // opportunity score could evaluate them. Keep the public sample broad,
  // then let the UI's channel-size and score filters do the ranking.
  const region=input.region||'US';
  const minimumViews=Number(input.minimumViews||0)>0?String(input.minimumViews):'10000';
  const params=new URLSearchParams({query:input.query,language:languageCode[input.language]||'en',region,recentDays:String(days),maxSubscribers,minimumViews});
  params.set('locale',input.locale||'en');
  if(input.format) params.set('format',input.format);
  if(input.category && input.category!=='all') params.set('category',input.category);
  if(input.ranking) params.set('ranking','1');
  if(input.entity==='channels') params.set('entity','channels');
  if(input.refresh) params.set('refresh','1');
  if(input.limit) params.set('limit',String(Math.min(Math.max(Math.round(input.limit),1),100)));
  if(input.pageToken) params.set('pageToken',input.pageToken);
  const response=await fetch(`${endpoint}?${params}`,{headers:{accept:'application/json',...authHeaders()}});
  const payload=await response.json() as ApiResponse;
  if(!response.ok) throw new Error(clientErrorMessage(payload.error,'YouTube 公开数据请求失败。'));
  const candidates=[...(payload.longOpportunities||[]),...(payload.shortOpportunities||[])];
  // Identity is the only hard requirement here. Channel enrichment (channel
  // id/title/url/subscriber count) is optional public metadata and must not
  // make an otherwise useful video disappear from the evidence set.
  const source=candidates.filter(item=>{
    const usableIdentity=Boolean(item.videoId||item.videoUrl||item.thumbnail||(item.title&&(item.channelId||item.channelTitle)));
    return usableIdentity&&typeof item.views==='number'&&Number.isFinite(item.views);
  });
  const channels:Channel[]=[];
  const knownChannelIds=new Set<string>();
  const missingFields=new Set<string>();
  const videos:Video[]=source.map((item,index)=>{
    const bucket=input.format||'all';
    const title=typeof item.title==='string'&&item.title.trim()?item.title.trim():'未命名公开视频';
    const channelTitle=typeof item.channelTitle==='string'&&item.channelTitle.trim()?item.channelTitle.trim():'未命名频道';
    const hasSubscribers=typeof item.subscribers==='number'&&Number.isFinite(item.subscribers)&&item.subscribers>=0;
    const subscriberValue=hasSubscribers?Number(item.subscribers):null;
    const sourceId=(item.videoId||item.videoUrl||item.thumbnail||`${bucket}-${index}`).split('v=').at(-1)||`${bucket}-${index}`;
    const channelId=item.channelId||`unknown-channel-${sourceId}`;
    if(item.channelId) knownChannelIds.add(item.channelId);
    if(!item.title) { missingFields.add('title'); }
    if(!item.channelId) { missingFields.add('channelId'); }
    if(!item.channelTitle) { missingFields.add('channelTitle'); }
    if(!item.channelUrl) { missingFields.add('channelUrl'); }
    if(!hasSubscribers) { missingFields.add('subscribers'); }
    if(!item.thumbnail) { missingFields.add('thumbnail'); }
    const publishedAt=item.publishedAt || new Date(Date.now()-Math.max(item.ageDays,1)*86400000).toISOString();
    const channelThumbnail=item.channelThumbnail?thumbnailEndpoint+'?url='+encodeURIComponent(item.channelThumbnail):'';
    const videoLanguage=displayLanguage(item.languageCode);
    const market=displayRegion[item.marketCode||region]||item.marketCode||region;
    // A search/ranking response contains one video per channel, not a channel
    // history. Keep the channel entity for navigation, but explicitly mark its
    // baseline as insufficient instead of manufacturing a median from this row.
    channels.push({id:channelId,title:channelTitle,handle:'公开频道',url:item.channelUrl||undefined,thumbnail:channelThumbnail||undefined,subscribers:subscriberValue,subscriberState:hasSubscribers?(subscriberValue===0?'ZERO':'KNOWN'):'UNKNOWN',language:videoLanguage,region:market,medianViews:null,baselineStatus:'INSUFFICIENT',health:0,tags:['YouTube 公开数据'],owner:'未分配',lastSync:'刚刚'});
    // The API already selects a card-appropriate thumbnail URL. The proxy
    // keeps that public YouTube URL off the client and preserves its cache.
    const thumbnail=item.thumbnail?`${thumbnailEndpoint}?url=${encodeURIComponent(item.thumbnail)}`:'';
    const currentCapturedAt=typeof item.latestCapturedAt==='string'&&Number.isFinite(new Date(item.latestCapturedAt).getTime())?item.latestCapturedAt:new Date().toISOString();
    const views=Number(item.views);
    const hasBaseline=Number.isFinite(Number(item.baselineViews))&&Number(item.baselineViews)>=0&&Number(item.baselineViews)<=views&&typeof item.baselineCapturedAt==='string'&&Number.isFinite(new Date(item.baselineCapturedAt).getTime())&&new Date(item.baselineCapturedAt).getTime()<new Date(currentCapturedAt).getTime();
    const snapshots=hasBaseline
      ? [{capturedAt:item.baselineCapturedAt!,views:Number(item.baselineViews),likes:0,comments:0,...(hasSubscribers?{subscribers:subscriberValue!}: {})},{capturedAt:currentCapturedAt,views,likes:item.likes||0,comments:item.comments||0,...(hasSubscribers?{subscribers:subscriberValue!}: {})}]
      : [{capturedAt:currentCapturedAt,views,likes:item.likes||0,comments:item.comments||0,...(hasSubscribers?{subscribers:subscriberValue!}: {})}];
    return {id:`yt-${sourceId}`,channelId,title,titleZh:item.titleZh||null,topic:item.topic||input.query||'公开趋势',language:videoLanguage,region:market,format:item.format,formatConfidence:item.formatConfidence,formatSource:item.formatSource,formatVersion:item.formatVersion,formatSignals:item.formatSignals,platformType:item.platformType,platformTypeSource:item.platformTypeSource,contentType:item.contentType,analysisClass:item.analysisClass,formatConfidenceScore:item.formatConfidenceScore,aspectRatio:item.aspectRatio,shortScore:item.shortScore,longScore:item.longScore,evidenceUsed:item.evidenceUsed,missingEvidence:[...(item.missingEvidence||[]),...(!item.title?['title']:[]),...(!item.channelId?['channelId']:[]),...(!item.channelTitle?['channelTitle']:[]),...(!item.channelUrl?['channelUrl']:[]),...(!hasSubscribers?['subscribers']:[])],missingFields:[...new Set([...(item.title?[]:['title']),...(item.channelId?[]:['channelId']),...(item.channelTitle?[]:['channelTitle']),...(item.channelUrl?[]:['channelUrl']),...(hasSubscribers?[]:['subscribers']),...(item.thumbnail?[]:['thumbnail'])])],classificationReason:item.classificationReason,needsSecondaryAnalysis:item.needsSecondaryAnalysis,classificationVersion:item.classificationVersion,durationSeconds:item.durationSeconds || (item.format==='short'?55:480),thumbnail,sourceUrl:item.videoUrl||undefined,publishedAt,risk:'medium',tags:['YouTube 公开数据',hasBaseline?'两次采集对比':'单次快照',item.isMadeForKids?'儿童内容':'非儿童内容',item.viralLabel||''].filter(Boolean),snapshots};
  });
  const dataScope=isPublicRankingScope(payload.dataScope)?payload.dataScope:null;
  const knownFieldCount=candidates.reduce((sum,item)=>sum+[item.title,item.channelId,item.channelTitle,item.channelUrl,item.subscribers,item.thumbnail].filter(Boolean).length,0);
  const dataQuality:DataQuality=deriveDataQuality({sampleVideos:videos.length,sampleChannels:knownChannelIds.size,completeness:candidates.length?(knownFieldCount/(candidates.length*6))*100:0,capturedAt:dataScope?.latestCapturedAt||null,source:dataScope?.source||'youtube-public-api',missingFields:[...missingFields]});
  const evidence:EvidenceContract={schemaVersion:'evidence.v1',algorithmVersion:null,snapshotId:null,requestId:null,capturedAt:dataScope?.latestCapturedAt||null,source:dataScope?.source||'youtube-public-api',facts:[{statement:`保留 ${videos.length} 条具有可用身份与播放数据的公开视频记录`,type:'FACT',source:'youtube-normalizer'}],inferences:[],missing:[...missingFields]};
  return {videos,channels,requestedDays:payload.recentDays||days,quota:payload.quota,nextPageToken:payload.nextPageToken||null,dataScope,noCandidatesMessage:source.length||input.pageToken?null:payload.noCandidatesMessage||'当前筛选条件下暂无可用的公开视频。请调整市场、时间范围或内容形态后重试。',dataQuality,evidence,schemaVersion:DATA_QUALITY_SCHEMA_VERSION};
}

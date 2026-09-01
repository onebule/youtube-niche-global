import { calculateSignal } from './scoring.mjs';
import type { Alert, Channel, Collection, DataProvider, Idea, Opportunity, PromptTemplate, Task, Video, VideoSnapshot, WatchRule } from './types.ts';

/** Runtime registries start empty and are filled only with server-side YouTube
 * Data API responses in the current session. No sample data is shipped. */
export const channels:Channel[]=[];
const clampSignal=(value:number)=>Math.max(0,Math.min(100,Math.round(value)));

export function getOpportunity(video:Video):Opportunity {
  const latest=video.snapshots.at(-1) || {capturedAt:video.publishedAt,views:0,likes:0,comments:0,subscribers:0};
  const channel=channels.find(item=>item.id===video.channelId);
  const ageHours=Math.max(1,(new Date(latest.capturedAt||video.publishedAt).getTime()-new Date(video.publishedAt).getTime())/3600000);
  const verifiedBaseline=channel?.baselineStatus==='VERIFIED' && typeof channel.medianViews==='number' && channel.medianViews>0 ? channel.medianViews : null;
  // Shorts keeps its existing scoring path for compatibility. For Long-form
  // (and unresolved format) a single public row is not a creator baseline: we
  // expose velocity/relative context but deliberately withhold outlier,
  // growth, confidence and opportunity conclusions until history exists.
  if(video.format!=='short' && verifiedBaseline===null){
    const viewsPerHour=Math.round(latest.views/ageHours);
    const subscriberCount=typeof latest.subscribers==='number'&&latest.subscribers>0?latest.subscribers:null;
    const viewsPerSubscriber=subscriberCount===null?0:Number((latest.views/subscriberCount).toFixed(2));
    return {videoId:video.id,opportunityScore:0,velocityScore:Math.round(clampSignal(Math.log10(viewsPerHour+1)*22)),outlierScore:0,confidence:0,viewsPerHour,viewsPerSubscriber,growthRate:0,reasons:['频道历史基线不足，未生成长视频机会结论','当前仅有公开播放与发布时间，可用于后续采集对照','补齐同频道多条长视频快照后再判断异常表现']};
  }
  const medianViews=verifiedBaseline||Math.max(latest.views,1);
  const signal=calculateSignal({...latest,subscribers:channel?.subscribers||latest.subscribers||1,ageHours,sampleCount:video.snapshots.length},{medianViews});
  const reasons=[signal.viewsPerSubscriber>=1?'播放表现超过频道公开订阅规模':'当前公开数据仍需持续采集验证',signal.velocityScore>=70?'发布至今平均播放速度较高':'发布时间仍在有效观察窗口',video.format==='short'?'短视频适合验证前 3 秒钩子':'长视频适合拆解标题与结构'];
  return {videoId:video.id,...signal,reasons};
}


export const initialCollections:Collection[]=[];
export const initialIdeas:Idea[]=[];
export const initialTasks:Task[]=[];
export const initialAlerts:Alert[]=[];
export const promptTemplates:PromptTemplate[]=[];
export const watchRules:WatchRule[]=[];

/** Public discovery is served by the deployed API route. Persisted assets,
 * OAuth, and notifications need a database-backed provider for multi-device use. */
export class YouTubeDataProvider implements DataProvider {
  async searchVideos(_filters:Record<string,string>):Promise<Video[]>{ throw new Error('请通过服务端 YouTube Data API 查询公开视频。'); }
  async getChannel(_id:string):Promise<Channel | undefined>{ throw new Error('请通过服务端读取频道。'); }
  async refreshVideo(_id:string):Promise<Video | undefined>{ throw new Error('请通过服务端刷新视频。'); }
  async getSnapshots(_id:string):Promise<VideoSnapshot[]>{ throw new Error('请通过服务端读取快照。'); }
  async createWatchRule(rule:Omit<WatchRule,'id'>){ return {...rule,id:`pending-${Date.now()}`}; }
}

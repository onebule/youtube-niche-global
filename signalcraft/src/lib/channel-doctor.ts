export type DoctorStatus = 'healthy' | 'warning' | 'critical' | 'insufficient_data';

export type DoctorFinding = {
  id:string;
  severity:'high'|'medium'|'low'|'info';
  layer:string;
  title:string;
  statement:string;
  evidence:string[];
  causes:{level:'高可能'|'中可能'|'待授权确认';text:string}[];
  actions:string[];
};

export type ChannelDoctorReport = {
  mode:'public';
  channel:{id:string;title:string;handle?:string;thumbnail?:string;subscriberCount:number;videoCount:number;viewCount:number;createdAt?:string;latestPublishedAt?:string};
  summary:{healthSignalScore:number;confidence:number;status:DoctorStatus;primaryFinding:string};
  metrics:{sampleSize:number;medianViews:number;recentMedianViews?:number;previousMedianViews?:number;trendPercent?:number;volatility?:number;breakoutRate?:number;postingIntervalDays?:number;engagementRate?:number;topicConsistency?:number;normalLow?:number;normalHigh?:number};
  dimensions?:{traffic:number;recentPerformance:number;publishingStability:number;growthTrend:number;distribution:number};
  zeroView?:{scope:number;zeroViews:number;veryLowViews:number;belowNormal:number;consecutiveLow:number;status:'normal'|'watch'|'critical'};
  timeline?:{date:string;deviation:number;label:string}[];
  diagnosis?:string;
  recommendations?:{priority:'高'|'中'|'低';title:string;body:string}[];
  funnel:{key:string;label:string;status:'ok'|'watch'|'unknown';reason:string}[];
  findings:DoctorFinding[];
  topicClusters:{name:string;count:number;percent:number}[];
  videos:{id:string;title:string;publishedAt:string;views:number;likes:number;comments:number;durationSeconds:number;format:'short'|'long'|'unknown';formatConfidence?:'high'|'medium'|'low';formatSignals?:string[];thumbnail?:string;url?:string;baselineViews?:number;deviation?:number;status?:'excellent'|'normal'|'abnormal'|'critical'}[];
  dataLimitations:string[];
  oauthAvailable:boolean;
};

declare global { interface Window { YOUTUBE_ANALYZER_API_URL?:string } }

function endpoint(){
  const configured=typeof window==='undefined'?'':window.YOUTUBE_ANALYZER_API_URL;
  if(configured?.includes('/api/youtube-signals')) return configured.replace('/api/youtube-signals','/api/channel-doctor');
  const configuredDoctor=process.env.NEXT_PUBLIC_CHANNEL_DOCTOR_URL;
  return configuredDoctor&&!/youtube-niche-global-api\.vercel\.app/i.test(configuredDoctor)
    ?configuredDoctor
    :'https://youtube-niche-global-api.vercel.app/api/channel-doctor';
}

export async function diagnoseChannel(channel:string,limit=20):Promise<ChannelDoctorReport>{
  const url=new URL(endpoint());
  url.searchParams.set('channel',channel.trim());
  url.searchParams.set('limit',String(limit));
  const response=await fetch(url,{headers:{accept:'application/json'}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(payload.error||'频道公开数据暂时无法读取，请确认链接或稍后再试。');
  return payload as ChannelDoctorReport;
}

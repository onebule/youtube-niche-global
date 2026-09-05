'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { channels, getOpportunity, initialAlerts, initialCollections, initialIdeas, initialTasks, promptTemplates, watchRules } from '@/src/lib/mock';
import { parseFilters, serializeFilters } from '@/src/lib/scoring.mjs';
import type { Alert, Collection, Idea, IdeaStatus, Task, Video, WatchRule } from '@/src/lib/types';
import { searchYouTubeSignals, type PublicRankingScope } from '@/src/lib/youtube';
import { signOut, startGoogleSignIn, type AccountSession } from '@/src/lib/auth';
import { accountStorageKey, accountStorageScope } from '@/src/lib/account-storage';
import { DiscoveryProfileProvider } from './discovery-workbench';
import type { ProductionHandoff } from '@/src/lib/product-convergence';
import { useBrowserPath, useBrowserSession } from '@/src/lib/browser-session';
import { formatCompactNumber, interpolate, languageCopy, localizedCategory, localizedContentLanguage, localizedMarket, localizedTopic, type UiLocale } from '@/src/lib/ui-language';
import { hasOwnerAccess } from '@/src/lib/owner-admin';
import { getRecordedGrowth } from '@/src/lib/growth';
import { createMonitorRule, loadMonitorRules, updateMonitorRule } from '@/src/lib/monitoring';
import type { OpportunityRadarEvent } from '@/src/lib/opportunity-radar';
import type { ShortformRadarEvent } from '@/src/lib/shortform-opportunity-radar';
import { buildNicheEvaluationHref, saveNicheAnalysisContext, type RadarReturnState } from '@/src/lib/niche-analysis-context';
import UpgradeModal, { type UpgradePlan } from './upgrade-modal';
import RankingDataScope from './ranking-data-scope';

const RouteLoading = () => <main className="page"><div className="empty" aria-live="polite"><div className="empty-icon">◇</div><b>正在打开页面…</b><p>正在准备所需功能，不会重新读取或替换公开数据。</p></div></main>;
const ChannelDoctor = dynamic(() => import('./channel-doctor'), { loading: RouteLoading });
const OwnerConsole = dynamic(() => import('./owner-console'), { loading: RouteLoading });
const ImageToVideoStudio = dynamic(() => import('./image-to-video-studio'), { loading: RouteLoading });
const VideoCanvasStudio = dynamic(() => import('./video-canvas-studio'), { loading: RouteLoading });
const LongformResearchDesk = dynamic(() => import('./longform-research-desk'), { loading: RouteLoading });
const ShortformNicheEvaluation = dynamic(() => import('./shortform-niche-evaluation'), { loading: RouteLoading });
const ViralCaseDesk = dynamic(() => import('./viral-case-desk'), { loading: RouteLoading });

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'SignalCraft';
const cn = (...names:(string|false|undefined)[]) => names.filter(Boolean).join(' ');
const num = new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1});
const date = (iso:string) => new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const channelFor = (v:Video) => channels.find(c=>c.id===v.channelId) || {id:v.channelId,title:'公开频道',handle:'',subscribers:v.snapshots.at(-1)?.subscribers??null,subscriberState:v.snapshots.at(-1)?.subscribers===undefined?'UNKNOWN':'KNOWN',language:v.language,region:v.region,medianViews:null,baselineStatus:'INSUFFICIENT' as const,health:0,tags:[],owner:'未分配',lastSync:'刚刚'};
const formatSubscribers=(value:number|null,locale:UiLocale)=>value===null?(locale==='zh'?'未知':'Unknown'):formatCompactNumber(value,locale);
const scoreFor = (v:Video) => getOpportunity(v);
const formatVideoDuration=(seconds:number,locale:UiLocale)=>{const safe=Math.max(0,Math.round(Number(seconds)||0));if(safe<60)return locale==='zh'?`${safe}秒`:`${safe}s`;const minutes=Math.floor(safe/60),remaining=safe%60;if(minutes<60)return remaining?locale==='zh'?`${minutes}分${String(remaining).padStart(2,'0')}秒`:`${minutes}m ${String(remaining).padStart(2,'0')}s`:locale==='zh'?`${minutes}分`:`${minutes}m`;const hours=Math.floor(minutes/60),rest=minutes%60;return locale==='zh'?`${hours}小时${rest?`${rest}分`:''}`:`${hours}h${rest?` ${rest}m`:''}`};
const formatPublishedAge=(iso:string,locale:UiLocale)=>{const timestamp=new Date(iso).getTime();if(!Number.isFinite(timestamp))return '';const minutes=Math.max(0,Math.floor((Date.now()-timestamp)/60000));if(minutes<60)return locale==='zh'?`${minutes}分钟前`:`${minutes}m ago`;const hours=Math.floor(minutes/60);if(hours<24)return locale==='zh'?`${hours}小时前`:`${hours}h ago`;const days=Math.floor(hours/24);return locale==='zh'?`${days}天前`:`${days}d ago`};
const openOriginalVideo = (sourceUrl:string|undefined,onUnavailable:()=>void) => {
  if (!sourceUrl) { onUnavailable(); return; }
  window.open(sourceUrl, '_blank', 'noopener,noreferrer');
};
const externalVideoProps = (sourceUrl:string) => ({href:sourceUrl,target:'_blank',rel:'noopener noreferrer'});
const translatedTitle=(video:Pick<Video,'title'|'titleZh'>,locale:UiLocale)=>{
  if(locale!=='zh')return null;
  const value=typeof video.titleZh==='string'?video.titleZh.trim():'';
  return value&&value!==video.title.trim()?value:null;
};

type Toast = {message:string; kind?:'success'|'info'} | null;
type Persisted = { saved:Video[]; collections:Collection[]; ideas:Idea[]; tasks:Task[]; alerts:Alert[]; rules:WatchRule[]; tags:Record<string,string[]> };
type RankingData = {short:Video[];long:Video[];nextPageToken:string|null;loadedCount:number;dataScope:PublicRankingScope|null;emptyMessage:string|null};
const defaultState:Persisted={saved:[],collections:initialCollections,ideas:initialIdeas,tasks:initialTasks,alerts:initialAlerts,rules:watchRules,tags:{}};
const EMPTY_VIDEO_LIST:Video[]=[];
// These categories are fixed out of scope. Keep them out of both the visible
// filter and the client-side saved-data guard; the API enforces the same rule.
const categoryOptions=[['all','全部类别'],['2','汽车'],['15','宠物动物'],['19','旅行'],['22','人物生活'],['23','喜剧'],['26','生活技巧'],['27','教育'],['28','科技'],['29','公益']];
const categoryLabel=(value:string)=>categoryOptions.find(([id])=>id===value)?.[1];
const excludedTopics=new Set(['影视动画','音乐','体育','体育赛事','新闻政治','游戏','娱乐']);
const matchesContentScope=(video:Video,filters:ReturnType<typeof parseFilters>)=>!excludedTopics.has(video.topic)&&!video.tags.includes('儿童内容')&&(filters.category==='all'||video.topic===categoryLabel(filters.category));
const matchesRankingScope=(video:Video,filters:ReturnType<typeof parseFilters>)=>{
  const subscribers=channelFor(video).subscribers;
  const views=video.snapshots.at(-1)?.views||0;
  const maxSubscribers=filters.maxSubs==='all'?Number.POSITIVE_INFINITY:Number(filters.maxSubs);
  const maxViews=filters.maxViews==='all'?Number.POSITIVE_INFINITY:Number(filters.maxViews);
  return matchesContentScope(video,filters)
    && (filters.language==='all'||video.language===filters.language)
    && (subscribers===null ? (filters.minSubs==='0' && filters.maxSubs==='all') : subscribers>=Number(filters.minSubs) && subscribers<=maxSubscribers)
    && views>=Number(filters.minViews) && views<=maxViews;
};
const mergeRankingVideos=(existing:Video[],incoming:Video[])=>{
  const bySource=new Map<string,Video>();
  [...existing,...incoming].forEach(video=>bySource.set(video.sourceUrl||video.id,video));
  return [...bySource.values()];
};
const isLivePublicVideo=(value:unknown):value is Video=>{
  if(!value||typeof value!=='object')return false;
  const video=value as Partial<Video>;
  return typeof video.sourceUrl==='string'&&/youtube\.com\/(?:watch\?|shorts\/)/.test(video.sourceUrl)&&Array.isArray(video.tags)&&video.tags.includes('YouTube 公开数据');
};

function parsePersisted(raw: string | null): Persisted {
  try {
    const saved = raw ? JSON.parse(raw) : null;
    return {
      ...defaultState,
      ...saved,
      saved: Array.isArray(saved?.saved) ? saved.saved.filter(isLivePublicVideo) : [],
    };
  } catch {
    return defaultState;
  }
}

function usePersisted(account: AccountSession | null){
  const storageKey = accountStorageKey('signalcraft-workspace-v2', account);
  const [state,setState]=useState<Persisted>(defaultState);
  const [hydratedKey,setHydratedKey]=useState<string | null>(null);

  useEffect(() => {
    // Loading is keyed by the authenticated identity. Never fall back to the
    // old global workspace key, otherwise a second account could inherit the
    // first account's saved videos, ideas, alerts, or notes.
    const timer = window.setTimeout(() => {
      const next = parsePersisted(localStorage.getItem(storageKey));
      setState(next);
      setHydratedKey(storageKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    // Avoid writing the previous account's in-memory state into the new
    // namespace during the identity transition.
    if (hydratedKey !== storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, [hydratedKey, state, storageKey]);
  return [state,setState] as const;
}

function navigate(path:string){ window.history.pushState({},'',path); window.dispatchEvent(new Event('signalcraft:navigate')); window.scrollTo({top:0,behavior:'smooth'}); }
function handleInternalNavigation(event: React.MouseEvent<HTMLAnchorElement>, path: string) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path);
}
function Sparkline({video}:{video:Video}){const data=video.snapshots.map(s=>s.views);const max=Math.max(...data),min=Math.min(...data);const pts=data.map((n,i)=>`${i*33},${30-((n-min)/(max-min||1))*25}`).join(' ');return <svg className="spark" viewBox="0 0 100 34" aria-label="播放量增长曲线"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
function ScorePill({value}:{value:number}){return <span className={cn('score',value>=80?'excellent':value>=65?'good':'watch')}>{value}<small>/100</small></span>}
function Empty({title,body,action}:{title:string;body:string;action?:React.ReactNode}){return <div className="empty"><div className="empty-icon">◇</div><b>{title}</b><p>{body}</p>{action}</div>}

function Header({path,onTheme,account,onSignIn,onSignOut,locale,onLocaleChange,isOwner}:{path:string;onTheme:()=>void;account:AccountSession|null;onSignIn:()=>void;onSignOut:()=>void;locale:UiLocale;onLocaleChange:(locale:UiLocale)=>void;isOwner:boolean}){
  const isApp=path.startsWith('/app');
  const copy=languageCopy[locale];
  // The audited product surfaces are explicit here. Legacy routes remain
  // reachable (for example /discover and /longform) but are no longer mixed
  // into the primary navigation vocabulary.
  const primary=copy.primaryNav;
  const publicItems=[[ '/', primary.home ],['/rankings',primary.rankings],['/radar',primary.radar],['/longform',primary.research],['/doctor',primary.doctor],['/app/watchlists',primary.monitor],['/app',primary.studio]];
  const appItems=[['/app',copy.studioNav[0]],['/app/research',copy.studioNav[1]],['/app/ideas',copy.studioNav[2]]];
  const items=isApp?appItems:publicItems;
  return <><header className="site-header"><Link className="brand" href="/" onClick={event=>handleInternalNavigation(event,'/')} aria-label={copy.backHome}><span className="brand-glyph">SC</span><span>{BRAND}<small>CONTENT INTELLIGENCE</small></span></Link><nav className="site-nav" aria-label={locale==='zh'?'主导航':'Main navigation'}>{items.map(([href,label])=><a href={href} key={href} className={path===href?'active':''} aria-current={path===href?'page':undefined} onClick={event=>handleInternalNavigation(event,href)}>{label}</a>)}</nav><div className="head-actions"><div className="locale-toggle" role="group" aria-label={copy.interfaceLanguage}><button type="button" className={locale==='zh'?'active':''} aria-pressed={locale==='zh'} onClick={()=>onLocaleChange('zh')}>中文</button><button type="button" className={locale==='en'?'active':''} aria-pressed={locale==='en'} onClick={()=>onLocaleChange('en')}>EN</button></div><button className="icon-btn" onClick={onTheme} aria-label={copy.theme}>◐</button><button className="ghost" onClick={()=>navigate(isApp?'/discover':'/app')}>{isApp?copy.publicDiscovery:copy.enterStudio}</button><button className="ghost header-pricing" onClick={()=>navigate('/pricing')}>{primary.pricing}</button>{isOwner&&<button className="owner-link" onClick={()=>navigate('/owner')}>{locale==='zh'?'站点管理':'Site admin'}</button>}{account?<button className="account-chip" onClick={onSignOut} title={copy.signOut}><span>●</span>{account.email}</button>:<button className="google-login" onClick={onSignIn} title={copy.signInTitle}><span>G</span>{copy.signIn}</button>}</div></header>{isApp&&<StudioNav path={path} locale={locale}/>}</>
}
function StudioNav({path,locale}:{path:string;locale:UiLocale}){const copy=languageCopy[locale];const primary=copy.primaryNav;const groups=[
  {label:locale==='zh'?'研究':'RESEARCH',items:[['/app',locale==='zh'?'概览':'Overview'],['/app/research',copy.studioNav[1]],['/app/library/channels',locale==='zh'?'竞品频道':'Competitor channels'],['/app/library/videos',locale==='zh'?'研究资料':'Research library'],['/app/thumbnails',locale==='zh'?'缩略图研究':'Thumbnail research'],['/app/benchmarks',locale==='zh'?'竞品对标':'Benchmarking']]},
  {label:locale==='zh'?'诊断与监控':'DIAGNOSE & MONITOR',items:[['/app/doctor',primary.doctor],['/app/watchlists',primary.monitor]]},
  {label:locale==='zh'?'创作':'CREATE',items:[['/app/cases',locale==='zh'?'视频拆解':'Video breakdown'],['/app/ideas',locale==='zh'?'选题':'Ideas'],['/app/canvas',locale==='zh'?'画布':'Canvas'],['/app/image-to-video',locale==='zh'?'图生视频':'Image-to-video'],['/app/prompts',locale==='zh'?'提示词与版本':'Prompts & versions']]},
  {label:locale==='zh'?'系统':'SYSTEM',items:[['/app/settings',locale==='zh'?'配置':'Settings']]},
];return <aside className="studio-nav" aria-label={locale==='zh'?'工作室导航':'Studio navigation'}>{groups.map(group=><section className="studio-nav-group" key={group.label}><p>{group.label}</p>{group.items.map(([href,label])=><a href={href} key={href} className={cn(path===href&&'active')} aria-current={path===href?'page':undefined} onClick={event=>handleInternalNavigation(event,href)}>{label}</a>)}</section>)}</aside>}

function Filters({filters,setFilters,hideKeyword=false}:{filters:ReturnType<typeof parseFilters>;setFilters:(v:ReturnType<typeof parseFilters>)=>void;hideKeyword?:boolean}){const patch=(key:string,value:string)=>{const next={...filters,[key]:value};setFilters(next);const q=serializeFilters(next);window.history.replaceState({},'',`${location.pathname}${q?`?${q}`:''}`)};return <div className="filters" aria-label="筛选器">{!hideKeyword&&<label>关键词<input value={filters.q} onChange={e=>patch('q',e.target.value)} placeholder="如：AI productivity"/></label>}<label>发布时间范围<select value={filters.window} onChange={e=>patch('window',e.target.value)}><option value="24h">近 24 小时</option><option value="7d">近 7 天</option><option value="28d">近 28 天</option><option value="90d">近 3 个月</option><option value="180d">近 6 个月</option><option value="365d">近 1 年</option></select></label><label>市场<select value={filters.region} onChange={e=>patch('region',e.target.value)}><option value="US">美国</option><option value="GB">英国</option><option value="JP">日本</option><option value="BR">巴西</option><option value="MX">墨西哥</option><option value="IN">印度</option><option value="ID">印度尼西亚</option></select></label><label>类别<select value={filters.category} onChange={e=>patch('category',e.target.value)}>{categoryOptions.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>语言<select value={filters.language} onChange={e=>patch('language',e.target.value)}><option value="all">全部语言</option><option value="英语">英语</option><option value="西班牙语">西班牙语</option><option value="葡萄牙语">葡萄牙语</option></select></label><label>形态<select value={filters.format} onChange={e=>patch('format',e.target.value)}><option value="all">短+长视频</option><option value="short">短视频</option><option value="long">长视频</option></select></label><label>订阅上限<select value={filters.maxSubs} onChange={e=>patch('maxSubs',e.target.value)}><option value="100000">10 万</option><option value="50000">5 万</option><option value="all">不限</option></select></label><label>最低评分<select value={filters.minScore} onChange={e=>patch('minScore',e.target.value)}><option value="70">70+</option><option value="80">80+</option><option value="0">不限</option></select></label></div>}

function RankingOptionGroup({label,options,value,onChange}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}){
  return <section className="ranking-filter-group"><b>{label}</b><div className="ranking-choice-row">{options.map(option=><button type="button" key={option.value} className={value===option.value?'active':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}</div></section>
}

function RankingBandGroup({label,options,value,onChange}:{label:string;options:{value:string;label:string}[];value:string;onChange:(value:string)=>void}){
  return <section className="ranking-filter-group"><b>{label}</b><div className="ranking-band-track">{options.map(option=><button type="button" key={option.value} className={value===option.value?'active':''} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}><i/><span>{option.label}</span></button>)}</div></section>
}

function RankingFilters({filters,setFilters,locale}:{filters:ReturnType<typeof parseFilters>;setFilters:(v:ReturnType<typeof parseFilters>)=>void;locale:UiLocale}){
  const patch=(changes:Partial<ReturnType<typeof parseFilters>>)=>{const next={...filters,...changes};setFilters(next);const query=serializeFilters({...next,q:''});window.history.replaceState({},'',`${location.pathname}${query?`?${query}`:''}`)};
  const zh=locale==='zh';
  const copy=languageCopy[locale].ranking;
  const subscriberBands=[
    {value:'all',label:zh?'全部':'All'}, {value:'0-100000',label:zh?'0–10万':'0–100K'}, {value:'100000-1000000',label:zh?'10–100万':'100K–1M'},
    {value:'1000000-10000000',label:zh?'100–1000万':'1M–10M'}, {value:'10000000-all',label:zh?'1000万+':'10M+'},
  ];
  const viewBands=[
    {value:'all',label:zh?'全部':'All'}, {value:'0-1000000',label:zh?'0–100万':'0–1M'}, {value:'1000000-10000000',label:zh?'100–1000万':'1M–10M'},
    {value:'10000000-50000000',label:zh?'1000–5000万':'10M–50M'}, {value:'50000000-100000000',label:zh?'5000万–1亿':'50M–100M'}, {value:'100000000-all',label:zh?'1亿+':'100M+'},
  ];
  const currentSubscriberBand=filters.minSubs==='0'&&filters.maxSubs==='all'?'all':`${filters.minSubs}-${filters.maxSubs}`;
  const currentViewBand=filters.minViews==='0'&&filters.maxViews==='all'?'all':`${filters.minViews}-${filters.maxViews}`;
  const setBand=(band:string,kind:'subscribers'|'views')=>{const [min,max]=band==='all'?['0','all']:band.split('-');patch(kind==='subscribers'?{minSubs:min,maxSubs:max}:{minViews:min,maxViews:max});};
  const reset=()=>patch({format:'short',entity:'videos',window:'28d',minSubs:'0',maxSubs:'all',minViews:'0',maxViews:'all',display:'list',category:'all',language:'all'});
  return <aside className="ranking-filters ranking-rules" aria-label={copy.filterAria}>
    <div><span className="eyebrow">{zh?'筛选':'Filters'}</span><h2>{zh?'按条件筛选':'Filter the ranking'}</h2></div>
    <RankingOptionGroup label={zh?'内容形态':'Content format'} value={filters.format==='long'?'long':'short'} onChange={value=>patch({format:value})} options={[{value:'short',label:zh?'短视频':'Short-form'},{value:'long',label:zh?'长视频':'Long-form'}]}/>
    <RankingOptionGroup label={zh?'榜单维度':'Ranking entity'} value={filters.entity} onChange={value=>patch({entity:value})} options={[{value:'videos',label:zh?'视频':'Videos'},{value:'channels',label:zh?'频道':'Channels'}]}/>
    <RankingOptionGroup label={zh?'时间窗口':'Time window'} value={filters.window} onChange={value=>patch({window:value})} options={[{value:'24h',label:zh?'24小时':'24h'},{value:'7d',label:zh?'7天':'7d'},{value:'28d',label:zh?'28天':'28d'},{value:'365d',label:zh?'历史数据':'History'}]}/>
    <RankingBandGroup label={zh?'订阅量区间':'Subscriber range'} value={currentSubscriberBand} onChange={value=>setBand(value,'subscribers')} options={subscriberBands}/>
    <RankingBandGroup label={zh?'播放量区间 · 当前总播放':'View range · current total'} value={currentViewBand} onChange={value=>setBand(value,'views')} options={viewBands}/>
    <RankingOptionGroup label={zh?'展示方式':'Display'} value={filters.display} onChange={value=>patch({display:value})} options={[{value:'list',label:zh?'列表':'List'},{value:'cards',label:zh?'卡片':'Cards'}]}/>
    <details className="ranking-advanced"><summary>{zh?'高级范围':'Advanced scope'}</summary><label>{copy.market}<select value={filters.region} onChange={event=>patch({region:event.target.value})}><option value="all">{localizedMarket('all',locale)}</option>{['US','GB','JP','BR','MX','IN','ID'].map(value=><option key={value} value={value}>{localizedMarket(value,locale)}</option>)}</select></label><label>{copy.category}<select value={filters.category} onChange={event=>patch({category:event.target.value})}>{categoryOptions.map(([value])=><option key={value} value={value}>{localizedCategory(value,locale)}</option>)}</select></label><label>{copy.contentLanguage}<select value={filters.language} onChange={event=>patch({language:event.target.value})}>{['all','英语','西班牙语','葡萄牙语'].map(value=><option key={value} value={value}>{localizedContentLanguage(value,locale)}</option>)}</select></label></details>
    <button type="button" className="ranking-reset" onClick={reset}>{zh?'重置':'Reset'}</button><small>{copy.boundary}</small>
  </aside>
}

function VideoCard({video,state,setState,onDetail,locale}:{video:Video;state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;onDetail:(v:Video)=>void;locale:UiLocale}){
  const o=scoreFor(video),channel=channelFor(video),saved=state.saved.some(item=>item.id===video.id);
  const titleZh=translatedTitle(video,locale);
  const portrait=video.aspectRatio==='9:16'||video.aspectRatio==='1:1';
  const [loadedImage,setLoadedImage]=useState<string|null>(null);
  const [failedImage,setFailedImage]=useState<string|null>(null);
  const imageState: 'loading'|'ready'|'missing' = !video.thumbnail ? 'missing' : failedImage===video.thumbnail ? 'missing' : loadedImage===video.thumbnail ? 'ready' : 'loading';
  const toggle=()=>setState(s=>({...s,saved:s.saved.some(item=>item.id===video.id)?s.saved.filter(item=>item.id!==video.id):[...s.saved,video]}));
  const watch=()=>openOriginalVideo(video.sourceUrl,()=>onDetail(video));
  const duration=video.durationSeconds<60?`${video.durationSeconds} 秒`:`${Math.round(video.durationSeconds/60)} 分钟`;
  return <article className="video-card">
      <button type="button" className={cn('thumb',portrait&&'thumb-portrait',imageState==='missing'&&'thumb-no-image')} onClick={watch} title="打开并观看此视频" aria-label={`打开视频：${video.title}`}>
      {video.thumbnail&&<img className={cn('video-card-image',imageState==='missing'&&'is-hidden')} src={video.thumbnail} alt={`${video.title} 视频缩略图`} width={480} height={270} loading="lazy" decoding="async" onLoad={()=>setLoadedImage(video.thumbnail||null)} onError={()=>setFailedImage(video.thumbnail||null)}/>}
      <div aria-hidden={imageState==='ready'?'true':undefined} className={cn('thumb-fallback',imageState==='ready'&&'is-hidden')}><b>▶</b><span>{video.topic}</span>{imageState==='missing'&&<small>无公开缩略图</small>}</div>
      <span className="video-format" style={{position:'relative',zIndex:3}}>{video.format==='short'?'短视频':video.format==='long'?'长视频':'待复核'} · {duration}</span><span style={{position:'relative',zIndex:3}}><ScorePill value={o.opportunityScore}/></span>
      </button>
    <div className="card-body"><div className="eyebrow">{video.topic} · {video.language} / {video.region}</div><button className="video-title" onClick={watch}><span>{video.title}</span>{titleZh&&<small className="title-translation">中文：{titleZh}</small>}</button><p className="channel-line">{channel.title} · {formatSubscribers(channel.subscribers,'zh')} 订阅</p>
      <div className="metric-row"><b>{num.format(video.snapshots.at(-1)!.views)}<small>播放</small></b><b className="up">{num.format(o.viewsPerHour)}<small>平均播放 / 小时</small></b><Sparkline video={video}/></div>
    <div className="evidence-strip"><span>公开数据</span><span>单次快照</span><b>{o.viewsPerSubscriber===null?'未知':`${o.viewsPerSubscriber}×`} 播放 / 订阅</b></div>
      <div className="card-actions"><button onClick={toggle} aria-pressed={saved}>{saved?'已收藏':'收藏研究'}</button><button onClick={()=>onDetail(video)}>查看证据</button>{video.sourceUrl&&<button onClick={watch}>原视频 ↗</button>}</div>
    </div>
  </article>
}

const classificationReasonLabels:Record<string,string>={SHORT_DURATION:'时长偏短',LONG_DURATION:'时长偏长',SINGLE_UNIT_STRUCTURE:'单一内容单元',MULTI_SECTION_STRUCTURE:'多章节或多段结构',SHALLOW_NARRATIVE:'叙事展开较浅',DEEP_NARRATIVE:'叙事展开较深',QUICK_CONSUMPTION:'适合快速消费',CONTEXT_DEPENDENT_CONSUMPTION:'依赖连续观看和上下文',VERTICAL_FORMAT:'真实画幅偏竖屏',SQUARE_FORMAT:'真实画幅为方形',LANDSCAPE_FORMAT:'真实画幅偏横屏',PLATFORM_SHORTS:'YouTube Shorts 路线已确认',PLATFORM_VIDEO:'普通 Video 路线已确认',EVIDENCE_CONFLICT:'证据之间存在冲突',INSUFFICIENT_EVIDENCE:'当前证据不足'};

function DetailDrawer({video,state,setState,onClose,toast,locale}:{video:Video;state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;onClose:()=>void;toast:(t:string)=>void;locale:UiLocale}){const o=scoreFor(video),channel=channelFor(video),titleZh=translatedTitle(video,locale);const addIdea=()=>{const exists=state.ideas.some(i=>i.sourceVideoId===video.id);if(!exists)setState(s=>({...s,ideas:[...s.ideas,{id:`i${Date.now()}`,title:`拆解：${video.title.slice(0,24)}`,sourceVideoId:video.id,angle:'从异常表现中提取可验证的钩子',audience:'目标赛道的内容消费者',hypothesis:'明确收益 + 具体数字会提升点击',owner:'当前用户',status:'收集',note:'来自 SignalCraft 证据链',createdAt:new Date().toISOString()}]}));toast(exists?'该视频已有选题卡':'已创建选题卡，来源证据已带入');};const addBenchmark=()=>{setState(s=>{const first=s.collections[0];return {...s,collections:first?s.collections.map((c,i)=>i===0?{...c,items:[...new Set([...c.items,video.id])]}:c):[{id:`c${Date.now()}`,name:'未命名对标组',type:'对标组',color:'#ff3b30',items:[video.id],shared:false}]}});toast('已加入对标组');};const openDoctor=()=>{if(!channel.url){toast('该视频没有可用的公开频道链接，暂不能自动诊断。');return}navigate(`/doctor?channel=${encodeURIComponent(channel.url)}`)};const formatText=video.format==='short'?'短视频':video.format==='long'?'长视频':'待复核';const confidenceText=video.formatConfidence==='high'?'高':video.formatConfidence==='medium'?'中':'低';const platformText=video.platformType==='SHORTS'?'原生 Shorts':video.platformType==='VIDEO'?'普通 Video':'未知';const contentText=video.contentType==='SHORT_FORM'?'短内容':video.contentType==='LONG_FORM'?'长内容':formatText;const analysisText=video.analysisClass==='NATIVE_SHORTS'?'原生 Shorts':video.analysisClass==='SHORT_FORM_VIDEO'?'普通 Video 短内容':video.analysisClass==='LONG_FORM_VIDEO'?'真正长视频':video.analysisClass==='PLATFORM_CONTENT_CONFLICT'?'平台与内容冲突':'待确认';return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="drawer" role="dialog" aria-modal="true" aria-label="视频证据详情" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={onClose}>×</button><div className="eyebrow">证据链 · {video.topic}</div><h2>{video.title}</h2>{titleZh&&<p className="drawer-title-translation">中文：{titleZh}</p>}<p className="channel-line">{channel.title} · 发布 {date(video.publishedAt)} · {video.risk==='low'?'低风险':'需复核风险'}</p><div className="score-hero"><ScorePill value={o.opportunityScore}/><div><b>机会评分</b><p>不是 AI 真相，而是基于公开数据的可复算信号。</p></div></div><div className="explain-grid"><div><span>VelocityScore</span><b>{o.velocityScore}</b><small>发布至今的平均播放速度</small></div><div><span>RelativeSignal</span><b>{o.outlierScore}</b><small>播放 / 订阅代理，不等同历史 outlier</small></div><div><span>Confidence</span><b>{o.confidence}%</b><small>{video.snapshots.length} 个时间点</small></div><div><span>相对表现</span><b>{o.viewsPerSubscriber}×</b><small>播放 / 频道订阅</small></div></div>{(video.formatSignals?.length||video.contentType)&&<section className="evidence"><h3>内容形态判定</h3><p>平台分发：{platformText}；真实内容：{contentText}；分析类别：{analysisText}。</p><p>当前为{formatText}，置信度为{video.formatConfidenceScore??'—'} 分（{confidenceText}）{video.formatSource?`，证据来源：${video.formatSource}`:''}。</p>{video.aspectRatio&&<p>✓ 真实画幅：{video.aspectRatio}</p>}{video.classificationReason?.map(reason=><p key={reason}>✓ {classificationReasonLabels[reason]||reason}</p>)}{video.missingEvidence?.length&&<p>待补证据：{video.missingEvidence.join('、')}</p>}{video.needsSecondaryAnalysis&&<p>⚠ 当前证据不足，建议二级分析后再用于严肃比较。</p>}{video.formatSignals?.map(signal=><p key={signal}>✓ {signal}</p>)}</section>}<section className="evidence"><h3>为什么值得看</h3>{o.reasons.map(r=><p key={r}>✓ {r}</p>)}<p>✓ 当前快照的平均播放速度为 {num.format(o.viewsPerHour)} / 小时；需要同频道的多条历史视频后，才会给出真实历史 outlier 结论。</p></section><section className="evidence"><h3>相似视频</h3><p>需要持续采集公开视频数据后，才会给出相似表现判断。</p></section><div className="drawer-actions"><button className="primary" onClick={addIdea}>创建选题</button><button onClick={addBenchmark}>加入对标组</button><button onClick={openDoctor}>频道诊断</button><button onClick={()=>navigate('/app/watchlists')}>设置监听</button><button onClick={()=>navigator.clipboard?.writeText(video.sourceUrl||`https://youtube.com/watch?v=${video.id}`).then(()=>toast('链接已复制'))}>复制链接</button></div></aside></div>}

function RankingBoard({longRows,shortRows,selectedFormat,filters,onDetail,savedVideoIds,savedChannelIds,onAddToStudio,locale,loadedCount,canLoadMore,loadingMore,onLoadMore,emptyMessage}:{longRows:Video[];shortRows:Video[];selectedFormat:'short'|'long';filters:ReturnType<typeof parseFilters>;onDetail:(v:Video)=>void;savedVideoIds:ReadonlySet<string>;savedChannelIds:ReadonlySet<string>;onAddToStudio:(video:Video,kind:'video'|'channel')=>void;locale:UiLocale;loadedCount:number;canLoadMore:boolean;loadingMore:boolean;onLoadMore:()=>void;emptyMessage:string|null}){
  const view=filters.entity==='channels'?'channels':'videos';
  const [rankBy,setRankBy]=useState<'views'|'relative'|'growth'>('views');
  const copy=languageCopy[locale].ranking;
  const scopedRows=useMemo(()=>[...longRows,...shortRows]
    .filter((video,index,all)=>all.findIndex(item=>item.sourceUrl===video.sourceUrl)===index)
    .filter(video=>video.format===selectedFormat)
    .filter(video=>matchesRankingScope(video,filters)),[longRows,shortRows,selectedFormat,filters]);
  const hasComparableGrowth=useMemo(()=>scopedRows.some(video=>Boolean(getRecordedGrowth(video))),[scopedRows]);
  const activeRankBy=rankBy==='growth'&&!hasComparableGrowth?'views':rankBy;
  const videos=useMemo(()=>[...scopedRows].sort((a,b)=>{
    if(activeRankBy==='views')return b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views;
    if(activeRankBy==='relative')return (scoreFor(b).viewsPerSubscriber??-1)-(scoreFor(a).viewsPerSubscriber??-1);
    return (getRecordedGrowth(b)?.viewsPerHour||-1)-(getRecordedGrowth(a)?.viewsPerHour||-1)
      || b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views;
  }),[scopedRows,activeRankBy]);
  const channelRows=useMemo(()=>Object.values(videos.filter(video=>{const channel=channelFor(video);return Boolean(channel.id&&channel.title);}).reduce<Record<string,{channel:ReturnType<typeof channelFor>;videos:Video[];views:number}>>((acc,video)=>{const channel=channelFor(video);const item=acc[channel.id]||{channel,videos:[],views:0};item.videos.push(video);item.views+=video.snapshots.at(-1)!.views;acc[channel.id]=item;return acc},{})).sort((a,b)=>b.views-a.views),[videos]);
  const rankingTitle=activeRankBy==='views'?copy.videoTop:activeRankBy==='relative'?copy.relativeTop:copy.growthTop;
  const rankingBody=activeRankBy==='views'?copy.videoTopBody:activeRankBy==='relative'?copy.relativeTopBody:copy.growthTopBody;
  const rankingBoundary=activeRankBy==='views'?copy.absoluteBoundary:activeRankBy==='relative'?copy.relativeBoundary:copy.growthBoundary;
  const renderVideos=()=>videos.length?videos.map((video,index)=>{const score=scoreFor(video),channel=channelFor(video),snapshot=video.snapshots.at(-1)!,saved=savedVideoIds.has(video.id),portrait=video.aspectRatio==='9:16'||video.aspectRatio==='1:1',sourceProps=externalVideoProps(video.sourceUrl!),titleZh=translatedTitle(video,locale);return <div className="ranking-row ranking-video-row" data-format={video.format} key={video.id}><span className={cn('ranking-position',index<3&&'top')}>{String(index+1).padStart(2,'0')}</span><a className={cn('ranking-thumb',portrait&&'is-portrait')} {...sourceProps} title={locale==='zh'?'在新标签页打开此视频':'Open this video in a new tab'}>{video.thumbnail&&<img src={video.thumbnail} alt="" width={160} height={90} loading="lazy" decoding="async"/>}<em>{video.format==='short'?(locale==='zh'?'短':'Short'):(locale==='zh'?'长':'Long')}</em></a><a className="ranking-title" {...sourceProps}><b title={titleZh?`${video.title} · ${titleZh}`:video.title}><span>{video.title}</span>{titleZh&&<small className="title-translation">中文：{titleZh}</small>}</b><span className="ranking-channel">{channel.thumbnail&&<img src={channel.thumbnail} alt="" width={24} height={24} loading="lazy" decoding="async"/>}<span><strong>{channel.title}</strong><small>{localizedTopic(video.topic,locale)} · {formatSubscribers(channel.subscribers,locale)} {locale==='zh'?'订阅':'subs'}</small></span></span></a><span className="ranking-stat ranking-stat-views"><b>{formatCompactNumber(snapshot.views,locale)}</b><small>{copy.views}</small></span><span className="ranking-stat ranking-stat-duration"><b>{formatVideoDuration(video.durationSeconds,locale)}</b><small>{formatPublishedAge(video.publishedAt,locale)}</small></span><span className="ranking-stat velocity"><b>{score.viewsPerSubscriber===null?'—':`${score.viewsPerSubscriber}×`}</b><small>{copy.viewsPerSubscriber}</small></span><button type="button" className={cn('ranking-studio-action',saved&&'saved')} aria-label={saved?(locale==='zh'?`打开工作室中的视频：${video.title}`:`Open saved video in Studio: ${video.title}`):(locale==='zh'?`将视频加入工作室：${video.title}`:`Add to Studio: ${video.title}`)} onClick={()=>onAddToStudio(video,'video')}>{saved?(locale==='zh'?'已加入 · 打开':'Added · Open'):(locale==='zh'?'加入工作室':'Add to Studio')}</button></div>}):<div className="ranking-empty">{emptyMessage||copy.noVideos}</div>;
  const renderCards=()=>videos.length?<div className="ranking-card-grid">{videos.map((video,index)=>{const channel=channelFor(video),snapshot=video.snapshots.at(-1)!,score=scoreFor(video),saved=savedVideoIds.has(video.id),portrait=video.aspectRatio==='9:16'||video.aspectRatio==='1:1',sourceProps=externalVideoProps(video.sourceUrl!),titleZh=translatedTitle(video,locale);return <article className="ranking-video-card" data-format={video.format} key={video.id}><a className={cn('ranking-card-image',portrait&&'is-portrait')} {...sourceProps} title={locale==='zh'?'在新标签页打开此视频':'Open this video in a new tab'}>{video.thumbnail&&<img src={video.thumbnail} alt="" width={480} height={270} loading={index<3?'eager':'lazy'} fetchPriority={index<3?'high':'auto'} decoding="async"/>}<b>#{index+1}</b><em>{video.format==='short'?(locale==='zh'?'短':'Short'):(locale==='zh'?'长':'Long')}</em></a><span><a className="ranking-card-title" {...sourceProps}><strong><span>{video.title}</span>{titleZh&&<small className="title-translation">中文：{titleZh}</small>}</strong><span className="ranking-card-channel">{channel.thumbnail&&<img src={channel.thumbnail} alt="" width={24} height={24} loading="lazy" decoding="async"/>}<small>{channel.title} · {localizedTopic(video.topic,locale)}</small></span></a><div className="ranking-card-metrics"><b>{formatCompactNumber(snapshot.views,locale)} <i>{copy.views}</i></b><b>{formatVideoDuration(video.durationSeconds,locale)} <i>{formatPublishedAge(video.publishedAt,locale)}</i></b><b className="ranking-card-score">{score.opportunityScore}<i>{locale==='zh'?'机会分':'score'}</i></b></div><button type="button" className={cn('ranking-card-studio',saved&&'saved')} onClick={()=>onAddToStudio(video,'video')}>{saved?(locale==='zh'?'已加入 · 打开':'Added · Open'):(locale==='zh'?'加入工作室':'Add to Studio')}</button></span></article>})}</div>:<div className="ranking-empty">{emptyMessage||copy.noVideos}</div>;
  const renderChannels=()=>channelRows.length?channelRows.map((item,index)=>{const video=item.videos[0],saved=savedChannelIds.has(item.channel.id),sourceProps=externalVideoProps(item.channel.url!);return <div className="ranking-row channel-ranking-row" key={item.channel.id}><span className={cn('ranking-position',index<3&&'top')}>{String(index+1).padStart(2,'0')}</span><a className="channel-rank-avatar" {...sourceProps} title={interpolate(copy.channelTitle,{channel:item.channel.title})}>{item.channel.thumbnail&&<img src={item.channel.thumbnail} alt={locale==='zh'?item.channel.title+' 的 YouTube 频道头像':item.channel.title+' YouTube channel avatar'} width={64} height={64} loading={index<3?'eager':'lazy'} fetchPriority={index<3?'high':'auto'} decoding="async"/>}</a><a className="ranking-title" {...sourceProps}><b>{item.channel.title}</b><small>{interpolate(copy.channelSamples,{count:item.videos.length,subs:formatSubscribers(item.channel.subscribers,locale)})}</small></a><span className="ranking-stat"><b>{formatCompactNumber(item.views,locale)}</b><small>{copy.accumulatedViews}</small></span><span className="ranking-stat velocity"><b>{formatCompactNumber(Math.round(item.views/item.videos.length),locale)}</b><small>{copy.averageViews}</small></span><span className="channel-sample-count">{item.videos.length} {copy.samples}</span><button type="button" className={cn('ranking-studio-action',saved&&'saved')} aria-label={saved?(locale==='zh'?`打开工作室中的频道：${item.channel.title}`:`Open saved channel in Studio: ${item.channel.title}`):(locale==='zh'?`将频道加入工作室：${item.channel.title}`:`Add channel to Studio: ${item.channel.title}`)} onClick={()=>onAddToStudio(video,'channel')}>{saved?(locale==='zh'?'已加入 · 打开':'Added · Open'):(locale==='zh'?'加入工作室':'Add to Studio')}</button></div>}):<div className="ranking-empty">{emptyMessage||copy.noChannels}</div>;
  return <section className="ranking-section top-100"><div className="ranking-section-head"><div><span className="eyebrow">{copy.corpus}</span><h2>{view==='videos'?rankingTitle:copy.channelTop}</h2><p>{view==='videos'?rankingBody:copy.channelTopBody}</p></div><b>{view==='videos'?videos.length:channelRows.length}<small>/{loadedCount}</small></b></div>{view==='videos'&&<div className="ranking-lens" aria-label={copy.rankMethod}><span>{copy.lens}</span><button type="button" className={activeRankBy==='views'?'active':''} aria-pressed={activeRankBy==='views'} onClick={()=>setRankBy('views')}>{copy.absolute}</button><button type="button" className={activeRankBy==='relative'?'active':''} aria-pressed={activeRankBy==='relative'} onClick={()=>setRankBy('relative')}>{copy.relative}</button><button type="button" className={activeRankBy==='growth'?'active':''} aria-pressed={activeRankBy==='growth'} disabled={!hasComparableGrowth} title={!hasComparableGrowth?copy.growthUnavailable:undefined} onClick={()=>setRankBy('growth')}>{copy.growth}</button><small>{rankingBoundary}</small></div>}<div className={filters.display==='cards'?'ranking-card-wrap':'ranking-list'}>{view==='videos'?(filters.display==='cards'?renderCards():renderVideos()):renderChannels()}</div><div className="ranking-load-more"><span>{locale==='zh'?`已加载 ${loadedCount} 条真实公开视频`:`${loadedCount} live public videos loaded`}</span>{canLoadMore?<button onClick={onLoadMore} disabled={loadingMore}>{loadingMore?(locale==='zh'?'正在加载下一页…':'Loading next page…'):(locale==='zh'?'加载更多':'Load more')}</button>:<small>{locale==='zh'?'当前筛选范围已无更多公开结果':'No more public results for this scope'}</small>}</div></section>
}

function Discovery({mode,state,setState,openDetail,locale}:{mode:'discover'|'rankings'|'radar'|'research';state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){
  const [filters,setFilters]=useState(()=>{const hasQuery=typeof window!=='undefined'&&Boolean(location.search);const hasMarketFilter=typeof window!=='undefined'&&new URLSearchParams(location.search).has('region');const selected=typeof window==='undefined'?parseFilters(''):parseFilters(location.search);if(mode==='rankings')return {...selected,q:'',format:hasQuery&&selected.format==='long'?'long':'short',window:hasQuery?selected.window:'28d',region:hasMarketFilter?selected.region:'all',maxSubs:hasQuery?selected.maxSubs:'all',minSubs:hasQuery?selected.minSubs:'0',minViews:hasQuery?selected.minViews:'0',maxViews:hasQuery?selected.maxViews:'all',entity:hasQuery?selected.entity:'videos',display:hasQuery?selected.display:'list',minScore:'0'};if(mode==='discover'||mode==='radar')return {...selected,q:''};return selected});
  const [page,setPage]=useState(1);
  const [remote,setRemote]=useState<Video[]|null>(null);
  const [rankingData,setRankingData]=useState<RankingData|null>(null);
  const [loading,setLoading]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [radarView,setRadarView]=useState<'velocity'|'new'|'breakout'|'repeatable'>('velocity');
  const savedVideoIds=useMemo(()=>new Set(state.saved.map(video=>video.id)),[state.saved]);
  const savedChannelIds=useMemo(()=>new Set(state.saved.map(video=>video.channelId)),[state.saved]);
  const addToStudio=useCallback((video:Video,kind:'video'|'channel')=>{
    const saved=kind==='channel'?savedChannelIds.has(video.channelId):savedVideoIds.has(video.id);
    if(saved){navigate(kind==='channel'?'/app/library/channels':'/app/library/videos');return;}
    setState(current=>{
      const exists=kind==='channel'?current.saved.some(item=>item.channelId===video.channelId):current.saved.some(item=>item.id===video.id);
      return exists?current:{...current,saved:[...current.saved,video]};
    });
  },[savedChannelIds,savedVideoIds,setState]);
  // Discover and Radar are real-data surfaces. Never silently replace a
  // failed API response with attractive demo cards, otherwise users cannot
  // tell that the current YouTube quota has no usable samples.
  const source=remote??EMPTY_VIDEO_LIST;
  const runSearch=useCallback(async()=>{
    if(mode==='research'&&!filters.q.trim()){setRemote(null);setError('请输入一个赛道关键词，例如 AI productivity。');return;}
    setLoading(true);setError('');
    try{
      const selectedFormat=filters.format==='short'||filters.format==='long'?filters.format:undefined;
      const result=await searchYouTubeSignals({query:mode==='research'?filters.q:'',language:filters.language,locale,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,ranking:mode!=='research'});
      result.channels.forEach(channel=>{const index=channels.findIndex(item=>item.id===channel.id);if(index>=0)Object.assign(channels[index],channel);else channels.push(channel)});
      setRemote(result.videos);setPage(1);
    }catch(reason){setError(reason instanceof Error?reason.message:'YouTube 公开数据暂时无法读取。');}
    finally{setLoading(false);}
  },[mode,locale,filters.q,filters.language,filters.region,filters.window,filters.maxSubs,filters.minViews,filters.format,filters.category]);
  const runRankingSearch=useCallback(async(forceRefresh=false)=>{
    setLoading(true);setError('');
    try{
      const selectedFormat=filters.format==='long'?'long':'short';
      const result=await searchYouTubeSignals({query:'',language:filters.language,locale,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,entity:filters.entity==='channels'?'channels':'videos',ranking:true,refresh:forceRefresh,limit:100});
      const fetched=mergeRankingVideos([],result.videos);
      result.channels.forEach(channel=>{const index=channels.findIndex(item=>item.id===channel.id);if(index>=0)Object.assign(channels[index],channel);else channels.push(channel)});
      setRankingData({short:fetched.filter(video=>video.format==='short'),long:fetched.filter(video=>video.format==='long'),nextPageToken:result.nextPageToken,loadedCount:fetched.length,dataScope:result.dataScope,emptyMessage:result.noCandidatesMessage});setRemote(null);setPage(1);
    }catch(reason){setRankingData(null);setError(reason instanceof Error?reason.message:'YouTube 公开数据暂时无法读取。');}
    finally{setLoading(false);}
  },[locale,filters.language,filters.region,filters.window,filters.maxSubs,filters.minViews,filters.format,filters.category,filters.entity]);
  const loadMoreRanking=async()=>{
    const pageToken=rankingData?.nextPageToken;
    if(!pageToken||loadingMore)return;
    setLoadingMore(true);setError('');
    try{
      const selectedFormat=filters.format==='long'?'long':'short';
      const result=await searchYouTubeSignals({query:'',language:filters.language,locale,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,entity:filters.entity==='channels'?'channels':'videos',ranking:true,limit:100,pageToken});
      result.channels.forEach(channel=>{const index=channels.findIndex(item=>item.id===channel.id);if(index>=0)Object.assign(channels[index],channel);else channels.push(channel)});
      setRankingData(current=>{
        if(!current)return current;
        const merged=mergeRankingVideos([...current.short,...current.long],result.videos);
        return {short:merged.filter(video=>video.format==='short'),long:merged.filter(video=>video.format==='long'),nextPageToken:result.nextPageToken,loadedCount:merged.length,dataScope:result.dataScope||current.dataScope,emptyMessage:result.noCandidatesMessage||current.emptyMessage};
      });
    }catch(reason){setError(reason instanceof Error?reason.message:'下一页 YouTube 公开数据暂时无法读取。');}
    finally{setLoadingMore(false);}
  };
  useEffect(()=>{if(mode!=='discover'&&mode!=='radar')return;const task=window.setTimeout(()=>{void runSearch()},0);return()=>window.clearTimeout(task)},[mode,runSearch]);
  useEffect(()=>{if(mode!=='rankings')return;const task=window.setTimeout(()=>{void runRankingSearch()},0);return()=>window.clearTimeout(task)},[mode,runRankingSearch]);
  const rows=useMemo(()=>source.filter(v=>{
    const o=scoreFor(v),c=channelFor(v),text=`${v.title} ${v.topic} ${v.tags.join(' ')}`.toLowerCase();
    const matchesQuery=mode==='discover'||mode==='radar'||Boolean(remote)||!filters.q||text.includes(filters.q.toLowerCase());
    const lowEvidenceLongForm=v.format!=='short'&&o.confidence===0;
    return matchesQuery&&matchesContentScope(v,filters)&&(filters.language==='all'||v.language===filters.language)&&(filters.format==='all'||v.format===filters.format)&&(filters.maxSubs==='all'||(c.subscribers!==null&&c.subscribers<=Number(filters.maxSubs)))&&(lowEvidenceLongForm||o.opportunityScore>=Number(filters.minScore));
  }).sort((a,b)=>mode==='rankings'?b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views:scoreFor(b).opportunityScore-scoreFor(a).opportunityScore),[filters,mode,remote,source]);
  const rankingLongRows=rankingData?.long||rows.filter(video=>video.format==='long');
  const rankingShortRows=rankingData?.short||rows.filter(video=>video.format==='short');
  const resultCount=mode==='rankings'?rankingLongRows.length+rankingShortRows.length:rows.length;
  const radarRows=useMemo(()=>{const ageHours=(video:Video)=>{const capturedAt=video.snapshots.at(-1)?.capturedAt||video.publishedAt;return Math.max(1,(new Date(capturedAt).getTime()-new Date(video.publishedAt).getTime())/3600000)};const byVelocity=(a:Video,b:Video)=>scoreFor(b).viewsPerHour-scoreFor(a).viewsPerHour;const byNewest=(a:Video,b:Video)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime();if(radarView==='new')return rows.filter(video=>ageHours(video)<=72).sort(byNewest);if(radarView==='breakout')return rows.filter(video=>{const subscribers=channelFor(video).subscribers;return subscribers!==null&&subscribers<=100000&&scoreFor(video).viewsPerSubscriber>=1}).sort((a,b)=>scoreFor(b).viewsPerSubscriber-scoreFor(a).viewsPerSubscriber);if(radarView==='repeatable')return rows.filter(video=>video.format==='long'&&video.durationSeconds>=180&&video.durationSeconds<=1800).sort((a,b)=>scoreFor(b).opportunityScore-scoreFor(a).opportunityScore);return [...rows].sort(byVelocity)},[radarView,rows]);
  if(mode==='radar'){const clusters=Object.entries(radarRows.reduce<Record<string,Video[]>>((acc,video)=>{(acc[video.topic]??=[]).push(video);return acc},{}));const radarCopy={velocity:['加速中','按发布至今的平均播放速度排序；单次快照不能证明实时加速。'],new:['新出现','只展示最近 72 小时发布的公开视频。'],breakout:['低粉爆发','订阅不超过 10 万且播放 / 订阅 ≥ 1 的视频。'],repeatable:['可复刻形式','优先展示 3–30 分钟、便于拆解结构的长视频；仍需人工复核。']} as const;return <main className="page"><PageIntro label="趋势雷达" title="把公开变化信号变成可观看、可行动的视频" body="无需关键词，按时间、语言、频道规模和内容形态读取已采集的 YouTube 公开视频；点击缩略图或标题可直接打开原视频。"/><Filters filters={filters} setFilters={setFilters} hideKeyword/><div className="result-toolbar"><span>当前视图找到 <b>{radarRows.length}</b> 条公开视频</span><span>{remote?'已采集 YouTube 公开数据 · 每日快照':'正在加载公开视频'}</span><button className="primary" onClick={runSearch} disabled={loading}>{loading?'正在更新…':'更新趋势雷达'}</button></div>{error&&<p className="api-error">{error}</p>}{remote&&<p className="api-note">筛选项改变时会从已收录数据中重新筛选；缩略图由服务端代理，点击缩略图或标题会直接打开对应 YouTube 视频。</p>}<div className="radar-tabs" role="tablist" aria-label="趋势雷达视图">{(['velocity','new','breakout','repeatable'] as const).map(view=><button key={view} role="tab" aria-selected={radarView===view} className={radarView===view?'active':''} onClick={()=>setRadarView(view)}>{radarCopy[view][0]}</button>)}</div><p className="api-note">{radarCopy[radarView][1]}</p><div className="cluster-list">{clusters.length?clusters.map(([topic,items])=>{const average=Math.round(items.reduce((sum,video)=>sum+scoreFor(video).opportunityScore,0)/items.length);return <section className="cluster" key={topic}><div className="cluster-head"><div><span className="eyebrow">趋势簇</span><h2>{topic||'公开视频趋势簇'}</h2><p>{items.length} 条视频 · 平均信号评分 {average}</p></div><ScorePill value={average}/></div><div className="mini-grid">{items.slice(0,6).map(video=><VideoCard key={video.id} video={video} state={state} setState={setState} onDetail={openDetail} locale={locale}/>)}</div></section>}):<Empty title="当前视图没有符合条件的公开视频" body="可切换雷达视图、扩大时间窗口、切换内容形态或放宽频道订阅上限后重新获取。"/>}</div></main>}
  if(mode==='rankings'){const selectedFormat=filters.format==='long'?'long':'short';const scopedVideos=[...rankingLongRows,...rankingShortRows].filter(video=>matchesRankingScope(video,filters)).filter(video=>video.format===selectedFormat);const scopedCount=filters.entity==='channels'?new Set(scopedVideos.map(video=>video.channelId)).size:scopedVideos.length;const copy=languageCopy[locale].ranking;const scopeLabel=rankingData?.dataScope?(rankingData.dataScope.source==='stored-corpus'?copy.storedCorpus:copy.liveChart):copy.loadingSamples;return <main className="page rankings-page"><PageIntro label={copy.introLabel} title={copy.introTitle} body={copy.introBody}/><div className="rankings-layout"><RankingFilters filters={filters} setFilters={setFilters} locale={locale}/><div className="rankings-content"><div className="result-toolbar"><span>{copy.found} <b>{scopedCount}</b> {filters.entity==='channels'?(locale==='zh'?'个频道':'channels'):copy.publicSamples}</span><span>{scopeLabel}</span><button className="primary" onClick={()=>runRankingSearch(true)} disabled={loading}>{loading?copy.updating:copy.refresh}</button><button onClick={()=>navigator.clipboard?.writeText(location.href)}>{copy.copyLink}</button></div>{error&&<p className="api-error">{error}</p>}{rankingData?.dataScope&&<RankingDataScope scope={rankingData.dataScope} locale={locale}/>}<RankingBoard longRows={rankingLongRows} shortRows={rankingShortRows} selectedFormat={selectedFormat} filters={filters} onDetail={openDetail} savedVideoIds={savedVideoIds} savedChannelIds={savedChannelIds} onAddToStudio={addToStudio} locale={locale} loadedCount={rankingData?.loadedCount||0} canLoadMore={Boolean(rankingData?.nextPageToken)} loadingMore={loadingMore} onLoadMore={loadMoreRanking} emptyMessage={rankingData?.emptyMessage||null}/></div></div></main>;}
  const isResearch=mode==='research';return <main className={isResearch?'app-page':'page discover-page'}><PageIntro label={isResearch?'深度检索':'公开发现'} title={isResearch?'把一个赛道缩小到可验证的公开视频':'自动发现近期值得关注的视频'} body={isResearch?'输入关键词后，按时间、语言、频道规模和内容形态检索真实 YouTube 公开数据。':'无需关键词；按时间、语言、频道规模和内容形态自动筛出真实 YouTube 公开视频。'}/><Filters filters={filters} setFilters={setFilters} hideKeyword={!isResearch}/><div className="result-toolbar"><span>找到 <b>{resultCount}</b> 条视频</span><span>{remote?'真实 YouTube 公开数据 · 单次快照':isResearch?'输入关键词后开始检索':'正在加载公开视频'}</span><button className="primary" onClick={runSearch} disabled={loading}>{loading?(isResearch?'正在检索…':'正在更新…'):(isResearch?'检索公开数据':'更新公开发现')}</button><button onClick={()=>navigator.clipboard?.writeText(location.href)}>复制筛选链接</button></div>{error&&<p className="api-error">{error}</p>}{remote&&<p className="api-note">真实 API 当前返回单次快照：播放/小时表示“发布至今平均播放”，增长趋势与置信度需持续采集后才会更准确。</p>}{rows.length?<div className="video-grid">{rows.slice(0,page*6).map(v=><VideoCard key={v.id} video={v} state={state} setState={setState} onDetail={openDetail} locale={locale}/>)}</div>:<Empty title={isResearch?'输入关键词开始检索':'当前条件下暂无公开视频'} body={isResearch?'例如输入 AI productivity、history documentary 或 fitness tips。':'可扩大时间窗口、切换内容形态或放宽频道订阅上限后重新获取。'}/>} {rows.length>page*6&&<button className="load-more" onClick={()=>setPage(p=>p+1)}>加载更多视频</button>}</main>
}

function PageIntro({label,title,body}:{label:string;title:string;body:string}){return <section className="page-intro"><span className="eyebrow">{label}</span><h1>{title}</h1><p>{body}</p></section>}
function Home({locale}:{locale:UiLocale}){const copy=languageCopy[locale].home;const routeCopy=locale==='zh'?{label:'SIGNAL ROUTE',live:'实时路径',title:'从公开信号到下一步行动',body:'先发现值得验证的内容，再把判断带回工作室。',studio:'带回工作室',studioBody:'保存信号、整理想法并开始执行',routeLabel:'信号工作流'}:{label:'SIGNAL ROUTE',live:'Live path',title:'From public signal to next move',body:'Find what deserves a closer look, then bring the decision into your studio.',studio:'Bring it to studio',studioBody:'Save the signal, shape the idea, and start moving.',routeLabel:'Signal workflow'};return <main><section className="hero"><div><span className="eyebrow">YOUTUBE CONTENT INTELLIGENCE</span><h1>{copy.headline}<em>{copy.headlineEmphasis}</em></h1><p>{copy.body}</p><div className="hero-actions"><button className="primary" onClick={()=>navigate('/discover')}>{copy.dailySignals}</button><button onClick={()=>navigate('/methodology')}>{copy.methodology}</button></div><div className="proof"><span><b>{copy.daily}</b> {copy.snapshot}</span><span><b>4</b> {copy.scoreDimensions}</span><span><b>{locale==='zh'?'多市场':'Multi-market'}</b> {copy.multiMarket}</span></div></div><div className="hero-route" aria-label={routeCopy.routeLabel}><div className="route-head"><span className="eyebrow">{routeCopy.label}</span><span className="route-live"><i aria-hidden="true"/> {routeCopy.live}</span></div><h2>{routeCopy.title}</h2><p>{routeCopy.body}</p><div className="route-steps"><button className="route-step" onClick={()=>navigate('/discover')}><span className="route-index">01</span><span className="route-step-copy"><b>{copy.discovery}</b><small>{copy.discoveryBody}</small></span><span className="route-arrow" aria-hidden="true">→</span></button><button className="route-step" onClick={()=>navigate('/longform')}><span className="route-index">02</span><span className="route-step-copy"><b>{copy.radar}</b><small>{copy.radarBody}</small></span><span className="route-arrow" aria-hidden="true">→</span></button><button className="route-step" onClick={()=>navigate('/app')}><span className="route-index">03</span><span className="route-step-copy"><b>{routeCopy.studio}</b><small>{routeCopy.studioBody}</small></span><span className="route-arrow" aria-hidden="true">→</span></button></div></div></section><section className="home-section"><div className="section-heading"><div><span className="eyebrow">TODAY&apos;S SIGNALS</span><h2>{copy.listTitle}</h2></div><button onClick={()=>navigate('/rankings')}>{copy.viewAll}</button></div><div className="home-signal-grid"><button className="signal-row" onClick={()=>navigate('/discover')}><span className="rank">01</span><div><b>{copy.discovery}</b><small>{copy.discoveryBody}</small></div><span>{copy.open}</span></button><button className="signal-row" onClick={()=>navigate('/longform')}><span className="rank">02</span><div><b>{copy.radar}</b><small>{copy.radarBody}</small></div><span>{copy.open}</span></button></div></section><section className="steps"><div><span>01</span><h3>{copy.stepOne}</h3><p>{copy.stepOneBody}</p></div><div><span>02</span><h3>{copy.stepTwo}</h3><p>{copy.stepTwoBody}</p></div><div><span>03</span><h3>{copy.stepThree}</h3><p>{copy.stepThreeBody}</p></div></section><section className="cta-band"><div><span className="eyebrow">FROM SIGNAL TO SHIP</span><h2>{copy.cta}</h2></div><button className="primary" onClick={()=>navigate('/app')}>{copy.studio}</button></section></main>}

function Methodology(){return <main className="page prose"><PageIntro label="方法与边界" title="清晰解释，才能让数据成为判断的辅助。" body="SignalCraft 不把评分伪装成结论；它只是让你更快找到值得验证的公开信号。"/><section><h2>评分如何组成</h2><div className="method-grid"><div><b>VelocityScore</b><p>根据当前公开播放量与发布时间计算平均速度，不等同实时播放。</p></div><div><b>OutlierScore</b><p>播放相对订阅数与频道公开规模的偏离。</p></div><div><b>Confidence</b><p>采样次数与数据完整程度。单次公开快照会明确降低置信度。</p></div><div><b>OpportunityScore</b><p>增速 30%、异常 32%、新鲜度 18%、互动代理 12%、置信度 8%。</p></div></div></section><section><h2>数据与隐私</h2><p>公开发现、排行榜、趋势雷达和频道诊断均通过服务端 YouTube Data API 读取当前公开信息；不抓取 YouTube 页面，不在浏览器展示或提交密钥。</p></section><section><h2>局限性</h2><p>单次快照无法证明持续增长。播放表现也不等于商业价值或可复制性；版权、敏感议题、地区文化与算法波动仍需人工复核。</p></section></main>}
function Pricing(){
  const [selectedPlan,setSelectedPlan]=useState<UpgradePlan|null>(null);
  const [cycle,setCycle]=useState<'month'|'quarter'|'year'>('quarter');
  const [currency,setCurrency]=useState<'CNY'|'USD'>('CNY');
  const usdReferenceRate=7.2;
  const rows=[['公开发现与市场榜单（登录后前 10 条）','✓','✓','✓'],['完整排行榜与长视频赛道评估数据','—','✓','✓'],['可解释机会评分','—','✓','✓'],['保存、对标与选题工作流','—','✓','✓'],['AI 生图（GPT-Image-2）与图生视频','—','—','✓'],['团队成员、共享积分与活动记录','—','—','✓'],['自定义监听与 Webhook','—','—','规划中']];
  const cycleLabel={month:'月付',quarter:'季付',year:'年付'}[cycle];
  const cyclePriceLabel={month:'月',quarter:'季',year:'年'}[cycle];
  const formatPrice=(cny:number)=>new Intl.NumberFormat(currency==='USD'?'en-US':'zh-CN',{style:'currency',currency,minimumFractionDigits:currency==='USD'?2:0,maximumFractionDigits:2}).format(currency==='USD'?Number((cny/usdReferenceRate).toFixed(2)):cny);
  const priceFor=(cny:number)=>`${formatPrice(cny)} / ${currency==='USD'?({month:'month',quarter:'quarter',year:'year'}[cycle]):cyclePriceLabel}`;
  const plans:UpgradePlan[]=[
    {name:'Pro',price:priceFor({month:39,quarter:99,year:299}[cycle]),currency,cycle,description:'完整排行榜、长视频赛道评估与个人研究工作流'},
    {name:'Team',price:priceFor({month:299,quarter:849,year:3199}[cycle]),currency,cycle,description:`Pro 全部能力 · 3 个成员 · 每月 30,000 积分 · AI 图生视频`},
  ];
  const freePlan={name:'Free' as const,price:formatPrice(0),description:'查看当前 YouTube 公开发现与榜单'};
  const pricingPlans:(UpgradePlan|typeof freePlan)[]=[freePlan,...plans];
  return <><main className="page pricing-page"><PageIntro label="定价" title="先证明价值，再决定升级。" body="Free 账号登录后查看前 10 条榜单；Pro 开通完整研究工作流和排行榜；Team 在 Pro 基础上开放 AI 图生视频与团队权益。管理员会按此套餐开通账号。"/><div className="pricing-controls"><div className="pricing-cycle" role="tablist" aria-label="计费周期">{(['month','quarter','year'] as const).map(item=><button key={item} type="button" role="tab" aria-selected={cycle===item} className={cycle===item?'active':''} onClick={()=>setCycle(item)}>{item==='month'?'月付':item==='quarter'?'季付':'年付'}</button>)}</div><div className="pricing-currency" role="tablist" aria-label="价格币种">{(['CNY','USD'] as const).map(item=><button key={item} type="button" role="tab" aria-selected={currency===item} className={currency===item?'active':''} onClick={()=>setCurrency(item)}>{item==='CNY'?'人民币 ¥':'美元 $'}</button>)}</div></div><p className="pricing-cycle-note" aria-live="polite">当前选择：{cycleLabel} · {currency==='USD'?'美元参考价按 1 USD ≈ ¥7.2 换算':'人民币报价'}。Team 积分按月发放，视频生成按模型每秒费率 × 时长计算；失败任务不扣站内积分。</p><div className="pricing-grid">{pricingPlans.map(plan=><article className={cn('price-card',plan.name==='Pro'&&'featured')} key={plan.name}><span>{plan.name==='Pro'?'推荐':'计划'}</span><h2>{plan.name}</h2><b>{plan.price}</b><p>{plan.description}</p><button className={plan.name==='Pro'?'primary':''} onClick={()=>plan.name==='Free'?navigate('/app'):setSelectedPlan(plan)}>{plan.name==='Free'?'免费开始':`开通 ${plan.name}`}</button></article>)}</div><div className="manual-activation-note"><span>WECHAT · MANUAL ACTIVATION</span><p>游客可先选套餐扫码咨询；登录用户会自动带入当前账号邮箱，管理员按 Pro 或 Team 套餐人工开通对应权益。选择美元后，开通信息会带上 USD 参考报价。</p></div><div className="feature-table"><div className="feature-row heading"><b>功能</b><b>Free</b><b>Pro</b><b>Team</b></div>{rows.map(r=><div className="feature-row" key={r[0]}>{r.map((x,i)=><span key={i}>{x}</span>)}</div>)}</div></main>{selectedPlan&&<UpgradeModal plan={selectedPlan} onClose={()=>setSelectedPlan(null)}/>}</>}

function AppHome({state,setState,openDetail,locale}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){const high=state.saved.filter(v=>scoreFor(v).opportunityScore>=80).slice(0,3);return <main className="app-page"><PageIntro label="今日指挥台" title="先处理已保存的真实信号，再推进内容决策。" body="公开发现数据来自 YouTube Data API；你的保存、任务与选题仅保存在当前账号的此设备，尚未启用跨设备同步。"/><div className="command-grid"><section className="command-main"><div className="section-heading"><h2>待处理信号</h2><button onClick={()=>navigate('/discover')}>进入发现页 →</button></div>{high.length?high.map(v=>{const titleZh=translatedTitle(v,locale);return <button className="alert-card" key={v.id} onClick={()=>openDetail(v)}><ScorePill value={scoreFor(v).opportunityScore}/><div><b>{v.title}</b>{titleZh&&<small className="title-translation">中文：{titleZh}</small>}<p>{scoreFor(v).reasons[0]}</p></div><span>查看 →</span></button>}):<Empty title="还没有已保存的高分信号" body="先在公开发现或趋势雷达中保存真实公开视频。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实视频</button>}/>}</section><section className="command-side"><h2>数据状态</h2><div className="sync"><span>●</span><b>YouTube Data API</b><small>公开发现、排行榜、趋势雷达与频道诊断已连接</small></div><button className="primary full" onClick={()=>navigate('/discover')}>刷新公开发现</button></section></div><div className="dashboard-grid"><section><div className="section-heading"><h2>任务清单</h2><button onClick={()=>setState(s=>({...s,tasks:[...s.tasks,{id:`t${Date.now()}`,title:'新建内容验证任务',status:'待办',owner:'当前用户',due:'待设置'}]}))}>+ 新建</button></div>{state.tasks.length?state.tasks.map(t=><button className="task" key={t.id} onClick={()=>setState(s=>({...s,tasks:s.tasks.map(x=>x.id===t.id?{...x,status:x.status==='完成'?'待办':'完成'}:x)}))}><span className={cn('check',t.status==='完成'&&'done')}>✓</span><div><b>{t.title}</b><small>{t.owner} · {t.due}</small></div><em>{t.status}</em></button>):<Empty title="尚无任务" body="创建第一条验证任务，形成从信号到行动的记录。"/>}</section><section><div className="section-heading"><h2>通知中心</h2><button onClick={()=>setState(s=>({...s,alerts:s.alerts.map(a=>({...a,read:true}))}))}>全部已读</button></div>{state.alerts.length?state.alerts.map(a=>{const source=a.sourceVideoId?state.saved.find(v=>v.id===a.sourceVideoId):undefined;return <button className={cn('notification',!a.read&&'unread')} key={a.id} onClick={()=>source&&openDetail(source)}><span>↗</span><div><b>{a.title}</b><small>{a.body}</small></div><time>{date(a.createdAt)}</time></button>}):<Empty title="尚无通知" body="创建监听规则后，真实触发记录会显示在这里。"/>}</section></div></main>}

function Library({kind,state,setState,openDetail,locale}:{kind:'channels'|'videos';state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){if(kind==='channels')return <main className="app-page"><PageIntro label="频道资产" title="跟踪值得长期研究的频道。" body="频道资产将在你保存公开视频并建立对标组后逐步沉淀。"/>{state.saved.length?<div className="table-wrap"><table><thead><tr><th>频道</th><th>已保存视频</th><th>订阅</th><th>最近视频</th></tr></thead><tbody>{Array.from(new Map(state.saved.map(v=>[v.channelId,v])).values()).map(v=><tr key={v.channelId}><td><b>{channelFor(v).title}</b><small>{v.channelId}</small></td><td>{state.saved.filter(x=>x.channelId===v.channelId).length}</td><td>{formatSubscribers(v.snapshots.at(-1)?.subscribers??null,'zh')}</td><td><button onClick={()=>openDetail(v)}>查看视频 →</button></td></tr>)}</tbody></table></div>:<Empty title="还没有频道资产" body="保存真实公开视频后，频道会自动出现在这里。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实视频</button>}/>}</main>;return <main className="app-page"><PageIntro label="视频资产" title="保存的信号，才能变成可复用的研究资产。" body="为真实公开视频加标签、写笔记、加入选题或对标组。"/>{state.saved.length?<div className="video-grid">{state.saved.map(v=><VideoCard key={v.id} video={v} state={state} setState={setState} onDetail={openDetail} locale={locale}/>)}</div>:<Empty title="还没有保存视频" body="在公开发现或雷达页面点“保存”，这里会自动出现。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实视频</button>}/>}</main>}
function ThumbnailLab({state,openDetail,locale}:{state:Persisted;openDetail:(v:Video)=>void;locale:UiLocale}){const [query,setQuery]=useState('');const [sort,setSort]=useState<'views'|'relative'>('views');const samples=useMemo(()=>state.saved.filter(video=>`${video.title} ${video.topic} ${video.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='views'?b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views:scoreFor(b).viewsPerSubscriber-scoreFor(a).viewsPerSubscriber),[state.saved,query,sort]);return <main className="app-page thumbnail-lab"><PageIntro label="缩略图研究" title="把真实缩略图放进同一张判断桌。" body="从已收藏的公开视频中按标题、赛道和标签筛选缩略图；排序使用公开播放或播放/订阅信号，不把视觉偏好伪装成点击率结论。"/><div className="thumbnail-controls"><label>筛选视频<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜标题、赛道或标签"/></label><div role="tablist" aria-label="缩略图排序"><button role="tab" aria-selected={sort==='views'} className={sort==='views'?'active':''} onClick={()=>setSort('views')}>按播放</button><button role="tab" aria-selected={sort==='relative'} className={sort==='relative'?'active':''} onClick={()=>setSort('relative')}>按低粉高播</button></div><small>{samples.length} 个已收藏的真实缩略图</small></div>{samples.length?<div className="thumbnail-board">{samples.map(video=>{const signal=scoreFor(video),channel=channelFor(video),titleZh=translatedTitle(video,locale);return <button className="thumbnail-study" key={video.id} onClick={()=>openDetail(video)} title="查看该视频的证据详情"><span className="thumbnail-image">{video.thumbnail?<img src={video.thumbnail} alt={`${video.title} 缩略图`} width={480} height={270} loading="lazy" decoding="async"/>:<i>无公开缩略图</i>}<em>{video.format==='short'?'短':'长'}</em></span><span className="thumbnail-copy"><b>{video.title}</b>{titleZh&&<small className="title-translation">中文：{titleZh}</small>}<small>{channel.title} · {video.topic}</small><span><strong>{num.format(video.snapshots.at(-1)!.views)}</strong> 播放 <strong>{signal.viewsPerSubscriber}×</strong> 播放 / 订阅</span></span></button>})}</div>:<Empty title={state.saved.length?'没有匹配的缩略图':'先收藏公开视频，再开始缩略图研究'} body={state.saved.length?'更换关键词或切换排序方式。':'缩略图研究只展示你收藏的真实公开视频，不会填充演示图片。'} action={!state.saved.length?<button className="primary" onClick={()=>navigate('/discover')}>去发现真实视频</button>:undefined}/>}<section className="thumbnail-boundary"><b>下一步：图像相似度检索</b><p>以图片或 URL 搜索相似缩略图，需要单独接入视觉模型与向量索引；在此之前，当前研究板只呈现可验证的真实视频。</p></section></main>}

function Research({state,setState,openDetail,locale}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){return <Discovery mode="research" state={state} setState={setState} openDetail={openDetail} locale={locale}/>}
function Watchlists({state,setState,toast}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;toast:(t:string)=>void}){return <main className="app-page"><PageIntro label="视频警报" title="让值得研究的异常自己来找你。" body="为关键词、频道或赛道设置最低信号分数与检查频率。规则会保存在当前账号的此设备；后台检测和邮件、Webhook 会在账户数据库接入后启用。"/>{state.rules.length?<div className="watch-grid">{state.rules.map(rule=><article className="watch-card" key={rule.id}><div><span className="tag">{rule.type}</span><h2>{rule.name}</h2><p>{rule.frequency} · 信号评分 ≥ {rule.threshold} · {rule.channel}</p></div><label className="toggle"><input type="checkbox" checked={!rule.paused} onChange={()=>setState(s=>({...s,rules:s.rules.map(r=>r.id===rule.id?{...r,paused:!r.paused}:r)}))}/><span /></label></article>)}</div>:<Empty title="还没有视频警报" body="创建规则后会保存在当前账号的此设备，等待服务器定时检测接入。"/>}<div className="inline-form"><input placeholder="例如：英语 AI 效率低粉爆发" id="ruleName"/><select id="ruleType"><option>关键词</option><option>频道</option><option>赛道</option></select><select id="ruleThreshold" defaultValue="75"><option value="65">信号 ≥ 65</option><option value="75">信号 ≥ 75</option><option value="85">信号 ≥ 85</option></select><select id="ruleFrequency" defaultValue="每 6 小时"><option>每 6 小时</option><option>每天一次</option><option>每周一次</option></select><button className="primary" onClick={()=>{const input=document.getElementById('ruleName') as HTMLInputElement;const type=document.getElementById('ruleType') as HTMLSelectElement;const threshold=document.getElementById('ruleThreshold') as HTMLSelectElement;const frequency=document.getElementById('ruleFrequency') as HTMLSelectElement;if(!input.value.trim())return toast('请先填写规则名称');setState(s=>({...s,rules:[...s.rules,{id:`w${Date.now()}`,name:input.value,type:type.value as WatchRule['type'],threshold:Number(threshold.value),frequency:frequency.value,channel:'站内通知',paused:false}]}));input.value='';toast('视频警报已创建')}}>创建警报</button></div></main>}
type MonitoringSyncState = 'idle' | 'syncing' | 'synced' | 'fallback';

function PersistentWatchlists({state,setState,toast,account}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;toast:(t:string)=>void;account:AccountSession|null}) {
  const [syncState,setSyncState]=useState<MonitoringSyncState>('idle');
  const syncGeneration=useRef(0);
  const syncRules=useCallback(async()=>{
    const generation=++syncGeneration.current;
    if(!account?.accessToken){setSyncState('idle');return;}
    setSyncState('syncing');
    try {
      const rules=await loadMonitorRules();
      if(generation!==syncGeneration.current)return;
      setState(current=>({...current,rules}));
      setSyncState('synced');
    } catch {
      if(generation!==syncGeneration.current)return;
      // Keep the current account's local rules visible when cloud persistence is unavailable.
      setSyncState('fallback');
    }
  },[account?.accessToken,setState]);
   useEffect(()=>{const timer=window.setTimeout(()=>{void syncRules()},0);return()=>{window.clearTimeout(timer);syncGeneration.current+=1}},[syncRules]);
  const toggle=async(rule:WatchRule)=>{
    const paused=!rule.paused;
    setState(s=>({...s,rules:s.rules.map(item=>item.id===rule.id?{...item,paused}:item)}));
    if(!account?.accessToken||rule.id.startsWith('local-'))return;
    try{await updateMonitorRule(rule.id,{paused})}catch{toast('服务器同步失败，已保留本地开关状态。')}
  };
  const create=async()=>{
    const input=document.getElementById('ruleName') as HTMLInputElement|null;
    const type=document.getElementById('ruleType') as HTMLSelectElement|null;
    const threshold=document.getElementById('ruleThreshold') as HTMLSelectElement|null;
    const frequency=document.getElementById('ruleFrequency') as HTMLSelectElement|null;
    if(!input?.value.trim())return toast('请先填写规则名称');
    const draft:Omit<WatchRule,'id'>={name:input.value.trim(),type:(type?.value||'关键词') as WatchRule['type'],threshold:Number(threshold?.value||75),frequency:frequency?.value||'每天一次',channel:'站内通知',paused:false};
    input.value='';
    if(account?.accessToken){
      try{const rule=await createMonitorRule(draft);setState(s=>({...s,rules:[rule,...s.rules]}));setSyncState('synced');toast('视频警报已创建并同步')}
      catch{const localRule={...draft,id:`local-${Date.now()}`};setState(s=>({...s,rules:[localRule,...s.rules]}));setSyncState('fallback');toast('服务器暂不可用，已保存到当前账号本地')}
    } else {
      const localRule={...draft,id:`local-${Date.now()}`};
      setState(s=>({...s,rules:[localRule,...s.rules]}));
      toast('视频警报已保存到当前账号本地');
    }
  };
  const status=account?.accessToken?syncState:'idle';
  const statusTitle=status==='syncing'?'正在同步当前账号':status==='synced'?'已同步当前账号规则':status==='fallback'?'当前使用本地规则':'本地规则模式';
  const statusBody=status==='syncing'?'读取云端规则，页面不会替换本账号的本地资产。':status==='synced'?`共 ${state.rules.length} 条规则 · 云端数据已就绪`:status==='fallback'?'云端同步暂不可用；规则仍保留在当前账号，服务恢复后可重新同步。':'未登录时规则只保存在此设备；登录后可同步到当前账号。';
  return <main className="app-page watchlists-page">
    <PageIntro label="视频警报" title="让值得研究的异常自己来找你。" body="为关键词、频道或赛道设置最低信号分数与检查频率。登录后会同步到当前账号；未登录时仍保留本地规则。"/>
    <section className={cn('watchlists-status',`is-${status}`)} role="status" aria-live="polite">
      <span className="watchlists-status-mark" aria-hidden="true">{status==='syncing'?'↻':status==='synced'?'✓':status==='fallback'?'!':'•'}</span>
      <div><b>{statusTitle}</b><p>{statusBody}</p></div>
      {account?.accessToken&&<button type="button" onClick={()=>void syncRules()} disabled={status==='syncing'}>{status==='syncing'?'同步中…':'重新同步'}</button>}
    </section>
    {state.rules.length?<div className="watch-grid watchlists-rules" aria-label="当前视频警报">{state.rules.map(rule=><article className="watch-card" key={rule.id}><div><span className="tag">{rule.type}</span><h2>{rule.name}</h2><p>{rule.frequency} · 信号评分 ≥ {rule.threshold} · {rule.channel}</p></div><label className="toggle"><span className="sr-only">{rule.name} {rule.paused?'已暂停':'已启用'}</span><input type="checkbox" checked={!rule.paused} onChange={()=>void toggle(rule)}/><span aria-hidden="true" /></label></article>)}</div>:<section className="watchlists-empty"><span className="watchlists-empty-mark" aria-hidden="true">◇</span><div><b>还没有视频警报</b><p>从下方创建第一条规则；它只会写入当前账号。</p></div></section>}
    <section className="watchlists-form" aria-label="创建视频警报">
      <div className="watchlists-form-head"><div><span className="watchlists-kicker">新建规则</span><h2>告诉我你要盯什么</h2><p>从关键词、频道或赛道开始，设置触发门槛和检查频率。</p></div><span className="watchlists-form-note">当前账号</span></div>
      <div className="watchlists-form-grid">
        <label className="watchlists-field watchlists-field-name"><span>规则名称</span><input placeholder="例如：英语 AI 效率低粉爆发" id="ruleName"/></label>
        <label className="watchlists-field"><span>监控对象</span><select id="ruleType" defaultValue="关键词"><option>关键词</option><option>频道</option><option>赛道</option></select></label>
        <label className="watchlists-field"><span>信号门槛</span><select id="ruleThreshold" defaultValue="75"><option value="65">信号 ≥ 65</option><option value="75">信号 ≥ 75</option><option value="85">信号 ≥ 85</option></select></label>
        <label className="watchlists-field"><span>检查频率</span><select id="ruleFrequency" defaultValue="每 6 小时"><option>每 6 小时</option><option>每天一次</option><option>每周一次</option></select></label>
        <button className="primary watchlists-submit" type="button" onClick={()=>void create()}>创建警报 <span aria-hidden="true">→</span></button>
      </div>
    </section>
  </main>
}
function Benchmarks({state,toast,locale}:{state:Persisted;toast:(t:string)=>void;locale:UiLocale}){const [compare,setCompare]=useState<string[]>([]);const candidate=state.saved;const selected=compare.map(id=>candidate.find(v=>v.id===id)).filter(Boolean) as Video[];return <main className="app-page"><PageIntro label="竞品与对标" title="把竞品的高表现视频放在同一张研究桌上。" body="收藏频道与视频后，可比较 2–5 个公开视频的播放、相对表现、速度与共同标签；所有结论都能回到原视频。"/>{state.collections.length?<div className="collection-grid">{state.collections.map(c=><article className="collection" key={c.id}><span style={{background:c.color}} /><div><h2>{c.name}</h2><p>{c.items.length} 个项目 · 当前账号</p></div><button onClick={()=>toast('跨设备分享将在账户与数据库接入后开放')}>分享</button></article>)}</div>:<Empty title="还没有竞品对标组" body="在真实视频的证据页点击“加入对标组”即可创建。"/>}<div className="compare-picker"><h2>快速比较</h2><p>选择 2–5 个已收藏的真实视频。</p>{candidate.length?candidate.map(v=>{const titleZh=translatedTitle(v,locale);return <label key={v.id}><input type="checkbox" checked={compare.includes(v.id)} onChange={()=>setCompare(x=>x.includes(v.id)?x.filter(i=>i!==v.id):x.length<5?[...x,v.id]:x)}/><span>{v.title}{titleZh&&<small className="title-translation">中文：{titleZh}</small>}</span></label>}):<p>先在发现页收藏至少两个视频。</p>}</div>{selected.length>=2&&<div className="compare-table"><div className="compare-heading"><b>指标</b>{selected.map(v=>{const titleZh=translatedTitle(v,locale);return <b key={v.id}><span>{v.title.slice(0,14)}…</span>{titleZh&&<small className="title-translation">{titleZh}</small>}</b>})}</div>{[['机会评分',(v:Video)=>scoreFor(v).opportunityScore],['播放 / 订阅',(v:Video)=>`${scoreFor(v).viewsPerSubscriber}×`],['每小时播放',(v:Video)=>num.format(scoreFor(v).viewsPerHour)],['发布时间',(v:Video)=>date(v.publishedAt)],['共同标签',(v:Video)=>v.tags.slice(0,2).join(' / ')]].map(([label,fn])=><div className="compare-row" key={label as string}><span>{label as string}</span>{selected.map(v=><span key={v.id}>{(fn as (v:Video)=>React.ReactNode)(v)}</span>)}</div>)}</div>}</main>}
function Ideas({state,setState,locale}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;locale:UiLocale}){const statuses:IdeaStatus[]=['收集','验证','制作中','已发布','复盘'];return <main className="app-page"><PageIntro label="选题实验室" title="从信号到制作，再到复盘。" body="每张选题卡都保留真实来源视频，避免凭感觉断开数据。"/><div className="kanban">{statuses.map(status=><section key={status}><div className="kanban-head"><b>{status}</b><span>{state.ideas.filter(i=>i.status===status).length}</span></div>{state.ideas.filter(i=>i.status===status).map(i=>{const v=state.saved.find(v=>v.id===i.sourceVideoId),titleZh=v?translatedTitle(v,locale):null;return <article className="idea" key={i.id}><span className="tag">来源 {v?scoreFor(v).opportunityScore:'数据已不可用'} </span>{v&&<small className="title-translation idea-source-title">来源视频：{titleZh||v.title}</small>}<h3>{i.title}</h3><p>{i.angle}</p><small>{i.owner} · {date(i.createdAt)}</small><select value={i.status} onChange={e=>setState(s=>({...s,ideas:s.ideas.map(x=>x.id===i.id?{...x,status:e.target.value as IdeaStatus}:x)}))}>{statuses.map(x=><option key={x}>{x}</option>)}</select></article>})}{!state.ideas.some(i=>i.status===status)&&<p className="muted">请从真实视频的证据页创建选题。</p>}</section>)}</div></main>}
function Prompts({toast}:{toast:(t:string)=>void}){return <main className="app-page"><PageIntro label="提示词库" title="把研究方法沉淀成可复用模板。" body="提示词会在真实 AI 接入后带入选题上下文。"/>{promptTemplates.length?<div className="prompt-list">{promptTemplates.map(p=><article key={p.id}><div><span className="tag">{p.category}</span><h2>{p.title}</h2><p>{p.body}</p><small>{p.version} · {p.enabled?'已启用':'已停用'}</small></div><button className="primary" onClick={()=>navigator.clipboard?.writeText(p.body).then(()=>toast('提示词模板已复制'))}>复制模板</button></article>)}</div>:<Empty title="暂无自定义提示词" body="创建与保存提示词需要账户数据库接入，当前不展示预置内容。"/>}</main>}
function Settings(){return <main className="app-page"><PageIntro label="配置" title="为真实服务保留安全边界。" body="敏感密钥仅配置在服务器环境变量中，不会显示在浏览器或保存到当前设备。"/><div className="settings-grid"><section><h2>数据源</h2><p><b>YouTube Data API</b> · 服务端已连接</p><p>公开发现、排行榜、趋势雷达与频道诊断均读取当前公开数据。</p></section><section><h2>刷新计划</h2><p>公开榜单可在页面打开时按需读取；后台采集任务每天 02:00 UTC（北京时间约 10:00）由 Vercel Cron 执行。</p><p>采集结果写入数据库后，管理台会显示最近运行、完成时间和候选视频数量；未配置服务器密钥时任务不会运行。</p></section><section><h2>团队成员</h2><p>登录、成员角色与跨设备数据同步需要接入认证和数据库。</p></section><section><h2>通知渠道</h2><p>规则暂存当前设备；邮件、Slack、Webhook 尚未启用。</p></section></div></main>}

export default function SignalCraftApp() {
  const path = useBrowserPath();
  const [theme, setTheme] = useState('light');
  const { account, clearAccount, locale, setLocale } = useBrowserSession();
  const [state, setState] = usePersisted(account);
  const [drawer, setDrawer] = useState<Video | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isOwner, setIsOwner] = useState(false);
  const accessToken = account?.accessToken;
  const accountScope = accountStorageScope(account);

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      return () => {
        active = false;
      };
    }

    void hasOwnerAccess()
      .then(value => {
        if (active) setIsOwner(value);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    localStorage.setItem('signalcraft-interface-locale', locale);
  }, [locale]);

  const notify = (message: string) => {
    setToast({ message });
    setTimeout(() => setToast(null), 2400);
  };

  const beginLogin = () => {
    if (startGoogleSignIn()) return;
    notify('Google 登录尚未配置。请先在环境变量中填写 NEXT_PUBLIC_SUPABASE_URL。');
  };

  const endSession = () => {
    signOut();
    clearAccount();
    setIsOwner(false);
    notify('已退出账号');
  };

  const watchRadarEvent = (event: OpportunityRadarEvent) => {
    if (!account) {
      notify('请先登录，再保存雷达监听。');
      return;
    }
    const name = `雷达：${event.title}`;
    setState(current => {
      if (current.rules.some(rule => rule.name === name && rule.type === '赛道')) return current;
      const threshold = event.whyNowScore === null ? 65 : Math.max(0, Math.min(100, Math.round(event.whyNowScore)));
      return {
        ...current,
        rules: [...current.rules, {
          id: `radar-watch-${event.id}`,
          name,
          type: '赛道',
          threshold,
          frequency: '每天一次',
          channel: event.topic || event.title,
          paused: false,
        }],
      };
    });
    notify('已加入视频警报，可在“视频警报”中查看');
  };

  const createRadarIdea = (event: OpportunityRadarEvent) => {
    if (!account) {
      notify('请先登录，再保存行动草稿。');
      return;
    }
    const title = `雷达行动：${event.title}`;
    setState(current => {
      if (current.ideas.some(idea => idea.title === title)) return current;
      const sourceVideoId = event.evidenceVideoIds[0] || `radar:${event.id}`;
      return {
        ...current,
        ideas: [...current.ideas, {
          id: `radar-idea-${event.id}`,
          title,
          sourceVideoId,
          angle: event.inferences[0] || '基于当前事件证据验证一个原创角度',
          audience: '当前 Opportunity Event 覆盖的公开受众',
          hypothesis: `在 ${event.baseline.windowDays}D 窗口复核该事件是否继续出现`,
          owner: account.name || '当前用户',
          status: '收集',
          note: `来自 Long-form Trend Radar：${event.id}；仅保留公开证据，不自动生成标题。`,
          createdAt: new Date().toISOString(),
        }],
      };
    });
    notify('已创建行动草稿，可在“选题”中查看');
  };

  const researchRadarEvent = (event: OpportunityRadarEvent, returnState?: RadarReturnState) => {
    const context = {
      nicheId: event.id,
      nicheName: event.topic || event.title,
      topicName: event.topic || event.title,
      contentType: 'LONG_FORM',
      platformType: 'YOUTUBE',
      format: event.format,
      timeWindow: `${event.baseline.windowDays}d`,
      filters: { market: returnState?.filters?.market || 'all', window: returnState?.filters?.window || `${event.baseline.windowDays}d` },
      sort: returnState?.sort || 'whyNowScore',
      trendSignals: { eventType: event.eventType, lifecycle: event.lifecycle, whyNowScore: event.whyNowScore, creatorConcentrationTop3: event.creatorConcentrationTop3 ?? null, facts: event.facts.slice(0, 3) },
      breakoutSignals: { count: event.smallCreatorBreakoutCount, acceleration: event.vpdAcceleration },
      smallCreatorSignals: { count: event.smallCreatorBreakoutCount, signal: event.metrics.smallCreatorSignal ?? null },
      representativeVideos: event.representativeVideos.slice(0, 8),
      representativeChannels: event.evidenceChannelIds.slice(0, 8),
      confidence: event.confidence,
      source: 'TREND_RADAR' as const,
      returnState: returnState || { scrollPosition: typeof window === 'undefined' ? 0 : window.scrollY, activeTab: 'ALL', filters: { market: 'all', window: `${event.baseline.windowDays}d` } },
    };
    saveNicheAnalysisContext(context);
    navigate(buildNicheEvaluationHref(context));
    notify('已带入趋势证据，正在打开长视频赛道评估');
  };

  const researchShortformEvent = (event: ShortformRadarEvent, returnState?: RadarReturnState) => {
    const context = {
      nicheId: event.id,
      nicheName: event.topic || event.title,
      topicName: event.topic || event.title,
      contentType: 'SHORT_FORM',
      platformType: 'YOUTUBE',
      format: event.format,
      timeWindow: `${event.baseline.windowDays}d`,
      filters: { market: returnState?.filters?.market || 'all', window: returnState?.filters?.window || `${event.baseline.windowDays}d` },
      sort: returnState?.sort || 'opportunityScore',
      trendSignals: { eventType: event.eventType, lifecycle: event.lifecycle, whyNowScore: event.whyNowScore, creatorConcentrationTop3: event.creatorConcentrationTop3 ?? null, sampleVideoCount: event.sampleVideoCount, independentChannelCount: event.independentChannelCount, demandProxyGrowth: event.metrics.demandProxyGrowth, dataQuality: event.dataQuality, facts: event.facts.slice(0, 3) },
      breakoutSignals: { count: event.breakoutCount, acceleration: event.vpdAcceleration },
      smallCreatorSignals: { count: event.breakoutCount, signal: event.metrics.breakoutDensity },
      representativeVideos: event.representativeVideos.slice(0, 8),
      representativeChannels: event.evidenceChannelIds.slice(0, 8),
      confidence: event.confidence,
      source: 'TREND_RADAR' as const,
      returnState: returnState || { scrollPosition: typeof window === 'undefined' ? 0 : window.scrollY, activeTab: 'ALL', filters: { market: 'all', window: `${event.baseline.windowDays}d` } },
    };
    saveNicheAnalysisContext(context);
    navigate(buildNicheEvaluationHref(context));
    notify('已带入 Shorts 趋势证据，正在打开 Shorts 赛道评估');
  };

  const createShortTestPlan = (handoff: ProductionHandoff) => {
    if (!account) { notify('请先登录，再保存制作方案。'); return; }
    if (handoff.test.format !== 'SHORTS') return;
    const test = handoff.test;
    setState(current => current.ideas.some(idea => idea.id === `short-test:${test.id}`) ? current : ({ ...current, ideas: [...current.ideas, {
      id: `short-test:${test.id}`, title: test.audienceQuestion, sourceVideoId: test.sourceVideoIds[0],
      angle: test.differentiation.join('；'), audience: test.audienceQuestion, hypothesis: test.promise,
      owner: account.name || '当前用户', status: '验证', note: JSON.stringify(handoff), createdAt: new Date().toISOString(),
    }] }));
    navigate('/app/ideas'); notify('已把所选 Shorts 测试保存到选题，不会自动生成视频。');
  };

  const content = path === '/'
    ? <Home locale={locale} />
    : path === '/discover'
      ? <Discovery mode="discover" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
      : path === '/rankings'
        ? <Discovery mode="rankings" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
    : path === '/radar' || path === '/radar/all' || path === '/longform' || path === '/short-radar'
      ? <LongformResearchDesk locale={locale} initialView={path === '/radar/all' ? 'all-radar' : path === '/radar' ? 'radar' : path === '/short-radar' ? 'short-radar' : 'opportunities'} onWatch={watchRadarEvent} onCreateIdea={createRadarIdea} onResearch={researchRadarEvent} onShortResearch={researchShortformEvent} />
      : path === '/shortform-evaluation'
        ? <ShortformNicheEvaluation locale={locale} onCreate={createShortTestPlan} />
      : path === '/doctor' || path === '/app/doctor'
            ? <ChannelDoctor locale={locale} />
            : path === '/methodology'
              ? <Methodology />
              : path === '/pricing'
                ? <Pricing />
                : path === '/owner'
                  ? <OwnerConsole account={account} onSignIn={beginLogin} />
                  : path === '/app'
                    ? <AppHome state={state} setState={setState} openDetail={setDrawer} locale={locale} />
                    : path === '/app/image-to-video'
                      ? <ImageToVideoStudio account={account} locale={locale} onSignIn={beginLogin} notify={notify} />
                    : path === '/app/canvas'
                      ? <VideoCanvasStudio key={accountScope} account={account} locale={locale} onSignIn={beginLogin} notify={notify} />
                    : path === '/app/library/channels'
                      ? <Library kind="channels" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
                      : path === '/app/library/videos'
                        ? <Library kind="videos" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
                        : path === '/app/thumbnails'
                          ? <ThumbnailLab state={state} openDetail={setDrawer} locale={locale} />
                          : path === '/app/cases'
                            ? <ViralCaseDesk key={accountScope}
                              account={account}
                              videos={state.saved}
                              locale={locale}
                              onOpenVideo={setDrawer}
                              onOpenLibrary={() => navigate('/app/library/videos')}
                              onDiscover={() => navigate('/discover')}
                              onOpenCanvas={() => navigate('/app/canvas')}
                              onImportVideo={video => {
                                setState(current => current.saved.some(item => item.id === video.id) ? current : { ...current, saved: [video, ...current.saved] });
                              }}
                              notify={notify}
                              onCreateIdea={(video, draft) => {
                                const exists = state.ideas.some(idea => idea.sourceVideoId === video.id);
                                if (exists) {
                                  notify('该视频已有选题卡，可在“选题”中继续完善。');
                                  return;
                                }
                                setState(current => ({
                                  ...current,
                                  ideas: [...current.ideas, {
                                    id: `i${Date.now()}`,
                                    sourceVideoId: video.id,
                                    owner: '当前用户',
                                    status: '收集',
                                    createdAt: new Date().toISOString(),
                                    ...draft,
                                  }],
                                }));
                                notify('已生成选题卡，来源证据与拆解笔记已带入。');
                              }}
                            />
                          : path === '/app/research'
                            ? <Research state={state} setState={setState} openDetail={setDrawer} locale={locale} />
                            : path === '/app/watchlists'
                            ? <PersistentWatchlists state={state} setState={setState} toast={notify} account={account} />
                              : path === '/app/benchmarks' || path === '/app/compare'
                                ? <Benchmarks state={state} toast={notify} locale={locale} />
                                : path === '/app/ideas'
                                  ? <Ideas state={state} setState={setState} locale={locale} />
                                  : path === '/app/prompts'
                                    ? <Prompts toast={notify} />
                                    : path === '/app/settings'
                                      ? <Settings />
                                      : <Home locale={locale} />;

  return <div className="app-shell">
    <Header
      path={path}
      onTheme={() => setTheme(current => current === 'light' ? 'dark' : 'light')}
      account={account}
      onSignIn={beginLogin}
      onSignOut={endSession}
      locale={locale}
      onLocaleChange={setLocale}
      isOwner={isOwner}
    />
    {['/radar', '/radar/all', '/short-radar', '/longform', '/shortform-evaluation'].includes(path)
      ? <DiscoveryProfileProvider key={accountScope} scope={accountScope}>{content}</DiscoveryProfileProvider>
      : content}
    {drawer && <DetailDrawer video={drawer} state={state} setState={setState} onClose={() => setDrawer(null)} toast={notify} locale={locale} />}
    {toast && <div className="toast" aria-live="polite">✓ {toast.message}</div>}
  </div>;
}

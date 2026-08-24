'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { channels, getOpportunity, initialAlerts, initialCollections, initialIdeas, initialTasks, promptTemplates, watchRules } from '@/src/lib/mock';
import { parseFilters, serializeFilters } from '@/src/lib/scoring.mjs';
import type { Alert, Collection, Idea, IdeaStatus, Task, Video, WatchRule } from '@/src/lib/types';
import { searchYouTubeSignals, type PublicRankingScope } from '@/src/lib/youtube';
import { signOut, startGoogleSignIn, type AccountSession } from '@/src/lib/auth';
import { useBrowserPath, useBrowserSession } from '@/src/lib/browser-session';
import { formatCompactNumber, interpolate, languageCopy, localizedCategory, localizedContentLanguage, localizedMarket, localizedTopic, type UiLocale } from '@/src/lib/ui-language';
import { hasOwnerAccess } from '@/src/lib/owner-admin';
import { getRecordedGrowth } from '@/src/lib/growth';
import UpgradeModal, { type UpgradePlan } from './upgrade-modal';
import RankingDataScope from './ranking-data-scope';

const RouteLoading = () => <main className="page"><div className="empty" aria-live="polite"><div className="empty-icon">◇</div><b>正在打开页面…</b><p>正在准备所需功能，不会重新读取或替换公开数据。</p></div></main>;
const ChannelDoctor = dynamic(() => import('./channel-doctor'), { loading: RouteLoading });
const OwnerConsole = dynamic(() => import('./owner-console'), { loading: RouteLoading });
const ImageToVideoStudio = dynamic(() => import('./image-to-video-studio'), { loading: RouteLoading });

const BRAND = process.env.NEXT_PUBLIC_BRAND_NAME || 'SignalCraft';
const cn = (...names:(string|false|undefined)[]) => names.filter(Boolean).join(' ');
const num = new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1});
const date = (iso:string) => new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso));
const channelFor = (v:Video) => channels.find(c=>c.id===v.channelId) || {id:v.channelId,title:'公开频道',handle:'',subscribers:v.snapshots.at(-1)?.subscribers||0,language:v.language,region:v.region,medianViews:1,health:0,tags:[],owner:'未分配',lastSync:'刚刚'};
const scoreFor = (v:Video) => getOpportunity(v);

type Toast = {message:string; kind?:'success'|'info'} | null;
type Persisted = { saved:Video[]; collections:Collection[]; ideas:Idea[]; tasks:Task[]; alerts:Alert[]; rules:WatchRule[]; tags:Record<string,string[]> };
type RankingData = {short:Video[];long:Video[];nextPageToken:string|null;loadedCount:number;dataScope:PublicRankingScope|null;emptyMessage:string|null};
const defaultState:Persisted={saved:[],collections:initialCollections,ideas:initialIdeas,tasks:initialTasks,alerts:initialAlerts,rules:watchRules,tags:{}};
const EMPTY_VIDEO_LIST:Video[]=[];
const categoryOptions=[['all','全部类别'],['1','影视动画'],['2','汽车'],['15','宠物动物'],['17','体育'],['19','旅行'],['20','游戏'],['22','人物生活'],['23','喜剧'],['24','娱乐'],['25','新闻政治'],['26','生活技巧'],['27','教育'],['28','科技'],['29','公益']];
const categoryLabel=(value:string)=>categoryOptions.find(([id])=>id===value)?.[1];
const matchesContentScope=(video:Video,filters:ReturnType<typeof parseFilters>)=>video.topic!=='音乐'&&!video.tags.includes('儿童内容')&&(filters.category==='all'||video.topic===categoryLabel(filters.category));
const matchesRankingScope=(video:Video,filters:ReturnType<typeof parseFilters>)=>{
  const subscribers=channelFor(video).subscribers;
  const views=video.snapshots.at(-1)?.views||0;
  const maxSubscribers=filters.maxSubs==='all'?Number.POSITIVE_INFINITY:Number(filters.maxSubs);
  const maxViews=filters.maxViews==='all'?Number.POSITIVE_INFINITY:Number(filters.maxViews);
  return matchesContentScope(video,filters)
    && (filters.language==='all'||video.language===filters.language)
    && subscribers>=Number(filters.minSubs) && subscribers<=maxSubscribers
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

function usePersisted(){
  const [state,setState]=useState<Persisted>(()=>{if(typeof window==='undefined')return defaultState;const raw=localStorage.getItem('signalcraft-workspace-v2');try{const saved=raw?JSON.parse(raw):null;return {...defaultState,...saved,saved:Array.isArray(saved?.saved)?saved.saved.filter(isLivePublicVideo):[]}}catch{return defaultState}});
  useEffect(()=>{localStorage.setItem('signalcraft-workspace-v2',JSON.stringify(state))},[state]);
  return [state,setState] as const;
}

function navigate(path:string){ window.history.pushState({},'',path); window.dispatchEvent(new Event('signalcraft:navigate')); window.scrollTo({top:0,behavior:'smooth'}); }
function Sparkline({video}:{video:Video}){const data=video.snapshots.map(s=>s.views);const max=Math.max(...data),min=Math.min(...data);const pts=data.map((n,i)=>`${i*33},${30-((n-min)/(max-min||1))*25}`).join(' ');return <svg className="spark" viewBox="0 0 100 34" aria-label="播放量增长曲线"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>}
function ScorePill({value}:{value:number}){return <span className={cn('score',value>=80?'excellent':value>=65?'good':'watch')}>{value}<small>/100</small></span>}
function Empty({title,body,action}:{title:string;body:string;action?:React.ReactNode}){return <div className="empty"><div className="empty-icon">◇</div><b>{title}</b><p>{body}</p>{action}</div>}

function Header({path,onTheme,account,onSignIn,onSignOut,locale,onLocaleChange,isOwner}:{path:string;onTheme:()=>void;account:AccountSession|null;onSignIn:()=>void;onSignOut:()=>void;locale:UiLocale;onLocaleChange:(locale:UiLocale)=>void;isOwner:boolean}){
  const isApp=path.startsWith('/app');
  const copy=languageCopy[locale];
  const publicItems=[['/discover',copy.nav[0]],['/rankings',copy.nav[1]],['/radar',copy.nav[2]],['/doctor',copy.nav[3]],['/pricing',copy.nav[4]]];
  const appItems=[['/app',copy.studioNav[0]],['/app/research',copy.studioNav[1]],['/app/ideas',copy.studioNav[2]]];
  const items=isApp?appItems:publicItems;
  return <><header className="site-header"><button className="brand" onClick={()=>navigate('/')} aria-label={copy.backHome}><span className="brand-glyph">SC</span><span>{BRAND}<small>CONTENT INTELLIGENCE</small></span></button><nav className="site-nav" aria-label={locale==='zh'?'主导航':'Main navigation'}>{items.map(([href,label])=><button key={href} className={path===href?'active':''} aria-current={path===href?'page':undefined} onClick={()=>navigate(href)}>{label}</button>)}</nav><div className="head-actions"><div className="locale-toggle" role="group" aria-label={copy.interfaceLanguage}><button type="button" className={locale==='zh'?'active':''} aria-pressed={locale==='zh'} onClick={()=>onLocaleChange('zh')}>中文</button><button type="button" className={locale==='en'?'active':''} aria-pressed={locale==='en'} onClick={()=>onLocaleChange('en')}>EN</button></div><button className="icon-btn" onClick={onTheme} aria-label={copy.theme}>◐</button><button className="ghost" onClick={()=>navigate(isApp?'/discover':'/app')}>{isApp?copy.publicDiscovery:copy.enterStudio}</button>{isOwner&&<button className="owner-link" onClick={()=>navigate('/owner')}>{locale==='zh'?'站点管理':'Site admin'}</button>}{account?<button className="account-chip" onClick={onSignOut} title={copy.signOut}><span>●</span>{account.email}</button>:<button className="google-login" onClick={onSignIn} title={copy.signInTitle}><span>G</span>{copy.signIn}</button>}</div></header>{isApp&&<StudioNav path={path} locale={locale}/>}</>
}
function StudioNav({path,locale}:{path:string;locale:UiLocale}){const copy=languageCopy[locale];const items=[['/app',locale==='zh'?'概览':'Overview'],['/app/image-to-video',locale==='zh'?'AI 图生视频':'AI image-to-video'],['/app/doctor',copy.nav[3]],['/app/library/channels',locale==='zh'?'竞品频道':'Competitor channels'],['/app/library/videos',locale==='zh'?'收藏研究':'Saved research'],['/app/thumbnails',locale==='zh'?'缩略图研究':'Thumbnail lab'],['/app/research',copy.studioNav[1]],['/app/watchlists',locale==='zh'?'视频警报':'Video alerts'],['/app/benchmarks',locale==='zh'?'竞品对标':'Benchmarking'],['/app/ideas',locale==='zh'?'选题':'Ideas'],['/app/prompts',locale==='zh'?'提示词':'Prompts'],['/app/settings',locale==='zh'?'配置':'Settings']];return <aside className="studio-nav"><p>{locale==='zh'?'工作室':'STUDIO'}</p>{items.map(([href,label])=><button key={href} className={cn(path===href&&'active')} onClick={()=>navigate(href)}>{label}</button>)}</aside>}

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
    <div><span className="eyebrow">{zh?'筛选':'Filters'}</span><h2>{zh?'按规则缩小范围':'Narrow the ranking'}</h2><p>{copy.fixedRule}</p></div>
    <RankingOptionGroup label={zh?'内容形态':'Content format'} value={filters.format} onChange={value=>patch({format:value})} options={[{value:'short',label:zh?'短视频':'Shorts'},{value:'long',label:zh?'长视频':'Long-form'}]}/>
    <RankingOptionGroup label={zh?'榜单维度':'Ranking entity'} value={filters.entity} onChange={value=>patch({entity:value})} options={[{value:'videos',label:zh?'视频':'Videos'},{value:'channels',label:zh?'频道':'Channels'}]}/>
    <RankingOptionGroup label={zh?'时间窗口':'Time window'} value={filters.window} onChange={value=>patch({window:value})} options={[{value:'24h',label:zh?'24小时':'24h'},{value:'7d',label:zh?'7天':'7d'},{value:'28d',label:zh?'28天':'28d'},{value:'365d',label:zh?'样本库':'Corpus'}]}/>
    <RankingBandGroup label={zh?'订阅量区间':'Subscriber range'} value={currentSubscriberBand} onChange={value=>setBand(value,'subscribers')} options={subscriberBands}/>
    <RankingBandGroup label={zh?'播放量区间 · 当前总播放':'View range · current total'} value={currentViewBand} onChange={value=>setBand(value,'views')} options={viewBands}/>
    <RankingOptionGroup label={zh?'展示方式':'Display'} value={filters.display} onChange={value=>patch({display:value})} options={[{value:'list',label:zh?'列表':'List'},{value:'cards',label:zh?'卡片':'Cards'}]}/>
    <details className="ranking-advanced"><summary>{zh?'高级范围':'Advanced scope'}</summary><label>{copy.market}<select value={filters.region} onChange={event=>patch({region:event.target.value})}><option value="all">{localizedMarket('all',locale)}</option>{['US','GB','JP','BR','MX','IN','ID'].map(value=><option key={value} value={value}>{localizedMarket(value,locale)}</option>)}</select></label><label>{copy.category}<select value={filters.category} onChange={event=>patch({category:event.target.value})}>{categoryOptions.map(([value])=><option key={value} value={value}>{localizedCategory(value,locale)}</option>)}</select></label><label>{copy.contentLanguage}<select value={filters.language} onChange={event=>patch({language:event.target.value})}>{['all','英语','西班牙语','葡萄牙语'].map(value=><option key={value} value={value}>{localizedContentLanguage(value,locale)}</option>)}</select></label></details>
    <button type="button" className="ranking-reset" onClick={reset}>{zh?'重置':'Reset'}</button><small>{copy.boundary}</small>
  </aside>
}

function VideoCard({video,state,setState,onDetail}:{video:Video;state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;onDetail:(v:Video)=>void}){
  const o=scoreFor(video),channel=channelFor(video),saved=state.saved.some(item=>item.id===video.id);
  const toggle=()=>setState(s=>({...s,saved:s.saved.some(item=>item.id===video.id)?s.saved.filter(item=>item.id!==video.id):[...s.saved,video]}));
  const watch=()=>video.sourceUrl?window.location.assign(video.sourceUrl):onDetail(video);
  const duration=video.durationSeconds<60?`${video.durationSeconds} 秒`:`${Math.round(video.durationSeconds/60)} 分钟`;
  return <article className="video-card">
    <div className="thumb" role="link" tabIndex={0} onClick={watch} onKeyDown={event=>event.key==='Enter'&&watch()} title="打开并观看此视频" style={{position:'relative',overflow:'hidden',background:'linear-gradient(130deg,#352b2a,#8e3127)',cursor:'pointer'}}>
      {video.thumbnail&&<img src={video.thumbnail} alt={`${video.title} 视频缩略图`} width={480} height={270} loading="lazy" decoding="async" onError={event=>{event.currentTarget.style.display='none'}} style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:1}}/>}
      <div aria-hidden="true" className="thumb-fallback"><b>▶</b><span>{video.topic}</span></div>
      <i aria-hidden="true" style={{position:'absolute',inset:0,zIndex:2,background:'linear-gradient(180deg,rgba(13,13,15,.03) 24%,rgba(13,13,15,.72))',pointerEvents:'none'}}/>
      <span className="video-format" style={{position:'relative',zIndex:3}}>{video.format==='short'?'短视频':'长视频'} · {duration}</span><span style={{position:'relative',zIndex:3}}><ScorePill value={o.opportunityScore}/></span>
    </div>
    <div className="card-body"><div className="eyebrow">{video.topic} · {video.language} / {video.region}</div><button className="video-title" onClick={watch}>{video.title}</button><p className="channel-line">{channel.title} · {num.format(channel.subscribers)} 订阅</p>
      <div className="metric-row"><b>{num.format(video.snapshots.at(-1)!.views)}<small>播放</small></b><b className="up">{num.format(o.viewsPerHour)}<small>平均播放 / 小时</small></b><Sparkline video={video}/></div>
      <div className="evidence-strip"><span>公开数据</span><span>单次快照</span><b>{o.viewsPerSubscriber}× 播放 / 订阅</b></div>
      <div className="card-actions"><button onClick={toggle} aria-pressed={saved}>{saved?'已收藏':'收藏研究'}</button><button onClick={()=>onDetail(video)}>查看证据</button>{video.sourceUrl&&<button onClick={watch}>原视频 ↗</button>}</div>
    </div>
  </article>
}

function DetailDrawer({video,state,setState,onClose,toast}:{video:Video;state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;onClose:()=>void;toast:(t:string)=>void}){const o=scoreFor(video),channel=channelFor(video);const addIdea=()=>{const exists=state.ideas.some(i=>i.sourceVideoId===video.id);if(!exists)setState(s=>({...s,ideas:[...s.ideas,{id:`i${Date.now()}`,title:`拆解：${video.title.slice(0,24)}`,sourceVideoId:video.id,angle:'从异常表现中提取可验证的钩子',audience:'目标赛道的内容消费者',hypothesis:'明确收益 + 具体数字会提升点击',owner:'当前用户',status:'收集',note:'来自 SignalCraft 证据链',createdAt:new Date().toISOString()}]}));toast(exists?'该视频已有选题卡':'已创建选题卡，来源证据已带入');};const addBenchmark=()=>{setState(s=>{const first=s.collections[0];return {...s,collections:first?s.collections.map((c,i)=>i===0?{...c,items:[...new Set([...c.items,video.id])]}:c):[{id:`c${Date.now()}`,name:'未命名对标组',type:'对标组',color:'#ff3b30',items:[video.id],shared:false}]}});toast('已加入对标组');};const openDoctor=()=>{if(!channel.url){toast('该视频没有可用的公开频道链接，暂不能自动诊断。');return}navigate(`/doctor?channel=${encodeURIComponent(channel.url)}`)};return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="drawer" role="dialog" aria-modal="true" aria-label="视频证据详情" onMouseDown={e=>e.stopPropagation()}><button className="close" onClick={onClose}>×</button><div className="eyebrow">证据链 · {video.topic}</div><h2>{video.title}</h2><p className="channel-line">{channel.title} · 发布 {date(video.publishedAt)} · {video.risk==='low'?'低风险':'需复核风险'}</p><div className="score-hero"><ScorePill value={o.opportunityScore}/><div><b>机会评分</b><p>不是 AI 真相，而是基于公开样本的可复算信号。</p></div></div><div className="explain-grid"><div><span>VelocityScore</span><b>{o.velocityScore}</b><small>发布至今的平均播放速度</small></div><div><span>RelativeSignal</span><b>{o.outlierScore}</b><small>播放 / 订阅代理，不等同历史 outlier</small></div><div><span>Confidence</span><b>{o.confidence}%</b><small>{video.snapshots.length} 个时间采样</small></div><div><span>相对表现</span><b>{o.viewsPerSubscriber}×</b><small>播放 / 频道订阅</small></div></div><section className="evidence"><h3>为什么值得看</h3>{o.reasons.map(r=><p key={r}>✓ {r}</p>)}<p>✓ 当前快照的平均播放速度为 {num.format(o.viewsPerHour)} / 小时；需要同频道的多条历史视频后，才会给出真实历史 outlier 结论。</p></section><section className="evidence"><h3>相似样本</h3><p>需要对公开视频持续采样后，才会给出相似表现判断。</p></section><div className="drawer-actions"><button className="primary" onClick={addIdea}>创建选题</button><button onClick={addBenchmark}>加入对标组</button><button onClick={openDoctor}>频道诊断</button><button onClick={()=>navigate('/app/watchlists')}>设置监听</button><button onClick={()=>navigator.clipboard?.writeText(video.sourceUrl||`https://youtube.com/watch?v=${video.id}`).then(()=>toast('链接已复制'))}>复制链接</button></div></aside></div>}

function RankingBoard({longRows,shortRows,selectedFormat,filters,onDetail,locale,loadedCount,canLoadMore,loadingMore,onLoadMore,emptyMessage}:{longRows:Video[];shortRows:Video[];selectedFormat:'all'|'short'|'long';filters:ReturnType<typeof parseFilters>;onDetail:(v:Video)=>void;locale:UiLocale;loadedCount:number;canLoadMore:boolean;loadingMore:boolean;onLoadMore:()=>void;emptyMessage:string|null}){
  const view=filters.entity==='channels'?'channels':'videos';
  const [rankBy,setRankBy]=useState<'views'|'relative'|'growth'>('views');
  const copy=languageCopy[locale].ranking;
  const scopedRows=useMemo(()=>[...longRows,...shortRows]
    .filter((video,index,all)=>all.findIndex(item=>item.sourceUrl===video.sourceUrl)===index)
    .filter(video=>selectedFormat==='all'||video.format===selectedFormat)
    .filter(video=>matchesRankingScope(video,filters)),[longRows,shortRows,selectedFormat,filters]);
  const hasComparableGrowth=useMemo(()=>scopedRows.some(video=>Boolean(getRecordedGrowth(video))),[scopedRows]);
  const activeRankBy=rankBy==='growth'&&!hasComparableGrowth?'views':rankBy;
  const videos=useMemo(()=>[...scopedRows].sort((a,b)=>{
    if(activeRankBy==='views')return b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views;
    if(activeRankBy==='relative')return scoreFor(b).viewsPerSubscriber-scoreFor(a).viewsPerSubscriber;
    return (getRecordedGrowth(b)?.viewsPerHour||-1)-(getRecordedGrowth(a)?.viewsPerHour||-1)
      || b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views;
  }),[scopedRows,activeRankBy]);
  const channelRows=useMemo(()=>Object.values(videos.reduce<Record<string,{channel:ReturnType<typeof channelFor>;videos:Video[];views:number}>>((acc,video)=>{const channel=channelFor(video);const item=acc[channel.id]||{channel,videos:[],views:0};item.videos.push(video);item.views+=video.snapshots.at(-1)!.views;acc[channel.id]=item;return acc},{})).sort((a,b)=>b.views-a.views),[videos]);
  const rankingTitle=activeRankBy==='views'?copy.videoTop:activeRankBy==='relative'?copy.relativeTop:copy.growthTop;
  const rankingBody=activeRankBy==='views'?copy.videoTopBody:activeRankBy==='relative'?copy.relativeTopBody:copy.growthTopBody;
  const rankingBoundary=activeRankBy==='views'?copy.absoluteBoundary:activeRankBy==='relative'?copy.relativeBoundary:copy.growthBoundary;
  const renderVideos=()=>videos.length?videos.map((video,index)=>{const score=scoreFor(video),channel=channelFor(video),growth=getRecordedGrowth(video);const watch=()=>video.sourceUrl?window.location.assign(video.sourceUrl):onDetail(video);return <button className="ranking-row" key={video.id} onClick={watch} title={locale==='zh'?'打开并观看此视频':'Open this video on YouTube'}><span className={cn('ranking-position',index<3&&'top')}>{String(index+1).padStart(2,'0')}</span><span className="ranking-thumb">{video.thumbnail&&<img src={video.thumbnail} alt="" width={160} height={90} loading="lazy" decoding="async"/>}<em>{video.format==='short'?(locale==='zh'?'短':'Short'):(locale==='zh'?'长':'Long')}</em></span><span className="ranking-title"><b>{video.title}</b><small>{channel.title} · {localizedTopic(video.topic,locale)} · {formatCompactNumber(channel.subscribers,locale)} {locale==='zh'?'订阅':'subs'}</small></span><span className="ranking-stat"><b>{formatCompactNumber(video.snapshots.at(-1)!.views,locale)}</b><small>{copy.views}</small></span><span className="ranking-stat velocity"><b>{score.viewsPerSubscriber}×</b><small>{copy.viewsPerSubscriber}</small></span><span className="ranking-stat growth"><b>{growth?`+${formatCompactNumber(growth.views,locale)}`:'—'}</b><small>{growth?interpolate(copy.growthOverHours,{hours:Math.round(growth.hours)}):copy.growthUnavailable}</small></span><span className="ranking-open">{copy.research}</span></button>}):<div className="ranking-empty">{emptyMessage||copy.noVideos}</div>;
  const renderCards=()=>videos.length?<div className="ranking-card-grid">{videos.map((video,index)=>{const channel=channelFor(video),growth=getRecordedGrowth(video);const watch=()=>video.sourceUrl?window.location.assign(video.sourceUrl):onDetail(video);return <button className="ranking-video-card" key={video.id} onClick={watch} title={locale==='zh'?'打开并观看此视频':'Open this video on YouTube'}><span className="ranking-card-image">{video.thumbnail&&<img src={video.thumbnail} alt="" width={480} height={270} loading={index<3?'eager':'lazy'} fetchPriority={index<3?'high':'auto'} decoding="async"/>}<b>#{index+1}</b><em>{video.format==='short'?(locale==='zh'?'短':'Short'):(locale==='zh'?'长':'Long')}</em></span><span><strong>{video.title}</strong><small>{channel.title} · {localizedTopic(video.topic,locale)}</small><b>{formatCompactNumber(video.snapshots.at(-1)!.views,locale)} <i>{copy.views}</i>{growth&&<em>{` +${formatCompactNumber(growth.views,locale)}`}</em>}</b></span></button>})}</div>:<div className="ranking-empty">{emptyMessage||copy.noVideos}</div>;
  const renderChannels=()=>channelRows.length?channelRows.map((item,index)=><button className="ranking-row channel-ranking-row" key={item.channel.id} onClick={()=>onDetail(item.videos[0])} title={interpolate(copy.channelTitle,{channel:item.channel.title})}><span className={cn('ranking-position',index<3&&'top')}>{String(index+1).padStart(2,'0')}</span><span className="channel-rank-mark">{item.channel.title.slice(0,1).toUpperCase()}</span><span className="ranking-title"><b>{item.channel.title}</b><small>{interpolate(copy.channelSamples,{count:item.videos.length,subs:formatCompactNumber(item.channel.subscribers,locale)})}</small></span><span className="ranking-stat"><b>{formatCompactNumber(item.views,locale)}</b><small>{copy.accumulatedViews}</small></span><span className="ranking-stat velocity"><b>{formatCompactNumber(Math.round(item.views/item.videos.length),locale)}</b><small>{copy.averageViews}</small></span><span className="channel-sample-count">{item.videos.length} {copy.samples}</span><span className="ranking-open">{copy.viewSamples}</span></button>):<div className="ranking-empty">{emptyMessage||copy.noChannels}</div>;
  return <section className="ranking-section top-100"><div className="ranking-section-head"><div><span className="eyebrow">{copy.corpus}</span><h2>{view==='videos'?rankingTitle:copy.channelTop}</h2><p>{view==='videos'?rankingBody:copy.channelTopBody}</p></div><b>{view==='videos'?videos.length:channelRows.length}<small>/{loadedCount}</small></b></div>{view==='videos'&&<div className="ranking-lens" aria-label={copy.rankMethod}><span>{copy.lens}</span><button type="button" className={activeRankBy==='views'?'active':''} aria-pressed={activeRankBy==='views'} onClick={()=>setRankBy('views')}>{copy.absolute}</button><button type="button" className={activeRankBy==='relative'?'active':''} aria-pressed={activeRankBy==='relative'} onClick={()=>setRankBy('relative')}>{copy.relative}</button><button type="button" className={activeRankBy==='growth'?'active':''} aria-pressed={activeRankBy==='growth'} disabled={!hasComparableGrowth} title={!hasComparableGrowth?copy.growthUnavailable:undefined} onClick={()=>setRankBy('growth')}>{copy.growth}</button><small>{rankingBoundary}</small></div>}<div className={filters.display==='cards'?'ranking-card-wrap':'ranking-list'}>{view==='videos'?(filters.display==='cards'?renderCards():renderVideos()):renderChannels()}</div><div className="ranking-load-more"><span>{locale==='zh'?`已加载 ${loadedCount} 条真实公开视频`:`${loadedCount} live public videos loaded`}</span>{canLoadMore?<button onClick={onLoadMore} disabled={loadingMore}>{loadingMore?(locale==='zh'?'正在加载下一页…':'Loading next page…'):(locale==='zh'?'加载更多':'Load more')}</button>:<small>{locale==='zh'?'当前筛选范围已无更多公开结果':'No more public results for this scope'}</small>}</div></section>
}

function Discovery({mode,state,setState,openDetail,locale}:{mode:'discover'|'rankings'|'radar'|'research';state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){
  const [filters,setFilters]=useState(()=>{const hasQuery=typeof window!=='undefined'&&Boolean(location.search);const hasMarketFilter=typeof window!=='undefined'&&new URLSearchParams(location.search).has('region');const selected=typeof window==='undefined'?parseFilters(''):parseFilters(location.search);if(mode==='rankings')return {...selected,q:'',format:hasQuery&&selected.format!=='all'?selected.format:'short',window:hasQuery?selected.window:'28d',region:hasMarketFilter?selected.region:'all',maxSubs:hasQuery?selected.maxSubs:'all',minSubs:hasQuery?selected.minSubs:'0',minViews:hasQuery?selected.minViews:'0',maxViews:hasQuery?selected.maxViews:'all',entity:hasQuery?selected.entity:'videos',display:hasQuery?selected.display:'list',minScore:'0'};if(mode==='discover'||mode==='radar')return {...selected,q:''};return selected});
  const [page,setPage]=useState(1);
  const [remote,setRemote]=useState<Video[]|null>(null);
  const [rankingData,setRankingData]=useState<RankingData|null>(null);
  const [loading,setLoading]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [error,setError]=useState('');
  const [radarView,setRadarView]=useState<'velocity'|'new'|'breakout'|'repeatable'>('velocity');
  // Discover and Radar are real-data surfaces. Never silently replace a
  // failed API response with attractive demo cards, otherwise users cannot
  // tell that the current YouTube quota has no usable samples.
  const source=remote??EMPTY_VIDEO_LIST;
  const runSearch=useCallback(async()=>{
    if(mode==='research'&&!filters.q.trim()){setRemote(null);setError('请输入一个赛道关键词，例如 AI productivity。');return;}
    setLoading(true);setError('');
    try{
      const selectedFormat=filters.format==='short'||filters.format==='long'?filters.format:undefined;
      const result=await searchYouTubeSignals({query:mode==='research'?filters.q:'',language:filters.language,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,ranking:mode!=='research'});
      result.channels.forEach(channel=>{const index=channels.findIndex(item=>item.id===channel.id);if(index>=0)Object.assign(channels[index],channel);else channels.push(channel)});
      setRemote(result.videos);setPage(1);
    }catch(reason){setError(reason instanceof Error?reason.message:'YouTube 公开数据暂时无法读取。');}
    finally{setLoading(false);}
  },[mode,filters.q,filters.language,filters.region,filters.window,filters.maxSubs,filters.minViews,filters.format,filters.category]);
  const runRankingSearch=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const selectedFormat=filters.format==='short'||filters.format==='long'?filters.format:undefined;
      const result=await searchYouTubeSignals({query:'',language:filters.language,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,ranking:true,limit:50});
      const fetched=mergeRankingVideos([],result.videos);
      result.channels.forEach(channel=>{const index=channels.findIndex(item=>item.id===channel.id);if(index>=0)Object.assign(channels[index],channel);else channels.push(channel)});
      setRankingData({short:fetched.filter(video=>video.format==='short'),long:fetched.filter(video=>video.format==='long'),nextPageToken:result.nextPageToken,loadedCount:fetched.length,dataScope:result.dataScope,emptyMessage:result.noCandidatesMessage});setRemote(null);setPage(1);
    }catch(reason){setRankingData(null);setError(reason instanceof Error?reason.message:'YouTube 公开数据暂时无法读取。');}
    finally{setLoading(false);}
  },[filters.language,filters.region,filters.window,filters.maxSubs,filters.minViews,filters.format,filters.category]);
  const loadMoreRanking=async()=>{
    const pageToken=rankingData?.nextPageToken;
    if(!pageToken||loadingMore)return;
    setLoadingMore(true);setError('');
    try{
      const selectedFormat=filters.format==='short'||filters.format==='long'?filters.format:undefined;
      const result=await searchYouTubeSignals({query:'',language:filters.language,region:filters.region,window:filters.window,maxSubscribers:filters.maxSubs,minimumViews:filters.minViews,format:selectedFormat,category:filters.category,ranking:true,limit:50,pageToken});
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
    return matchesQuery&&matchesContentScope(v,filters)&&(filters.language==='all'||v.language===filters.language)&&(filters.format==='all'||v.format===filters.format)&&(filters.maxSubs==='all'||c.subscribers<=Number(filters.maxSubs))&&o.opportunityScore>=Number(filters.minScore);
  }).sort((a,b)=>mode==='rankings'?b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views:scoreFor(b).opportunityScore-scoreFor(a).opportunityScore),[filters,mode,remote,source]);
  const rankingLongRows=rankingData?.long||rows.filter(video=>video.format==='long');
  const rankingShortRows=rankingData?.short||rows.filter(video=>video.format==='short');
  const resultCount=mode==='rankings'?rankingLongRows.length+rankingShortRows.length:rows.length;
  const radarRows=useMemo(()=>{const ageHours=(video:Video)=>{const capturedAt=video.snapshots.at(-1)?.capturedAt||video.publishedAt;return Math.max(1,(new Date(capturedAt).getTime()-new Date(video.publishedAt).getTime())/3600000)};const byVelocity=(a:Video,b:Video)=>scoreFor(b).viewsPerHour-scoreFor(a).viewsPerHour;const byNewest=(a:Video,b:Video)=>new Date(b.publishedAt).getTime()-new Date(a.publishedAt).getTime();if(radarView==='new')return rows.filter(video=>ageHours(video)<=72).sort(byNewest);if(radarView==='breakout')return rows.filter(video=>channelFor(video).subscribers<=100000&&scoreFor(video).viewsPerSubscriber>=1).sort((a,b)=>scoreFor(b).viewsPerSubscriber-scoreFor(a).viewsPerSubscriber);if(radarView==='repeatable')return rows.filter(video=>video.format==='long'&&video.durationSeconds>=180&&video.durationSeconds<=1800).sort((a,b)=>scoreFor(b).opportunityScore-scoreFor(a).opportunityScore);return [...rows].sort(byVelocity)},[radarView,rows]);
  if(mode==='radar'){const clusters=Object.entries(radarRows.reduce<Record<string,Video[]>>((acc,video)=>{(acc[video.topic]??=[]).push(video);return acc},{}));const radarCopy={velocity:['加速中','按发布至今的平均播放速度排序；单次快照不能证明实时加速。'],new:['新出现','只展示最近 72 小时发布的公开样本。'],breakout:['低粉爆发','订阅不超过 10 万且播放 / 订阅 ≥ 1 的样本。'],repeatable:['可复刻形式','优先展示 3–30 分钟、便于拆解结构的长视频；仍需人工复核。']} as const;return <main className="page"><PageIntro label="机会雷达" title="把公开信号变成可观看、可行动的样本" body="无需关键词，按时间、语言、频道规模和内容形态读取已采集的 YouTube 公开视频；点击缩略图或标题可直接打开原视频。"/><Filters filters={filters} setFilters={setFilters} hideKeyword/><div className="result-toolbar"><span>当前视图找到 <b>{radarRows.length}</b> 个公开样本</span><span>{remote?'已采集 YouTube 公开数据 · 每日快照':'正在加载公开视频'}</span><button className="primary" onClick={runSearch} disabled={loading}>{loading?'正在更新…':'更新机会雷达'}</button></div>{error&&<p className="api-error">{error}</p>}{remote&&<p className="api-note">筛选项改变时会从已采集样本池重新筛选；缩略图由服务端代理，点击缩略图或标题会直接打开对应 YouTube 视频。</p>}<div className="radar-tabs" role="tablist" aria-label="机会雷达视图">{(['velocity','new','breakout','repeatable'] as const).map(view=><button key={view} role="tab" aria-selected={radarView===view} className={radarView===view?'active':''} onClick={()=>setRadarView(view)}>{radarCopy[view][0]}</button>)}</div><p className="api-note">{radarCopy[radarView][1]}</p><div className="cluster-list">{clusters.length?clusters.map(([topic,items])=>{const average=Math.round(items.reduce((sum,video)=>sum+scoreFor(video).opportunityScore,0)/items.length);return <section className="cluster" key={topic}><div className="cluster-head"><div><span className="eyebrow">机会簇</span><h2>{topic||'公开视频机会簇'}</h2><p>{items.length} 个样本 · 平均机会评分 {average}</p></div><ScorePill value={average}/></div><div className="mini-grid">{items.slice(0,6).map(video=><VideoCard key={video.id} video={video} state={state} setState={setState} onDetail={openDetail}/>)}</div></section>}):<Empty title="当前视图没有符合条件的公开视频" body="可切换雷达视图、扩大时间窗口、切换内容形态或放宽频道订阅上限后自动重新取样。"/>}</div></main>}
  if(mode==='rankings'){const selectedFormat=filters.format==='short'||filters.format==='long'?filters.format:'all';const scopedVideos=[...rankingLongRows,...rankingShortRows].filter(video=>matchesRankingScope(video,filters)).filter(video=>selectedFormat==='all'||video.format===selectedFormat);const scopedCount=filters.entity==='channels'?new Set(scopedVideos.map(video=>video.channelId)).size:scopedVideos.length;const copy=languageCopy[locale].ranking;const scopeLabel=rankingData?.dataScope?(rankingData.dataScope.source==='stored-corpus'?copy.storedCorpus:copy.liveChart):copy.loadingSamples;return <main className="page rankings-page"><PageIntro label={copy.introLabel} title={copy.introTitle} body={copy.introBody}/><div className="rankings-layout"><RankingFilters filters={filters} setFilters={setFilters} locale={locale}/><div className="rankings-content"><div className="result-toolbar"><span>{copy.found} <b>{scopedCount}</b> {filters.entity==='channels'?(locale==='zh'?'个频道':'channels'):copy.publicSamples}</span><span>{scopeLabel}</span><button className="primary" onClick={runRankingSearch} disabled={loading}>{loading?copy.updating:copy.refresh}</button><button onClick={()=>navigator.clipboard?.writeText(location.href)}>{copy.copyLink}</button></div>{error&&<p className="api-error">{error}</p>}{rankingData?.dataScope&&<RankingDataScope scope={rankingData.dataScope} locale={locale}/>} {rankingData&&<p className="api-note">{copy.note}</p>}<RankingBoard longRows={rankingLongRows} shortRows={rankingShortRows} selectedFormat={selectedFormat} filters={filters} onDetail={openDetail} locale={locale} loadedCount={rankingData?.loadedCount||0} canLoadMore={Boolean(rankingData?.nextPageToken)} loadingMore={loadingMore} onLoadMore={loadMoreRanking} emptyMessage={rankingData?.emptyMessage||null}/></div></div></main>;}
  const isResearch=mode==='research';return <main className={isResearch?'app-page':'page'}><PageIntro label={isResearch?'深度检索':'公开发现'} title={isResearch?'把一个赛道缩小到可验证的公开样本':'自动发现近期值得关注的视频'} body={isResearch?'输入关键词后，按时间、语言、频道规模和内容形态检索真实 YouTube 公开数据。':'无需关键词；按时间、语言、频道规模和内容形态自动筛出真实 YouTube 公开视频。'}/><Filters filters={filters} setFilters={setFilters} hideKeyword={!isResearch}/><div className="result-toolbar"><span>找到 <b>{resultCount}</b> 个样本</span><span>{remote?'真实 YouTube 公开数据 · 单次快照':isResearch?'输入关键词后开始检索':'正在加载公开视频'}</span><button className="primary" onClick={runSearch} disabled={loading}>{loading?(isResearch?'正在检索…':'正在更新…'):(isResearch?'检索公开数据':'更新公开发现')}</button><button onClick={()=>navigator.clipboard?.writeText(location.href)}>复制筛选链接</button></div>{error&&<p className="api-error">{error}</p>}{remote&&<p className="api-note">真实 API 当前返回单次快照：播放/小时表示“发布至今平均播放”，增长趋势与置信度需持续采样后才会更准确。</p>}{rows.length?<div className="video-grid">{rows.slice(0,page*6).map(v=><VideoCard key={v.id} video={v} state={state} setState={setState} onDetail={openDetail}/>)}</div>:<Empty title={isResearch?'输入关键词开始检索':'当前条件没有公开视频样本'} body={isResearch?'例如输入 AI productivity、history documentary 或 fitness tips。':'可扩大时间窗口、切换内容形态或放宽频道订阅上限后自动重新取样。'}/>} {rows.length>page*6&&<button className="load-more" onClick={()=>setPage(p=>p+1)}>加载更多样本</button>}</main>
}

function PageIntro({label,title,body}:{label:string;title:string;body:string}){return <section className="page-intro"><span className="eyebrow">{label}</span><h1>{title}</h1><p>{body}</p></section>}
function Home({locale}:{locale:UiLocale}){const copy=languageCopy[locale].home;return <main><section className="hero"><div><span className="eyebrow">YOUTUBE CONTENT INTELLIGENCE</span><h1>{copy.headline}<em>{copy.headlineEmphasis}</em></h1><p>{copy.body}</p><div className="hero-actions"><button className="primary" onClick={()=>navigate('/discover')}>{copy.dailySignals}</button><button onClick={()=>navigate('/methodology')}>{copy.methodology}</button></div><div className="proof"><span><b>{copy.daily}</b> {copy.snapshot}</span><span><b>4</b> {copy.scoreDimensions}</span><span><b>{locale==='zh'?'多市场':'Multi-market'}</b> {copy.multiMarket}</span></div></div><div className="hero-panel"><div className="panel-top"><span>{copy.dataStatus}</span><span className="live">● {copy.collectionOpen}</span></div><div className="signal-number">{copy.daily}</div><p>{copy.panelBody}</p><div className="hero-list"><button onClick={()=>navigate('/discover')}><span>{copy.openCurrent}</span><b>→</b></button></div></div></section><section className="home-section"><div className="section-heading"><div><span className="eyebrow">TODAY&apos;S SIGNALS</span><h2>{copy.listTitle}</h2></div><button onClick={()=>navigate('/rankings')}>{copy.viewAll}</button></div><div className="home-signal-grid"><button className="signal-row" onClick={()=>navigate('/discover')}><span className="rank">01</span><div><b>{copy.discovery}</b><small>{copy.discoveryBody}</small></div><span>{copy.open}</span></button><button className="signal-row" onClick={()=>navigate('/radar')}><span className="rank">02</span><div><b>{copy.radar}</b><small>{copy.radarBody}</small></div><span>{copy.open}</span></button></div></section><section className="steps"><div><span>01</span><h3>{copy.stepOne}</h3><p>{copy.stepOneBody}</p></div><div><span>02</span><h3>{copy.stepTwo}</h3><p>{copy.stepTwoBody}</p></div><div><span>03</span><h3>{copy.stepThree}</h3><p>{copy.stepThreeBody}</p></div></section><section className="cta-band"><div><span className="eyebrow">FROM SIGNAL TO SHIP</span><h2>{copy.cta}</h2></div><button className="primary" onClick={()=>navigate('/app')}>{copy.studio}</button></section></main>}

function Methodology(){return <main className="page prose"><PageIntro label="方法与边界" title="清晰解释，才能让数据成为判断的辅助。" body="SignalCraft 不把评分伪装成结论；它只是让你更快找到值得验证的公开信号。"/><section><h2>评分如何组成</h2><div className="method-grid"><div><b>VelocityScore</b><p>根据当前公开播放量与发布时间计算平均速度，不等同实时播放。</p></div><div><b>OutlierScore</b><p>播放相对订阅数与频道公开规模的偏离。</p></div><div><b>Confidence</b><p>采样次数与数据完整程度。单次公开快照会明确降低置信度。</p></div><div><b>OpportunityScore</b><p>增速 30%、异常 32%、新鲜度 18%、互动代理 12%、置信度 8%。</p></div></div></section><section><h2>数据与隐私</h2><p>公开发现、排行榜、机会雷达和频道诊断均通过服务端 YouTube Data API 读取当前公开信息；不抓取 YouTube 页面，不在浏览器展示或提交密钥。</p></section><section><h2>局限性</h2><p>单次快照无法证明持续增长。播放表现也不等于商业价值或可复制性；版权、敏感议题、地区文化与算法波动仍需人工复核。</p></section></main>}
function Pricing(){const [selectedPlan,setSelectedPlan]=useState<UpgradePlan|null>(null);const rows=[['公开发现与市场榜单','✓','✓','✓'],['可解释机会评分','—','✓','✓'],['保存、对标与选题工作流','—','✓','✓'],['团队成员、评论与活动记录','—','—','✓'],['自定义监听与 Webhook','—','—','规划中']];const plans:UpgradePlan[]=[{name:'Pro',price:'¥39 / 月',description:'个人创作者的完整研究工作流'},{name:'Team',price:'¥299 / 月',description:'团队协作、对标与监听能力'}];const freePlan={name:'Free' as const,price:'¥0',description:'查看当前 YouTube 公开发现与榜单'};const pricingPlans:(UpgradePlan|typeof freePlan)[]=[freePlan,...plans];return <><main className="page pricing-page"><PageIntro label="定价" title="先证明价值，再决定升级。" body="选择套餐后可扫码联系管理员人工开通。付款与权益由管理员确认，本页不会自动扣费。"/><div className="pricing-grid">{pricingPlans.map(plan=><article className={cn('price-card',plan.name==='Pro'&&'featured')} key={plan.name}><span>{plan.name==='Pro'?'推荐':'计划'}</span><h2>{plan.name}</h2><b>{plan.price}</b><p>{plan.description}</p><button className={plan.name==='Pro'?'primary':''} onClick={()=>plan.name==='Free'?navigate('/app'):setSelectedPlan(plan)}>{plan.name==='Free'?'免费开始':`开通 ${plan.name}`}</button></article>)}</div><div className="manual-activation-note"><span>WECHAT · MANUAL ACTIVATION</span><p>游客可先选套餐扫码咨询；登录用户会自动带入当前账号邮箱，管理员即可人工开通对应权益。</p></div><div className="feature-table"><div className="feature-row heading"><b>功能</b><b>Free</b><b>Pro</b><b>Team</b></div>{rows.map(r=><div className="feature-row" key={r[0]}>{r.map((x,i)=><span key={i}>{x}</span>)}</div>)}</div></main>{selectedPlan&&<UpgradeModal plan={selectedPlan} onClose={()=>setSelectedPlan(null)}/>}</>}

function AppHome({state,setState,openDetail}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void}){const high=state.saved.filter(v=>scoreFor(v).opportunityScore>=80).slice(0,3);return <main className="app-page"><PageIntro label="今日指挥台" title="先处理已保存的真实信号，再推进内容决策。" body="公开发现数据来自 YouTube Data API；你的保存、任务与选题仅保存在当前设备，尚未启用跨设备同步。"/><div className="command-grid"><section className="command-main"><div className="section-heading"><h2>待处理信号</h2><button onClick={()=>navigate('/discover')}>进入发现页 →</button></div>{high.length?high.map(v=><button className="alert-card" key={v.id} onClick={()=>openDetail(v)}><ScorePill value={scoreFor(v).opportunityScore}/><div><b>{v.title}</b><p>{scoreFor(v).reasons[0]}</p></div><span>查看 →</span></button>):<Empty title="还没有已保存的高分信号" body="先在公开发现或机会雷达中保存真实公开视频。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实样本</button>}/>}</section><section className="command-side"><h2>数据状态</h2><div className="sync"><span>●</span><b>YouTube Data API</b><small>公开发现、排行榜、雷达与频道诊断已连接</small></div><button className="primary full" onClick={()=>navigate('/discover')}>刷新公开发现</button></section></div><div className="dashboard-grid"><section><div className="section-heading"><h2>任务清单</h2><button onClick={()=>setState(s=>({...s,tasks:[...s.tasks,{id:`t${Date.now()}`,title:'新建内容验证任务',status:'待办',owner:'当前用户',due:'待设置'}]}))}>+ 新建</button></div>{state.tasks.length?state.tasks.map(t=><button className="task" key={t.id} onClick={()=>setState(s=>({...s,tasks:s.tasks.map(x=>x.id===t.id?{...x,status:x.status==='完成'?'待办':'完成'}:x)}))}><span className={cn('check',t.status==='完成'&&'done')}>✓</span><div><b>{t.title}</b><small>{t.owner} · {t.due}</small></div><em>{t.status}</em></button>):<Empty title="尚无任务" body="创建第一条验证任务，形成从信号到行动的记录。"/>}</section><section><div className="section-heading"><h2>通知中心</h2><button onClick={()=>setState(s=>({...s,alerts:s.alerts.map(a=>({...a,read:true}))}))}>全部已读</button></div>{state.alerts.length?state.alerts.map(a=>{const source=a.sourceVideoId?state.saved.find(v=>v.id===a.sourceVideoId):undefined;return <button className={cn('notification',!a.read&&'unread')} key={a.id} onClick={()=>source&&openDetail(source)}><span>↗</span><div><b>{a.title}</b><small>{a.body}</small></div><time>{date(a.createdAt)}</time></button>}):<Empty title="尚无通知" body="创建监听规则后，真实触发记录会显示在这里。"/>}</section></div></main>}

function Library({kind,state,setState,openDetail}:{kind:'channels'|'videos';state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void}){if(kind==='channels')return <main className="app-page"><PageIntro label="频道资产" title="跟踪值得长期研究的频道。" body="频道资产将在你保存公开视频并建立对标组后逐步沉淀。"/>{state.saved.length?<div className="table-wrap"><table><thead><tr><th>频道</th><th>已保存样本</th><th>订阅</th><th>最近样本</th></tr></thead><tbody>{Array.from(new Map(state.saved.map(v=>[v.channelId,v])).values()).map(v=><tr key={v.channelId}><td><b>{channelFor(v).title}</b><small>{v.channelId}</small></td><td>{state.saved.filter(x=>x.channelId===v.channelId).length}</td><td>{num.format(v.snapshots.at(-1)?.subscribers||0)}</td><td><button onClick={()=>openDetail(v)}>查看真实样本 →</button></td></tr>)}</tbody></table></div>:<Empty title="还没有频道资产" body="保存真实公开视频后，频道会自动出现在这里。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实样本</button>}/>}</main>;return <main className="app-page"><PageIntro label="视频资产" title="保存的信号，才能变成可复用的研究资产。" body="为真实公开视频加标签、写笔记、加入选题或对标组。"/>{state.saved.length?<div className="video-grid">{state.saved.map(v=><VideoCard key={v.id} video={v} state={state} setState={setState} onDetail={openDetail}/>)}</div>:<Empty title="还没有保存视频" body="在公开发现或雷达页面点“保存”，这里会自动出现。" action={<button className="primary" onClick={()=>navigate('/discover')}>去发现真实样本</button>}/>}</main>}
function ThumbnailLab({state,openDetail}:{state:Persisted;openDetail:(v:Video)=>void}){const [query,setQuery]=useState('');const [sort,setSort]=useState<'views'|'relative'>('views');const samples=useMemo(()=>state.saved.filter(video=>`${video.title} ${video.topic} ${video.tags.join(' ')}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>sort==='views'?b.snapshots.at(-1)!.views-a.snapshots.at(-1)!.views:scoreFor(b).viewsPerSubscriber-scoreFor(a).viewsPerSubscriber),[state.saved,query,sort]);return <main className="app-page thumbnail-lab"><PageIntro label="缩略图研究" title="把真实缩略图放进同一张判断桌。" body="从已收藏的公开视频中按标题、赛道和标签筛选缩略图；排序使用公开播放或播放/订阅信号，不把视觉偏好伪装成点击率结论。"/><div className="thumbnail-controls"><label>筛选样本<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜标题、赛道或标签"/></label><div role="tablist" aria-label="缩略图排序"><button role="tab" aria-selected={sort==='views'} className={sort==='views'?'active':''} onClick={()=>setSort('views')}>按播放</button><button role="tab" aria-selected={sort==='relative'} className={sort==='relative'?'active':''} onClick={()=>setSort('relative')}>按低粉高播</button></div><small>{samples.length} 个已收藏的真实缩略图</small></div>{samples.length?<div className="thumbnail-board">{samples.map(video=>{const signal=scoreFor(video),channel=channelFor(video);return <button className="thumbnail-study" key={video.id} onClick={()=>openDetail(video)} title="查看该视频的证据详情"><span className="thumbnail-image">{video.thumbnail?<img src={video.thumbnail} alt={`${video.title} 缩略图`} width={480} height={270} loading="lazy" decoding="async"/>:<i>无公开缩略图</i>}<em>{video.format==='short'?'短':'长'}</em></span><span className="thumbnail-copy"><b>{video.title}</b><small>{channel.title} · {video.topic}</small><span><strong>{num.format(video.snapshots.at(-1)!.views)}</strong> 播放 <strong>{signal.viewsPerSubscriber}×</strong> 播放 / 订阅</span></span></button>})}</div>:<Empty title={state.saved.length?'没有匹配的缩略图样本':'先收藏公开视频，再开始缩略图研究'} body={state.saved.length?'更换关键词或切换排序方式。':'缩略图研究只展示你收藏的真实公开视频，不会填充演示图片。'} action={!state.saved.length?<button className="primary" onClick={()=>navigate('/discover')}>去发现真实样本</button>:undefined}/>}<section className="thumbnail-boundary"><b>下一步：图像相似度检索</b><p>以图片或 URL 搜索相似缩略图，需要单独接入视觉模型与向量索引；在此之前，当前研究板只呈现可验证的真实样本。</p></section></main>}

function Research({state,setState,openDetail,locale}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;openDetail:(v:Video)=>void;locale:UiLocale}){return <Discovery mode="research" state={state} setState={setState} openDetail={openDetail} locale={locale}/>}
function Watchlists({state,setState,toast}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>;toast:(t:string)=>void}){return <main className="app-page"><PageIntro label="视频警报" title="让值得研究的异常自己来找你。" body="为关键词、频道或赛道设置最低信号分数与检查频率。规则会保存在当前设备；后台检测和邮件、Webhook 会在账户数据库接入后启用。"/>{state.rules.length?<div className="watch-grid">{state.rules.map(rule=><article className="watch-card" key={rule.id}><div><span className="tag">{rule.type}</span><h2>{rule.name}</h2><p>{rule.frequency} · 信号评分 ≥ {rule.threshold} · {rule.channel}</p></div><label className="toggle"><input type="checkbox" checked={!rule.paused} onChange={()=>setState(s=>({...s,rules:s.rules.map(r=>r.id===rule.id?{...r,paused:!r.paused}:r)}))}/><span /></label></article>)}</div>:<Empty title="还没有视频警报" body="创建规则后会保存在当前设备，等待服务器定时检测接入。"/>}<div className="inline-form"><input placeholder="例如：英语 AI 效率低粉爆发" id="ruleName"/><select id="ruleType"><option>关键词</option><option>频道</option><option>赛道</option></select><select id="ruleThreshold" defaultValue="75"><option value="65">信号 ≥ 65</option><option value="75">信号 ≥ 75</option><option value="85">信号 ≥ 85</option></select><select id="ruleFrequency" defaultValue="每 6 小时"><option>每 6 小时</option><option>每天一次</option><option>每周一次</option></select><button className="primary" onClick={()=>{const input=document.getElementById('ruleName') as HTMLInputElement;const type=document.getElementById('ruleType') as HTMLSelectElement;const threshold=document.getElementById('ruleThreshold') as HTMLSelectElement;const frequency=document.getElementById('ruleFrequency') as HTMLSelectElement;if(!input.value.trim())return toast('请先填写规则名称');setState(s=>({...s,rules:[...s.rules,{id:`w${Date.now()}`,name:input.value,type:type.value as WatchRule['type'],threshold:Number(threshold.value),frequency:frequency.value,channel:'站内通知',paused:false}]}));input.value='';toast('视频警报已创建')}}>创建警报</button></div></main>}
function Benchmarks({state,toast}:{state:Persisted;toast:(t:string)=>void}){const [compare,setCompare]=useState<string[]>([]);const candidate=state.saved;const selected=compare.map(id=>candidate.find(v=>v.id===id)).filter(Boolean) as Video[];return <main className="app-page"><PageIntro label="竞品与对标" title="把竞品的高表现样本放在同一张研究桌上。" body="收藏频道与视频后，可比较 2–5 个公开样本的播放、相对表现、速度与共同标签；所有结论都能回到原视频。"/>{state.collections.length?<div className="collection-grid">{state.collections.map(c=><article className="collection" key={c.id}><span style={{background:c.color}} /><div><h2>{c.name}</h2><p>{c.items.length} 个项目 · 当前设备</p></div><button onClick={()=>toast('跨设备分享将在账户与数据库接入后开放')}>分享</button></article>)}</div>:<Empty title="还没有竞品对标组" body="在真实视频的证据页点击“加入对标组”即可创建。"/>}<div className="compare-picker"><h2>快速比较</h2><p>选择 2–5 个已收藏的真实视频。</p>{candidate.length?candidate.map(v=><label key={v.id}><input type="checkbox" checked={compare.includes(v.id)} onChange={()=>setCompare(x=>x.includes(v.id)?x.filter(i=>i!==v.id):x.length<5?[...x,v.id]:x)}/>{v.title}</label>):<p>先在发现页收藏至少两个视频。</p>}</div>{selected.length>=2&&<div className="compare-table"><div className="compare-heading"><b>指标</b>{selected.map(v=><b key={v.id}>{v.title.slice(0,14)}…</b>)}</div>{[['机会评分',(v:Video)=>scoreFor(v).opportunityScore],['播放 / 订阅',(v:Video)=>`${scoreFor(v).viewsPerSubscriber}×`],['每小时播放',(v:Video)=>num.format(scoreFor(v).viewsPerHour)],['发布时间',(v:Video)=>date(v.publishedAt)],['共同标签',(v:Video)=>v.tags.slice(0,2).join(' / ')]].map(([label,fn])=><div className="compare-row" key={label as string}><span>{label as string}</span>{selected.map(v=><span key={v.id}>{(fn as (v:Video)=>React.ReactNode)(v)}</span>)}</div>)}</div>}</main>}
function Ideas({state,setState}:{state:Persisted;setState:React.Dispatch<React.SetStateAction<Persisted>>}){const statuses:IdeaStatus[]=['收集','验证','制作中','已发布','复盘'];return <main className="app-page"><PageIntro label="选题实验室" title="从信号到制作，再到复盘。" body="每张选题卡都保留真实来源视频，避免凭感觉断开数据。"/><div className="kanban">{statuses.map(status=><section key={status}><div className="kanban-head"><b>{status}</b><span>{state.ideas.filter(i=>i.status===status).length}</span></div>{state.ideas.filter(i=>i.status===status).map(i=>{const v=state.saved.find(v=>v.id===i.sourceVideoId);return <article className="idea" key={i.id}><span className="tag">来源 {v?scoreFor(v).opportunityScore:'数据已不可用'} </span><h3>{i.title}</h3><p>{i.angle}</p><small>{i.owner} · {date(i.createdAt)}</small><select value={i.status} onChange={e=>setState(s=>({...s,ideas:s.ideas.map(x=>x.id===i.id?{...x,status:e.target.value as IdeaStatus}:x)}))}>{statuses.map(x=><option key={x}>{x}</option>)}</select></article>})}{!state.ideas.some(i=>i.status===status)&&<p className="muted">请从真实视频的证据页创建选题。</p>}</section>)}</div></main>}
function Prompts({toast}:{toast:(t:string)=>void}){return <main className="app-page"><PageIntro label="提示词库" title="把研究方法沉淀成可复用模板。" body="提示词会在真实 AI 接入后带入选题上下文。"/>{promptTemplates.length?<div className="prompt-list">{promptTemplates.map(p=><article key={p.id}><div><span className="tag">{p.category}</span><h2>{p.title}</h2><p>{p.body}</p><small>{p.version} · {p.enabled?'已启用':'已停用'}</small></div><button className="primary" onClick={()=>navigator.clipboard?.writeText(p.body).then(()=>toast('提示词模板已复制'))}>复制模板</button></article>)}</div>:<Empty title="暂无自定义提示词" body="创建与保存提示词需要账户数据库接入，暂不展示预置样本。"/>}</main>}
function Settings(){return <main className="app-page"><PageIntro label="配置" title="为真实服务保留安全边界。" body="敏感密钥仅配置在服务器环境变量中，不会显示在浏览器或保存到当前设备。"/><div className="settings-grid"><section><h2>数据源</h2><p><b>YouTube Data API</b> · 服务端已连接</p><p>公开发现、排行榜、机会雷达与频道诊断均读取当前公开数据。</p></section><section><h2>刷新计划</h2><p>当前为用户打开页面时按需获取公开数据。</p><p>后台定时采样与增长曲线需要数据库和任务队列后启用。</p></section><section><h2>团队成员</h2><p>登录、成员角色与跨设备数据同步需要接入认证和数据库。</p></section><section><h2>通知渠道</h2><p>规则暂存当前设备；邮件、Slack、Webhook 尚未启用。</p></section></div></main>}

export default function SignalCraftApp() {
  const path = useBrowserPath();
  const [theme, setTheme] = useState('light');
  const { account, clearAccount, locale, setLocale } = useBrowserSession();
  const [state, setState] = usePersisted();
  const [drawer, setDrawer] = useState<Video | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [isOwner, setIsOwner] = useState(false);
  const accessToken = account?.accessToken;

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

  const content = path === '/'
    ? <Home locale={locale} />
    : path === '/discover'
      ? <Discovery mode="discover" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
      : path === '/rankings'
        ? <Discovery mode="rankings" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
        : path === '/radar'
          ? <Discovery mode="radar" state={state} setState={setState} openDetail={setDrawer} locale={locale} />
          : path === '/doctor' || path === '/app/doctor'
            ? <ChannelDoctor />
            : path === '/methodology'
              ? <Methodology />
              : path === '/pricing'
                ? <Pricing />
                : path === '/owner'
                  ? <OwnerConsole account={account} onSignIn={beginLogin} />
                  : path === '/app'
                    ? <AppHome state={state} setState={setState} openDetail={setDrawer} />
                    : path === '/app/image-to-video'
                      ? <ImageToVideoStudio account={account} locale={locale} onSignIn={beginLogin} notify={notify} />
                    : path === '/app/library/channels'
                      ? <Library kind="channels" state={state} setState={setState} openDetail={setDrawer} />
                      : path === '/app/library/videos'
                        ? <Library kind="videos" state={state} setState={setState} openDetail={setDrawer} />
                        : path === '/app/thumbnails'
                          ? <ThumbnailLab state={state} openDetail={setDrawer} />
                          : path === '/app/research'
                            ? <Research state={state} setState={setState} openDetail={setDrawer} locale={locale} />
                            : path === '/app/watchlists'
                              ? <Watchlists state={state} setState={setState} toast={notify} />
                              : path === '/app/benchmarks' || path === '/app/compare'
                                ? <Benchmarks state={state} toast={notify} />
                                : path === '/app/ideas'
                                  ? <Ideas state={state} setState={setState} />
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
    {content}
    {drawer && <DetailDrawer video={drawer} state={state} setState={setState} onClose={() => setDrawer(null)} toast={notify} />}
    {toast && <div className="toast" aria-live="polite">✓ {toast.message}</div>}
  </div>;
}

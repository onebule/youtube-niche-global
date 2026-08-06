import { calculateSignal } from './scoring.mjs';
import type { Alert, Channel, Collection, DataProvider, Idea, Opportunity, PromptTemplate, Task, Video, VideoSnapshot, WatchRule } from './types';

const now = new Date('2026-08-06T10:00:00+08:00');
const ago = (hours:number) => new Date(now.getTime() - hours * 3600000).toISOString();
const snapshot = (views:number, likes:number, comments:number, subscribers:number, ageHours:number):VideoSnapshot[] => [
  { capturedAt:ago(ageHours), views:Math.round(views*.18), likes:Math.round(likes*.18), comments:Math.round(comments*.18), subscribers },
  { capturedAt:ago(Math.max(12, ageHours*.45)), views:Math.round(views*.54), likes:Math.round(likes*.54), comments:Math.round(comments*.54), subscribers },
  { capturedAt:ago(6), views:Math.round(views*.84), likes:Math.round(likes*.84), comments:Math.round(comments*.84), subscribers },
  { capturedAt:ago(0), views, likes, comments, subscribers }
];

export const channels:Channel[] = [
  {id:'c1',title:'Crafted AI',handle:'@craftedai',subscribers:42000,language:'英语',region:'美国',medianViews:18000,health:86,tags:['AI','工具'],owner:'林语',lastSync:'8 分钟前'},
  {id:'c2',title:'Loop Kitchen',handle:'@loopkitchen',subscribers:68000,language:'英语',region:'美国',medianViews:24000,health:79,tags:['料理','Shorts'],owner:'Alex',lastSync:'12 分钟前'},
  {id:'c3',title:'Casa en 10',handle:'@casaen10',subscribers:19000,language:'西班牙语',region:'墨西哥',medianViews:9000,health:91,tags:['家居','DIY'],owner:'陈帆',lastSync:'18 分钟前'},
  {id:'c4',title:'Move Small',handle:'@movesmall',subscribers:88000,language:'英语',region:'英国',medianViews:31000,health:74,tags:['健身'],owner:'林语',lastSync:'25 分钟前'},
  {id:'c5',title:'Aha Brasil',handle:'@ahabrasil',subscribers:36000,language:'葡萄牙语',region:'巴西',medianViews:11000,health:88,tags:['冷知识'],owner:'Alex',lastSync:'32 分钟前'},
  {id:'c6',title:'Focus Lab',handle:'@focuslab',subscribers:97000,language:'英语',region:'美国',medianViews:45000,health:72,tags:['效率','学习'],owner:'陈帆',lastSync:'1 小时前'}
];

const rawVideos = [
  ['v1','c1','I replaced 6 AI tabs with one 12-minute workflow','AI 效率','英语','美国','long',42,690000,32100,1488,42000,18,740,'low',['workflow','Claude','productivity']],
  ['v2','c2','The 3-ingredient lunch people are making on repeat','快手料理','英语','美国','short',39,3100000,118000,2980,68000,72,34,'low',['recipe','lunch','quick']],
  ['v3','c3','El truco de organización que cambia una cocina pequeña','家居整理','西班牙语','墨西哥','short',48,870000,40200,1108,19000,28,18,'low',['organización','small space']],
  ['v4','c4','7 minute walking workout for people who hate workouts','轻运动','英语','英国','long',455,1200000,48600,3320,88000,64,42,'low',['walking','beginner']],
  ['v5','c5','Por que seu cérebro ama listas incompletas','冷知识','葡萄牙语','巴西','short',52,2100000,89000,5800,36000,31,15,'medium',['curiosidade','psychology']],
  ['v6','c6','Study with me but every 25 minutes something changes','学习陪伴','英语','美国','long',1440,450000,19800,1240,97000,84,96,'low',['study','focus']],
  ['v7','c1','The email prompt that saved me 4 hours this week','AI 效率','英语','美国','short',46,840000,44100,760,42000,22,51,'low',['email','prompt']],
  ['v8','c3','Una repisa invisible por menos de $10','家居整理','西班牙语','墨西哥','long',505,530000,21800,920,19000,54,106,'medium',['DIY','shelf']],
  ['v9','c2','I made freezer pasta for 5 days in 20 minutes','快手料理','英语','美国','long',620,780000,27100,1670,68000,112,150,'low',['meal prep','pasta']],
  ['v10','c4','Stop stretching your hip flexors like this','轻运动','英语','英国','short',41,1700000,69100,3900,88000,38,29,'medium',['mobility','myth']],
  ['v11','c5','O som que faz você lembrar de tudo','冷知识','葡萄牙语','巴西','short',56,980000,37000,2020,36000,77,58,'low',['memory','sound']],
  ['v12','c6','This is why your to-do list keeps failing','学习陪伴','英语','美国','long',684,390000,13900,870,97000,133,73,'low',['planning','focus']],
  ['v13','c1','A simple AI system for noisy client calls','AI 效率','英语','美国','long',515,290000,11100,640,42000,145,101,'medium',['AI','clients']],
  ['v14','c3','La regla 1 caja para no acumular cosas','家居整理','西班牙语','墨西哥','short',44,440000,19200,588,19000,119,61,'low',['declutter','habit']],
  ['v15','c2','This crispy rice trick makes leftovers feel new','快手料理','英语','美国','short',50,650000,29900,911,68000,140,38,'low',['rice','leftovers']],
  ['v16','c4','The beginner strength test nobody talks about','轻运动','英语','英国','long',740,340000,10200,745,88000,156,92,'medium',['strength','beginner']],
  ['v17','c5','O que acontece quando você para de consumir notícias','冷知识','葡萄牙语','巴西','long',731,270000,9600,1311,36000,178,118,'medium',['news','behavior']],
  ['v18','c6','The 90 second reset before you start work','学习陪伴','英语','美国','short',58,920000,31500,790,97000,161,24,'low',['work','reset']]
] as const;

export const videos:Video[] = rawVideos.map(([id,channelId,title,topic,language,region,format,durationSeconds,views,likes,comments,subscribers,ageHours,seed,risk,tags]) => ({
  id, channelId, title, topic, language, region, format, durationSeconds, thumbnail:`https://images.unsplash.com/photo-${1500000000000 + Number(seed)}?auto=format&fit=crop&w=900&q=70`, publishedAt:ago(Number(ageHours)), risk, tags:[...tags], snapshots:snapshot(Number(views),Number(likes),Number(comments),Number(subscribers),Number(ageHours))
}));

export function getOpportunity(video:Video):Opportunity {
  const channel = channels.find(c=>c.id===video.channelId)!;
  const latest=video.snapshots.at(-1)!;
  const ageHours=Math.max(1,Math.round((now.getTime()-new Date(video.publishedAt).getTime())/3600000));
  const signal=calculateSignal({...latest,subscribers:channel.subscribers,ageHours,sampleCount:video.snapshots.length},{medianViews:channel.medianViews});
  const reasons = [signal.viewsPerSubscriber>8?'播放显著超过频道订阅规模':'频道历史中表现偏强',signal.velocityScore>=70?'近 24 小时增速仍高':'新鲜度仍在有效窗口',video.format==='short'?'短视频形式便于验证开头钩子':'长视频适合拆解叙事结构'];
  return {videoId:video.id,...signal,reasons};
}

export const initialCollections:Collection[]=[{id:'col1',name:'AI 效率工具',type:'对标组',color:'#2dd4bf',items:['v1','v7'],shared:true},{id:'col2',name:'低粉短视频样本',type:'收藏夹',color:'#818cf8',items:['v2','v5'],shared:false}];
export const initialIdeas:Idea[]=[{id:'i1',title:'“一个工作流替代 6 个 AI 标签页”系列',sourceVideoId:'v1',angle:'从信息过载切入，展示可见的前后对比',audience:'独立创作者与小团队',hypothesis:'数字对比 + 具体时长能提高点击',owner:'林语',status:'验证',note:'先测试邮箱处理场景',createdAt:ago(6)}];
export const initialTasks:Task[]=[{id:'t1',title:'拆解 AI 效率样本的前 30 秒',status:'待办',owner:'林语',due:'今天',source:'v1'},{id:'t2',title:'验证葡语冷知识簇的版权风险',status:'进行中',owner:'Alex',due:'明天',source:'v5'}];
export const initialAlerts:Alert[]=[{id:'a1',title:'低粉爆发：Aha Brasil',body:'冷知识短视频 15 小时达到 210 万播放，异常度 92。',createdAt:ago(1),read:false,sourceVideoId:'v5'},{id:'a2',title:'对标组有新信号',body:'AI 效率工具对标组新增 2 个高分样本。',createdAt:ago(4),read:false,sourceVideoId:'v7'}];
export const promptTemplates:PromptTemplate[]=[{id:'p1',title:'信号转选题',category:'选题',version:'v1.2',enabled:true,body:'基于 {{video.title}} 的数据证据，产出 3 个可测试切入角度。'},{id:'p2',title:'缩略图假设检验',category:'包装',version:'v1.0',enabled:true,body:'围绕 {{idea.title}}，提出三种缩略图信息层级。'}];
export const watchRules:WatchRule[]=[{id:'w1',name:'低粉 AI 效率爆发',type:'关键词',threshold:78,frequency:'每 6 小时',channel:'站内通知',paused:false},{id:'w2',name:'Aha Brasil 频道跟踪',type:'频道',threshold:70,frequency:'每日',channel:'邮件（演示）',paused:false}];

export class MockDataProvider implements DataProvider {
  async searchVideos(){ return videos; }
  async getChannel(id:string){ return channels.find(c=>c.id===id); }
  async refreshVideo(id:string){ return videos.find(v=>v.id===id); }
  async getSnapshots(videoId:string){ return videos.find(v=>v.id===videoId)?.snapshots || []; }
  async createWatchRule(rule:Omit<WatchRule,'id'>){ return {...rule,id:`w-${Date.now()}`}; }
}

/** Real implementation boundary. Use YouTube Data API/OAuth only; no HTML scraping. */
export class YouTubeDataProvider implements DataProvider {
  async searchVideos(_filters:Record<string,string>):Promise<Video[]>{ throw new Error('YouTubeDataProvider requires an authorized server-side implementation.'); }
  async getChannel(_id:string):Promise<Channel | undefined>{ throw new Error('Not configured'); }
  async refreshVideo(_id:string):Promise<Video | undefined>{ throw new Error('Not configured'); }
  async getSnapshots(_id:string):Promise<VideoSnapshot[]>{ throw new Error('Not configured'); }
  async createWatchRule(rule:Omit<WatchRule,'id'>){ return {...rule,id:`pending-${Date.now()}`}; }
}

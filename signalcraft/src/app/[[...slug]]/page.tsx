import type { Metadata } from 'next';
import SignalCraftApp from '../signalcraft-app';

const publicMetadata: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'YouTube 内容情报与选题决策平台',
    description: '发现真实 YouTube 趋势、分析频道表现，并把高潜信号沉淀为下一条值得制作的内容。',
  },
  '/discover': {
    title: '发现真实 YouTube 内容信号',
    description: '按赛道、市场和内容形态浏览来自 YouTube 的公开趋势数据。',
  },
  '/rankings': {
    title: 'YouTube 视频与频道排行榜',
    description: '查看近期公开视频和频道的播放表现、增长信号与内容形态。',
  },
  '/radar': {
    title: 'YouTube 长视频趋势雷达',
    description: '识别长视频市场最近出现的新兴、升温、突破、拥挤与回落信号；不替代排行榜或赛道评估。',
  },
  '/radar/all': {
    title: 'YouTube 双形态信号总览',
    description: '并列查看长视频与 Shorts 趋势信号；不同内容形态使用各自的基线、窗口与证据链。',
  },
  '/longform': {
    title: 'YouTube 长视频赛道评估',
    description: '基于公开长视频样本，判断一个方向是否值得长期进入，并查看市场机会、执行适配、证据覆盖与代表视频。',
  },
  '/short-radar': {
    title: 'YouTube Shorts 趋势雷达',
    description: '用独立的 Shorts 趋势雷达查看跨频道扩散、中小频道突破与供给变化；不改变现有短视频榜单。',
  },
  '/shortform-evaluation': {
    title: 'YouTube Shorts 赛道评估',
    description: '承接 Shorts 趋势雷达的公开证据，判断下一轮验证动作；不复用长视频评分或候选池。',
  },
  '/doctor': {
    title: 'YouTube 频道诊断',
    description: '输入公开频道链接，检查频道结构、内容节奏与可验证的增长信号。',
  },
  '/methodology': {
    title: 'SignalCraft 数据方法',
    description: '了解 SignalCraft 如何采集、筛选和解释 YouTube 公开数据。',
  },
  '/pricing': {
    title: 'SignalCraft 定价',
    description: '查看 SignalCraft 的公开研究与创作工作台方案。',
  },
  '/owner': {
    title: 'SignalCraft 站点管理台',
    description: '查看采集、数据、账号与额度服务状态；管理权限由服务器验证。',
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const segments = (await params).slug ?? [];
  const path = `/${segments.join('/')}` || '/';
  const publicPage = publicMetadata[path] ?? publicMetadata['/'];
  const isPrivate = path.startsWith('/app') || path === '/owner';
  const canonicalPath = path;

  return {
    title: publicPage.title,
    description: publicPage.description,
    alternates: { canonical: canonicalPath },
    robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default function Page(){ return <SignalCraftApp />; }

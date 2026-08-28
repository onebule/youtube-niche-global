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
    title: 'YouTube 机会雷达',
    description: '从公开数据中筛选低粉高播、快速增长和值得验证的 YouTube 内容机会。',
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
};

export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
  const segments = (await params).slug ?? [];
  const path = `/${segments.join('/')}` || '/';
  const publicPage = publicMetadata[path] ?? publicMetadata['/'];
  const isPrivate = path.startsWith('/app') || path === '/owner';

  return {
    title: publicPage.title,
    description: publicPage.description,
    alternates: { canonical: path },
    robots: isPrivate ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default function Page(){ return <SignalCraftApp />; }

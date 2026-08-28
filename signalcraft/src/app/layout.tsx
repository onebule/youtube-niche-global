import type { Metadata } from 'next';
import './globals.css';
import './polish.css';
import './doctor.css';
import './red-theme.css';
import './discover-cards.css';
import './rankings.css';
import './ranking-rules.css';
import './ranking-pagination.css';
import './ranking-performance.css';
import './research-desk.css';
import './login-page.css';
import './upgrade-modal.css';
import './owner-users.css';
import './image-to-video-studio.css';
import './video-canvas-studio.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://niqivo.top';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'SignalCraft · YouTube 内容情报',
    template: '%s · SignalCraft',
  },
  description: '面向创作者的 YouTube 内容情报与选题决策平台，发现真实趋势、分析频道并沉淀选题。',
  applicationName: 'SignalCraft',
  keywords: ['YouTube 数据分析', 'YouTube 选题', '频道分析', '视频趋势', '内容情报'],
  authors: [{ name: 'SignalCraft' }],
  creator: 'SignalCraft',
  publisher: 'SignalCraft',
  openGraph: {
    type: 'website',
    siteName: 'SignalCraft',
    title: 'SignalCraft · YouTube 内容情报',
    description: '发现真实趋势、分析频道并沉淀下一条值得制作的内容。',
    locale: 'zh_CN',
  },
  twitter: {
    card: 'summary',
    title: 'SignalCraft · YouTube 内容情报',
    description: '发现真实趋势、分析频道并沉淀下一条值得制作的内容。',
  },
  robots: { index: true, follow: true },
};


export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>; }


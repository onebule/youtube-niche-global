import type { Metadata } from 'next';
import './globals.css';
import './polish.css';
import './doctor.css';
import './red-theme.css';
import './discover-cards.css';
import './rankings.css';
import './research-desk.css';


export const metadata: Metadata = { title: 'SignalCraft · YouTube 内容情报', description: '面向创作者的 YouTube 内容情报与选题决策平台' };


export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-CN" suppressHydrationWarning><body>{children}</body></html>; }


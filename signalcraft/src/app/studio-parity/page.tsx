import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StudioParityClient from './studio-parity-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'AI Studio Preview · SignalCraft',
  description: '隔离环境下的 AI Studio 交互预览，不提供真实生成功能。',
  robots: { index: false, follow: false, noarchive: true },
};

export default function StudioParityPage() {
  // An isolated visual/interaction reference. This flag is intentionally
  // server-only and defaults OFF in every environment, including production.
  if (process.env.STUDIO_PARITY_PREVIEW !== 'enabled') notFound();
  return <StudioParityClient />;
}

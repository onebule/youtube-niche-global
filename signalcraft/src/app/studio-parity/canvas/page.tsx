import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CanvasClient from './canvas-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Studio Canvas Preview · SignalCraft',
  description: '隔离画布交互验收，不会提交生成任务。',
  robots: { index: false, follow: false, noarchive: true },
};

export default function CanvasParityPage() {
  if (process.env.STUDIO_PARITY_PREVIEW !== 'enabled') notFound();
  return <CanvasClient />;
}

import type { Metadata } from 'next';
import LegalPage from '../legal-page';

export const metadata: Metadata = {
  title: '服务条款',
  description: 'SignalCraft 的服务边界、内容责任和生成任务说明。',
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return <LegalPage kind="terms" />;
}

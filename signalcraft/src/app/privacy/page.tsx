import type { Metadata } from 'next';
import LegalPage from '../legal-page';

export const metadata: Metadata = {
  title: '隐私政策',
  description: 'SignalCraft 如何处理账号、公开数据和创作素材。',
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />;
}

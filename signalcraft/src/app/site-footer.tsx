import Link from 'next/link';

export default function SiteFooter() {
  return <footer className="site-footer" aria-label="站点页脚">
    <div className="site-footer-inner">
      <p className="site-footer-copyright">版权所有 © SignalCraft 2026</p>
      <nav className="site-footer-links" aria-label="政策与条款">
        <Link href="/privacy" prefetch={false}><span>隐私政策</span><small>Privacy Policy</small></Link>
        <Link href="/terms" prefetch={false}><span>服务条款</span><small>Terms of Service</small></Link>
      </nav>
    </div>
  </footer>;
}

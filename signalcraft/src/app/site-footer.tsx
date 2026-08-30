import Link from 'next/link';

export default function SiteFooter() {
  return <footer className="site-footer" aria-label="站点页脚">
    <div className="site-footer-inner">
      <div className="site-footer-brand">
        <span className="site-footer-glyph" aria-hidden="true">SC</span>
        <p className="site-footer-copyright"><strong>SignalCraft</strong><small>版权所有 © 2026 · niqivo.top</small></p>
      </div>
      <nav className="site-footer-links" aria-label="政策与条款">
        <Link href="/privacy" prefetch={false}><span>隐私政策</span><small>Privacy Policy</small></Link>
        <Link href="/terms" prefetch={false}><span>服务条款</span><small>Terms of Service</small></Link>
      </nav>
    </div>
  </footer>;
}

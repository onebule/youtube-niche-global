'use client';

import type { AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';

type LoginPageProps = {
  account: AccountSession | null;
  locale: UiLocale;
  onLocaleChange: (locale: UiLocale) => void;
  onSignIn: () => void;
  onContinue: () => void;
};

const copy = {
  zh: {
    back: '返回榜单', label: '账户访问', title: <>看见真实信号，<em>决定下一步内容。</em></>,
    body: '用公开 YouTube 数据筛选市场、频道与视频，再把值得研究的内容带回自己的工作台。',
    cards: [['实时榜单', '按市场、发布时间和表现读取公开视频'], ['频道研究', '对比播放、订阅与内容形态'], ['保存线索', '把值得研究的视频放进工作台'], ['主人管理', '管理采集、额度与站点运行状态']],
    ledger: '公开数据信号', ledgerState: '只显示真实数据', ledgerRows: ['YouTube 公开数据', '音乐与儿童内容固定排除', '登录用户每天 12 次查询额度'],
    badge: '安全登录', loginTitle: '登录 SignalCraft', loginBody: '使用 Google 账号继续。首次登录会自动创建你的工作区账号。',
    google: '使用 Google 登录', privacy: '仅使用基础账号信息来建立会话，不会读取你的 YouTube 私有数据。', ready: '当前已登录', continue: '进入排行榜',
  },
  en: {
    back: 'Back to rankings', label: 'Account access', title: <>Read real signals. <em>Choose the next move.</em></>,
    body: 'Use public YouTube data to narrow markets, channels, and videos, then bring the content worth studying into your workspace.',
    cards: [['Live rankings', 'Read public videos by market, recency, and performance'], ['Channel research', 'Compare views, subscribers, and video format'], ['Save leads', 'Keep videos worth studying in your workspace'], ['Site administration', 'Review collection, limits, and service status']],
    ledger: 'Public data signals', ledgerState: 'Real data only', ledgerRows: ['YouTube public data', 'Music and made-for-kids content excluded', 'Signed-in users get 12 queries per day'],
    badge: 'Secure sign-in', loginTitle: 'Sign in to SignalCraft', loginBody: 'Continue with Google. Your workspace account is created on first sign-in.',
    google: 'Continue with Google', privacy: 'Only basic account details create your session. We do not read your private YouTube data.', ready: 'Signed in', continue: 'Open rankings',
  },
} as const;

export default function LoginPage({ account, locale, onLocaleChange, onSignIn, onContinue }: LoginPageProps) {
  const text = copy[locale];
  return <main className="login-page">
    <header className="login-header">
      <button className="login-brand" type="button" onClick={onContinue} aria-label="SignalCraft"><span>SC</span><b>SignalCraft<small>CONTENT INTELLIGENCE</small></b></button>
      <div className="login-header-actions"><button className="login-back" type="button" onClick={onContinue}>⌂ {text.back}</button><div className="login-locale" role="group" aria-label="Interface language"><button type="button" className={locale === 'zh' ? 'active' : ''} aria-pressed={locale === 'zh'} onClick={() => onLocaleChange('zh')}>中文</button><button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => onLocaleChange('en')}>EN</button></div></div>
    </header>
    <section className="login-layout">
      <div className="login-story"><span className="login-kicker">{text.label}</span><h1>{text.title}</h1><p>{text.body}</p>
        <div className="login-benefits">{text.cards.map(([title, body], index) => <article key={title}><span aria-hidden="true">{['◉', '↗', '□', '◆'][index]}</span><div><b>{title}</b><small>{body}</small></div></article>)}</div>
        <section className="login-ledger" aria-label={text.ledger}><div><b>{text.ledger}</b><span>{text.ledgerState}</span></div><i><em /></i><ul>{text.ledgerRows.map(item => <li key={item}>✓ {item}</li>)}</ul></section>
      </div>
      <section className="login-card" aria-labelledby="login-title"><span className="login-security">✦ {text.badge}</span><h2 id="login-title">{account ? text.ready : text.loginTitle}</h2>
        {account ? <><p>{account.email}</p><button type="button" className="login-google login-continue" onClick={onContinue}>→ {text.continue}</button></> : <><p>{text.loginBody}</p><button type="button" className="login-google" onClick={onSignIn}><span aria-hidden="true">G</span>{text.google}</button><div className="login-divider"><span>{locale === 'zh' ? '账号与数据边界' : 'Account and data boundary'}</span></div><p className="login-privacy">{text.privacy}</p></>}
      </section>
    </section>
  </main>;
}

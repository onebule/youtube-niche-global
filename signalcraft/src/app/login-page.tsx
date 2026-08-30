'use client';

import { useState, type FormEvent } from 'react';
import type { AccountSession, PasswordAuthInput, PasswordAuthResult } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';

type LoginPageProps = {
  account: AccountSession | null;
  locale: UiLocale;
  onLocaleChange: (locale: UiLocale) => void;
  onSignIn: () => void;
  onPasswordAuth: (input: PasswordAuthInput) => Promise<PasswordAuthResult>;
  onContinue: () => void;
};

const copy = {
  zh: {
    back: '返回榜单', label: '账户访问', title: <>看见真实信号，<em>决定下一步内容。</em></>,
    body: '用公开 YouTube 数据筛选市场、频道与视频，再把值得研究的内容带回自己的工作台。',
    cards: [['实时榜单', '按市场、发布时间和表现读取公开视频'], ['频道研究', '对比播放、订阅与内容形态'], ['保存线索', '把值得研究的视频放进工作台'], ['主人管理', '管理采集、额度与站点运行状态']],
    ledger: '公开数据信号', ledgerState: '只显示真实数据', ledgerRows: ['YouTube 公开数据', '影视、音乐、体育赛事、新闻政治、娱乐、游戏与儿童内容固定排除', '登录用户每天 12 次查询额度'],
    badge: '安全登录', loginTitle: '登录 SignalCraft', loginBody: '保留 Google 登录，也可以使用你自己设置的邮箱和密码。两种账号共用工作区权限与积分。',
    google: '使用 Google 登录', privacy: '仅使用基础账号信息来建立会话，不会读取你的 YouTube 私有数据。邮箱密码由 Supabase 安全处理，SignalCraft 不保存明文密码。', ready: '当前已登录', continue: '进入排行榜',
    signInTab: '登录', signUpTab: '注册账号', email: '邮箱地址', emailPlaceholder: 'name@example.com', name: '显示名称（可选）', namePlaceholder: '你的创作者名称', password: '密码', passwordPlaceholder: '至少 8 位字符', confirmPassword: '确认密码', passwordHint: '8–128 位字符，不要使用其他网站的密码。', submitSignIn: '邮箱登录', submitSignUp: '创建账号', switchToSignUp: '还没有账号？注册一个', switchToSignIn: '已有账号？返回登录', invalidPasswordMatch: '两次输入的密码不一致。', signupSuccess: '账号创建成功，可以开始使用。若收到验证邮件，请先完成邮箱验证。', signupPending: '账号已创建，请查收验证邮件后再登录。', accountMode: '或使用邮箱账号', loginSuccess: '登录成功。',
  },
  en: {
    back: 'Back to rankings', label: 'Account access', title: <>Read real signals. <em>Choose the next move.</em></>,
    body: 'Use public YouTube data to narrow markets, channels, and videos, then bring the content worth studying into your workspace.',
    cards: [['Live rankings', 'Read public videos by market, recency, and performance'], ['Channel research', 'Compare views, subscribers, and video format'], ['Save leads', 'Keep videos worth studying in your workspace'], ['Site administration', 'Review collection, limits, and service status']],
    ledger: 'Public data signals', ledgerState: 'Real data only', ledgerRows: ['YouTube public data', 'Film, music, sports, news/politics, entertainment, gaming, and made-for-kids content excluded', 'Signed-in users get 12 queries per day'],
    badge: 'Secure sign-in', loginTitle: 'Sign in to SignalCraft', loginBody: 'Keep Google sign-in, or use an email and password you set yourself. Both account types share workspace access and credits.',
    google: 'Continue with Google', privacy: 'Only basic account details create your session. Email passwords are handled securely by Supabase; SignalCraft never stores them in plaintext.', ready: 'Signed in', continue: 'Open rankings',
    signInTab: 'Sign in', signUpTab: 'Create account', email: 'Email address', emailPlaceholder: 'name@example.com', name: 'Display name (optional)', namePlaceholder: 'Your creator name', password: 'Password', passwordPlaceholder: 'At least 8 characters', confirmPassword: 'Confirm password', passwordHint: '8–128 characters. Do not reuse a password from another site.', submitSignIn: 'Sign in with email', submitSignUp: 'Create account', switchToSignUp: 'New here? Create an account', switchToSignIn: 'Already have an account? Sign in', invalidPasswordMatch: 'The passwords do not match.', signupSuccess: 'Account created. If verification is required, check your inbox before continuing.', signupPending: 'Account created. Check your inbox to verify your email, then sign in.', accountMode: 'Or use an email account', loginSuccess: 'Signed in successfully.',
  },
} as const;

export default function LoginPage({ account, locale, onLocaleChange, onSignIn, onPasswordAuth, onContinue }: LoginPageProps) {
  const text = copy[locale];
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const switchMode = (nextMode:'login'|'register') => {
    setMode(nextMode);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const submitPasswordAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    if (mode === 'register' && password !== confirmPassword) {
      setError(text.invalidPasswordMatch);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    const result = await onPasswordAuth({ action: mode, email, password, name: mode === 'register' ? name : undefined });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || (locale === 'zh' ? '账号操作未完成，请稍后重试。' : 'The account action could not be completed. Try again.'));
      return;
    }
    setPassword('');
    setConfirmPassword('');
    if (result.requiresEmailConfirmation) setNotice(text.signupPending);
    else setNotice(mode === 'register' ? text.signupSuccess : text.loginSuccess);
  };

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
        {account ? <><p>{account.email}</p><button type="button" className="login-google login-continue" onClick={onContinue}>→ {text.continue}</button></> : <><p>{text.loginBody}</p><button type="button" className="login-google" onClick={onSignIn}><span aria-hidden="true">G</span>{text.google}</button><div className="login-divider"><span>{text.accountMode}</span></div><div className="login-auth-tabs" role="tablist" aria-label={text.accountMode}><button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>{text.signInTab}</button><button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>{text.signUpTab}</button></div><form className="login-auth-form" onSubmit={submitPasswordAuth} noValidate><label htmlFor="login-email">{text.email}</label><input id="login-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder={text.emailPlaceholder} required maxLength={320} /><label htmlFor="login-password">{text.password}</label><input id="login-password" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder={text.passwordPlaceholder} required minLength={8} maxLength={128} /><small className="login-password-hint">{text.passwordHint}</small>{mode === 'register' ? <><label htmlFor="login-name">{text.name}</label><input id="login-name" type="text" autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder={text.namePlaceholder} maxLength={80} /><label htmlFor="login-password-confirm">{text.confirmPassword}</label><input id="login-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder={text.passwordPlaceholder} required minLength={8} maxLength={128} /></> : null}<button type="submit" className="login-submit" disabled={busy}>{busy ? (locale === 'zh' ? '处理中…' : 'Working…') : mode === 'register' ? text.submitSignUp : text.submitSignIn}<span aria-hidden="true">→</span></button></form>{error ? <p className="login-feedback login-feedback-error" role="alert">{error}</p> : null}{notice ? <p className="login-feedback login-feedback-success" role="status">{notice}</p> : null}<button type="button" className="login-mode-link" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? text.switchToSignUp : text.switchToSignIn}</button><p className="login-privacy">{text.privacy}</p></>}
      </section>
    </section>
  </main>;
}

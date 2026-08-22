'use client';

import { useEffect, useState } from 'react';
import LoginPage from '../login-page';
import { captureOAuthReturn, startGoogleSignIn, type AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';

export default function LoginRoute() {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [locale, setLocale] = useState<UiLocale>('zh');

  useEffect(() => {
    setAccount(captureOAuthReturn());
    const saved = localStorage.getItem('signalcraft-interface-locale');
    if (saved === 'zh' || saved === 'en') setLocale(saved);
  }, []);

  const changeLocale = (value: UiLocale) => {
    setLocale(value);
    localStorage.setItem('signalcraft-interface-locale', value);
  };
  const continueToRankings = () => { window.location.assign('/rankings'); };
  const signIn = () => { startGoogleSignIn({ direct: true }); };

  return <LoginPage account={account} locale={locale} onLocaleChange={changeLocale} onSignIn={signIn} onContinue={continueToRankings} />;
}

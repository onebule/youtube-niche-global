'use client';

import { useEffect, useState } from 'react';
import LoginPage from '../login-page';
import { captureOAuthReturn, passwordSignIn, passwordSignUp, startGoogleSignIn, type AccountSession, type PasswordAuthInput, type PasswordAuthResult } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';

export default function LoginRoute() {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [locale, setLocale] = useState<UiLocale>('zh');

  useEffect(() => {
    const task = window.setTimeout(() => {
      setAccount(captureOAuthReturn());
      const saved = localStorage.getItem('signalcraft-interface-locale');
      if (saved === 'zh' || saved === 'en') setLocale(saved);
    }, 0);
    return () => window.clearTimeout(task);
  }, []);

  const changeLocale = (value: UiLocale) => {
    setLocale(value);
    localStorage.setItem('signalcraft-interface-locale', value);
  };
  const continueToRankings = () => { window.location.assign('/rankings'); };
  const signIn = () => { startGoogleSignIn({ direct: true }); };
  const passwordAuth = (input: PasswordAuthInput): Promise<PasswordAuthResult> => input.action === 'register'
    ? passwordSignUp({ email: input.email, password: input.password, name: input.name })
    : passwordSignIn({ email: input.email, password: input.password });

  return <LoginPage account={account} locale={locale} onLocaleChange={changeLocale} onSignIn={signIn} onPasswordAuth={async input => { const result = await passwordAuth(input); if (result.session) setAccount(result.session); return result; }} onContinue={continueToRankings} />;
}

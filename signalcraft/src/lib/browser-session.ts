'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { captureOAuthReturn, type AccountSession } from '@/src/lib/auth';
import type { UiLocale } from '@/src/lib/ui-language';

const INITIAL_PATH = '/';
const LOCALE_STORAGE_KEY = 'signalcraft-interface-locale';

const getBrowserPath = () => (typeof window === 'undefined' ? INITIAL_PATH : window.location.pathname);
const getServerPath = () => INITIAL_PATH;

function subscribeToPathChange(onStoreChange: () => void) {
  window.addEventListener('popstate', onStoreChange);
  window.addEventListener('signalcraft:navigate', onStoreChange);

  return () => {
    window.removeEventListener('popstate', onStoreChange);
    window.removeEventListener('signalcraft:navigate', onStoreChange);
  };
}

/** Keeps client-only browser state behind one stable seam for the app shell. */
export function useBrowserPath() {
  return useSyncExternalStore(subscribeToPathChange, getBrowserPath, getServerPath);
}

export function useBrowserSession() {
  const [account, setAccount] = useState<AccountSession | null>(null);
  const [locale, setLocale] = useState<UiLocale>('zh');

  useEffect(() => {
    const hydrationTimer = window.setTimeout(() => {
      setAccount(captureOAuthReturn());

      const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (savedLocale === 'en' || savedLocale === 'zh') {
        setLocale(savedLocale);
      }
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, []);

  const clearAccount = useCallback(() => setAccount(null), []);

  return { account, clearAccount, locale, setLocale };
}

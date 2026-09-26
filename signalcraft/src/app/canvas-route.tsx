'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { AccountSession } from '@/src/lib/auth';
import { accountStorageKey } from '@/src/lib/account-storage';
import type { UiLocale } from '@/src/lib/ui-language';
import InfiniteCanvasStudio from './infinite-canvas-studio';

const VideoCanvasStudio = dynamic(() => import('./video-canvas-studio'));

type Props = {
  account: AccountSession | null;
  locale: UiLocale;
  onSignIn: () => void;
  notify: (message: string) => void;
};

// Keep the existing creator workspace, its storage and paid-job path intact.
// New accounts see an empty freeform workspace; legacy projects are accessible
// through the explicit "镜头工作区" switch without a lossy migration.
export default function CanvasRoute(props: Props) {
  const preferenceKey = accountStorageKey('signalcraft-canvas-home-v5', props.account);
  const [mode, setMode] = useState<'infinite' | 'legacy'>('infinite');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode(localStorage.getItem(preferenceKey) === 'legacy' ? 'legacy' : 'infinite');
    } catch {
      setMode('infinite');
    }
    setReady(true);
  }, [preferenceKey]);

  const switchMode = (next: 'infinite' | 'legacy') => {
    setMode(next);
    try { localStorage.setItem(preferenceKey, next); } catch { /* storage disabled */ }
  };

  if (!ready) return <main className="page" aria-live="polite">正在打开创作画布…</main>;
  if (mode === 'legacy') {
    return <div className="infinite-legacy-wrap">
      <button className="infinite-return-button" type="button" onClick={() => switchMode('infinite')}>
        ← {props.locale === 'zh' ? '返回无限画布' : 'Back to infinite canvas'}
      </button>
      <VideoCanvasStudio key={preferenceKey} {...props} />
    </div>;
  }
  return <InfiniteCanvasStudio key={preferenceKey} {...props} onLegacy={() => switchMode('legacy')} />;
}

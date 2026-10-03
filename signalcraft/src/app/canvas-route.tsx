'use client';

import dynamic from 'next/dynamic';
import type { AccountSession } from '@/src/lib/auth';
import { accountStorageKey } from '@/src/lib/account-storage';
import { CREATION_WORKSPACES } from '@/src/lib/canvas-workspace-boundaries';
import type { UiLocale } from '@/src/lib/ui-language';
import InfiniteCanvasStudio from './infinite-canvas-studio';
import CanvasTextChat from './canvas-text-chat';

const VideoCanvasStudio = dynamic(() => import('./video-canvas-studio'));

type Props = {
  account: AccountSession | null;
  locale: UiLocale;
  onSignIn: () => void;
  notify: (message: string) => void;
  workspace: 'infinite' | 'shots';
  onNavigate: (path: string) => void;
};

// URL selects the workspace. Existing project namespaces and paid-job services stay intact.
export default function CanvasRoute({ workspace, onNavigate, ...props }: Props) {
  const workspaceKey = accountStorageKey(CREATION_WORKSPACES[workspace].storageKey, props.account);
  return <>
    {workspace === 'shots' ? <div className="infinite-legacy-wrap" data-creation-workspace="shots">
      <button className="infinite-return-button" type="button" onClick={() => onNavigate(CREATION_WORKSPACES.infinite.path)}>
        ← {props.locale === 'zh' ? '打开无限画布（独立项目）' : 'Open infinite canvas (separate projects)'}
      </button>
      <VideoCanvasStudio key={workspaceKey} {...props} />
    </div> : <div data-creation-workspace="infinite"><InfiniteCanvasStudio key={workspaceKey} {...props} onLegacy={() => onNavigate(CREATION_WORKSPACES.shots.path)} /></div>}
    <CanvasTextChat key={`chat:${workspace}:${workspaceKey}`} account={props.account} locale={props.locale} onSignIn={props.onSignIn} />
  </>;
}

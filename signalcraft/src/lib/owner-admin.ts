import { authHeaders } from './auth';

export type OwnerOverview = {
  owner: { email: string; ownerCount: number };
  users: {
    available: boolean;
    teamAccessAvailable: boolean;
    total: number | null;
    recent: Array<{
      email: string;
      createdAt: string | null;
      lastSignInAt: string | null;
      provider: string;
      isOwner: boolean;
      teamAccess: {
        status: 'owner' | 'environment' | 'active' | 'expired' | 'none';
        active: boolean;
        expiresAt: string | null;
        updatedAt?: string | null;
      };
    }>;
  };
  collection: {
    schedule: string;
    videos: number | null;
    snapshots: number | null;
    latestRun: {
      started_at: string;
      finished_at: string | null;
      status: string;
      videos_seen: number;
      markets: string[];
      note: string | null;
    } | null;
  };
  services: {
    youtubeDataApi: boolean;
    signalStore: boolean;
    quotaService: boolean;
    guestDailyLimit: number;
    signedInDailyLimit: number;
  };
};

export type TeamAccessDuration = '7d' | '30d' | 'permanent';

export class OwnerOverviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'OwnerOverviewError';
  }
}

export async function loadOwnerOverview(): Promise<OwnerOverview> {
  const response = await fetch('/api/owner-status', {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  const payload = await response.json() as OwnerOverview & { error?: string };
  if (!response.ok) throw new OwnerOverviewError(payload.error || '无法读取站点管理概览。', response.status);
  return payload;
}

export async function hasOwnerAccess(): Promise<boolean> {
  const response = await fetch('/api/owner-status?view=access', {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  return response.ok;
}

export async function updateVideoTeamAccess({
  email,
  action,
  duration,
}: {
  email: string;
  action: 'grant' | 'revoke';
  duration?: TeamAccessDuration;
}): Promise<void> {
  const response = await fetch('/api/owner-access', {
    method: action === 'grant' ? 'POST' : 'DELETE',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ email, ...(action === 'grant' ? { duration } : {}) }),
    cache: 'no-store',
  });
  const payload = await response.json() as { error?: string };
  if (!response.ok) throw new OwnerOverviewError(payload.error || '无法更新 Team 权限。', response.status);
}

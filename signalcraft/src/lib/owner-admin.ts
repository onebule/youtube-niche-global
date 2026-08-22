import { authHeaders } from './auth';

export type OwnerOverview = {
  owner: { email: string; ownerCount: number };
  users: {
    available: boolean;
    total: number | null;
    recent: Array<{
      email: string;
      createdAt: string | null;
      lastSignInAt: string | null;
      provider: string;
      isOwner: boolean;
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

export async function loadOwnerOverview(): Promise<OwnerOverview> {
  const response = await fetch('/api/owner-status', {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  const payload = await response.json() as OwnerOverview & { error?: string };
  if (!response.ok) throw new Error(payload.error || '无法读取站点管理概览。');
  return payload;
}

export async function hasOwnerAccess(): Promise<boolean> {
  const response = await fetch('/api/owner-status?view=access', {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  return response.ok;
}

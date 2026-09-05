import { authHeaders } from './auth';

const OWNER_STATUS_ENDPOINT = (process.env.NEXT_PUBLIC_OWNER_STATUS_URL || 'https://youtube-niche-global-api.vercel.app/api/owner-status').replace(/\/$/, '');
const OWNER_ACCESS_ENDPOINT = (process.env.NEXT_PUBLIC_OWNER_ACCESS_URL || OWNER_STATUS_ENDPOINT).replace(/\/$/, '');

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
        plan: 'owner' | 'pro' | 'team' | null;
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

export type TeamAccessDuration = '7d' | '30d' | 'quarter' | 'year' | 'permanent';
export type AccountPlan = 'pro' | 'team';

export class OwnerOverviewError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'OwnerOverviewError';
  }
}

async function readJson<T extends { error?: string }>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function loadOwnerOverview(): Promise<OwnerOverview> {
  const response = await fetch(OWNER_STATUS_ENDPOINT, {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  const payload = await readJson<OwnerOverview & { error?: string }>(response);
  if (!response.ok) {
    throw new OwnerOverviewError(
      payload?.error || '管理服务返回了无法识别的响应，请检查后端管理接口部署状态。',
      response.status || 502,
    );
  }
  if (!payload) throw new OwnerOverviewError('管理服务返回了无法识别的响应，请稍后重试。', 502);
  return payload;
}

export async function hasOwnerAccess(): Promise<boolean> {
  const response = await fetch(`${OWNER_STATUS_ENDPOINT}?view=access`, {
    headers: { accept: 'application/json', ...authHeaders() },
    cache: 'no-store',
  });
  return response.ok;
}

export async function updateVideoTeamAccess({
  email,
  action,
  plan,
  duration,
}: {
  email: string;
  action: 'grant' | 'revoke';
  plan?: AccountPlan;
  duration?: TeamAccessDuration;
}): Promise<void> {
  const response = await fetch(`${OWNER_ACCESS_ENDPOINT}?view=team-access`, {
    method: action === 'grant' ? 'POST' : 'DELETE',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ email, ...(action === 'grant' ? { plan: plan || 'team', duration } : {}) }),
    cache: 'no-store',
  });
  const payload = await readJson<{ error?: string }>(response);
  if (!response.ok) throw new OwnerOverviewError(payload?.error || '账号授权服务返回了无法识别的响应，请稍后重试。', response.status || 502);
}

import { authHeaders } from './auth';
import type { WatchRule } from './types';

type ApiRule = WatchRule & { createdAt?: string; updatedAt?: string };

async function request<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { accept: 'application/json', ...authHeaders(), ...(init.headers || {}) },
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : `监控服务暂时不可用（HTTP ${response.status}）。`;
    throw new Error(message);
  }
  return payload as T;
}

export async function loadMonitorRules(): Promise<WatchRule[]> {
  const payload = await request<{ rules?: ApiRule[] }>('/api/monitoring');
  return Array.isArray(payload.rules) ? payload.rules : [];
}

export async function createMonitorRule(rule: Omit<WatchRule, 'id'>): Promise<WatchRule> {
  const payload = await request<{ rule: ApiRule }>('/api/monitoring', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return payload.rule;
}

export async function updateMonitorRule(id: string, patch: Partial<Pick<WatchRule, 'paused' | 'threshold' | 'frequency' | 'name'>>): Promise<WatchRule> {
  const payload = await request<{ rule: ApiRule }>(`/api/monitoring?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return payload.rule;
}

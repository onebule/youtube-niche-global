export type AccountStorageIdentity = {
  userId?: string;
  email?: string;
} | null | undefined;

/**
 * Return a deterministic, non-sensitive namespace for account-owned browser
 * data. Prefer the auth provider's immutable user id and only fall back to a
 * normalized email for older sessions that predate userId in the payload.
 */
export function accountStorageScope(account: AccountStorageIdentity): string {
  const userId = typeof account?.userId === 'string' ? account.userId.trim() : '';
  const email = typeof account?.email === 'string' ? account.email.trim().toLowerCase() : '';
  const identity = userId || email;
  if (!identity) return 'anonymous';

  // FNV-1a keeps the localStorage key short and avoids putting an email in a
  // key that may be visible to browser extensions or debugging tools.
  let hash = 2166136261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `account-${(hash >>> 0).toString(36)}`;
}

export function accountStorageKey(baseKey: string, account: AccountStorageIdentity): string {
  return `${baseKey}:${accountStorageScope(account)}`;
}

export function scopedStorageKey(baseKey: string, scope: string): string {
  const normalized = String(scope || 'anonymous').trim() || 'anonymous';
  return `${baseKey}:${normalized}`;
}

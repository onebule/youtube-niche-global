import test from 'node:test';
import assert from 'node:assert/strict';
import { accountStorageKey, accountStorageScope, scopedStorageKey } from '../src/lib/account-storage.ts';

test('account storage namespaces are stable for the same account', () => {
  const first = { userId: 'user-123', email: 'owner@example.com' };
  assert.equal(accountStorageScope(first), accountStorageScope({ ...first }));
  assert.equal(accountStorageKey('signalcraft-workspace-v2', first), accountStorageKey('signalcraft-workspace-v2', first));
});

test('account storage namespaces never overlap between account ids', () => {
  const firstKey = accountStorageKey('signalcraft-workspace-v2', { userId: 'user-a' });
  const secondKey = accountStorageKey('signalcraft-workspace-v2', { userId: 'user-b' });
  assert.notEqual(firstKey, secondKey);
  assert.notEqual(firstKey, accountStorageKey('signalcraft-workspace-v2', { email: 'user-b@example.com' }));
});

test('email fallback is normalized and storage scopes stay base-key isolated', () => {
  const first = accountStorageScope({ email: '  User@example.com ' });
  const second = accountStorageScope({ email: 'user@example.com' });
  assert.equal(first, second);
  assert.equal(scopedStorageKey('signalcraft:image-generation-history:v1', first), `signalcraft:image-generation-history:v1:${first}`);
  assert.notEqual(first, accountStorageScope(null));
});

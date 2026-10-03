import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CREATION_WORKSPACES, belongsToShotProject, scopedShotHistoryPage } from '../src/lib/canvas-workspace-boundaries.ts';
import { accountStorageKey } from '../src/lib/account-storage.ts';

const source = name => readFileSync(new URL(`../src/app/${name}`, import.meta.url), 'utf8');

test('workspaces have stable distinct routes and preserve existing save namespaces', () => {
  assert.equal(CREATION_WORKSPACES.infinite.path, '/app/canvas');
  assert.equal(CREATION_WORKSPACES.shots.path, '/app/shot-workspace');
  assert.equal(CREATION_WORKSPACES.infinite.storageKey, 'signalcraft-infinite-canvas-v5');
  assert.equal(CREATION_WORKSPACES.shots.storageKey, 'signalcraft-video-canvas-v1');
  const a = { userId: 'user-a' }, b = { userId: 'user-b' };
  assert.notEqual(accountStorageKey(CREATION_WORKSPACES.infinite.storageKey, a), accountStorageKey(CREATION_WORKSPACES.shots.storageKey, a));
  assert.notEqual(accountStorageKey(CREATION_WORKSPACES.shots.storageKey, a), accountStorageKey(CREATION_WORKSPACES.shots.storageKey, b));
});

test('shot history excludes infinite, quick, other-project and unknown jobs', () => {
  const jobs = [
    { id: 'shot', generationGroupId: 'shot-project' },
    { id: 'nested', generationSpec: { generationGroupId: 'shot-project' } },
    { id: 'infinite', generationGroupId: 'infinite-project' },
    { id: 'quick', generationGroupId: null },
    { id: 'unknown' },
  ];
  assert.deepEqual(scopedShotHistoryPage(jobs, 'shot-project', 0, 5).items.map(x => x.id), ['shot', 'nested']);
  assert.equal(belongsToShotProject(jobs[4], ''), false);
});

test('filtered empty pages advance by raw page size, not visible count', () => {
  const first = scopedShotHistoryPage([{ id: 'foreign', generationGroupId: 'other' }], 'project', 0, 1);
  assert.deepEqual(first.items, []);
  assert.equal(first.nextOffset, 1);
  assert.equal(first.hasMore, true);
  const next = scopedShotHistoryPage([{ id: 'own', generationGroupId: 'project' }], 'project', first.nextOffset, 1);
  assert.equal(next.nextOffset, 2);
  assert.deepEqual(next.items.map(x => x.id), ['own']);
  assert.equal(scopedShotHistoryPage([], 'project', 2, 1).hasMore, false);
});

test('actual app selects workspace by URL and never by remembered mode', () => {
  const route = source('canvas-route.tsx');
  assert.doesNotMatch(route, /localStorage|switchMode|signalcraft-canvas-home/);
  assert.match(route, /workspace === 'shots'/);
  assert.match(route, /chat:\$\{workspace\}/);
  const app = source('signalcraft-app.tsx');
  assert.match(app, /path === CREATION_WORKSPACES\.shots\.path/);
  assert.match(app, /onOpenCanvas=\{\(\) => navigate\(CREATION_WORKSPACES\.shots\.path\)\}/);
  assert.match(source('video-canvas-studio.tsx'), /scopedShotHistoryPage\(next, project\.id/);
});

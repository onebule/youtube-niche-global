import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// Exercise the real client without a browser or any live provider requests.
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(`${stripTypeScriptTypes(source, { mode: 'transform' })}\n//# sourceURL=video-job-client-test.mjs`).toString('base64')}`;
const authUrl = moduleUrl(readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8'));
const errorUrl = moduleUrl(readFileSync(new URL('../src/lib/client-error.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/video-generation.ts', import.meta.url), 'utf8')
  .replace("from './auth'", `from '${authUrl}'`)
  .replace("from './client-error'", `from '${errorUrl}'`);
const client = await import(moduleUrl(source));

function mockSession(t) {
  t.mock.method(globalThis, 'fetch');
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = {};
  globalThis.localStorage = {
    getItem: () => JSON.stringify({ accessToken: 'unit-test-token', expiresAt: Date.now() + 60_000 }),
  };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  });
}

test('job refresh uses the existing single-segment route and encodes the job id', async t => {
  mockSession(t);
  const jobId = 'job/with?reserved&characters';
  const payload = { job: { id: jobId, state: 'PROCESSING' }, generation: { status: 'processing' } };
  globalThis.fetch.mock.mockImplementation(async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/api/video/job-status');
    assert.equal(parsed.searchParams.get('jobId'), jobId);
    assert.equal(init.method || 'GET', 'GET');
    assert.equal(init.headers.authorization, 'Bearer unit-test-token');
    assert.equal(init.body, undefined);
    assert.equal(init.cache, 'no-store');
    return new Response(JSON.stringify(payload), { status: 200 });
  });
  assert.deepEqual(await client.refreshGenerationJob(jobId), payload);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('completed and cancelled job reads preserve the backend result without submitting another job', async t => {
  mockSession(t);
  for (const state of ['SUCCEEDED', 'CANCELLED']) {
    const payload = { job: { id: 'existing-job', state }, generation: { status: state === 'SUCCEEDED' ? 'completed' : 'failed' }, output: state === 'SUCCEEDED' ? { type: 'video', assetId: 'test-output' } : null };
    globalThis.fetch.mock.mockImplementation(async (url, init) => {
      assert.equal(new URL(url).pathname, '/api/video/job-status');
      assert.equal(init.method || 'GET', 'GET');
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    assert.deepEqual(await client.pollGenerationJob('existing-job'), { ...payload, timedOutLocally: false });
  }
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});

test('job status authentication failures remain explicit and do not retry or submit', async t => {
  mockSession(t);
  globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: 'Sign in again.', code: 'AUTH_REQUIRED' }), { status: 401 }));
  await assert.rejects(client.refreshGenerationJob('existing-job'), error => {
    assert.equal(error.status, 401);
    assert.equal(error.code, 'AUTH_REQUIRED');
    return true;
  });
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('job status network failures never create a new paid generation', async t => {
  mockSession(t);
  globalThis.fetch.mock.mockImplementation(async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/video/job-status');
    assert.equal(init.method || 'GET', 'GET');
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(client.refreshGenerationJob('existing-job'), /Failed to fetch/);
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

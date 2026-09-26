import test from 'node:test';
import assert from 'node:assert/strict';
import { GET, POST } from '../src/app/api/video/[...path]/route.ts';

function makeRequest(method = 'GET') {
  return {
    method,
    headers: new Headers({ authorization: 'Bearer test-user-token' }),
    nextUrl: new URL('https://example.test/api/video/agent/models'),
    text: async () => '{"prompt":"synthetic test only"}',
  };
}

test('video proxy blocks traversal and encoded path separators before upstream fetch', async () => {
  const oldFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('unexpected upstream call'); };
  try {
    for (const path of [
      ['..', 'owner-status'], ['.', 'owner-status'],
      ['agent/models'], ['agent\\models'], ['%2e%2e', 'owner-status'],
    ]) {
      const response = await GET(makeRequest(), { params: Promise.resolve({ path }) });
      assert.equal(response.status, 400, JSON.stringify(path));
      assert.equal((await response.json()).code, 'INVALID_VIDEO_PATH');
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('video proxy preserves valid nested route and authorization', async () => {
  const oldFetch = globalThis.fetch;
  let destination;
  let forwardedAuth;
  globalThis.fetch = async (url, options) => {
    destination = String(url);
    forwardedAuth = options.headers.authorization;
    return Response.json({ ok: true });
  };
  try {
    const response = await GET(makeRequest(), { params: Promise.resolve({ path: ['agent', 'models'] }) });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(destination, 'https://youtube-niche-global-api.vercel.app/api/video/agent/models');
    assert.equal(forwardedAuth, 'Bearer test-user-token');
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test('video proxy rejects malformed POST paths before reading the body', async () => {
  let bodyRead = false;
  const request = makeRequest('POST');
  request.text = async () => { bodyRead = true; return '{}'; };
  const response = await POST(request, { params: Promise.resolve({ path: ['..', 'collect-signals'] }) });
  assert.equal(response.status, 400);
  assert.equal(bodyRead, false);
});
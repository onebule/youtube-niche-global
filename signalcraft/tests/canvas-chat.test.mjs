import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { canvasChatError, nextCanvasChatMessages, readyClaudeModels } from '../src/lib/canvas-chat.ts';

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(`${stripTypeScriptTypes(source, { mode: 'transform' })}\n//# sourceURL=canvas-chat-client-test.mjs`).toString('base64')}`;
const authUrl = moduleUrl(readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8'));
const errorUrl = moduleUrl(readFileSync(new URL('../src/lib/client-error.ts', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/canvas-text-generation.ts', import.meta.url), 'utf8')
  .replace("from './auth'", `from '${authUrl}'`).replace("from './client-error'", `from '${errorUrl}'`);
const client = await import(moduleUrl(source));

const model = 'claude-opus-5-5';
const history = [{ role: 'user', content: 'Remember Maple.' }, { role: 'assistant', content: 'I will.' }];

test('follow-ups keep role boundaries, clear starts fresh and neither mutates history nor canvas', () => {
  const canvas = { nodes: [{ id: 'image' }], edges: [{ source: 'image', target: 'video' }], runs: ['existing-job'] };
  const saved = structuredClone(canvas);
  assert.deepEqual(nextCanvasChatMessages(history, '  Which name? '), [...history, { role: 'user', content: 'Which name?' }]);
  assert.deepEqual(nextCanvasChatMessages([], 'New question'), [{ role: 'user', content: 'New question' }]);
  assert.equal(history.length, 2); assert.deepEqual(canvas, saved);
});

test('invalid and overlong context is refused, never silently truncated', () => {
  assert.throws(() => nextCanvasChatMessages(history, ''), /CHAT_INPUT/);
  assert.throws(() => nextCanvasChatMessages(history, 'x'.repeat(12001)), /CHAT_INPUT/);
  assert.throws(() => nextCanvasChatMessages([{ role: 'assistant', content: 'untrusted' }], 'Question'), /CHAT_INPUT/);
  assert.throws(() => nextCanvasChatMessages(Array.from({ length: 24 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x' })), 'Question'), /CHAT_LIMIT/);
  assert.throws(() => nextCanvasChatMessages(Array.from({ length: 4 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(12000) })), 'Question'), /CHAT_LIMIT/);
});

test('only ready Claude models are selectable; errors are localized without upstream text', () => {
  const available = { id: model, provider: 'claude', enabled: true };
  assert.deepEqual(readyClaudeModels([available, { id: 'gpt-6-sol', provider: 'gpt', enabled: true }, { id: 'claude-fable-5-1', provider: 'claude', enabled: false }]), [available]);
  assert.match(canvasChatError('TEAM_ONLY', true), /Team/);
  assert.match(canvasChatError('AUTH_REQUIRED', false), /Sign in/);
  assert.equal(canvasChatError('upstream-secret', true).includes('upstream-secret'), false);
  assert.match(canvasChatError('AGENT_TIMEOUT', true), /Claude.*等待时间/);
  assert.match(canvasChatError('AGENT_UPSTREAM_ERROR', true), /服务方拒绝/);
  assert.match(canvasChatError('TEXT_OUTPUT_TRUNCATED', true), /长度上限/);
  assert.match(canvasChatError('FINAL_CONTENT_MISSING', false), /no final answer/);
});

function mockSession(t) {
  t.mock.method(globalThis, 'fetch');
  const originalWindow = globalThis.window, originalStorage = globalThis.localStorage;
  globalThis.window = {};
  globalThis.localStorage = { getItem: () => JSON.stringify({ accessToken: 'unit-test-token', expiresAt: Date.now() + 60000 }) };
  t.after(() => {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
  });
}

test('chat uses only the authenticated flat text route with complete history and cancellation signal', async t => {
  mockSession(t);
  const messages = nextCanvasChatMessages(history, 'Which name?');
  const controller = new AbortController();
  globalThis.fetch.mock.mockImplementation(async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/video/canvas-text-chat-long');
    assert.equal(init.method, 'POST'); assert.equal(init.headers.authorization, 'Bearer unit-test-token');
    assert.equal(init.signal, controller.signal); assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(init.body), { model, messages, userConfirmed: true });
    return new Response(JSON.stringify({ result: { model, text: 'Maple.' } }));
  });
  assert.deepEqual(await client.sendCanvasChat(model, messages, controller.signal), { model, text: 'Maple.' });
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('anonymous, Team denial, network failure and malformed answers do not retry or change models', async t => {
  mockSession(t);
  for (const [status, code] of [[401, 'AUTH_REQUIRED'], [403, 'TEAM_ONLY'], [503, 'TEXT_MODEL_NOT_READY']]) {
    globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ error: 'safe message', code }), { status }));
    await assert.rejects(client.sendCanvasChat(model, nextCanvasChatMessages([], 'Question')), error => error.code === code && error.status === status);
  }
  globalThis.fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(client.sendCanvasChat(model, []), /Failed to fetch/);
  for (const result of [null, { model: 'another-model', text: 'wrong' }, { model, text: '' }]) {
    globalThis.fetch.mock.mockImplementation(async () => new Response(JSON.stringify({ result })));
    await assert.rejects(client.sendCanvasChat(model, []), error => error.code === 'RESPONSE_INVALID');
  }
  assert.equal(globalThis.fetch.mock.callCount(), 7);
});

test('single-turn text generation contract remains unchanged', async t => {
  mockSession(t);
  globalThis.fetch.mock.mockImplementation(async (url, init) => {
    assert.equal(new URL(url).pathname, '/api/video/canvas-text-generate');
    assert.deepEqual(JSON.parse(init.body), { model, prompt: 'Write a shot', userConfirmed: true });
    return new Response(JSON.stringify({ result: { model, text: 'Shot.' } }));
  });
  assert.equal((await client.generateCanvasText(model, 'Write a shot')).text, 'Shot.');
});

function progressResponse(events, incomplete = false) {
  const encoded = new TextEncoder().encode(events.map(event => JSON.stringify(event)).join('\n') + (incomplete ? '' : '\n'));
  return new Response(new ReadableStream({ start(controller) {
    // Deliberately split Chinese UTF-8 and JSON lines across network chunks.
    for (let i = 0; i < encoded.length; i += 2) controller.enqueue(encoded.slice(i, i + 2));
    controller.close();
  } }), { headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } });
}

test('progress frames are not answers; split UTF-8 completion is accepted once', async t => {
  mockSession(t);
  globalThis.fetch.mock.mockImplementation(async () => progressResponse([{ type: 'waiting' }, { type: 'waiting' }, { type: 'result', result: { model, text: '完整回答。' } }], true));
  assert.deepEqual(await client.sendCanvasChat(model, history), { model, text: '完整回答。' });
  assert.equal(globalThis.fetch.mock.callCount(), 1);
});

test('stream errors, early EOF, duplicate result and unknown frames never imply success', async t => {
  mockSession(t);
  for (const [events, code] of [
    [[{ type: 'waiting' }, { type: 'error', code: 'AGENT_TIMEOUT', status: 503 }], 'AGENT_TIMEOUT'],
    [[{ type: 'waiting' }], 'RESPONSE_INVALID'],
    [[{ type: 'result', result: { model, text: 'a' } }, { type: 'result', result: { model, text: 'b' } }], 'RESPONSE_INVALID'],
    [[{ type: 'reasoning', text: 'private' }], 'RESPONSE_INVALID'],
  ]) {
    globalThis.fetch.mock.mockImplementation(async () => progressResponse(events));
    await assert.rejects(client.sendCanvasChat(model, history), error => error.code === code);
  }
  assert.equal(globalThis.fetch.mock.callCount(), 4);
});

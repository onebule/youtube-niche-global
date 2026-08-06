import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, serializeFilters } from '../src/lib/scoring.mjs';

test('筛选状态可序列化并还原', () => {
  const source = { q: 'AI tools', window: '7d', language: 'en', format: 'short', maxSubs: '100000', minScore: '75', sort: 'velocity' };
  assert.deepEqual(parseFilters(serializeFilters(source)), source);
});

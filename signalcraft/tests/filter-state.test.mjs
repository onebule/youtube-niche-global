import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFilters, serializeFilters } from '../src/lib/scoring.mjs';

test('筛选状态可序列化并还原', () => {
  const source = { q: 'AI tools', window: '7d', region: 'JP', language: 'en', format: 'short', category: '28', maxSubs: '100000', minSubs: '0', minViews: '0', maxViews: 'all', entity: 'videos', display: 'list', minScore: '75', sort: 'velocity' };
  assert.deepEqual(parseFilters(serializeFilters(source)), source);
});

test('榜单的默认订阅范围不应缩窄真实公开样本', () => {
  const filters = parseFilters('format=short&window=28d&entity=videos&display=list');
  assert.equal(filters.minSubs, '0');
  assert.equal(filters.maxSubs, 'all');
  assert.equal(filters.minViews, '0');
  assert.equal(filters.maxViews, 'all');
});

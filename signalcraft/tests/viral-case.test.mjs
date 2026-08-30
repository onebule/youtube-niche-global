import assert from 'node:assert/strict';
import test from 'node:test';
import { applyViralCaseAnalysisToNotes, createH3BriefFromCase, createIdeaDraftFromCase, createViralCaseCanvasHandoff, formatViralCaseReport, normalizeViralCaseAnalysis, normalizeViralCaseCanvasHandoff, normalizeViralCaseStore } from '../src/lib/viral-case.ts';
import { parseYouTubeVideoId } from '../src/lib/youtube-video-url.ts';

const video = {
  id: 'yt-example', channelId: 'channel-1', title: 'Original example', titleZh: '中文案例', topic: '肢体喜剧', language: '英语', region: 'US', format: 'short', publishedAt: '2026-08-01T00:00:00.000Z', durationSeconds: 23, thumbnail: '', risk: 'low', tags: [], snapshots: [{ capturedAt: '2026-08-01T00:00:00.000Z', views: 100, likes: 5, comments: 1, subscribers: 10 }],
};

test('case store normalizes invalid saved data without leaking malformed fields', () => {
  const store = normalizeViralCaseStore({ selectedVideoId: 'yt-example', notesByVideoId: { 'yt-example': { hook: '  奇怪动作  ', beats: ['开头', 1, null, '收尾'], reusableMechanism: '对照升级' } } });
  assert.equal(store.selectedVideoId, 'yt-example');
  assert.deepEqual(store.notesByVideoId['yt-example'].beats, ['开头', '', '', '收尾']);
  assert.equal(store.notesByVideoId['yt-example'].hook, '奇怪动作');
});

test('case notes become an original idea brief while preserving the source boundary', () => {
  const draft = createIdeaDraftFromCase(video, {
    hook: '水流先出现', rule: '主角每次都说我也会', beats: ['物体动作', '第一次模仿', '更离谱的模仿', '滚动收尾'], emotionalCurve: '好奇 → 加码', visualLanguage: '固定广角', propsAndSound: '短句口头禅', reusableMechanism: '物体动作和人体模仿的反差升级', adaptation: '改成办公室物品挑战', updatedAt: null,
  });
  assert.match(draft.title, /物体动作和人体模仿/);
  assert.match(draft.angle, /办公室物品挑战/);
  assert.match(draft.note, /创作者研究笔记/);
  assert.match(draft.hypothesis, /需要用自己的发布数据验证/);
});

test('provider reports are normalized and incomplete reports are rejected', () => {
  const report = normalizeViralCaseAnalysis({
    provider: 'approved-vision-service', confidence: 'high', hook: '水流先出现', rule: '每次都说我也会', beats: ['先展示', '第一次模仿', '继续加码', '滚动收口'], beatTimestamps: ['00:00', '00:03', '00:08', '00:17'], emotionalCurve: '好奇 → 满足', visualLanguage: '固定广角', propsAndSound: '现场声音', caveats: ['需要人工核对时间点'],
  });
  assert.equal(report?.provider, 'approved-vision-service');
  assert.equal(report?.confidence, 'high');
  assert.deepEqual(report?.beats, ['先展示', '第一次模仿', '继续加码', '滚动收口']);
  assert.equal(normalizeViralCaseAnalysis({ provider: 'bad-provider', beats: ['只有一部分'] }), null);
});

test('analysis can seed only blank observation fields and export a traceable report', () => {
  const notes = normalizeViralCaseStore({ notesByVideoId: { 'yt-example': {
    hook: '人工确认的 Hook', beats: ['', '人工节拍', '', ''], reusableMechanism: '对照升级', adaptation: '办公室版本',
    analysis: { provider: 'approved-service', confidence: 'medium', hook: '模型 Hook', rule: '重复规则', beats: ['第一拍', '模型第二拍', '模型第三拍', '模型结尾'], beatTimestamps: ['00:00', '00:03', '00:08', '00:17'], emotionalCurve: '好奇 → 满足', visualLanguage: '固定广角', propsAndSound: '口头禅', caveats: ['核对时间点'] },
  } } }).notesByVideoId['yt-example'];
  const seeded = applyViralCaseAnalysisToNotes(notes);
  assert.equal(seeded.hook, '人工确认的 Hook');
  assert.deepEqual(seeded.beats, ['第一拍', '人工节拍', '模型第三拍', '模型结尾']);
  const report = formatViralCaseReport(video, { ...notes, ...seeded });
  assert.match(report, /来源：/);
  assert.match(report, /人工确认的 Hook/);
  assert.match(report, /核对时间点/);
  assert.match(report, /00:03/);
});

test('H3 brief preserves the mechanism while explicitly requiring original adaptation', () => {
  const notes = normalizeViralCaseStore({ notesByVideoId: { 'yt-example': {
    hook: '先出现异常动作', beats: ['第一拍', '', '', ''], beatTimestamps: ['00:00', '', '', ''], reusableMechanism: '重复模仿并逐次升级', adaptation: '改成办公室物品挑战',
  } } }).notesByVideoId['yt-example'];
  const brief = createH3BriefFromCase(video, notes);
  assert.match(brief, /original vertical short video/);
  assert.match(brief, /replace every source-specific/);
  assert.match(brief, /办公室物品挑战/);
  assert.match(brief, /00:00/);
});

test('canvas handoff is bounded and remains a draft until the canvas user confirms generation', () => {
  const notes = normalizeViralCaseStore({ notesByVideoId: { 'yt-example': {
    reusableMechanism: '重复模仿并逐次升级', adaptation: '改成办公室物品挑战', beatTimestamps: ['00:00', '', '', ''], beats: ['第一拍', '', '', ''],
  } } }).notesByVideoId['yt-example'];
  const handoff = createViralCaseCanvasHandoff(video, notes, 'integrated_multimodal_description: original draft');
  assert.equal(handoff.version, 1);
  assert.equal(handoff.duration, 15);
  assert.equal(normalizeViralCaseCanvasHandoff(handoff)?.sourceVideoId, 'yt-example');
  assert.equal(normalizeViralCaseCanvasHandoff({ ...handoff, prompt: '' }), null);
});

test('direct import accepts only a YouTube video URL shape', () => {
  assert.equal(parseYouTubeVideoId('https://www.youtube.com/watch?v=JmlbMiAKArA'), 'JmlbMiAKArA');
  assert.equal(parseYouTubeVideoId('https://youtu.be/JmlbMiAKArA?t=4'), 'JmlbMiAKArA');
  assert.equal(parseYouTubeVideoId('https://example.com/watch?v=JmlbMiAKArA'), null);
  assert.equal(parseYouTubeVideoId('not-a-url'), null);
});

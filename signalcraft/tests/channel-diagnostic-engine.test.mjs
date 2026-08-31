import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChannelDiagnosis } from '../src/lib/channel-diagnostic-engine.ts';

const NOW = new Date('2026-08-31T00:00:00.000Z');
const video = (id, daysAgo, views, title = `Topic ${id}`, format = 'long') => ({ id, title, publishedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(), views, durationSeconds: format === 'short' ? 30 : 600, format, formatConfidence: 'high' });
const channel = (videos, createdDaysAgo = 800) => ({ channelId: 'UC-test', channelTitle: 'Test channel', videoCount: videos.length, createdAt: new Date(NOW.getTime() - createdDaysAgo * 86_400_000).toISOString(), videos });

test('new channel with five videos stays early exploration and low confidence', () => {
  const diagnosis = buildChannelDiagnosis(channel([1, 2, 3, 4, 5].map((id, index) => video(String(id), index + 1, 500 + id)), 30), NOW);
  assert.equal(diagnosis.channelStage, 'EARLY_TESTING');
  assert.equal(diagnosis.primaryState, 'EARLY_EXPLORATION');
  assert.equal(diagnosis.confidence, 'LOW');
});

test('stable growth is measured against age-normalized self baseline', () => {
  const videos = Array.from({ length: 20 }, (_, index) => video(String(index), index + 1, 10_000 * (index + 1)));
  const diagnosis = buildChannelDiagnosis(channel(videos), NOW);
  assert.ok(['GROWTH', 'STABLE'].includes(diagnosis.channelStage));
  assert.ok(['HEALTHY_GROWTH', 'HEALTHY_STABLE'].includes(diagnosis.primaryState));
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'BASELINE_DECLINE'), false);
});

test('one viral video among a mature sample is hit dependent', () => {
  const videos = [video('viral', 1, 1_000_000, 'Validated topic')].concat(Array.from({ length: 19 }, (_, index) => video(String(index), index + 2, 100, 'Other topic')));
  const diagnosis = buildChannelDiagnosis(channel(videos), NOW);
  assert.equal(diagnosis.primaryState, 'HIT_DEPENDENT');
  assert.equal(diagnosis.topIssues[0].issueCode, 'HIT_DEPENDENCE');
});

test('historical strong performance followed by decline triggers baseline decline', () => {
  const recent = Array.from({ length: 10 }, (_, index) => video(`r${index}`, index + 1, 500, 'Validated topic'));
  const previous = Array.from({ length: 10 }, (_, index) => video(`p${index}`, index + 20, 30_000, 'Validated topic'));
  const diagnosis = buildChannelDiagnosis(channel([...recent, ...previous]), NOW);
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'BASELINE_DECLINE'), true);
});

test('breakout followed by unrelated content is called out', () => {
  const videos = [
    video('breakout', 2, 100_000, 'Mountain rescue'),
    ...Array.from({ length: 9 }, (_, index) => video(String(index), index + 3, 10, 'Unrelated tutorial')),
    ...Array.from({ length: 10 }, (_, index) => video(`baseline-${index}`, index + 20, 1_000, 'Validated topic')),
  ];
  const diagnosis = buildChannelDiagnosis(channel(videos), NOW);
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'BREAKOUT_NO_FOLLOWUP'), true);
});

test('Shorts and long-form receive independent format diagnoses', () => {
  const shorts = Array.from({ length: 10 }, (_, index) => video(`s${index}`, index + 1, 100_000, 'Shorts topic', 'short'));
  const longs = Array.from({ length: 10 }, (_, index) => video(`l${index}`, index + 1, 100, 'Long topic', 'long'));
  const diagnosis = buildChannelDiagnosis(channel([...shorts, ...longs]), NOW);
  assert.equal(diagnosis.shortFormDiagnosis?.format, 'SHORTS');
  assert.equal(diagnosis.longFormDiagnosis?.format, 'LONG_FORM');
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'FORMAT_CONFUSION'), true);
});

test('five consecutive near-zero videos trigger a distribution anomaly, never shadowban', () => {
  const recent = Array.from({ length: 5 }, (_, index) => video(`r${index}`, index + 1, 0, 'Validated topic'));
  const previous = Array.from({ length: 10 }, (_, index) => video(`p${index}`, index + 20, 10_000, 'Validated topic'));
  const diagnosis = buildChannelDiagnosis(channel([...recent, ...previous]), NOW);
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'RECENT_DISTRIBUTION_ANOMALY'), true);
  assert.equal(JSON.stringify(diagnosis).toLowerCase().includes('shadowban'), false);
});

test('long inactivity is an explicit issue', () => {
  const diagnosis = buildChannelDiagnosis(channel(Array.from({ length: 8 }, (_, index) => video(String(index), 120 + index, 1_000)), 800), NOW);
  assert.equal(diagnosis.channelStage, 'DORMANT');
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'LONG_INACTIVITY'), true);
});

test('topic change without performance decline is not a high-severity problem', () => {
  const recent = Array.from({ length: 8 }, (_, index) => video(`r${index}`, index + 1, 20_000, 'New science topic'));
  const previous = Array.from({ length: 8 }, (_, index) => video(`p${index}`, index + 15, 20_000, 'Old cooking topic'));
  const diagnosis = buildChannelDiagnosis(channel([...recent, ...previous]), NOW);
  const drift = diagnosis.topIssues.find(issue => issue.issueCode === 'TOPIC_DRIFT');
  assert.ok(!drift || ['LOW', 'MEDIUM'].includes(drift.severity));
});

test('a single weak video does not trigger serious decline', () => {
  const videos = [video('weak', 1, 10, 'Validated topic')].concat(Array.from({ length: 14 }, (_, index) => video(String(index), index + 2, 10_000, 'Validated topic')));
  const diagnosis = buildChannelDiagnosis(channel(videos), NOW);
  assert.equal(diagnosis.topIssues.some(issue => issue.issueCode === 'BASELINE_DECLINE' && ['HIGH', 'CRITICAL'].includes(issue.severity)), false);
});

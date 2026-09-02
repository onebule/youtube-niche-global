import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContentPatternTrendReport } from '../src/lib/content-pattern-trends.ts';

const video = (id, creatorId, title, options = {}) => ({
  videoId: id,
  creatorId,
  format: options.format || 'long',
  title,
  durationSeconds: options.durationSeconds ?? 900,
  normalizedPerformance: options.normalizedPerformance ?? 1,
  breakoutClassification: options.breakoutClassification ?? 'NORMAL',
  breakoutMultiple: options.breakoutMultiple ?? 1,
  nicheId: options.nicheId || 'niche-a',
  views: options.views ?? 100_000,
});

const windowOf = (key, videos, options = {}) => ({
  key,
  start: options.start || (key === 'current' ? '2026-08-01T00:00:00.000Z' : '2026-07-01T00:00:00.000Z'),
  end: options.end || (key === 'current' ? '2026-08-31T00:00:00.000Z' : '2026-07-31T00:00:00.000Z'),
  timeSemantics: options.timeSemantics || 'PUBLICATION_COHORT',
  videos,
});

test('missing history keeps Pattern Trend insufficient', () => {
  const report = buildContentPatternTrendReport({ current: windowOf('current', [video('v1', 'c1', 'How to build')]) });
  assert.equal(report.comparableWindow.comparable, false);
  assert.ok(report.assessments.length > 0);
  assert.ok(report.assessments.every(item => item.state === 'INSUFFICIENT'));
  assert.ok(report.selectionEvidence.every(item => item.status === 'INSUFFICIENT'));
});

test('comparable windows can classify acceleration from multiple improving dimensions', () => {
  const previous = [
    video('p1', 'c1', 'How to build', { normalizedPerformance: 1.0, breakoutClassification: 'BREAKOUT', breakoutMultiple: 3 }),
    video('p2', 'c2', 'How to build', { normalizedPerformance: 1.0, breakoutClassification: 'BREAKOUT', breakoutMultiple: 3 }),
    video('p3', 'c3', 'How to build'), video('p4', 'c1', 'How to build'), video('p5', 'c2', 'How to build'),
  ];
  const current = [
    video('c1', 'c1', 'How to build', { normalizedPerformance: 1.4, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }),
    video('c2', 'c2', 'How to build', { normalizedPerformance: 1.4, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }),
    video('c3', 'c3', 'How to build', { normalizedPerformance: 1.4, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }),
    video('c4', 'c4', 'How to build', { normalizedPerformance: 1.4, breakoutClassification: 'BREAKOUT', breakoutMultiple: 4 }),
    video('c5', 'c1', 'How to build', { normalizedPerformance: 1.4 }), video('c6', 'c2', 'How to build', { normalizedPerformance: 1.4 }),
  ];
  const report = buildContentPatternTrendReport({ current: windowOf('current', current), previous: windowOf('previous', previous) });
  const title = report.assessments.find(item => item.pattern.featureValue === 'HOW_TO');
  assert.ok(title);
  assert.equal(report.comparableWindow.comparable, true);
  assert.equal(title.state, 'ACCELERATING');
  assert.ok(title.evidence.adoption.changePct >= 0.2);
  assert.ok(title.evidence.breakoutRate.delta > 0);
});

test('rising adoption with weakening performance is dilution, not growth', () => {
  const previous = Array.from({ length: 5 }, (_, index) => video(`p${index}`, `c${index % 3}`, 'How to build', { normalizedPerformance: 1.4, breakoutClassification: index < 3 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index < 3 ? 4 : 1 }));
  const current = Array.from({ length: 10 }, (_, index) => video(`c${index}`, `creator-${index % 5}`, 'How to build', { normalizedPerformance: 0.8, breakoutClassification: index === 0 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index === 0 ? 3 : 1 }));
  const report = buildContentPatternTrendReport({ current: windowOf('current', current), previous: windowOf('previous', previous) });
  const title = report.assessments.find(item => item.pattern.featureValue === 'HOW_TO');
  assert.ok(title);
  assert.equal(title.state, 'DILUTING');
  assert.ok(title.evidence.adoption.changePct >= 0.2);
  assert.ok(title.evidence.normalizedPerformance.changePct < -0.1);
});

test('niche-pattern fit compares inside and outside samples without becoming a strategy', () => {
  const inside = Array.from({ length: 5 }, (_, index) => video(`in${index}`, `in-creator-${index % 3}`, 'How to build', { nicheId: 'target', normalizedPerformance: 1.5, breakoutClassification: index < 3 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index < 3 ? 4 : 1 }));
  const outside = Array.from({ length: 5 }, (_, index) => video(`out${index}`, `out-creator-${index % 3}`, 'How to build', { nicheId: 'other', normalizedPerformance: 1.0, breakoutClassification: index === 0 ? 'BREAKOUT' : 'NORMAL', breakoutMultiple: index === 0 ? 3 : 1 }));
  const report = buildContentPatternTrendReport({ current: windowOf('current', [...inside, ...outside]), nicheId: 'target' });
  const fit = report.nicheFits.find(item => item.pattern.featureValue === 'HOW_TO');
  assert.ok(fit);
  assert.equal(fit.status, 'TOP_FIT');
  assert.equal(fit.inside.creators, 3);
  assert.ok((fit.performanceAdvantage || 0) >= 0.15);
  assert.ok(report.selectionEvidence.every(item => !item.reasons.some(reason => /strategy|策略/i.test(reason))));
});

test('incomparable time semantics and Shorts stay isolated', () => {
  const report = buildContentPatternTrendReport({
    current: windowOf('current', [video('l1', 'c1', 'How to build'), video('s1', 'short', 'How to build', { format: 'short' })]),
    previous: windowOf('previous', [video('p1', 'c1', 'How to build')], { timeSemantics: 'CAPTURE_SNAPSHOT' }),
  });
  assert.equal(report.comparableWindow.comparable, false);
  assert.equal(report.currentReport.input.longFormVideos, 1);
  assert.equal(report.currentReport.input.excludedShorts, 1);
  assert.ok(report.assessments.every(item => item.state === 'INSUFFICIENT'));
});


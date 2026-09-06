import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorBibleSummary, creatorFlowStage, creatorShotDirection, mergeCreatorBibleIntoPrompt, normalizeCreatorProject, projectBriefToShotDraft } from '../src/lib/creator-flow.ts';

test('creator project restores safely from an incomplete local snapshot', () => {
  assert.deepEqual(normalizeCreatorProject({ title: '  夏日产品片  ', brief: '  清晨的玻璃瓶  ', format: 'landscape' }), {
    title: '夏日产品片',
    brief: '清晨的玻璃瓶',
    format: 'landscape',
    sequenceTitle: '主镜头序列',
    bible: { character: '', scene: '', style: '', camera: '', motion: '', locks: { character: false, scene: false, style: false, camera: false, motion: false } },
  });
  assert.deepEqual(normalizeCreatorProject({ title: '', format: 'unsupported' }), {
    title: '未命名项目',
    brief: '',
    format: 'short',
    sequenceTitle: '主镜头序列',
    bible: { character: '', scene: '', style: '', camera: '', motion: '', locks: { character: false, scene: false, style: false, camera: false, motion: false } },
  });
});

test('creator project keeps a creator-defined sequence title when restoring', () => {
  assert.equal(normalizeCreatorProject({ sequenceTitle: '开场到收束' }).sequenceTitle, '开场到收束');
});

test('project bible restores only meaningful locks and reports coverage', () => {
  const project = normalizeCreatorProject({ bible: { character: '同一位短发女主角', scene: '', locks: { character: true, scene: true } } });
  assert.equal(project.bible.locks.character, true);
  assert.equal(project.bible.locks.scene, false);
  assert.deepEqual(creatorBibleSummary(project.bible), { filled: 1, locked: 1 });
});

test('project bible is visible in the shot prompt and never silently truncated', () => {
  const project = normalizeCreatorProject({ bible: { character: '同一位短发女主角', scene: '雨后街道', locks: { character: true, scene: false } } });
  const applied = mergeCreatorBibleIntoPrompt('慢慢推近人物。', project, 'zh');
  assert.equal(applied.applied, true);
  assert.match(applied.prompt, /锁定，必须保留/);
  assert.match(applied.prompt, /雨后街道/);
  const revised = normalizeCreatorProject({ bible: { character: '同一位长发女主角', locks: { character: true } } });
  const reapplied = mergeCreatorBibleIntoPrompt(applied.prompt, revised, 'zh');
  assert.match(reapplied.prompt, /同一位长发女主角/);
  assert.doesNotMatch(reapplied.prompt, /同一位短发女主角/);
  assert.equal(mergeCreatorBibleIntoPrompt('x'.repeat(1190), project, 'zh').reason, 'too_long');
});

test('project bible can seed a new shot without being mistaken for a shot direction', () => {
  const project = normalizeCreatorProject({ bible: { style: '自然电影感', locks: { style: true } } });
  const draft = mergeCreatorBibleIntoPrompt('', project, 'zh');
  assert.equal(draft.applied, true);
  assert.equal(creatorShotDirection(draft.prompt), '');
  assert.equal(creatorFlowStage({ brief: '测试', hasReference: true, hasPrompt: Boolean(creatorShotDirection(draft.prompt)) }), 'direction');
});

test('project brief creates a draft only and never implies a generation', () => {
  assert.equal(projectBriefToShotDraft(normalizeCreatorProject({ title: '测试', brief: '  一只猫走过雨后的街道。 ', format: 'short' })), '一只猫走过雨后的街道。');
});

test('creator flow reports an honest next step from current evidence', () => {
  assert.equal(creatorFlowStage({ brief: '', hasReference: false, hasPrompt: false }), 'brief');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: false, hasPrompt: false }), 'reference');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: false }), 'direction');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true }), 'ready');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true, generationStatus: 'processing' }), 'rendering');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true, generationStatus: 'failed' }), 'needs_attention');
});

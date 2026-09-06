import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorFlowStage, normalizeCreatorProject, projectBriefToShotDraft } from '../src/lib/creator-flow.ts';

test('creator project restores safely from an incomplete local snapshot', () => {
  assert.deepEqual(normalizeCreatorProject({ title: '  夏日产品片  ', brief: '  清晨的玻璃瓶  ', format: 'landscape' }), {
    title: '夏日产品片',
    brief: '清晨的玻璃瓶',
    format: 'landscape',
    sequenceTitle: '主镜头序列',
  });
  assert.deepEqual(normalizeCreatorProject({ title: '', format: 'unsupported' }), {
    title: '未命名项目',
    brief: '',
    format: 'short',
    sequenceTitle: '主镜头序列',
  });
});

test('creator project keeps a creator-defined sequence title when restoring', () => {
  assert.equal(normalizeCreatorProject({ sequenceTitle: '开场到收束' }).sequenceTitle, '开场到收束');
});

test('project brief creates a draft only and never implies a generation', () => {
  assert.equal(projectBriefToShotDraft({ title: '测试', brief: '  一只猫走过雨后的街道。 ', format: 'short' }), '一只猫走过雨后的街道。');
});

test('creator flow reports an honest next step from current evidence', () => {
  assert.equal(creatorFlowStage({ brief: '', hasReference: false, hasPrompt: false }), 'brief');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: false, hasPrompt: false }), 'reference');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: false }), 'direction');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true }), 'ready');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true, generationStatus: 'processing' }), 'rendering');
  assert.equal(creatorFlowStage({ brief: '产品广告', hasReference: true, hasPrompt: true, generationStatus: 'failed' }), 'needs_attention');
});

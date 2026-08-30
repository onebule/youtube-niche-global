import test from 'node:test';
import assert from 'node:assert/strict';
import { compileH3Prompt, validateH3Prompt } from '../src/lib/h3-prompt-compiler.ts';

test('I2VA produces the required first-frame instruction and three base sections', () => {
  const result = compileH3Prompt({ mode: 'I2VA', brief: 'A baker opens a shop at dawn.', duration: '5s', hasStartFrame: true, hasEndFrame: false });
  assert.match(result.prompt, /^For the target video, at 0\.00 seconds/);
  assert.match(result.prompt, /integrated_multimodal_description:/);
  assert.match(result.prompt, /overall_soundscape:/);
  assert.match(result.prompt, /non_diegetic_music:/);
  assert.equal(result.validation.isReady, true);
});

test('FL2VA rejects an absent END frame and the unsupported three-second duration', () => {
  const result = validateH3Prompt({ mode: 'FL2VA', brief: 'A cyclist opens an umbrella.', prompt: 'integrated_multimodal_description: test\noverall_soundscape: N/A\nnon_diegetic_music: N/A', duration: '3s', hasStartFrame: true, hasEndFrame: false });
  assert.ok(result.issues.some(issue => issue.code === 'end-frame-required'));
  assert.ok(result.issues.some(issue => issue.code === 'duration-out-of-range'));
  assert.equal(result.isReady, false);
});

test('changing keyframe mode cannot leave a prompt without its alignment instruction', () => {
  const result = validateH3Prompt({ mode: 'L2VA', brief: 'A glass breaks.', prompt: 'integrated_multimodal_description: test\noverall_soundscape: N/A\nnon_diegetic_music: N/A', duration: '6s', hasStartFrame: true, hasEndFrame: true });
  assert.ok(result.issues.some(issue => issue.code === 'missing-alignment-instruction'));
  assert.equal(result.isReady, false);
});

test('Ref2VA emits all six ordered sections and includes video/audio reference labels', () => {
  const result = compileH3Prompt({ mode: 'Ref2VA', brief: 'A dog enters a cafe.', duration: '8s', hasStartFrame: true, hasEndFrame: false });
  const labels = ['subject_definitions:', 'summary:', 'retention_analysis:', 'detailed_description:', 'overall_soundscape:', 'non_diegetic_music:'];
  for (let index = 1; index < labels.length; index += 1) assert.ok(result.prompt.indexOf(labels[index - 1]) < result.prompt.indexOf(labels[index]));
  const withMedia = compileH3Prompt({ mode: 'Ref2VA', brief: 'A dog enters a cafe.', duration: '8s', hasStartFrame: true, hasEndFrame: false, referenceVideoCount: 1, referenceAudioCount: 1 });
  assert.match(withMedia.prompt, /<Video 1>/);
  assert.match(withMedia.prompt, /<Audio 1>/);
  assert.equal(withMedia.validation.isReady, true);
  assert.equal(result.validation.isReady, true);
});

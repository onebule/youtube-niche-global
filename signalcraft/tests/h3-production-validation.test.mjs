import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { H3_OUTPUT_FAILURES, validateH3Probe } from '../scripts/validate-h3-output.mjs';

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const runScript = async (script, env = {}) => {
  const { stdout } = await execFileAsync(process.execPath, [fileURLToPath(new URL(`../scripts/${script}`, import.meta.url))], {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    maxBuffer: 1_000_000,
  });
  return JSON.parse(stdout);
};

const validProbe = {
  format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '5.12' },
  streams: [
    { codec_type: 'video', width: 1344, height: 768, r_frame_rate: '24/1' },
    { codec_type: 'audio', sample_rate: '32000' },
  ],
};

test('H3 output validator accepts an authoritative MP4 with native audio', () => {
  const result = validateH3Probe({ fileSize: 1234, probe: validProbe });
  assert.equal(result.valid, true);
  assert.equal(result.state, 'OUTPUT_VALIDATED');
  assert.equal(result.audioSampleRate, 32000);
});

test('H3 output validator rejects an MP4 without audio', () => {
  const result = validateH3Probe({ fileSize: 1234, probe: { ...validProbe, streams: [validProbe.streams[0]] } });
  assert.equal(result.valid, false);
  assert.equal(result.code, H3_OUTPUT_FAILURES.MISSING_AUDIO_STREAM);
});

test('H3 output validator rejects unsupported duration before success', () => {
  const result = validateH3Probe({ fileSize: 1234, probe: { ...validProbe, format: { ...validProbe.format, duration: '4' } } });
  assert.equal(result.valid, false);
  assert.equal(result.code, H3_OUTPUT_FAILURES.INVALID_DURATION);
});

test('H3 smoke guard does not submit a generation by default', async () => {
  const result = await runScript('h3-smoke.mjs', {
    H3_SMOKE_EXECUTE: 'false',
    ALLOW_REAL_GPU_INFERENCE: 'false',
    ALLOW_PAID_GPU_INFERENCE: 'false',
  });
  assert.equal(result.state, 'MANUAL_SMOKE_NOT_REQUESTED');
  assert.equal(result.generationSubmitted, false);
  assert.equal(result.fallback, false);
  assert.equal(result.retry, false);
});

test('H3 smoke guard blocks before Modal when remote auth is absent', async () => {
  const result = await runScript('h3-smoke.mjs', {
    H3_SMOKE_EXECUTE: 'true',
    ALLOW_REAL_GPU_INFERENCE: 'true',
    H3_FREE_CREDIT_CONFIRMED: 'true',
    H3_ESTIMATED_SMOKE_COST_USD: '0',
    MODAL_TOKEN_ID: '',
    MODAL_TOKEN_SECRET: '',
    HF_TOKEN: 'redacted-test-hf-token',
    H3_HF_LICENSE_ACCEPTED: 'true',
  }).catch(error => JSON.parse(error.stdout || '{}'));
  assert.equal(result.state, 'BLOCKED_BY_MODAL_AUTH');
  assert.equal(result.generationSubmitted, false);
});

test('H3 read-only check never exposes credential values', async () => {
  const result = await runScript('h3-check.mjs', {
    MODAL_TOKEN_ID: 'redacted-test-token-id',
    MODAL_TOKEN_SECRET: 'redacted-test-token-secret',
    HF_TOKEN: 'redacted-test-hf-token',
  });
  assert.ok(['BLOCKED_BY_MODAL_AUTH', 'BLOCKED_BY_HF_AUTH', 'LICENSE_ACCEPTANCE_REQUIRED', 'BLOCKED_BY_FFPROBE', 'READY_FOR_MODEL_PREPARE'].includes(result.state));
  assert.equal(JSON.stringify(result).includes('redacted-test'), false);
  assert.equal(result.generationSubmitted, false);
});

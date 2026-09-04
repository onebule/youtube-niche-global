#!/usr/bin/env node

import { stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

export const H3_OUTPUT_FAILURES = Object.freeze({
  MISSING_FILE: 'MISSING_FILE',
  EMPTY_FILE: 'EMPTY_FILE',
  FFPROBE_UNAVAILABLE: 'FFPROBE_UNAVAILABLE',
  INVALID_CONTAINER: 'INVALID_CONTAINER',
  INVALID_DURATION: 'INVALID_DURATION',
  INVALID_VIDEO_STREAM: 'INVALID_VIDEO_STREAM',
  INVALID_FPS: 'INVALID_FPS',
  MISSING_AUDIO_STREAM: 'MISSING_AUDIO_STREAM',
  INVALID_AUDIO_STREAM: 'INVALID_AUDIO_STREAM',
});

const finite = value => Number.isFinite(Number(value));

export function validateH3Probe({ fileSize, probe }) {
  if (!finite(fileSize) || Number(fileSize) <= 0) return { valid: false, code: H3_OUTPUT_FAILURES.EMPTY_FILE };
  const format = probe?.format || {};
  const formatNames = String(format.format_name || '').toLowerCase().split(',').map(value => value.trim());
  if (!formatNames.includes('mp4')) return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_CONTAINER };

  const duration = Number(format.duration);
  if (!Number.isFinite(duration) || duration < 5 || duration > 15) return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_DURATION, duration };

  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const video = streams.find(stream => stream.codec_type === 'video');
  if (!video || !finite(video.width) || !finite(video.height) || Number(video.width) <= 0 || Number(video.height) <= 0) {
    return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_VIDEO_STREAM };
  }
  if (Number(video.width) % 32 !== 0 || Number(video.height) % 32 !== 0) {
    return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_VIDEO_STREAM, width: Number(video.width), height: Number(video.height) };
  }
  const [fpsNumerator, fpsDenominator] = String(video.r_frame_rate || '').split('/').map(Number);
  const fps = fpsDenominator ? fpsNumerator / fpsDenominator : Number(video.r_frame_rate);
  if (!Number.isFinite(fps) || Math.abs(fps - 24) > 0.01) return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_FPS, fps };

  const audio = streams.find(stream => stream.codec_type === 'audio');
  if (!audio) return { valid: false, code: H3_OUTPUT_FAILURES.MISSING_AUDIO_STREAM };
  if (!finite(audio.sample_rate) || Number(audio.sample_rate) <= 0) return { valid: false, code: H3_OUTPUT_FAILURES.INVALID_AUDIO_STREAM };
  return {
    valid: true,
    state: 'OUTPUT_VALIDATED',
    container: 'mp4',
    duration,
    width: Number(video.width),
    height: Number(video.height),
    fps,
    audioSampleRate: Number(audio.sample_rate),
  };
}

export async function validateH3Output(filePath, { ffprobePath = 'ffprobe' } = {}) {
  let file;
  try {
    file = await stat(filePath);
  } catch {
    return { valid: false, state: 'FAILED_OUTPUT_VALIDATION', code: H3_OUTPUT_FAILURES.MISSING_FILE, filePath };
  }
  if (!file.isFile() || file.size <= 0) return { valid: false, state: 'FAILED_OUTPUT_VALIDATION', code: H3_OUTPUT_FAILURES.EMPTY_FILE, filePath };
  let stdout;
  try {
    ({ stdout } = await execFileAsync(ffprobePath, [
      '-v', 'error',
      '-show_entries', 'format=format_name,duration:stream=codec_type,width,height,r_frame_rate,sample_rate',
      '-of', 'json',
      filePath,
    ], { maxBuffer: 1_000_000, windowsHide: true }));
  } catch (error) {
    const code = error?.code === 'ENOENT' ? H3_OUTPUT_FAILURES.FFPROBE_UNAVAILABLE : 'FFPROBE_FAILED';
    return { valid: false, state: 'FAILED_OUTPUT_VALIDATION', code, filePath };
  }
  let probe;
  try { probe = JSON.parse(stdout); } catch { return { valid: false, state: 'FAILED_OUTPUT_VALIDATION', code: 'FFPROBE_INVALID_JSON', filePath }; }
  const result = validateH3Probe({ fileSize: file.size, probe });
  return result.valid ? { filePath, ...result } : { filePath, state: 'FAILED_OUTPUT_VALIDATION', ...result };
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === process.argv[1].toLowerCase()) {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(JSON.stringify({ valid: false, state: 'FAILED_OUTPUT_VALIDATION', code: H3_OUTPUT_FAILURES.MISSING_FILE }));
    process.exitCode = 2;
  } else {
    const result = await validateH3Output(filePath);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 0 : 1;
  }
}

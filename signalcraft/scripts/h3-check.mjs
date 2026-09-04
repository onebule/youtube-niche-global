#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const truthy = value => String(value || '').trim().toLowerCase() === 'true';
const configured = value => Boolean(String(value || '').trim());

async function commandAvailable(command) {
  try {
    await execFileAsync(process.platform === 'win32' ? 'where.exe' : 'which', [command], { windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

async function readNodeHealth() {
  const endpoint = (process.env.H3_BENCHMARK_ENDPOINT || 'http://127.0.0.1:8787').replace(/\/$/, '');
  try {
    const response = await fetch(`${endpoint}/health`, { signal: AbortSignal.timeout(3_000), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return { reachable: response.ok, status: response.status, inferenceState: body.inferenceState || 'UNKNOWN', executionState: body.executionState || 'UNKNOWN' };
  } catch {
    return { reachable: false, status: null, inferenceState: 'UNREACHABLE', executionState: 'UNKNOWN' };
  }
}

const modalCli = await commandAvailable('modal');
const ffprobe = await commandAvailable('ffprobe');
const modalAuth = configured(process.env.MODAL_TOKEN_ID) && configured(process.env.MODAL_TOKEN_SECRET);
const hfAuth = configured(process.env.HF_TOKEN) || configured(process.env.HUGGINGFACE_HUB_TOKEN);
const licenseAccepted = truthy(process.env.H3_HF_LICENSE_ACCEPTED);
const health = await readNodeHealth();
let state = 'BLOCKED_BY_MODAL_AUTH';
if (!modalCli || !modalAuth) state = 'BLOCKED_BY_MODAL_AUTH';
else if (!hfAuth) state = 'BLOCKED_BY_HF_AUTH';
else if (!licenseAccepted) state = 'LICENSE_ACCEPTANCE_REQUIRED';
else if (!ffprobe) state = 'BLOCKED_BY_FFPROBE';
else state = 'READY_FOR_MODEL_PREPARE';

const result = {
  schemaVersion: 'h3-check.v1',
  readOnly: true,
  state,
  modal: { cli: modalCli, auth: modalAuth },
  huggingFace: { auth: hfAuth, licenseAccepted },
  ffprobe: { available: ffprobe },
  node: health,
  generationSubmitted: false,
};
console.log(JSON.stringify(result, null, 2));

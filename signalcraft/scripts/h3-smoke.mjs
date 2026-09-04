#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const execute = process.env.H3_SMOKE_EXECUTE === 'true';
const realGpu = process.env.ALLOW_REAL_GPU_INFERENCE === 'true';
const paidGpu = process.env.ALLOW_PAID_GPU_INFERENCE === 'true';
const freeCredit = process.env.H3_FREE_CREDIT_CONFIRMED === 'true';
const cost = Number(process.env.H3_ESTIMATED_SMOKE_COST_USD);
const maxCost = Number(process.env.MAX_REAL_SMOKE_TEST_COST_USD || 0);
const modalAuth = Boolean(process.env.MODAL_TOKEN_ID?.trim() && process.env.MODAL_TOKEN_SECRET?.trim());
const hfAuth = Boolean(process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim());
const licenseAccepted = process.env.H3_HF_LICENSE_ACCEPTED === 'true';

const blocked = !execute ? 'MANUAL_SMOKE_NOT_REQUESTED' : !modalAuth ? 'BLOCKED_BY_MODAL_AUTH' : !hfAuth ? 'BLOCKED_BY_HF_AUTH' : !licenseAccepted ? 'LICENSE_ACCEPTANCE_REQUIRED' : !realGpu ? 'BLOCKED_BY_REAL_GPU_GUARD' : (!paidGpu && !freeCredit) ? 'BLOCKED_BY_FREE_CREDIT_GUARD' : !Number.isFinite(cost) ? 'BLOCKED_BY_COST_ESTIMATE' : cost > maxCost ? 'BLOCKED_BY_COST_GUARD' : null;
if (blocked) {
  console.log(JSON.stringify({ schemaVersion: 'h3-smoke.v1', state: blocked, generationSubmitted: false, fallback: false, retry: false }, null, 2));
  process.exit(blocked === 'MANUAL_SMOKE_NOT_REQUESTED' ? 0 : 1);
}

try {
  const command = process.platform === 'win32' ? 'modal.exe' : 'modal';
  const { stdout, stderr } = await execFileAsync(command, ['run', 'modal_app.py::smoke'], {
    cwd: fileURLToPath(new URL('../services/h3-compute-node/modal/', import.meta.url)),
    env: process.env,
    windowsHide: true,
    maxBuffer: 2_000_000,
  });
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
} catch (error) {
  console.error(JSON.stringify({ schemaVersion: 'h3-smoke.v1', state: 'SMOKE_FAILED', code: error?.code || 'MODAL_SMOKE_FAILED', generationSubmitted: false }, null, 2));
  process.exitCode = 1;
}

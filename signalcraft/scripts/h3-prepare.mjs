#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const allowed = process.env.H3_PREPARE_ALLOW_REMOTE === 'true';
const modalCommand = process.platform === 'win32' ? 'modal.exe' : 'modal';
const modalAuth = Boolean(process.env.MODAL_TOKEN_ID?.trim() && process.env.MODAL_TOKEN_SECRET?.trim());
const hfAuth = Boolean(process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim());
const licenseAccepted = process.env.H3_HF_LICENSE_ACCEPTED === 'true';

if (!allowed) {
  console.log(JSON.stringify({ schemaVersion: 'h3-prepare.v1', state: 'PREPARE_NOT_STARTED', reason: 'Set H3_PREPARE_ALLOW_REMOTE=true only after h3-check is READY_FOR_MODEL_PREPARE.', generationSubmitted: false }, null, 2));
  process.exit(0);
}
if (!modalAuth) {
  console.log(JSON.stringify({ schemaVersion: 'h3-prepare.v1', state: 'BLOCKED_BY_MODAL_AUTH', generationSubmitted: false }, null, 2));
  process.exit(1);
}
if (!hfAuth) {
  console.log(JSON.stringify({ schemaVersion: 'h3-prepare.v1', state: 'BLOCKED_BY_HF_AUTH', generationSubmitted: false }, null, 2));
  process.exit(1);
}
if (!licenseAccepted) {
  console.log(JSON.stringify({ schemaVersion: 'h3-prepare.v1', state: 'LICENSE_ACCEPTANCE_REQUIRED', generationSubmitted: false }, null, 2));
  process.exit(1);
}

try {
  const { stdout, stderr } = await execFileAsync(modalCommand, ['run', 'modal_app.py::prepare_model'], {
    cwd: fileURLToPath(new URL('../services/h3-compute-node/modal/', import.meta.url)),
    env: process.env,
    windowsHide: true,
    maxBuffer: 2_000_000,
  });
  process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
} catch (error) {
  console.error(JSON.stringify({ schemaVersion: 'h3-prepare.v1', state: 'PREPARE_FAILED', code: error?.code || 'MODAL_PREPARE_FAILED', generationSubmitted: false }, null, 2));
  process.exitCode = 1;
}

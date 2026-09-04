#!/usr/bin/env node

/**
 * Safe H3 benchmark harness. It is read-only by default and records a
 * CALIBRATION_REQUIRED result. A live generation benchmark must be explicitly
 * opted into outside this repository; this script never submits a paid job by
 * accident.
 */
import { writeFile } from 'node:fs/promises';

const endpoint = (process.env.H3_BENCHMARK_ENDPOINT || 'http://127.0.0.1:8787').replace(/\/$/, '');
const live = process.env.H3_BENCHMARK_ALLOW_LIVE === 'true';
const startedAt = new Date().toISOString();
const rows = [];

async function read(path) {
  const response = await fetch(`${endpoint}${path}`, { signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

for (const workflow of ['T2V', 'I2V']) {
  const row = { workflow, resolution: null, duration: null, steps: null, coldStart: null, modelLoad: null, generationTime: null, peakVram: null, estimatedCost: null, success: false, state: 'CALIBRATION_REQUIRED' };
  try {
    const health = await read('/health');
    row.nodeStatus = health.body?.inferenceState || 'UNKNOWN';
    row.success = health.status === 200 && health.body?.inferenceState === 'MODEL_READY' && live;
    row.note = live ? 'Live submission is intentionally not implemented by the safe harness.' : 'Read-only health/capability check; no generation submitted.';
  } catch (error) {
    row.note = error instanceof Error ? error.message : 'Node unavailable.';
  }
  rows.push(row);
}

const result = { schemaVersion: 'h3-benchmark.v1', startedAt, finishedAt: new Date().toISOString(), endpoint, liveRequested: live, calibrationStatus: 'CALIBRATION_REQUIRED', rows };
const output = process.env.H3_BENCHMARK_OUTPUT || 'h3-benchmark.json';
await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(`H3 benchmark · ${live ? 'live flag requested' : 'safe read-only mode'}`);
for (const row of rows) console.log(`${row.workflow.padEnd(4)} · ${row.nodeStatus || 'UNREACHABLE'} · ${row.success ? 'success' : 'not measured'} · ${row.note}`);
console.log(`JSON: ${output}`);

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sanitizeHfError } from './normalizer.ts';

export type HfBridgeCheck = {
  ok: boolean;
  auth: 'AUTH_VERIFIED' | 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'AUTH_UNVERIFIED' | 'UNKNOWN';
  reachability: 'REACHABLE' | 'UNREACHABLE' | 'SLEEPING' | 'BUILDING' | 'ERROR' | 'UNKNOWN';
  runtime: string | null;
  hardware: string | null;
  quota: 'REMAINING' | 'EXHAUSTED' | 'UNKNOWN';
  apiInfo: unknown;
  providerReport?: Record<string, unknown>;
  code?: string;
  message?: string;
};

export type HfBridgeSmoke = {
  ok: boolean;
  providerTaskId?: string;
  state?: string;
  result?: unknown;
  providerReport?: Record<string, unknown>;
  code?: string;
  message?: string;
};

export type HfZeroGpuBridge = {
  check: (input: { space: string; token: string }) => Promise<HfBridgeCheck>;
  smoke: (input: { space: string; token: string; invocation: unknown; maxWaitSeconds: number }) => Promise<HfBridgeSmoke>;
};

const bridgePath = fileURLToPath(new URL('../../../../services/hf-zerogpu/gradio_bridge.py', import.meta.url));
const command = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
const argsFor = (action: string) => process.platform === 'win32' && !process.env.PYTHON ? ['-3', bridgePath, '--action', action] : [bridgePath, '--action', action];

function run(action: string, input: Record<string, unknown>, timeoutMs: number): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsFor(action), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error(`${action} bridge timeout`)); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += String(chunk); if (stdout.length > 1_500_000) child.kill(); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(sanitizeHfError(stderr || `HF bridge exited with code ${code}.`)));
      try {
        const parsed = JSON.parse(stdout.trim()) as Record<string, unknown>;
        resolve(parsed);
      } catch {
        reject(new Error('HF bridge returned malformed JSON.'));
      }
    });
    child.stdin.end(JSON.stringify(input));
  });
}

export function createHfZeroGpuBridge(): HfZeroGpuBridge {
  return {
    async check(input) {
      try { return await run('check', input, 25_000) as HfBridgeCheck; }
      catch (error) { return { ok: false, auth: 'UNKNOWN', reachability: 'UNKNOWN', runtime: null, hardware: null, quota: 'UNKNOWN', apiInfo: null, code: 'HF_BRIDGE_UNAVAILABLE', message: sanitizeHfError(error) }; }
    },
    async smoke(input) {
      try { return await run('smoke', input, Math.max(30_000, input.maxWaitSeconds * 1000 + 30_000)) as HfBridgeSmoke; }
      catch (error) { return { ok: false, code: 'HF_BRIDGE_UNAVAILABLE', message: sanitizeHfError(error) }; }
    },
  };
}

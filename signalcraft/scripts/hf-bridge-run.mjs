import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bridgePath = fileURLToPath(new URL('../services/hf-zerogpu/gradio_bridge.py', import.meta.url));
const command = process.env.PYTHON || (process.platform === 'win32' ? 'py' : 'python3');
const argsFor = action => process.platform === 'win32' && !process.env.PYTHON ? ['-3', bridgePath, '--action', action] : [bridgePath, '--action', action];

export function runHfBridge(action, payload, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, argsFor(action), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${action} bridge timeout`)); }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += String(chunk); });
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(stderr.slice(0, 500) || `bridge exited ${code}`));
      try { resolve(JSON.parse(stdout.trim() || '{}')); } catch { reject(new Error('HF bridge returned malformed JSON.')); }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export function endpointAndInputs(apiInfo) {
  const root = apiInfo && typeof apiInfo === 'object' ? apiInfo : {};
  const named = root.named_endpoints || root.namedEndpoints || root.endpoints || {};
  const entries = Object.entries(named).filter(([name]) => !/health|status|queue|cancel/i.test(name));
  entries.sort((a, b) => score(b) - score(a));
  const [name, endpoint] = entries[0] || [null, {}];
  const parameters = Array.isArray(endpoint?.parameters) ? endpoint.parameters : Array.isArray(endpoint?.inputs) ? endpoint.inputs : [];
  return { endpoint: name ? (name.startsWith('/') ? name : `/${name}`) : null, parameters };
}
const score = ([name, endpoint]) => (/(generate|predict|inference|run)/i.test(name) ? 4 : 0) + (/(prompt|text)/i.test(JSON.stringify(endpoint)) ? 3 : 0) + (/(video|duration|seed|steps)/i.test(JSON.stringify(endpoint)) ? 2 : 0);

export function buildInvocation(apiInfo, request) {
  const { endpoint, parameters } = endpointAndInputs(apiInfo);
  if (!endpoint || !parameters.length) return null;
  const args = parameters.map(item => {
    const name = String(item?.name || item?.parameter_name || item?.label || '').toLowerCase();
    const fallback = item?.default ?? item?.defaultValue ?? null;
    if (/negative|avoid|exclude/.test(name)) return request.negativePrompt || fallback || '';
    if (/prompt|text|caption|description/.test(name)) return request.prompt;
    if (/duration|seconds|length/.test(name)) return request.durationSeconds;
    if (/step|inference/.test(name)) return request.steps ?? fallback ?? 12;
    if (/seed/.test(name)) return request.seed ?? 42;
    if (/upsample|enhance/.test(name)) return false;
    if (/canvas|aspect|ratio/.test(name)) return request.aspectRatio || '16:9';
    if (/resolution|size/.test(name)) return request.resolution || '544x960';
    if (/audio|sound/.test(name)) return false;
    return fallback;
  });
  return { endpoint, args };
}

export function containsMp4(value, seen = new Set()) {
  if (value === null || value === undefined || seen.has(value)) return false;
  if (typeof value === 'string') return /\.mp4(?:[?#].*)?$/i.test(value);
  if (typeof value !== 'object') return false;
  seen.add(value);
  return Object.entries(value).some(([key, item]) => /video|file|path|url|output/i.test(key) && containsMp4(item, seen)) || Object.values(value).some(item => containsMp4(item, seen));
}

export function blockedStatus(code) {
  const normalized = String(code || '').toUpperCase();
  if (normalized.includes('AUTH')) return 'BLOCKED_BY_HF_AUTH';
  if (normalized.includes('QUOTA')) return 'BLOCKED_BY_HF_QUOTA';
  if (normalized.includes('API')) return 'BLOCKED_BY_API_CHANGE';
  if (normalized.includes('SPACE') || normalized.includes('QUEUE') || normalized.includes('UNREACHABLE')) return 'BLOCKED_BY_SPACE';
  return 'REAL_HF_ZEROGPU_H3_FAILED';
}

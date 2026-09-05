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
  return { endpoint: name ? (name.startsWith('/') ? name : `/${name}`) : null, parameters, capabilities: summarizeHfSpaceCapabilities(apiInfo, parameters) };
}
const score = ([name, endpoint]) => (/(generate|predict|inference|run)/i.test(name) ? 4 : 0) + (/(prompt|text)/i.test(JSON.stringify(endpoint)) ? 3 : 0) + (/(video|duration|seed|steps)/i.test(JSON.stringify(endpoint)) ? 2 : 0);

function summarizeHfSpaceCapabilities(apiInfo, parameters) {
  const strings = [];
  const collect = value => {
    if (typeof value === 'string') { if (value.length <= 120) strings.push(value); return; }
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(apiInfo);
  const presetInput = parameters.find(item => /preset/i.test(`${item?.name || ''} ${item?.label || ''}`));
  const choices = [...(presetInput?.choices || []), ...strings].filter(value => typeof value === 'string' && /(?:turbo|fast|balanced|exact|cache)/i.test(value) && /(?:step|overall|faster|quality|cache)/i.test(value));
  const presets = [...new Set(choices)].map(value => ({ value, steps: Number(value.match(/(\d+)\s*-?\s*step/i)?.[1] || '') || null, acceleration: /turbo|fast/i.test(value) ? 'Exact' : null }));
  const durationInput = parameters.find(item => /duration|seconds|length/i.test(`${item?.name || ''} ${item?.label || ''}`));
  const canvasInput = parameters.find(item => /canvas|aspect|ratio/i.test(`${item?.name || ''} ${item?.label || ''}`));
  const stepsInput = parameters.find(item => /step|inference/i.test(`${item?.name || ''} ${item?.label || ''}`));
  return {
    presets,
    defaultPreset: typeof presetInput?.default === 'string' ? presetInput.default : typeof presetInput?.parameter_default === 'string' ? presetInput.parameter_default : null,
    duration: { min: Number.isFinite(Number(durationInput?.min)) ? Number(durationInput.min) : null, max: Number.isFinite(Number(durationInput?.max)) ? Number(durationInput.max) : null, default: Number.isFinite(Number(durationInput?.default ?? durationInput?.parameter_default)) ? Number(durationInput.default ?? durationInput.parameter_default) : null },
    steps: { min: Number.isFinite(Number(stepsInput?.min)) ? Number(stepsInput.min) : null, max: Number.isFinite(Number(stepsInput?.max)) ? Number(stepsInput.max) : null, default: Number.isFinite(Number(stepsInput?.default ?? stepsInput?.parameter_default)) ? Number(stepsInput.default ?? stepsInput.parameter_default) : null },
    canvasChoices: (canvasInput?.choices || []).filter(value => typeof value === 'string'),
  };
}

export function estimateHfQuotaSeconds({ durationSeconds = 5, resolution = '960x544', steps = 10, gpuSize = process.env.H3_GPU_SIZE || 'xlarge' } = {}) {
  const dimensions = String(resolution).match(/(\d{3,5})\s*x\s*(\d{3,5})/i);
  const width = dimensions ? Number(dimensions[1]) : 960;
  const height = dimensions ? Number(dimensions[2]) : 544;
  const fps = 24;
  const framesPerChunk = 17;
  const latentsPerChunk = 5;
  let frames = Math.max(1, Math.round(Number(durationSeconds) * fps));
  while (frames % framesPerChunk !== latentsPerChunk) frames += 1;
  const latentFrames = Math.floor((frames - latentsPerChunk) / framesPerChunk) * latentsPerChunk + 2;
  const patches = Math.max(1, Math.floor(height / 32) * Math.floor(width / 32));
  const rows = latentFrames * patches;
  const denoise = Number(steps || 10) * (1.1745e-4 * rows + 3.8396e-9 * rows ** 2);
  const decode = 15 + 15 * (height * width * frames) / (960 * 544 * 124);
  const singleGpuSeconds = Math.max(60, Math.floor(denoise + decode) + 12 + 10);
  return singleGpuSeconds * (String(gpuSize).toLowerCase() === 'xlarge' ? 2 : 1);
}

const fallbackCanvas = { '16:9': '960x544 \u00b7 16:9 fast', '9:16': '544x960 \u00b7 9:16 fast', '1:1': '544x544 \u00b7 1:1 fast', '4:3': '768x576 \u00b7 4:3 fast', '3:4': '576x768 \u00b7 3:4 fast', '21:9': '1152x512 \u00b7 21:9 fast' };
const canvasFor = (item, requested) => {
  const ratio = requested || '16:9';
  const choices = Array.isArray(item?.choices) ? item.choices.filter(value => typeof value === 'string') : [];
  const matching = choices.filter(value => value.includes(ratio));
  if (matching.length) return matching.find(value => /fast/i.test(value)) || matching[0];
  return ratio.includes('\u00b7') ? ratio : fallbackCanvas[ratio] || ratio;
};

export function buildInvocation(apiInfo, request) {
  const { endpoint, parameters, capabilities } = endpointAndInputs(apiInfo);
  if (!endpoint || !parameters.length) return null;
  const preset = (capabilities?.presets || []).find(item => /4\s*-?\s*step/i.test(String(item.value)))
    || (capabilities?.presets || []).find(item => /turbo|fast/i.test(String(item.value)))
    || null;
  const args = parameters.map(item => {
    // Gradio often exposes generic parameter_name values (in_0, in_1, ...)
    // while the live label carries the actual semantic contract.
    const name = String(item?.name || item?.label || item?.parameter_name || item?.parameterName || '').toLowerCase();
    const fallback = item?.default ?? item?.defaultValue ?? item?.parameter_default ?? item?.parameterDefault ?? null;
    if (/negative|avoid|exclude/.test(name)) return request.negativePrompt || fallback || '';
    if (/upsample|enhance/.test(name)) return false;
    if (/prompt|text|caption|description/.test(name)) return request.prompt;
    if (/duration|seconds|length/.test(name)) return request.durationSeconds;
    if (/step|inference/.test(name)) return preset?.steps ?? request.steps ?? fallback ?? 10;
    if (/seed/.test(name)) return request.seed ?? 42;
    if (/canvas|aspect|ratio/.test(name)) return canvasFor(item, request.aspectRatio);
    if (/resolution|size/.test(name)) return request.resolution || '544x960';
    if (/generation.?preset|speed.?preset/.test(name)) return preset?.value ?? fallback;
    if (/acceleration|schedule|cache/.test(name)) return preset?.acceleration ?? fallback;
    if (/audio|sound/.test(name)) return false;
    return fallback;
  });
  return { endpoint, args, selectedPreset: preset };
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

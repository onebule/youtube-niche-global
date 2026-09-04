import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const port = Number(process.env.H3_COMPUTE_NODE_PORT || 8787);
const dryRun = String(process.env.H3_COMPUTE_NODE_DRY_RUN || 'true').toLowerCase() === 'true';
const modelCacheDir = String(process.env.H3_MODEL_CACHE_DIR || '').trim() || null;
const modelVersion = String(process.env.H3_MODEL_VERSION || '').trim() || 'unversioned';
const modelCacheReady = String(process.env.H3_MODEL_CACHE_READY || 'false').toLowerCase() === 'true';
const modelCacheLoading = String(process.env.H3_MODEL_CACHE_LOADING || 'false').toLowerCase() === 'true';
const inferenceReadySignal = String(process.env.H3_COMPUTE_NODE_INFERENCE_READY || 'false').toLowerCase() === 'true';
const inferenceReady = inferenceReadySignal && (!modelCacheDir || modelCacheReady);
const modelCacheState = inferenceReady ? 'MODEL_READY' : modelCacheLoading ? 'MODEL_LOADING' : 'MODEL_MISSING';
const jobs = new Map();
const supportedWorkflows = ['T2V', 'I2V'];
const hardwareProfile = String(process.env.H3_MODAL_PROFILE || 'H3_MODAL_RELIABLE').trim() || 'H3_MODAL_RELIABLE';
const precision = String(process.env.H3_PRECISION || 'BF16').trim() || 'BF16';
const resolution = String(process.env.H3_SMOKE_RESOLUTION || '768x1344').trim() || '768x1344';
const durationSeconds = Number(process.env.H3_SMOKE_DURATION_SECONDS || 5);
const cudaReady = String(process.env.H3_CUDA_READY || 'false').toLowerCase() === 'true';
const runtimeReady = String(process.env.H3_RUNTIME_READY || 'false').toLowerCase() === 'true';
const serializationReady = String(process.env.H3_SERIALIZATION_READY || 'false').toLowerCase() === 'true';
const outputValidationReady = String(process.env.H3_OUTPUT_VALIDATION_READY || 'false').toLowerCase() === 'true';
const executionReady = inferenceReady && cudaReady && runtimeReady && serializationReady && outputValidationReady;

const json = (response, status, payload) => {
  const body = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(body);
};

const readBody = request => new Promise((resolve, reject) => {
  let raw = '';
  request.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('body too large')); });
  request.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('invalid json')); } });
  request.on('error', reject);
});

function capabilities() {
  return {
    service: 'h3-compute-node',
    model: 'MiniMax-H3',
    implementationState: 'INTEGRATION_READY',
    serviceState: 'SERVICE_READY',
    runtimeState: runtimeReady ? 'RUNTIME_READY' : 'RUNTIME_UNVERIFIED',
    cudaState: cudaReady ? 'CUDA_READY' : 'CUDA_UNVERIFIED',
    inferenceState: modelCacheState,
    gpuState: cudaReady ? 'GPU_READY' : 'GPU_UNVERIFIED',
    executionState: executionReady ? 'READY_FOR_MANUAL_SMOKE_TEST' : 'BLOCKED_BY_CALIBRATION',
    hardwareProfile,
    precision,
    quantization: 'NONE',
    supportedResolution: resolution,
    supportedDurationSeconds: { min: 5, max: 15, smoke: Number.isFinite(durationSeconds) ? durationSeconds : 5 },
    audio: { enabled: true, mode: 'JOINT_DENOISE_NATIVE_AUDIO', postHocMixing: false },
    serializationState: serializationReady ? 'SERIALIZATION_VERIFIED' : 'SERIALIZATION_UNVERIFIED',
    outputValidationState: outputValidationReady ? 'FFPROBE_VERIFIED' : 'FFPROBE_UNVERIFIED',
    modelCache: {
      modelId: 'MiniMax-H3',
      version: modelVersion,
      location: modelCacheDir,
      state: modelCacheState,
      persistent: Boolean(modelCacheDir),
      calibrationStatus: 'CALIBRATION_REQUIRED',
    },
    supportedWorkflows,
    reservedWorkflows: ['FL2V', 'REF2V'],
    unsupportedWorkflowBehavior: 'UNSUPPORTED_WORKFLOW',
    dryRun,
    calibrationStatus: 'CALIBRATION_REQUIRED',
  };
}

async function handler(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && url.pathname === '/health') return json(response, 200, { ok: true, ...capabilities() });
  if (request.method === 'GET' && url.pathname === '/capabilities') return json(response, 200, capabilities());
  if (request.method === 'GET' && url.pathname.startsWith('/jobs/')) {
    const id = decodeURIComponent(url.pathname.slice('/jobs/'.length));
    const job = jobs.get(id);
    return job ? json(response, 200, job) : json(response, 404, { code: 'JOB_NOT_FOUND', error: 'Job not found.' });
  }
  if (request.method === 'POST' && url.pathname.startsWith('/jobs/') && url.pathname.endsWith('/cancel')) {
    const id = decodeURIComponent(url.pathname.slice('/jobs/'.length, -'/cancel'.length));
    const job = jobs.get(id);
    if (!job) return json(response, 404, { code: 'JOB_NOT_FOUND', error: 'Job not found.' });
    job.status = 'CANCELLED';
    job.completedAt = new Date().toISOString();
    return json(response, 200, job);
  }
  if (request.method === 'POST' && url.pathname === '/jobs') {
    let body;
    try { body = await readBody(request); } catch { return json(response, 422, { code: 'INVALID_INPUT', error: 'Invalid JSON body.' }); }
    const workflow = String(body.workflow || '').toUpperCase();
    if (!supportedWorkflows.includes(workflow)) return json(response, 422, { code: 'UNSUPPORTED_WORKFLOW', error: `Workflow ${workflow || 'unknown'} is not supported by this node.` });
    if (String(body.model || 'MiniMax-H3').toLowerCase() !== 'minimax-h3') return json(response, 422, { code: 'INVALID_INPUT', error: 'Only MiniMax-H3 is accepted by this node.' });
    if (!inferenceReady && !dryRun) return json(response, 503, { code: 'MODEL_MISSING', error: 'H3 weights are not installed on this node.' });
    const id = randomUUID();
    const submittedAt = new Date().toISOString();
    const job = { jobId: id, providerTaskId: id, status: 'QUEUED', submittedAt, processingAt: null, completedAt: null, output: null, dryRun, executionState: inferenceReady ? 'READY' : 'DRY_RUN_ONLY' };
    jobs.set(id, job);
    return json(response, 202, job);
  }
  return json(response, 404, { code: 'NOT_FOUND', error: 'Not found.' });
}

createServer((request, response) => { handler(request, response).catch(() => json(response, 500, { code: 'INTERNAL_ERROR', error: 'Internal error.' })); }).listen(port, () => {
  console.log(JSON.stringify({ event: 'h3_compute_node.started', port, dryRun, inferenceReady }));
});

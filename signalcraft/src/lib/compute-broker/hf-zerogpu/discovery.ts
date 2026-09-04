import type { VideoGenerationRequest } from '../types.ts';

export type HfInputSpec = {
  index: number;
  name: string;
  label: string;
  kind: string;
  required: boolean;
  defaultValue: unknown;
  min: number | null;
  max: number | null;
  choices: unknown[];
};

export type HfH3ApiSchema = {
  schemaVersion: 'hf-h3-api.v1';
  space: string;
  endpoint: string | null;
  inputs: HfInputSpec[];
  outputs: unknown[];
  discoveredAt: string;
  compatible: boolean;
  errorCode: 'HF_API_INCOMPATIBLE' | 'HF_API_CHANGED' | null;
  reason: string | null;
};

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : null;
const list = (value: unknown) => Array.isArray(value) ? value : [];
const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;

function endpointEntries(payload: unknown): Array<[string, Record<string, unknown>]> {
  const root = record(payload);
  const candidates = [root.named_endpoints, root.namedEndpoints, root.endpoints, record(root.api).named_endpoints];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    return Object.entries(candidate as Record<string, unknown>).map(([name, value]) => [name, record(value)]);
  }
  if (text(root.api_name) || text(root.apiName)) return [[text(root.api_name) || text(root.apiName) || '/generate', root]];
  return [];
}

function parameterSpecs(endpoint: Record<string, unknown>): HfInputSpec[] {
  const raw = list(endpoint.parameters || endpoint.inputs || endpoint.input_components || endpoint.inputComponents);
  return raw.map((item, index) => {
    const value = record(item);
    const parameter = record(value.parameter);
    const name = text(value.name) || text(value.parameter_name) || text(value.parameterName) || text(parameter.name) || `input_${index}`;
    const label = text(value.label) || text(parameter.label) || name;
    const type = text(value.type) || text(value.component) || text(value.python_type) || text(parameter.type) || 'unknown';
    const defaultValue = value.default ?? value.defaultValue ?? parameter.default ?? null;
    const required = Boolean(value.required ?? parameter.required ?? (defaultValue === null && !/image|file|audio|video/i.test(`${name} ${label}`)));
    const range = record(value.range || value.metadata);
    return {
      index,
      name,
      label,
      kind: type,
      required,
      defaultValue,
      min: numberOrNull(value.min ?? range.min),
      max: numberOrNull(value.max ?? range.max),
      choices: list(value.enum || value.choices || value.options),
    };
  });
}

function endpointScore(name: string, endpoint: Record<string, unknown>) {
  const haystack = `${name} ${JSON.stringify(endpoint)}`.toLowerCase();
  let score = 0;
  if (/generate|predict|inference|run/.test(name.toLowerCase())) score += 4;
  if (/prompt|text/.test(haystack)) score += 3;
  if (/video|duration|seed|steps|canvas/.test(haystack)) score += 2;
  if (/health|status|queue|cancel/.test(name.toLowerCase())) score -= 8;
  return score;
}

export function discoverHfH3Api(payload: unknown, space = 'MiniMaxAI/MiniMax-H3-Turbo-Lora'): HfH3ApiSchema {
  const entries = endpointEntries(payload);
  const selected = entries.sort((a, b) => endpointScore(b[0], b[1]) - endpointScore(a[0], a[1]))[0];
  if (!selected) return { schemaVersion: 'hf-h3-api.v1', space, endpoint: null, inputs: [], outputs: [], discoveredAt: new Date().toISOString(), compatible: false, errorCode: 'HF_API_INCOMPATIBLE', reason: 'Space 没有公开 named endpoint，不能安全推断生成接口。' };
  const [endpointName, endpoint] = selected;
  const inputs = parameterSpecs(endpoint);
  const outputs = list(endpoint.returns || endpoint.outputs || endpoint.output_components);
  const hasPrompt = inputs.some(input => /prompt|text|caption|description/i.test(`${input.name} ${input.label}`));
  const hasVideoOutput = outputs.length === 0 || outputs.some(output => /video|file|filepath|mp4/i.test(JSON.stringify(output)));
  const compatible = hasPrompt && hasVideoOutput;
  return {
    schemaVersion: 'hf-h3-api.v1', space, endpoint: endpointName.startsWith('/') ? endpointName : `/${endpointName}`,
    inputs, outputs, discoveredAt: new Date().toISOString(), compatible,
    errorCode: compatible ? null : 'HF_API_CHANGED',
    reason: compatible ? null : '已发现 endpoint，但 prompt 或视频输出契约无法验证。',
  };
}

const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const matches = (input: HfInputSpec, patterns: RegExp[]) => patterns.some(pattern => pattern.test(`${input.name} ${input.label}`));

function bounded(value: number, input: HfInputSpec) {
  const lower = input.min ?? value;
  const upper = input.max ?? value;
  return Math.min(upper, Math.max(lower, value));
}

export type HfH3Invocation = { endpoint: string; args: unknown[]; inputNames: string[]; defaultsUsed: string[] };

/** Build arguments in the order discovered from the live Space schema. */
export function buildHfH3Invocation(schema: HfH3ApiSchema, request: VideoGenerationRequest): HfH3Invocation {
  if (!schema.compatible || !schema.endpoint) throw new Error(schema.reason || 'HF API schema is incompatible.');
  const defaultsUsed: string[] = [];
  const args = schema.inputs.map(input => {
    const value = input.defaultValue;
    if (matches(input, [/negative|avoid|exclude/i])) return request.negativePrompt ?? value ?? '';
    if (matches(input, [/prompt|text|caption|description/i])) return request.prompt;
    if (matches(input, [/start.?image|input.?image|image.?path|init.?image/i])) return request.assets.startImage ?? value ?? null;
    if (matches(input, [/end.?image/i])) return request.assets.endImage ?? value ?? null;
    if (matches(input, [/duration|seconds|length/i])) return bounded(request.durationSeconds, input);
    if (matches(input, [/step|inference/i])) return bounded(request.steps ?? (Number(input.defaultValue) || 12), input);
    if (matches(input, [/seed/i])) return request.seed ?? 42;
    if (matches(input, [/upsample|enhance/i])) return false;
    if (matches(input, [/canvas|aspect|ratio/i])) return request.aspectRatio;
    if (matches(input, [/resolution|size/i])) return request.resolution;
    if (matches(input, [/audio|sound/i])) return request.audio;
    defaultsUsed.push(input.name);
    return value ?? null;
  });
  return { endpoint: schema.endpoint, args, inputNames: schema.inputs.map(input => input.name), defaultsUsed };
}

export function summarizeHfH3Schema(schema: HfH3ApiSchema) {
  return {
    endpoint: schema.endpoint,
    compatible: schema.compatible,
    inputCount: schema.inputs.length,
    inputs: schema.inputs.map(input => ({ name: input.name, kind: input.kind, required: input.required, min: input.min, max: input.max, choices: input.choices })),
    outputCount: schema.outputs.length,
    errorCode: schema.errorCode,
    reason: schema.reason,
  };
}

export { canonical };

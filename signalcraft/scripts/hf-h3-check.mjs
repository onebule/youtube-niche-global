#!/usr/bin/env node
import { blockedStatus, endpointAndInputs, estimateHfQuotaSeconds, runHfBridge } from './hf-bridge-run.mjs';

const truthy = value => String(value || '').trim().toLowerCase() === 'true';
const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim() || '';
const enabled = truthy(process.env.HF_ZEROGPU_H3_ENABLED);
const defaultCandidates = [
  { providerId: 'HF_H3_ULTRA_FAST_ZERO', space: 'mrfakename/minimax-h3-ultra-fast', kind: 'H3_ULTRA_FAST_ZERO', role: 'PRIMARY', enabled: true },
  { providerId: 'HF_ZEROGPU_H3', space: 'MiniMaxAI/MiniMax-H3-Turbo-Lora', kind: 'H3_OFFICIAL_ZERO', role: 'SECONDARY', enabled: true },
];

function candidatesFromEnv() {
  const configured = process.env.HF_H3_FREE_SPACES?.trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed)) {
        const candidates = parsed.map((item, index) => {
          const value = item && typeof item === 'object' ? item : {};
          if (!value.space || !['H3_ULTRA_FAST_ZERO', 'H3_OFFICIAL_ZERO'].includes(value.kind)) return null;
          return {
            providerId: String(value.providerId || (index === 0 ? 'HF_H3_ULTRA_FAST_ZERO' : `HF_ZEROGPU_H3_${index}`)),
            space: String(value.space).trim(), kind: value.kind, role: value.role === 'PRIMARY' ? 'PRIMARY' : 'SECONDARY', enabled: value.enabled !== false,
          };
        }).filter(Boolean);
        if (candidates.length) return candidates;
      }
    } catch { /* fall through to safe defaults */ }
  }
  const legacy = process.env.HF_ZEROGPU_H3_SPACE?.trim();
  return defaultCandidates.map(candidate => candidate.kind === 'H3_OFFICIAL_ZERO' && legacy ? { ...candidate, space: legacy } : { ...candidate });
}

function apiCompatibility(discovered) {
  const hasPrompt = discovered.parameters.some(item => /prompt|text|caption|description/i.test(`${item?.name || ''} ${item?.label || ''} ${item?.parameter_name || ''}`));
  return Boolean(discovered.endpoint && discovered.parameters.length && hasPrompt);
}

function selectedPreset(capabilities) {
  const presets = Array.isArray(capabilities?.presets) ? capabilities.presets : [];
  return presets.find(preset => /4\s*-?\s*step/i.test(String(preset.value)))
    || presets.find(preset => /turbo|fast/i.test(String(preset.value)))
    || null;
}

function candidateResult(candidate, result) {
  const discovered = result.apiInfo ? endpointAndInputs(result.apiInfo) : { endpoint: null, parameters: [], capabilities: {} };
  const compatible = apiCompatibility(discovered);
  const preset = selectedPreset(discovered.capabilities);
  const steps = Number(preset?.steps || 10);
  const quotaDetails = result.quotaDetails || null;
  const status = !enabled || !candidate.enabled ? 'HF_ZEROGPU_DISABLED'
    : result.auth === 'AUTH_REQUIRED' || result.auth === 'AUTH_INVALID'
    ? 'BLOCKED_BY_HF_AUTH'
    : result.reachability !== 'REACHABLE' || !result.ok
      ? blockedStatus(result.code || result.reachability)
      : !compatible ? 'BLOCKED_BY_API_CHANGE' : 'DISCOVERY_VERIFIED';
  return {
    providerId: candidate.providerId,
    kind: candidate.kind,
    role: candidate.role,
    space: candidate.space,
    registered: true,
    configured: Boolean(enabled && candidate.enabled && token),
    enabled: Boolean(enabled && candidate.enabled),
    hfAuth: result.auth || (token ? 'UNKNOWN' : 'AUTH_REQUIRED'),
    spaceReachability: result.reachability || 'UNKNOWN',
    runtime: result.runtime || null,
    hardware: result.hardware || null,
    generateApi: discovered.endpoint ? 'DISCOVERED' : 'NOT_DISCOVERED',
    endpoint: discovered.endpoint,
    schema: { compatible, inputCount: discovered.parameters.length },
    contract: compatible ? 'VERIFIED_IN_CODE' : 'UNKNOWN',
    capabilities: compatible ? 'COMPATIBLE' : 'UNKNOWN',
    capabilityDetails: discovered.capabilities,
    preset: preset ? { ...preset, source: 'DISCOVERED' } : { value: discovered.capabilities?.defaultPreset || null, steps: null, source: 'NOT_EXPOSED' },
    quota: result.quota || 'UNKNOWN',
    quotaDetails,
    estimatedQuotaSeconds: estimateHfQuotaSeconds({ durationSeconds: 5, resolution: '960x544', steps }),
    estimatedQuotaConfidence: 'LOW',
    status,
    execution: status === 'DISCOVERY_VERIFIED' ? 'DISCOVERY_VERIFIED_AWAITING_MANUAL_SMOKE' : 'BLOCKED',
    reason: result.message || result.code || null,
  };
}

const candidates = candidatesFromEnv();
const results = [];
for (const candidate of candidates) {
  let result = { ok: false, auth: token ? 'UNKNOWN' : 'AUTH_REQUIRED', reachability: 'UNKNOWN', runtime: null, hardware: null, quota: 'UNKNOWN', apiInfo: null, code: enabled ? (token ? 'CHECK_NOT_RUN' : 'HF_AUTH_REQUIRED') : 'HF_ZEROGPU_DISABLED' };
  if (enabled && token && candidate.enabled) {
    try { result = await runHfBridge('check', { space: candidate.space, token }, 30_000); }
    catch (error) { result = { ...result, code: 'HF_SPACE_UNREACHABLE', message: String(error.message || error) }; }
  }
  results.push(candidateResult(candidate, result));
}

const first = results[0] || null;
const allDiscoveryVerified = results.length > 0 && results.every(result => result.status === 'DISCOVERY_VERIFIED');
const state = !enabled ? 'HF_ZEROGPU_DISABLED' : !token ? 'BLOCKED_BY_HF_AUTH' : allDiscoveryVerified ? 'DISCOVERY_VERIFIED' : first?.status || 'BLOCKED_BY_HF_AUTH';
const recommended = results.filter(result => result.status === 'DISCOVERY_VERIFIED' && result.enabled && result.quotaDetails?.quotaStatus !== 'INSUFFICIENT')
  .sort((a, b) => Number(a.role !== 'PRIMARY') - Number(b.role !== 'PRIMARY') || (a.estimatedQuotaSeconds || Infinity) - (b.estimatedQuotaSeconds || Infinity))[0] || null;

console.log(JSON.stringify({
  schemaVersion: 'hf-h3-free-pool-check.v1', readOnly: true, state, generationSubmitted: false,
  provider: 'HF_ZEROGPU_H3', space: first?.space || null,
  registered: first?.registered ?? true, configured: Boolean(enabled && token), enabled,
  hfAuth: first?.hfAuth || (token ? 'UNKNOWN' : 'AUTH_REQUIRED'), spaceReachability: first?.spaceReachability || 'UNKNOWN',
  runtime: first?.runtime || null, hardware: first?.hardware || null, generateApi: first?.generateApi || 'NOT_DISCOVERED', endpoint: first?.endpoint || null,
  schema: first?.schema || { compatible: false, inputCount: 0 }, contract: first?.contract || 'UNKNOWN', capabilities: first?.capabilities || 'UNKNOWN',
  execution: state === 'DISCOVERY_VERIFIED' ? 'DISCOVERY_VERIFIED_AWAITING_MANUAL_SMOKE' : 'BLOCKED', quota: first?.quota || 'UNKNOWN', quotaDetails: first?.quotaDetails || null,
  candidates: results, recommended: recommended?.providerId || null,
  recommendationReason: recommended ? `优先使用 ${recommended.kind}；只读检查通过，预计配额 ${recommended.estimatedQuotaSeconds}s（低置信度估算）。` : '没有同时满足认证、可达性、API 契约和额度状态的免费候选。',
  reason: first?.reason || null,
}, null, 2));

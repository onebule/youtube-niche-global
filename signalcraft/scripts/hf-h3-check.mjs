#!/usr/bin/env node
import { blockedStatus, endpointAndInputs, runHfBridge } from './hf-bridge-run.mjs';

const truthy = value => String(value || '').trim().toLowerCase() === 'true';
const space = process.env.HF_ZEROGPU_H3_SPACE?.trim() || 'MiniMaxAI/MiniMax-H3-Turbo-Lora';
const token = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_HUB_TOKEN?.trim() || '';
const enabled = truthy(process.env.HF_ZEROGPU_H3_ENABLED);
let result = { ok: false, auth: token ? 'UNKNOWN' : 'AUTH_REQUIRED', reachability: 'UNKNOWN', runtime: null, hardware: null, quota: 'UNKNOWN', apiInfo: null, code: enabled ? (token ? 'CHECK_NOT_RUN' : 'HF_AUTH_REQUIRED') : 'HF_ZEROGPU_DISABLED' };
if (enabled && token) {
  try { result = await runHfBridge('check', { space, token }, 30_000); }
  catch (error) { result = { ...result, code: 'HF_SPACE_UNREACHABLE', message: String(error.message || error) }; }
}
const discovered = result.apiInfo ? endpointAndInputs(result.apiInfo) : { endpoint: null, parameters: [] };
const apiCompatible = Boolean(discovered.endpoint && discovered.parameters.length);
const state = !enabled ? 'HF_ZEROGPU_DISABLED' : !token ? 'BLOCKED_BY_HF_AUTH' : result.ok && apiCompatible ? 'DISCOVERY_VERIFIED' : blockedStatus(result.code);
console.log(JSON.stringify({
  schemaVersion: 'hf-h3-check.v1', readOnly: true, state, generationSubmitted: false,
  provider: 'HF_ZEROGPU_H3', space,
  registered: true, configured: Boolean(enabled && token), enabled,
  hfAuth: token ? (result.auth || 'UNKNOWN') : 'AUTH_REQUIRED',
  spaceReachability: result.reachability || 'UNKNOWN', runtime: result.runtime || null, hardware: result.hardware || null,
  generateApi: discovered.endpoint ? 'DISCOVERED' : 'NOT_DISCOVERED', endpoint: discovered.endpoint,
  schema: { compatible: apiCompatible, inputCount: discovered.parameters.length },
  contract: 'VERIFIED_IN_CODE', capabilities: apiCompatible ? 'COMPATIBLE' : 'UNKNOWN', execution: state === 'DISCOVERY_VERIFIED' ? 'DISCOVERY_VERIFIED_AWAITING_MANUAL_SMOKE' : 'BLOCKED',
  quota: result.quota || 'UNKNOWN', providerReport: result.providerReport || null,
  reason: result.message || result.code || null,
}, null, 2));

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_CONTRACT_VERSION,
  PROVIDER_CONTRACT_VERSION,
  VIDEO_GATEWAY_CONTRACT,
  VIDEO_MODEL_DISCOVERY_FIXTURE,
  buildProviderVerificationReport,
  normalizeProviderVerificationReport,
} from '../src/lib/provider-contracts.ts';

test('read-only model discovery grounds the internal proxy topology', () => {
  assert.equal(VIDEO_GATEWAY_CONTRACT.integrationType, 'INTERNAL_PROXY');
  assert.equal(VIDEO_GATEWAY_CONTRACT.baseUrl, 'https://youtube-niche-global-api.vercel.app/api/video');
  assert.deepEqual(VIDEO_MODEL_DISCOVERY_FIXTURE.models.map(item => item.id), ['seedance-2', 'seedance-2-5', 'minimax-h3']);
  assert.ok(VIDEO_MODEL_DISCOVERY_FIXTURE.models.every(item => item.enabled === false));
});

test('model contracts preserve configured IDs while leaving capabilities unknown', () => {
  const report = buildProviderVerificationReport();
  assert.equal(report.contractVersion, PROVIDER_CONTRACT_VERSION);
  assert.equal(report.modelContractVersion, MODEL_CONTRACT_VERSION);
  assert.deepEqual(report.models.map(item => item.actualRequestModelId), ['seedance-2', 'seedance-2-5', 'minimax-h3']);
  assert.ok(report.models.every(item => item.verification === 'CONFIGURED'));
  assert.ok(report.models.every(item => item.executionReadiness === 'NEEDS_SCHEMA_VERIFICATION'));
  assert.equal(report.coverage.verified, 0);
  assert.equal(report.coverage.unknown, 45);
});

test('submission, polling and output remain unverified without downstream schema evidence', () => {
  const report = buildProviderVerificationReport();
  const contract = report.contracts[0];
  assert.equal(contract.operations.find(item => item.operation === 'VIDEO_SUBMISSION').state, 'UNVERIFIED');
  assert.equal(contract.taskLifecycle.state, 'UNVERIFIED');
  assert.equal(contract.responses.outputUrlExpiration, 'UNKNOWN');
  assert.equal(contract.executionReadiness, 'NEEDS_SCHEMA_VERIFICATION');
});

test('verification report replay is deterministic and normalization is strict', () => {
  const report = buildProviderVerificationReport('2026-09-02T00:00:00.000Z');
  assert.deepEqual(report, buildProviderVerificationReport('2026-09-02T00:00:00.000Z'));
  assert.ok(normalizeProviderVerificationReport(report));
  assert.equal(normalizeProviderVerificationReport({ ...report, contractVersion: 'wrong' }), null);
});

test('authentication and fixture boundaries do not contain secret values', () => {
  const report = buildProviderVerificationReport();
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('API_KEY'), false);
  assert.equal(serialized.includes('Authorization'), false);
  assert.equal(report.contracts[0].authentication.secretExposure, 'NOT_EXPOSED');
});

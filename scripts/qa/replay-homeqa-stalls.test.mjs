import assert from 'node:assert/strict';
import test from 'node:test';
import { loadInstalledPolicy, replayInput, replayObservation } from './replay-homeqa-stalls.mjs';

const policy = await loadInstalledPolicy();
const now = 1_000_000;
const base = { channel: 1, owner_state: 'CURRENT', relay_age_ms: 60_000, input_idle_ms: 100,
  output_idle_ms: 100, native_input_ended: false, encoder: 'libx264', renewing: false, progressing: true };
const replay = (change = {}, options = {}) => replayInput({ ...base, ...change }, policy, { now, heartbeatFailures: 0, ...options });

test('healthy software owner does not enter rescue', () => {
  const result = replay();
  assert.equal(result.signature, 'NO_STALL_SIGNATURE');
  assert.equal(result.policyMode, null);
  assert.equal(result.actionExecuted, false);
});
test('fresh software input and stale output expose a selector gap without executing recovery', () => {
  const result = replay({ output_idle_ms: 25_000 });
  assert.equal(result.signature, 'SOFTWARE_OUTPUT_STALL_FRESH_INPUT');
  assert.equal(result.policyMode, null);
  assert.equal(result.actionExecuted, false);
});
test('the installed hardware signature already selects the existing rescue lane', () => {
  const result = replay({ output_idle_ms: 25_000, encoder: 'videotoolbox' });
  assert.equal(result.signature, 'HARDWARE_OUTPUT_STALL');
  assert.equal(result.policyMode, 'OUTPUT_RESCUE');
});
test('correlated silent input retains the healthy-session deferral', () => {
  const result = replay({ input_idle_ms: 12_000, output_idle_ms: 12_000 }, { correlatedSources: 3 });
  assert.equal(result.signature, 'SILENT_INPUT_AND_OUTPUT');
  assert.equal(result.correlatedDeferral, true);
});
test('an actual native response end retains its existing recovery authority', () => {
  const result = replay({ native_input_ended: true, output_idle_ms: 5_000 });
  assert.equal(result.signature, 'NATIVE_RESPONSE_ENDED');
  assert.equal(result.policyMode, 'OUTPUT_RESCUE');
});
test('null telemetry is missing evidence and never a fresh zero', () => {
  assert.equal(replay({ input_idle_ms: null, output_idle_ms: 25_000 }).signature, 'INSUFFICIENT_EVIDENCE');
  assert.equal(replay({ relay_age_ms: null }).signature, 'INSUFFICIENT_EVIDENCE');
});
test('renewal, fallback, and direct RTSP are not treated as productive DVR owners', () => {
  assert.equal(replay({ renewing: true }).signature, 'OWNER_NOT_CONFIRMED');
  assert.equal(replay({ owner_state: 'FALLBACK' }).signature, 'OWNER_NOT_CONFIRMED');
  assert.equal(replay({}, { directRtsp: true }).signature, 'DIRECT_RTSP_NOT_NVR');
});
test('unknown heartbeat does not become evidence for a healthy-session deferral', () => {
  const result = replay({ input_idle_ms: 12_000, output_idle_ms: 12_000 }, { correlatedSources: 3, heartbeatFailures: null });
  assert.equal(result.heartbeatEvidenceKnown, false);
  assert.equal(result.correlatedDeferral, null);
});
test('missing and duplicated channels are represented explicitly', () => {
  const report = replayObservation({ startedUtc: '2026-10-29T00:00:00Z', samples: [{ elapsedSeconds: 0,
    gateways: [{ port: 18082, heartbeatConsecutiveFailures: 0, inputs: [base, base] }] }] }, policy);
  assert.equal(report.counts.INSUFFICIENT_EVIDENCE, 11);
  assert.equal(report.samples[0].gateways[0].results.length, 10);
  assert.equal(report.samples[0].gateways[1].gatewayEvidence, 'MISSING_OR_DUPLICATE');
  assert.equal(report.actionExecuted, false);
});
test('an unexpected gateway cannot be interpreted as either QA device', () => {
  assert.throws(() => replayObservation({ startedUtc: '2026-10-29T00:00:00Z', samples: [{ elapsedSeconds: 0,
    gateways: [{ port: 443, inputs: [base] }] }] }, policy), /GATEWAY_PORT_SCOPE_REJECTED/);
});

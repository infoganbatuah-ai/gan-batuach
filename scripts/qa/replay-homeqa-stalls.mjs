// Read-only diagnosis against the exact installed 0.2.101 policy. No server,
// credentials, transport, timers, or recovery commands are imported/executed.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PINNED_POLICY_SHA256 = '68b8a5f2c181f8cf58a216c2f4c7b0ec2d2243f410f85ba9a351bdc4f995a8c8';
export async function loadInstalledPolicy() {
  const file = join(homedir(), 'Library/Application Support/Digital Observer/observer-gateway/ota/slots/0.2.101-p38-health/runtime/services/video-gateway/private-nvr-session-policy.mjs');
  const source = readFileSync(file);
  if (createHash('sha256').update(source).digest('hex') !== PINNED_POLICY_SHA256)
    throw new Error('INSTALLED_POLICY_HASH_MISMATCH');
  return import('data:text/javascript;base64,' + source.toString('base64'));
}

const finiteNonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function replayInput(input, policy, { now, correlatedSources = 0, heartbeatFailures = null, directRtsp = false } = {}) {
  if (directRtsp) return { signature: 'DIRECT_RTSP_NOT_NVR', policyMode: null, actionExecuted: false };
  if (!input || !finiteNonnegative(input.relay_age_ms) || !finiteNonnegative(input.input_idle_ms)
      || !finiteNonnegative(input.output_idle_ms) || typeof input.native_input_ended !== 'boolean'
      || !Number.isFinite(now))
    return { signature: 'INSUFFICIENT_EVIDENCE', policyMode: null, actionExecuted: false };
  // A renewal/fallback row cannot silently become a productive canonical owner.
  if (input.renewing === true || input.owner_state !== 'CURRENT')
    return { signature: 'OWNER_NOT_CONFIRMED', policyMode: null, actionExecuted: false };
  const relay = {
    startedAt: now-input.relay_age_ms, lastInputAt: now-input.input_idle_ms,
    lastOutputAt: now-input.output_idle_ms, nativeInputEnded: input.native_input_ended,
    encoder: input.encoder, progressing: input.progressing === true, warming: false,
  };
  const silent = policy.privateNvrSilentResponseStalled(relay, now);
  const hardware = policy.privateNvrHardwareOutputStalled(relay, now);
  const policyMode = policy.privateNvrRelayHandoffMode(relay, now);
  let signature = 'NO_STALL_SIGNATURE';
  if (input.native_input_ended) signature = 'NATIVE_RESPONSE_ENDED';
  else if (hardware) signature = 'HARDWARE_OUTPUT_STALL';
  else if (input.encoder === 'libx264' && input.input_idle_ms < 3_000 && input.output_idle_ms >= 20_000)
    signature = 'SOFTWARE_OUTPUT_STALL_FRESH_INPUT';
  else if (silent) signature = 'SILENT_INPUT_AND_OUTPUT';
  else if (input.output_idle_ms >= 8_000) signature = 'OUTPUT_GAP_WITHOUT_RECOVERY_PROOF';
  const heartbeatKnown = finiteNonnegative(heartbeatFailures);
  return {
    signature, policyMode, actionExecuted: false,
    correlatedDeferral: heartbeatKnown ? policy.shouldDeferCorrelatedPrivateNvrSilentResponseRescue({
      silentResponseStalled: silent, correlatedSourceCount: correlatedSources,
      heartbeatConsecutiveFailures: heartbeatFailures,
    }) : null,
    heartbeatEvidenceKnown: heartbeatKnown,
    inputIdleMs: input.input_idle_ms, outputIdleMs: input.output_idle_ms,
  };
}

export function replayObservation(observation, policy) {
  const counts = {};
  const samples = observation.samples.map(sample => {
    const now = Date.parse(observation.startedUtc) + sample.elapsedSeconds*1000;
    if (sample.gateways.some(gateway => ![18082,18083].includes(gateway.port)))
      throw new Error('GATEWAY_PORT_SCOPE_REJECTED');
    return { elapsedSeconds: sample.elapsedSeconds, gateways: [18082,18083].map(port => {
      const matches = sample.gateways.filter(gateway => gateway.port === port);
      const gateway = matches.length === 1 ? matches[0] : { port, inputs: [] };
      const inputs = gateway.inputs ?? [];
      const correlatedSources = inputs.filter(input => finiteNonnegative(input.relay_age_ms)
        && input.relay_age_ms >= 10_000 && finiteNonnegative(input.input_idle_ms)
        && input.input_idle_ms >= 8_000 && finiteNonnegative(input.output_idle_ms)
        && input.output_idle_ms >= 8_000 && input.native_input_ended === false).length;
      const expected = gateway.port === 18082 ? [1,2,3,4,5,6,7,8,10,11] : [1];
      const results = expected.map(channel => {
        const matches = inputs.filter(input => input.channel === channel);
        const input = matches.length === 1 ? matches[0] : null;
        const result = input ? replayInput(input, policy, { now, correlatedSources,
          heartbeatFailures: gateway.heartbeatConsecutiveFailures,
          directRtsp: gateway.port === 18083 })
          : { signature: 'INSUFFICIENT_EVIDENCE', policyMode: null, actionExecuted: false };
        counts[result.signature] = (counts[result.signature] ?? 0)+1;
        return { channel, ...result };
      });
      return { port: gateway.port, gatewayEvidence: matches.length === 1 ? 'PRESENT' : 'MISSING_OR_DUPLICATE', correlatedSources, results };
    }) };
  });
  return { contract: 'observer-read-only-policy-replay-v1', policySha256: PINNED_POLICY_SHA256,
    sourceCommit: '2cc9e2b67b0a2a6757adc64e3bf7bf4dff193952', counts, samples,
    actionExecuted: false, transportReplay: false,
    limitation: 'Policy selection replay only; health counters are not a byte-level transport replay or authority to restart an owner.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('INPUT_AND_OUTPUT_REQUIRED');
  const bytes = readFileSync(input);
  if (bytes.length > 2*1024*1024) throw new Error('OBSERVATION_SIZE_LIMIT');
  const report = replayObservation(JSON.parse(bytes), await loadInstalledPolicy());
  writeFileSync(output, JSON.stringify(report, null, 2)+'\n', { flag: 'wx' });
  console.log(JSON.stringify({ policySha256: report.policySha256, counts: report.counts, actionExecuted: false }));
}

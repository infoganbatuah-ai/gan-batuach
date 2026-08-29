import { readFileSync } from "node:fs";

const onboarding = readFileSync("scripts/cloud-dvr-discovery-web.mjs", "utf8");
const mapping = readFileSync("lib/domain/video-gateway.ts", "utf8");

for (const required of [
  "sanitizeEdgeCapabilityContract",
  "edge_capability_contract: inputData.edgeCapabilityContract",
  "gatewayHealth?.edge_capability_contract",
  "face_recognition: false",
  "biometric_matching: false"
]) {
  if (!onboarding.includes(required)) throw new Error(`Missing safe Edge contract forwarding: ${required}`);
}

for (const required of [
  "channelLocalEventInsightsEnabled = Boolean(localEventInsightsEnabled && connected)",
  'reason: "channel_offline"',
  "local_event_insights: channelLocalEventInsightsEnabled",
  "localEventInsightsEnabled: channelLocalEventInsightsEnabled"
]) {
  if (!mapping.includes(required)) throw new Error(`Missing per-channel Edge gate: ${required}`);
}

console.log("Cloud discovery Edge gating QA PASS");

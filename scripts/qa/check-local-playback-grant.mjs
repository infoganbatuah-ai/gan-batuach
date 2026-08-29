import { issueGatewayPlaybackGrant, verifyGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";
import { readFileSync } from "node:fs";

const secret = "qa-secret-with-sufficient-entropy-for-signing";
const input = {
  gateway_id: "11111111-1111-4111-8111-111111111111",
  observer_site_id: "22222222-2222-4222-8222-222222222222",
  camera_source_id: "33333333-3333-4333-8333-333333333333",
  gateway_stream_id: "opaque_stream_reference"
};
const grant = issueGatewayPlaybackGrant(input, secret);
const verified = verifyGatewayPlaybackGrant(grant, secret);
if (!verified || verified.gateway_id !== input.gateway_id || verified.gateway_stream_id !== input.gateway_stream_id || verified.scope !== "local_playback") {
  throw new Error("Signed local playback grant did not round-trip");
}
if (verifyGatewayPlaybackGrant(`${grant}tampered`, secret)) throw new Error("Tampered local playback grant was accepted");

const cloudRoute = readFileSync("app/api/video-gateway/playback-grant/route.ts", "utf8");
const observerRoute = readFileSync("app/api/digital-observer/dvr-gateway/route.ts", "utf8");
const gateway = readFileSync("services/video-gateway/server.mjs", "utf8");
const player = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");
for (const required of ["verifyGatewayDeviceAccessToken", "verifyGatewayPlaybackGrant", "gateway_playback_grant_redeemed", "23505", "no_credentials_received"]) {
  if (!cloudRoute.includes(required)) throw new Error(`Missing cloud playback grant control: ${required}`);
}
for (const required of ["issueGatewayPlaybackGrant", "claim_url", "127.0.0.1:18082/playback/claim"]) {
  if (!observerRoute.includes(required)) throw new Error(`Missing observer playback grant handoff: ${required}`);
}
for (const required of ["/playback/claim", "refreshGatewayDeviceAccess", "device_refresh_token", "streamSources.has(streamId)", "browserJson"]) {
  if (!gateway.includes(required)) throw new Error(`Missing local playback claim control: ${required}`);
}
for (const required of ["claim_url", "claimResponse", "JSON.stringify({ grant })"]) {
  if (!player.includes(required)) throw new Error(`Missing browser playback claim flow: ${required}`);
}
for (const forbidden of ["endpoint", "username", "password", "rtsp"]) {
  if (cloudRoute.includes(`payload.${forbidden}`)) throw new Error(`Cloud playback grant accepts forbidden DVR field: ${forbidden}`);
}

console.log("Local playback grant QA PASS");

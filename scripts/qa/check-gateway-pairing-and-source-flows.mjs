import { readFileSync } from "node:fs";
import { issueGatewayDiscoveryToken, verifyGatewayDiscoveryToken } from "../../lib/domain/video-gateway-pairing.ts";

const pairingRoute = readFileSync(new URL("../../app/api/digital-observer/gateway-pairing/route.ts", import.meta.url), "utf8");
const discoveryRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-discovery/route.ts", import.meta.url), "utf8");
const localOnboarding = readFileSync(new URL("../cloud-dvr-discovery-web.mjs", import.meta.url), "utf8");
const cameraWizard = readFileSync(new URL("../../components/digital-observer/observer-action-forms.tsx", import.meta.url), "utf8");
const pairing = readFileSync(new URL("../../lib/domain/video-gateway-pairing.ts", import.meta.url), "utf8");

for (const required of ["gatewayPairingCodeTtlMs", "gatewayDiscoveryTokenTtlMs", "hashGatewayPairingCode", "verifyGatewayDiscoveryToken", "scope: \"cloud_discovery\""]) {
  if (!pairing.includes(required)) throw new Error(`Missing short-lived pairing control: ${required}`);
}
const testToken = issueGatewayDiscoveryToken({ pairing_id: "pairing", gateway_id: "gateway", observer_site_id: "site" }, "qa-secret");
if (verifyGatewayDiscoveryToken(testToken, "qa-secret")?.gateway_id !== "gateway" || verifyGatewayDiscoveryToken(`${testToken}x`, "qa-secret")) throw new Error("Pairing token signature verification failed");
for (const required of ["action: z.literal(\"create\")", "action: z.literal(\"claim\")", "getObserverSiteAccess", "one_time: true", "status: \"received\"", "status: \"processed\""]) {
  if (!pairingRoute.includes(required)) throw new Error(`Missing pairing endpoint boundary: ${required}`);
}
for (const required of ["x-video-gateway-pairing-token", "verifyGatewayDiscoveryToken", "payload.observer_site_id !== pairing.observer_site_id", "assertFreshNonce"]) {
  if (!discoveryRoute.includes(required)) throw new Error(`Missing token-scoped cloud discovery boundary: ${required}`);
}
for (const forbidden of ["VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || cloudConfig", "חסרה הגדרת ענן מקומית ל-Gateway"]) {
  if (localOnboarding.includes(forbidden)) throw new Error(`Local onboarding still depends on a cloud secret/config: ${forbidden}`);
}
for (const required of ["/pairing/claim", "action: \"claim\"", "pendingClaims", "consumePairingClaim", "claim_session_id", "x-video-gateway-pairing-token", "before any DVR request"]) {
  if (!localOnboarding.includes(required)) throw new Error(`Missing local pairing handoff: ${required}`);
}
const connectBodyMatch = localOnboarding.match(/const body = \{ \.\.\.Object\.fromEntries\(new FormData\(form\)\.entries\(\)\), ([^}]+) \};/);
if (!connectBodyMatch || connectBodyMatch[1] !== "claimSessionId") throw new Error("CONNECT must receive only the local claim session id after pairing claim");
if (localOnboarding.includes(".env.video-gateway.local")) throw new Error("Local pairing must not depend on disk cloud configuration");
for (const required of ["NVR/DVR מוסיף מקליט אחד", "recorderFlow && step === 2", "הצגת ערוצים לאחר discovery", "IP/ONVIF/RTSP מוסיפים מקור יחיד"]) {
  if (!cameraWizard.includes(required)) throw new Error(`Missing source-flow distinction: ${required}`);
}

console.log("Gateway pairing and DVR/IP source flow checks passed.");

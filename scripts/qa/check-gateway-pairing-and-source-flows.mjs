import { readFileSync } from "node:fs";
import { issueGatewayDiscoveryToken, verifyGatewayDiscoveryToken } from "../../lib/domain/video-gateway-pairing.ts";
import { issueGatewayDeviceAccessToken, verifyGatewayDeviceAccessToken } from "../../lib/domain/gateway-device-enrollment.ts";

const pairingRoute = readFileSync(new URL("../../app/api/digital-observer/gateway-pairing/route.ts", import.meta.url), "utf8");
const discoveryRoute = readFileSync(new URL("../../app/api/video-gateway/cloud-discovery/route.ts", import.meta.url), "utf8");
const localOnboarding = readFileSync(new URL("../cloud-dvr-discovery-web.mjs", import.meta.url), "utf8");
const cameraWizard = readFileSync(new URL("../../components/digital-observer/observer-action-forms.tsx", import.meta.url), "utf8");
const addCameraPage = readFileSync(new URL("../../app/digital-observer/cameras/add/page.tsx", import.meta.url), "utf8");
const pairingPanel = readFileSync(new URL("../../components/digital-observer/observer-gateway-pairing.tsx", import.meta.url), "utf8");
const pairing = readFileSync(new URL("../../lib/domain/video-gateway-pairing.ts", import.meta.url), "utf8");
const observerStyles = readFileSync(new URL("../../app/styles/digital-observer-product.css", import.meta.url), "utf8");
const enrollmentRoute = readFileSync(new URL("../../app/api/digital-observer/gateway-enrollment/route.ts", import.meta.url), "utf8");
const deviceEnrollment = readFileSync(new URL("../../lib/domain/gateway-device-enrollment.ts", import.meta.url), "utf8");
const enrollmentMigration = readFileSync(new URL("../../supabase/migrations/20260829010000_gateway_device_enrollment.sql", import.meta.url), "utf8");

for (const required of ["gatewayPairingCodeTtlMs", "gatewayDiscoveryTokenTtlMs", "hashGatewayPairingCode", "verifyGatewayDiscoveryToken", "scope: \"cloud_discovery\""]) {
  if (!pairing.includes(required)) throw new Error(`Missing short-lived pairing control: ${required}`);
}
const testToken = issueGatewayDiscoveryToken({ pairing_id: "pairing", gateway_id: "gateway", observer_site_id: "site" }, "qa-secret");
if (verifyGatewayDiscoveryToken(testToken, "qa-secret")?.gateway_id !== "gateway" || verifyGatewayDiscoveryToken(`${testToken}x`, "qa-secret")) throw new Error("Pairing token signature verification failed");
const deviceToken = issueGatewayDeviceAccessToken({ device_id: "device", gateway_id: "gateway", observer_site_id: "site" }, "qa-secret");
if (verifyGatewayDeviceAccessToken(deviceToken, "qa-secret")?.device_id !== "device" || verifyGatewayDeviceAccessToken(`${deviceToken}x`, "qa-secret")) throw new Error("Device enrollment access token verification failed");
for (const required of ["gatewayEnrollmentTtlMs", "gatewayDeviceAccessTtlMs", "newGatewayRefreshToken", "hashGatewayEnrollmentToken"]) {
  if (!deviceEnrollment.includes(required)) throw new Error(`Missing device enrollment token boundary: ${required}`);
}
for (const required of ["create_request", "approve", "poll", "refresh", "revoke", "getObserverSiteAccess", "refresh_token_hash", "gateway_enrollment_revoked", "refreshRecoveryGraceMs", "previous_refresh_token_hash", "previous_refresh_valid_until", "interrupted_rotation_recovered"]) {
  if (!enrollmentRoute.includes(required)) throw new Error(`Missing device enrollment lifecycle control: ${required}`);
}
for (const required of ["video_gateway_device_enrollments", "poll_token_hash", "refresh_token_hash", "status in ('pending','approved','delivered','expired','revoked')", "enable row level security"]) {
  if (!enrollmentMigration.includes(required)) throw new Error(`Missing enrollment migration boundary: ${required}`);
}
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
for (const required of ["/enrollment/start", "/enrollment/poll", "device_refresh_token", "add-generic-password", "keychain_only: true", "create_request"]) {
  if (!localOnboarding.includes(required)) throw new Error(`Missing Keychain-only device enrollment handoff: ${required}`);
}
for (const forbidden of ["writeFileSync", "appendFileSync", "readFileSync", "GAN_BATUACH_GATEWAY_CONFIG", "device_refresh_token="]) {
  if (localOnboarding.includes(forbidden)) throw new Error(`Device enrollment must not persist credentials to disk: ${forbidden}`);
}
for (const required of ["/dvr-profile/status", "המקליט הקיים מוכן", "useExistingProfile", "dvr_profile_json", "dvr_password", "values_returned: false"]) {
  if (!localOnboarding.includes(required)) throw new Error(`Missing secure existing DVR profile flow: ${required}`);
}
const connectBodyMatch = localOnboarding.match(/const body = \{ \.\.\.Object\.fromEntries\(new FormData\(form\)\.entries\(\)\), ([^}]+) \};/);
if (!connectBodyMatch || connectBodyMatch[1] !== "claimSessionId") throw new Error("CONNECT must receive only the local claim session id after pairing claim");
if (localOnboarding.includes(".env.video-gateway.local")) throw new Error("Local pairing must not depend on disk cloud configuration");
if (/dvr-profile\/status[\s\S]{0,400}(endpoint|username|password)/.test(localOnboarding)) throw new Error("DVR profile status must not return DVR address, username, or password");
for (const required of ["מוסיפים DVR/NVR אחד", "if (recorderFlow && step === 2)", "הצגת ערוצים לאחר discovery", "לא יוצרים כאן מצלמה בודדת"]) {
  if (!cameraWizard.includes(required)) throw new Error(`Missing source-flow distinction: ${required}`);
}
for (const required of ["בשימוש רגיל אין קוד", "gateway_enrolled", "שחזור, מחשב אחר או התקנה ללא מסך"]) {
  if (!pairingPanel.includes(required)) throw new Error(`Missing normal gateway onboarding wording: ${required}`);
}
if (/127\.0\.0\.1:18180[^\n]*(observer_site_id|token|code)=/i.test(pairingPanel)) throw new Error("Local handoff must not place site identifiers or tokens in the URL");
for (const required of ["recorderFlow && step === 2", "<ObserverGatewayPairing observerSiteId={form.observer_site_id} />", "מקליט רב־ערוצי", "לא יוצרים כאן מצלמה בודדת"]) {
  if (!cameraWizard.includes(required)) throw new Error(`Recorder flow must keep pairing inside Add cameras: ${required}`);
}
if (addCameraPage.includes("ObserverGatewayPairing")) throw new Error("Gateway pairing must be part of the DVR/NVR wizard, not a separate Add cameras screen");
for (const required of ["פתיחת חיבור המקליט", "http://127.0.0.1:18180", "פרטי המקליט אינם נשלחים לדשבורד"]) {
  if (!pairingPanel.includes(required)) throw new Error(`Gateway pairing must offer a clear local handoff: ${required}`);
}
for (const required of ["/api/digital-observer/runtime-status", "connected_camera_count", "gateway_enrolled", "60_000"]) {
  if (!pairingPanel.includes(required)) throw new Error(`Gateway pairing must foreground current connection state: ${required}`);
}
for (const required of [".do-gateway-pairing-actions", "grid-template-columns: 1fr", "overflow-wrap: anywhere", "min-height: 48px"]) {
  if (!observerStyles.includes(required)) throw new Error(`Gateway pairing controls must remain readable on mobile: ${required}`);
}

const browserScript = localOnboarding.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!browserScript?.includes("async function showNextStepAfterPairing")) throw new Error("Pairing next-step handler must be available to the local browser");
if (localOnboarding.lastIndexOf("async function showNextStepAfterPairing") > localOnboarding.indexOf("</script>")) throw new Error("Pairing next-step handler must not be emitted outside the browser script");

const elements = new Map();
for (const id of ["pairing-form", "pairing-submit", "pairing-status", "existing-profile", "existing-profile-form", "existing-connect", "manual-entry", "dvr-form", "connect", "status", "pairing-code", "enrollment-start", "enrollment-link", "enrollment-status"]) {
  elements.set(id, {
    hidden: false,
    disabled: false,
    textContent: "",
    value: id === "pairing-code" ? "pairing.code" : "",
    listeners: {},
    addEventListener(type, handler) { this.listeners[type] = handler; },
    reset() {}
  });
}
const browserDocument = { getElementById: (id) => elements.get(id) };
const browserFetch = async (url) => {
  if (url === "/pairing/claim") return { ok: true, json: async () => ({ claim_session_id: "safe-local-session" }) };
  if (url === "/dvr-profile/status") return { ok: true, json: async () => ({ configured: true }) };
  throw new Error(`Unexpected local browser request: ${url}`);
};
new Function("document", "fetch", "FormData", `${browserScript}\nreturn true;`)(browserDocument, browserFetch, class FormData {});
await elements.get("pairing-form").listeners.submit({ preventDefault() {} });
if (!elements.get("pairing-form").hidden || elements.get("existing-profile").hidden || !elements.get("dvr-form").hidden) {
  throw new Error("Successful local pairing must show the existing-recorder CONNECT step without a browser ReferenceError");
}

console.log("Gateway pairing and DVR/IP source flow checks passed.");

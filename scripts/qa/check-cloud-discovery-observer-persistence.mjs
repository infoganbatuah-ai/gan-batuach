import { readFileSync } from "node:fs";

const source = readFileSync("lib/domain/video-gateway.ts", "utf8");
const match = source.match(/export async function materializeCloudDvrDiscovery[\s\S]*?\n}\n\nexport async function recordStreamHealth/);
if (!match) throw new Error("materializeCloudDvrDiscovery function not found.");

const body = match[0];
if (body.includes('from("video_gateway_connections"') || body.includes("from('video_gateway_connections'")) {
  throw new Error("cloud discovery must not persist observer-only DVR mapping through video_gateway_connections.");
}
if (!body.includes("upsertDigitalObserverCameraSource")) {
  throw new Error("cloud discovery must materialize Digital Observer camera sources.");
}
if (!body.includes("observerSiteId")) {
  throw new Error("cloud discovery must scope mapping to an observer site.");
}
if (!body.includes("ai_shadow_only")) {
  throw new Error("cloud discovery must preserve AI Shadow-only metadata.");
}

console.log("Cloud discovery observer persistence checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const camerasPage = readFileSync("app/digital-observer/cameras/page.tsx", "utf8");
const dashboardPage = readFileSync("app/digital-observer/dashboard/page.tsx", "utf8");
const livePlayer = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");
const runtime = readFileSync("lib/domain/digital-observer/runtime.ts", "utf8");
const css = readFileSync("app/styles/digital-observer-product.css", "utf8");

for (const source of [camerasPage, dashboardPage]) {
  assert.match(source, /function liveGatewayStreamId/, "camera surfaces must detect gateway streams");
  assert.match(source, /<ObserverLivePlayer compact/, "camera list tiles must render compact live thumbnails when a gateway stream exists");
}

assert.match(livePlayer, /compact = false/, "live player must expose a compact thumbnail mode");
assert.match(livePlayer, /!\s*compact\s*\? <button/, "compact live thumbnails must not render an interactive audio button inside camera links");
assert.match(runtime, /gateway_stream_id,video_gateway_stream_id/, "legacy observer camera loading must select gateway stream ids");
assert.match(runtime, /gateway_stream_id_present/, "legacy observer cameras must expose safe gateway metadata to the dashboard");
assert.match(css, /\.do-camera-live-tile \.do-live-player/, "camera tiles must size live player thumbnails");
assert.doesNotMatch(camerasPage + dashboardPage + livePlayer, /rtsp:\/\/|password|credential/i, "browser camera thumbnail code must not expose raw stream credentials");

console.log("Observer live camera thumbnail checks passed.");

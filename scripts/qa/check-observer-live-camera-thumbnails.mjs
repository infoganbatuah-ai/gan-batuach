import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const camerasPage = readFileSync("app/digital-observer/cameras/page.tsx", "utf8");
const dashboardPage = readFileSync("app/digital-observer/dashboard/page.tsx", "utf8");
const livePlayer = readFileSync("components/digital-observer/observer-live-player.tsx", "utf8");
const runtime = readFileSync("lib/domain/digital-observer/runtime.ts", "utf8");
const css = readFileSync("app/styles/digital-observer-product.css", "utf8");
const cameraRoute = readFileSync("app/api/digital-observer/cameras/route.ts", "utf8");
const conversationRoute = readFileSync("app/api/digital-observer/conversation/route.ts", "utf8");
const presence = readFileSync("components/digital-observer/observer-camera-presence.tsx", "utf8");
const actionForms = readFileSync("components/digital-observer/observer-action-forms.tsx", "utf8");

for (const source of [camerasPage, dashboardPage]) {
  assert.match(source, /digitalObserverCameraHasLiveGateway/, "camera surfaces must use the shared verified gateway status guard");
  assert.match(source, /<ObserverLivePlayer compact/, "camera list tiles must render compact live thumbnails when a gateway stream exists");
}

assert.match(livePlayer, /compact = false/, "live player must expose a compact thumbnail mode");
assert.match(livePlayer, /!\s*compact\s*\? <button/, "compact live thumbnails must not render an interactive audio button inside camera links");
assert.match(runtime, /gateway_stream_id,video_gateway_stream_id/, "legacy observer camera loading must select gateway stream ids");
assert.match(runtime, /gateway_stream_id_present/, "legacy observer cameras must expose safe gateway metadata to the dashboard");
assert.match(css, /\.do-camera-live-tile \.do-live-player/, "camera tiles must size live player thumbnails");
assert.match(camerasPage + dashboardPage, /ObserverCameraPresence/, "every camera surface must show the Digital Observer presence badge");
assert.match(presence, /observer-robot-v1\.png/, "camera presence must reuse the product robot asset");
assert.match(cameraRoute, /action: z\.literal\("rename"\)/, "camera names must be editable through the authenticated camera API");
assert.match(cameraRoute, /ai_context_source/, "verified camera names must feed the observer context");
assert.match(camerasPage, /ObserverCameraInlineRename/, "every camera tile must expose an inline rename control");
assert.match(actionForms, /do-camera-rename-trigger/, "inline camera rename must use an explicit edit icon control");
assert.match(actionForms, /action: "rename"/, "inline camera rename must use the authenticated camera rename action");
assert.match(dashboardPage, /reviewableOpenSignals/, "home must only list events with complete media evidence for review");
assert.match(dashboardPage, /do-home-event-cards/, "home must expose event review cards");
assert.match(dashboardPage, /event-clips.*kind=thumbnail/, "home event cards must load the authenticated event thumbnail");
assert.match(dashboardPage, /siteAddressLabel/, "home must display the configured site address context");
assert.match(conversationRoute, /camera_source_id/, "camera conversation must stay scoped to the selected source");
assert.match(conversationRoute, /shadow_active/, "instructions for connected sources must not be left in generic readiness");
assert.doesNotMatch(camerasPage + dashboardPage + livePlayer, /rtsp:\/\/|password|credential/i, "browser camera thumbnail code must not expose raw stream credentials");

console.log("Observer live camera thumbnail checks passed.");

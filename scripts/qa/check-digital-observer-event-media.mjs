import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const alertsPage = readFileSync("app/digital-observer/alerts/page.tsx", "utf8");
const runtime = readFileSync("lib/domain/digital-observer/runtime.ts", "utf8");
const mediaRoute = readFileSync("app/api/digital-observer/event-clips/[id]/media/route.ts", "utf8");
const cloudRoute = readFileSync("app/api/video-gateway/cloud-event-media/route.ts", "utf8");
const retentionCron = readFileSync("app/api/cron/digital-observer-event-media-retention/route.ts", "utf8");
const gateway = readFileSync("services/video-gateway/server.mjs", "utf8");
const persistentGateway = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
const migration = readFileSync("supabase/migrations/20260827000100_digital_observer_event_media_evidence.sql", "utf8");

assert.match(runtime, /observerSignalHasRequiredEvidence/, "runtime must expose evidence gating for reviewable observer events");
assert.match(alertsPage, /displayableSignals = allSignals\.filter\(\(item\) => observerSignalHasRequiredEvidence/, "alerts list must filter reviewable events by camera source and media");
assert.match(alertsPage, /selectedHasMedia \? <ObserverQuickAction[\s\S]*אישור אירוע/, "event confirmation must only render when media is available");
assert.match(alertsPage, /do-event-technical-faults/, "events missing media must be surfaced as technical faults");
assert.match(mediaRoute, /createSignedUrl\(path, Math\.min\(60, remainingSeconds\)/, "event clip permission must not outlive the 60-second limit or media expiry");
assert.match(mediaRoute, /getObserverSiteAccess/, "event clip media route must check tenant-scoped observer site access");
assert.match(cloudRoute, /Replay detected/, "cloud event media uploads must reject replayed nonces");
assert.match(cloudRoute, /no_dvr_credentials_returned: z\.literal\(true\)/, "cloud event media schema must require no DVR credentials in payload");
assert.match(cloudRoute, /Camera source does not match gateway stream/, "cloud event media must bind uploads to the mapped camera source");
assert.match(cloudRoute, /event_summary/, "cloud event media must store a safe event narrative");
assert.match(cloudRoute, /retentionHoursForSite/, "cloud event media must cap retention from the site policy");
assert.match(cloudRoute, /media_status: "available"/, "available uploads must set the database media lifecycle state");
assert.match(retentionCron, /authorization.*Bearer/, "media retention cron must require cron authentication");
assert.match(retentionCron, /storage\.from\(clip\.storage_bucket\)\.remove/, "media retention cron must delete private media files");
assert.match(retentionCron, /media_missing_reason: "retention_expired"/, "expired media must retain a precise lifecycle reason");
assert.match(gateway, /event-media/, "local gateway must expose a read-only event media capture endpoint");
assert.match(gateway, /controls_supported: false/, "event media capture must remain read-only with controls disabled");
assert.ok(persistentGateway.includes("publishEvent:") && persistentGateway.includes("return submitEventEvidence("), "verified detections must retain the event evidence path");
assert.equal(persistentGateway.includes("submitReadinessEvidence"), false, "restart must not automatically record a diagnostic clip");
assert.match(migration, /digital-observer-event-media/, "migration must create or harden the private Digital Observer event media bucket");
assert.match(migration, /media_missing_reason/, "migration must persist precise missing-media reasons");
assert.match(migration, /with first_active_camera as \(/, "migration must repair legacy evidence with a PostgreSQL-safe CTE");
assert.doesNotMatch(migration, /from lateral \([\s\S]*s\.observer_site_id/, "migration must not reference the update target from an invalid lateral FROM item");
assert.doesNotMatch(alertsPage + runtime + mediaRoute + cloudRoute + retentionCron, /rtsp:\/\/|rtsps:\/\/|password\s*[:=]|credential\s*[:=]/i, "browser and cloud event media code must not expose camera credentials or RTSP URLs");

console.log("Digital Observer event media checks passed.");

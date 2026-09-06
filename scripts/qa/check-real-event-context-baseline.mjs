import assert from "node:assert/strict";
import { loadTs } from "./digital-guard-test-loader.mjs";

const {
  REAL_EVENT_CONTEXT_BASELINE_VERSION,
  buildRealEventContextBaseline,
  canonicalRealEventContext,
  evaluateRealEventContext,
  expectedHoursAt
} = loadTs("lib/domain/digital-observer/home-learning-sampler.ts", {
  "@/lib/domain/video-gateway-client": {}
});

const siteId = "00000000-0000-4000-8000-000000000001";
const cameraA = "00000000-0000-4000-8000-000000000002";
const cameraB = "00000000-0000-4000-8000-000000000003";
const schedule = {
  status: "active",
  schedule_mode: "business_hours",
  timezone: "Asia/Jerusalem",
  active_days: [],
  schedule: { hours: { start: "08:00", end: "20:00" } }
};
const sources = [
  { id: cameraA, location_label: "Entrance", stream_protocol: "rtsp", metadata: { gateway_stream_id: "channel-11", zone_type: "ENTRANCE", crossing_line: { axis: "y", position: 0.5, inside: "positive" } } },
  { id: cameraB, location_label: "Back door", stream_protocol: "rtsp", metadata: { gateway_stream_id: "channel-12", zone_type: "BACK" } }
];

function realEvent(index, overrides = {}) {
  const day = 1 + Math.floor(index / 2);
  const timestamp = new Date(Date.UTC(2026, 0, day, 7 + (index % 2), 0, 0)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    source_type: "system",
    created_at: timestamp,
    confidence: 0.93,
    metadata: {
      observation_provenance: "REAL_CAMERA_AI",
      validated_event: true,
      camera_source_id: cameraA,
      stream_id: "channel-11",
      event_type: index % 2 ? "person_exited" : "person_entered",
      track_id: `track-${Math.floor(index / 2)}`,
      zone_type: "ENTRANCE",
      model_provenance: { provider: "onnx", model: "ssd_mobilenet_v1_10" },
      ...overrides.metadata
    },
    ...overrides
  };
}

const realHistory = Array.from({ length: 48 }, (_, index) => realEvent(index));
const ignoredMock = realEvent(99, {
  id: "00000000-0000-4000-8000-000000000999",
  source_type: "local_shadow",
  metadata: { observation_provenance: "SHADOW_AI", validated_event: true, camera_source_id: cameraA, stream_id: "channel-11", event_type: "person_entered" }
});
const baseline = buildRealEventContextBaseline({
  observerSiteId: siteId,
  timeZone: "Asia/Jerusalem",
  events: [...realHistory, ignoredMock],
  sources,
  schedule,
  generatedAt: "2026-02-01T00:00:00.000Z"
});

assert.equal(baseline.version, REAL_EVENT_CONTEXT_BASELINE_VERSION);
assert.equal(baseline.real_data_only, true);
assert.equal(baseline.real_event_count, 48, "mock/shadow records never enter a real baseline");
assert.equal(baseline.baseline_maturity, "ESTABLISHED", "sufficient, distributed real history can become established");
assert.equal(baseline.cameras[cameraA].event_count, 48);
assert.equal(baseline.cameras[cameraB].maturity, "NO_DATA", "each camera remains isolated");
assert.equal(baseline.cameras[cameraA].expected_hours.outside_expected_hours, 0, "business-hour context is factual and local-time aware");
assert.equal(baseline.cameras[cameraA].direction_counts.entry, 24);
assert.equal(baseline.cameras[cameraA].direction_counts.exit, 24);

const midnight = canonicalRealEventContext(realEvent(0, { created_at: "2026-06-01T21:15:00.000Z" }), "Asia/Jerusalem", schedule);
assert.equal(midnight?.local.local_hour, 0, "local midnight uses the site timezone, including daylight saving time");
assert.equal(midnight?.expected_hours.within_expected_hours, false, "outside configured hours is context only");
assert.equal(expectedHoursAt({ status: "active", schedule_mode: "night_only", schedule: { hours: { start: "22:00", end: "06:00" } } }, "2026-06-01T21:15:00.000Z", "Asia/Jerusalem").within_expected_hours, null, "monitoring mode is not silently treated as a behavioral rule");

const matureEvent = canonicalRealEventContext(realEvent(200, { created_at: "2026-02-28T23:00:00.000Z" }), "Asia/Jerusalem", schedule);
assert.ok(matureEvent);
const matureContext = evaluateRealEventContext(matureEvent, baseline.cameras[cameraA]);
assert.equal(matureContext.baseline_confidence_insufficient, false);
assert.ok(matureContext.deviation_signals.some((signal) => signal.key === "unusual_time_of_day"), "a mature baseline emits an explainable factual deviation signal, not a risk verdict");

const immature = buildRealEventContextBaseline({ observerSiteId: siteId, timeZone: "Asia/Jerusalem", events: [realEvent(0)], sources: [sources[0]], schedule });
const immatureEvent = canonicalRealEventContext(realEvent(1), "Asia/Jerusalem", schedule);
assert.equal(evaluateRealEventContext(immatureEvent, immature.cameras[cameraA]).baseline_confidence_insufficient, true, "one real event cannot create an anomaly claim");

const changedSource = { ...sources[0], metadata: { ...sources[0].metadata, crossing_line: { axis: "x", position: 0.35, inside: "positive" } } };
const stale = buildRealEventContextBaseline({
  observerSiteId: siteId,
  timeZone: "Asia/Jerusalem",
  events: realHistory,
  sources: [changedSource],
  schedule,
  previous: { cameras: { [cameraA]: baseline.cameras[cameraA] } },
  generatedAt: "2026-02-02T00:00:00.000Z"
});
assert.equal(stale.cameras[cameraA].maturity, "STALE", "a material camera/zone configuration change invalidates the old baseline");
assert.equal(stale.cameras[cameraA].invalidation_reason, "CAMERA_OR_ZONE_CONFIGURATION_CHANGED");

console.log("Real event context baseline checks passed: timezone, schedule context, real-only provenance, maturity, isolation, factual deviations, and configuration invalidation.");

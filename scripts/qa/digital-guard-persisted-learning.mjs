import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  for (const [key, value] of Object.entries(parseEnv(readFileSync(file, "utf8")))) if (!process.env[key]) process.env[key] = value;
}
assert.ok(process.argv.includes("--run-isolated-fixture"), "Explicit isolated-fixture flag required");
assert.ok(["local", "demo", "staging", "pilot"].includes(process.env.QA_DEMO_ENVIRONMENT), "Synthetic QA environment required");
assert.notEqual(process.env.VERCEL_ENV, "production", "No production execution");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(url && key && serviceKey, "QA database configuration required");
const email = process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com";
assert.match(email, /^qa\..+@demo\.ganbatuach\.com$/, "Synthetic account required");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error: authError } = await client.auth.signInWithPassword({ email, password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD });
assert.ok(!authError && login.user, "QA login failed");
const siteId = randomUUID();
const cameraId = randomUUID();
const secondCameraId = randomUUID();
const marker = `guard-learning-fixture-${siteId}`;
let created = false;
function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.code ?? "database_error"} ${result.error.message}`);
  return result.data;
}
const { recordHomeActivityMetrics } = loadTs("lib/domain/digital-observer/home-learning-sampler.ts", {
  "@/lib/domain/video-gateway-client": { getStreamActivityInsight() { throw new Error("Hardware access forbidden in fixture test"); } }
});
try {
  checked(await admin.from("observer_sites").insert({
    id: siteId, name: marker, site_type: "home", owner_profile_id: login.user.id,
    garden_id: null, active: false, monitoring_enabled: true, timezone: "UTC",
    ai_features: {}, metadata: { qa_demo: true, fixture_marker: marker, observer_monitoring_consent: true, no_real_camera: true }
  }), "create fixture site");
  created = true;
  checked(await admin.from("digital_observer_camera_sources").insert([cameraId, secondCameraId].map((id, index) => ({
    id, observer_site_id: siteId, display_name: `בדיקת למידה ${index + 1}`, location_label: `אזור בדיקה ${index + 1}`,
    connector_type: "demo", source_mode: "sandbox", status: "ready_to_test", health_status: "unknown",
    capabilities: {}, metadata: { gateway_stream_id: `${marker}-${index}`, fixture_marker: marker, no_real_camera: true }
  }))), "create fixture cameras");
  const time = Date.now();
  const samples = Array.from({ length: 24 }, (_, index) => [0, 1].map((camera) => ({
    stream_id: `${marker}-${camera}`, sampled_at: new Date(time - (24 - index) * 1_000).toISOString(),
    motion_score: camera === 0 ? 0.1 : 0.8, luminance_score: 0.5
  }))).flat();
  assert.equal((await recordHomeActivityMetrics(admin, siteId, samples)).sampled, 48);
  const current = [{ stream_id: `${marker}-0`, sampled_at: new Date(time).toISOString(), motion_score: 0.95, luminance_score: 0.5 }];
  assert.equal((await recordHomeActivityMetrics(admin, siteId, current)).sampled, 1);
  assert.equal((await recordHomeActivityMetrics(admin, siteId, current)).sampled, 0);
  const baseline = checked(await admin.from("site_behavior_baselines").select("baseline_value").eq("observer_site_id", siteId).single(), "read baseline").baseline_value;
  assert.equal(baseline.camera_baselines[cameraId].samples, 25);
  assert.equal(baseline.camera_baselines[secondCameraId].samples, 24);
  assert.ok(Math.abs(baseline.camera_baselines[secondCameraId].averageMotionLevel - 0.8) < 1e-9);
  assert.equal(baseline.pending_learning_events.length, 0);
  const events = checked(await client.from("observer_intelligence_signals").select("id,metadata,human_review_required").eq("observer_site_id", siteId), "read journal with owner RLS");
  const anomalies = events.filter((event) => event.metadata.event_type === "home_activity_change");
  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].metadata.camera_source_id, cameraId);
  assert.equal(anomalies[0].human_review_required, true);
  assert.equal(anomalies[0].metadata.no_automatic_physical_action, true);
  console.log("PASS: persisted per-camera baselines, replay protection, anomaly journal, owner RLS and empty outbox (synthetic metrics only)");
} finally {
  if (created) {
    // Delete only rows owned by this exact freshly-created fixture; never use name/glob cleanup.
    const site = checked(await admin.from("observer_sites").select("id,metadata,owner_profile_id").eq("id", siteId).single(), "validate cleanup scope");
    assert.equal(site.metadata.fixture_marker, marker);
    assert.equal(site.owner_profile_id, login.user.id);
    checked(await admin.from("observer_sites").update({ monitoring_enabled: false }).eq("id", siteId), "disable fixture");
    for (const table of ["observer_intelligence_signals", "site_behavior_baselines", "observer_site_learning_profiles", "digital_observer_camera_sources"]) {
      checked(await admin.from(table).delete().eq("observer_site_id", siteId), `cleanup ${table}`);
    }
    checked(await admin.from("observer_sites").delete().eq("id", siteId).eq("owner_profile_id", login.user.id), "cleanup site");
    console.log("CLEANUP: removed only this run's isolated synthetic site, cameras, baselines and learning events");
  }
  await client.auth.signOut();
}

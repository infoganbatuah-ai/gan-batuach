import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const siteId = process.argv[2];
const incidentId = process.argv[3] ?? null;
assert.match(siteId ?? "", /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, "Valid Home Site ID required");
const allowed = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD"]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) if (existsSync(file)) {
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const home = createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL, password: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD });
assert.ok(!login.error && login.data.session, "Authorized Production admin login failed");
const homeLogin = await home.auth.signInWithPassword({ email: config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || config.QA_DEMO_DIGITAL_OBSERVER_EMAIL, password: config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD });
assert.ok(!homeLogin.error && homeLogin.data.session, "Authorized Home QA login failed");
try {
  const [samples, reviews, baselines, sources, sites] = await Promise.all([
    client.from("digital_observer_calibration_samples").select("id,observer_site_id,camera_source_id,ground_truth_review_id,canonical_label,event_types,model_provenance,detector_confidence,dataset_version,created_at").eq("observer_site_id", siteId).eq("environment", "PRODUCTION").eq("incident_provenance", "REAL_CAMERA_AI").order("created_at"),
    client.from("observer_ground_truth_reviews").select("id,observer_site_id,canonical_label,review_state,created_at").eq("observer_site_id", siteId).in("review_state", ["REVIEWED", "CORRECTED"]),
    home.from("site_behavior_baselines").select("baseline_type,baseline_value,confidence_level,learning_maturity,source_summary,updated_at").eq("observer_site_id", siteId),
    home.from("digital_observer_camera_sources").select("id,display_name,connector_type,status,health_status,last_seen_at,last_health_check_at,metadata").eq("observer_site_id", siteId),
    home.from("observer_sites").select("id,name").eq("id", siteId)
  ]);
  for (const [name, result] of Object.entries({ samples, reviews, baselines, sources, sites })) assert.ok(!result.error, `${name} read failed: ${result.error?.code ?? "unknown"}`);
  const reviewed = new Set(reviews.data.map(item => item.id));
  const qualitySamples = samples.data.filter(item => reviewed.has(item.ground_truth_review_id));
  const labels = Object.fromEntries([...new Set(qualitySamples.map(item => item.canonical_label))].map(label => [label, qualitySamples.filter(item => item.canonical_label === label).length]));
  const trueCount = (labels.TRUE_SECURITY_EVENT || 0) + (labels.TRUE_EXPECTED_ACTIVITY || 0);
  const fpCount = (labels.FALSE_DETECTION || 0) + (labels.FALSE_CORRELATION || 0) + (labels.FALSE_SPATIAL_EVENT || 0);
  const activity = baselines.data.find(item => item.baseline_type === "normal_camera_activity");
  const activityValue = activity?.baseline_value && typeof activity.baseline_value === "object" ? activity.baseline_value : {};
  const cameraBaselines = activityValue.camera_baselines && typeof activityValue.camera_baselines === "object" ? activityValue.camera_baselines : {};
  const expected = sources.data.filter(item => item.metadata?.channel_assignment !== "CHANNEL_EMPTY" && item.metadata?.channel_assignment !== "UNASSIGNED" && item.metadata?.physical_camera_attached !== false);
  const empty = sources.data.filter(item => item.metadata?.channel_assignment === "CHANNEL_EMPTY" || item.metadata?.channel_assignment === "UNASSIGNED" || item.metadata?.physical_camera_attached === false);
  const sampledIds = Object.keys(cameraBaselines).filter(id => expected.some(item => item.id === id));
  let incidentMetrics = null;
  if (!qualitySamples.length && incidentId) {
    assert.match(incidentId, /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i, "Valid Incident ID required");
    const response = await fetch(`https://ganbatuach.com/api/digital-observer/incidents/feedback?incident_id=${incidentId}`, { headers: { authorization: `Bearer ${login.data.session.access_token}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
    const body = await response.json().catch(() => null);
    assert.equal(response.status, 200, `Authorized Incident quality read failed: HTTP ${response.status}`);
    incidentMetrics = body?.data?.quality_metrics ?? null;
  }
  console.log(JSON.stringify({ status: "PASS", site_count: sites.data.length, authorized_incident_fallback: Boolean(incidentMetrics), dataset: { version: qualitySamples[0]?.dataset_version ?? (incidentMetrics ? "do-feedback-dataset-v1" : "NONE"), reviewed_samples: qualitySamples.length || incidentMetrics?.reviewedIncidentCount || 0, labels: qualitySamples.length ? labels : incidentMetrics?.labels || {}, camera_count: new Set(qualitySamples.map(item => item.camera_source_id).filter(Boolean)).size || (incidentMetrics ? 1 : 0), event_types: [...new Set(qualitySamples.flatMap(item => item.event_types || []))], model_provenance: qualitySamples[0]?.model_provenance ?? [], precision: trueCount + fpCount ? { numerator: trueCount, denominator: trueCount + fpCount, value: trueCount / (trueCount + fpCount) } : incidentMetrics?.reviewedDetectionPrecision || null, recall: "NOT_MEASURABLE_FALSE_NEGATIVE_GROUND_TRUTH_MISSING", latency: "NOT_MEASURED", calibration: (qualitySamples.length || incidentMetrics?.reviewedIncidentCount || 0) >= 20 ? "MEASURABLE" : "INSUFFICIENT_SAMPLE" }, learning: { expected_physical_cameras: expected.length || "NOT_MEASURED_CURRENT_AUTH_SCOPE", sampled_cameras: sampledIds.length || "NOT_MEASURED_CURRENT_AUTH_SCOPE", sampled_camera_ids: sampledIds, local_collection_cycles: activity ? Number(activityValue.sample_count || 0) : "NOT_MEASURED_CURRENT_AUTH_SCOPE", latest_batch_active_cameras: activity ? Number(activityValue.last_active_camera_count || 0) : "NOT_MEASURED_CURRENT_AUTH_SCOPE", baseline_confidence: activity?.confidence_level ?? null, baseline_confidence_meaning: "samples_per_camera_divided_by_288_capped_at_0.98_not_ai_accuracy", categories: baselines.data.map(item => ({ type: item.baseline_type, confidence: item.confidence_level, maturity: item.learning_maturity })) }, home: { configured_sources: sources.data.length || "NOT_MEASURED_CURRENT_AUTH_SCOPE", expected_physical_cameras: expected.length || "NOT_MEASURED_CURRENT_AUTH_SCOPE", empty_slots: sources.data.length ? empty.length : "NOT_MEASURED_CURRENT_AUTH_SCOPE", healthy_or_progressing: sources.data.length ? expected.filter(item => ["connected", "healthy", "online", "active", "progressing"].includes(String(item.health_status || item.status))).length : "NOT_MEASURED_CURRENT_AUTH_SCOPE" } }));
} finally { await Promise.all([client.auth.signOut(), home.auth.signOut()]); }

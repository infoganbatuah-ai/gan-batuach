import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const [originValue, siteId, incidentId] = process.argv.slice(2);
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
assert.match(siteId ?? "", uuid, "Valid observer site ID required");
assert.match(incidentId ?? "", uuid, "Valid Incident ID required");

const allowed = new Set([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QA_DEMO_DIGITAL_OBSERVER_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL",
  "QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD",
  "QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"
]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}

const url = config.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const homeEmail = config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || config.QA_DEMO_DIGITAL_OBSERVER_EMAIL;
const homePassword = config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
const adminEmail = config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL;
const adminPassword = config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD;
assert.ok(url && publicKey && homeEmail && homePassword && adminEmail && adminPassword, "Authorized Production QA user configuration is missing");

const home = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(client, email, password, label) {
  const login = await client.auth.signInWithPassword({ email, password });
  assert.ok(!login.error && login.data.session, `${label} authentication failed`);
  return login.data.session.access_token;
}

async function api(token, path, init = {}) {
  const response = await fetch(new URL(path, origin), {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers
    },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  let body = null;
  try { body = await response.json(); } catch { body = null; }
  return { response, body };
}

const incidentPath = `/api/digital-observer/incidents?observer_site_id=${siteId}&incident_id=${incidentId}`;
const feedbackPath = `/api/digital-observer/incidents/feedback?incident_id=${incidentId}`;
const submitKey = `push11-real-expected-${incidentId}`;

const homeToken = await signIn(home, homeEmail, homePassword, "Home operator");
const adminToken = await signIn(admin, adminEmail, adminPassword, "Digital Observer admin");

try {
  const before = await api(adminToken, incidentPath);
  assert.equal(before.response.status, 200, `Incident preflight failed with HTTP ${before.response.status}`);
  const beforeIncident = before.body?.data?.incidents?.find((item) => item.id === incidentId);
  const beforeRisk = before.body?.data?.risk_evaluations?.[0] ?? null;
  const beforeVerification = before.body?.data?.incident_verifications?.[0] ?? null;
  assert.equal(beforeIncident?.provenance, "REAL_CAMERA_AI", "Selected Incident is not canonical real-camera Production data");

  const submitPayload = {
    action: "submit",
    incident_id: incidentId,
    label: "TRUE_EXPECTED_ACTIVITY",
    target_type: "INCIDENT",
    reason_code: "CONTROLLED_NORMAL_HOME_PASSAGE",
    note: "מעבר ביתי רגיל ומבוקר; האירוע אמיתי אך הפעילות צפויה.",
    idempotency_key: submitKey
  };
  const homeBoundary = await api(homeToken, feedbackPath);
  assert.ok([403, 404].includes(homeBoundary.response.status),
    "Unscoped QA home user unexpectedly gained access to the real pilot Incident");

  const submitted = await api(adminToken, "/api/digital-observer/incidents/feedback", {
    method: "POST",
    body: JSON.stringify(submitPayload)
  });
  assert.equal(submitted.response.status, 200, `Real feedback submit failed with HTTP ${submitted.response.status}`);
  const feedbackId = submitted.body?.data?.feedback_id;
  assert.match(feedbackId ?? "", uuid, "Feedback ID missing");

  const duplicateSubmit = await api(adminToken, "/api/digital-observer/incidents/feedback", {
    method: "POST",
    body: JSON.stringify(submitPayload)
  });
  assert.equal(duplicateSubmit.response.status, 200, "Idempotent feedback retry failed");
  assert.equal(duplicateSubmit.body?.data?.feedback_id, feedbackId, "Feedback retry created a duplicate canonical revision");

  const reviewPayload = {
    action: "review",
    feedback_id: feedbackId,
    label: "TRUE_EXPECTED_ACTIVITY",
    reason_code: "REVIEWED_CONTROLLED_PASSAGE",
    note: "אושר כאירוע אמיתי של פעילות ביתית צפויה.",
    idempotency_key: `push11-reviewed-${feedbackId}`
  };
  const reviewed = await api(adminToken, "/api/digital-observer/incidents/feedback", {
    method: "POST",
    body: JSON.stringify(reviewPayload)
  });
  assert.equal(reviewed.response.status, 200, `Ground Truth review failed with HTTP ${reviewed.response.status}`);
  const review = reviewed.body?.data?.review;
  assert.match(review?.ground_truth_review_id ?? "", uuid, "Ground Truth review ID missing");
  assert.match(review?.calibration_sample_id ?? "", uuid, "Calibration sample ID missing");
  if (!review?.idempotent) {
    assert.equal(review?.automatic_production_change, false, "Ground Truth review attempted an automatic Production change");
  }

  const duplicateReview = await api(adminToken, "/api/digital-observer/incidents/feedback", {
    method: "POST",
    body: JSON.stringify(reviewPayload)
  });
  assert.equal(duplicateReview.response.status, 200, "Idempotent Ground Truth retry failed");
  assert.equal(duplicateReview.body?.data?.review?.ground_truth_review_id, review.ground_truth_review_id,
    "Ground Truth retry created a duplicate canonical review");

  const feedbackState = await api(adminToken, feedbackPath);
  assert.equal(feedbackState.response.status, 200, `Feedback state read failed with HTTP ${feedbackState.response.status}`);
  const state = feedbackState.body?.data;
  assert.equal(state?.incident?.current_feedback_label, "TRUE_EXPECTED_ACTIVITY");
  assert.equal(state?.incident?.current_ground_truth_label, "TRUE_EXPECTED_ACTIVITY");
  assert.ok(state?.feedback_history?.some((item) => item.id === feedbackId && item.label === "TRUE_EXPECTED_ACTIVITY"));
  assert.ok(state?.ground_truth_history?.some((item) => item.id === review.ground_truth_review_id
    && item.canonical_label === "TRUE_EXPECTED_ACTIVITY"));
  assert.ok(state?.calibration_samples?.some((item) => item.id === review.calibration_sample_id
    && item.training_eligible === false && item.raw_media_copied === false));
  assert.ok(state?.calibration_recommendations?.some((item) => item.ground_truth_review_id === review.ground_truth_review_id
    && item.requires_human_approval === true && item.production_change_applied === false));
  assert.ok(state?.quality_metrics?.reviewedIncidentCount >= 1, "Reviewed Production metric did not update");
  assert.ok(state?.quality_metrics?.labels?.TRUE_EXPECTED_ACTIVITY >= 1, "Expected-activity metric did not update");
  assert.equal(state?.quality_metrics?.recall?.available, false, "Recall must remain unavailable without missed-event ground truth");
  assert.equal(state?.contract?.raw_feedback_is_ground_truth, false);
  assert.equal(state?.contract?.automatic_production_mutation, false);

  const after = await api(adminToken, incidentPath);
  assert.equal(after.response.status, 200, `Incident postflight failed with HTTP ${after.response.status}`);
  const afterRisk = after.body?.data?.risk_evaluations?.[0] ?? null;
  const afterVerification = after.body?.data?.incident_verifications?.[0] ?? null;
  assert.deepEqual(
    { id: afterRisk?.id, score: afterRisk?.risk_score, band: afterRisk?.risk_band, version: afterRisk?.risk_engine_version },
    { id: beforeRisk?.id, score: beforeRisk?.risk_score, band: beforeRisk?.risk_band, version: beforeRisk?.risk_engine_version },
    "Feedback rewrote historical Risk"
  );
  assert.deepEqual(
    { id: afterVerification?.id, status: afterVerification?.status, version: afterVerification?.verification_version },
    { id: beforeVerification?.id, status: beforeVerification?.status, version: beforeVerification?.verification_version },
    "Feedback rewrote historical Verification"
  );

  console.log(JSON.stringify({
    status: "PASS",
    incident_id: incidentId,
    provenance: beforeIncident.provenance,
    feedback_id: feedbackId,
    feedback_label: "TRUE_EXPECTED_ACTIVITY",
    ground_truth_review_id: review.ground_truth_review_id,
    calibration_sample_id: review.calibration_sample_id,
    recommendation_id: review.recommendation_id,
    sample_size: state.quality_metrics.reviewedIncidentCount,
    expected_activity_count: state.quality_metrics.labels.TRUE_EXPECTED_ACTIVITY,
    false_detection_count: state.quality_metrics.labels.FALSE_DETECTION,
    recall_available: state.quality_metrics.recall.available,
    unscoped_user_denied: true,
    feedback_actor_scope: "AUTHORIZED_INTERNAL_OPERATOR",
    idempotent_submit: true,
    idempotent_review: true,
    historical_risk_unchanged: true,
    historical_verification_unchanged: true,
    automatic_production_mutation: false
  }, null, 2));
} finally {
  await home.auth.signOut();
  await admin.auth.signOut();
}

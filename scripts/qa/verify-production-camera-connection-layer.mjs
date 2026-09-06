import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const [originValue, siteId, cameraSourceId] = process.argv.slice(2);
const origin = new URL(originValue);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
assert.match(siteId ?? "", uuid, "Valid observer site ID required");
assert.match(cameraSourceId ?? "", uuid, "Valid camera source ID required");

const allowed = new Set([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL",
  "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"
]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(
  config.NEXT_PUBLIC_SUPABASE_URL && publicKey && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD,
  "Authorized Production Digital Observer admin QA configuration is missing"
);

const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const login = await client.auth.signInWithPassword({
  email: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL,
  password: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD
});
assert.ok(!login.error && login.data.session, "Authorized Production Digital Observer admin authentication failed");
const token = login.data.session.access_token;

async function api(path, init = {}) {
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
  const body = await response.json().catch(() => null);
  return { response, body };
}

try {
  const health = await fetch(new URL("/api/health", origin), {
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  assert.equal(health.status, 200, `Production health failed with HTTP ${health.status}`);

  const assessmentResult = await api("/api/digital-observer/connection-assessment", {
    method: "POST",
    body: JSON.stringify({
      action: "assess_existing",
      observer_site_id: siteId,
      camera_source_id: cameraSourceId,
      persist: true
    })
  });
  assert.equal(assessmentResult.response.status, 200, `Connection assessment failed with HTTP ${assessmentResult.response.status}`);
  const assessment = assessmentResult.body?.data?.assessment;
  assert.equal(assessment?.contractVersion, "camera-source-v1");
  assert.equal(assessment?.resolverVersion, "digital-first-resolver-v1");
  assert.equal(assessment?.recommendation, "PHYSICAL_GATEWAY_REQUIRED");
  assert.equal(assessment?.preferredMethod, "PHYSICAL_GATEWAY");
  assert.equal(assessment?.adapterType, "private_dvr_gateway");
  assert.equal(assessment?.productionEligible, true);
  assert.equal(assessment?.automaticFallbackEnabled, false);
  assert.ok(assessment?.reasonCodes?.includes("LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE"));
  assert.ok(assessment?.reasonCodes?.includes("OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE"));
  assert.ok(assessment?.capabilities?.includes("LIVE_STREAM"));
  assert.ok(assessment?.capabilities?.includes("CHANNEL_DISCOVERY"));
  assert.equal(assessmentResult.body?.data?.source?.id, cameraSourceId);
  assert.equal(assessmentResult.body?.data?.source?.observer_site_id, siteId);
  assert.equal(assessmentResult.body?.data?.persisted, true);
  const serializedAssessment = JSON.stringify(assessmentResult.body);
  assert.doesNotMatch(serializedAssessment, /secret_reference|gateway_stream_id|rtsp:\/\//i);

  const investigation = await api("/api/digital-observer/investigation", {
    method: "POST",
    body: JSON.stringify({
      observer_site_id: siteId,
      camera_source_id: cameraSourceId,
      question: "מה קרה בתקרית האחרונה בכניסה?",
      limit: 1
    })
  });
  assert.equal(investigation.response.status, 200, `Production investigation failed with HTTP ${investigation.response.status}`);
  const data = investigation.body?.data;
  assert.equal(data?.status, "READY");
  assert.equal(data?.result?.coverage?.realProvenanceOnly, true);
  assert.equal(data?.result?.coverage?.rawVideoAnalyzed, false);
  assert.equal(data?.result?.query?.rawSqlAllowed, false);
  const incident = data?.result?.incidents?.[0];
  assert.ok(incident, "No real Production Incident was returned for the verified camera");
  assert.equal(incident.provenance, "REAL_CAMERA_AI");
  assert.equal(incident.siteId, siteId);
  assert.equal(incident.cameraId, cameraSourceId);
  assert.ok((incident.timeline?.length ?? 0) > 0, "Real Production Incident has no Event timeline");

  console.log(JSON.stringify({
    status: "PASS",
    production_origin: origin.origin,
    camera_source_contract: assessment.contractVersion,
    resolver_version: assessment.resolverVersion,
    recommendation: assessment.recommendation,
    preferred_method: assessment.preferredMethod,
    adapter_type: assessment.adapterType,
    adapter_version: assessment.adapterVersion,
    production_eligible: assessment.productionEligible,
    reason_codes: assessment.reasonCodes,
    capabilities: assessment.capabilities,
    automatic_fallback_enabled: assessment.automaticFallbackEnabled,
    source_id: cameraSourceId,
    site_id: siteId,
    latest_real_incident: {
      id: incident.id,
      status: incident.status,
      provenance: incident.provenance,
      opened_at: incident.openedAt,
      event_ids: incident.timeline.map((item) => item.eventId).filter(Boolean)
    },
    secrets_exposed: false,
    mock_used: false,
    manual_event_used: false
  }, null, 2));
} finally {
  await client.auth.signOut();
}

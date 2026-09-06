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
  "Authorized Production admin QA configuration is missing"
);

const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const login = await client.auth.signInWithPassword({
  email: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL,
  password: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD
});
assert.ok(!login.error && login.data.session, "Authorized Production admin authentication failed");
const token = login.data.session.access_token;

async function query(question) {
  const response = await fetch(new URL("/api/digital-observer/investigation", origin), {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ observer_site_id: siteId, camera_source_id: cameraSourceId, question, limit: 20 }),
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, `Investigation query failed with HTTP ${response.status}: ${body?.error ?? "unknown"}`);
  return body?.data;
}

function assertGroundedRealResult(data, label) {
  assert.equal(data?.status, "READY", `${label} did not compile to a ready query`);
  assert.equal(data?.result?.coverage?.realProvenanceOnly, true, `${label} did not enforce real provenance`);
  assert.equal(data?.result?.coverage?.rawVideoAnalyzed, false, `${label} claimed raw-video analysis`);
  assert.equal(data?.result?.query?.rawSqlAllowed, false, `${label} allowed raw SQL`);
  const records = [...(data?.result?.incidents ?? []), ...(data?.result?.events ?? [])];
  assert.ok(records.length > 0, `${label} returned no real Production records`);
  assert.ok(records.every((record) => ["REAL_CAMERA_AI", "CAMERA_NATIVE_EVENT"].includes(record.provenance)), `${label} returned non-real provenance`);
  assert.ok(records.every((record) => record.siteId === siteId), `${label} returned a foreign site`);
  assert.ok(records.every((record) => record.cameraId === cameraSourceId), `${label} returned a foreign camera`);
  assert.ok((data?.result?.grounding?.eventIds?.length ?? 0) > 0, `${label} has no Event grounding IDs`);
}

try {
  const entries = await query("תראה לי את הכניסות דרך מצלמת הכניסה היום");
  assertGroundedRealResult(entries, "Query A");
  assert.ok(entries.result.events.every((event) => event.eventType === "person_entered"), "Query A returned a non-entry Event");

  const latest = await query("מה קרה בתקרית האחרונה בכניסה?");
  assertGroundedRealResult(latest, "Query B");
  assert.equal(latest.result.pagination.returned, 1, "Latest Incident query must return exactly one top-level result");
  assert.ok(latest.result.incidents.length === 1, "Query B did not return one canonical Incident");
  assert.ok(latest.result.incidents[0].timeline.length > 0, "Query B Incident has no factual timeline");

  const identity = await query("מי האדם הזה?");
  assert.equal(identity?.status, "UNSUPPORTED_CAPABILITY", "Unsupported identity question was not rejected truthfully");
  assert.equal(identity?.compilation?.limitation?.code, "IDENTITY_NOT_AVAILABLE");
  assert.equal(identity?.result, null, "Unsupported identity question executed retrieval");
  assert.equal(identity?.debug?.retrievalExecuted, false, "Unsupported identity question reached the data path");

  const playbackPaths = [...new Set([
    ...(entries.result.events ?? []).map((event) => event.evidence?.playbackPath),
    ...(entries.result.incidents ?? []).flatMap((incident) => incident.evidence?.playbackPaths ?? []),
    ...(latest.result.incidents ?? []).flatMap((incident) => incident.evidence?.playbackPaths ?? [])
  ].filter(Boolean))];
  assert.ok(playbackPaths.every((path) => /^\/api\/digital-observer\/event-clips\/[0-9a-f-]+\/media\?kind=clip$/i.test(path)), "Search exposed a raw or external media URL");

  console.log(JSON.stringify({
    status: "PASS",
    production_origin: origin.origin,
    site_id: siteId,
    camera_source_id: cameraSourceId,
    query_a: {
      answer: entries.result.answer,
      incident_ids: entries.result.grounding.incidentIds,
      event_ids: entries.result.grounding.eventIds,
      evidence_ids: entries.result.grounding.evidenceIds,
      result_count: entries.result.pagination.totalMatches,
      latency_ms: entries.result.queryLatencyMs
    },
    query_b: {
      answer: latest.result.answer,
      incident_id: latest.result.incidents[0].id,
      event_ids: latest.result.grounding.eventIds,
      risk: latest.result.incidents[0].risk,
      verification: latest.result.incidents[0].verification,
      decision: latest.result.incidents[0].decision,
      evidence: latest.result.incidents[0].evidence,
      latency_ms: latest.result.queryLatencyMs
    },
    unsupported_identity: {
      status: identity.status,
      limitation: identity.compilation.limitation,
      retrieval_executed: false
    },
    authorized_playback_candidates: playbackPaths,
    mock_used: false,
    manual_data_used: false
  }, null, 2));
} finally {
  await client.auth.signOut();
}

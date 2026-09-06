import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const [originValue, siteId, incidentId] = process.argv.slice(2);
const useAdmin = process.argv.includes("--admin");
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
assert.match(siteId ?? "", uuid, "Valid site ID required");
assert.match(incidentId ?? "", uuid, "Valid incident ID required");

const allowed = new Set([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD",
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
const email = useAdmin
  ? config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL
  : config.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com";
const password = useAdmin
  ? config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD
  : config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
assert.ok(url && publicKey && password, "Normal QA user configuration is missing");

const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email, password });
assert.ok(!login.error && login.data.session, "Normal Digital Observer user authentication failed");
try {
  const endpoint = new URL("/api/digital-observer/incidents", origin);
  endpoint.searchParams.set("observer_site_id", siteId);
  endpoint.searchParams.set("incident_id", incidentId);
  const response = await fetch(endpoint, {
    headers: { authorization: `Bearer ${login.data.session.access_token}` },
    redirect: "error",
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json();
  assert.equal(response.status, 200, `Authorized incident API failed with HTTP ${response.status}`);
  const incidents = body?.data?.incidents ?? [];
  const evaluations = body?.data?.risk_evaluations ?? [];
  const verifications = body?.data?.incident_verifications ?? [];
  const decisions = body?.data?.decision_intents ?? [];
  const incident = incidents.find((item) => item.id === incidentId);
  assert.ok(incident, "Authorized product response did not include the selected incident");
  assert.ok(evaluations.length > 0, "Authorized product response did not include risk history");
  assert.ok(verifications.length > 0, "Authorized product response did not include verification history");
  const latest = evaluations[0];
  const verification = verifications[0];
  assert.equal(incident.provenance, "REAL_CAMERA_AI");
  assert.equal(latest.risk_engine_version, "do-risk-v1");
  assert.equal(verification.verification_version, "do-verification-v2");
  assert.equal(incident.latest_verification_id, verification.id);
  assert.equal(incident.current_verification_status, verification.status);
  assert.equal(incident.final_decision, verification.final_decision);
  assert.ok(decisions.some((item) => item.metadata?.decision_stage === "post_verification_final"));
  assert.equal(body.data.risk_contract?.llm_decision, false);
  assert.equal(body.data.verification_contract?.engine, "do-verification-v2");
  assert.equal(body.data.verification_contract?.real_provenance_only, true);
  assert.equal(body.data.risk_contract?.external_execution_enabled, false);
  console.log(JSON.stringify({
    status: "PASS",
    incident_id: incident.id,
    incident_status: incident.status,
    provenance: incident.provenance,
    risk_score: latest.risk_score,
    risk_band: latest.risk_band,
    evaluation_confidence: latest.evaluation_confidence,
    decision: latest.recommended_decision,
    baseline_maturity: latest.baseline_context?.maturity ?? null,
    explanation_present: Boolean(latest.explanation?.headline),
    factor_count: latest.contributing_factors?.length ?? 0,
    mitigating_factor_count: latest.mitigating_factors?.length ?? 0,
    verification_id: verification.id,
    verification_status: verification.status,
    verification_classification: verification.classification,
    verification_confidence: verification.verification_confidence,
    final_decision: verification.final_decision,
    final_decision_confidence: verification.final_decision_confidence,
    verification_reason_count: verification.verification_reasons?.length ?? 0,
    confirmed_signal_count: verification.confirmed_signals?.length ?? 0,
    contradictory_signal_count: verification.contradictory_signals?.length ?? 0,
    verification_metrics: body.data.verification_metrics,
    external_execution_enabled: body.data.risk_contract?.external_execution_enabled
  }, null, 2));
} finally {
  await client.auth.signOut();
}

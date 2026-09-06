import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const [mode, originValue, siteId, textValue = "", cameraSourceId = "", fingerprint = "", ruleId = "", sinceValue = ""] = process.argv.slice(2);
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
assert.match(siteId ?? "", uuid, "Valid observer site ID required");
assert.ok(["schema", "preview", "confirm", "inspect", "wait"].includes(mode), "Mode must be schema, preview, confirm, inspect or wait");

const allowed = new Set([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"
]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(config.NEXT_PUBLIC_SUPABASE_URL && publicKey && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD,
  "Authorized Production admin QA configuration is missing");
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL, password: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD });
assert.ok(!login.error && login.data.session, "Authorized Production admin authentication failed");
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

async function listState() {
  const state = await api(`/api/digital-observer/watch-rules?observer_site_id=${siteId}`);
  assert.equal(state.response.status, 200, `Watch Rule API read failed with HTTP ${state.response.status}`);
  return state.body?.data;
}

try {
  if (mode === "schema") {
    const [rules, versions, evaluations] = await Promise.all([
      client.from("observer_watch_requests").select("id,rule_state,rule_version,compiler_version").eq("observer_site_id", siteId).limit(1),
      client.from("digital_observer_watch_rule_versions").select("id").eq("observer_site_id", siteId).limit(1),
      client.from("digital_observer_watch_rule_evaluations").select("id").eq("observer_site_id", siteId).limit(1)
    ]);
    assert.equal(rules.error, null, "Compiled Watch Rule columns unavailable");
    assert.equal(versions.error, null, "Watch Rule version table unavailable");
    assert.equal(evaluations.error, null, "Watch Rule evaluation table unavailable");
    console.log(JSON.stringify({ status: "PASS", migration: "20260906040000", compiled_columns_available: true, version_table_available: true, evaluation_table_available: true }, null, 2));
  }

  if (mode === "preview") {
    assert.ok(textValue.length >= 3, "Natural-language text required");
    assert.match(cameraSourceId, uuid, "Explicit authorized camera source ID required for controlled Production preview");
    const result = await api("/api/digital-observer/watch-rules", {
      method: "POST",
      body: JSON.stringify({ action: "compile", observer_site_id: siteId, text: textValue, camera_source_id: cameraSourceId })
    });
    assert.equal(result.response.status, 200, `Production compile failed with HTTP ${result.response.status}`);
    const data = result.body?.data;
    assert.equal(data?.compilation?.status, "READY_FOR_CONFIRMATION");
    assert.equal(data?.activated, false, "Preview must not activate a rule");
    assert.equal(data?.compilation?.candidate?.environment, "PRODUCTION");
    assert.equal(data?.compilation?.candidate?.safety?.externalExecutionEnabled, false);
    console.log(JSON.stringify({
      status: "READY_FOR_CONFIRMATION",
      preview: data.compilation.preview,
      candidate_fingerprint: data.compilation.candidateFingerprint,
      compiler_version: data.compilation.compilerVersion,
      historical_simulation: data.simulation,
      activated: false
    }, null, 2));
  }

  if (mode === "confirm") {
    assert.ok(textValue.length >= 3, "Natural-language text required");
    assert.match(cameraSourceId, uuid, "Explicit authorized camera source ID required");
    assert.match(fingerprint, /^[a-f0-9]{64}$/, "Exact confirmed preview fingerprint required");
    const idempotencyKey = `push12-confirm-${createHash("sha256").update(`${siteId}|${fingerprint}`).digest("hex").slice(0, 32)}`;
    const result = await api("/api/digital-observer/watch-rules", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm", observer_site_id: siteId, text: textValue, camera_source_id: cameraSourceId,
        candidate_fingerprint: fingerprint, idempotency_key: idempotencyKey
      })
    });
    if (result.response.status !== 201) {
      console.error(JSON.stringify({
        status: "CONFIRM_REJECTED",
        http_status: result.response.status,
        error: result.body?.error ?? null,
        details: result.body?.details ?? null
      }, null, 2));
    }
    assert.equal(result.response.status, 201, `Production confirm failed with HTTP ${result.response.status}`);
    assert.equal(result.body?.data?.activated, true);
    console.log(JSON.stringify({ status: "ACTIVE", ...result.body.data.rule, compiler_version: result.body.data.compilation.compilerVersion, external_execution: false }, null, 2));
  }

  if (mode === "inspect") {
    const data = await listState();
    console.log(JSON.stringify({
      status: "PASS",
      contract: data.contract,
      rules: (data.rules ?? []).map((rule) => ({ id: rule.id, title: rule.title, state: rule.rule_state, version: rule.rule_version, compiler: rule.compiler_version, match_count: rule.match_count, last_matched_at: rule.last_matched_at })),
      version_count: data.versions?.length ?? 0,
      evaluation_count: data.evaluations?.length ?? 0
    }, null, 2));
  }

  if (mode === "wait") {
    assert.match(ruleId, uuid, "Rule ID required");
    const since = Date.parse(sinceValue);
    assert.ok(Number.isFinite(since), "ISO start timestamp required");
    const deadline = Date.now() + 6 * 60_000;
    let matchedEvaluation = null;
    while (Date.now() < deadline && !matchedEvaluation) {
      const data = await listState();
      matchedEvaluation = (data.evaluations ?? []).find((evaluation) => evaluation.rule_id === ruleId
        && evaluation.matched === true && Date.parse(evaluation.evaluated_at) >= since) ?? null;
      if (!matchedEvaluation) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    assert.ok(matchedEvaluation, "No fresh real Production rule match arrived during the controlled window");
    const incident = await api(`/api/digital-observer/incidents?observer_site_id=${siteId}&incident_id=${matchedEvaluation.incident_id}`);
    assert.equal(incident.response.status, 200, "Matched Incident read failed");
    const incidentRow = incident.body?.data?.incidents?.find((item) => item.id === matchedEvaluation.incident_id);
    const risk = incident.body?.data?.risk_evaluations?.find((item) => item.id === matchedEvaluation.risk_evaluation_id);
    assert.equal(incidentRow?.provenance, "REAL_CAMERA_AI");
    assert.ok(risk?.matched_rules?.some((item) => item.id === ruleId), "Risk evaluation did not preserve the matched compiled rule");
    console.log(JSON.stringify({
      status: "PASS",
      rule_id: ruleId,
      evaluation_id: matchedEvaluation.id,
      event_id: matchedEvaluation.event_id,
      incident_id: matchedEvaluation.incident_id,
      risk_evaluation_id: risk.id,
      risk_score: risk.risk_score,
      risk_band: risk.risk_band,
      decision: risk.recommended_decision,
      matched_conditions: matchedEvaluation.matched_conditions,
      provenance: incidentRow.provenance,
      mock_used: false,
      external_action_executed: false,
      observed_at: matchedEvaluation.evaluated_at,
      qa_run_id: randomUUID()
    }, null, 2));
  }
} finally {
  await client.auth.signOut();
}

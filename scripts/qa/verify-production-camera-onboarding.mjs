import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

const [originValue, siteId, cameraSourceId] = process.argv.slice(2);
const origin = new URL(originValue);
assert.equal(origin.origin, "https://ganbatuach.com", "Exact Production origin required");

const allowed = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL", "QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"]);
const config = {};
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowed) if (!config[key] && values[key]) config[key] = values[key];
}
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(config.NEXT_PUBLIC_SUPABASE_URL && publicKey && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL && config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD, "Authorized Production QA configuration is missing");

const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL, password: config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD });
assert.ok(!login.error && login.data.session, "Authorized Production Digital Observer admin authentication failed");

try {
  const response = await fetch(new URL("/api/digital-observer/camera-onboarding", origin), {
    method: "POST",
    headers: { authorization: `Bearer ${login.data.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "get", observer_site_id: siteId }),
    redirect: "error", signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => null);
  assert.equal(response.status, 200, `Onboarding state read failed with HTTP ${response.status}`);
  const session = body?.data?.session;
  assert.equal(session?.contractVersion, "camera-onboarding-v1");
  assert.equal(session?.observerSiteId, siteId);
  assert.ok(["START", "ACTIVE", "DEGRADED", "ACTION_REQUIRED"].includes(session?.state), "Onboarding state is not truthful");
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /secret_reference|gateway_stream_id|rtsp:\/\//i);

  const sourceResult = await fetch(new URL("/api/digital-observer/connection-assessment", origin), {
    method: "POST",
    headers: { authorization: `Bearer ${login.data.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ action: "assess_existing", observer_site_id: siteId, camera_source_id: cameraSourceId, persist: false }),
    redirect: "error", signal: AbortSignal.timeout(30_000)
  });
  const sourceBody = await sourceResult.json().catch(() => null);
  assert.equal(sourceResult.status, 200, `Existing source reassessment failed with HTTP ${sourceResult.status}`);
  assert.equal(sourceBody?.data?.assessment?.recommendation, "PHYSICAL_GATEWAY_REQUIRED");
  assert.equal(sourceBody?.data?.persisted, false, "Existing home source must not be rewritten during UX verification");
  console.log(JSON.stringify({ status: "PASS", production_origin: origin.origin, onboarding_contract: session.contractVersion, onboarding_state: session.state, source_reassessment: "non_destructive", recommendation: sourceBody.data.assessment.recommendation, secrets_exposed: false, mock_used: false }, null, 2));
} finally {
  await client.auth.signOut();
}

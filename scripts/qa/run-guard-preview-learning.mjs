import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";

// Normal QA user authentication only. Never load, pull or transmit a server key.
const allowedKeys = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD", "QA_DEMO_DIGITAL_OBSERVER_PASSWORD"]);
const config = {};
for (const key of allowedKeys) if (process.env[key]) config[key] = process.env[key];
for (const file of [".env.qa-demo.local", ".env.local"]) {
  if (!existsSync(file)) continue;
  const values = parseEnv(readFileSync(file, "utf8"));
  for (const key of allowedKeys) if (!config[key] && values[key]) config[key] = values[key];
}
const argument = (name) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1);
assert.ok(process.argv.includes("--run-isolated-fixture"), "Explicit isolated fixture flag required");
const target = new URL(argument("--url"));
assert.ok(target.protocol === "https:" && /^gan-batuach-[a-z0-9]+-gan-batuach-s-projects\.vercel\.app$/.test(target.hostname)
  && !target.username && !target.password && target.pathname === "/" && !target.search && !target.hash, "Exact verified gan-batuach deployment origin required");
const commit = argument("--commit");
assert.match(commit ?? "", /^[a-f0-9]{40}$/, "Full verified Preview commit required");
assert.equal(config.NEXT_PUBLIC_SUPABASE_URL, "https://kuaywzvucllxjsxarogb.supabase.co", "QA project mismatch");
const publicKey = config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const password = config.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || config.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
assert.ok(publicKey && password, "Normal QA user configuration is missing");
const client = createClient(config.NEXT_PUBLIC_SUPABASE_URL, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: login, error } = await client.auth.signInWithPassword({ email: "qa.digital.observer.home@demo.ganbatuach.com", password });
assert.ok(!error && login.session, "Normal QA authentication failed");
try {
  const response = await fetch(new URL("/api/digital-observer/qa/learning-fixture", target), {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(90_000),
    headers: { authorization: `Bearer ${login.session.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ run_isolated_fixture: true, expected_commit: commit })
  });
  console.log(`Preview fixture HTTP: ${response.status}`);
  assert.ok(response.headers.get("content-type")?.includes("application/json"), "Preview endpoint unavailable or deployment protection active");
  const body = await response.json();
  // Output allowlist, not the raw response (including on authentication failures).
  const report = body?.data;
  if (report) console.log(JSON.stringify({
    passed: report.passed === true, cleanup: ["complete", "not_created", "failed"].includes(report.cleanup) ? report.cleanup : "unknown",
    failed_step: /^[a-z0-9_]+$/.test(report.failed_step ?? "") ? report.failed_step : null,
    checks: Array.isArray(report.checks) ? report.checks.filter((item) => typeof item === "string" && /^[a-z0-9_]+$/.test(item)) : [],
    fixture_site_id: /^[a-f0-9-]{36}$/.test(report.fixture_site_id ?? "") ? report.fixture_site_id : null
  }));
  assert.ok(response.ok && report?.passed === true && report.cleanup === "complete", "Preview fixture failed or cleanup incomplete; no automatic retry");
  assert.equal(report.commit, commit, "Unexpected deployed commit");
  assert.equal(report.branch, "codex/digital-guard-engine-eeb919c");
  assert.equal(report.hardware_actions, 0);
  console.log("PASS: live Preview write/read, per-camera learning, replay protection, owner RLS and verified cleanup; no hardware action");
} finally {
  await client.auth.signOut();
}

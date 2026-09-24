// Bounded synthetic scale proof. Inserts only tagged QA rows and always cleans them.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const container = "supabase_db_gan-batuach-m35-auth-qa";
const garden = "00000000-0000-4000-8000-000000000601";
const actor = "00000000-0000-4000-8000-000000000201";
const marker = "GB-M36-SCALE-QA";
const base = process.env.GB_M36_BASE_URL ?? "http://127.0.0.1:3016";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const psql = sql => execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { input: `${sql}\n`, encoding: "utf8" });
assert.equal(psql(`select name from public.gardens where id='${garden}' and name like 'QA %';`).trim(), "QA Garden A");
const keys = JSON.parse(execFileSync("supabase", ["status", "--workdir", "/private/tmp/gb-m35-auth-qa/stack", "--output", "json"], { encoding: "utf8" }));
assert.equal(keys.API_URL, "http://127.0.0.1:56421");
const saved = JSON.parse(readFileSync("/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/qa-identities.private.json", "utf8"));
const identity = saved.users.find(user => user.email === "manager-a@integration.qa.invalid");
assert.ok(identity?.password);
const jar = new Map();
const client = createServerClient(keys.API_URL, keys.ANON_KEY, {
  cookieOptions: { path: "/", sameSite: "lax", secure: false },
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)) }
});
const login = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
assert.equal(login.error, null);
assert.ok(login.data.session?.access_token);
assert.equal(login.data.user?.id, actor);
const jwtClaims = JSON.parse(Buffer.from(login.data.session.access_token.split(".")[1], "base64url").toString("utf8"));
assert.equal(jwtClaims.sub, actor);
assert.equal(jwtClaims.role, "authenticated");
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

const serviceHeaders = {
  apikey: keys.SERVICE_ROLE_KEY,
  Authorization: `Bearer ${keys.SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
};
const markerFilter = new URLSearchParams({ title: `like.${marker}*` }).toString();
const cleanup = async () => {
  const response = await fetch(`${keys.API_URL}/rest/v1/tasks?${markerFilter}`, { method: "DELETE", headers: serviceHeaders });
  assert.ok(response.status === 200 || response.status === 204);
};
await cleanup();
try {
  const rows = Array.from({ length: 500 }, (_, index) => ({
    garden_id: garden,
    title: `${marker} task ${index + 1}`,
    assigned_to: actor,
    created_by: actor,
    status: "open",
    priority: "low",
    created_at: new Date(Date.parse("2026-09-22T12:00:00Z") - (index + 1) * 1_000).toISOString()
  }));
  for (let offset = 0; offset < rows.length; offset += 100) {
    const response = await fetch(`${keys.API_URL}/rest/v1/tasks`, {
      method: "POST",
      headers: { ...serviceHeaders, Prefer: "return=minimal" },
      body: JSON.stringify(rows.slice(offset, offset + 100))
    });
    assert.ok(response.status === 200 || response.status === 201, await response.text());
  }
  const directRest = await fetch(`${keys.API_URL}/rest/v1/tasks?select=id&garden_id=eq.${garden}`, {
    headers: { apikey: keys.ANON_KEY, Authorization: `Bearer ${login.data.session.access_token}`, Prefer: "count=exact" }
  });
  assert.equal(directRest.status, 200);
  await directRest.json();
  const directCount = Number((directRest.headers.get("content-range") ?? "").split("/")[1]);
  const serviceRest = await fetch(`${keys.API_URL}/rest/v1/tasks?select=id&garden_id=eq.${garden}`, {
    headers: { apikey: keys.SERVICE_ROLE_KEY, Authorization: `Bearer ${keys.SERVICE_ROLE_KEY}`, Prefer: "count=exact" }
  });
  assert.equal(serviceRest.status, 200);
  const serviceCount = Number((serviceRest.headers.get("content-range") ?? "").split("/")[1]);
  assert.ok(serviceCount >= 500);
  assert.ok(directCount >= 500);
  const request = async path => {
    const started = performance.now();
    const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, signal: AbortSignal.timeout(60_000) });
    const payload = await response.json();
    return { response, payload, latencyMs: Math.round(performance.now() - started) };
  };
  const first = await request(`/api/reports?type=tasks&range=custom&from=2026-09-01&to=2026-09-30&garden_id=${garden}&page_size=999&page=1`);
  if (first.response.status !== 200 || first.payload?.data?.rows?.length !== 200) {
    console.error(JSON.stringify({ status: first.response.status, data: first.payload?.data, error: first.payload?.error }, null, 2));
  }
  assert.equal(first.response.status, 200);
  assert.equal(first.payload.data.pagination.page_size, 200);
  assert.equal(first.payload.data.rows.length, 200);
  assert.ok(first.payload.data.pagination.total >= 500);
  const third = await request(`/api/reports?type=tasks&range=custom&from=2026-09-01&to=2026-09-30&garden_id=${garden}&page_size=200&page=3`);
  assert.equal(third.response.status, 200);
  assert.ok(third.payload.data.rows.length >= 100);
  const receipt = { observedAt: new Date().toISOString(), environment: "DEVELOPMENT / INTEGRATION", syntheticRows: 500,
    productionAccess: false, pageLimit: first.payload.data.pagination.page_size, total: first.payload.data.pagination.total,
    firstPageLatencyMs: first.latencyMs, thirdPageLatencyMs: third.latencyMs };
  writeFileSync(process.env.GB_M36_SCALE_RECEIPT ?? "/private/tmp/gb-m36-reporting-scale-e2e.json", JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
  console.log(`GB-M36 reporting scale E2E PASS: 500 synthetic rows, page limit ${receipt.pageLimit}`);
} finally {
  await cleanup();
  const remaining = await fetch(`${keys.API_URL}/rest/v1/tasks?select=id&${markerFilter}`, {
    headers: { ...serviceHeaders, Prefer: "count=exact" }
  });
  assert.equal(remaining.status, 200);
  assert.equal(Number((remaining.headers.get("content-range") ?? "").split("/")[1]), 0);
}

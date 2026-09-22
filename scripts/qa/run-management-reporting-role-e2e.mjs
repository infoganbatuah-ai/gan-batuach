// Authenticated GB-M36 report API matrix. Synthetic loopback QA only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const base = process.env.GB_M36_BASE_URL ?? "http://127.0.0.1:3016";
const stack = process.env.GB_M36_STACK ?? "/private/tmp/gb-m35-auth-qa/stack";
const identitiesPath = process.env.GB_M36_IDENTITIES ?? "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/qa-identities.private.json";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const keys = JSON.parse(execFileSync("supabase", ["status", "--workdir", stack, "--output", "json"], { encoding: "utf8" }));
assert.equal(keys.API_URL, "http://127.0.0.1:56421");
assert.ok(keys.ANON_KEY);
const saved = JSON.parse(readFileSync(identitiesPath, "utf8"));
assert.equal(saved.environment, "DEVELOPMENT / INTEGRATION");

const actors = ["manager-a", "owner-ab", "parent-a", "staff-a", "inspector-a", "admin"];
const cookies = new Map();
for (const actor of actors) {
  const identity = saved.users.find(user => user.email === `${actor}@integration.qa.invalid`);
  assert.ok(identity?.password, `Missing synthetic identity ${actor}`);
  const jar = new Map();
  const client = createServerClient(keys.API_URL, keys.ANON_KEY, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const login = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.equal(login.error, null, `Synthetic login failed: ${actor}`);
  cookies.set(actor, [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
}

const gardenA = "00000000-0000-4000-8000-000000000601";
const gardenB = "00000000-0000-4000-8000-000000000602";
const childA = "00000000-0000-4000-8000-000000000901";
const childB = "00000000-0000-4000-8000-000000000902";
const cases = [
  [null, "unauthenticated", "/api/reports?type=dashboard", 401],
  ["manager-a", "manager dashboard", `/api/reports?type=dashboard&range=month&garden_id=${gardenA}`, 200],
  ["manager-a", "manager cross-Garden IDOR", `/api/reports?type=attendance&garden_id=${gardenB}`, 403],
  ["owner-ab", "multi-Garden network", "/api/reports?type=network_summary&range=month", 200],
  ["parent-a", "parent own attendance", `/api/reports?type=attendance&child_id=${childA}`, 200],
  ["parent-a", "parent cross-Child IDOR", `/api/reports?type=attendance&child_id=${childB}`, 403],
  ["parent-a", "parent own tuition", `/api/reports?type=tuition&child_id=${childA}`, 200],
  ["staff-a", "staff own hours", "/api/reports?type=staff_hours", 200],
  ["staff-a", "staff tuition denied", "/api/reports?type=tuition", 403],
  ["inspector-a", "assigned inspection portfolio", `/api/reports?type=inspector_portfolio&garden_id=${gardenA}`, 200],
  ["inspector-a", "inspector cross-Garden IDOR", `/api/reports?type=inspections&garden_id=${gardenB}`, 403],
  ["inspector-a", "inspector payroll denied", "/api/reports?type=staff_hours", 403],
  ["admin", "admin aggregate", "/api/reports?type=platform_summary", 200],
  ["admin", "admin private documents denied", "/api/reports?type=documents", 403]
];

const results = [];
for (const [actor, name, path, expected] of cases) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    headers: actor ? { Cookie: cookies.get(actor) } : {},
    redirect: "manual",
    signal: AbortSignal.timeout(60_000)
  });
  const payload = await response.json().catch(() => null);
  const pass = response.status === expected;
  results.push({ name, actor, status: response.status, expected, pass, report: payload?.data?.report ?? null,
    total: payload?.data?.pagination?.total ?? null, latencyMs: Math.round(performance.now() - started) });
  assert.equal(response.status, expected, name);
  if (response.status === 200) {
    assert.equal(response.headers.get("cache-control"), "private, no-store", `${name} cache policy`);
    assert.equal(payload?.data?.freshness?.live, false, `${name} truthful freshness`);
  }
}

for (const report of ["attendance", "pickup", "staff_hours", "tuition", "subscription", "inspections", "corrective_actions", "complaints", "tasks", "documents", "enrollment", "capacity"]) {
  const started = performance.now();
  const response = await fetch(`${base}/api/reports?type=${report}&range=month&garden_id=${gardenA}`, {
    headers: { Cookie: cookies.get("manager-a") }, signal: AbortSignal.timeout(60_000)
  });
  const payload = await response.json().catch(() => null);
  results.push({ name: `manager source ${report}`, actor: "manager-a", status: response.status, expected: 200, pass: response.status === 200,
    total: payload?.data?.pagination?.total ?? null, latencyMs: Math.round(performance.now() - started) });
  assert.equal(response.status, 200, `manager source ${report}`);
}

const csvStarted = performance.now();
const csv = await fetch(`${base}/api/reports?type=attendance&range=month&format=csv&garden_id=${gardenA}`, {
  headers: { Cookie: cookies.get("manager-a") }, signal: AbortSignal.timeout(60_000)
});
assert.equal(csv.status, 200, "authorized CSV export");
assert.match(csv.headers.get("content-type") ?? "", /^text\/csv/);
assert.match(csv.headers.get("content-disposition") ?? "", /^attachment; filename="gan-batuach-attendance-/);
const csvBytes = new Uint8Array(await csv.arrayBuffer());
assert.deepEqual([...csvBytes.slice(0, 3)], [0xef, 0xbb, 0xbf], "CSV includes UTF-8 BOM");
results.push({ name: "authorized CSV export", actor: "manager-a", status: csv.status, expected: 200, pass: true, latencyMs: Math.round(performance.now() - csvStarted), bytes: csvBytes.length });

const latencies = results.map(result => result.latencyMs).filter(Number.isFinite).sort((a, b) => a - b);
const receipt = { observedAt: new Date().toISOString(), environment: "DEVELOPMENT / INTEGRATION", syntheticOnly: true, productionAccess: false,
  performance: { samples: latencies.length, p50Ms: latencies[Math.floor(latencies.length * 0.5)], p95Ms: latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))], maxMs: latencies.at(-1) }, results };
writeFileSync(process.env.GB_M36_QA_RECEIPT ?? "/private/tmp/gb-m36-reporting-role-e2e.json", JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
console.log(`GB-M36 reporting role E2E PASS: ${results.length}/${results.length}`);

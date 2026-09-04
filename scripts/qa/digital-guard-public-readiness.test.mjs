import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPublicGuardReadiness, probes } from "./check-digital-guard-public-readiness.mjs";

test("public probe uses no secrets, cookies, identifiers, redirects or camera commands", async () => {
  let calls = 0;
  const report = await checkPublicGuardReadiness(async (url, options) => {
    const probe = probes[calls++];
    assert.equal(url, `https://ganbatuach.com${probe.path}`);
    assert.equal(options.credentials, "omit");
    assert.equal(options.redirect, "manual");
    assert.equal(new Headers(options.headers).has("authorization"), false);
    assert.equal(new Headers(options.headers).has("cookie"), false);
    if (options.method === "POST") assert.equal(options.body, "{}");
    return Response.json(probe.health ? { ok: true, app: "ok", supabase: "ok", secret: "DO_NOT_EXPOSE" } : { error: "DO_NOT_EXPOSE" }, { status: probe.expected });
  });
  assert.equal(calls, probes.length);
  assert.ok(report.results.every(result => result.outcome === "passed"));
  assert.ok(!JSON.stringify(report).includes("DO_NOT_EXPOSE"));
  assert.equal(report.coverage.authenticated_user_flow_verified, false);
});

test("missing route, redirects and empty health success are not reported as passed", async () => {
  for (const status of [200, 302, 404, 503]) {
    const report = await checkPublicGuardReadiness(async () => Response.json({}, { status }));
    assert.ok(report.results.every(result => result.outcome !== "passed"));
    if (status === 404) assert.ok(report.results.every(result => result.outcome === "route_unavailable"));
  }
});

test("network failure remains unavailable without leaking diagnostic details", async () => {
  const report = await checkPublicGuardReadiness(async () => { throw Error("DO_NOT_EXPOSE"); });
  assert.ok(report.results.every(result => result.outcome === "unreachable"));
  assert.ok(!JSON.stringify(report).includes("DO_NOT_EXPOSE"));
});

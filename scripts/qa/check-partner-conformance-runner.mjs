import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runSignedConformance } from "../../examples/digital-observer-partner-app/conformance.mjs";

const origin = "https://sandbox.example.invalid";
const route = "/api/digital-observer/external/v1";
const ids = Array.from({ length: 4 }, (_, i) => `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const config = {
  approvedOrigin: origin, baseUrl: origin + route, runRef: "p43-syntheticrun",
  sdkRevision: "7cea7e8460886e797d9cc208997be5080e31e95a",
  credential: "dosvc_fixture_only_not_a_real_secret",
  allowedSite: ids[0], deniedSite: ids[1], firstCamera: ids[2], secondCamera: ids[3],
};

function fakeTransport({ omitDeniedCode = false, wrongSource = false } = {}) {
  const calls = [];
  const send = async (url, init) => {
    calls.push(url);
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, `${route}/cameras`);
    assert.equal(init.method, "GET");
    assert.equal(init.redirect, "error");
    assert.ok(init.signal instanceof AbortSignal);
    assert.match(init.headers.get("x-do-signature"), /^v1=[a-f0-9]{64}$/);
    assert.equal(init.headers.get("authorization"), `Bearer ${config.credential}`);
    if (url.searchParams.get("site_id") === config.deniedSite) {
      return Response.json({ error: { code: omitDeniedCode ? "PERMISSION_DENIED" : "EXTERNAL_API_SITE_SCOPE_DENIED",
        request_id: "private-correlation" } }, { status: 403 });
    }
    assert.equal(url.searchParams.get("limit"), "1");
    const second = url.searchParams.has("cursor");
    if (second) assert.equal(url.searchParams.get("cursor"), "fixture-cursor");
    return Response.json({
      api_version: "2026-10-19.v1",
      data: [{ id: wrongSource ? config.deniedSite : second ? config.secondCamera : config.firstCamera,
        observer_site_id: config.allowedSite, display_name: "private-name" }],
      pagination: { limit: 1, next_cursor: second ? null : "fixture-cursor" },
    });
  };
  return { calls, send };
}

test("the partner runner signs three bounded GETs and returns only fixed evidence fields", async () => {
  const { calls, send } = fakeTransport();
  const receipt = await runSignedConformance(config, send);
  assert.equal(calls.length, 3);
  assert.deepEqual(receipt.checks, {
    signed_paging: "PASS", cross_site_denial: "PASS", browser_embed: "NOT_RUN",
    browser_revocation: "NOT_RUN", site_transfer: "NOT_RUN", usage_attribution: "NOT_RUN",
  });
  assert.equal(receipt.evidence, "PARTNER_RUN_CANDIDATE");
  const template = JSON.parse(readFileSync(new URL("../../examples/digital-observer-partner-app/conformance-receipt.template.json", import.meta.url), "utf8"));
  assert.deepEqual(Object.keys(receipt), Object.keys(template));
  assert.deepEqual(Object.keys(receipt.checks), Object.keys(template.checks));
  assert.ok(Object.values(template.checks).every((status) => status === "NOT_RUN"));
  const serialized = JSON.stringify(receipt);
  for (const value of [origin, config.credential, ...ids, "fixture-cursor", "private-name", "private-correlation"]) {
    assert.ok(!serialized.includes(value));
  }
});

test("wrong source stops paging and a generic 403 does not prove Site denial", async () => {
  const invalidPage = fakeTransport({ wrongSource: true });
  const first = await runSignedConformance(config, invalidPage.send);
  assert.equal(first.checks.signed_paging, "FAIL");
  assert.equal(first.checks.cross_site_denial, "NOT_RUN");
  assert.equal(invalidPage.calls.length, 1);
  const genericDenial = await runSignedConformance(config, fakeTransport({ omitDeniedCode: true }).send);
  assert.equal(genericDenial.checks.signed_paging, "PASS");
  assert.equal(genericDenial.checks.cross_site_denial, "FAIL");
});

test("a mismatched origin, a non-HTTPS target or a URL with a query sends no request", async () => {
  const { calls, send } = fakeTransport();
  for (const patch of [
    { approvedOrigin: "https://other.example.invalid" },
    { baseUrl: `${origin}${route}?unexpected=1` },
    { approvedOrigin: "http://sandbox.example.invalid", baseUrl: `http://sandbox.example.invalid${route}` },
  ]) await assert.rejects(runSignedConformance({ ...config, ...patch }, send), /EXACT_APPROVED_SANDBOX_REQUIRED/);
  assert.deepEqual(calls, []);
});

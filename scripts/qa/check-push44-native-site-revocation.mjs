import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./mobile-runtime" && context.parentURL?.endsWith("native-push-lifecycle.ts")) {
      return next("./mobile-runtime.ts", context);
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const { resolveNativePushSite, scopedPushRevocationConfirmed, verifiedMobileRuntimeSites } =
  await import("../../lib/domain/digital-observer/native-push-lifecycle.ts");
const oldSite = "00000000-0000-4000-8000-000000000044";
const nextSite = "00000000-0000-4000-8000-000000000045";
const profile = "00000000-0000-4000-8000-000000000046";
const runtimePayload = (sites) => ({ data: { contract: "digital-observer-mobile-runtime-v1",
  session: { active: true, profile_id: profile },
  sites: sites.map((id) => ({ id, name: "Synthetic Site", timezone: null })) } });

test("a verified empty or changed authorization list revokes the exact saved Site and never selects another implicitly", async () => {
  const revoked = [];
  const result = await resolveNativePushSite([nextSite], oldSite, null, async (siteId) => revoked.push(siteId));
  assert.deepEqual(revoked, [oldSite]);
  assert.deepEqual(result, { siteId: null, revokedSiteId: oldSite });
  const empty = await resolveNativePushSite([], oldSite, null, async (siteId) => revoked.push(siteId));
  assert.deepEqual(empty, { siteId: null, revokedSiteId: oldSite });
});

test("failed revocation keeps the local target and prevents new-site registration", async () => {
  let saved = oldSite;
  await assert.rejects(resolveNativePushSite([nextSite], saved, nextSite, async () => {
    throw new Error("PUSH_REVOCATION_UNCONFIRMED");
  }), /PUSH_REVOCATION_UNCONFIRMED/);
  assert.equal(saved, oldSite);
});

test("explicit authorized switch first revokes old scope, then permits the selected Site", async () => {
  const steps = [];
  const result = await resolveNativePushSite([oldSite, nextSite], oldSite, nextSite,
    async (siteId) => steps.push(`revoke:${siteId}`));
  steps.push(`register:${result.siteId}`);
  assert.deepEqual(steps, [`revoke:${oldSite}`, `register:${nextSite}`]);
  assert.equal(result.revokedSiteId, oldSite);
});

test("an unauthorized request cannot displace a still-authorized saved Site", async () => {
  let calls = 0;
  await assert.rejects(resolveNativePushSite([oldSite], oldSite, nextSite, async () => { calls += 1; }),
    /PUSH_SITE_REVOKED/);
  assert.equal(calls, 0);
  assert.equal((await resolveNativePushSite([oldSite], oldSite, null, async () => { calls += 1; })).siteId, oldSite);
  assert.equal(calls, 0);
});

test("only complete authenticated runtime responses can trigger revocation decisions", () => {
  assert.deepEqual(verifiedMobileRuntimeSites(runtimePayload([oldSite])).map((site) => site.id), [oldSite]);
  for (const payload of [null, {}, { data: { sites: [] } },
    { data: { ...runtimePayload([]).data, session: { active: false, profile_id: profile } } },
    runtimePayload([oldSite, oldSite])]) {
    assert.throws(() => verifiedMobileRuntimeSites(payload), /RUNTIME_RESPONSE_UNTRUSTED/);
  }
});

test("a server response must explicitly confirm exact scoped revocation", () => {
  assert.equal(scopedPushRevocationConfirmed({ data: { confirmed: true, devices: [] } }), true);
  assert.equal(scopedPushRevocationConfirmed({ data: { confirmed: true,
    devices: [{ id: "synthetic-row", is_active: false }] } }), true);
  for (const value of [null, {}, { data: { devices: [] } },
    { data: { confirmed: true, devices: [{ id: "synthetic-row", is_active: true }] } }]) {
    assert.equal(scopedPushRevocationConfirmed(value), false);
  }
});

test("native runtime wiring preserves a revoked Site until server confirmation", () => {
  const source = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
  assert.match(source, /await resolveNativePushSite\(sites\.map/);
  assert.match(source, /scopedPushRevocationConfirmed\(await response\.json/);
  assert.match(source, /if \(saved\.value === siteId\) \{\s*await Preferences\.remove/);
  assert.match(source, /authorizationFresh && requestedSite/);
  assert.ok(source.indexOf("await Preferences.set({ key: pushSiteKey, value: selected.siteId })") <
    source.indexOf("await registerDevice(selected.siteId, token.value)"));
  assert.doesNotMatch(source, /if \(error instanceof Error && error\.message === "PUSH_SITE_REVOKED"\) \{\s*await Preferences\.remove/);
});

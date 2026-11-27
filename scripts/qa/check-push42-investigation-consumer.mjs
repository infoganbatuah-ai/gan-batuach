import assert from "node:assert/strict";
import test from "node:test";
import { DigitalObserverServerClient } from "../../packages/digital-observer-sdk/src/index.ts";
import { DigitalObserverEmbeddedClient } from "../../packages/digital-observer-sdk/src/browser.ts";
import {
  DIGITAL_OBSERVER_EXTERNAL_API_VERSION, DIGITAL_OBSERVER_EXTERNAL_API_PREFIX, externalApiPermissionMap,
  ganBatuachRoleMapping, verifyExternalApiSignature,
} from "../../lib/domain/digital-observer/external-api-contract.ts";
import { DIGITAL_OBSERVER_PARTNER_CONTRACT, embeddedDashboardReadScopes, issueEmbeddedToken, verifyEmbeddedAudience } from "../../lib/domain/digital-observer/partner-platform.ts";
import { ganBatuachObserverIntegrationPolicy } from "../../lib/domain/digital-observer/integration-contract.ts";
import { buildExternalInvestigationReport } from "../../lib/domain/digital-observer/external-investigation-report.ts";
import { guardHistoryPrivacyRestricted } from "../../lib/domain/digital-observer/investigation-history-policy.ts";

const baseUrl = `https://observer.example.invalid${DIGITAL_OBSERVER_EXTERNAL_API_PREFIX}`;
const credential = "dosvc_fixture_only";
const site = { site_type: "home", garden_id: null, business_handles_children: false };
const allowedRow = { id: "current", tenant: "tenant-a", site: "site-a", source: "camera-a" };
const rows = [
  allowedRow, { ...allowedRow, id: "different-tenant", tenant: "tenant-b" },
  { ...allowedRow, id: "different-site", site: "site-b" },
  { ...allowedRow, id: "different-camera", source: "camera-b" },
];
const routeScopes = { cameras: "cameras.read", events: "events.read", evidence: "evidence.read", investigations: "investigations.run" };
const error = (status, code) => Response.json({ error: { code } }, { status });

function syntheticServer() {
  const now = Math.floor(Date.now() / 1000);
  const grant = {
    ...allowedRow, expires: now + 30, revoked: false, permissions: Object.values(externalApiPermissionMap),
  };
  let clock = now;
  let policySite = site;
  const client = new DigitalObserverServerClient({ baseUrl, credential, fetch: async (target, init) => {
    const request = new Request(target, init);
    const url = new URL(request.url);
    const body = await request.text();
    const signed = verifyExternalApiSignature({
      method: request.method, path: url.pathname + url.search, body, credential, now: clock,
      timestamp: request.headers.get("x-do-timestamp"), nonce: request.headers.get("x-do-nonce"),
      signature: request.headers.get("x-do-signature"),
    });
    if (!signed.valid || request.headers.get("authorization") !== `Bearer ${credential}`) return error(401, "INVALID_AUTH");
    if (grant.revoked || clock >= grant.expires) return error(401, "INACTIVE_GRANT");
    const [resource, id] = url.pathname.slice(DIGITAL_OBSERVER_EXTERNAL_API_PREFIX.length + 1).split("/");
    const permission = externalApiPermissionMap[routeScopes[resource]];
    if (!permission) return error(404, "UNSUPPORTED_ROUTE");
    const siteId = body ? JSON.parse(body).site_id : url.searchParams.get("site_id");
    if (siteId !== grant.site || !grant.permissions.includes(permission)) return error(403, "DENIED_SCOPE");
    const visible = rows.filter((row) => row.tenant === grant.tenant && row.site === grant.site && row.source === grant.source);
    if (resource === "evidence" && !visible.some((row) => row.id === id)) return error(404, "EVIDENCE_NOT_FOUND");
    if (resource === "investigations" && guardHistoryPrivacyRestricted(policySite)) return error(403, "HISTORY_DENIED");
    return Response.json({
      api_version: DIGITAL_OBSERVER_EXTERNAL_API_VERSION,
      ids: visible.map((row) => row.id),
      ...(resource === "investigations" ? { report: buildExternalInvestigationReport({ grounding: { evidenceIds: ["current"] } }) } : {}),
    });
  } });
  return { client, grant, setClock: (value) => { clock = value; }, setPolicy: (value) => { policySite = value; } };
}

test("signed SDK reads Events, Evidence, health and investigations under a synthetic single-camera grant", async () => {
  const { client } = syntheticServer();
  for (const reply of await Promise.all([
    client.events("site-a"), client.evidence("site-a", "current"),
    client.cameraHealth("site-a"), client.investigation("site-a", "מה קרה בכניסה?"),
  ])) {
    assert.deepEqual(reply.ids, ["current"]);
    assert.equal(reply.api_version, "2026-10-19.v1");
  }
  const report = (await client.investigation("site-a", "מה קרה בכניסה?")).report;
  assert.deepEqual(report.source_recording, { status: "unavailable", reason: "archive_access_not_validated" });
  assert.equal(report.source_recording_retrieval_supported, false);
  assert.doesNotMatch(JSON.stringify(report), /url|credential|recording_id|token/i);
});

test("signed SDK rejects wrong Site, Evidence from another scope, missing permission and archive routes", async () => {
  const { client, grant } = syntheticServer();
  await assert.rejects(client.events("site-b"), { status: 403 });
  for (const id of ["different-tenant", "different-site", "different-camera"]) {
    await assert.rejects(client.evidence("site-a", id), { status: 404 });
  }
  grant.permissions = [externalApiPermissionMap["cameras.read"]];
  await assert.rejects(client.investigation("site-a", "מה קרה?"), { status: 403 });
  await assert.rejects(client.request("/archive?site_id=site-a"), { status: 404 });
});

test("synthetic transport enforces expiration, revocation and shared privacy policy", async () => {
  const f = syntheticServer();
  for (const restricted of [{ site_type: "kindergarten" }, { ...site, business_handles_children: true },
    { ...site, vision_privacy_mode: "skeleton_only" }, { ...site, garden_id: "g" }, { site_type: "unknown" }]) {
    f.setPolicy(restricted);
    await assert.rejects(f.client.investigation("site-a", "מה קרה?"), { status: 403 });
  }
  f.setPolicy(site);
  f.grant.revoked = true;
  await assert.rejects(f.client.events("site-a"), { status: 401 });
  f.grant.revoked = false;
  f.setClock(f.grant.expires);
  await assert.rejects(f.client.cameraHealth("site-a"), { status: 401 });
});

test("embedded SDK uses a short-lived audience-bound token, and Gan Batuach roles do not inherit archive access", async () => {
  const now = Date.now();
  const token = issueEmbeddedToken({ pepper: "fixture-pepper-only", ttlMinutes: 1, now });
  assert.equal(DIGITAL_OBSERVER_PARTNER_CONTRACT, "digital-observer-partner-v1");
  assert.equal(Date.parse(token.expiresAt) - now, 60_000);
  let clock = now;
  let revoked = false;
  const client = (audience) => new DigitalObserverEmbeddedClient({
    endpoint: "https://observer.example.invalid/embed", token: token.raw, audience,
    fetch: async (target, init) => {
      const request = new Request(target, init);
      if (revoked || clock >= Date.parse(token.expiresAt) || request.headers.get("authorization") !== `Bearer ${token.raw}` ||
        !verifyEmbeddedAudience({ expected: "site-a-dashboard", actual: request.headers.get("x-do-audience") })) {
        return error(403, "EMBED_DENIED");
      }
      assert.equal(init.credentials, "omit");
      return Response.json({ contract: DIGITAL_OBSERVER_PARTNER_CONTRACT, site_id: "site-a" });
    },
  });
  await assert.rejects(client("site-b-dashboard").dashboard(), /EMBED_DENIED/);
  assert.equal((await client("site-a-dashboard").dashboard()).site_id, "site-a");
  revoked = true;
  await assert.rejects(client("site-a-dashboard").dashboard(), /EMBED_DENIED/);
  revoked = false;
  clock = Date.parse(token.expiresAt);
  await assert.rejects(client("site-a-dashboard").dashboard(), /EMBED_DENIED/);
  assert.deepEqual(ganBatuachRoleMapping.parent, []);
  assert.deepEqual(ganBatuachRoleMapping.staff, []);
  assert(!Object.values(ganBatuachRoleMapping).flat().some((scope) => /archive|media|clip/.test(scope)));
  assert.equal(ganBatuachObserverIntegrationPolicy.activeByDefault, false);
  assert.equal(ganBatuachObserverIntegrationPolicy.directTableSharingAllowed, false);
});

test("embedded query plan requires each permission and suppresses restricted history", () => {
  const scopes = ["cameras.read", "events.read", "evidence.read"];
  assert.deepEqual(embeddedDashboardReadScopes(scopes, true), {
    cameraHealth: false, events: true, incidents: false, evidence: true,
  });
  assert.deepEqual(embeddedDashboardReadScopes([...scopes, "camera_health.read"], false), {
    cameraHealth: true, events: false, incidents: false, evidence: false,
  });
});

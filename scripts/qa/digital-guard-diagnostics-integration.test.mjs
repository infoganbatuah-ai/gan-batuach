import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const input = { observer_site_id: id(1), camera_source_id: id(2), request_id: id(3), task_kind: "capability_snapshot" };
const preflight = { ...input, task_kind: "command_preflight", action: "talk", payload: { text: "PRIVATE_SYNTHETIC_WARNING" } };
const profile = { id: id(4), active: true, role: "owner" };
const site = { id: id(1), owner_profile_id: profile.id, site_type: "home", garden_id: null, business_handles_children: false, vision_privacy_mode: "standard_consent" };
const source = { id: id(2), observer_site_id: id(1), connector_type: "gateway", gateway_id: "synthetic-gateway", stream_id: "synthetic-stream", channel: 1 };
const access = loadTs("lib/domain/digital-observer/access.ts");

function fixture(options = {}) {
  let clock = Date.now(), queueFailures = options.queueFailures ?? 0, adminCreations = 0;
  const audits = new Map(), queue = new Map(), calls = [];
  const activeProfile = { ...profile, ...options.profile };
  const activeSite = { ...site, ...options.site };
  const activeSource = { ...source, ...options.source };
  const error = code => Response.json({ code, message: "synthetic failure" }, { status: 400 });
  const client = privilege => createClient("https://fixture.invalid", "synthetic-key", { auth: { persistSession: false, autoRefreshToken: false }, global: {
    async fetch(resource, config) {
      const url = new URL(resource), table = url.pathname.split("/").at(-1), method = config.method;
      calls.push({ privilege, table, method, url });
      if (method === "POST") {
        assert.equal(privilege, "admin");
        const row = JSON.parse(config.body);
        if (table === "immutable_audit_events") {
          if (options.auditFail) return error("XX000");
          if (audits.has(row.id)) return error("23505");
          audits.set(row.id, row);
          clock += options.auditDelay ?? 0;
        } else {
          assert.equal(table, "digital_observer_camera_action_requests");
          assert.ok(audits.has(row.id), "queue must not be written before its durable audit");
          if (queueFailures-- > 0) return error("XX000");
          if (queue.has(row.id)) return error("23505");
          queue.set(row.id, row);
        }
        return Response.json({ id: row.id });
      }
      assert.equal(method, "GET", "no updates, deletes or physical transport");
      if (table === "observer_sites") return Response.json(activeSite);
      if (table === "observer_site_memberships") {
        assert.equal(url.searchParams.get("active"), "eq.true");
        const accepted = url.searchParams.get("member_role")?.includes(options.membershipRole ?? "NO_ROLE");
        return Response.json(accepted ? { id: id(8), member_role: options.membershipRole } : null);
      }
      if (table === "digital_observer_camera_sources") {
        assert.equal(privilege, "session");
        assert.equal(url.searchParams.get("id"), `eq.${input.camera_source_id}`);
        assert.equal(url.searchParams.get("observer_site_id"), `eq.${input.observer_site_id}`);
        return Response.json(activeSource);
      }
      const key = url.searchParams.get("id")?.slice(3);
      if (table === "immutable_audit_events") return Response.json(audits.get(key) ?? null);
      assert.equal(table, "digital_observer_camera_action_requests");
      for (const [field, value] of [["observer_site_id", input.observer_site_id], ["camera_source_id", input.camera_source_id], ["requested_by", activeProfile.id]])
        assert.equal(url.searchParams.get(field), `eq.${value}`);
      return Response.json(queue.get(key) ?? null);
    }
  } });
  const sessionDb = client("session"), elevated = client("admin");
  const dependencies = { sessionDb, profile: activeProfile, origin: "dashboard", now: () => clock,
    admin() { adminCreations++; return elevated; } };
  const { GuardDiagnosticsService } = loadTs("lib/domain/digital-observer/guard-diagnostics-service.ts");
  const service = new GuardDiagnosticsService(dependencies);
  const engine = new (loadTs("lib/domain/digital-observer/guard-engine.ts").DigitalGuardEngine)(service);
  engine.registerCamera({ cameraId: input.camera_source_id, capabilities: { lighting: true } });
  const route = loadTs("app/api/digital-observer/camera-diagnostics/route.ts", {
    "@/lib/domain/digital-observer/access": { ...access, async getDigitalObserverApiUser() {
      return options.signedIn === false ? null : { user: { id: profile.id }, profile: activeProfile, supabase: sessionDb };
    } }, "@/lib/supabase/admin": { createAdminClient: dependencies.admin }
  });
  return { service, engine, audits, queue, calls, source: activeSource, advance: milliseconds => { clock += milliseconds; }, adminCreations: () => adminCreations,
    async http(method = "POST", value = input) {
      const scope = { observer_site_id: value.observer_site_id, camera_source_id: value.camera_source_id, request_id: value.request_id };
      const request = new Request(`https://fixture.invalid/api/digital-observer/camera-diagnostics${method === "GET" ? "?" + new URLSearchParams(scope) : ""}`,
        { method, ...(method === "POST" ? { headers: { "content-type": "application/json" }, body: JSON.stringify(value) } : {}) });
      const response = await route[method](request);
      return { status: response.status, body: await response.json() };
    } };
}

test("Guard engine enqueues a snapshot after permissions and immutable audit", async () => {
  const f = fixture();
  const result = await f.engine.requestCameraDiagnostics(input);
  assert.equal(result.state, "queued");
  assert.equal(result.executed, false);
  assert.equal(result.executor_installed, false);
  assert.equal(f.audits.size, 1);
  assert.equal(f.queue.size, 1);
  const row = f.queue.get(input.request_id);
  assert.equal(row.gateway_id, source.gateway_id);
  assert.equal(row.stream_id, source.stream_id);
  assert.equal(row.channel, source.channel);
  assert.equal(row.payload_digest, null);
  assert.deepEqual(row.parameters, {});
  assert.equal(row.confirmed_by, undefined);
  assert.equal(f.engine.recommendLineCrossingAction(source.id).allowed, false);
});

test("preflight persists only digests, never speech, command parameters or physical approval", async () => {
  const f = fixture();
  await f.service.request(preflight);
  const row = f.queue.get(input.request_id);
  assert.match(row.payload_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(row.parameters, {});
  assert.ok(!JSON.stringify([...f.queue.values(), ...f.audits.values()]).includes("PRIVATE_SYNTHETIC_WARNING"));
  assert.equal(f.audits.get(input.request_id).metadata.physical_confirmation, false);
});

test("same-request retries do not enqueue twice or extend expiration", async () => {
  const f = fixture();
  const first = await f.service.request(input);
  f.advance(10_000);
  const second = await f.service.request(input);
  assert.equal(second.expires_at, first.expires_at);
  assert.equal(f.queue.size, 1);
  assert.equal(f.audits.size, 1);
});

test("a failed queue write can recover behind the same audited intent", async () => {
  const f = fixture({ queueFailures: 1 });
  await assert.rejects(f.service.request(input), /STORAGE_UNAVAILABLE/);
  assert.equal(f.queue.size, 0);
  const expiry = f.audits.get(input.request_id).metadata.expires_at;
  f.advance(1000);
  assert.equal((await f.service.request(input)).expires_at, expiry);
  assert.equal(f.queue.size, 1);
});

test("failed or slow audit blocks enqueue and cannot renew an expired intent", async () => {
  for (const options of [{ auditFail: true }, { auditDelay: 121_000 }]) {
    const f = fixture(options);
    await assert.rejects(f.service.request(input));
    assert.equal(f.queue.size, 0);
  }
});

test("a reused request ID with a different payload or source binding is rejected", async () => {
  const f = fixture();
  await f.service.request(preflight);
  await assert.rejects(f.service.request({ ...preflight, payload: { text: "different" } }), /REQUEST_CONFLICT/);
  f.source.channel = 2;
  await assert.rejects(f.service.request(preflight), /REQUEST_CONFLICT/);
  assert.equal(f.queue.size, 1);
});

test("child sites, unknown privacy policy, inactive and viewer users never create an elevated client", async () => {
  for (const options of [{ site: { site_type: "kindergarten" } }, { site: { garden_id: id(9) } },
    { site: { business_handles_children: true } }, { site: { vision_privacy_mode: "skeleton_only" } },
    { site: { vision_privacy_mode: null } }, { profile: { active: false } },
    { site: { owner_profile_id: id(99) }, membershipRole: "viewer" }]) {
    const f = fixture(options);
    await assert.rejects(f.service.request(input), /FORBIDDEN/);
    assert.equal(f.adminCreations(), 0);
    assert.equal(f.queue.size, 0);
  }
});

test("foreign, demo, missing or malformed source bindings fail before writes", async () => {
  for (const change of [{ observer_site_id: id(99) }, { connector_type: "demo" }, { gateway_id: null }, { stream_id: "https://secret.invalid" }, { channel: "1" }]) {
    const f = fixture({ source: change });
    await assert.rejects(f.service.request(input));
    assert.equal(f.adminCreations(), 0);
    assert.equal(f.audits.size, 0);
  }
});

test("clients cannot set approval, origin, TTL, digest or arbitrary command fields", async () => {
  for (const change of [{ confirmed: true }, { request_origin: "observer_chat" }, { expires_at: "2099-01-01T00:00:00Z" },
    { payload_digest: "a".repeat(64) }, { task_kind: "legacy_command" }]) {
    const f = fixture();
    await assert.rejects(f.service.request({ ...input, ...change }));
    assert.deepEqual(f.calls, []);
  }
  await assert.rejects(fixture().service.request({ ...preflight, action: "ptz", payload: { direction: "left", duration_ms: 60_000 } }));
});

test("status requires the matching audit and does not fabricate physical success", async () => {
  const f = fixture();
  await f.service.request(input);
  const view = await f.engine.cameraDiagnosticStatus({ observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id });
  assert.equal(view.state, "queued");
  assert.equal(view.executed, false);
  const row = f.queue.get(input.request_id), expiry = row.expires_at;
  row.expires_at = new Date(Date.parse(expiry) + 1_000).toISOString();
  await assert.rejects(f.service.status({ observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id }), /EVIDENCE_INVALID/);
  row.expires_at = expiry;
  f.audits.clear();
  await assert.rejects(f.service.status({ observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id }), /EVIDENCE_INVALID/);
});

test("stored preflight result is validated by digest, binding and current lifetime", async () => {
  const f = fixture();
  await f.service.request(preflight);
  const row = f.queue.get(input.request_id);
  const scope = { observer_site_id: input.observer_site_id, camera_source_id: input.camera_source_id, request_id: input.request_id };
  const result = { action: "result", request_id: input.request_id, outcome: "command_preflight", result_code: "unavailable",
    outcome_payload: { camera_id: source.id, site_id: site.id, stream_id: source.stream_id, channel: source.channel,
      action: "talk", supported: false, ack_kind: "preflight_only", executor_installed: false, executed: false,
      requires_immediate_confirmation: true, evidence_id: id(7), verified_at: null } };
  const { queueResultDigest } = loadTs("lib/domain/digital-observer/camera-queue-contract.ts");
  Object.assign(row, { action_status: "completed", result: { ...result, reported_by_gateway: true }, result_digest: queueResultDigest(result) });
  const view = await f.service.status(scope);
  assert.equal(view.state, "completed");
  assert.equal(view.supported, false);
  assert.equal(view.executed, false);
  assert.equal(view.verified_at, null);
  const foreignResult = { ...result, request_id: id(99) };
  row.result = { ...foreignResult, reported_by_gateway: true };
  row.result_digest = queueResultDigest(foreignResult);
  await assert.rejects(f.service.status(scope), /EVIDENCE_INVALID/);
  row.result = { ...result, reported_by_gateway: true };
  row.result_digest = "0".repeat(64);
  await assert.rejects(f.service.status(scope), /EVIDENCE_INVALID/);
  f.advance(120_000);
  assert.equal((await f.service.status(scope)).state, "expired");
});

test("HTTP authentication and strict schema run before any audit or queue write", async () => {
  const anonymous = fixture({ signedIn: false });
  assert.equal((await anonymous.http()).status, 401);
  assert.deepEqual(anonymous.calls, []);
  const invalid = fixture();
  assert.equal((await invalid.http("POST", { ...input, confirmed: true })).status, 422);
  assert.deepEqual(invalid.calls, []);
});

test("HTTP uses Guard engine for enqueue and returns a scoped read-only status", async () => {
  const f = fixture();
  const queued = await f.http();
  assert.equal(queued.status, 202);
  assert.equal(queued.body.data.diagnostic.executed, false);
  const status = await f.http("GET");
  assert.equal(status.status, 200);
  assert.equal(status.body.data.diagnostic.state, "queued");
  assert.equal(f.queue.size, 1);
});

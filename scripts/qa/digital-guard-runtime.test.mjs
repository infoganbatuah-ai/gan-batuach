import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const core = loadTs("lib/domain/digital-observer/guard-engine.ts");
const policy = loadTs("lib/domain/digital-observer/camera-command-policy.ts");
const cameraId = "00000000-0000-4000-8000-000000000001";
const requestId = "00000000-0000-4000-8000-000000000002";
const time = Date.now();
const at = new Date(time).toISOString();
const request = { camera_source_id: cameraId, request_id: requestId, requested_at: at, confirmed: true, action: "lighting", payload: { enabled: true } };
const camera = { id: cameraId, status: "connected", health_status: "healthy" };
const probe = { manifest: { cameraId, cameraZoneName: "שער", discoveredAt: at, source: "gateway", capabilities: { ptz: true, twoWayAudio: true, siren: true, lighting: true } }, evidenceId: "test-evidence", gatewayProvider: "simulated", verifiedAt: at };

function dependencies(overrides = {}) {
  const calls = [];
  const claimed = new Set();
  return { calls, now: () => time, probe: async () => { calls.push("probe"); return probe; },
    claim: async (command) => { calls.push("claim"); if (claimed.has(command.requestId)) throw Error("COMMAND_ALREADY_CLAIMED"); claimed.add(command.requestId); },
    adapter: { execute: async () => { calls.push("execute"); return { acknowledged: true, commandId: "simulated-command", state: "acknowledged" }; } },
    recordOutcome: async () => { calls.push("outcome"); }, ...overrides };
}

test("stored gateway flags never authorize hardware or expose raw metadata", () => {
  const manifest = core.discoverCameraCapabilities({ cameraId, capabilities: { lighting: true }, metadata: { capability_manifest_verified: true, capability_probe_id: "forged", gateway_capability_evidence: true, password: "not-for-client" } });
  assert.equal(manifest.source, "metadata");
  assert.equal(manifest.raw, undefined);
  assert.throws(() => core.assertGuardActionAllowed(manifest, "lighting", true), /CAPABILITY_EVIDENCE_REQUIRED/);
});

for (const action of ["ptz", "talk", "siren", "lighting"]) test(`${action} requires immediate human confirmation`, () => {
  assert.throws(() => core.assertGuardActionAllowed(probe.manifest, action), /HUMAN_CONFIRMATION_REQUIRED/);
});

test("strict action payloads reject implicit, unbounded and extra commands", () => {
  for (const invalid of [{ ...request, confirmed: false }, { ...request, payload: {} }, { ...request, payload: { enabled: "false" } }, { ...request, action: "ptz", payload: { direction: "left", duration_ms: 10_000 } }, { ...request, action: "talk", payload: { text: " " } }, { ...request, payload: { enabled: true, url: "https://example.invalid" } }]) {
    assert.equal(policy.cameraActionSchema.safeParse(invalid).success, false);
  }
});

test("clients cannot grant themselves automated camera permissions", () => {
  assert.equal(policy.cameraActionSchema.safeParse({ ...request, actor: "digital_guard", automation_policy: { enabled: true, allowed_actions: ["lighting", "siren"] } }).success, false);
});

test("offline or contradictory health rejects before probing/sending", async () => {
  const deps = dependencies();
  await assert.rejects(policy.executeCameraAction(request, { ...camera, health_status: "offline" }, deps), /CAMERA_OFFLINE/);
  assert.deepEqual(deps.calls, []);
  for (const status of ["blocked", "disabled", "draft", "degraded", "pending"]) {
    await assert.rejects(policy.executeCameraAction(request, { ...camera, status }, deps), /CAMERA_OFFLINE/);
  }
  await assert.rejects(policy.executeCameraAction(request, { ...camera, health_status: "unknown" }, deps), /CAMERA_OFFLINE/);
  assert.deepEqual(deps.calls, []);
});

test("a slow audit cannot dispatch with a now-stale capability proof", async () => {
  let clock = time;
  const older = new Date(time - 29_000).toISOString();
  const deps = dependencies({ now: () => clock, probe: async () => ({ ...probe, verifiedAt: older, manifest: { ...probe.manifest, discoveredAt: older } }), claim: async () => { clock += 3_000; } });
  await assert.rejects(policy.executeCameraAction(request, camera, deps), /INVALID_CAPABILITY_EVIDENCE/);
  assert.deepEqual(deps.calls, []);
});

test("expired/future approvals reject before any I/O", async () => {
  for (const offset of [-31_000, 5_000]) {
    const deps = dependencies();
    await assert.rejects(policy.executeCameraAction({ ...request, requested_at: new Date(time + offset).toISOString() }, camera, deps), /COMMAND_EXPIRED/);
    assert.deepEqual(deps.calls, []);
  }
});

test("wrong camera, stale or incomplete probe fails closed", async () => {
  for (const invalid of [{ ...probe, evidenceId: "" }, { ...probe, verifiedAt: new Date(time - 31_000).toISOString() }, { ...probe, manifest: { ...probe.manifest, cameraId: requestId } }]) {
    const deps = dependencies({ probe: async () => invalid });
    await assert.rejects(policy.executeCameraAction(request, camera, deps), /INVALID_CAPABILITY_EVIDENCE/);
    assert.deepEqual(deps.calls, []);
  }
});

test("failed durable audit prevents command dispatch", async () => {
  const deps = dependencies({ claim: async () => { throw Error("COMMAND_AUDIT_UNAVAILABLE"); } });
  await assert.rejects(policy.executeCameraAction(request, camera, deps), /COMMAND_AUDIT_UNAVAILABLE/);
  assert.deepEqual(deps.calls, ["probe"]);
});

test("ACK is not execution; audit precedes dispatch", async () => {
  const deps = dependencies();
  const result = await policy.executeCameraAction(request, camera, deps);
  assert.equal(result.executed, null);
  assert.equal(result.state, "acknowledged");
  assert.deepEqual(deps.calls, ["probe", "claim", "execute", "outcome"]);
});

test("concurrent duplicate requests dispatch at most once", async () => {
  const deps = dependencies();
  const outcomes = await Promise.allSettled([policy.executeCameraAction(request, camera, deps), policy.executeCameraAction(request, camera, deps)]);
  assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(deps.calls.filter((x) => x === "execute").length, 1);
});

test("timeout is unknown, is audited, and is never automatically retried", async () => {
  let executions = 0;
  const deps = dependencies({ adapter: { execute: async () => { executions++; throw Error("timeout"); } } });
  const result = await policy.executeCameraAction(request, camera, deps);
  assert.equal(result.state, "outcome_unknown");
  assert.equal(result.executed, null);
  assert.equal(executions, 1);
  assert.ok(deps.calls.includes("outcome"));
});

test("post-send audit failure must not hide known physical execution", async () => {
  const deps = dependencies({ adapter: { execute: async () => ({ acknowledged: true, commandId: "simulated", state: "executed" }) }, recordOutcome: async () => { throw Error("db unavailable"); } });
  const result = await policy.executeCameraAction(request, camera, deps);
  assert.equal(result.executed, true);
  assert.equal(result.audit_recorded, false);
});

function gateway(payload, url = "https://gateway.example.invalid") {
  const requests = [];
  const adapter = loadTs("lib/domain/digital-observer/camera-gateway-adapter.ts", {
    process: { env: { DIGITAL_OBSERVER_COMMAND_GATEWAY_URL: url, DIGITAL_OBSERVER_COMMAND_GATEWAY_SECRET: "test-only" } },
    fetch: async (address, options) => { requests.push({ address, options }); return { ok: true, json: async () => payload }; }
  });
  return { ...adapter, requests };
}
const wireProbe = () => ({ evidence_id: "test", verified_at: new Date().toISOString(), gateway_provider: "simulated", manifest: { ...probe.manifest, discoveredAt: new Date().toISOString() } });

test("probe rejects string booleans, missing timestamps and wrong camera IDs", async () => {
  const stringBool = wireProbe(); stringBool.manifest.capabilities = { ...probe.manifest.capabilities, lighting: "false" };
  const noTime = wireProbe(); delete noTime.verified_at;
  const wrongCamera = wireProbe(); wrongCamera.manifest.cameraId = requestId;
  for (const value of [stringBool, noTime, wrongCamera]) await assert.rejects(gateway(value).probeCameraCapabilities(cameraId), /INVALID_CAPABILITY_EVIDENCE/);
});

test("probe strips arbitrary provider metadata and forbids secret-bearing redirects", async () => {
  const value = wireProbe(); value.manifest.raw = { secret: "private" };
  const fixture = gateway(value);
  assert.equal((await fixture.probeCameraCapabilities(cameraId)).manifest.raw, undefined);
  assert.equal(fixture.requests[0].options.redirect, "error");
  await assert.rejects(gateway(value, "http://gateway.example.invalid").probeCameraCapabilities(cameraId), /INSECURE_URL/);
});

test("gateway ACK must correlate camera and request and explicitly report state", async () => {
  const command = { cameraId, action: "lighting", payload: { enabled: true }, requestId, expiresAt: new Date(Date.now() + 20_000).toISOString() };
  for (const result of [{ acknowledged: true, command_id: "ack" }, { acknowledged: true, command_id: "ack", request_id: requestId, camera_id: requestId, state: "executed" }]) {
    const fixture = gateway(result);
    await assert.rejects(new fixture.HttpCameraCommandAdapter().execute(command), /ACK_MISSING/);
  }
  const fixture = gateway({ acknowledged: true, command_id: "ack", request_id: requestId, camera_id: cameraId, state: "acknowledged" });
  assert.equal((await new fixture.HttpCameraCommandAdapter().execute(command)).state, "acknowledged");
  assert.equal(JSON.parse(fixture.requests[0].options.body).request_id, requestId);
});

// Exercise the actual HTTP handler and policy; replace only authentication,
// persistence and gateway boundaries. These tests can never send hardware I/O.
function cameraActionRoute({ authenticated = true, canManage = true, demo = false } = {}) {
  const calls = [];
  const source = { ...camera, observer_site_id: "site-a", connector_type: demo ? "demo" : "gateway", display_name: "שער", capabilities: {} };
  const database = { from(table) {
    calls.push(`read:${table}`);
    assert.equal(table, "digital_observer_camera_sources");
    const query = { select() { return query; }, eq(key, value) { assert.equal(key, "id"); assert.equal(value, cameraId); return query; },
      async maybeSingle() { return { data: source, error: null }; } };
    return query;
  } };
  const route = loadTs("app/api/digital-observer/camera-actions/route.ts", {
    process: { env: { DIGITAL_OBSERVER_GUARD_INTERNAL_SECRET: "fixture-internal-secret" } },
    "@/lib/domain/digital-observer/access": {
      async getDigitalObserverApiUser() { calls.push("session"); return authenticated ? { supabase: database, profile: { id: "user-a", role: "observer" } } : null; },
      async getObserverSiteAccess(db, profile, siteId, options) {
        calls.push("site-access"); assert.equal(db, database); assert.equal(profile.id, "user-a");
        assert.equal(siteId, "site-a"); assert.equal(options.manage, true);
        return canManage ? { id: siteId } : null;
      }
    },
    "@/lib/supabase/admin": { createAdminClient() { calls.push("admin"); throw Error("Unexpected privileged database access"); } },
    "@/lib/domain/digital-observer/camera-gateway-adapter": {
      cameraCommandAdapter() { calls.push("adapter"); return null; },
      async probeCameraCapabilities() { throw Error("Unexpected hardware probe"); },
      mockCameraCapabilityProbe() { throw Error("Unexpected mock proof of hardware"); },
      MockCameraCommandAdapter: class { constructor() { throw Error("Unexpected mock execution"); } }
    }
  });
  return { calls, async post(body = request, headers = {}) {
    const response = await route.POST(new Request("http://localhost/api/digital-observer/camera-actions", {
      method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body)
    }));
    return { status: response.status, body: await response.json() };
  } };
}

test("camera HTTP route rejects a self-authorized internal guard before privileged access", async () => {
  const route = cameraActionRoute({ authenticated: false });
  const result = await route.post({ ...request, actor: "digital_guard", automation_policy: { enabled: true, allowed_actions: ["lighting"] } }, { "x-digital-guard-secret": "fixture-internal-secret" });
  assert.equal(result.status, 422);
  assert.deepEqual(route.calls, []);
});

test("an internal header is not a replacement for a signed-in user", async () => {
  const route = cameraActionRoute({ authenticated: false });
  assert.equal((await route.post(request, { "x-digital-guard-secret": "fixture-internal-secret" })).status, 401);
  assert.deepEqual(route.calls, ["session"]);
});

test("camera HTTP route requires management access to the camera's exact site", async () => {
  const route = cameraActionRoute({ canManage: false });
  assert.equal((await route.post()).status, 403);
  assert.deepEqual(route.calls, ["session", "read:digital_observer_camera_sources", "site-access"]);
});

test("an authorized real camera without a gateway fails before audit or dispatch", async () => {
  const route = cameraActionRoute();
  assert.equal((await route.post()).status, 503);
  assert.deepEqual(route.calls, ["session", "read:digital_observer_camera_sources", "site-access", "adapter"]);
});

test("demo response never claims physical execution or durable audit", async () => {
  const route = cameraActionRoute({ demo: true });
  const result = await route.post();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.state, "simulated");
  assert.equal(result.body.data.simulated, true);
  assert.equal(result.body.data.executed, null);
  assert.equal(result.body.data.audit_recorded, false);
  assert.equal(result.body.data.command_id, null);
  assert.equal((await route.post()).status, 409);
  assert.ok(!route.calls.includes("adapter") && !route.calls.includes("admin"));
});

test("demo camera cannot bypass site management access", async () => {
  const route = cameraActionRoute({ demo: true, canManage: false });
  assert.equal((await route.post()).status, 403);
  assert.ok(!route.calls.includes("adapter") && !route.calls.includes("admin"));
});

test("guard worker recommends an action without manufacturing confirmation or making network calls", async () => {
  const worker = loadTs("lib/domain/digital-observer/guard-command-client.ts", {
    process: { env: { DIGITAL_OBSERVER_GUARD_INTERNAL_SECRET: "fixture-only", NEXT_PUBLIC_APP_URL: "https://fixture.invalid" } }
  });
  for (const action of ["ptz", "lighting", "siren", "talk"]) {
    const result = await worker.requestDigitalGuardCameraAction({ cameraSourceId: cameraId, action, payload: {}, allowedActions: [action] });
    assert.equal(result.state, "pending_human_confirmation");
    assert.equal(result.executed, undefined);
  }
});

const learning = loadTs("lib/domain/digital-observer/learning-engine.ts");
const sampler = loadTs("lib/domain/digital-observer/home-learning-sampler.ts", { "@/lib/domain/video-gateway-client": {} });
const observation = { cameraId, zoneName: "שער", observedAt: at, motionLevel: 0.1, lightLevel: 0.5 };
const history = Array.from({ length: 24 }, (_, index) => ({ ...observation, observedAt: new Date(time - (24 - index) * 1_000).toISOString() }));

test("baseline rejects mixed cameras, invalid timestamps and invalid scores", () => {
  assert.throws(() => learning.learnBehaviorBaseline([observation, { ...observation, cameraId: requestId }]), /SCOPE_MISMATCH/);
  for (const value of [{ ...observation, observedAt: "invalid" }, { ...observation, motionLevel: NaN }, { ...observation, peopleCount: -1 }]) {
    assert.throws(() => learning.learnBehaviorBaseline([value]));
  }
});

test("missing people/vehicle data never implies zero detected people/vehicles", () => {
  const baseline = learning.learnBehaviorBaseline(history);
  assert.equal(baseline.averagePeople, null);
  assert.equal(baseline.metricSamples.people, 0);
  assert.equal(learning.detectBehaviorAnomaly({ ...observation, peopleCount: 10 }, baseline).isAnomaly, false);
});

test("same or older sample is not counted twice", () => {
  const baseline = learning.learnBehaviorBaseline([observation, observation]);
  assert.equal(baseline.samples, 1);
  assert.equal(learning.updateBehaviorBaseline(baseline, history[0]).samples, 1);
});

test("learning hours use explicit timezone, including winter/summer", () => {
  assert.equal(learning.observationHour("2026-08-31T00:00:00.000Z", "Asia/Jerusalem"), 3);
  assert.equal(learning.observationHour("2026-01-01T00:00:00.000Z", "Asia/Jerusalem"), 2);
  assert.equal(learning.observationHour("2026-08-31T00:00:00.000Z", "UTC"), 0);
});

test("cold start or idle restricted hour does not create an anomaly", () => {
  const baseline = learning.learnBehaviorBaseline(history.slice(0, 3));
  assert.equal(learning.detectBehaviorAnomaly({ ...observation, motionLevel: 1 }, baseline).isAnomaly, false);
  assert.equal(learning.detectBehaviorAnomaly({ ...observation, motionLevel: 0, active: false }, baseline, [learning.observationHour(at, "UTC")]).isAnomaly, false);
});

test("mature motion/light deviation creates review reasons against prior baseline", () => {
  const baseline = learning.learnBehaviorBaseline(history);
  const result = learning.detectBehaviorAnomaly({ ...observation, motionLevel: 0.9, lightLevel: 1 }, baseline);
  assert.equal(result.isAnomaly, true);
  assert.equal(result.reasons.length, 2);
  assert.equal(learning.detectBehaviorAnomaly(observation, baseline).reason, "");
});

// Database boundary double: actual sampler, real filtering, unique IDs and compare-and-swap.
function learningDb() {
  const tables = {
    observer_sites: [{ id: "site-a", monitoring_enabled: true, timezone: "UTC", metadata: { observer_monitoring_consent: true } }],
    digital_observer_camera_sources: [
      { id: cameraId, observer_site_id: "site-a", display_name: "שער", status: "connected", metadata: { gateway_stream_id: "stream-a" } },
      { id: requestId, observer_site_id: "site-a", display_name: "בריכה", status: "connected", metadata: { gateway_stream_id: "stream-b" } }
    ], site_behavior_baselines: [], observer_intelligence_signals: [], observer_site_learning_profiles: []
  };
  const db = { tables, writes: [], failJournal: false, failProfile: false, failSiteProjection: false, conflictOnce: false,
    from(table) {
      let action = "read", payload, single = false;
      const filters = [];
      const query = {
        select() { return query; }, eq(key, value) { filters.push((row) => row[key] === value); return query; },
        in(key, values) { filters.push((row) => values.includes(row[key])); return query; }, limit() { return query; },
        single() { single = true; return query; }, maybeSingle() { single = true; return query; },
        insert(value) { action = "insert"; payload = value; return query; },
        update(value) { action = "update"; payload = value; return query; },
        upsert(value) { action = "upsert"; payload = value; return query; },
        then(resolvePromise, rejectPromise) {
          return Promise.resolve().then(() => {
            const rows = tables[table];
            if (!rows) throw Error(`Unexpected table ${table}`);
            let matches = rows.filter((row) => filters.every((filter) => filter(row)));
            if (action !== "read") {
              db.writes.push(table);
              if (table === "observer_intelligence_signals" && db.failJournal) return { data: null, error: { message: "journal unavailable" } };
              if (table === "observer_site_learning_profiles" && db.failProfile) return { data: null, error: { message: "profile unavailable" } };
              if (table === "observer_sites" && db.failSiteProjection) return { data: null, error: { message: "site projection unavailable" } };
              if (table === "site_behavior_baselines" && db.conflictOnce) {
                db.conflictOnce = false;
                return { data: null, error: action === "insert" ? { code: "23505" } : null };
              }
              if (action === "insert") {
                if (payload.id && rows.some((row) => row.id === payload.id)) return { data: null, error: { code: "23505" } };
                const row = structuredClone({ id: `row-${rows.length + 1}`, ...payload }); rows.push(row); matches = [row];
              } else if (action === "update") { matches.forEach((row) => Object.assign(row, structuredClone(payload))); }
              else { matches = [structuredClone(payload)]; rows.push(...matches); }
            }
            return { data: structuredClone(single ? matches[0] ?? null : matches), error: null };
          }).then(resolvePromise, rejectPromise);
        }
      };
      return query;
    }
  };
  return db;
}
const sample = (offset = 0, motion = 0.1, stream = "stream-a") => ({ stream_id: stream, motion_score: motion, luminance_score: 0.5, sampled_at: new Date(time + offset).toISOString() });

test("sampler refuses missing consent and foreign camera streams before any write", async () => {
  const db = learningDb();
  await assert.rejects(sampler.recordHomeActivityMetrics(db, "site-a", [sample(0, 0.1, "foreign-stream")]), /OUTSIDE_SITE/);
  assert.equal(db.writes.length, 0);
  db.tables.observer_sites[0].metadata.observer_monitoring_consent = false;
  await assert.rejects(sampler.recordHomeActivityMetrics(db, "site-a", [sample()]), /consent/);
  assert.equal(db.writes.length, 0);
});

test("persisted learning isolates camera means and ignores repeated sample timestamps", async () => {
  const db = learningDb();
  const first = await sampler.recordHomeActivityMetrics(db, "site-a", [sample(0, 0.1), sample(0, 0.9, "stream-b")]);
  assert.equal(first.sampled, 2);
  const baselines = db.tables.site_behavior_baselines[0].baseline_value.camera_baselines;
  assert.equal(baselines[cameraId].averageMotionLevel, 0.1);
  assert.equal(baselines[requestId].averageMotionLevel, 0.9);
  const repeated = await sampler.recordHomeActivityMetrics(db, "site-a", [sample()]);
  assert.equal(repeated.sampled, 0);
  assert.equal(repeated.sample_count, 1);
});

test("persisted anomaly reaches journal with precise camera and review-only metadata", async () => {
  const db = learningDb();
  await sampler.recordHomeActivityMetrics(db, "site-a", history.map((value) => ({ stream_id: "stream-a", motion_score: value.motionLevel, luminance_score: value.lightLevel, sampled_at: value.observedAt })));
  await sampler.recordHomeActivityMetrics(db, "site-a", [sample(0, 0.95)]);
  const events = db.tables.observer_intelligence_signals.filter((event) => event.metadata.event_type === "home_activity_change");
  assert.equal(events.length, 1);
  assert.equal(events[0].observer_site_id, "site-a");
  assert.equal(events[0].metadata.camera_source_id, cameraId);
  assert.equal(events[0].metadata.camera_zone_name, "שער");
  assert.equal(events[0].human_review_required, true);
  assert.equal(events[0].metadata.no_automatic_physical_action, true);
});

test("journal failure leaves durable pending event; replay delivers without recounting", async () => {
  const db = learningDb(); db.failJournal = true;
  await assert.rejects(sampler.recordHomeActivityMetrics(db, "site-a", [sample()]), /journal unavailable/);
  assert.equal(db.tables.site_behavior_baselines[0].baseline_value.pending_learning_events.length, 1);
  db.failJournal = false;
  const recovered = await sampler.recordHomeActivityMetrics(db, "site-a", [sample()]);
  assert.equal(recovered.sampled, 0);
  assert.equal(db.tables.observer_intelligence_signals.length, 1);
  await sampler.recordHomeActivityMetrics(db, "site-a", [sample()]);
  assert.equal(db.tables.observer_intelligence_signals.length, 1);
});

test("compare-and-swap conflict retries safely without losing or doubling samples", async () => {
  const db = learningDb(); db.conflictOnce = true;
  const result = await sampler.recordHomeActivityMetrics(db, "site-a", [sample()]);
  assert.equal(result.sampled, 1);
  assert.equal(db.tables.site_behavior_baselines.length, 1);
  assert.equal(db.tables.site_behavior_baselines[0].baseline_value.camera_baselines[cameraId].samples, 1);
});

for (const failure of ["failProfile", "failSiteProjection"]) test(`replay repairs ${failure} without counting samples or journal events again`, async () => {
  const db = learningDb(); db[failure] = true;
  await assert.rejects(sampler.recordHomeActivityMetrics(db, "site-a", [sample()]), /unavailable/);
  db[failure] = false;
  const result = await sampler.recordHomeActivityMetrics(db, "site-a", [sample()]);
  assert.equal(result.sampled, 0);
  assert.equal(db.tables.site_behavior_baselines[0].baseline_value.camera_baselines[cameraId].samples, 1);
  assert.equal(db.tables.observer_intelligence_signals.length, 1);
  assert.equal(db.tables.observer_site_learning_profiles.at(-1)?.learning_status, "collecting_baseline");
  assert.equal(db.tables.observer_sites[0].observer_runtime_status, "learning_readiness");
});

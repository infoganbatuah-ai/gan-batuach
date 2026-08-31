import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { PGlite } = await import(process.env.CAMERA_QUEUE_PGLITE_MODULE || "@electric-sql/pglite");
const { pgcrypto } = await import(process.env.CAMERA_QUEUE_PGLITE_MODULE
  ? new URL("./contrib/pgcrypto.js", pathToFileURL(process.env.CAMERA_QUEUE_PGLITE_MODULE)).href
  : "@electric-sql/pglite/contrib/pgcrypto");
const migration = readFileSync(new URL("../../supabase/migrations/20260831090000_camera_action_queue_contract.sql", import.meta.url), "utf8");
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const request = { observer_site_id: id(1), camera_source_id: id(2), request_id: id(3), task_kind: "command_preflight", action: "lighting", payload: { enabled: true } };
const profile = { id: id(4), active: true, role: "owner" };
const ident = key => { assert.match(key, /^[a-z_][a-z0-9_]*$/); return `"${key}"`; };

async function fixture() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create extension if not exists pgcrypto;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table profiles(id uuid primary key); create table gardens(id uuid primary key);
    create table children(id uuid primary key);
    create table observer_sites(id uuid primary key,name text,site_type text,owner_profile_id uuid,garden_id uuid,timezone text,
      monitoring_enabled boolean,business_handles_children boolean,vision_privacy_mode text,camera_limit integer,
      monitoring_hours jsonb,event_retention_days integer,ai_features jsonb,metadata jsonb);
    create table observer_site_memberships(id uuid,observer_site_id uuid,profile_id uuid,active boolean,member_role text);
    create table digital_observer_camera_sources(id uuid primary key,observer_site_id uuid,connector_type text,display_name text,location_label text,metadata jsonb);
    create table video_gateway_device_enrollments(id uuid,gateway_id text,observer_site_id uuid,status text);
    create function public.can_manage_observer_site(site uuid) returns boolean language sql stable as $$select false$$;
  `);
  // Real audit table and hash/append-only triggers. The external WORM/export
  // destination remains outside this isolated database test.
  const auditSql = readFileSync(new URL("../../supabase/migrations/20260612015400_immutable_audit_trail_evidence_logs_worm_readiness.sql", import.meta.url), "utf8");
  await db.exec(auditSql.slice(auditSql.indexOf("create table if not exists public.immutable_audit_events"), auditSql.indexOf("create table if not exists public.audit_coverage_readiness")));
  await db.exec(auditSql.slice(auditSql.indexOf("create or replace function public.block_immutable_audit_mutation"), auditSql.indexOf("drop trigger if exists medical_access_logs_block_update")));
  await db.exec(migration);
  await db.query("insert into profiles values($1)", [profile.id]);
  await db.query("insert into observer_sites(id,site_type,owner_profile_id,vision_privacy_mode,business_handles_children) values($1,'home',$2,'standard_consent',false)", [id(1), profile.id]);
  await db.query("insert into digital_observer_camera_sources values($1,$2,'gateway','synthetic','synthetic',$3)", [id(2), id(1), { gateway_id: "synthetic-gateway", gateway_stream_id: "synthetic-stream", dvr_channel: 1 }]);
  await db.query("insert into video_gateway_device_enrollments values($1,'synthetic-gateway',$2,'delivered')", [id(5), id(1)]);
  const calls = [];
  const client = createClient("https://fixture.invalid", "synthetic-key", { auth: { persistSession: false, autoRefreshToken: false }, global: {
    async fetch(resource, options) {
      const url = new URL(resource), table = url.pathname.split("/").at(-1);
      calls.push({ table, method: options.method });
      const values = [], conditions = [];
      const parameter = value => { values.push(value); return `$${values.length}`; };
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "limit"].includes(key)) continue;
        const field = `q.${ident(key)}`, dot = value.indexOf("."), op = value.slice(0, dot), rhs = value.slice(dot + 1);
        if (op === "in") conditions.push(`${field} in (${rhs.slice(1, -1).split(",").map(parameter).join(",")})`);
        else {
          assert.ok(["eq", "gt", "lte"].includes(op));
          conditions.push(`${field} ${{ eq: "=", gt: ">", lte: "<=" }[op]} ${parameter(rhs)}`);
        }
      }
      const requested = url.searchParams.get("select") ?? "*";
      const joined = requested.includes(",source:");
      const select = requested.split(",source:")[0].split(",").map(key => {
        if (key === "*") return "q.*";
        if (key.includes(":")) {
          const [alias, expression] = key.split(":");
          const matched = /^(metadata)(->>?)([a-z_]+)$/.exec(expression);
          assert.ok(matched);
          return `q.metadata${matched[2]}'${matched[3]}' as ${ident(alias)}`;
        }
        return `q.${ident(key)}`;
      }).join(",") + (joined ? ",to_jsonb(s) as source" : "");
      const where = conditions.length ? " where " + conditions.join(" and ") : "";
      let sql;
      if (options.method === "POST") {
        const row = JSON.parse(options.body), keys = Object.keys(row);
        sql = `insert into ${ident(table)} as q (${keys.map(ident).join(",")}) values (${keys.map(key => parameter(row[key])).join(",")}) returning ${select}`;
      } else if (options.method === "PATCH") {
        sql = `update ${ident(table)} q set ${Object.entries(JSON.parse(options.body)).map(([key, value]) => `${ident(key)}=${parameter(value)}`).join(",")}${where} returning ${select}`;
      } else {
        assert.equal(options.method, "GET");
        sql = `select ${select} from ${ident(table)} q${joined ? " join digital_observer_camera_sources s on s.id=q.camera_source_id" : ""}${where}`;
        if (url.searchParams.has("order")) sql += " order by " + url.searchParams.get("order").split(",").map(item => `q.${ident(item.split(".")[0])} ${item.includes(".desc") ? "desc" : "asc"}`).join(",");
        if (url.searchParams.has("limit")) sql += ` limit ${parameter(Number(url.searchParams.get("limit")))}`;
      }
      try {
        const result = await db.query(sql, values);
        if (options.method === "PATCH" && !new Headers(options.headers).get("prefer")?.includes("return=representation")) return new Response(null, { status: 204 });
        const singular = new Headers(options.headers).get("accept")?.includes("vnd.pgrst.object");
        return Response.json(singular ? result.rows[0] ?? null : result.rows);
      } catch (error) { return Response.json({ code: error.code, message: error.message }, { status: 400 }); }
    }
  } });
  const { GuardDiagnosticsService } = loadTs("lib/domain/digital-observer/guard-diagnostics-service.ts");
  const service = new GuardDiagnosticsService({ sessionDb: client, admin: () => client, profile, origin: "observer_chat" });
  const { DigitalGuardEngine } = loadTs("lib/domain/digital-observer/guard-engine.ts");
  const engine = new DigitalGuardEngine(service);
  engine.registerCamera({ cameraId: request.camera_source_id });
  const gateway = loadTs("app/api/video-gateway/camera-actions/route.ts", {
    process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic" } },
    "@/lib/supabase/admin": { createAdminClient: () => client },
    "@/lib/domain/gateway-device-enrollment": { verifyGatewayDeviceAccessToken: () => ({ device_id: id(5), gateway_id: "synthetic-gateway", observer_site_id: id(1) }) }
  });
  return { db, engine, service, calls, async post(payload) {
    const response = await gateway.POST(new Request("https://fixture.invalid/api/video-gateway/camera-actions", { method: "POST", headers: { "x-video-gateway-device-token": "synthetic", "content-type": "application/json" }, body: JSON.stringify(payload) }));
    return { status: response.status, body: await response.json() };
  } };
}

test("real SQL: Guard enqueue → Gateway poll → preflight result → scoped status, with one audit and no physical ACK", async () => {
  const f = await fixture();
  try {
    const queued = await f.engine.requestCameraDiagnostics(request);
    assert.equal(queued.state, "queued");
    const again = await f.engine.requestCameraDiagnostics(request);
    assert.equal(again.expires_at, queued.expires_at);
    const polled = await f.post({ action: "poll" });
    assert.equal(polled.status, 200, JSON.stringify(polled.body));
    const task = polled.body.data.action_request;
    assert.equal(task.id, request.request_id);
    assert.equal(task.task_kind, "command_preflight");
    assert.equal(task.parameters, undefined);
    const reported = await f.post({ action: "result", request_id: task.id, outcome: "command_preflight", result_code: "unavailable", outcome_payload: {
      camera_id: task.camera_id, site_id: task.site_id, stream_id: task.stream_id, channel: task.channel,
      action: task.action, supported: false, evidence_id: id(7), verified_at: null,
      ack_kind: "preflight_only", executor_installed: false, executed: false, requires_immediate_confirmation: true
    } });
    assert.equal(reported.status, 200, JSON.stringify(reported.body));
    const view = await f.engine.cameraDiagnosticStatus({ observer_site_id: id(1), camera_source_id: id(2), request_id: id(3) });
    assert.equal(view.state, "completed");
    assert.equal(view.executed, false);
    assert.equal(view.supported, false);
    assert.equal((await f.db.query("select count(*)::int as count from immutable_audit_events")).rows[0].count, 1);
    const audit = (await f.db.query("select event_hash from immutable_audit_events")).rows[0];
    assert.match(audit.event_hash, /^[a-f0-9]{64}$/);
    await assert.rejects(f.db.exec("update immutable_audit_events set metadata='{}'"), /append-only/);
    await assert.rejects(f.db.exec("delete from immutable_audit_events"), /append-only/);
    assert.equal((await f.db.query("select count(*)::int as count from digital_observer_camera_action_requests")).rows[0].count, 1);
    await assert.rejects(f.engine.requestCameraDiagnostics({ ...request, payload: { enabled: false } }), /REQUEST_CONFLICT/);
  } finally { await f.db.close(); }
});

test("real SQL: concurrent same-ID enqueue creates one immutable intent and one diagnostic", async () => {
  const f = await fixture();
  try {
    const results = await Promise.all([f.engine.requestCameraDiagnostics(request), f.engine.requestCameraDiagnostics(request)]);
    assert.equal(results[0].request_id, results[1].request_id);
    assert.equal(results[0].expires_at, results[1].expires_at);
    assert.equal((await f.db.query("select count(*)::int as count from immutable_audit_events")).rows[0].count, 1);
    assert.equal((await f.db.query("select count(*)::int as count from digital_observer_camera_action_requests")).rows[0].count, 1);
  } finally { await f.db.close(); }
});

test("real SQL: snapshot from the actual preflight driver maps capabilities without enabling commands", async () => {
  if (!process.env.CAMERA_QUEUE_PREFLIGHT_DRIVER_MODULE) throw new Error("Actual read-only driver module is required, not a skipped test");
  const { createPrivateNvrPreflightDriver } = await import(pathToFileURL(process.env.CAMERA_QUEUE_PREFLIGHT_DRIVER_MODULE).href);
  const f = await fixture();
  try {
    const snapshot = { observer_site_id: id(1), camera_source_id: id(2), request_id: id(3), task_kind: "capability_snapshot" };
    await f.engine.requestCameraDiagnostics(snapshot);
    const polled = await f.post({ action: "poll" });
    const task = polled.body.data.action_request;
    let probes = 0;
    const driver = createPrivateNvrPreflightDriver({
      resolveSource: stream => stream === "synthetic-stream" ? { kind: "private_nvr_http_mp4", channel: 1 } : null,
      probe: async () => {
        probes++;
        return { adapter: "private_nvr_http_api_v1", ptz: { tested: true, supported: true },
          talkback: { tested: true, supported: false }, siren: { tested: true, supported: false }, light: { tested: true, supported: true } };
      }
    });
    const result = await driver(task, { gatewayId: "synthetic-gateway", siteId: id(1) });
    const stored = await f.post({ action: "result", request_id: task.id, ...result });
    assert.equal(stored.status, 200, JSON.stringify(stored.body));
    const view = await f.engine.cameraDiagnosticStatus({ observer_site_id: id(1), camera_source_id: id(2), request_id: id(3) });
    assert.deepEqual(view.capabilities, { ptz: true, twoWayAudio: false, siren: false, lighting: true });
    assert.equal(view.executor_installed, false);
    assert.equal(view.executed, false);
    assert.equal(probes, 1);
    assert.equal(f.engine.recommendLineCrossingAction(id(2), "lighting").allowed, false);
  } finally { await f.db.close(); }
});

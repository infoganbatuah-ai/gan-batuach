import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

// In-memory PostgreSQL only. Never accepts a database URL or production credentials.
const { PGlite } = await import(process.argv[2] || "@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated;
    create table public.observer_sites(id uuid primary key, owner_profile_id uuid);
    create table public.digital_observer_camera_sources(id uuid primary key,
      observer_site_id uuid references public.observer_sites(id), metadata jsonb);
    create table public.provider_webhook_events(id uuid primary key, webhook_key text, event_type text,
      status text, signature_valid boolean, provider text, related_entity_type text,
      related_entity_id uuid, metadata jsonb not null default '{}', processed_at timestamptz);
    create function public.can_access_observer_site(target uuid) returns boolean language sql stable security definer as
      $$ select exists(select 1 from public.observer_sites where id = target and owner_profile_id = auth.uid()) $$;
    grant select on public.digital_observer_camera_sources to authenticated;
  `);
  await db.exec(readFileSync("supabase/migrations/20260831020000_observer_source_analysis_telemetry.sql", "utf8"));
  const site = randomUUID(), foreignSite = randomUUID(), owner = randomUUID(), foreignOwner = randomUUID();
  const a = "10000000-0000-4000-8000-000000000001", b = "20000000-0000-4000-8000-000000000002";
  const foreign = "f0000000-0000-4000-8000-000000000003", gateway = "synthetic-gateway";
  await db.query("insert into observer_sites values ($1,$2),($3,$4)", [site, owner, foreignSite, foreignOwner]);
  for (const [id, observerSite] of [[a, site], [b, site], [foreign, foreignSite]]) {
    await db.query("insert into digital_observer_camera_sources values ($1,$2,$3)", [id, observerSite, JSON.stringify({ gateway_id: gateway })]);
  }
  const now = Date.now(), iso = delta => new Date(now + delta).toISOString();
  const reports = [
    { source_id: a, state: "no_event", last_attempt_at: iso(-2000), last_analyzed_at: iso(-1500), detection_count: 0 },
    { source_id: b, state: "offline", last_attempt_at: null, last_analyzed_at: null, detection_count: null }
  ];
  async function authorization(patch = {}) {
    const id = randomUUID();
    const metadata = { telemetry_version: 1, issued_at: iso(-3000), expires_at: iso(57000), consent_verified: true,
      requested_source_ids: [a, b], authorized_source_ids: [a], ...patch };
    await db.query("insert into provider_webhook_events(id,webhook_key,event_type,status,signature_valid,provider,related_entity_type,related_entity_id,metadata) values($1,'video_gateway_cloud_learning','analysis_policy','processed',true,$2,'observer_sites',$3,$4)", [id, gateway, site, JSON.stringify(metadata)]);
    return id;
  }
  async function receipt() {
    const id = randomUUID();
    await db.query("insert into provider_webhook_events(id,webhook_key,event_type,status,signature_valid,provider,related_entity_type,related_entity_id) values($1,'video_gateway_cloud_learning','analysis_telemetry','verified',true,$2,'observer_sites',$3)", [id, gateway, site]);
    return id;
  }
  async function record(authorizationId, input = reports, completed = iso(-1000), context = {}) {
    const receiptId = await receipt();
    await db.exec("set role service_role");
    try {
      return await db.query("select record_observer_analysis_telemetry($1,$2,$3,$4,$5,$6) as result",
        [context.site || site, context.gateway || gateway, receiptId, authorizationId, completed, JSON.stringify(input)]);
    } finally { await db.exec("reset role"); }
  }
  const id = await authorization();
  assert.equal((await record(id)).rows[0].result.stored, 2);
  await assert.rejects(record(id), /consumed/);
  const snapshot = async () => (await db.query("select * from observer_source_analysis_status order by camera_source_id")).rows;
  const before = await snapshot();
  const failures = [
    [{}, [{ ...reports[0], password: "synthetic" }, reports[1]]],
    [{}, [reports[0], reports[0]]], [{}, [reports[0]]],
    [{ requested_source_ids: [a, foreign] }, [reports[0], { ...reports[1], source_id: foreign }]],
    [{ authorized_source_ids: [] }, reports],
    [{ consent_verified: false }, reports],
    [{ expires_at: iso(-1800) }, reports],
    [{}, [{ ...reports[0], last_analyzed_at: iso(10000) }, reports[1]]],
    [{}, [{ ...reports[0], detection_count: 1 }, reports[1]]],
    [{}, [{ ...reports[0], state: "processing_failed" }, reports[1]]],
    [{}, [{ ...reports[0], last_attempt_at: iso(-4000) }, reports[1]]]
  ];
  for (const [metadata, input] of failures) {
    const invalid = await authorization(metadata);
    await assert.rejects(record(invalid, input));
    assert.deepEqual(await snapshot(), before, "Rejected batch cannot partially update sources");
    assert.equal((await db.query("select metadata ? 'telemetry_received_at' as consumed from provider_webhook_events where id=$1", [invalid])).rows[0].consumed, false);
  }
  for (const context of [{ site: foreignSite }, { gateway: "foreign-gateway" }]) await assert.rejects(record(await authorization(), reports, iso(-1000), context));
  await assert.rejects(record(await authorization(), reports, iso(60000)));
  await assert.rejects(record(await authorization(), reports, iso(-600000)));

  const older = reports.map(report => report.source_id === a ? { ...report, last_attempt_at: iso(-2500), last_analyzed_at: iso(-2000) } : report);
  assert.equal((await record(await authorization(), older, iso(-1900))).rows[0].result.stored, 0);
  assert.deepEqual(await snapshot(), before, "Older round cannot overwrite a newer report");
  const denied = reports.map(report => ({ ...report, state: report.source_id === a ? "consent_unavailable" : "offline",
    last_attempt_at: null, last_analyzed_at: null, detection_count: null }));
  assert.equal((await record(await authorization({ consent_verified: false, authorized_source_ids: [], expires_at: iso(-3000) }), denied, iso(-500))).rows[0].result.stored, 2);
  assert.equal((await snapshot())[0].last_analyzed_at, null, "Denied rounds cannot establish analysis evidence");

  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  assert.equal((await db.query("select * from observer_source_analysis_status")).rows.length, 2);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [foreignOwner]);
  assert.equal((await db.query("select * from observer_source_analysis_status")).rows.length, 0);
  await assert.rejects(db.query("update observer_source_analysis_status set state='offline'"), /permission denied/);
  await assert.rejects(db.query("select record_observer_analysis_telemetry($1,$2,$3,$4,$5,$6)", [site, gateway, randomUUID(), id, iso(-1000), JSON.stringify(reports)]), /permission denied/);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("select * from observer_source_analysis_status"), /permission denied/);
  await db.exec("reset role");
  await db.query("update digital_observer_camera_sources set metadata=$1 where id=$2", [JSON.stringify({ gateway_id: "replacement" }), a]);
  await assert.rejects(record(await authorization(), reports), /scope unavailable/);
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [owner]);
  assert.equal((await db.query("select * from observer_source_analysis_status")).rows.length, 1, "Replaced Gateway evidence is hidden");
  await db.exec("reset role");
  await db.query("delete from digital_observer_camera_sources where id=$1", [b]);
  assert.equal((await db.query("select * from observer_source_analysis_status where camera_source_id=$1", [b])).rows.length, 0);
  console.log("PASS: PostgreSQL migration/RPC, atomic rollback, source/site scope, receipt replay, stale ordering, RLS/privileges and deletion cascade (in-memory synthetic database only)");
} finally { await db.close(); }

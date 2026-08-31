import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

// Actual PostgreSQL engine in memory. No network, project connection or device.
// An explicit path allows an isolated test-only install without modifying the
// application's dependencies. Missing runtime is an error, never a skipped QA.
const { PGlite } = await import(process.env.CAMERA_QUEUE_PGLITE_MODULE || "@electric-sql/pglite");
const migration = readFileSync(new URL("../../supabase/migrations/20260831090000_camera_action_queue_contract.sql", import.meta.url), "utf8");
const contract = loadTs("lib/domain/digital-observer/camera-queue-contract.ts");
const siteId = "00000000-0000-4000-8000-000000000001";
const cameraId = "00000000-0000-4000-8000-000000000002";
const profileId = "00000000-0000-4000-8000-000000000003";
const deviceId = "00000000-0000-4000-8000-000000000004";
const otherCameraId = "00000000-0000-4000-8000-000000000005";
const gatewayId = "synthetic-gateway";
const streamId = "synthetic-stream";
const legacyDDL = `create table public.digital_observer_camera_action_requests (
  id uuid primary key default gen_random_uuid(), observer_site_id uuid not null references observer_sites(id),
  camera_source_id uuid not null references digital_observer_camera_sources(id), requested_by uuid not null references profiles(id),
  confirmed_by uuid references profiles(id), action_type text not null, request_origin text not null default 'dashboard',
  action_status text not null default 'awaiting_confirmation', parameters jsonb not null default '{}', capability_evidence jsonb not null,
  idempotency_key text not null unique, expires_at timestamptz not null default now()+interval '2 minutes',
  confirmed_at timestamptz, delivered_at timestamptz, completed_at timestamptz, result jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint digital_observer_camera_action_type_check check (action_type in ('talkback','ptz_pan','ptz_tilt','ptz_zoom','light_on','light_off','siren_on','siren_off','relay_on','relay_off')),
  constraint digital_observer_camera_action_origin_check check (request_origin in ('dashboard','observer_chat')),
  constraint digital_observer_camera_action_status_check check (action_status in ('awaiting_confirmation','approved','delivered','succeeded','failed','blocked','expired','cancelled')),
  constraint digital_observer_camera_action_evidence_check check (capability_evidence->>'supported'='true' and coalesce(capability_evidence->>'method','')<>'' and coalesce(capability_evidence->>'tested_at','')<>''),
  constraint digital_observer_camera_action_confirmation_check check (action_status='awaiting_confirmation' or action_status in ('blocked','expired','cancelled') or (confirmed_by is not null and confirmed_at is not null))
);`;
const ident = name => { assert.match(name, /^[a-z_][a-z0-9_]*$/); return '"' + name + '"'; };

async function fixture({ upgrade = false } = {}) {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table observer_sites(id uuid primary key); create table profiles(id uuid primary key);
    create table digital_observer_camera_sources(id uuid primary key, observer_site_id uuid, metadata jsonb);
    create table video_gateway_device_enrollments(id uuid, gateway_id text, observer_site_id uuid, status text);
    create function public.can_manage_observer_site(site uuid) returns boolean language sql stable as
      $$select site::text = current_setting('test.site_id',true)$$;`);
  await db.query("insert into observer_sites values ($1);", [siteId]);
  await db.query("insert into profiles values ($1);", [profileId]);
  await db.query("insert into digital_observer_camera_sources values ($1,$2,$3),($4,$2,$5)", [cameraId, siteId,
    { gateway_id: gatewayId, gateway_stream_id: streamId, dvr_channel: 1 }, otherCameraId,
    { gateway_id: "other-gateway", gateway_stream_id: "other-stream", dvr_channel: 2 }]);
  await db.query("insert into video_gateway_device_enrollments values ($1,$2,$3,'delivered')", [deviceId, gatewayId, siteId]);
  let legacyBefore;
  if (upgrade) {
    await db.exec(legacyDDL);
    await db.query(`insert into digital_observer_camera_action_requests
      (observer_site_id,camera_source_id,requested_by,confirmed_by,confirmed_at,action_type,action_status,capability_evidence,idempotency_key)
      values ($1,$2,$3,$3,now(),'light_on','succeeded',$4,'legacy-unchanged')`, [siteId,cameraId,profileId,
      { supported:true,method:"vendor_read_only_api",tested_at:new Date().toISOString() }]);
    legacyBefore = (await db.query("select to_jsonb(q) as row from digital_observer_camera_action_requests q")).rows[0].row;
  }
  await db.exec(migration);
  const calls = [], failures = new Set();
  const client = createClient("https://fixture.invalid", "fixture-key", { auth: { persistSession:false,autoRefreshToken:false }, global: {
    async fetch(resource, options) {
      const url = new URL(resource), table = url.pathname.split("/").at(-1), method = options.method;
      calls.push({ url, table, method });
      if (failures.has(`${method}:${table}`)) return Response.json({ code:"XX000",message:"synthetic database failure" }, { status:400 });
      const values = [], filters = [];
      const param = value => { values.push(value); return `$${values.length}`; };
      for (const [key,value] of url.searchParams) {
        if (["select","order","limit","offset"].includes(key)) continue;
        const column = key === "source.metadata->>gateway_id" ? "s.metadata->>'gateway_id'" : `q.${ident(key)}`;
        const split = value.indexOf("."), op = value.slice(0,split), operand = value.slice(split+1);
        if (op === "is") {assert.equal(operand,"null");filters.push(`${column} is null`);}
        else if (op === "in") filters.push(`${column} in (${operand.slice(1,-1).split(",").map(param).join(",")})`);
        else { assert.ok(["eq","gt","lte"].includes(op)); filters.push(`${column} ${{eq:"=",gt:">",lte:"<="}[op]} ${param(operand)}`); }
      }
      const where = filters.length ? ` where ${filters.join(" and ")}` : "";
      const rawSelect = url.searchParams.get("select") || "*";
      const sourceJoin = rawSelect.includes("source:digital_observer_camera_sources!inner");
      const columns = rawSelect.split(",source:")[0].split(",").map(key => key === "*" ? "q.*" : `q.${ident(key)}`).join(",");
      let sql;
      if (method === "GET") {
        const select = columns + (sourceJoin ? ",to_jsonb(s) as source" : "");
        sql = `select ${select} from ${ident(table)} q${sourceJoin ? " join digital_observer_camera_sources s on s.id=q.camera_source_id" : ""}${where}`;
        if (url.searchParams.has("order")) sql += " order by " + url.searchParams.get("order").split(",").map(x => `q.${ident(x.split(".")[0])} ${x.endsWith(".desc") ? "desc" : "asc"}`).join(",");
        if (url.searchParams.has("limit")) sql += ` limit ${param(Number(url.searchParams.get("limit")))}`;
      } else {
        assert.equal(method,"PATCH");
        const patch = JSON.parse(options.body);
        sql = `update ${ident(table)} q set ${Object.entries(patch).map(([key,value]) => `${ident(key)}=${param(value)}`).join(",")}${where} returning ${columns}`;
      }
      try {
        const { rows } = await db.query(sql,values);
        if (method === "PATCH" && !new Headers(options.headers).get("prefer")?.includes("return=representation")) return new Response(null,{status:204});
        const singular = new Headers(options.headers).get("accept")?.includes("vnd.pgrst.object");
        return Response.json(singular ? (rows[0] ?? null) : rows);
      } catch (error) { return Response.json({code:error.code || "XX000",message:error.message},{status:400}); }
    }
  }});
  const route = loadTs("app/api/video-gateway/camera-actions/route.ts", {
    process:{env:{VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET:"fixture-only"}},
    "@/lib/supabase/admin":{createAdminClient:()=>client},
    "@/lib/domain/gateway-device-enrollment":{verifyGatewayDeviceAccessToken:token=>token==="fixture-token"?{device_id:deviceId,gateway_id:gatewayId,observer_site_id:siteId}:null}
  });
  return { db,calls,failures,legacyBefore,async post(body) {
    const response = await route.POST(new Request("https://fixture.invalid/api/video-gateway/camera-actions", {method:"POST",
      headers:{"content-type":"application/json","x-video-gateway-device-token":"fixture-token"},body:JSON.stringify(body)}));
    return {status:response.status,body:await response.json()};
  }};
}

function row(overrides = {}) {
  return { id:randomUUID(),observer_site_id:siteId,camera_source_id:cameraId,requested_by:profileId,
    task_kind:"command_preflight",gateway_id:gatewayId,stream_id:streamId,channel:1,
    requested_at:new Date().toISOString(),expires_at:new Date(Date.now()+110_000).toISOString(),
    action_type:"lighting",action_status:"approved",parameters:{},capability_evidence:{},
    payload_digest:"a".repeat(64),idempotency_key:randomUUID(),...overrides };
}
async function insert(db,value) {
  const keys=Object.keys(value);
  await db.query(`insert into digital_observer_camera_action_requests (${keys.map(ident).join(",")}) values (${keys.map((_,i)=>`$${i+1}`).join(",")})`,Object.values(value));
}
function result(value) {
  return {action:"result",request_id:value.id,outcome:"command_preflight",result_code:"preflight_only",
    outcome_payload:{camera_id:cameraId,site_id:siteId,stream_id:streamId,channel:1,action:"lighting",executor_installed:false,
      executed:false,ack_kind:"preflight_only",requires_immediate_confirmation:true,supported:true,evidence_id:randomUUID(),verified_at:new Date().toISOString()}};
}

test("migration upgrades the existing legacy table, preserves rows and all API columns", async () => {
  const f=await fixture({upgrade:true});
  try {
    await f.db.exec(migration); // Also verify safe reapplication to the same schema.
    const columns=(await f.db.query("select column_name from information_schema.columns where table_name='digital_observer_camera_action_requests'")).rows.map(x=>x.column_name);
    for(const name of [...contract.cameraQueueSelect.split(","),"updated_at","completed_at","result","parameters","capability_evidence"]) assert.ok(columns.includes(name),`Missing API column ${name}`);
    const after=(await f.db.query("select to_jsonb(q) as row from digital_observer_camera_action_requests q")).rows[0].row;
    for(const [key,value] of Object.entries(f.legacyBefore)) assert.deepEqual(after[key],value,`Legacy ${key} changed`);
    assert.equal(after.task_kind,"legacy_command"); assert.equal(after.gateway_id,null);
    const constraints=(await f.db.query("select conname from pg_constraint where conrelid='digital_observer_camera_action_requests'::regclass")).rows.map(x=>x.conname);
    for(const name of ["camera_queue_binding_check","camera_queue_ttl_check","camera_queue_payload_check","camera_queue_no_physical_success_check","camera_queue_result_check"]) assert.ok(constraints.includes(name));
  } finally { await f.db.close(); }
});

test("PostgreSQL rejects missing mapping, invalid task/payload/TTL and cross-source binding",async()=>{
  const f=await fixture();
  try {
    for(const changes of [{gateway_id:null},{stream_id:null},{channel:null},{channel:0},{channel:65},{requested_at:null},
      {task_kind:"physical_command"},{action_type:"siren_on"},{payload_digest:null},{payload_digest:"secret"},{parameters:{enabled:true}},
      {expires_at:new Date(Date.now()+300_000).toISOString()},{gateway_id:"other-gateway"},{stream_id:"other-stream"},
      {camera_source_id:otherCameraId},{task_kind:"capability_snapshot",action_type:"capability_snapshot",payload_digest:"a".repeat(64)}]) {
      await assert.rejects(insert(f.db,row(changes)),error=>error.code==="23514",JSON.stringify(changes));
    }
    const valid=row();await insert(f.db,valid);
    await assert.rejects(insert(f.db,row({idempotency_key:valid.idempotency_key})),error=>error.code==="23505");
    for(const sql of ["update digital_observer_camera_action_requests set task_kind='capability_snapshot'", "update digital_observer_camera_action_requests set channel=2", "update digital_observer_camera_action_requests set action_status='succeeded'"]) await assert.rejects(f.db.exec(sql),error=>error.code==="23514");
  } finally {await f.db.close();}
});

test("authenticated roles have scoped read only and cannot insert/claim queue work",async()=>{
  const f=await fixture();
  try {
    await insert(f.db,row());
    await f.db.exec(`select set_config('test.site_id','${siteId}',false); set role authenticated;`);
    assert.equal((await f.db.query("select id from digital_observer_camera_action_requests")).rows.length,1);
    await assert.rejects(f.db.exec("update digital_observer_camera_action_requests set action_status='delivered'"),error=>error.code==="42501");
    await f.db.exec("select set_config('test.site_id','another-site',false)");
    assert.equal((await f.db.query("select id from digital_observer_camera_action_requests")).rows.length,0);
    await f.db.exec("reset role; set role anon;");
    await assert.rejects(f.db.exec("select id from digital_observer_camera_action_requests"),error=>error.code==="42501");
  } finally {await f.db.close();}
});

test("real handler + PostgREST + PostgreSQL filters 150 foreign Gateway jobs before LIMIT",async()=>{
  const f=await fixture();
  try {
    for(let i=0;i<150;i++) await insert(f.db,row({camera_source_id:otherCameraId,gateway_id:"other-gateway",stream_id:"other-stream",channel:2}));
    const own=row();await insert(f.db,own);
    const response=await f.post({action:"poll"});
    assert.equal(response.status,200,JSON.stringify(response.body));
    const envelope=response.body.data.action_request;
    assert.equal(envelope.id,own.id); assert.equal(envelope.task_kind,"command_preflight");
    assert.equal(contract.cameraQueueTaskSchema.safeParse(envelope).success,true);
    assert.deepEqual(Object.keys(envelope).sort(),["id","task_kind","camera_id","site_id","stream_id","channel","requested_at","expires_at","action","payload_digest"].sort());
    assert.equal(f.calls.filter(x=>x.table==="digital_observer_camera_sources").length,0);
    const query=f.calls.find(x=>x.method==="GET"&&x.table==="digital_observer_camera_action_requests").url.searchParams;
    assert.equal(query.get("gateway_id"),`eq.${gatewayId}`); assert.equal(query.get("limit"),"25");
    const delivery=await Promise.all([f.post({action:"poll"}),f.post({action:"poll"})]);
    assert.ok(delivery.every(x=>x.body.data.action_request===null));
  } finally {await f.db.close();}
});

test("both task kinds round-trip through the actual SQL schema; snapshot needs no forged approval/evidence",async()=>{
  const f=await fixture();
  try {
    const preflight=row();await insert(f.db,preflight);
    assert.equal((await f.post({action:"poll"})).status,200);
    const ack=result(preflight);
    // Exercise DB constraints directly, independently of the HTTP validator.
    // Removing the SQL result guard must make this regression fail.
    for(const mutation of [{executed:true},{executor_installed:true},{executed:"false"},{channel:2},{channel:null},{ack_kind:"executed"}]) {
      await assert.rejects(f.db.query(`update digital_observer_camera_action_requests
        set action_status='completed',completed_at=now(),result_digest=$2,result=$3 where id=$1`,
      [preflight.id,"b".repeat(64),{...ack,outcome_payload:{...ack.outcome_payload,...mutation}}]),error=>error.code==="23514");
    }
    const completed=await f.post(ack);assert.equal(completed.status,200,JSON.stringify(completed.body));
    const replay=await f.post(ack);assert.equal(replay.body.data.replay,true);
    assert.equal((await f.post({...ack,outcome_payload:{...ack.outcome_payload,evidence_id:randomUUID()}})).status,409);
    await assert.rejects(f.db.query("update digital_observer_camera_action_requests set result='{}' where id=$1",[preflight.id]),error=>error.code==="23514");
    const snapshot=row({task_kind:"capability_snapshot",action_type:"capability_snapshot",payload_digest:null});await insert(f.db,snapshot);
    const polled=await f.post({action:"poll"});assert.equal(polled.body.data.action_request.task_kind,"capability_snapshot");
    assert.equal(polled.body.data.action_request.action,undefined);
    const at=new Date().toISOString(),caps={ptz:true,twoWayAudio:false,siren:false,lighting:false};
    const details=Object.fromEntries(Object.entries(caps).map(([key,supported])=>[key,{supported,method:"vendor_read_only_api",tested_at:at,adapter:contract.CAMERA_QUEUE_DRIVER,reason:supported?"read_only_capability_verified":"capability_not_reported"}]));
    const snapAck={action:"result",request_id:snapshot.id,outcome:"capability_snapshot",result_code:"verified",outcome_payload:{
      camera_id:cameraId,site_id:siteId,stream_id:streamId,channel:1,executor_installed:false,evidence_id:randomUUID(),verified_at:at,
      driver:contract.CAMERA_QUEUE_DRIVER,provider:contract.CAMERA_QUEUE_DRIVER,capabilities:caps,details}};
    const stored=await f.post(snapAck);assert.equal(stored.status,200,JSON.stringify(stored.body));
    const data=(await f.db.query("select result from digital_observer_camera_action_requests where id=$1",[snapshot.id])).rows[0].result;
    assert.equal(data.outcome_payload.executed,false);
  } finally {await f.db.close();}
});

test("same-site swapped camera result is rejected before persistence or any recorder path",async()=>{
  const f=await fixture();try{
    const value=row();await insert(f.db,value);
    const delivered=await f.post({action:"poll"});
    assert.equal(delivered.status,200,JSON.stringify(delivered.body));
    assert.equal(delivered.body.data.action_request.camera_id,cameraId);
    const ack=result(value);
    const swapped={...ack,outcome_payload:{...ack.outcome_payload,camera_id:otherCameraId}};
    const rejected=await f.post(swapped);
    assert.equal(rejected.status,422,JSON.stringify(rejected.body));
    const stored=(await f.db.query("select action_status,result,result_digest from digital_observer_camera_action_requests where id=$1",[value.id])).rows[0];
    assert.equal(stored.action_status,"delivered");
    assert.equal(stored.result,null);
    assert.equal(stored.result_digest,null);
  }finally{await f.db.close();}
});

test("DB failures never look like an empty queue or successful delivery",async()=>{
  for(const failure of ["GET:video_gateway_device_enrollments","PATCH:digital_observer_camera_action_requests","GET:digital_observer_camera_action_requests"]) {
    const f=await fixture();try{await insert(f.db,row());f.failures.add(failure);assert.equal((await f.post({action:"poll"})).status,503,failure);}finally{await f.db.close();}
  }
});

test("a changed channel is blocked before delivery; physical success is always rejected",async()=>{
  const f=await fixture();try {
    const value=row();await insert(f.db,value);
    await f.db.query("update digital_observer_camera_sources set metadata=jsonb_set(metadata,'{dvr_channel}','2') where id=$1",[cameraId]);
    assert.equal((await f.post({action:"poll"})).body.data.action_request,null);
    assert.equal((await f.db.query("select action_status from digital_observer_camera_action_requests where id=$1",[value.id])).rows[0].action_status,"blocked");
    assert.equal((await f.post({...result(value),outcome:"succeeded",outcome_payload:{...result(value).outcome_payload,executor_installed:true,executed:true}})).status,422);
  } finally{await f.db.close();}
});

test("two concurrent Gateway polls claim a diagnostic at most once",async()=>{
  const f=await fixture();try{
    await insert(f.db,row());
    const responses=await Promise.all([f.post({action:"poll"}),f.post({action:"poll"})]);
    assert.ok(responses.every(x=>x.status===200));
    assert.equal(responses.filter(x=>x.body.data.action_request!==null).length,1);
  }finally{await f.db.close();}
});

test("legacy failure callbacks remain compatible without reclassifying or dispatching legacy commands",async()=>{
  const f=await fixture({upgrade:true});try{
    const id=randomUUID();
    await f.db.query(`insert into digital_observer_camera_action_requests
      (id,observer_site_id,camera_source_id,requested_by,confirmed_by,confirmed_at,action_type,action_status,capability_evidence,idempotency_key)
      values ($1,$2,$3,$4,$4,now(),'light_on','delivered',$5,$6)`,[id,siteId,cameraId,profileId,
      {supported:true,method:"vendor_read_only_api",tested_at:new Date().toISOString()},randomUUID()]);
    const response=await f.post({action:"result",request_id:id,outcome:"failed",result_code:"adapter_executor_not_installed"});
    assert.equal(response.status,200,JSON.stringify(response.body));
    const stored=(await f.db.query("select task_kind,gateway_id,action_status from digital_observer_camera_action_requests where id=$1",[id])).rows[0];
    assert.deepEqual(stored,{task_kind:"legacy_command",gateway_id:null,action_status:"failed"});
    assert.equal((await f.post({action:"poll"})).body.data.action_request,null);
  }finally{await f.db.close();}
});

test("cloud queue and the actual read-only Gateway driver agree on both envelopes and ACKs",async()=>{
  const modulePath=process.env.CAMERA_QUEUE_PREFLIGHT_DRIVER_MODULE || new URL("../../services/video-gateway/private-nvr-command-preflight.mjs",import.meta.url).href;
  const {createPrivateNvrPreflightDriver}=await import(modulePath);
  const f=await fixture();let probes=0;
  try {
    const driver=createPrivateNvrPreflightDriver({
      resolveSource:id=>id===streamId?{kind:"private_nvr_http_mp4",channel:1}:null,
      probe:async()=>{probes++;return {adapter:contract.CAMERA_QUEUE_DRIVER,ptz:{tested:true,supported:true},
        talkback:{tested:true,supported:false},siren:{tested:true,supported:false},light:{tested:true,supported:true}};}
    });
    for(const changes of [{},{task_kind:"capability_snapshot",action_type:"capability_snapshot",payload_digest:null}]) {
      const queued=row(changes);await insert(f.db,queued);
      const polled=await f.post({action:"poll"});assert.equal(polled.status,200);
      const task=polled.body.data.action_request;
      const proof=await driver(task,{gatewayId,siteId});
      const ack={action:"result",request_id:task.id,...proof};
      const recorded=await f.post(ack);assert.equal(recorded.status,200,JSON.stringify(recorded.body));
      assert.equal((await f.post(ack)).body.data.replay,true);
      assert.equal((await driver(task,{gatewayId,siteId})).outcome_payload.evidence_id,proof.outcome_payload.evidence_id);
    }
    assert.equal(probes,2); // Retry reused evidence; it did not probe or execute again.
  }finally{await f.db.close();}
});

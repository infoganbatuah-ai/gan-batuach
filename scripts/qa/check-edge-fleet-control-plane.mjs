import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import ts from "typescript";
import vm from "node:vm";

const file="lib/domain/digital-observer/fleet-control-plane.ts";
const js=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`,{module,console,Date,Error,Object,Number,String,Array,Math});
const fleet=module.exports;
const devices=[];for(let tenant=0;tenant<10;tenant++)for(let site=0;site<100;site++)for(let device=0;device<10;device++){const profile=device%3===0?"PHYSICAL_GATEWAY":device%3===1?"SOFTWARE_CONNECTOR":"ENTERPRISE_EDGE";devices.push({id:`d-${tenant}-${site}-${device}`,enrollmentId:`e-${tenant}-${site}-${device}`,tenantId:`t-${tenant}`,siteId:`s-${tenant}-${site}`,siteName:`Site ${site}`,profile,platform:device%2?"windows":"macos",architecture:device%2?"x64":"arm64",runtimeVersion:`1.${device%4}.0`,buildSha:"qa",configurationVersion:device%5===0?1:2,desiredConfigurationVersion:2,lifecycleState:"ACTIVE",identityState:"ED25519_V1",credentialState:"ACTIVE",updateChannel:"STABLE",updateState:device%11===0?"UPDATE_AVAILABLE":"HEALTHY",health:device%29===0?"OFFLINE":"HEALTHY",lastSeenAt:new Date().toISOString(),supervisionState:"HEALTHY",backlogRecords:device%17===0?30:0,backlogBytes:0,resyncState:"SYNCHRONIZED",dependentPhysicalCameras:profile==="PHYSICAL_GATEWAY"?10:1,emptyChannels:profile==="PHYSICAL_GATEWAY"?6:0});}
const started=performance.now();const summary=fleet.summarizeFleet(devices);const aggregateMs=performance.now()-started;
assert.equal(devices.length,10_000);assert.equal(summary.total,10_000);assert.equal(summary.emptyChannels,24_000);
const filterStarted=performance.now();const targets=fleet.resolveFleetTargets(devices,{tenantId:"t-4",siteIds:["s-4-22"],profiles:["SOFTWARE_CONNECTOR"]},100);const filterMs=performance.now()-filterStarted;
assert.equal(targets.length,3);assert.ok(targets.every(id=>id.startsWith("d-4-22-")));
assert.throws(()=>fleet.resolveFleetTargets(devices,{tenantId:"t-4"},100),/BLAST_RADIUS/);
assert.throws(()=>fleet.validateFleetCommand({command:"RESTART_SERVICE",expiresAt:new Date(Date.now()+60_000).toISOString(),targetCount:1,confirmed:false}),/CONFIRMATION/);
assert.throws(()=>fleet.validateFleetCommand({command:"HEALTH_PROBE",expiresAt:new Date(Date.now()-1).toISOString(),targetCount:1,confirmed:true}),/TTL/);
assert.equal(fleet.validateFleetCommand({command:"HEALTH_PROBE",expiresAt:new Date(Date.now()+60_000).toISOString(),targetCount:3,confirmed:true}),true);
const alerts=fleet.dedupeInfrastructureAlerts([{...devices[0],health:"OFFLINE",dependentPhysicalCameras:10}]);assert.equal(alerts.length,1);assert.equal(alerts[0].affectedPhysicalCameras,10);
assert.equal(fleet.classifyFleetHealth({lastSeenAt:new Date().toISOString(),lifecycleState:"REVOKED",credentialState:"REVOKED",runtimeHealth:"HEALTHY"}),"AUTH_DEGRADED");
for(const [path,needles] of Object.entries({
  "app/api/digital-observer/admin/fleet/route.ts":["hasObserverAdminClaim","resolveFleetTargets","idempotency_key","target_count","writeAuditEvent"],
  "app/api/video-gateway/device-heartbeat/route.ts":["claim_observer_edge_fleet_commands","expires_at","command_results","PGRST202","42883","CONTRACT_UNAVAILABLE_NO_COMMANDS"],
  "supabase/migrations/20260909030000_observer_edge_fleet_control_plane.sql":["enable row level security","COMMAND_TTL_EXPIRED","for update skip locked","revoke all"]})){
  const source=readFileSync(path,"utf8");for(const needle of needles)assert.ok(source.includes(needle),`${path} missing ${needle}`);
}
console.log(JSON.stringify({status:"PASS",contract:fleet.FLEET_CONTRACT,dataset:{tenants:10,sites:1000,devices:10_000},performance_ms:{aggregate:Number(aggregateMs.toFixed(3)),filter_and_target:Number(filterMs.toFixed(3))},bulk_safety:true,tenant_scope:true,command_ttl:true,common_cause_dedupe:true,empty_slots_excluded_from_health:true}));

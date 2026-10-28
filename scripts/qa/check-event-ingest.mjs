import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url);
const secrets = { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: randomBytes(32).toString("hex") };
function load(file, mocks, cache = new Map()) {
  file=resolve(file); if(cache.has(file))return cache.get(file);
  const loadedModule={exports:{}}; cache.set(file,loadedModule.exports);
  const get=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith("@/")||name.startsWith(".")?load((name.startsWith("@/")?resolve(name.slice(2)):resolve(dirname(file),name))+".ts",mocks,cache):require(name);
  const js=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function("require","module","exports","process",js)(get,loadedModule,loadedModule.exports,{env:secrets});
  return loadedModule.exports;
}
const siteId=randomUUID(),cameraId=randomUUID(),gatewayId=randomUUID(),deviceId=randomUUID();
const tables={
  video_gateway_device_enrollments:[{id:deviceId,gateway_id:gatewayId,observer_site_id:siteId,status:"delivered"}],
  observer_sites:[{id:siteId,garden_id:null,site_type:"home",monitoring_enabled:true,metadata:{observer_monitoring_consent:true}}],
  observer_site_subscriptions:[{id:randomUUID(),observer_site_id:siteId,commercial_state:"active",entitlement_snapshot:{ai_processing:true,evidence_storage:true,video_retention:24},trial_end:null,grace_period_ends_at:null}],
  digital_observer_camera_sources:[{id:cameraId,observer_site_id:siteId,display_name:"כניסה",status:"connected",source_mode:"gateway_test",metadata:{gateway_id:gatewayId,gateway_stream_id:"stream",zone_type:"ENTRANCE"}}],
  observer_monitoring_schedules:[{observer_site_id:siteId,status:"active",timezone:"UTC",schedule:{quiet_hours:{start:"00:00",end:"06:00"}}}],
  observer_intelligence_signals:[], digital_observer_authorized_recipients:[], observer_alert_channel_settings:[],
  digital_observer_notification_deliveries:[], provider_webhook_events:[], digital_observer_event_clips:[], immutable_audit_events:[]
};
let failImmutableAuditWrites=false, immutableAuditFailures=0;
let signalReads=0;
const raceReads={enabled:false,arrivals:0,gate:null,release:null};
class Query {
  constructor(table){this.table=table;this.filters=[];this.equalities={};}
  select(){return this;}
  eq(key,val){this.equalities[key]=val;this.filters.push(row=>row[key]===val);return this;}
  insert(row){this.insertion=row;return this;}
  update(row){this.patch=row;return this;}
  then(resolve,reject){return this.execute(false).then(resolve,reject);}
  async maybeSingle(){return this.single();}
  async single(){return this.execute(true);}
  async execute(single){
    if(this.insertion){
      if(this.table==="immutable_audit_events" && failImmutableAuditWrites) return {data:null,error:{code:"FIXTURE_AUDIT_FAILURE",message:"fixture audit failure"}};
      // Model the existing source uniqueness constraint, not an in-process route lock.
      if(this.table==="observer_intelligence_signals" && tables[this.table].some(row=>row.source_type===this.insertion.source_type && row.source_id===this.insertion.source_id)) return {data:null,error:{code:"23505"}};
      if(this.insertion.dedupe_key && tables[this.table].some(row=>row.dedupe_key===this.insertion.dedupe_key)) return {data:null,error:{code:"23505"}};
      const row={id:randomUUID(),...this.insertion};
      // Model the documented numeric(5,4) coercion at a decimal tie that
      // binary Math.round(value * 10_000) handles incorrectly.
      if(this.table==="observer_intelligence_signals" && row.confidence===.55085) row.confidence=.5509;
      tables[this.table].push(row);return {data:single?row:[row],error:null};
    }
    if(this.table==="observer_intelligence_signals") signalReads++;
    const rows=tables[this.table]?.filter(row=>this.filters.every(f=>f(row)))??[];
    // Force two route requests to observe the same pre-insert snapshot.
    if(this.table==="observer_intelligence_signals" && this.equalities.source_id && raceReads.enabled){
      raceReads.arrivals++;
      if(raceReads.arrivals===2){raceReads.enabled=false;raceReads.release();}
      else await raceReads.gate;
    }
    if(this.patch) for(const row of rows) Object.assign(row,this.patch);
    return {data:single?rows[0]??null:rows,error:null};
  }
}
let uploads=0;
const db={from:table=>new Query(table),storage:{from:()=>({upload:async()=>{uploads++;return {error:null};}})}};
let pushCalls=0;
let riskCalls=0;
const audits=[];
const mocks={"@/lib/supabase/admin":{createAdminClient:()=>db},"@/lib/api":{
  ok:(data,status=200)=>Response.json({data},{status}),fail:(error,status=400)=>Response.json({error},{status}),handleRouteError:()=>Response.json({error:"route_failure"},{status:500})
},"@/lib/domain/digital-observer/storage-contract.mjs":{
  createStorageObjectId:({tenantId,siteId,evidenceId,variant,extension})=>`${tenantId}/${siteId}/${evidenceId}/${variant}.${extension}`,
  createSupabaseStorageBackend:({client})=>({write:async({objectId,bytes,contentType})=>{const result=await client.storage.from("digital-observer-event-media").upload(objectId,bytes,{contentType,upsert:true});if(result.error)throw new Error("storage_write_failed");return {object_id:objectId};}})
},"@/lib/domain/push-service":{preparePushForNotification:async()=>{pushCalls++;return {logs:[{status:"sent"}],error:null};}},
"@/lib/security/audit-log-service":{writeAuditEvent:async input=>{
  const result=await db.from("immutable_audit_events").insert(input);
  if(result.error){immutableAuditFailures++;return;}
  audits.push(input);
}},"@/lib/domain/digital-observer/risk-decision-service":{evaluateAndPersistIncidentRisk:async()=>{riskCalls++;return {status:"not_applicable"};}},"server-only":{}};
const tokenLib=load("lib/domain/gateway-device-enrollment.ts",mocks);
const liveClaimActivation=load("lib/domain/digital-observer/event-risk-claim-activation.ts",mocks).EVENT_RISK_CLAIM_ACTIVATION;
assert.equal(liveClaimActivation.enabled,false,"The candidate claim adapter is disabled in the live route");
assert.equal(liveClaimActivation.runner,null,"No unfenced Data API writer is an activation substitute");
const token=tokenLib.issueGatewayDeviceAccessToken({device_id:deviceId,gateway_id:gatewayId,observer_site_id:siteId},secrets.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET);
const route=load("app/api/video-gateway/cloud-events/route.ts",mocks);
const event={event_id:randomUUID(),camera_source_id:cameraId,stream_id:"stream",event_type:"person_detected",severity:"INFO",confidence:.9,timestamp:new Date().toISOString(),evidence_kind:"object_detection"};
const send=(body,auth=token)=>route.POST(new Request("http://test.invalid/api/video-gateway/cloud-events",{method:"POST",headers:{"content-type":"application/json","x-video-gateway-device-token":auth},body:JSON.stringify(body)}));
assert.equal((await send(event,"invalid")).status,401);
assert.equal((await send({...event,camera_source_id:randomUUID()})).status,403);
assert.equal((await send({...event,stream_id:"other"})).status,403);
let response=await send(event);assert.equal(response.status,201);
let value=(await response.json()).data;assert.equal(value.recording_required,false);assert.equal(tables.observer_intelligence_signals.length,1);
assert.equal(tables.observer_intelligence_signals[0].metadata.observation_provenance,"REAL_CAMERA_AI","Authenticated Gateway events are explicitly marked as real camera AI");
assert.equal(tables.observer_intelligence_signals[0].metadata.stream_id,"stream","Authenticated Gateway events retain their source stream binding");
assert.equal((await send(event)).status,201);assert.equal(tables.observer_intelligence_signals.length,1,"Retries must not insert a second event");
const riskCallsBeforeConflicts=riskCalls;
assert.equal((await send({...event,track_id:"different-track"})).status,409,"A reused event ID cannot change the tracked observation");
assert.equal((await send({...event,confidence:.72})).status,409,"A reused event ID cannot change its confidence or downstream risk input");
assert.equal((await send({...event,model_provenance:{model:"different-model",runtime:"qa",execution_provider:"qa"}})).status,409,"A reused event ID cannot add different model provenance");
assert.equal((await send({...event,verification_evidence:{distinct_source_frames:2,directional_confirmations:0,source_sequence:1,source_anchor_verified:true,tracking_duration_ms:100}})).status,409,"A reused event ID cannot substitute verification evidence");
tables.digital_observer_camera_sources[0].metadata.verified_event_models={person_detected:true};
assert.equal((await send({...event,evidence_kind:"validated_rule"})).status,409,"A reused event ID cannot substitute another compatible evidence kind");
delete tables.digital_observer_camera_sources[0].metadata.verified_event_models;
assert.equal(tables.observer_intelligence_signals.length,1,"Conflicting retries do not create or replace durable observations");
assert.equal(riskCalls,riskCallsBeforeConflicts,"Conflicting retries are rejected before Incident Risk evaluation");
assert.equal((await send({...event,event_id:randomUUID(),timestamp:new Date(Date.now()-2*86400000).toISOString()})).status,201,"An authenticated backlog older than one day must not be lost");
assert.equal(tables.observer_intelligence_signals[1].metadata.received_late,true);
assert.equal((await send({...event,event_id:randomUUID(),timestamp:new Date(Date.now()+180000).toISOString()})).status,422);
assert.equal((await send({...event,timestamp:new Date(Date.now()-30000).toISOString()})).status,409,"An id cannot be reused for a different observation");
assert.equal((await send({...event,event_type:"person_entered",evidence_kind:"line_crossing"})).status,202,"Direction requires a configured line");
tables.digital_observer_camera_sources[0].metadata.zone_type="POOL";
assert.equal((await send({...event,event_type:"vehicle_entered"})).status,202);
const offHours={...event,event_id:randomUUID(),timestamp:"2026-09-01T02:00:00.000Z",event_type:"person_near_pool_off_hours",severity:"WARNING",evidence_kind:"object_detection_off_hours"};
assert.equal((await (await send(offHours)).json()).data.reason,"specialized_model_not_verified","Off-hours evidence fails closed when the exact event model is not verified");
tables.digital_observer_camera_sources[0].metadata.verified_event_models={person_near_pool_off_hours:true};
const offHoursSaved=(await (await send(offHours)).json()).data;
assert.equal(offHoursSaved.status,"stored","A bound pool presence event is accepted only through the typed off-hours evidence kind");
assert.equal(tables.observer_intelligence_signals.at(-1).metadata.evidence_kind,"object_detection_off_hours");
assert.equal((await (await send({...offHours,event_id:randomUUID(),evidence_kind:"object_detection"})).json()).data.reason,"specialized_evidence_required","Generic object evidence cannot impersonate an off-hours rule");
tables.observer_monitoring_schedules[0].schedule.quiet_hours={start:"12:00",end:"13:00"};
assert.equal((await (await send({...offHours,event_id:randomUUID()})).json()).data.reason,"off_hours_not_verified","Cloud schedule must independently verify off-hours at the event timestamp");
tables.observer_monitoring_schedules[0].schedule.quiet_hours={start:"00:00",end:"06:00"};
tables.observer_monitoring_schedules[0].status="paused";
assert.equal((await (await send({...offHours,event_id:randomUUID()})).json()).data.reason,"off_hours_not_verified","An inactive schedule cannot authorize off-hours evidence");
tables.observer_monitoring_schedules[0].status="active";
assert.equal(tables.observer_intelligence_signals[0].metadata.recording_required,false,"Ordinary person detection remains passive and no-recording");
assert.equal((await send({...event,event_type:"drowning_hazard",severity:"CRITICAL",evidence_kind:"validated_rule"})).status,202,"Critical claims need a verified specialized model");
assert.equal((await send({...event,event_type:"drowning_hazard",severity:"CRITICAL",evidence_kind:"line_crossing"})).status,202,"Crossing a line does not prove drowning");
const owner=randomUUID(), recipient=randomUUID();
tables.observer_sites[0].owner_profile_id=owner;
tables.digital_observer_authorized_recipients.push({observer_site_id:siteId,recipient_profile_id:recipient,active:true,channels:["in_app"],receives_critical_alerts:true});
tables.digital_observer_camera_sources[0].metadata.verified_event_models={drowning_hazard:true};
const critical={...event,event_id:randomUUID(),event_type:"drowning_hazard",severity:"INFO",evidence_kind:"validated_rule"};
const criticalSaved=(await (await send(critical)).json()).data;
assert.equal(criticalSaved.recording_required,true);
assert.equal(tables.digital_observer_notification_deliveries.length,2,"Owner and recipient each get an in-app notification");
await send(critical);
assert.equal(tables.digital_observer_notification_deliveries.length,2,"Notification retries are idempotent per recipient");
const criticalSignal=tables.observer_intelligence_signals.find(s=>s.id===criticalSaved.signal_id);
assert.equal(criticalSignal.severity,"critical","Emergency severity cannot be downgraded by the producer");
assert.equal((await (await send({...critical,media_failure_reason:"capture_window_elapsed"})).json()).data.media_status,"missing");
assert.equal(criticalSignal.metadata.media_fault.status,"open");
assert.equal(audits.filter(item=>item.eventType==="observer_media_fault_opened").length,1,"Opening a media fault appends one immutable transition audit");
await send({...critical,media_failure_reason:"capture_window_elapsed"});
assert.equal(criticalSignal.metadata.media_fault.occurrences,2,"Repeated failure updates the same open lifecycle");
assert.equal(audits.filter(item=>item.eventType==="observer_media_fault_opened").length,1,"Repeated failure does not invent another opened transition");
const auditFailureEvent={...critical,event_id:randomUUID()};
const auditFailureSaved=(await (await send(auditFailureEvent)).json()).data;
failImmutableAuditWrites=true;
const auditFailureResult=(await (await send({...auditFailureEvent,media_failure_reason:"capture_failed"})).json()).data;
failImmutableAuditWrites=false;
assert.equal(auditFailureResult.media_status,"missing","A contained audit sink failure does not erase the already-persisted media fault");
assert.equal(immutableAuditFailures,1,"The immutable-audit failure fixture must be exercised exactly once");
assert.equal(tables.immutable_audit_events.length,1,"Failed immutable audit inserts do not appear as successful evidence");
assert.equal(tables.observer_intelligence_signals.find(item=>item.id===auditFailureSaved.signal_id).metadata.media_fault.status,"open");

const mediaRoute=load("app/api/video-gateway/cloud-event-media/route.ts",mocks);
async function media(overrides={}) {
  const form=new FormData();
  form.set("metadata",JSON.stringify({gateway_id:gatewayId,observer_site_id:siteId,event_id:criticalSaved.media_event_id,camera_source_id:cameraId,stream_id:"stream",event_type:"drowning_hazard",evidence_kind:"validated_rule",severity:"critical",confidence:.9,captured_at:critical.timestamp,duration_seconds:8,local_capture:true,read_only:true,controls_supported:false,no_dvr_credentials_returned:true,no_rtsp_returned:true,...overrides}));
  form.set("clip",new Blob(["fixture"],{type:"video/mp4"}),"clip.mp4");form.set("thumbnail",new Blob(["fixture"],{type:"image/jpeg"}),"thumb.jpg");
  return mediaRoute.POST(new Request("http://test.invalid/media",{method:"POST",headers:{"x-video-gateway-device-token":token,"x-video-gateway-id":gatewayId,"x-video-gateway-timestamp":new Date().toISOString(),"x-video-gateway-nonce":randomUUID()},body:form}));
}
assert.equal((await media({event_id:randomUUID()})).status,409,"Media cannot originate an unvalidated event");
assert.equal((await media({captured_at:new Date(Date.now()-180000).toISOString()})).status,422,"Unrelated recording is rejected");
assert.equal(uploads,0,"Rejected media is never stored");
criticalSignal.review_status="confirmed";
assert.equal((await media()).status,201);
assert.equal(uploads,2);
assert.equal(criticalSignal.review_status,"confirmed","Media upload preserves human review");
assert.equal(criticalSignal.metadata.first_seen,critical.timestamp);
assert.equal(criticalSignal.metadata.media_status,"available");
assert.equal(criticalSignal.metadata.media_fault.status,"resolved");
assert.equal(audits.filter(item=>item.eventType==="observer_media_fault_resolved").length,1,"Successful media appends a resolved transition without deleting fault history");

tables.digital_observer_camera_sources[0].metadata={gateway_id:gatewayId,gateway_stream_id:"stream",zone_type:"ENTRANCE",crossing_line:{axis:"y",position:.5,inside:"positive"}};
const entered={...event,event_id:randomUUID(),event_type:"person_entered",severity:"CRITICAL",evidence_kind:"line_crossing"};
const enteredSaved=(await (await send(entered)).json()).data;
assert.equal(enteredSaved.recording_required,true,"A verified critical line crossing remains recording-eligible");
assert.equal((await media({event_id:enteredSaved.media_event_id,event_type:"person_entered",evidence_kind:"line_crossing",severity:"critical",captured_at:entered.timestamp})).status,201,"Media upload preserves line-crossing evidence provenance so a real entry is not downgraded to passive media");
assert.equal(uploads,4,"The real-style entry upload persists exactly its clip and thumbnail");
tables.digital_observer_camera_sources[0].metadata={gateway_id:gatewayId,gateway_stream_id:"stream",zone_type:"POOL",verified_event_models:{drowning_hazard:true}};

assert.equal(pushCalls,0,"Push requires explicit recipient/channel opt-in");
tables.observer_alert_channel_settings.push({observer_site_id:siteId,member_profile_id:owner,channel:"push",enabled:true,severity_levels:["critical"]});
await send(critical);
await send(critical);
assert.equal(pushCalls,0,"A recipient preference cannot activate external Push without an authorized PUSH 39 action intent and provider gate");
assert.equal(tables.digital_observer_notification_deliveries.filter(d=>d.channel==="push").length,0,"Raw Event ingestion never bypasses the canonical external-delivery flow");
tables.observer_sites[0].metadata.observer_monitoring_consent=false;
assert.equal((await send({...offHours,event_id:randomUUID()})).status,403,"Off-hours compatibility never bypasses site monitoring consent");
tables.observer_sites[0].metadata.observer_monitoring_consent=true;
tables.digital_observer_camera_sources[0].metadata.monitoring_enabled=false;
assert.equal((await send({...offHours,event_id:randomUUID()})).status,403,"Off-hours compatibility never bypasses per-camera monitoring consent");
tables.digital_observer_camera_sources[0].metadata.monitoring_enabled=true;
tables.video_gateway_device_enrollments[0].status="revoked";
assert.equal((await send(event)).status,401);
assert.equal(tables.observer_intelligence_signals.length,6);
tables.video_gateway_device_enrollments[0].status="delivered";
tables.digital_observer_camera_sources[0].metadata.zone_type="ENTRANCE";
const separateObservation={...event,event_id:randomUUID()};
assert.equal((await send(separateObservation)).status,201,"A distinct event ID remains distinct even at the same camera and timestamp");
assert.equal(tables.observer_intelligence_signals.length,7);
const otherSiteId=randomUUID(),otherCameraId=randomUUID(),otherGatewayId=randomUUID(),otherDeviceId=randomUUID();
const tenantA=randomUUID(),tenantB=randomUUID();
tables.video_gateway_device_enrollments[0].tenant_id=tenantA;
tables.observer_sites[0].owner_profile_id=tenantA;
tables.video_gateway_device_enrollments.push({id:otherDeviceId,gateway_id:otherGatewayId,observer_site_id:otherSiteId,tenant_id:tenantB,status:"delivered"});
tables.observer_sites.push({id:otherSiteId,owner_profile_id:tenantB,garden_id:null,site_type:"home",monitoring_enabled:true,metadata:{observer_monitoring_consent:true}});
tables.observer_site_subscriptions.push({id:randomUUID(),observer_site_id:otherSiteId,commercial_state:"active",entitlement_snapshot:{ai_processing:true,evidence_storage:true,video_retention:24},trial_end:null,grace_period_ends_at:null});
tables.digital_observer_camera_sources.push({id:otherCameraId,observer_site_id:otherSiteId,display_name:"Other entrance",status:"connected",source_mode:"gateway_test",metadata:{gateway_id:otherGatewayId,gateway_stream_id:"stream",zone_type:"ENTRANCE"}});
const otherToken=tokenLib.issueGatewayDeviceAccessToken({device_id:otherDeviceId,gateway_id:otherGatewayId,observer_site_id:otherSiteId},secrets.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET);
assert.equal((await send({...event,camera_source_id:otherCameraId},otherToken)).status,201,"The same producer event ID at another authorized site is independently namespaced");
assert.notEqual(tables.observer_intelligence_signals.at(-1).source_id,tables.observer_intelligence_signals[0].source_id,"Different sites cannot share the durable source key");
assert.equal(tables.observer_intelligence_signals.length,8);
const crossSiteBefore=riskCalls;
const crossSiteReadsBefore=signalReads;
for(const denied of [
  await send({...event,camera_source_id:otherCameraId},token),
  await send({...event,camera_source_id:cameraId},otherToken)
]){
  assert.equal(denied.status,403,"An authorized device cannot claim the other tenant's camera");
  const body=await denied.text();
  assert([siteId,cameraId,otherSiteId,otherCameraId,tenantA,tenantB,"event_summary"].every(value=>!body.includes(value)),"Cross-tenant denial reveals no stored identifiers or metadata");
}
const mismatchedClaim=tokenLib.issueGatewayDeviceAccessToken({device_id:deviceId,gateway_id:gatewayId,observer_site_id:otherSiteId},secrets.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET);
assert.equal((await send({...event,camera_source_id:otherCameraId},mismatchedClaim)).status,401,"The existing enrollment must match the signed Site claim before source lookup");
assert.equal(signalReads,crossSiteReadsBefore,"Source ownership is checked before any replay lookup");
assert.equal(riskCalls,crossSiteBefore,"Cross-tenant requests stop before replay comparison and risk evaluation");

tables.digital_observer_camera_sources[0].metadata.crossing_line={axis:"y",position:.5,inside:"positive"};
tables.digital_observer_camera_sources[1].metadata.crossing_line={axis:"y",position:.5,inside:"positive"};
const sharedProducerEntry={...event,event_id:randomUUID(),event_type:"person_entered",severity:"CRITICAL",evidence_kind:"line_crossing",track_id:"shared-track"};
assert.equal((await send(sharedProducerEntry)).status,201);
assert.equal((await send({...sharedProducerEntry,camera_source_id:otherCameraId},otherToken)).status,201);
const persistedEntries=tables.observer_intelligence_signals.slice(-2);
assert.notEqual(persistedEntries[0].id,persistedEntries[1].id,"One producer ID at two Sites becomes two distinct durable signal IDs");
assert.notEqual(persistedEntries[0].source_id,persistedEntries[1].source_id,"One producer ID at two Sites has separate unique keys");
const {correlateCanonicalEvents}=load("lib/domain/digital-observer/incident-correlation.ts",mocks);
const projected=correlateCanonicalEvents(persistedEntries);
assert.equal(projected.length,2,"The existing incident projector keeps the two Site observations in separate incidents");
assert.notEqual(projected[0].observer_site_id,projected[1].observer_site_id);

const raceEvent={...sharedProducerEntry,event_id:randomUUID(),track_id:"race-track"};
const signalsBeforeRace=tables.observer_intelligence_signals.length;
const deliveriesBeforeRace=tables.digital_observer_notification_deliveries.length;
const riskBeforeRace=riskCalls;
// Two separately loaded route modules model independent workers sharing only
// the database. A process-local promise/map cannot serialize this boundary.
const reloadedRoute=load("app/api/video-gateway/cloud-events/route.ts",mocks,new Map());
raceReads.gate=new Promise(resolve=>{raceReads.release=resolve;});
raceReads.enabled=true;
const [firstRace,secondRace]=await Promise.all([
  send(raceEvent),
  reloadedRoute.POST(new Request("http://test.invalid/api/video-gateway/cloud-events",{
    method:"POST",headers:{"content-type":"application/json","x-video-gateway-device-token":token},body:JSON.stringify(raceEvent)
  }))
]);
assert.deepEqual([firstRace.status,secondRace.status],[201,201],"The mocked unique-key conflict is reread as an idempotent outcome");
assert.equal(raceReads.arrivals,2,"Both requests observed the pre-insert snapshot");
assert.equal(tables.observer_intelligence_signals.length,signalsBeforeRace+1,"The mocked database uniqueness constraint permits one durable signal");
assert.equal(tables.digital_observer_notification_deliveries.length,deliveriesBeforeRace+2,"The existing dedupe key permits one in-app intent per authorized recipient");
const riskEvaluationsDuringRace=riskCalls-riskBeforeRace;
assert.equal(riskEvaluationsDuringRace,2,"Independent route modules recompute Risk twice; database ownership must precede computation");
const notificationCountBeforeReload=tables.digital_observer_notification_deliveries.length;
const reloadedReply=await reloadedRoute.POST(new Request("http://test.invalid/api/video-gateway/cloud-events",{
  method:"POST",headers:{"content-type":"application/json","x-video-gateway-device-token":token},body:JSON.stringify(raceEvent)
}));
assert.equal(reloadedReply.status,201,"A route-module reload can reread the same persisted fixture event");
assert.equal(tables.observer_intelligence_signals.length,signalsBeforeRace+1,"A simulated restart does not insert another signal into the shared fixture store");
assert.equal(tables.digital_observer_notification_deliveries.length,notificationCountBeforeReload,"A simulated restart does not duplicate notification intents");
const detailed={...event,event_id:randomUUID(),confidence:.90005,
  model_provenance:{model:"qa-model",runtime:"local",execution_provider:"local"},
  verification_evidence:{distinct_source_frames:2,directional_confirmations:0,source_sequence:11,source_anchor_verified:true,tracking_duration_ms:100}};
assert.equal((await send(detailed)).status,201);
const detailedSignal=tables.observer_intelligence_signals.at(-1);
detailedSignal.confidence=.9001; // Simulate the existing numeric(5,4) database column.
assert.equal((await send({...detailed,model_provenance:{execution_provider:"local",runtime:"local",model:"qa-model"}})).status,201,"Nested JSON key order and database precision do not invent a replay conflict");
assert.equal((await send({...detailed,verification_evidence:{...detailed.verification_evidence,source_sequence:12}})).status,409,"Changed nested evidence cannot reuse an Event ID");
assert.equal((await send({...detailed,confidence:.9002})).status,409,"A distinct normalized confidence cannot reuse an Event ID");
assert.equal((await send({...detailed,event_id:randomUUID(),confidence:.9002})).status,201,"A replay collision does not suppress a later legitimate Event");
const decimalTie={...event,event_id:randomUUID(),confidence:.55085};
// PostgreSQL numeric(5,4) rounds this decimal tie to .5509; binary
// multiplication by 10,000 instead produces 5508.499999999999.
const signalCountBeforeTie=tables.observer_intelligence_signals.length;
assert.equal((await send(decimalTie)).status,201,"A valid decimal-tie confidence survives its first database round trip");
assert.equal(tables.observer_intelligence_signals.length,signalCountBeforeTie+1);
assert.equal(tables.observer_intelligence_signals.at(-1).confidence,.5509);
assert.equal((await send(decimalTie)).status,201,"A retry compares the database's numeric(5,4) value to the original decimal observation");
assert.equal((await send({...decimalTie,confidence:.5508})).status,409,"A genuinely different confidence remains a conflict after decimal normalization");

// The candidate claim boundary is disabled in the real route. Override only
// its activation export in this disconnected harness; the fenced runner and
// RPC below are synthetic and do not qualify the draft PostgreSQL writers.
let claimedRiskRuns=0, claimedNotificationRuns=0, claimedGuardRuns=0, claimRpcRuns=0;
const syntheticRunner=async claim=>{
  claimedRiskRuns++;
  assert.equal(claim.siteId,siteId);
  assert.equal(claim.engineVersion,"do-risk-v1");
  assert(Number.isSafeInteger(claim.ownerEpoch) && claim.ownerEpoch>0);
  return {status:"not_applicable"};
};
const claimMocks={...mocks,
  "@/lib/domain/digital-observer/event-risk-claim-activation":{
    EVENT_RISK_CLAIM_ACTIVATION:{enabled:true,runner:syntheticRunner}
  },
  "@/lib/domain/event-engine/notifications":{
    recordEventNotifications:async()=>{claimedNotificationRuns++;return {push_pending:false};}
  },
  "@/lib/domain/digital-observer/guard-autonomy-service":{
    dispatchDigitalGuardActionsForValidatedEvent:async()=>{claimedGuardRuns++;return {status:"suppressed"};}
  }
};
const claimRouteA=load("app/api/video-gateway/cloud-events/route.ts",claimMocks,new Map());
const claimRouteB=load("app/api/video-gateway/cloud-events/route.ts",claimMocks,new Map());
const claimSend=(handler,body,auth=token)=>handler.POST(new Request("http://test.invalid/api/video-gateway/cloud-events",{
  method:"POST",headers:{"content-type":"application/json","x-video-gateway-device-token":auth},body:JSON.stringify(body)
}));
const claimEntry=id=>({...sharedProducerEntry,event_id:id,track_id:`claim-${id}`});
const claimBase={risk:claimedRiskRuns,notifications:claimedNotificationRuns,guard:claimedGuardRuns};
const noClaimEffects=()=>{
  assert.equal(claimedRiskRuns,claimBase.risk,"A denied claim cannot calculate Risk");
  assert.equal(claimedNotificationRuns,claimBase.notifications,"A denied claim cannot issue notifications");
  assert.equal(claimedGuardRuns,claimBase.guard,"A denied claim cannot reach Guard eligibility");
};
const {runner:qualifiedRunner}=claimMocks["@/lib/domain/digital-observer/event-risk-claim-activation"].EVENT_RISK_CLAIM_ACTIVATION;
claimMocks["@/lib/domain/digital-observer/event-risk-claim-activation"].EVENT_RISK_CLAIM_ACTIVATION.runner=null;
const noWriterRoute=load("app/api/video-gateway/cloud-events/route.ts",claimMocks,new Map());
assert.equal((await claimSend(noWriterRoute,claimEntry(randomUUID()))).status,500,"Missing fenced writer fails before an RPC claim");
noClaimEffects();
claimMocks["@/lib/domain/digital-observer/event-risk-claim-activation"].EVENT_RISK_CLAIM_ACTIVATION.runner=qualifiedRunner;
assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,500,"Missing claim RPC fails closed");
noClaimEffects();
db.rpc=async()=>{claimRpcRuns++;return {data:null,error:{code:"RISK_TENANT_MAPPING_UNVERIFIED"}};};
assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,500,"An unverified Tenant mapping cannot enter Risk");
noClaimEffects();
assert.equal((await claimSend(claimRouteA,{...claimEntry(randomUUID()),camera_source_id:otherCameraId})).status,403,"A wrong-Site camera is denied before claim");
noClaimEffects();
db.rpc=async()=>{claimRpcRuns++;return {data:{kind:"OWNED",owner_epoch:1,lease_expires_at:new Date(Date.now()-1000).toISOString()},error:null};};
assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,500,"An expired owner lease cannot start Risk");
noClaimEffects();
db.rpc=async()=>{claimRpcRuns++;return {data:{kind:"BUSY",retry_after:new Date(Date.now()+30000).toISOString()},error:null};};
assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,202,"A BUSY contender is deferred before downstream effects");
noClaimEffects();
for(const kind of ["RESUME_EFFECTS","COMPLETED"]){
  db.rpc=async()=>{claimRpcRuns++;return {data:{kind,evaluation_id:randomUUID()},error:null};};
  assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,500,`${kind} needs a separate durable recovery reader`);
  noClaimEffects();
}
db.rpc=async()=>{claimRpcRuns++;return {data:{kind:"NOT_APPLICABLE"},error:null};};
assert.equal((await claimSend(claimRouteA,claimEntry(randomUUID()))).status,500,"An entry cannot be downgraded to no-Incident Risk");
noClaimEffects();
const syntheticClaims=new Set();
db.rpc=async(name,args)=>{
  claimRpcRuns++;
  assert.equal(name,"claim_event_risk_v1");
  assert.equal(args.p_engine_version,"do-risk-v1");
  assert.equal(args.p_lease_seconds,30);
  assert.equal(typeof args.p_owner_nonce,"string");
  if(syntheticClaims.has(args.p_signal_id)) return {data:{kind:"BUSY",retry_after:new Date(Date.now()+30000).toISOString()},error:null};
  syntheticClaims.add(args.p_signal_id);
  return {data:{kind:"OWNED",owner_epoch:1,lease_expires_at:new Date(Date.now()+30000).toISOString()},error:null};
};
const claimedEvent=claimEntry(randomUUID());
const recipientsBeforeClaim=structuredClone(tables.digital_observer_authorized_recipients);
const legacyRiskBeforeClaim=riskCalls;
raceReads.arrivals=0;
raceReads.gate=new Promise(resolve=>{raceReads.release=resolve;});
raceReads.enabled=true;
const claimReplies=await Promise.all([claimSend(claimRouteA,claimedEvent),claimSend(claimRouteB,claimedEvent)]);
assert.deepEqual(claimReplies.map(reply=>reply.status).sort(),[201,202],"Two route modules admit one synthetic owner and defer the contender");
assert.equal(raceReads.arrivals,2);
assert.equal(claimedRiskRuns,1,"Only the valid synthetic claim owner reaches the fenced Risk runner");
assert.equal(claimedNotificationRuns,1,"BUSY does not enter recipient effects");
assert.equal(claimedGuardRuns,1,"BUSY does not enter Guard eligibility");
assert.equal(riskCalls,legacyRiskBeforeClaim,"The isolated candidate never uses the unfenced legacy Risk writer");
assert.deepEqual(tables.digital_observer_authorized_recipients,recipientsBeforeClaim,"Claim retry never mutates recipient ownership");
assert.equal((await claimSend(claimRouteB,claimedEvent)).status,202,"A retry cannot acquire a second synthetic owner");
assert.equal(claimedRiskRuns,1);
assert.equal(claimedNotificationRuns,1);
assert.equal(claimedGuardRuns,1);
delete db.rpc;
console.log(JSON.stringify({isolatedClaimBoundary:{routeModules:2,owned:1,deferred:1,claimedRiskRuns,claimRpcRuns,liveEnabled:false,postgresqlIntegration:false}}));
console.log(JSON.stringify({localRace:{accepted:2,durableSignals:1,inAppIntents:2,riskEvaluations:riskEvaluationsDuringRace,database:"mocked_unique_constraint",routeModules:2,postgresqlIntegration:false}}));
console.log("Event ingestion checks passed: token validation, revocation, scope, consent, immutable replay identity, Site-scoped tenant denial, mocked race behavior, event/notification idempotency, spatial and specialized evidence, no-clip events, validated-only media, capture window and review preservation.");

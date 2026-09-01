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
  digital_observer_camera_sources:[{id:cameraId,observer_site_id:siteId,display_name:"כניסה",status:"connected",source_mode:"gateway_test",metadata:{gateway_id:gatewayId,gateway_stream_id:"stream",zone_type:"ENTRANCE"}}],
  observer_monitoring_schedules:[{observer_site_id:siteId,status:"active",timezone:"UTC",schedule:{quiet_hours:{start:"00:00",end:"06:00"}}}],
  observer_intelligence_signals:[], digital_observer_authorized_recipients:[], observer_alert_channel_settings:[],
  digital_observer_notification_deliveries:[], provider_webhook_events:[], digital_observer_event_clips:[], immutable_audit_events:[]
};
let failImmutableAuditWrites=false, immutableAuditFailures=0;
class Query {
  constructor(table){this.table=table;this.filters=[];}
  select(){return this;}
  eq(key,val){this.filters.push(row=>row[key]===val);return this;}
  insert(row){this.insertion=row;return this;}
  update(row){this.patch=row;return this;}
  then(resolve,reject){return this.execute(false).then(resolve,reject);}
  async maybeSingle(){return this.single();}
  async single(){return this.execute(true);}
  async execute(single){
    if(this.insertion){
      if(this.table==="immutable_audit_events" && failImmutableAuditWrites) return {data:null,error:{code:"FIXTURE_AUDIT_FAILURE",message:"fixture audit failure"}};
      if(this.insertion.dedupe_key && tables[this.table].some(row=>row.dedupe_key===this.insertion.dedupe_key)) return {data:null,error:{code:"23505"}};
      const row={id:randomUUID(),...this.insertion};tables[this.table].push(row);return {data:single?row:[row],error:null};
    }
    const rows=tables[this.table]?.filter(row=>this.filters.every(f=>f(row)))??[];
    if(this.patch) for(const row of rows) Object.assign(row,this.patch);
    return {data:single?rows[0]??null:rows,error:null};
  }
}
let uploads=0;
const db={from:table=>new Query(table),storage:{from:()=>({upload:async()=>{uploads++;return {error:null};}})}};
let pushCalls=0, pushStatus="sent";
const audits=[];
const mocks={"@/lib/supabase/admin":{createAdminClient:()=>db},"@/lib/api":{
  ok:(data,status=200)=>Response.json({data},{status}),fail:(error,status=400)=>Response.json({error},{status}),handleRouteError:()=>Response.json({error:"route_failure"},{status:500})
},"@/lib/domain/push-service":{preparePushForNotification:async()=>{pushCalls++;return {logs:pushStatus?[{status:pushStatus}]:[],error:null};}},
"@/lib/security/audit-log-service":{writeAuditEvent:async input=>{
  const result=await db.from("immutable_audit_events").insert(input);
  if(result.error){immutableAuditFailures++;return;}
  audits.push(input);
}},"server-only":{}};
const tokenLib=load("lib/domain/gateway-device-enrollment.ts",mocks);
const token=tokenLib.issueGatewayDeviceAccessToken({device_id:deviceId,gateway_id:gatewayId,observer_site_id:siteId},secrets.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET);
const route=load("app/api/video-gateway/cloud-events/route.ts",mocks);
const event={event_id:randomUUID(),camera_source_id:cameraId,stream_id:"stream",event_type:"person_detected",severity:"INFO",confidence:.9,timestamp:new Date().toISOString(),evidence_kind:"object_detection"};
const send=(body,auth=token)=>route.POST(new Request("http://test.invalid/api/video-gateway/cloud-events",{method:"POST",headers:{"content-type":"application/json","x-video-gateway-device-token":auth},body:JSON.stringify(body)}));
assert.equal((await send(event,"invalid")).status,401);
assert.equal((await send({...event,camera_source_id:randomUUID()})).status,403);
assert.equal((await send({...event,stream_id:"other"})).status,403);
let response=await send(event);assert.equal(response.status,201);
let value=(await response.json()).data;assert.equal(value.recording_required,true,"Entrance person evidence must retain event media");assert.equal(tables.observer_intelligence_signals.length,1);
assert.equal((await send(event)).status,201);assert.equal(tables.observer_intelligence_signals.length,1,"Retries must not insert a second event");
assert.equal((await send({...event,event_id:randomUUID(),timestamp:new Date(Date.now()-2*86400000).toISOString()})).status,201,"An authenticated backlog older than one day must not be lost");
assert.equal(tables.observer_intelligence_signals[1].metadata.received_late,true);
assert.equal((await send({...event,event_id:randomUUID(),timestamp:new Date(Date.now()+180000).toISOString()})).status,422);
assert.equal((await send({...event,timestamp:new Date(Date.now()-30000).toISOString()})).status,409,"An id cannot be reused for a different observation");
assert.equal((await send({...event,event_type:"person_entered",evidence_kind:"line_crossing"})).status,202,"Direction requires a configured line");
tables.digital_observer_camera_sources[0].metadata.crossing_line={axis:"x",position:.5,inside:"positive"};
const entrySaved=(await (await send({...event,event_id:randomUUID(),event_type:"person_entered",evidence_kind:"line_crossing"})).json()).data;
assert.equal(entrySaved.recording_required,true,"Verified entrance crossing must retain event media");
delete tables.digital_observer_camera_sources[0].metadata.crossing_line;
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
tables.digital_observer_camera_sources[0].metadata.zone_type="INDOOR";
const indoorPerson=(await (await send({...event,event_id:randomUUID()})).json()).data;
assert.equal(indoorPerson.recording_required,false,"Ordinary indoor person detection remains passive and no-recording");
tables.digital_observer_camera_sources[0].metadata.zone_type="POOL";
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
  form.set("metadata",JSON.stringify({gateway_id:gatewayId,observer_site_id:siteId,event_id:criticalSaved.media_event_id,camera_source_id:cameraId,stream_id:"stream",event_type:"drowning_hazard",severity:"critical",confidence:.9,captured_at:critical.timestamp,duration_seconds:8,local_capture:true,read_only:true,controls_supported:false,no_dvr_credentials_returned:true,no_rtsp_returned:true,...overrides}));
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
assert.equal(pushCalls,0,"Push requires explicit recipient/channel opt-in");
tables.observer_alert_channel_settings.push({observer_site_id:siteId,member_profile_id:owner,channel:"push",enabled:true,severity_levels:["critical"]});
await send(critical);
await send(critical);
assert.equal(pushCalls,1,"Repeated delivery requests must not resend an accepted Push");
assert.equal(tables.digital_observer_notification_deliveries.filter(d=>d.channel==="push"&&d.delivery_status==="sent").length,1);
pushStatus="sent_mock";
await send({...critical,event_id:randomUUID()});
assert.equal(tables.digital_observer_notification_deliveries.filter(d=>d.channel==="push"&&d.delivery_status==="mocked"&&d.sent_at===null).length,1,"Mock provider acceptance cannot appear as a real sent notification");
pushStatus="";
const failedPushEvent={...critical,event_id:randomUUID()};
const failedPushSaved=(await (await send(failedPushEvent)).json()).data;
assert.equal(failedPushSaved.notifications_pending,true);
const failedDelivery=tables.digital_observer_notification_deliveries.find(d=>d.signal_id===failedPushSaved.signal_id&&d.channel==="push");
failedDelivery.next_retry_at=null;
assert.equal((await (await send(failedPushEvent)).json()).data.notifications_pending,true);
failedDelivery.next_retry_at=null;
assert.equal((await (await send(failedPushEvent)).json()).data.notifications_pending,false);
assert.equal(failedDelivery.attempt_count,3);
assert.equal(failedDelivery.delivery_status,"failed");
tables.observer_sites[0].metadata.observer_monitoring_consent=false;
assert.equal((await send({...offHours,event_id:randomUUID()})).status,403,"Off-hours compatibility never bypasses site monitoring consent");
tables.observer_sites[0].metadata.observer_monitoring_consent=true;
tables.digital_observer_camera_sources[0].metadata.monitoring_enabled=false;
assert.equal((await send({...offHours,event_id:randomUUID()})).status,403,"Off-hours compatibility never bypasses per-camera monitoring consent");
tables.digital_observer_camera_sources[0].metadata.monitoring_enabled=true;
tables.video_gateway_device_enrollments[0].status="revoked";
assert.equal((await send(event)).status,401);
assert.equal(tables.observer_intelligence_signals.length,9);
console.log("Event ingestion checks passed: token validation, revocation, scope, consent, event/notification idempotency, spatial and specialized evidence, no-clip events, validated-only media, capture window and review preservation.");

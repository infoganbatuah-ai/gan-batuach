import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { JournalTracker, sampleAllCameras } from "../../services/video-gateway/journal-tracker.mjs";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) {
      const url = new URL(specifier + ".ts", context.parentURL);
      if (existsSync(url)) return {url:url.href, shortCircuit:true};
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {format:"module",shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText};
    return next(url,context);
  }
});
const { cameraZoneMapper } = await import("../../lib/domain/event-engine/camera-zone-mapper.ts");
const { eventValidationPipeline } = await import("../../lib/domain/event-engine/event-validation-pipeline.ts");
const { eventJournalService } = await import("../../lib/domain/event-engine/event-journal-service.ts");
const { mediaFaultLifecycle, openMediaFault, resolveMediaFault, waiveMediaFault } = await import("../../lib/domain/event-engine/media-fault-lifecycle.ts");
const { preserveCameraDiscoverySettings } = await import("../../lib/domain/event-engine/discovery-settings.ts");
const { scheduleIsOffHours } = await import("../../lib/domain/event-engine/off-hours.ts");
const quietSchedule = { timezone:"Asia/Jerusalem", schedule:{quiet_hours:{start:"23:00",end:"06:00"}} };
assert.equal(scheduleIsOffHours(quietSchedule,new Date("2026-08-31T23:30:00Z")),true,"02:30 Jerusalem is inside overnight quiet hours");
assert.equal(scheduleIsOffHours(quietSchedule,new Date("2026-08-31T09:00:00Z")),false,"12:00 Jerusalem is outside quiet hours");
assert.equal(scheduleIsOffHours({timezone:"Invalid/Zone",schedule:{quiet_hours:{start:"23:00",end:"06:00"}}}),false,"Invalid tenant timezones fail closed");
assert.equal(scheduleIsOffHours({timezone:"UTC",schedule:{quiet_hours:{start:"bad",end:"06:00"}}}),false,"Invalid schedules fail closed");
const preserved=preserveCameraDiscoverySettings({observer_site_id:"site",display_name:"בריכה",status:"disabled",monitoring_targets:[],metadata:{zone_type:"POOL",monitoring_enabled:false,crossing_line:{axis:"x",position:.5,inside:"positive"}}},{observer_site_id:"site",display_name:"DVR ערוץ 5",status:"connected",metadata:{gateway_stream_id:"stream"}});
assert.equal(preserved.display_name,"בריכה");
assert.equal(preserved.status,"disabled");
assert.equal(preserved.metadata.zone_type,"POOL");
assert.equal(preserved.metadata.monitoring_enabled,false);
assert(preserved.metadata.crossing_line);
assert.deepEqual(preserved.monitoring_targets,[]);
assert.throws(()=>preserveCameraDiscoverySettings({observer_site_id:"other"},{observer_site_id:"site"}));
const pool = {id:"pool",display_name:"מצלמת בריכה",metadata:{zone_type:"POOL"}};
assert.equal(cameraZoneMapper.map(pool).camera_name,"מצלמת בריכה");
assert.equal(cameraZoneMapper.map(pool).zone_type,"POOL");
assert.equal(cameraZoneMapper.map({id:"x",display_name:"Indoor camera"}).zone_type,"INDOOR");
assert.equal(cameraZoneMapper.map({id:"x",display_name:"Pool entrance"}).source,"default");
assert.equal(eventValidationPipeline.validate({event_type:"vehicle_entered",confidence:.9},pool).accepted,false);
assert.equal(eventValidationPipeline.validate({event_type:"pool_entry"},pool).accepted,false,"Pool entry is not proof of off-hours activity");
assert.equal(eventValidationPipeline.validate({event_type:"person_detected",confidence:NaN},{id:"a"}).accepted,false);
assert.equal(eventValidationPipeline.validate({event_type:"vehicle_entered"},{id:"unknown"}).accepted,false);
assert.equal(eventValidationPipeline.validate({event_type:"person_entered"},{id:"a",metadata:{zone_type:"ENTRANCE"}}).shouldRecord,false);
assert.equal(eventValidationPipeline.validate({event_type:"person_entered",severity:"CRITICAL"},{id:"a",metadata:{zone_type:"ENTRANCE"}}).shouldRecord,false,"Passive detections cannot force recording by inflating severity");
assert.equal(eventValidationPipeline.validate({event_type:"person_entered",evidence_kind:"line_crossing",severity:"CRITICAL"},{id:"a",metadata:{zone_type:"ENTRANCE"}}).shouldRecord,true,"A critical line crossing remains critical before the separate line-geometry gate");
assert.equal(eventValidationPipeline.validate({event_type:"drowning_hazard",severity:"critical"},pool).shouldRecord,true);

const at = n=>new Date(Date.UTC(2026,7,31,10,0,n)).toISOString();
const row = (camera,sec,extra={})=>({id:camera+sec,observer_site_id:"site",source_type:"system",created_at:at(sec),signal_type:"ai_camera",severity:"info",metadata:{camera_source_id:camera,event_type:"person_detected",recording_required:false,validated_event:true},...extra});
const grouped=eventJournalService.group([row("a",0),row("b",1),row("a",80),row("a",160)]);
assert.equal(grouped.length,2,"Continuous activity merges without merging different cameras");
assert.equal(grouped.find(r=>r.camera_id==="a").count,3);
assert.equal(eventJournalService.group([
  row("a",0,{metadata:{camera_source_id:"a",event_type:"person_detected",track_id:"track-1",recording_required:false}}),
  row("a",300,{metadata:{camera_source_id:"a",event_type:"person_detected",track_id:"track-2",recording_required:false}})
]).length,1,"Continuous presence remains one incident when the detector changes track IDs");
assert.equal(grouped[0].event_type,"person_detected");
assert.equal(grouped[0].recording_url,null);
assert.equal(eventJournalService.group([row("a",0),row("a",1,{observer_site_id:"other"})]).length,2);
assert.equal(eventJournalService.group([row("a",0,{created_at:"invalid"})]).length,0);
assert.equal(eventJournalService.group([row("a",0,{metadata:{event_type:"camera_media_readiness"}})]).length,0,"Readiness probes are not security events");
const stronger=eventJournalService.group([row("a",0,{severity:"critical"}),row("a",10)]);
assert.equal(stronger[0].severity,"CRITICAL");
const offline=(camera,sec)=>row(camera,sec,{severity:"medium",metadata:{camera_source_id:camera,event_type:"camera_offline",recording_required:false}});
const collapsedRows=eventJournalService.groupRows([
  {...offline("a",0),review_status:"confirmed"},
  {...offline("a",3600),review_status:"needs_review"},
  {...offline("a",7200),review_status:"escalated"}
]);
const collapsedOffline=collapsedRows.map(item=>eventJournalService.normalize(item));
assert.equal(collapsedOffline.length,1,"One unresolved outage remains one journal incident across process restarts");
assert.equal(collapsedOffline[0].count,3);
assert.equal(collapsedRows[0].metadata.outage_status,"open");
assert.equal(collapsedRows[0].metadata.outage_started_at,at(0));
assert.equal(collapsedRows[0].metadata.outage_last_observed_at,at(7200));
assert.deepEqual(new Set(collapsedRows[0].metadata.journal_review_statuses),new Set(["confirmed","needs_review","escalated"]),"Coalescing does not erase historical review states");
const reconnected=row("a",1800,{metadata:{camera_source_id:"a",event_type:"camera_reconnected",recording_required:false}});
assert.equal(eventJournalService.group([offline("a",0),reconnected,offline("a",3600)]).filter(event=>event.event_type==="camera_offline").length,2,"A reconnect separates two outage incidents");
const outageEpisodes=eventJournalService.groupRows([offline("a",0),offline("a",900),reconnected,offline("a",3600)])
  .filter(item=>item.metadata.event_type==="camera_offline");
assert.equal(outageEpisodes.find(item=>item.metadata.outage_status==="resolved")?.metadata.outage_recovered_at,at(1800),"Resolved outage preserves the recovery boundary");
assert.equal(outageEpisodes.find(item=>item.metadata.outage_status==="open")?.metadata.outage_recovered_at,undefined,"The newest unresolved outage remains open");

const legacyFault=mediaFaultLifecycle({media_status:"missing",media_missing_reason:"capture_failed",first_seen:at(0)},at(1));
assert.equal(legacyFault.status,"open","Historical media faults are projected into the explicit lifecycle");
const openedFault=openMediaFault({media_status:"pending"},"capture_failed",at(2));
assert.equal(openedFault.transition,"opened");
assert.equal(openedFault.fault.status,"open");
const repeatedFault=openMediaFault(openedFault.metadata,"capture_failed",at(3));
assert.equal(repeatedFault.transition,"unchanged");
assert.equal(repeatedFault.fault.occurrences,2,"Repeated capture failure updates one open fault instead of inventing another");
const waivedFault=waiveMediaFault(repeatedFault.metadata,at(4),"בדיקה אנושית");
assert.equal(waivedFault.fault.status,"waived");
const resolvedFault=resolveMediaFault(waivedFault.metadata,at(5));
assert.equal(resolvedFault.transition,"resolved","Late media can resolve a previously waived fault without deleting its waiver timestamp");
assert.equal(resolvedFault.fault.waived_at,at(4));
const wrongPoolEvent=row("pool",0,{review_status:"confirmed",metadata:{camera_source_id:"pool",event_type:"vehicle_detected",zone_type:"PARKING",track_id:"old-car",recording_required:false}});
const originalPoolEvent=JSON.stringify(wrongPoolEvent);
const partition=eventJournalService.partitionRows([wrongPoolEvent],[pool]);
assert.equal(partition.events.length,0,"A legacy car in a confirmed pool must not appear as a valid journal event");
assert.equal(partition.spatialMismatches.length,1,"An incompatible historical record remains inspectable");
assert.equal(partition.spatialMismatches[0].review_status,"confirmed","Read-time spatial checks must not rewrite human decisions");
assert.equal(partition.spatialMismatches[0].metadata.zone_type,"PARKING","Original recorded context remains auditable");
assert.equal(partition.spatialMismatches[0].metadata.journal_spatial_mismatch.zone_type,"POOL");
assert.equal(JSON.stringify(wrongPoolEvent),originalPoolEvent,"Input history must not be mutated");
assert.equal(eventJournalService.groupRows([wrongPoolEvent],[pool]).length,0,"Chat and default consumers use the clean partition");
assert.equal(eventJournalService.groupRows([{...wrongPoolEvent,metadata:{...wrongPoolEvent.metadata,validated_event:true}}],[pool]).length,1,"A validated historical parking event is not reclassified after moving its camera");
assert.equal(eventJournalService.groupRows([wrongPoolEvent],[{...pool,observer_site_id:"other"}]).length,1,"Other sites cannot supply camera mapping");
assert.equal(eventJournalService.groupRows([wrongPoolEvent],[{...pool,metadata:{zone_type:"PARKING"}}]).length,1,"A generic legacy car sighting remains a sighting in parking, not a crossing");
assert.equal(eventJournalService.groupRows([{...wrongPoolEvent,metadata:{...wrongPoolEvent.metadata,event_type:"car_entered"}}],[pool]).length,0,"Aliases use the same spatial rules");
assert.equal(eventJournalService.groupRows([{...wrongPoolEvent,metadata:{...wrongPoolEvent.metadata,event_type:"camera_offline"}}],[pool]).length,1,"Camera health remains valid in every zone");
assert.equal(eventJournalService.groupRows([{...wrongPoolEvent,metadata:{...wrongPoolEvent.metadata,event_type:"drowning_hazard"}}],[pool]).length,1,"Legitimate pool hazards must not be hidden");
assert.equal(eventJournalService.groupRows([{...wrongPoolEvent,metadata:{...wrongPoolEvent.metadata,event_type:"drowning_hazard",journal_spatial_mismatch:{zone_type:"PARKING"}}}],[pool]).length,1,"Persisted presentation flags are recomputed");

const camera={camera_id:"a",stream_id:"stream-a",zone_type:"ENTRANCE",monitoring_enabled:true,allowed_event_types:["person_detected","person_entered","person_exited"],supported_event_types:["person_detected","person_entered","person_exited"],critical_event_types:["person_entered"],crossing_line:{axis:"x",position:.5,inside:"positive"}};
const detect=x=>[{label:"person",confidence:.9,box:[.1,x-.05,.4,x+.05]}];
const tracker=new JournalTracker({cooldownMs:10_000});
let events=[];
const positions=[.35,.35,.35,.43,.48,.52,.57,.65,.65,.65];
positions.forEach((x,i)=>events.push(...tracker.observe(camera,detect(x),at(i*3))));
assert.equal(events.filter(e=>e.event_type==="person_entered").length,1);
assert.equal(events.find(e=>e.event_type==="person_entered")?.severity,"CRITICAL");
assert.equal(events.filter(e=>e.event_type==="person_detected").length,1);
const yLineCrossing={...camera,crossing_line:{axis:"y",position:.5,inside:"positive"}};
const yBox=center=>[{label:"person",confidence:.92,box:[center-.1,.4,center+.1,.6]}];
const bridgedCrossing=new JournalTracker({personConfirmations:2});
const bridgedEvents=[];
[.30,.31,.32,.68,.69,.70].forEach((center,index)=>bridgedEvents.push(...bridgedCrossing.observe(yLineCrossing,yBox(center),new Date(Date.parse(at(60))+index*500).toISOString())));
assert.equal(bridgedEvents.filter(event=>event.event_type==="person_entered").length,1,"A confirmed same-person jump across the y-line retains the track and qualifies entry");
assert.equal(new Set(bridgedEvents.map(event=>event.track_id)).size,1,"Crossing continuity bridge must retain one track ID");
assert.equal(tracker.observe(camera,[],at(40)).length,0,"Disappearance is not an exit");
assert.equal(tracker.observe({...camera,camera_id:"b"},detect(.65),at(45)).length,0,"Other cameras cannot reuse tracks");
assert.equal(tracker.observe(camera,detect(.35),at(15)).length,0,"Out-of-order samples are ignored");
const exitTracker=new JournalTracker({cooldownMs:10_000});
const exitEvents=[];
// Three stable samples per side are required: an approach alone, two samples,
// or jitter around the dead-band must not manufacture a directional exit.
[.65,.66,.67,.57,.45,.35,.34,.33].forEach((x,i)=>exitEvents.push(...exitTracker.observe(camera,detect(x),at(100+i*3))));
assert.equal(exitEvents.filter(event=>event.event_type==="person_entered").length,0,"Starting inside must not create a synthetic entry");
assert.equal(exitEvents.filter(event=>event.event_type==="person_exited").length,1,"Three unique stable observations on the outward side create one exit");
assert.equal(exitEvents.find(event=>event.event_type==="person_exited")?.track_id,exitEvents.find(event=>event.event_type==="person_detected")?.track_id,"Presence and exit retain one track");
const twoSampleExit=new JournalTracker({cooldownMs:10_000});
const twoSampleEvents=[];
[.65,.66,.67,.45,.35].forEach((x,i)=>twoSampleEvents.push(...twoSampleExit.observe(camera,detect(x),at(140+i*3))));
assert.equal(twoSampleEvents.some(event=>event.event_type==="person_exited"),false,"Two outward samples cannot satisfy the exit contract");
const noCrossExit=new JournalTracker();
const noCrossEvents=[];
[.65,.66,.67,.55,.52,.49,.47].forEach((x,i)=>noCrossEvents.push(...noCrossExit.observe(camera,detect(x),at(160+i*3))));
assert.equal(noCrossEvents.some(event=>event.event_type==="person_exited"),false,"Approaching the line without three outer-side samples is not an exit");
const stationary=new JournalTracker();
for(let i=0;i<15;i++) assert.equal(stationary.observe(camera,detect(.49+(i%2)*.02),at(i)).filter(e=>e.event_type.endsWith("entered")||e.event_type.endsWith("exited")).length,0);
const noLine=new JournalTracker();
const noLineEvents=[];
positions.forEach((x,i)=>noLineEvents.push(...noLine.observe({...camera,crossing_line:null},detect(x),at(i))));
assert.equal(noLineEvents.some(e=>e.event_type==="person_entered"),false);
const coverage=await sampleAllCameras(Array.from({length:16},(_,i)=>({...camera,camera_id:String(i)})), async c=>{if(c.camera_id==="0")throw Error("offline");return [];},async()=>{});
assert.equal(coverage.length,16);
assert.equal(coverage.filter(r=>r.status==="sampled").length,15);
console.log("Event journal checks passed: spatial rules, confidence, continuous-presence and durable-outage grouping, severity, camera/site isolation, directional evidence, failure-isolated 16-camera coverage.");

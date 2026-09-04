import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadTs } from "./digital-guard-test-loader.mjs";

const siteId="00000000-0000-4000-8000-000000000001", cameraId="00000000-0000-4000-8000-000000000002", otherId="00000000-0000-4000-8000-000000000003";
const site={id:siteId,site_type:"home",timezone:"Asia/Jerusalem"};
const cameras=[{id:cameraId,observer_site_id:siteId,display_name:"דלת ראשית",location_label:"כניסה",metadata:{zone_type:"ENTRANCE",aliases:["front door"]}}];
const module=loadTs("lib/domain/event-engine/guard-journal-search.ts");
const context={...module.guardContextForSite(site,cameras),now:new Date("2026-08-31T12:00:00Z")};
const input={cameraZoneName:"front door",window:{kind:"date",date:"2026-08-31",fromTime:"14:00",toTime:"17:00"},eventTypes:["ENTRY"],reviewStatuses:["needs_review"]};
function signal(id,time="2026-08-31T12:00:00Z",extra={}) {return {id,observer_site_id:siteId,camera_id:cameraId,created_at:time,severity:"info",review_status:"needs_review",metadata:{camera_source_id:cameraId,event_type:"person_entered",validated_event:true,recording_required:false,first_seen:time,received_at:"2026-09-02T12:00:00Z"},...extra};}
function fixture(current=[],legacy=[],status=200) {
  const requests=[];
  const db=createClient("http://fixture.invalid","fixture-not-a-real-key",{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(resource,options)=>{
    const url=new URL(resource);requests.push(url);
    assert.equal(options.method,"GET","History must never write data");
    assert.equal(url.searchParams.get("observer_site_id"),`eq.${siteId}`);
    if(url.pathname.endsWith("digital_observer_camera_sources")) return Response.json(cameras);
    assert(["observer_intelligence_signals","digital_observer_event_clips"].some(name=>url.pathname.endsWith(name)),"No hardware or unrelated table access");
    if(status!==200)return Response.json({message:"fixture database failure",code:"XX000"},{status});
    return Response.json(url.pathname.endsWith("observer_intelligence_signals")?current:legacy);
  }}});
  return {db,requests};
}

test("closed domain mapping covers every public type and never equates sightings with crossings",()=>{
  assert.equal(Object.keys(module.GUARD_STORAGE_EVENT_TYPES).length,10);
  assert(module.guardStorageEventTypes(["VEHICLE_IN"]).includes("car_entered"));
  assert(!module.guardStorageEventTypes(["ENTRY"]).includes("person_detected"));
  assert(!module.guardStorageEventTypes(["VEHICLE_IN"]).includes("vehicle_detected"));
  assert.throws(()=>module.guardStorageEventTypes(["metadata.eq.anything"]),/UNKNOWN_EVENT_TYPE/);
});
test("real PostgREST builders apply scoped time/type/review filters before the cap",async()=>{
  const {db,requests}=fixture([signal("one")]);
  const result=await module.searchGuardJournal(db,input,context,cameras);
  assert.equal(result.events.length,1);assert.equal(result.events[0].timestamp,"2026-08-31T12:00:00.000Z");
  assert.equal(result.coverage.hardware_actions,0);assert.equal(requests.length,2);
  for(const url of requests){
    const legacy=url.pathname.endsWith("digital_observer_event_clips");
    const time=legacy?"captured_at":"created_at";
    assert.deepEqual(url.searchParams.getAll(time),["gte.2026-08-31T11:00:00.000Z","lt.2026-08-31T14:00:00.000Z"]);
    assert.equal(url.searchParams.get(legacy?"signal.review_status":"review_status"),"in.(needs_review)");
    const filters=url.searchParams.getAll(legacy?"signal.or":"or").join(" ");
    assert(filters.includes("person_entered"));
    if(legacy) assert.equal(url.searchParams.get("camera_source_id"),`eq.${cameraId}`);else assert(filters.includes(cameraId));
    const keys=[...url.searchParams.keys()];assert(keys.indexOf("limit")>keys.indexOf(time));assert.equal(url.searchParams.get("limit"),"1001");
  }
});
test("legacy captured time wins over later ingestion, and missing observation time is explicit",async()=>{
  const row=signal("legacy","2026-09-02T20:00:00Z",{metadata:{event_type:"entry",camera_source_id:cameraId}});
  const clip={id:"clip",observer_site_id:siteId,camera_source_id:cameraId,signal_id:row.id,captured_at:"2026-08-31T11:30:00Z",clip_status:"available",signal:row};
  const {db}=fixture([], [clip]);
  const result=await module.searchGuardJournal(db,input,context,cameras);
  assert.equal(result.events[0].timestamp,"2026-08-31T11:30:00.000Z");
  assert.equal(result.events[0].recording_url,"/api/digital-observer/event-clips/clip/media?kind=clip");
  assert.equal(result.coverage.legacy_without_observation_time_excluded,true);
  row.camera_id=null;delete row.metadata.camera_source_id;
  assert.equal((await module.searchGuardJournal(db,input,context,cameras)).events[0].camera_id,cameraId,"A same-site clip foreign key can supply the missing legacy source even when a camera filter is selected");
});
test("exclusive upper bound, tenant, source, type and review status are rechecked",async()=>{
  const good=signal("good","2026-08-31T11:00:00Z");
  const invalid=[signal("upper","2026-08-31T14:00:00Z"),signal("foreign",undefined,{observer_site_id:otherId}),
    signal("source",undefined,{metadata:{...good.metadata,camera_source_id:otherId}}),
    signal("type",undefined,{metadata:{...good.metadata,event_type:"vehicle_detected"}}),signal("review",undefined,{review_status:"confirmed"})];
  const {db}=fixture([good,...invalid]);const result=await module.searchGuardJournal(db,input,context,cameras);
  assert.deepEqual(result.events.map(row=>row.id),["good"]);assert.equal(result.coverage.invalid_evidence_excluded,5);
});
test("current capture links match source and passive events keep null recordings",async()=>{
  const current=signal("capture",undefined,{metadata:{event_type:"person_entered",camera_source_id:cameraId,validated_event:true,first_seen:"2026-08-31T12:00:00Z",recording_required:true},clip:[{id:"current-clip",signal_id:"capture",observer_site_id:siteId,camera_source_id:cameraId,clip_status:"available"}]});
  const {db}=fixture([current]);assert.match((await module.searchGuardJournal(db,input,context,cameras)).events[0].recording_url,/current-clip/);
  current.metadata.recording_required=false;assert.equal((await module.searchGuardJournal(db,input,context,cameras)).events[0].recording_url,null);
});
test("empty results do not claim continuous coverage; database failures are not empty success",async()=>{
  const {db}=fixture();const result=await module.searchGuardJournal(db,input,context,cameras);
  assert.equal(result.events.length,0);assert.match(module.guardJournalAnswer(result),/לא נמצאו/);assert.equal(result.coverage.continuous_analysis_verified,false);
  await assert.rejects(()=>module.searchGuardJournal(fixture([],[],503).db,input,context,cameras),/UNAVAILABLE/);
});
test("same-name, wrong-site and invalid-range requests fail before any event fetch",async()=>{
  const {db,requests}=fixture();
  for(const bad of [{...input,cameraSourceId:otherId},{...input,window:{kind:"instant",from:"2026-08-31T14:00:00Z",to:"2026-08-31T11:00:00Z"}}]) await assert.rejects(()=>module.searchGuardJournal(db,bad,context,cameras));
  await assert.rejects(()=>module.searchGuardJournal(db,input,{...context,cameras:[...context.cameras,{...context.cameras[0],id:otherId}]},cameras),/AMBIGUOUS/);
  assert.equal(requests.length,0);
});
test("bounded Hebrew history parser resolves aliases and never consumes commands",()=>{
  const parsed=module.guardHistoryInput("מי נכנס אתמול בכניסה בין 14:00 ל-17:00",context);
  assert.equal(parsed.cameraZoneName,"כניסה");assert.deepEqual(parsed.eventTypes,["ENTRY"]);assert.equal(parsed.window.day,"yesterday");
  assert.equal(module.guardHistoryInput("תתריע על אירועים היום בכניסה",context),null);
  assert.throws(()=>module.guardHistoryInput("אירועים היום במצלמת מחסן",context),/UNKNOWN_ZONE/);
  assert.throws(()=>module.guardHistoryInput("אירועים בכניסה",context),/INVALID_WINDOW/);
  assert.throws(()=>module.guardHistoryInput("אירועים עכשיו בכניסה",context),/INVALID_WINDOW/);
  assert.throws(()=>module.guardHistoryInput("אירועים אתמול בלובי",context),/UNKNOWN_ZONE/);
  assert.throws(()=>module.guardHistoryInput("אירועים אתמול בכניסה משעה 14 עד 17",context),/INVALID_WINDOW/);
});

test("spatially impossible history stays out of answers without deleting records",async()=>{
  const poolCameras=[{...cameras[0],display_name:"בריכה",location_label:"בריכה",metadata:{zone_type:"POOL"}}];
  const poolContext={...module.guardContextForSite(site,poolCameras),now:context.now};
  const invalid=signal("impossible",undefined,{metadata:{event_type:"vehicle_entered",camera_source_id:cameraId,validated_event:true,zone_type:"POOL",first_seen:"2026-08-31T12:00:00Z"}});
  const original=JSON.stringify(invalid);
  const result=await module.searchGuardJournal(fixture([invalid]).db,{window:input.window},poolContext,poolCameras);
  assert.equal(result.events.length,0);assert.equal(result.coverage.spatial_mismatches_excluded,1);assert.equal(JSON.stringify(invalid),original);
});

test("a scan cap is reported even if grouping reduces the displayed result count",async()=>{
  const {db}=fixture(Array.from({length:1000},(_,index)=>signal(`event-${index}`)));
  const result=await module.searchGuardJournal(db,input,context,cameras);
  assert.equal(result.coverage.limit_reached,true);assert.equal(result.events.length,1);assert.equal(result.events[0].count,1000);
});

test("real site access returns timezone and rejects kindergarten or foreign membership",async()=>{
  let row={...site,owner_profile_id:otherId,garden_id:null},columns="";
  const db={from:table=>({select(value){columns=value;return this;},eq(){return this;},in(){return this;},async maybeSingle(){return {data:table==="observer_sites"?Object.fromEntries(columns.split(",").map(key=>[key,row[key]])):null,error:null};}})};
  const access=loadTs("lib/domain/digital-observer/access.ts",{"@/lib/supabase/server":{},"@/lib/auth":{},"next/navigation":{}});
  assert.equal((await access.getObserverSiteAccess(db,{id:otherId},siteId)).timezone,"Asia/Jerusalem");
  row={...row,site_type:"kindergarten"};assert.equal(await access.getObserverSiteAccess(db,{id:otherId,role:"admin"},siteId),null);
  row={...row,site_type:"home"};assert.equal(await access.getObserverSiteAccess(db,{id:cameraId},siteId),null);
});

test("conversation and journal API use authenticated read-only history paths",async()=>{
  const {db,requests}=fixture([signal("api")]);let signedIn=true,allowed=true,accessSite=site;
  const mocks={"@/lib/api":{ok:(data,status=200)=>Response.json({data},{status}),fail:(error,status=400)=>Response.json({error},{status}),handleRouteError:()=>Response.json({error:"invalid"},{status:422})},
    "@/lib/domain/digital-observer/access":{getDigitalObserverApiUser:async()=>signedIn?{profile:{id:otherId},supabase:db}:null,getObserverSiteAccess:async()=>allowed?accessSite:null},
    "@/lib/domain/digital-observer/runtime":{formatObserverDate:String,observerEventLabel:String},
    "@/lib/domain/digital-observer/guard-chat-handler":{guardChatHandler:{classify:()=>{throw Error("Must not enter action path");}}}};
  const conversation=loadTs("app/api/digital-observer/conversation/route.ts",mocks);
  const journal=loadTs("app/api/digital-observer/event-journal/route.ts",mocks);
  const chat=()=>conversation.POST(new Request("http://fixture.invalid/chat",{method:"POST",body:JSON.stringify({observer_site_id:siteId,message:"אירועים בכניסה",journal_query:input})}));
  const list=()=>journal.GET(new Request(`http://fixture.invalid/journal?${new URLSearchParams({observer_site_id:siteId,query:JSON.stringify(input)})}`));
  signedIn=false;assert.equal((await chat()).status,401);assert.equal((await list()).status,401);assert.equal(requests.length,0);
  signedIn=true;allowed=false;assert.equal((await chat()).status,403);assert.equal((await list()).status,403);assert.equal(requests.length,0);
  allowed=true;let response=await chat();assert.equal(response.status,200);const data=(await response.json()).data;assert.equal(data.intent,"historical_journal");assert.equal(data.request,null);assert.equal(data.physical_action_executed,false);
  response=await list();assert.equal(response.status,200);assert.equal((await response.json()).data.events.length,1);
  accessSite={...site,site_type:"business",business_handles_children:true};
  const before=requests.length;
  assert.equal((await chat()).status,403);assert.equal((await list()).status,403);
  assert.equal((await journal.GET(new Request(`http://fixture.invalid/journal?observer_site_id=${siteId}`))).status,403);
  const fallback=()=>conversation.POST(new Request("http://fixture.invalid/chat",{method:"POST",body:JSON.stringify({observer_site_id:siteId,message:"סיכום כל המבקרים שלא אומתו היום"})}));
  assert.equal((await fallback()).status,403,"Free-form summaries must not bypass the privacy gate through the old signal reader");
  for(const site_type of [undefined,"unknown",null]) {
    accessSite={...site,site_type};
    assert.equal((await fallback()).status,403);assert.equal((await chat()).status,403);assert.equal((await list()).status,403);
  }
  assert.equal(requests.length,before,"Restricted or unclassified sites must stop before any camera, signal or action query");
});

test("privacy-restricted and missing-policy contexts stop before any event or biometric access",async()=>{
  const {db,requests}=fixture();
  for(const restricted of [{...site,business_handles_children:true},{...site,vision_privacy_mode:"skeleton_only"},{...site,site_type:"kindergarten"},{...site,site_type:undefined},{...site,site_type:"unknown"},{...site,site_type:null}]) {
    const restrictedContext=module.guardContextForSite(restricted,cameras);
    for(const types of [undefined,["KNOWN_FACE"],["UNAUTHORIZED_FACE"],["VEHICLE_IN"]]) await assert.rejects(()=>module.searchGuardJournal(db,{window:input.window,...(types?{eventTypes:types}:{})},restrictedContext,cameras),/PRIVACY_SCOPE_UNSUPPORTED/);
  }
  await assert.rejects(()=>module.searchGuardJournal(db,input,{...context,privacyRestricted:undefined},cameras),/PRIVACY_SCOPE_UNSUPPORTED/);
  assert.equal(requests.length,0);
});

import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { startJournalLoop, journalCoverage } from "../../services/video-gateway/journal-loop.mjs";

// Isolated protocol fixture: no DVR, cloud account, saved credentials or live DB.
const directory=mkdtempSync(join(tmpdir(),"event-outbox-"));
const databasePath=join(directory,"journal.sqlite");
const cameras=Array.from({length:16},(_,i)=>({camera_id:randomUUID(),stream_id:String(i),monitoring_enabled:true,status:i===0?"offline":"connected",zone_type:i===1?"POOL":"INDOOR",
  allowed_event_types:i===1?["person_near_pool_off_hours"]:["person_detected"], supported_event_types:i===1?[]:["person_detected"]}));
const originalFetch=globalThis.fetch;
let frame=0, enabled=true, failDelivery=true, mediaCalls=0;
const detectionRequests=[];
let slowSampleFinished=false, deliveredBeforeSlowSample=false;
const delivered=new Set(),deliveredEvents=[],attempted=[];
globalThis.fetch=async(url,options={})=>{
  const path=new URL(url).pathname;
  assert.equal(options.headers["x-video-gateway-secret"],"fixture-secret");
  if(path==="/cloud/event-manifest") {frame++;return Response.json({monitoring_enabled:enabled,cameras});}
  if(path.endsWith("/detections")) {
    detectionRequests.push(path);
    if(path==="/camera/15/detections" && frame===3){await new Promise(resolve=>setTimeout(resolve,100));slowSampleFinished=true;}
    return Response.json({local_processing:true,insight:{sampled_at:new Date(Date.now()+frame*1000).toISOString(),object_detection:{status:"sampled",detections:[{label:"person",confidence:.9,box:[.1,.2,.5,.4]}]}}});
  }
  if(path==="/cloud/events") {
    const event=JSON.parse(options.body);attempted.push(event.event_id);
    if(frame===3 && !slowSampleFinished) deliveredBeforeSlowSample=true;
    if(failDelivery && event.camera_source_id===cameras[2].camera_id) return Response.json({error:"temporarily_unavailable"},{status:503});
    delivered.add(event.event_id);deliveredEvents.push(event);return Response.json({data:{status:"stored",recording_required:false}});
  }
  if(path.includes("event-media"))mediaCalls++;
  throw new Error(`Unexpected fixture request ${path}`);
};
async function until(predicate) {
  let stop;
  try {
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error("fixture_timeout")),5000);
      stop=startJournalLoop({gatewayUrl:"http://fixture.invalid",gatewaySecret:"fixture-secret",databasePath,pollIntervalMs:5,report:state=>{
        if(predicate(state)){clearTimeout(timeout);resolve();}
      }});
    });
  } finally {await stop?.();}
}
try {
  // Sampling now reports while delivery is still in flight. Wait for the
  // healthy events to drain before asserting the durable failed remainder.
  await until(state=>state.status==="delivery_retrying" && state.pending===1 && delivered.size===14);
  const db=new DatabaseSync(databasePath);
  const pending=db.prepare("SELECT * FROM outbox").all();
  assert.equal(pending.length,1,"A failed camera's event stays durable while other cameras deliver");
  assert.equal(delivered.size,14,"13 person events plus one confirmed offline alert");
  assert.equal(mediaCalls,0,"Ordinary presence and health alerts never record");
  assert(deliveredBeforeSlowSample,"A slow camera must not delay another camera's event delivery");
  db.prepare("UPDATE outbox SET next_attempt_at=0").run();db.close();
  failDelivery=false;
  await until(state=>state.status==="degraded" && state.pending===0);
  assert(delivered.has(pending[0].id),"Restart resends the identical persisted event id");
  assert.equal(attempted.filter(id=>id===pending[0].id).length,2);
  assert.equal(deliveredEvents.filter(event=>event.camera_source_id===cameras[0].camera_id&&event.event_type==="camera_offline").length,1,"Restarting the journal must not duplicate an unresolved outage");
  const healthDb=new DatabaseSync(databasePath);
  assert.equal(healthDb.prepare("SELECT offline FROM camera_health WHERE camera_id=?").get(cameras[0].camera_id).offline,1);
  healthDb.close();
  const pausedDb=new DatabaseSync(databasePath);
  const revoked=randomUUID();
  pausedDb.prepare("INSERT INTO outbox(id,payload,created_at) VALUES(?,?,?)").run(revoked,JSON.stringify({event_id:revoked,camera_source_id:cameras[2].camera_id}),Date.now());pausedDb.close();
  enabled=false;
  await until(state=>state.status==="paused" && state.pending===0);
  assert(!attempted.includes(revoked),"Revoked monitoring is respected before flushing a backlog");
  assert.equal(journalCoverage({monitoring_enabled:true,cameras:[]},[]).status,"awaiting_sources");
  assert.deepEqual(journalCoverage({monitoring_enabled:true,cameras},[]),{status:"degraded",configured:16,enabled:16,attempted:0,sampled:0,unavailable:16});
  const successful=cameras.map(camera=>({camera_id:camera.camera_id,status:"sampled"}));
  assert.equal(journalCoverage({monitoring_enabled:true,cameras},successful).status,"running");
  assert.equal(journalCoverage({monitoring_enabled:true,cameras},[successful[0],successful[0]]).sampled,1,"Duplicate reports cannot inflate coverage");
  assert.equal(journalCoverage({monitoring_enabled:true,cameras},[{camera_id:"foreign",status:"sampled"}]).sampled,0);
  enabled=true;
  Object.assign(cameras[2],{zone_type:"PARKING",supported_event_types:["camera_offline","camera_reconnected"]});
  Object.assign(cameras[3],{supported_event_types:[]});
  const beforeRequests=detectionRequests.length;
  await until(state=> {
    if(state.status!=="degraded") return false;
    assert.equal(state.cameras.find(c=>c.camera_id===cameras[2].camera_id)?.reason,"crossing_line_not_configured");
    assert.equal(state.cameras.find(c=>c.camera_id===cameras[3].camera_id)?.reason,"no_supported_visual_event_rule");
    assert.equal(state.coverage.sampled,12);
    return true;
  });
  assert(!detectionRequests.slice(beforeRequests).includes("/camera/2/detections"),"Parking without directional rules must not run a visual model");
  assert(!detectionRequests.slice(beforeRequests).includes("/camera/3/detections"),"An empty supported-rule list must not imply analysis coverage");
  console.log("Gateway outbox checks passed: 16-camera iteration, failure isolation, durable retry and outage state across restart, stable event IDs, consent revocation and zero passive recording.");
} finally {
  globalThis.fetch=originalFetch;
  for(const file of readdirSync(directory)) unlinkSync(join(directory,file));
  rmdirSync(directory);
}

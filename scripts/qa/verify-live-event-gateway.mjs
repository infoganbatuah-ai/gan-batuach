/** Read-only acceptance probe. Credentials stay in memory and on loopback. */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const base = "http://127.0.0.1:18082";
// A failed credential helper may include process arguments in its exception.
// Report recognized failure categories, never arbitrary upstream exception text.
const knownReasons = new Set([
  "EVENT_MANIFEST_UNAVAILABLE", "GATEWAY_AUTH_NOT_CONFIGURED", "GATEWAY_AUTH_UNAVAILABLE",
  "Gateway device identity is unavailable", "Gateway cloud identity is unavailable",
  "Gateway device identity requires approval", "Gateway identity is invalid or revoked.",
  "Separate kindergarten engine required.", "fetch failed", "device_relink_required"
]);
const safeReason = value => value == null ? undefined
  : typeof value === "string" && (knownReasons.has(value) || /^journal_http_[0-9]{3}$/.test(value)) ? value : "unclassified_error";
const secret = execFileSync("/usr/bin/security", ["find-generic-password", "-s", "com.ganbatuach.video-gateway.runtime", "-a", "gateway_signing_secret", "-w"], {encoding:"utf8",stdio:["ignore","pipe","ignore"],timeout:5_000}).trim();
const get = async path => {
  const response = await fetch(base+path,{headers:{"x-video-gateway-secret":secret},signal:AbortSignal.timeout(35000)});
  const value = await response.json();
  return {status:response.status,value:value.data ?? value};
};
const health = await get("/health");
const contract=health.value.edge_capability_contract;
console.log(JSON.stringify({probe:"health",status:health.status,object_detection:health.value.capabilities?.object_detection,runtime_ready:contract?.runtime?.available,model_loaded:contract?.models?.loaded,self_test_passed:contract?.capability_test?.passed,self_test_reason:contract?.capability_test?.reason,startup_phase:contract?.capability_test?.startup_phase,startup_elapsed_ms:contract?.capability_test?.startup_elapsed_ms}));
const manifest = await get("/cloud/event-manifest");
console.log(JSON.stringify({probe:"manifest",status:manifest.status,monitoring_enabled:manifest.value.monitoring_enabled,off_hours_active:manifest.value.off_hours_active,camera_count:manifest.value.cameras?.length,error:safeReason(manifest.value.error)}));
const cameras = manifest.value.cameras ?? [];
const channelOf = camera => { const match=/^dvr_[a-f0-9]+_(\d+)$/.exec(String(camera?.stream_id??""));return match?Number(match[1]):null; };
for(const camera of cameras)console.log(JSON.stringify({probe:"camera",channel:channelOf(camera),zone_type:camera.zone_type,zone_confirmed:camera.zone_confirmed,status:camera.status,monitoring_enabled:camera.monitoring_enabled,object_analysis_enabled:camera.object_analysis_enabled,crossing_line:camera.crossing_line,supported_event_types:camera.supported_event_types}));
if(process.argv.includes("--sample")) {
  let next=0;
  // Match the production journal's single warm inference session. The probe
  // must not manufacture 503s by competing with the live serial sampler.
  await Promise.all(Array.from({length:1},async()=>{
    while(next<cameras.length){
      const camera=cameras[next++];
      if(!camera.monitoring_enabled || ["offline","failed","disabled"].includes(camera.status))continue;
      const supported = camera.supported_event_types?.some(type=>["person_detected","person_entered","person_exited","vehicle_entered","vehicle_exited","person_near_pool_off_hours","unauthorized_night_motion"].includes(type));
      if(camera.object_analysis_enabled!==true || supported===false){
        console.log(JSON.stringify({probe:"sample",channel:channelOf(camera),status:"skipped",reason:camera.object_analysis_enabled!==true?"analysis_policy_not_verified":"no_supported_visual_event_rule"}));continue;
      }
      const started=Date.now();
      try{
        const sample=await get(`/camera/${encodeURIComponent(camera.stream_id)}/detections`);
        console.log(JSON.stringify({probe:"sample",channel:channelOf(camera),status:sample.status,elapsed_ms:Date.now()-started,sampled_at:sample.value.insight?.sampled_at,detector_status:sample.value.insight?.object_detection?.status,detections:sample.value.insight?.object_detection?.detections?.map(d=>({label:d.label,confidence:d.confidence}))}));
      }catch{console.log(JSON.stringify({probe:"sample",channel:channelOf(camera),status:"unavailable",elapsed_ms:Date.now()-started}));}
    }
  }));
}
const statusPath=join(homedir(),".local/share/gan-batuach/video-gateway/journal-status.json");
const loop=existsSync(statusPath)?JSON.parse(readFileSync(statusPath,"utf8")):{status:"not_started"};
console.log(JSON.stringify({probe:"journal_loop",status:loop.status,checked_at:loop.checked_at,reason:safeReason(loop.reason),coverage:loop.coverage,pending:loop.pending,delivery_failures:loop.delivery_failures,cameras:loop.cameras?.map(item=>({channel:channelOf(cameras.find(camera=>camera.camera_id===item.camera_id)),status:item.status,reason:item.reason}))}));

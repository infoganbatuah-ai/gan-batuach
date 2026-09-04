/** Read-only camera coverage audit. No event upload, recording or credential output. */
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = "http://127.0.0.1:18082";
const service = "com.ganbatuach.video-gateway.runtime";
const secret = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", "gateway_signing_secret", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const profile = JSON.parse(execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", "dvr_profile_json", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
const host = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`).hostname;
const count = Math.min(64, Math.max(1, Number(profile.channel_count) || 16));
const inspectDetections = process.argv.includes("--detector");
const requested = process.argv.slice(2).filter(value => value !== "--detector").map(Number);
if (requested.some(channel => !Number.isInteger(channel) || channel < 1 || channel > count)) throw new Error("Invalid channel selection");
const channels = requested.length ? [...new Set(requested)] : Array.from({ length: count }, (_, index) => index + 1);
const fingerprints = new Map();
const directory = inspectDetections ? null : mkdtempSync(join(tmpdir(), "journal-camera-audit-"));
console.log(JSON.stringify({ preview_directory: directory, configured_channels: count }));

async function frame(url) {
  return new Promise(resolve => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", url, "-frames:v", "1", "-vf", "scale=960:-2", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"], { stdio: ["ignore", "pipe", "ignore"] });
    const chunks=[];let size=0;
    const timer=setTimeout(()=>child.kill("SIGKILL"),15000);
    child.stdout.on("data", chunk=>{size+=chunk.length;if(size>4*1024*1024)child.kill("SIGKILL");else chunks.push(chunk);});
    child.on("error",()=>{clearTimeout(timer);resolve(null);});
    child.on("close",code=>{clearTimeout(timer);resolve(code===0&&size>0?Buffer.concat(chunks):null);});
  });
}
let cursor=0;
await Promise.all(Array.from({length:2},async()=>{
  while(cursor<channels.length){
    const channel=channels[cursor++];
    const hash=createHash("sha256").update(["dvr",host,channel].join(":")).digest("hex").slice(0,18);
    try {
      if(inspectDetections){
        const started=Date.now();
        const response=await fetch(`${base}/camera/dvr_${hash}_${channel}/insights`,{headers:{"x-video-gateway-secret":secret},signal:AbortSignal.timeout(30000)});
        const value=await response.json();
        console.log(JSON.stringify({channel,status:response.status,sampled_at:value.insight?.sampled_at,elapsed_ms:Date.now()-started,detector_status:value.insight?.object_detection?.status,detections:value.insight?.object_detection?.detections?.map(item=>({label:item.label,confidence:item.confidence}))}));
        continue;
      }
      const response=await fetch(`${base}/camera/dvr_${hash}_${channel}/playback`,{headers:{"x-video-gateway-secret":secret},signal:AbortSignal.timeout(15000)});
      const value=await response.json();
      const url=value.playback?.hls_url;
      if(!response.ok||!url){console.log(JSON.stringify({channel,status:"source_unavailable"}));continue;}
      if(new URL(url).origin!==base)throw new Error("non_local_playback");
      const bytes=await frame(url);
      if(!bytes){console.log(JSON.stringify({channel,status:"frame_unavailable"}));continue;}
      const path=join(directory,`channel-${channel}.jpg`);
      writeFileSync(path,bytes,{mode:0o600});
      const fingerprint=createHash("sha256").update(bytes).digest("hex");
      const duplicate=fingerprints.get(fingerprint);
      if(duplicate===undefined)fingerprints.set(fingerprint,channel);
      console.log(JSON.stringify({channel,status:"frame_verified",path,...(duplicate===undefined?{}:{duplicate_frame_suspected_with:duplicate})}));
    }catch{console.log(JSON.stringify({channel,status:"source_check_failed"}));}
  }
}));

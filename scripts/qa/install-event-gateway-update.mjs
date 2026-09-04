import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

// Update only the existing service's code; preserve its identity, Keychain,
// LaunchAgent, model, network settings and live-recorder configuration.
const runtime = join(homedir(), ".local/share/gan-batuach/video-gateway");
const sources = [
  "scripts/run-persistent-home-gateway.mjs", "services/video-gateway/server.mjs",
  "services/video-gateway/edge-readiness.mjs", "services/video-gateway/onnx-object-worker.mjs",
  "services/video-gateway/object-inference-client.mjs", "services/video-gateway/journal-loop.mjs", "services/video-gateway/journal-tracker.mjs"
];
const expected = {
  "services/video-gateway/server.mjs":"450d9de1034892918d7f62f9f48dbd3f46492e7b474c582c71912a4d1951c784",
  "scripts/run-persistent-home-gateway.mjs":"632eb9f32fed56cf2b90aa3494198c5f06d8c1796e52d06cb6083500d23cbb52"
};
const hash = path => createHash("sha256").update(readFileSync(path)).digest("hex");
for (const [path, checksum] of Object.entries(expected)) {
  if (hash(join(runtime,path)) !== checksum) throw new Error("Live code changed since review; merge again before installation");
}
for (const path of sources) execFileSync(process.execPath,["--check",join(process.cwd(),path)],{stdio:"pipe"});
const manifestRoute = await fetch("https://ganbatuach.com/api/video-gateway/event-manifest", {signal:AbortSignal.timeout(15000),redirect:"error"});
if (manifestRoute.status !== 401) throw new Error(`Cloud journal is not ready for authenticated devices (${manifestRoute.status})`);
const backup = join(runtime,"backups",`event-journal-${new Date().toISOString().replaceAll(":","-")}`);
mkdirSync(backup,{recursive:true,mode:0o700});
const original = new Set();
const changed = [];
try {
  for (const path of sources) {
    const destination = join(runtime,path);
    if (existsSync(destination)) {
      mkdirSync(dirname(join(backup,path)),{recursive:true,mode:0o700});
      copyFileSync(destination,join(backup,path)); original.add(path);
    }
    mkdirSync(dirname(destination),{recursive:true,mode:0o700});
    copyFileSync(join(process.cwd(),path),destination+".journal-new");
    renameSync(destination+".journal-new",destination); changed.push(path);
  }
  execFileSync("/bin/launchctl",["kickstart","-k",`gui/${process.getuid()}/com.ganbatuach.video-gateway`],{stdio:"pipe"});
  let healthy = false;
  for(let attempt=0;attempt<30;attempt++) {
    try { const r=await fetch("http://127.0.0.1:18082/health",{signal:AbortSignal.timeout(1000)});healthy=r.ok;if(healthy)break; } catch {}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!healthy)throw new Error("Updated Gateway did not regain health");
  console.log(JSON.stringify({installed:true,backup,files:changed,identity_changed:false,models_changed:false}));
} catch(error) {
  for(const path of changed) {
    if(original.has(path))copyFileSync(join(backup,path),join(runtime,path));
    else unlinkSync(join(runtime,path));
  }
  execFileSync("/bin/launchctl",["kickstart","-k",`gui/${process.getuid()}/com.ganbatuach.video-gateway`],{stdio:"pipe"});
  console.error(JSON.stringify({installed:false,rolled_back:true,backup,reason:error.message}));process.exitCode=1;
}

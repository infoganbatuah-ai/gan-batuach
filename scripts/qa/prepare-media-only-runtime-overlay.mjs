// Offline source overlay only: no service, credential, network, package or signing operation.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
function externalPath(option) {
 const value = process.argv.find(arg => arg.startsWith(option + '='))?.slice(option.length + 1);
 if (!value || !resolve(value).startsWith('/Volumes/')) throw Error('EXTERNAL_PATH_REQUIRED: ' + option);
 return resolve(value);
}
const output = externalPath('--output');
if (existsSync(output)) throw Error('NEW_EXTERNAL_OVERLAY_DIRECTORY_REQUIRED');
const specs = [
 { profile: 'PHYSICAL_GATEWAY', version: '0.2.101-p38-health', root: externalPath('--gateway-base') },
 { profile: 'SOFTWARE_CONNECTOR', version: '0.2.40-p38-health', root: externalPath('--connector-base') },
];
const hash=b=>createHash('sha256').update(b).digest('hex');
function once(s,old,next){if(s.split(old).length!==2)throw Error('EXACT_INSTALLED_SOURCE_ANCHOR_REQUIRED');return s.replace(old,next);}
function server(s){
 s=once(s,'const PORT = Number(process.env.PORT','import { cloudCameraCommandsEnabled } from "./edge-command-policy.mjs";\n\nconst CLOUD_COMMANDS_ENABLED = cloudCameraCommandsEnabled(process.env);\nconst PORT = Number(process.env.PORT');
 s=once(s,'async function initializePrivateNvrCommandRuntime() {\n','async function initializePrivateNvrCommandRuntime() {\n  if (!CLOUD_COMMANDS_ENABLED) {\n    privateNvrCommandRuntimeState.reason = "media_only";\n    return;\n  }\n');
 s=once(s,'async function pollCloudCameraActions() {\n','async function pollCloudCameraActions() {\n  if (!CLOUD_COMMANDS_ENABLED) return;\n');
 s=once(s,'if (!SHADOW_MODE && (GATEWAY_KEYCHAIN_SERVICE || GATEWAY_SECRET_DIR)) {\n  setInterval','if (CLOUD_COMMANDS_ENABLED && !SHADOW_MODE && (GATEWAY_KEYCHAIN_SERVICE || GATEWAY_SECRET_DIR)) {\n  setInterval');
 s=once(s,'? "/api/video-gateway/device-heartbeat"','? (CLOUD_COMMANDS_ENABLED ? "/api/video-gateway/device-heartbeat" : "/api/video-gateway/media-heartbeat")');
 return once(s,'if (request.url === "/connector/command" && request.method === "POST") {\n','if (request.url === "/connector/command" && request.method === "POST") {\n      if (!CLOUD_COMMANDS_ENABLED) {\n        json(response, 403, { error: "camera_commands_disabled" });\n        return;\n      }\n');
}
const runnerSource=readFileSync("scripts/run-persistent-home-gateway.mjs","utf8");
const identityStart=runnerSource.indexOf("const installedIdentityRoot =");
const identityEnd=runnerSource.indexOf("const legacyDeviceGatewayId",identityStart);
if(identityStart<0||identityEnd<=identityStart)throw Error("PRODUCT_IDENTITY_RUNNER_BLOCK_REQUIRED");
const identityBlock=runnerSource.slice(identityStart,identityEnd);
function runner(s){
 const anchor='import { createEdgeSecretStoreSync } from "../services/video-gateway/edge-secret-store-sync.mjs";';
 s=once(s,anchor,anchor+'\nimport { cloudCameraCommandsEnabled, productIdentityProfile } from "../services/video-gateway/edge-command-policy.mjs";\nimport { openProductDeviceIdentity, verifyProductDeviceIdentity } from "../services/video-gateway/product-device-identity.mjs";');
 s=once(s,'const workdir =','const CLOUD_COMMANDS_ENABLED = cloudCameraCommandsEnabled(process.env);\nconst workdir =');
 s=once(s,'runtime: { ...edgeRuntime, offline_buffer:','runtime: { ...edgeRuntime, operation_mode: CLOUD_COMMANDS_ENABLED ? "STANDARD" : "MEDIA_ONLY", offline_buffer:');
 s=once(s,'command_results: pendingCommandResults.splice(0, 20)','command_results: CLOUD_COMMANDS_ENABLED ? pendingCommandResults.splice(0, 20) : []');
 s=once(s,'  const next = response?.data?.config;','  if (!CLOUD_COMMANDS_ENABLED) return;\n  const next = response?.data?.config;');
 const oldIdentityStart=s.indexOf('const homeQaIdentityDir =');
 const oldIdentityEnd=s.indexOf('const legacyDeviceGatewayId',oldIdentityStart);
 if(oldIdentityStart<0||oldIdentityEnd<=oldIdentityStart)throw Error("EXACT_INSTALLED_IDENTITY_BLOCK_REQUIRED");
 s=once(s,s.slice(oldIdentityStart,oldIdentityEnd),identityBlock);
 return once(s,'if (identityStore && (identityStore.read', 'if (identityProfile === "INSTALLED" && identityStore && (identityStore.read');
}
const prepared=[];
for(const spec of specs){
 const changes=[];
 for(const [file,transform]of [['services/video-gateway/server.mjs',server],['scripts/run-persistent-home-gateway.mjs',runner]]){
  const before=readFileSync(join(spec.root,file));const after=Buffer.from(transform(before.toString('utf8')));
  changes.push({file,before_sha256:hash(before),after_sha256:hash(after),after});
 }
 for(const filename of ["edge-command-policy.mjs","product-device-identity.mjs"]){
  const file=join("services/video-gateway",filename);
  if(existsSync(join(spec.root,file)))throw Error("OVERLAY_FILE_ALREADY_EXISTS");
  const bytes=readFileSync(file);
  changes.push({file,before_sha256:null,after_sha256:hash(bytes),after:bytes});
 }
 prepared.push({...spec,changes});
}
mkdirSync(output,{mode:0o700});
for(const spec of prepared)for(const c of spec.changes){const p=join(output,spec.profile,c.file);mkdirSync(resolve(p,'..'),{recursive:true});writeFileSync(p,c.after,{flag:'wx'});}
const manifest={scope:'OFFLINE_PRODUCT_IDENTITY_OVERLAYS',signed:false,installed:false,services_changed:0,credentials_read:false,profiles:prepared.map(s=>({profile:s.profile,installed_version:s.version,files:s.changes.map(c=>({file:c.file,before_sha256:c.before_sha256,after_sha256:c.after_sha256}))}))};
writeFileSync(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify(manifest));

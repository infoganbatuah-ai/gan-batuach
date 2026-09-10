import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  STORAGE_CONTRACT, createRetentionPolicy, createSourceRecordingReference,
  createStorageMigrationCoordinator, createStorageObjectId, createSupabaseStorageBackend, evaluateRetention,
  executeRetention, verifyStorageIntegrity
} from "../../lib/domain/digital-observer/storage-contract.mjs";
import { createLocalNasStorageBackend } from "../../lib/domain/digital-observer/storage-local-nas.mjs";

const tenantA="11111111-1111-4111-a111-111111111111", tenantB="22222222-2222-4222-a222-222222222222";
const siteA="aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", siteB="bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const evidence="eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee";
const body=Buffer.from("controlled non-sensitive PUSH 34 evidence bytes");
const hash=createHash("sha256").update(body).digest("hex");

function fakeSupabase(){
  const objects=new Map();
  return { objects, storage:{ from(bucket){ return {
    async upload(path,value){objects.set(`${bucket}/${path}`,Buffer.from(value));return {data:{path},error:null};},
    async download(path){const value=objects.get(`${bucket}/${path}`);return value?{data:new Blob([value]),error:null}:{data:null,error:{message:"not found"}};},
    async list(parent,{search}){const prefix=`${bucket}/${parent}/`;return {data:[...objects.entries()].filter(([key])=>key.startsWith(prefix)&&key.slice(prefix.length)===search).map(([key,value])=>({name:key.slice(prefix.length),metadata:{size:value.length,mimetype:"video/mp4"},updated_at:"2026-09-10T00:00:00.000Z"})),error:null};},
    async remove(paths){for(const path of paths)objects.delete(`${bucket}/${path}`);return {data:paths,error:null};},
    async createSignedUrl(path,ttl){return objects.has(`${bucket}/${path}`)?{data:{signedUrl:`https://private.invalid/${encodeURIComponent(path)}?ttl=${ttl}`},error:null}:{data:null,error:{message:"not found"}};}
  };}}};
}

async function contractSuite(name,backend){
  const objectId=createStorageObjectId({tenantId:tenantA,siteId:siteA,evidenceId:evidence,variant:`${name}-clip`,extension:"mp4"});
  const scope={objectId,tenantId:tenantA,siteId:siteA,evidenceId:evidence};
  const written=await backend.write({...scope,bytes:body,contentType:"video/mp4",upsert:true});
  assert.equal(written.contract,STORAGE_CONTRACT); assert.equal(written.sha256,hash); assert.equal(written.size_bytes,body.length);
  assert.deepEqual(await backend.read(scope),body); assert.equal((await backend.stat(scope)).size_bytes,body.length);
  assert.equal(verifyStorageIntegrity(await backend.read(scope),hash).ok,true);
  const access=await backend.authorize({...scope,actor:{tenantId:tenantA,siteIds:[siteA]},ttlSeconds:30}); assert.ok(access.kind);
  await assert.rejects(()=>backend.authorize({...scope,actor:{tenantId:tenantB,siteIds:[siteA]}}),/access_denied/);
  await assert.rejects(()=>backend.read({...scope,tenantId:tenantB}),/scope_denied/);
  if(backend.readAuthorized)assert.deepEqual(await backend.readAuthorized(access.grant,{tenantId:tenantA,siteIds:[siteA]}),body);
  await backend.delete({...scope,sizeBytes:body.length}); assert.equal(await backend.stat(scope),null);
  return {name,operations:7,tenant_negative:true,integrity:true};
}

const root=await mkdtemp(join(tmpdir(),"observer-nas-"));
const usage=[];
try{
  const local=createLocalNasStorageBackend({root,signingSecret:"qa-only-signing-secret-not-production",onUsage:event=>usage.push(event)});
  const supabaseClient=fakeSupabase(); const cloud=createSupabaseStorageBackend({client:supabaseClient,onUsage:event=>usage.push(event)});
  const contracts=[await contractSuite("cloud",cloud),await contractSuite("nas",local)];

  await assert.rejects(()=>local.read({objectId:"../escape",tenantId:tenantA,siteId:siteA}),/object_id_invalid/);
  await assert.rejects(()=>local.read({objectId:"/absolute/path",tenantId:tenantA,siteId:siteA}),/object_id_invalid/);
  const symlinkParent=join(root,tenantA,siteA); await mkdir(symlinkParent,{recursive:true}); await symlink(tmpdir(),join(symlinkParent,"escape-link"));
  await assert.rejects(()=>local.read({objectId:`${tenantA}/${siteA}/escape-link/file.bin`,tenantId:tenantA,siteId:siteA}),/symlink_escape_denied/);

  const policy=createRetentionPolicy({policyId:"event-media-default",version:1,tenantId:tenantA,siteId:siteA,retentionDays:1,effectiveAt:"2026-09-01T00:00:00.000Z"});
  const oldObject={object_id:createStorageObjectId({tenantId:tenantA,siteId:siteA,evidenceId:evidence,variant:"retention",extension:"jpg"}),tenant_id:tenantA,site_id:siteA,evidence_id:evidence,content_type:"image/jpeg",size_bytes:body.length,sha256:hash,created_at:"2026-09-01T00:00:00.000Z",delete_after:"2026-09-02T00:00:00.000Z"};
  assert.equal(evaluateRetention({policy,object:{...oldObject,delete_after:"2026-09-12T00:00:00.000Z"},now:Date.parse("2026-09-10T00:00:00Z")}).reason,"NOT_YET_ELIGIBLE");
  assert.equal(evaluateRetention({policy,object:{...oldObject,legal_hold:true},now:Date.parse("2026-09-10T00:00:00Z")}).reason,"LEGAL_HOLD");
  await local.write({objectId:oldObject.object_id,tenantId:tenantA,siteId:siteA,evidenceId:evidence,bytes:body,contentType:"image/jpeg"}); let canonical=null;
  const retained=await executeRetention({backend:local,object:oldObject,policy,now:Date.parse("2026-09-10T00:00:00Z"),updateCanonical:async value=>{canonical=value;}});
  assert.equal(retained.state,"DELETED"); assert.equal(canonical.state,"DELETED"); assert.equal(await local.stat({objectId:oldObject.object_id,tenantId:tenantA,siteId:siteA}),null);
  let incorrectlyUpdated=false; await assert.rejects(()=>executeRetention({backend:{delete:async()=>{throw new Error("backend down");}},object:oldObject,policy,now:Date.parse("2026-09-10T00:00:00Z"),updateCanonical:async()=>{incorrectlyUpdated=true;}}),/backend down/); assert.equal(incorrectlyUpdated,false);

  const sourceId=createStorageObjectId({tenantId:tenantA,siteId:siteA,evidenceId:evidence,variant:"migration",extension:"mp4"});
  await cloud.write({objectId:sourceId,tenantId:tenantA,siteId:siteA,evidenceId:evidence,bytes:body,contentType:"video/mp4",upsert:true});
  const coordinator=createStorageMigrationCoordinator({now:()=>Date.parse("2026-09-10T00:00:00Z")}); let switched=null;
  const migrationInput={migrationId:"migration-001",source:cloud,target:local,object:{...oldObject,object_id:sourceId},switchCanonical:async value=>{switched=value;}};
  const migrated=await coordinator.migrate(migrationInput); assert.equal(migrated.state,"MIGRATED"); assert.equal(switched.backend_id,local.id); assert.deepEqual(await cloud.read({objectId:sourceId,tenantId:tenantA,siteId:siteA}),body);
  assert.deepEqual(await coordinator.migrate(migrationInput),migrated,"retry must be idempotent");
  const interrupted=await createStorageMigrationCoordinator().migrate({...migrationInput,migrationId:"migration-002",target:{...local,id:"failing-target",write:async()=>{throw new Error("interrupted_copy");}}}); assert.equal(interrupted.state,"FAILED"); assert.equal(interrupted.canonical_reference.backend_id,cloud.id);
  const corruptTarget={...local,id:"corrupt-target",write:local.write,read:async()=>Buffer.from("corrupt")}; const mismatch=await createStorageMigrationCoordinator().migrate({...migrationInput,migrationId:"migration-003",target:corruptTarget}); assert.equal(mismatch.state,"FAILED"); assert.equal(mismatch.canonical_reference.backend_id,cloud.id);
  const unavailable=await createStorageMigrationCoordinator().migrate({...migrationInput,migrationId:"migration-004",source:{...cloud,id:"missing-source",read:async()=>{throw new Error("offline");}}}); assert.equal(unavailable.reason,"SOURCE_UNAVAILABLE");
  await assert.rejects(()=>createStorageMigrationCoordinator().migrate({...migrationInput,migrationId:"migration-005",object:{...oldObject,object_id:sourceId,tenant_id:tenantB}}),/scope_denied/);

  const recording=createSourceRecordingReference({referenceId:"recording-001",tenantId:tenantA,siteId:siteA,cameraSourceId:"cccccccc-cccc-4ccc-accc-cccccccccccc",sourceSystem:"DVR",recordingId:"recording-remote-42",startsAt:"2026-09-10T00:00:00Z",endsAt:"2026-09-10T00:05:00Z"});
  assert.equal(recording.media_copied_to_digital_observer,false); await assert.rejects(async()=>createSourceRecordingReference({...recording,referenceId:"recording-002",tenantId:tenantA,siteId:siteA,cameraSourceId:recording.camera_source_id,sourceSystem:"DVR",recordingId:"x",startsAt:recording.starts_at,endsAt:recording.ends_at,password:"no"}),/secret_denied/);
  assert.ok(usage.length>=8); assert.ok(usage.every(event=>event.contract==="observer-storage-usage-v1"&&event.attribution_quality==="DIRECTLY_METERED"));

  console.log(JSON.stringify({result:"PASS",contract:STORAGE_CONTRACT,backends:contracts,retention:{not_yet_eligible:true,legal_hold:true,delete_after_backend:true,delete_failure_retryable:true},migration:{success:true,idempotent:true,interrupted_safe:true,integrity_mismatch_safe:true,source_unavailable_safe:true,tenant_mismatch_denied:true},path_security:{traversal:true,absolute:true,symlink:true},source_recording_reference:true,usage_events:usage.length},null,2));
}finally{await rm(root,{recursive:true,force:true});}

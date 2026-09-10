/** Read-only Production proof: an authorized user resolves and reads existing private Evidence. */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

const origin=new URL(process.argv[2]||"https://ganbatuach.com");
assert.equal(origin.origin,"https://ganbatuach.com","Exact Production origin required");
const allowed=new Set(["NEXT_PUBLIC_SUPABASE_URL","NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY","NEXT_PUBLIC_SUPABASE_ANON_KEY","QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL","QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD"]);
const config={};
const envRoot=process.env.DIGITAL_OBSERVER_QA_ENV_ROOT?resolve(process.env.DIGITAL_OBSERVER_QA_ENV_ROOT):process.cwd();
for(const name of [".env.qa-demo.local",".env.local"]){const file=resolve(envRoot,name);if(!existsSync(file))continue;const values=parseEnv(readFileSync(file,"utf8"));for(const key of allowed)if(!config[key]&&values[key])config[key]=values[key];}
const publicKey=config.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||config.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert.ok(config.NEXT_PUBLIC_SUPABASE_URL&&publicKey&&config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL&&config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD,"Authorized Production QA configuration is missing");
const client=createClient(config.NEXT_PUBLIC_SUPABASE_URL,publicKey,{auth:{persistSession:false,autoRefreshToken:false}});
const login=await client.auth.signInWithPassword({email:config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_EMAIL,password:config.QA_DEMO_DIGITAL_OBSERVER_ADMIN_PASSWORD});
assert.ok(!login.error&&login.data.session,"Authorized Production admin authentication failed");
try{
  const query=await client.from("digital_observer_event_clips").select("id,observer_site_id,camera_source_id,clip_status,media_status,captured_at").eq("clip_status","available").order("captured_at",{ascending:false}).limit(20);
  assert.ifError(query.error); const clip=query.data?.find(item=>item.id&&item.observer_site_id&&item.camera_source_id); assert.ok(clip,"No accessible existing real Evidence item is available");
  const response=await fetch(new URL(`/api/digital-observer/event-clips/${clip.id}/media?kind=clip`,origin),{headers:{authorization:`Bearer ${login.data.session.access_token}`},redirect:"manual",signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,307,`Authorized Evidence route returned ${response.status}`); const location=response.headers.get("location"); assert.ok(location,"Signed redirect is absent");
  const media=await fetch(location,{headers:{range:"bytes=0-1023"},signal:AbortSignal.timeout(30000)}); assert.ok([200,206].includes(media.status),`Signed private object read returned ${media.status}`);
  const bytes=Buffer.from(await media.arrayBuffer()); assert.ok(bytes.length>0,"Existing Evidence object is empty");
  console.log(JSON.stringify({status:"PASS",classification:"REAL_EXISTING_PRIVATE_EVIDENCE_READ_ONLY",evidence_id:clip.id,site_id:clip.observer_site_id,camera_source_id:clip.camera_source_id,captured_at:clip.captured_at,authorized_route_status:response.status,private_object_status:media.status,bytes_read:bytes.length,content_type:media.headers.get("content-type"),raw_storage_url_logged:false,media_modified:false},null,2));
}finally{await client.auth.signOut();}

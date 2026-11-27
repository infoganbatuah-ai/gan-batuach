import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const req=createRequire(process.env.OBSERVER_TEST_DEPENDENCIES || new URL('../../package.json',import.meta.url));
const ts=req('typescript');
const gateway='11111111-1111-4111-8111-111111111111',site='22222222-2222-4222-8222-222222222222';
function compile(path,imports){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert(n in imports,n);return imports[n];},process:{env:{VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET:'synthetic'}},Date,Request});return exports.POST;}
function fixture(options={}){
 const calls={writes:0,claims:0,acks:0};
 const api={ok:data=>({ok:true,data}),fail:(message,status)=>({ok:false,message,status}),handleRouteError:()=>({ok:false,status:422})};
 const admin={from(table){let write=false;const q={select(){return q;},eq(){return q;},in(){return Promise.resolve({error:null});},update(){write=true;calls[table==='observer_edge_fleet_commands'?'acks':'writes']++;return q;},async maybeSingle(){return {error:null,data:write?{id:'fixture'}:options.revoked?null:{id:'fixture',lifecycle_state:'ACTIVE',metadata:{device_type:'PHYSICAL_GATEWAY',installation_id:'fixture-install',...(options.replay?{last_heartbeat_id:'fixture-heartbeat'}:{})}}};}};return q;},async rpc(){calls.claims++;return {data:[{id:'fixture-command',command:'RECONNECT_CAMERAS'}],error:null};}};
 const post=compile('../../app/api/video-gateway/device-heartbeat/route.ts',{zod:req('zod'),'@/lib/api':api,'@/lib/domain/gateway-device-enrollment':{verifyGatewayDeviceAccessToken:()=>({gateway_id:gateway,observer_site_id:site,device_id:'fixture',version:1}),gatewayDeviceSessionAllows:(_d,scope)=>scope==='HEARTBEAT'||options.commandScope!==false},'@/lib/supabase/admin':{createAdminClient:()=>admin}});
 const wrapper=compile('../../app/api/video-gateway/media-heartbeat/route.ts',{'@/lib/api':api,'../device-heartbeat/route':{POST:post}});
 const payload={heartbeat_id:'fixture-heartbeat',gateway_id:gateway,observer_site_id:site,observed_at:new Date().toISOString(),runtime:{contract:'observer-edge-runtime-v1',device_type:'PHYSICAL_GATEWAY',installation_id:'fixture-install',software_version:'fixture',build_sha:'fixture',outbound_only:true,arbitrary_shell_commands:false},health:{status:'HEALTHY',uptime_seconds:1,cpu_percent:null,memory_mb:null,disk_free_mb:null,camera_count:1,streaming_count:1,last_frame_at:null,error_codes:[]},command_results:[]};
 const send=(body=payload,wrapped=false)=>(wrapped?wrapper:post)(new Request('https://fixture.invalid/api',{method:'POST',headers:{'x-video-gateway-id':gateway,'x-video-gateway-device-token':'fixture'},body:JSON.stringify(body)}));
 return {calls,payload,send};
}
test('media health is stored without claiming any Fleet commands',async()=>{const f=fixture();f.payload.runtime.operation_mode='MEDIA_ONLY';const r=await f.send();assert.equal(r.ok,true);assert.equal(f.calls.writes,1);assert.equal(f.calls.claims,0);assert.equal(f.calls.acks,0);assert.equal(r.data.commands.length,0);});
test('media ACK rejected before writes, including idempotent replay',async()=>{for(const replay of [false,true]){const f=fixture({replay});f.payload.runtime.operation_mode='MEDIA_ONLY';f.payload.command_results=[{command_id:gateway,state:'COMPLETED',result_category:'fixture'}];assert.equal((await f.send()).status,403);assert.deepEqual(f.calls,{writes:0,claims:0,acks:0});}});
test('default standard client retains command delivery',async()=>{const f=fixture();assert.equal((await f.send()).data.commands.length,1);assert.equal(f.calls.claims,1);});
test('HEARTBEAT-only scope cannot claim or acknowledge commands',async()=>{const f=fixture({commandScope:false});assert.equal((await f.send()).ok,true);assert.equal(f.calls.claims,0);f.payload.command_results=[{command_id:gateway,state:'COMPLETED',result_category:'fixture'}];assert.equal((await f.send()).status,403);assert.equal(f.calls.acks,0);});
test('separate media route forces status-only even with STANDARD payload',async()=>{const f=fixture();f.payload.runtime.operation_mode='STANDARD';assert.equal((await f.send(f.payload,true)).ok,true);assert.equal(f.calls.claims,0);});
test('invalid mode, wrong site, stale or revoked identity cannot write',async()=>{for(const kind of ['mode','site','stale','revoked']){const f=fixture({revoked:kind==='revoked'});if(kind==='mode')f.payload.runtime.operation_mode='typo';if(kind==='site')f.payload.observer_site_id=gateway;if(kind==='stale')f.payload.observed_at='2020-01-01T00:00:00.000Z';assert.equal((await f.send()).ok,false);assert.deepEqual(f.calls,{writes:0,claims:0,acks:0});}});
test('idempotent media replay never claims commands',async()=>{const f=fixture({replay:true});assert.equal((await f.send(f.payload,true)).data.idempotent_replay,true);assert.deepEqual(f.calls,{writes:0,claims:0,acks:0});});

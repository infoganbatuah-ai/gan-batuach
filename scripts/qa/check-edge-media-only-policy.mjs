import { join } from "node:path";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {cloudCameraCommandsEnabled, productIdentityProfile} from '../../services/video-gateway/edge-command-policy.mjs';
const source=readFileSync(process.env.OBSERVER_TEST_SERVER_SOURCE || new URL('../../services/video-gateway/server.mjs',import.meta.url),'utf8');
function body(name){const start=source.indexOf(`async function ${name}(`);assert(start>=0);const end=source.indexOf('\n}\n',start);assert(end>start);return source.slice(start,end+2);}
test('existing command policy retained unless explicitly media-only',()=>{assert.equal(cloudCameraCommandsEnabled({}),true);assert.equal(cloudCameraCommandsEnabled({OBSERVER_EDGE_OPERATION_MODE:'STANDARD'}),true);assert.equal(cloudCameraCommandsEnabled({OBSERVER_EDGE_OPERATION_MODE:'MEDIA_ONLY'}),false);});
test('typo or unknown mode cannot silently enable commands',()=>{assert.throws(()=>cloudCameraCommandsEnabled({OBSERVER_EDGE_OPERATION_MODE:'media_only'}),/EDGE_OPERATION_MODE_INVALID/);});
test('actual poll function has zero authority reads/network in media-only',async()=>{for(const enabled of [false,true]){let reads=0;const c=vm.createContext({CLOUD_COMMANDS_ENABLED:enabled,deviceIdentitySecret:async()=>{reads++;throw Error('fixture-stop');}});vm.runInContext(body('pollCloudCameraActions'),c);await vm.runInContext('pollCloudCameraActions()',c);assert.equal(reads,enabled?1:0);}});
test('actual initialization skips keys, capability probes and command DB',async()=>{let reads=0;const state={reason:'runtime_dependencies_unavailable'};const c=vm.createContext({CLOUD_COMMANDS_ENABLED:false,privateNvrCommandRuntimeState:state,keychainSecret:()=>{reads++;throw Error('unexpected');}});vm.runInContext(body('initializePrivateNvrCommandRuntime'),c);await vm.runInContext('initializePrivateNvrCommandRuntime()',c);assert.equal(reads,0);assert.equal(state.reason,'media_only');});
test('command timer is not registered in media-only',()=>{const start=source.indexOf('if (CLOUD_COMMANDS_ENABLED && !SHADOW_MODE');const end=source.indexOf('\n}\n',start);assert(start>=0&&end>start);for(const enabled of [false,true]){let timers=0;vm.runInNewContext(source.slice(start,end+2),{CLOUD_COMMANDS_ENABLED:enabled,SHADOW_MODE:false,GATEWAY_KEYCHAIN_SERVICE:'fixture',GATEWAY_SECRET_DIR:'',setInterval:()=>{timers++;return {unref(){}};}});assert.equal(timers,enabled?1:0);}});
test('authenticated local command denied before payload parsing or reconnect',()=>{const start=source.indexOf('if (request.url === "/connector/command"');const end=source.indexOf('const command = parseConnectorCommand',start);assert(start>=0&&end>start);let status=0;const c={CLOUD_COMMANDS_ENABLED:false,request:{url:'/connector/command',method:'POST'},response:{},json:(_r,s)=>status=s};vm.runInNewContext('(function(){'+source.slice(start,end)+'}})()',c);assert.equal(status,403);});

const gateway='11111111-1111-4111-8111-111111111111';
const site='22222222-2222-4222-8222-222222222222';
function productFixture(extra={},values={}) {
 const env={OBSERVER_EDGE_OPERATION_MODE:'MEDIA_ONLY',OBSERVER_EDGE_IDENTITY_PROFILE:'PRODUCT_LEGACY',OBSERVER_EDGE_EXPECTED_GATEWAY_ID:gateway,OBSERVER_EDGE_EXPECTED_SITE_ID:site,OBSERVER_EDGE_EXPECTED_PRODUCT_ORIGIN:'https://ganbatuach.com',...extra};
 const secrets={device_gateway_id:gateway,device_observer_site_id:site,device_cloud_base_url:'https://ganbatuach.com',device_refresh_token:'synthetic-only',...values};
 return {env,readOriginal:a=>secrets[a]||''};
}
test('installed profile never reads legacy credentials',()=>{assert.equal(productIdentityProfile({env:{},readOriginal:()=>{throw Error('unexpected');}}),'INSTALLED');});
test('exact legacy Product binding may be selected only in media-only',()=>{assert.equal(productIdentityProfile(productFixture()),'PRODUCT_LEGACY');});
test('unknown identity profile fails closed',()=>{assert.throws(()=>productIdentityProfile(productFixture({OBSERVER_EDGE_IDENTITY_PROFILE:'product'})),/EDGE_IDENTITY_PROFILE_INVALID/);});
test('Product selection with command authority or explicit QA overlay is rejected',()=>{for(const extra of [{OBSERVER_EDGE_OPERATION_MODE:'STANDARD'},{OBSERVER_EDGE_DEVICE_IDENTITY_SECRET_DIR:'/fixture/qa'}])assert.throws(()=>productIdentityProfile(productFixture(extra)),/PRODUCT_IDENTITY_REQUIRES_MEDIA_ONLY/);});
test('wrong or unpinned site/device rejected before authentication',()=>{assert.throws(()=>productIdentityProfile(productFixture({OBSERVER_EDGE_EXPECTED_SITE_ID:''})),/BINDING_REQUIRED/);assert.throws(()=>productIdentityProfile(productFixture({}, {device_gateway_id:site})),/BINDING_MISMATCH/);});
test('QA/private/other receiver cannot be selected as Product',()=>{for(const origin of ['https://127.0.0.1:3101','https://evil.example','https://ganbatuach.com/path'])assert.throws(()=>productIdentityProfile(productFixture({OBSERVER_EDGE_EXPECTED_PRODUCT_ORIGIN:origin})),/ORIGIN_MISMATCH/);});
test('existing Product endpoint must match exact pinned origin',()=>{assert.throws(()=>productIdentityProfile(productFixture({}, {device_cloud_base_url:'https://gan-batuach.vercel.app'})),/ORIGIN_MISMATCH/);});
test('QA private key and missing legacy token are never repurposed',()=>{assert.throws(()=>productIdentityProfile(productFixture({}, {device_private_key_pkcs8:'synthetic-qa-key'})),/CREDENTIAL_UNAVAILABLE/);assert.throws(()=>productIdentityProfile(productFixture({}, {device_refresh_token:''})),/CREDENTIAL_UNAVAILABLE/);});
test('managed Product identity is pinned independently of a supported legacy alias',()=>{
 const options=productFixture({OBSERVER_EDGE_IDENTITY_PROFILE:'PRODUCT_MANAGED'},{device_cloud_base_url:'https://gan-batuach.vercel.app',device_refresh_token:''});
 assert.equal(productIdentityProfile(options),'PRODUCT_MANAGED');
 options.env.OBSERVER_EDGE_EXPECTED_PRODUCT_ORIGIN='https://gan-batuach.vercel.app';
 assert.throws(()=>productIdentityProfile(options),/ORIGIN_MISMATCH/);
});
test('actual runner selects separate Product, legacy and installed credentials',()=>{
 const runner=readFileSync(process.env.OBSERVER_TEST_RUNNER_SOURCE || new URL('../run-persistent-home-gateway.mjs',import.meta.url),'utf8');
 const start=runner.indexOf('const installedIdentityRoot =');const end=runner.indexOf('const legacyDeviceGatewayId',start);assert(start>=0&&end>start);
 for(const [profile,path] of [['PRODUCT_MANAGED','/fixture/product-device-secrets'],['PRODUCT_LEGACY',''],['INSTALLED','/fixture/home/Library/Application Support/Digital Observer/observer-connector/ota/home-qa-device-secrets']]){
  let verified=0;
  const c=vm.createContext({join,homedir:()=>'/fixture/home',managedIdentityProfileRoot:'observer-connector',process:{env:{},getuid:()=>501},productIdentityProfile:()=>profile,keychainSecret:()=>'',existsSync:()=>true,realpathSync:p=>p,lstatSync:()=>({isDirectory:()=>true,isSymbolicLink:()=>false,uid:501,mode:0o700}),createEdgeSecretStoreSync:()=>({}),openProductDeviceIdentity:()=>({directory:'/fixture/product-device-secrets',store:{}}),verifyProductDeviceIdentity:()=>verified++});
  assert.equal(vm.runInContext(runner.slice(start,end)+'\ndeviceIdentitySecretDir',c),path);
  assert.equal(verified,Number(profile==='PRODUCT_MANAGED'));
 }
});
test('actual parent heartbeat reports health but ignores hostile commands and config',async()=>{
 const runner=readFileSync(process.env.OBSERVER_TEST_RUNNER_SOURCE || new URL('../run-persistent-home-gateway.mjs',import.meta.url),'utf8');
 const start=runner.indexOf('async function heartbeat() {');const end=runner.indexOf('\n}\n',start);assert(start>=0&&end>start);
 const pending=[{command_id:'retained-fixture'}];let sent;let fetches=0;
 const forbidden=()=>{throw Error('unexpected command/config operation');};
 const c=vm.createContext({CLOUD_COMMANDS_ENABLED:false,fetch:async()=>{fetches++;return {json:async()=>({})};},gatewayUrl:'http://fixture',AbortSignal,channels:[],edgeDeviceType:'PHYSICAL_GATEWAY',connectorChannelFilter:[],connectorHeartbeatHealth:()=>({status:'HEALTHY',streamingCount:0,errorCodes:[]}),readFileSync:()=>{throw Error('no fixture journal');},dataRoot:'/fixture',statfsSync:()=>({bavail:1,bsize:1}),crypto:{randomUUID:()=> 'fixture-heartbeat'},gatewayId:'fixture',observerSiteId:'fixture',edgeRuntime:{},Date,uptime:()=>1,loadavg:()=>[0],totalmem:()=>1,freemem:()=>1,pendingCommandResults:pending,signedPost:async(_p,p)=>{sent=p;return {data:{config:{version:999},commands:[{command:'RECONNECT_CAMERAS'}]}};},validateConnectorConfigSnapshot:forbidden,writeFileSync:forbidden,renameSync:forbidden,discover:forbidden});
 vm.runInContext(runner.slice(start,end+2),c);await vm.runInContext('heartbeat()',c);
 assert.equal(fetches,1);assert.equal(sent.runtime.operation_mode,'MEDIA_ONLY');assert.equal(sent.command_results.length,0);assert.equal(pending.length,1);
});
test('media heartbeat uses separate fail-closed receiver URL',()=>{assert(source.includes('? (CLOUD_COMMANDS_ENABLED ? "/api/video-gateway/device-heartbeat" : "/api/video-gateway/media-heartbeat")'));});

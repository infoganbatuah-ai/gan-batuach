import {test} from "node:test";
import assert from "node:assert/strict";
import {existsSync,readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const root=new URL("../../",import.meta.url);
const compile=path=>ts.transpileModule(readFileSync(new URL(path,root),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const tick=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function setup({connected=false,native=true,deferredStatus=false,nativePlayback=true}={}){
 let active,networkCallback,appCallback,requests=0,plays=0,sources=0,attachments=0,timer=0;const listeners=new Map(),timers=new Map(),statusResolvers=[];
 const window={location:{pathname:"/digital-observer/login",search:"",origin:"https://example.invalid"},addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},removeEventListener(n,f){listeners.get(n)?.delete(f);},dispatchEvent(e){for(const f of listeners.get(e.type)||[])f(e);}};
 const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props}),Fragment:"fragment"};
 const react={useState(...a){return active.useState(...a)},useRef(...a){return active.useRef(...a)},useEffect(...a){return active.useEffect(...a)}};
 const plugin={Capacitor:{isNativePlatform:()=>native,isPluginAvailable:()=>false,getPlatform:()=>"ios"},Network:{getStatus:()=>deferredStatus?new Promise(r=>{statusResolvers.push(r)}):Promise.resolve({connected}),addListener:async(_n,cb)=>{networkCallback=cb;return {remove:async()=>{}}}},App:{addListener:async(n,cb)=>{if(n==="appStateChange")appCallback=cb;return {remove:async()=>{}}},getLaunchUrl:async()=>null},Device:{},Preferences:{get:async()=>({value:null}),set:async()=>{}},PushNotifications:{}};
 class Hls{static Events={MEDIA_ATTACHED:"attached",MANIFEST_PARSED:"manifest",ERROR:"error"};static isSupported(){return !nativePlayback;}on(){}attachMedia(){attachments++;}destroy(){}}
 const win={window,URL,Date,AbortController,crypto:{randomUUID:()=>"synthetic-uuid"},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail;}},setTimeout(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id;},clearTimeout(id){timers.delete(id)},setInterval(fn,ms){const id=++timer;timers.set(id,{fn,ms});return id;},clearInterval(id){timers.delete(id)},fetch(){requests++;return Promise.resolve({ok:true,json:async()=>({data:{playback:{hls_url:"https://example.invalid/media"}}})});}};
 const helperPath="lib/domain/digital-observer/mobile-playback-lifecycle.ts";let helper={};
 function module(path){const exports={};const require=id=>{if(id==="react")return react;if(id==="react/jsx-runtime")return jsx;if(id==="hls.js")return {__esModule:true,default:Hls};if(id==="lucide-react")return new Proxy({}, {get:()=>()=>null});if(id.startsWith("@capacitor/"))return plugin;if(id.endsWith("/mobile-runtime"))return {mobileRuntimeRequiresSession:()=>false,sanitizeOfflineQueue:()=>[],mobileNotificationPreview:()=>({})};if(id.endsWith("/mobile-playback-lifecycle"))return helper;throw Error("unexpected import "+id)};runInNewContext(compile(path),{...win,exports,require});return exports;}
 if(existsSync(new URL(helperPath,root)))helper=module(helperPath);
 const Runtime=module("components/digital-observer/observer-mobile-runtime.tsx").ObserverMobileRuntime,Player=module("components/digital-observer/observer-live-player.tsx").ObserverLivePlayer;
 function component(fn,props){let cursor=0,effect,cleanup,changed=false,slots=[];const video={canPlayType:()=>nativePlayback?"maybe":"",pause(){},load(){},removeAttribute(){},play(){plays++;return Promise.resolve()},set src(_v){sources++}};
  const hooks={useState(init){const i=cursor++;if(!(i in slots))slots[i]=typeof init==="function"?init():init;return [slots[i],v=>{slots[i]=typeof v==="function"?v(slots[i]):v;changed=true}]},useRef(init){const i=cursor++;return slots[i] ||= {current:i===0?video:init}},useEffect(cb,deps){const i=cursor++,old=slots[i];if(!old||deps.some((x,j)=>x!==old[j])){slots[i]=deps;effect=cb}}};
  function render(){active=hooks;cursor=0;effect=null;fn(props);if(effect){cleanup?.();cleanup=effect()}changed=false;}render();
  return {flush(){if(changed)render()},unmount(){cleanup?.()},render,changeSource(id){props={...props,cameraSourceId:id};render()},slots};
 }
 return {runtime:()=>component(Runtime,{}),player:()=>component(Player,{observerSiteId:"site",cameraSourceId:"camera",name:"synthetic"}),network:async v=>networkCallback({connected:v,connectionType:"none"}),app:async v=>appCallback({isActive:v}),resolveStatus:(i,v)=>statusResolvers[i]({connected:v}),get requests(){return requests},get plays(){return plays},get sources(){return sources},get attachments(){return attachments},window,helper};
}
test("native known-offline before a late player prevents any playback request",async()=>{
 const h=setup();const r=h.runtime();await tick();const p=h.player();await tick();assert.deepEqual([h.requests,h.sources,h.plays],[0,0,0]);p.unmount();r.unmount();
});
test("known offline also blocks late HLS attachment",async()=>{
 const h=setup({nativePlayback:false});const r=h.runtime();await tick();const p=h.player();await tick();assert.equal(h.requests,0);assert.equal(h.attachments,0);p.unmount();r.unmount();
});
test("native inactive and offline transitions before late player require both recoveries",async()=>{
 const h=setup({connected:true});const r=h.runtime();await tick();await h.app(false);await h.network(false);const p=h.player();await tick();assert.equal(h.requests,0);await h.network(true);p.flush();await tick();assert.equal(h.requests,0);await h.app(true);p.flush();await tick();assert.equal(h.requests,1);assert.equal(h.plays,1);p.unmount();r.unmount();
});
test("multiple late players remain blocked across source change and partial recovery",async()=>{
 const h=setup();const r=h.runtime();await tick();await h.app(false);const p=h.player(),q=h.player();p.changeSource("other-camera");await h.network(true);p.flush();q.flush();await tick();assert.equal(h.requests,0);
 await h.app(true);await h.app(true);p.flush();q.flush();await tick();assert.equal(h.requests,2);assert.equal(h.plays,2);p.unmount();q.unmount();r.unmount();
});
test("subscription is installed before snapshot callback and sees reentrant update",()=>{
 const h=setup(),publisher=h.helper.openMobilePlaybackPublisher(),seen=[];
 const unsubscribe=h.helper.subscribeMobilePlayback(s=>{seen.push(s?.networkOffline);if(seen.length===1)publisher.networkOffline(true)});
 assert.deepEqual(seen,[null,true]);unsubscribe();publisher.close();
});
test("reentrant publication cannot deliver an older unblocked snapshot to another consumer",()=>{
 const h=setup(),publisher=h.helper.openMobilePlaybackPublisher(),seen=[];publisher.networkOffline(true);
 const one=h.helper.subscribeMobilePlayback(s=>{if(s?.networkOffline===false)publisher.networkOffline(true)});
 const two=h.helper.subscribeMobilePlayback(s=>seen.push(s?.networkOffline));publisher.networkOffline(false);
 assert.equal(seen.at(-1),true);one();two();publisher.close();
});
test("old publisher cannot overwrite a replacement or clear its state",()=>{
 const h=setup(),old=h.helper.openMobilePlaybackPublisher(),fresh=h.helper.openMobilePlaybackPublisher(),seen=[];fresh.networkOffline(true);old.networkOffline(false);old.close();
 const unsubscribe=h.helper.subscribeMobilePlayback(s=>seen.push(s?.networkOffline));assert.equal(seen.at(-1),true);unsubscribe();fresh.close();
});
test("stale status completion from disposed runtime cannot block replacement",async()=>{
 const h=setup({deferredStatus:true});const old=h.runtime();old.unmount();const fresh=h.runtime();h.resolveStatus(0,false);h.resolveStatus(1,true);await tick();
 const p=h.player();await tick();assert.equal(h.requests,1);assert.equal(h.plays,1);p.unmount();fresh.unmount();
});
test("disposed runtime leaves no stale block for a newly mounted web-style consumer",async()=>{
 const h=setup();const r=h.runtime();await tick();r.unmount();const p=h.player();await tick();assert.equal(h.requests,1);assert.equal(h.plays,1);p.unmount();
});
test("web without native runtime retains existing behavior",async()=>{
 const h=setup({native:false});const r=h.runtime(),p=h.player();await tick();assert.equal(h.requests,1);assert.equal(h.plays,1);p.unmount();r.unmount();
});

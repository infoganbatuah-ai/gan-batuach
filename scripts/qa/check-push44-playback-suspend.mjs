import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../components/digital-observer/observer-live-player.tsx", import.meta.url), "utf8");
const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
const tick = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function harness({native=true}={}) {
  let now=0, cursor=0, rerender=false, effect, cleanup, timerId=0;
  const slots=[], timers=new Map(), removedTimers=[], listeners=new Map(), requests=[], hlsInstances=[], calls={play:0,src:0,fetch:0};
  const video={currentTime:0, muted:true, canPlayType:()=>native?"maybe":"", pause(){}, load(){}, removeAttribute(){}, play(){calls.play++;return Promise.resolve();}, set src(v){calls.src++;this._src=v;}, get src(){return this._src;}};
  const React={
    useRef(initial){const i=cursor++;return slots[i] ||= {current: i===0?video:initial};},
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==="function"?value(slots[i]):value;rerender=true;}];},
    useEffect(fn,deps){const i=cursor++;const old=slots[i];if(!old||deps.some((x,n)=>x!==old[n])){slots[i]=deps;effect=fn;}}
  };
  class FakeHls {static Events={MEDIA_ATTACHED:"attached",MANIFEST_PARSED:"manifest",ERROR:"error"};static isSupported(){return !native;}constructor(){this.events={};this.loads=0;this.attach=0;hlsInstances.push(this);}on(k,fn){this.events[k]=fn;}attachMedia(){this.attach++;}loadSource(){this.loads++;}destroy(){this.destroyed=true;}}
  const win={addEventListener(k,fn){if(!listeners.has(k))listeners.set(k,new Set());listeners.get(k).add(fn);},removeEventListener(k,fn){listeners.get(k)?.delete(fn);}};
  function addTimer(fn,ms,repeat){const id=++timerId;timers.set(id,{fn,ms,repeat});return id;}
  const env={exports:{},require(id){if(id==="react")return React;if(id==="hls.js")return {__esModule:true,default:FakeHls};if(id==="react/jsx-runtime")return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};if(id==="lucide-react")return new Proxy({}, {get:()=>()=>null});throw Error("unexpected import");},
    window:win,Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>addTimer(fn,ms,false),clearTimeout:id=>{if(timers.has(id))removedTimers.push(timers.get(id).fn);timers.delete(id);},setInterval:(fn,ms)=>addTimer(fn,ms,true),clearInterval:id=>timers.delete(id),
    fetch(){calls.fetch++;return new Promise((resolve,reject)=>requests.push({resolve,reject}));}};
  runInNewContext(js,env);
  let tree;
  function render(){cursor=0;effect=null;tree=env.exports.ObserverLivePlayer({observerSiteId:"site",cameraSourceId:"camera",name:"synthetic"});if(effect){cleanup?.();cleanup=effect();}rerender=false;}
  function flush(){if(rerender)render();}
  function event(name){for(const fn of listeners.get(name)||[])fn();}
  function resolve(i){requests[i].resolve({ok:true,json:async()=>({data:{playback:{hls_url:"https://example.invalid/stream"}}})});}
  function timeout(ms){return [...timers.values()].filter(t=>t.ms===ms);}
  function advance(ms){now+=ms;for(const t of [...timers.values()])if(t.repeat)t.fn();}
  function childVideo(){return tree.props.children.find(x=>x?.type==="video");}
  render();
  return {calls,requests,hlsInstances,removedTimers,event,resolve,timeout,advance,flush,childVideo,get state(){return slots.find(x=>x==="loading"||x==="playing"||x==="error");},unmount(){cleanup?.();},video};
}

test("offline fences pending native success and heartbeat, reconnects once on resume",async()=>{
 const h=harness();h.event("digital-observer:mobile-offline");h.advance(31000);h.resolve(0);await tick();
 assert.equal(h.calls.src,0);assert.equal(h.calls.play,0);assert.equal(h.timeout(5000).length,0);assert.notEqual(h.state,"error");
 h.event("digital-observer:mobile-online");h.event("digital-observer:mobile-resume");h.flush();assert.equal(h.calls.fetch,2);h.resolve(1);await tick();assert.equal(h.calls.src,1);assert.equal(h.calls.play,1);h.unmount();
});
test("suspension fences HLS attachment, late errors and stale callbacks",async()=>{
 const h=harness({native:false});h.resolve(0);await tick();const instance=h.hlsInstances[0];assert.ok(instance);h.event("digital-observer:mobile-suspend");
 instance.events.attached();instance.events.manifest();instance.events.error(null,{fatal:true});h.childVideo().props.onError();h.advance(31000);
 assert.equal(instance.loads,0);assert.equal(h.calls.play,0);assert.equal(h.timeout(5000).length,0);assert.notEqual(h.state,"error");h.unmount();
});
test("a pending HLS connection cannot attach while suspended or after unmount",async()=>{
 const h=harness({native:false});h.event("digital-observer:mobile-suspend");h.resolve(0);await tick();assert.equal(h.hlsInstances.length,0);h.unmount();
 const k=harness({native:false});k.unmount();k.resolve(0);await tick();assert.equal(k.hlsInstances.length,0);
});
test("late pre-suspension failure after resume is not reported or retried",async()=>{
 const h=harness();h.event("digital-observer:mobile-offline");h.event("digital-observer:mobile-online");h.requests[0].reject(Error("synthetic"));await tick();
 h.childVideo().props.onTimeUpdate({currentTarget:{currentTime:3}});h.childVideo().props.onError();assert.equal(h.timeout(5000).length,0);assert.notEqual(h.state,"error");assert.notEqual(h.state,"playing");h.flush();assert.equal(h.calls.fetch,2);h.resolve(1);await tick();assert.equal(h.calls.play,1);h.unmount();
});
test("pending retry, already queued retry callback, and late failure are inert while suspended",async()=>{
 const h=harness();h.requests[0].reject(Error("synthetic"));await tick();assert.equal(h.timeout(5000).length,1);const queued=h.timeout(5000)[0].fn;h.event("digital-observer:mobile-offline");queued();h.flush();
 assert.equal(h.calls.fetch,1);assert.equal(h.timeout(5000).length,0);assert.notEqual(h.state,"error");h.unmount();
 const k=harness();k.event("digital-observer:mobile-offline");k.requests[0].reject(Error("synthetic"));await tick();assert.equal(k.timeout(5000).length,0);assert.notEqual(k.state,"error");k.unmount();
});
test("an internal gateway retry scheduled before suspension cannot fetch again",async()=>{
 const h=harness();h.requests[0].resolve({ok:false,status:503,json:async()=>({})});await tick();assert.equal(h.timeout(1200).length,1);
 h.event("digital-observer:mobile-offline");h.timeout(1200)[0].fn();await tick();assert.equal(h.calls.fetch,1);assert.equal(h.timeout(5000).length,0);h.unmount();
});
test("a delayed claim response cannot start the claim request after suspension",async()=>{
 const h=harness();h.event("digital-observer:mobile-offline");h.requests[0].resolve({ok:true,json:async()=>({data:{playback:{claim_url:"https://example.invalid/playback/claim",allowed_origin:"https://example.invalid",grant:"synthetic"}}})});
 await tick();assert.equal(h.calls.fetch,1);assert.equal(h.calls.play,0);h.unmount();
});
test("active timeout schedules recovery; unmount fences late success",async()=>{
 const h=harness();h.advance(31000);assert.equal(h.timeout(5000).length,1);h.unmount();h.resolve(0);await tick();assert.equal(h.calls.src,0);assert.equal(h.calls.play,0);
});
test("active media error schedules exactly one recovery and reconnects",async()=>{
 const h=harness();h.resolve(0);await tick();h.childVideo().props.onError();h.childVideo().props.onError();assert.equal(h.timeout(5000).length,1);
 h.timeout(5000)[0].fn();h.flush();assert.equal(h.calls.fetch,2);h.resolve(1);await tick();assert.equal(h.calls.play,2);h.unmount();
});
test("active fatal HLS error retains bounded recovery",async()=>{
 const h=harness({native:false});h.resolve(0);await tick();const player=h.hlsInstances[0];player.events.error(null,{fatal:true});player.events.error(null,{fatal:true});
 assert.equal(h.timeout(5000).length,1);assert.equal(h.state,"error");h.unmount();
});

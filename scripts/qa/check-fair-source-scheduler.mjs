import assert from "node:assert/strict";
import { createFairSourceScheduler } from "../../services/video-gateway/fair-source-scheduler.mjs";

for (const count of [5, 20, 64]) {
  const sources = Array.from({ length: count }, (_, i) => ({ id: `source-${String(i).padStart(3, "0")}`, connected: true }));
  const policy = { consentVerified: true, sourceIds: sources.map(s => s.id), expiresAt: Date.now() + 60000 };
  const scheduler = createFairSourceScheduler({ maxSourcesPerRound: 5, timeoutMs: 100, roundBudgetMs: 1000 });
  const visits = new Map();
  let active = 0, peak = 0;
  const sample = async (source) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--; visits.set(source.id, (visits.get(source.id) || 0) + 1);
    return { state: "no_event", analyzedAt: new Date().toISOString(), eventCount: 0 };
  };
  for (let i = 0; i < Math.ceil(count / 5); i++) {
    const result = await scheduler.run(sources, policy, sample);
    assert.equal(result.reports.length, count);
    assert.ok(result.attempted <= 5);
    assert.equal(result.continuous_coverage, false);
    assert.ok(result.reports.filter(r=>r.state==="deferred_budget").every(r=>r.event_count===null));
  }
  assert.equal(visits.size, count, "every source gets a turn, not only the first room");
  assert.ok(peak <= 2);
  const values = [...visits.values()]; assert.ok(Math.max(...values) - Math.min(...values) <= 1);
}

const sources = ["bad", "good", "offline"].map(id=>({id,connected:id!=="offline"}));
const policy = { consentVerified: true, sourceIds: sources.map(s=>s.id), expiresAt: Date.now()+60000 };
const scheduler = createFairSourceScheduler({ timeoutMs: 15, roundBudgetMs: 100 });
const sample = async (source, signal) => {
  if (source.id === "bad") return new Promise((_, reject)=>signal.addEventListener("abort", ()=>reject(new Error("synthetic private error must not leak")), {once:true}));
  return { state: "event_detected", analyzedAt: new Date().toISOString(), eventCount: 1 };
};
const one = scheduler.run(sources, policy, sample);
assert.equal(scheduler.run(sources, policy, sample), one, "rounds are single flight");
let result = await one;
assert.equal(result.reports.find(r=>r.source_id==="bad").state,"processing_failed");
assert.equal(result.reports.find(r=>r.source_id==="good").event_count,1);
assert.equal(result.reports.find(r=>r.source_id==="offline").state,"offline");
assert.equal(JSON.stringify(result).includes("private"),false);
let called = 0;
for (const denied of [{...policy,consentVerified:false},{...policy,expiresAt:Date.now()-1},{...policy,sourceIds:[]}]) {
  result = await scheduler.run(sources,denied,async()=>{called++;});
  assert.equal(result.reports.find(r=>r.source_id==="good").state,"consent_unavailable");
}
assert.equal(called,0);
let budgetClock = 0;
const noBudgetConsent = createFairSourceScheduler({ now: () => (budgetClock += 100), timeoutMs: 10, roundBudgetMs: 10 });
const deniedBeforeWorker = await noBudgetConsent.run([sources[1]], { consentVerified: false, sourceIds: [], expiresAt: 0 }, async () => assert.fail("Denied source sampled"));
assert.equal(deniedBeforeWorker.reports[0].state, "consent_unavailable", "Exhausted budget cannot hide missing consent");
for (const response of [{state:"no_media"},{state:"no_event",eventCount:0,analyzedAt:new Date(Date.now()+60000).toISOString()},{state:"no_event",eventCount:1,analyzedAt:new Date().toISOString()}]) {
  result=await scheduler.run([sources[1]],policy,async()=>response);
  assert.equal(result.reports[0].state,response.state==="no_media"?"no_media":"processing_failed");
  assert.equal(result.reports[0].event_count,null);
}
await assert.rejects(scheduler.run([sources[1],sources[1]],policy,sample),/duplicate/);
assert.throws(()=>createFairSourceScheduler({concurrency:200}),/unsafe/);
let clock=Date.now();
const expiring=createFairSourceScheduler({now:()=>clock,timeoutMs:10,roundBudgetMs:20});
result=await expiring.run([sources[1]],{...policy,expiresAt:clock+5},async()=>{
  clock+=6;return{state:"no_event",eventCount:0,analyzedAt:new Date(clock).toISOString()};
});
assert.equal(result.reports[0].state,"consent_unavailable");
assert.equal(result.reports[0].last_analyzed_at,null);

// A policy timeout is a consent boundary, not a successful empty round.
const expiresDuringWork = createFairSourceScheduler({ timeoutMs:50, roundBudgetMs:100 });
result = await expiresDuringWork.run([sources[1]], { ...policy, expiresAt:Date.now()+10 }, async (_source, signal) =>
  new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("policy expired")), { once:true }))
);
assert.equal(result.reports[0].state,"consent_unavailable");
assert.equal(result.reports[0].event_count,null);

// A later source cannot reuse analysis from before its own attempt.
clock=Date.now();
const sampleClock=clock;
const perAttempt=createFairSourceScheduler({ now:()=>clock,concurrency:1,timeoutMs:10,roundBudgetMs:100 });
result=await perAttempt.run([{id:"first",connected:true},{id:"second",connected:true}],{
  consentVerified:true,sourceIds:["first","second"],expiresAt:clock+1000
},async(source)=>{
  if(source.id==="first"){clock+=5;return{state:"no_event",eventCount:0,analyzedAt:new Date(clock).toISOString()};}
  return{state:"no_event",eventCount:0,analyzedAt:new Date(sampleClock).toISOString()};
});
assert.equal(result.reports[0].state,"no_event");
assert.equal(result.reports[1].state,"processing_failed");
assert.equal(result.reports[1].last_analyzed_at,null);

// A task that ignores abort keeps its slot; repeated rounds cannot leak jobs.
const stalled = createFairSourceScheduler({ concurrency:1,timeoutMs:5,roundBudgetMs:20 });
let jobs=0,finish;
await stalled.run([sources[1]],policy,()=>{jobs++;return new Promise(resolve=>{finish=resolve;});});
result=await stalled.run([sources[1]],policy,()=>{jobs++;});
assert.equal(jobs,1); assert.equal(result.reports[0].state,"deferred_budget");
finish({state:"no_media"});
console.log("PASS: fair bounded 5/20/64-source rounds, consent expiry, offline/failure isolation, no-event semantics and no overlapping job leak (synthetic only)");

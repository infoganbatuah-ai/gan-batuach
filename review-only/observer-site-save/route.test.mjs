import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

test("Product onboarding denies incomplete or unauthorized submissions and issues one atomic command for save", async t => {
  const root = new URL("../../", import.meta.url);
  const mock = code => "data:text/javascript," + encodeURIComponent(code);
  const aliases = new Map([
    ["@/lib/api", new URL("lib/api.ts", root).href],
    ["@/lib/domain/digital-observer/site-templates", new URL("lib/domain/digital-observer/site-templates.ts", root).href],
    ["@/lib/domain/digital-observer/access", mock(`
      export const getDigitalObserverApiUser = () => globalThis.qaActor;
      export const getObserverSiteAccess = () => globalThis.qaCanEdit;`)],
    ["@/lib/domain/digital-observer/address-provider", mock("export const resolveObserverAddress = () => { throw Error('Unexpected provider call') }")]
  ]);
  const hooks = registerHooks({resolve(id, ctx, next) {
    if (aliases.has(id)) return {url: aliases.get(id), shortCircuit:true};
    return next(id === "next/server" ? "next/server.js" : id, ctx);
  }});
  t.after(() => { hooks.deregister(); delete globalThis.qaActor; delete globalThis.qaCanEdit; });
  const {POST} = await import("../../app/api/digital-observer/onboarding/route.ts");
  const site = "00000000-0000-4000-8000-000000000001";
  const pack = "00000000-0000-4000-8000-000000000002";
  const calls = [];
  let reply = {error:{code:"PGRST202"}};
  globalThis.qaActor = {observerAccount:{account_type:"home"},profile:{id:site},supabase:{
    rpc(name, args) { calls.push({name,args}); return reply; }
  }};
  const post = args => POST(new Request("https://fixture.invalid/api/digital-observer/onboarding", {
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({name:"QA Home",site_type:"home",city:"QA",street:"Fixture",building_number:"1",...args})
  }));
  assert.equal((await post({})).status, 400);
  assert.equal((await post({package_id:pack,observer_site_id:site})).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await post({package_id:pack})).status, 503);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "save_observer_onboarding_atomic");
  assert.equal(calls[0].args.target_site, null);
  assert.equal(calls[0].args.target_package, pack);
  assert.equal(calls[0].args.site_patch.monitoring_enabled, false);
  reply = {data:{site:{id:site},trial:{id:pack}},error:null};
  globalThis.qaCanEdit=true;
  assert.equal((await post({package_id:pack,observer_site_id:site})).status, 200);
  assert.equal(calls.at(-1).args.target_site, site);
  assert.equal((await post({package_id:pack})).status, 201);
  assert.equal(calls.length, 3);
});

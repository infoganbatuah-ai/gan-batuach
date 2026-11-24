import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

test("Product onboarding denies incomplete or unauthorized submissions and issues one atomic command for save", async t => {
  const root = new URL("../../", import.meta.url);
  const mock = code => "data:text/javascript," + encodeURIComponent(code);
  const aliases = new Map([
    ["@/lib/domain/digital-observer/onboarding-writer", mock("export const submitOwnerSiteSave = (...args) => globalThis.qaWrite(...args)")],
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
  t.after(() => { hooks.deregister(); delete globalThis.qaActor; delete globalThis.qaCanEdit; delete globalThis.qaWrite; });
  const {POST} = await import("../../app/api/digital-observer/onboarding/route.ts");
  const site = "00000000-0000-4000-8000-000000000001";
  const pack = "00000000-0000-4000-8000-000000000002";
  const calls = [];
  let reply = {error:{code:"PGRST202"}};
  globalThis.qaActor = {observerAccount:{account_type:"home"},profile:{id:site},supabase:{
    auth:{getClaims() {return {data:{claims:{role:"authenticated",sub:site,session_id:pack,exp:2000000000}}};}}
  }};
  globalThis.qaWrite = (claims, submission, input, args) => { calls.push({claims,submission,input,args}); return reply; };
  const post = args => POST(new Request("https://fixture.invalid/api/digital-observer/onboarding", {
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({submission_id:pack,name:"QA Home",site_type:"home",city:"QA",street:"Fixture",building_number:"1",...args})
  }));
  assert.equal((await post({})).status, 400);
  assert.equal((await post({package_id:pack,observer_site_id:site})).status, 403);
  assert.equal(calls.length, 0);
  assert.equal((await post({package_id:pack})).status, 503);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].claims.sub, site);
  assert.equal(calls[0].submission, pack);
  assert.equal(calls[0].args.target_site, null);
  assert.equal(calls[0].args.target_package, pack);
  assert.equal(calls[0].args.site_patch.monitoring_enabled, false);
  reply = {data:{site:{id:site},trial:{id:pack}},error:null};
  globalThis.qaCanEdit={owner_profile_id:pack};
  assert.equal((await post({package_id:pack,observer_site_id:site})).status, 403);
  globalThis.qaCanEdit={owner_profile_id:site};
  assert.equal((await post({package_id:pack,observer_site_id:site})).status, 200);
  assert.equal(calls.at(-1).args.target_site, site);
  assert.equal((await post({package_id:pack})).status, 201);
  assert.equal(calls.length, 3);
});

test("private transport accepts only a local scoped writer and preserves request identity across retries", async t => {
  const hooks = registerHooks({resolve(id,ctx,next) {
    if (id === "server-only") return {url:"data:text/javascript,export{}",shortCircuit:true};
    return next(id,ctx);
  }});
  t.after(() => hooks.deregister());
  const {submitOwnerSiteSave} = await import("../../lib/domain/digital-observer/onboarding-writer.ts");
  const fixtureToken = role => ["e30",Buffer.from(JSON.stringify({role,exp:2000000000})).toString("base64url"),"fixture"].join(".");
  const env = {...process.env, NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:54321", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture",
    OBSERVER_LOCAL_SITE_SAVE_CALLER_TOKEN:fixtureToken("observer_site_save_caller")};
  t.mock.property(process,"env",env);
  const sent = [];
  t.mock.method(globalThis,"fetch", async (url, init) => {
    assert.equal(url.href, "http://127.0.0.1:54321/rest/v1/rpc/submit_observer_site_save");
    assert.equal(init.redirect, "error");
    sent.push(JSON.parse(init.body));
    return Response.json({site:{id:"fixture"},trial:{}});
  });
  const send = name => submitOwnerSiteSave({sub:"actor",session_id:"session",exp:2000000000},"key",{name},{verified_actor:"untrusted"});
  assert.equal((await send("Home")).error, null);
  assert.equal((await send("Home")).error, null);
  assert.equal((await send("Edited")).error, null);
  assert.deepEqual(sent[0],sent[1]);
  assert.notEqual(sent[0].request_digest,sent[2].request_digest);
  assert.equal(sent[0].verified_actor,"actor");
  env.OBSERVER_LOCAL_SITE_SAVE_CALLER_TOKEN=fixtureToken("service_role");
  assert.equal((await send("Home")).error.code,"WRITER_UNAVAILABLE");
  env.OBSERVER_LOCAL_SITE_SAVE_CALLER_TOKEN=fixtureToken("observer_site_save_caller");
  env.NEXT_PUBLIC_SUPABASE_URL="https://hosted.invalid";
  assert.equal((await send("Home")).error.code,"WRITER_UNAVAILABLE");
  assert.equal(sent.length,3);
});

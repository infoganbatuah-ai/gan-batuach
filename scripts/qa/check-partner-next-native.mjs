import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, sep } from "node:path";
import test from "node:test";
import ts from "typescript";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { closeLoopback, openLoopback, startNext } from "./partner-next-runtime.mjs";

const require = createRequire(import.meta.url);
const { DigitalObserverServerClient } = loadTs("packages/digital-observer-sdk/src/index.ts");
const dashboardPath = "/api/digital-observer/embed/v1/dashboard";
const sdkPath = "/embedded-sdk.js";
const browserSdk = ts.transpileModule(readFileSync(new URL("../../packages/digital-observer-sdk/src/browser.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

function nativeStack() {
  // Opt-in only. A native test requires the stopped-after-use stack from its
  // own replay directory and must never infer a target from application env.
  const root = realpathSync(process.env.PARTNER_NATIVE_RUN_DIR);
  assert.match(root, /\/\.dev-cache\/tmp\/push43-native\.[A-Za-z0-9]+$/);
  const state = JSON.parse(readFileSync(join(root, "state.json"), "utf8"));
  assert.equal(state.runtime, "native");
  assert.equal(state.identity.name, "push43-replay");
  assert.equal(realpathSync(state.identity.project_root), join(root, "project"));
  const expectedMigration = "20261127162335_digital_observer_push43_current_usage_scope.sql";
  assert.equal(JSON.parse(readFileSync(join(root, "applied.json"), "utf8")).at(-1), expectedMigration);
  const db = new URL(state.env.DB_URL);
  const api = new URL(state.env.API_URL);
  for (const url of [db, api]) {
    assert.equal(url.hostname, "127.0.0.1");
    assert.ok(Number(url.port) >= 20000 && Number(url.port) <= 32767);
  }
  assert.equal(db.protocol, "postgresql:");
  assert.equal(db.pathname, "/postgres");
  assert.equal(api.href, `${api.origin}/`);
  assert.equal(api.protocol, "http:");
  const binary = realpathSync(process.env.PARTNER_NATIVE_PSQL);
  assert.ok(binary.startsWith(join(root, "cli-state", "cache") + sep));
  function sql(statement) {
    return execFileSync(binary, ["-X", "-qAt", "-1", "-v", "ON_ERROR_STOP=1"], {
      input: statement, encoding: "utf8", timeout: 10_000,
      env: { PATH: process.env.PATH, TMPDIR: join(root, "temp"), PGHOST: db.hostname, PGPORT: db.port,
        PGUSER: decodeURIComponent(db.username), PGPASSWORD: decodeURIComponent(db.password),
        PGDATABASE: "postgres", PGCONNECT_TIMEOUT: "5" },
    }).trim();
  }
  const data = realpathSync(sql("show data_directory;"));
  assert.ok(data.startsWith(join(root, "cli-state", "stacks", state.identity.id) + sep));
  assert.match(sql("show server_version;"), /^17\./);
  return { sql, api: api.origin, publishableKey: state.env.PUBLISHABLE_KEY, serviceRoleKey: state.env.SERVICE_ROLE_KEY };
}

async function createOwner(stack, label) {
  const response = await fetch(`${stack.api}/auth/v1/admin/users`, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(20_000),
    headers: { apikey: stack.serviceRoleKey, authorization: `Bearer ${stack.serviceRoleKey}`, "content-type": "application/json" },
    body: JSON.stringify({ email: `${label}-${randomUUID()}@example.invalid`,
      password: `Fixture_${randomBytes(24).toString("hex")}`, email_confirm: true }),
  });
  assert.ok(response.ok, `Synthetic Auth creation returned ${response.status}`);
  const { id } = await response.json();
  assert.match(id, /^[a-f0-9-]{36}$/);
  return id;
}

test("the signed SDK and Chrome embed cross Next and native Supabase", { timeout: 120_000 }, async (t) => {
  const stack = nativeStack();
  const host = createServer((request, response) => {
    if (request.url === "/") return response.writeHead(200, { "content-type": "text/html", "set-cookie": "fixture=partner; Path=/" })
      .end("<!doctype html><title>Synthetic partner dashboard</title>");
    if (request.url === sdkPath) return response.writeHead(200, { "content-type": "text/javascript" }).end(browserSdk);
    return response.writeHead(404).end();
  });
  const hostOrigin = `http://127.0.0.1:${await openLoopback(host)}`;
  t.after(() => closeLoopback(host));
  const pepper = randomBytes(24).toString("hex");
  const signedCredential = `dosvc_${randomBytes(24).toString("base64url")}`;
  const embedToken = `doemb_${randomBytes(24).toString("base64url")}`;
  const laterToken = `doemb_${randomBytes(24).toString("base64url")}`;
  const hash = (token) => createHmac("sha256", pepper).update(token).digest("hex");
  const [partnerOwner, customerOwner] = await Promise.all([createOwner(stack, "partner"), createOwner(stack, "customer")]);
  const [org, tenant, otherTenant, partner, customer, site, otherSite, account, cameraA, cameraB, outsider, subscription, session, later] =
    Array.from({ length: 14 }, () => randomUUID());
  const tag = randomBytes(6).toString("hex");
  stack.sql(`
    insert into public.digital_observer_organizations(id,owner_profile_id,name,organization_type,slug,status)
      values ('${org}','${partnerOwner}','Synthetic partner','business','qa-partner-${tag}','active'),
      ('${tenant}','${customerOwner}','Synthetic customer','business','qa-customer-${tag}','active'),
      ('${otherTenant}','${customerOwner}','Synthetic other tenant','business','qa-other-${tag}','active');
    insert into public.observer_sites(id,name,site_type,owner_profile_id,digital_observer_organization_id,monitoring_enabled)
      values ('${site}','Synthetic Site','business','${customerOwner}','${tenant}',false),
      ('${otherSite}','Outside Site','business','${customerOwner}','${otherTenant}',false);
    insert into public.observer_site_subscriptions(id,observer_site_id,status,subscription_status,trial_start,trial_end,
      entitlement_status,payment_provider,payment_provider_mode,provider_outcome,commercial_state,entitlement_snapshot,package_limits_snapshot)
      values ('${subscription}','${site}','trial','trial',now(),now()+interval '1 day','trial','mock','disabled','none',
      'trial','{"api_access":true}','{"api_access":true}');
    insert into public.digital_observer_camera_sources(id,observer_site_id,display_name,source_mode,created_at)
      values ('${cameraA}','${site}','A','demo','2026-11-27T10:02:00Z'),
      ('${cameraB}','${site}','B','demo','2026-11-27T10:01:00Z'),
      ('${outsider}','${otherSite}','Outside','demo','2026-11-27T10:03:00Z');
    insert into public.digital_observer_partners(id,organization_id,partner_key,partner_type,allowed_embed_origins)
      values ('${partner}','${org}','qa-partner-${tag}','oem','["${hostOrigin}"]');
    insert into public.digital_observer_partner_customers(id,partner_id,customer_organization_id,external_customer_reference_hash,
      external_customer_reference_hint,idempotency_key,customer_status)
      values ('${customer}','${partner}','${tenant}','${hash(customer)}','synthetic','fixture-${tag}','active');
    insert into public.digital_observer_partner_customer_sites(partner_customer_id,observer_site_id) values ('${customer}','${site}');
    insert into public.digital_observer_service_accounts(id,organization_id,display_name,permissions,expires_at,created_by)
      values ('${account}','${org}','Synthetic SDK','["camera.live.view"]',now()+interval '1 day','${partnerOwner}');
    insert into public.digital_observer_service_account_sites(service_account_id,observer_site_id) values ('${account}','${site}');
    insert into public.digital_observer_service_account_credentials(service_account_id,credential_hash,credential_prefix,expires_at,created_by)
      values ('${account}','${hash(signedCredential)}','${signedCredential.slice(0, 14)}',now()+interval '1 day','${partnerOwner}');
    insert into public.digital_observer_partner_service_accounts(partner_id,service_account_id,partner_customer_id,access_kind)
      values ('${partner}','${account}','${customer}','customer_resources');
    insert into public.digital_observer_embedded_sessions(id,partner_id,partner_customer_id,observer_site_id,token_hash,token_prefix,
      audience,allowed_origin,scopes,expires_at)
      values ('${session}','${partner}','${customer}','${site}','${hash(embedToken)}','synthetic','fixture','${hostOrigin}','["cameras.read"]',now()+interval '10 minutes'),
      ('${later}','${partner}','${customer}','${site}','${hash(laterToken)}','synthetic','fixture','${hostOrigin}','["cameras.read"]',now()+interval '10 minutes');
  `);

  const { endpoint } = await startNext(t, { supabaseUrl: stack.api, publishableKey: stack.publishableKey, serviceRoleKey: stack.serviceRoleKey, pepper });
  const sdk = new DigitalObserverServerClient({ baseUrl: `${endpoint}/api/digital-observer/external/v1`, credential: signedCredential,
    fetch: async (url, init) => {
      const response = await fetch(url, { ...init, redirect: "error" });
      assert.match(response.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
      return response;
    } });
  const first = await sdk.request(`/cameras?site_id=${site}&limit=1`);
  assert.deepEqual(first.data.map(({ id }) => id), [cameraA]);
  assert.ok(first.pagination.next_cursor);
  const second = await sdk.request(`/cameras?site_id=${site}&limit=1&cursor=${first.pagination.next_cursor}`);
  assert.deepEqual(second.data.map(({ id }) => id), [cameraB]);
  assert.equal(second.pagination.next_cursor, null);
  assert.equal(stack.sql(`select sum(request_count) from public.digital_observer_external_api_usage_buckets where service_account_id='${account}';`), "2");

  const { chromium } = require(process.env.EMBEDDED_QA_PLAYWRIGHT_MODULE || "playwright");
  const browser = await chromium.launch({ executablePath: process.env.EMBEDDED_QA_CHROME || undefined,
    args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--no-proxy-server"], timeout: 10_000 });
  try {
    const page = await browser.newPage();
    await page.goto(hostOrigin);
    assert.equal(await page.evaluate(() => document.cookie), "fixture=partner");
    const target = `${endpoint}${dashboardPath}`;
    const dashboard = (token) => page.evaluate(async ({ endpoint, sdkPath, token }) => {
      const { DigitalObserverEmbeddedClient } = await import(sdkPath);
      const client = new DigitalObserverEmbeddedClient({ endpoint, token, audience: "fixture" });
      try {
        const data = await client.dashboard();
        return { site: data.site.id, cameras: data.cameras.map(({ id }) => id), rawVideo: data.raw_video_embedded };
      } catch (error) {
        return { error: error.name };
      }
    }, { endpoint: target, sdkPath, token });
    const preflight = await fetch(target, { method: "OPTIONS", headers: {
      origin: hostOrigin, "access-control-request-method": "GET", "access-control-request-headers": "authorization,x-do-audience",
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), hostOrigin);
    const [ok, data] = await Promise.all([
      page.waitForResponse((response) => response.url() === target && response.request().method() === "GET"),
      dashboard(embedToken),
    ]);
    assert.deepEqual(data, { site, cameras: [cameraA, cameraB], rawVideo: false });
    assert.equal(ok.status(), 200);
    assert.match((await ok.allHeaders())["x-request-id"], /^[a-f0-9-]{36}$/);
    assert.equal((await ok.request().allHeaders()).cookie, undefined);
    const denied = async (token, code) => {
      assert.deepEqual(await dashboard(token), { error: "TypeError" });
      const response = await fetch(target, { headers: { origin: hostOrigin, "x-do-audience": "fixture", authorization: `Bearer ${token}` } });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, code);
    };
    stack.sql(`update public.digital_observer_embedded_sessions set revoked_at=now() where id='${session}';`);
    await denied(embedToken, "EMBEDDED_SESSION_INACTIVE");
    stack.sql(`update public.observer_sites set digital_observer_organization_id='${otherTenant}' where id='${site}';`);
    await denied(laterToken, "EMBEDDED_SITE_SCOPE_DENIED");
    await assert.rejects(sdk.cameras(site), { status: 403 });
    assert.equal(stack.sql(`select sum(request_count) from public.digital_observer_external_api_usage_buckets where service_account_id='${account}';`), "2");
    t.diagnostic(`Chrome ${browser.version()}: preflight 204, dashboard 200, revoked and transferred requests denied; signed SDK paged twice.`);
  } finally {
    await browser.close();
  }
});

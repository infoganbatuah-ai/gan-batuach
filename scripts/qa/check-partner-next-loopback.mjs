import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { asRole, currentScope, partnerPostgresFixture, partnerPostgresIds } from "./partner-postgres-fixture.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const { DigitalObserverServerClient } = loadTs("packages/digital-observer-sdk/src/index.ts");
const { DigitalObserverEmbeddedClient } = loadTs("packages/digital-observer-sdk/src/browser.ts");
const external = "/api/digital-observer/external/v1";
const embed = "/api/digital-observer/embed/v1/dashboard";
const { orgA: owner, orgB: otherOwner, partnerOrg, partnerId, customer, account, site } = partnerPostgresIds;
const [otherSite, cameraA, cameraB, outsider] = Array.from({ length: 4 }, (_, i) =>
  `10000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`);
const serviceToken = "dosvc_synthetic_next_fixture_only_not_a_real_account";
const embedToken = "doemb_synthetic_next_only";
const pepper = "offline-next-synthetic-pepper";
const apiKey = "synthetic-service-key";
const origin = "https://partner.example.invalid";
const audience = "synthetic-partner";
const expiresAt = new Date(Date.now() + 600_000).toISOString();
const digest = (token) => createHmac("sha256", pepper).update(token).digest("hex");

async function open(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function restFixture(t, database) {
  const receipts = [];
  const restErrors = [];
  const audits = [];
  const meters = [];
  const siteRow = { id: site, digital_observer_organization_id: owner, garden_id: null, site_type: "home" };
  const session = { id: "embedded-session", partner_id: "partner", partner_customer_id: "customer", observer_site_id: site,
    token_hash: digest(embedToken), expires_at: expiresAt, revoked_at: null, audience, allowed_origin: origin, scopes: ["cameras.read"],
    digital_observer_partner_customers: { customer_status: "active", partner_id: "partner", customer_organization_id: owner },
    digital_observer_partners: { partner_status: "sandbox", allowed_embed_origins: [origin] } };
  const tables = {
    audit_logs: audits,
    digital_observer_enterprise_audit_events: [],
    digital_observer_external_api_request_receipts: receipts,
    digital_observer_service_account_credentials: [{ id: "service-credential", service_account_id: account,
      credential_hash: digest(serviceToken), expires_at: expiresAt, revoked_at: null }],
    digital_observer_service_accounts: [{ id: account, organization_id: partnerOrg, account_status: "active", expires_at: expiresAt,
      revoked_at: null, all_sites: false, permissions: ["camera.live.view"] }],
    digital_observer_service_account_sites: [{ service_account_id: account, observer_site_id: site }],
    digital_observer_partner_service_accounts: [{ service_account_id: account, partner_id: partnerId, partner_customer_id: customer,
      access_kind: "customer_resources", digital_observer_partner_customers: { id: customer, partner_id: partnerId,
        customer_status: "active", customer_organization_id: owner,
        digital_observer_partners: { organization_id: partnerOrg, partner_status: "sandbox" } } }],
    digital_observer_embedded_sessions: [session],
    digital_observer_partner_customer_sites: [
      { partner_customer_id: "customer", observer_site_id: site },
      { partner_customer_id: customer, observer_site_id: site },
    ],
    digital_observer_partner_brand_profiles: [],
    observer_sites: [siteRow],
    observer_site_subscriptions: [{ id: "subscription", observer_site_id: site, commercial_state: "active", entitlement_snapshot: { api_access: true } }],
    digital_observer_camera_sources: [
      { id: cameraA, observer_site_id: site, display_name: "A", source_mode: "demo", created_at: "2026-11-27T10:02:00Z" },
      { id: cameraB, observer_site_id: site, display_name: "B", source_mode: "demo", created_at: "2026-11-27T10:01:00Z" },
      { id: outsider, observer_site_id: otherSite, display_name: "outside", source_mode: "demo", created_at: "2026-11-27T10:03:00Z" },
    ],
  };
  const counters = { cameraQueries: 0 };
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      assert.equal(request.headers.apikey, apiKey);
      const method = request.method;
      const table = url.pathname.slice("/rest/v1/".length);
      assert.ok(url.pathname.startsWith("/rest/v1/"));
      if (table === "rpc/record_digital_observer_external_api_usage") {
        assert.equal(method, "POST");
        const args = await jsonBody(request);
        const values = [
          args.requested_service_account_id, args.requested_site_id, args.requested_operation,
          args.requested_bucket_start, args.requested_success,
        ];
        assert.deepEqual(values.slice(0, 3), [account, site, "cameras.list"]);
        assert.equal(typeof args.requested_success, "boolean");
        response.setHeader("content-type", "application/json");
        try {
          const result = await asRole(database, "service_role", "", `
            select public.record_digital_observer_external_api_usage($1,$2,$3,$4,$5) as receipt`, values);
          meters.push({ allowed: true, success: args.requested_success });
          return response.writeHead(200).end(JSON.stringify(result.rows[0].receipt));
        } catch (error) {
          if (error.code !== "P0001" || error.message !== "service account/site mismatch") throw error;
          meters.push({ allowed: false, success: args.requested_success });
          return response.writeHead(400).end(JSON.stringify({ code: error.code, message: error.message }));
        }
      }
      assert.ok(Object.hasOwn(tables, table), `Unexpected REST resource: ${table}`);
      if (table === "digital_observer_camera_sources") counters.cameraQueries++;
      const query = url.searchParams;
      let rows = tables[table].filter((row) => [...query].every(([key, expression]) => {
        const dot = expression.indexOf(".");
        const value = expression.slice(dot + 1);
        if (["select", "limit", "offset", "order"].includes(key)) return true;
        switch (expression.slice(0, dot)) {
          case "eq": return String(row[key]) === value;
          case "is": return value === "null" && row[key] === null;
          case "neq": return String(row[key]) !== value;
          case "gt": return row[key] > value;
          case "gte": return row[key] >= value;
          default: assert.fail(`Unhandled fixture filter on ${key}`);
        }
      }));
      if (method === "HEAD") return response.writeHead(200, { "content-range": `*/${rows.length}` }).end();
      if (method === "PATCH" || method === "POST") {
        const input = await jsonBody(request);
        if (method === "POST") {
          rows = [{ id: randomUUID(), created_at: new Date().toISOString(), ...input }];
          tables[table].push(...rows);
        } else {
          rows.forEach((row) => Object.assign(row, input));
        }
        if (!(request.headers.prefer ?? "").includes("return=representation")) return response.writeHead(204).end();
      } else {
        assert.equal(method, "GET");
      }
      const order = query.get("order");
      if (order) {
        const [name, direction] = order.split(".");
        rows.sort((a, b) => String(a[name]).localeCompare(String(b[name])) * (direction === "desc" ? -1 : 1));
      }
      const offset = Number(query.get("offset") ?? 0);
      rows = rows.slice(offset, offset + Number(query.get("limit") ?? rows.length));
      const selected = query.get("select");
      if (selected && selected !== "*" && table !== "digital_observer_partner_service_accounts") {
        const columns = selected.replaceAll(/\([^)]*\)/g, "").split(",").map((column) => column.split("!")[0]);
        rows = rows.map((row) => Object.fromEntries(columns.filter((column) => Object.hasOwn(row, column)).map((column) => [column, row[column]])));
      }
      const single = (request.headers.accept ?? "").includes("application/vnd.pgrst.object+json");
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(single ? rows[0] ?? null : rows));
    } catch (error) {
      restErrors.push(error.message);
      t.diagnostic(error.message);
      response.writeHead(500).end();
    }
  });
  return { server, session, siteRow, audits, restErrors, counters, meters };
}

async function jsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function startNext(t, supabaseUrl) {
  const directory = mkdtempSync(join(root, ".partner-next-"));
  const projectPath = (relative) => join(directory, relative);
  let child;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  });
  for (const file of ["proxy.ts", `app${external}/[...segments]/route.ts`, `app${embed}/route.ts`]) {
    mkdirSync(dirname(projectPath(file)), { recursive: true });
    cpSync(join(root, file), projectPath(file));
  }
  for (const link of ["node_modules", "lib"]) symlinkSync(join(root, link), projectPath(link), "dir");
  writeFileSync(projectPath("package.json"), '{"private":true}');
  writeFileSync(projectPath("next.config.mjs"), "export default { devIndicators: false };\n");
  writeFileSync(projectPath("tsconfig.json"), JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] }, moduleResolution: "bundler" },
  }));
  const reservation = createServer();
  const port = await open(reservation);
  await close(reservation);
  const endpoint = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: directory,
    env: { PATH: process.env.PATH, TMPDIR: directory, NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "synthetic-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: apiKey, DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER: pepper },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (data) => { logs = (logs + data).slice(-12_000); });
  child.stderr.on("data", (data) => { logs = (logs + data).slice(-12_000); });
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const ready = await fetch(`${endpoint}${external}/openapi.json`, { signal: AbortSignal.timeout(30_000) });
      if (ready.ok) return { endpoint, logs: () => logs };
    } catch (error) {
      if (!["ECONNREFUSED", "ECONNRESET"].includes(error.cause?.code)) break;
    }
    await sleep(250);
  }
  throw new Error(`Isolated Next did not start: ${logs}`);
}

test("SDK requests cross Next middleware and meter only current delegated usage in PostgreSQL", { timeout: 120_000 }, async (t) => {
  const database = await partnerPostgresFixture(t);
  await database.exec(currentScope);
  const fixture = restFixture(t, database);
  const restPort = await open(fixture.server);
  t.after(() => close(fixture.server));
  const { endpoint, logs } = await startNext(t, `http://127.0.0.1:${restPort}`);
  try {
    const requestIds = new Set();
    const server = new DigitalObserverServerClient({ baseUrl: `${endpoint}${external}`, credential: serviceToken, fetch: async (url, init) => {
      const response = await fetch(url, init);
      const id = response.headers.get("x-request-id");
      assert.match(id, /^[a-f0-9-]{36}$/);
      requestIds.add(id);
      return response;
    } });
    const page1 = await server.request(`/cameras?site_id=${site}&limit=1`);
    assert.deepEqual(page1.data.map(({ id }) => id), [cameraA]);
    assert.ok(page1.pagination.next_cursor);
    const page2 = await server.request(`/cameras?site_id=${site}&limit=1&cursor=${page1.pagination.next_cursor}`);
    assert.deepEqual(page2.data.map(({ id }) => id), [cameraB]);
    assert.equal(page2.pagination.next_cursor, null);
    assert.equal(requestIds.size, 2);
    assert.deepEqual(fixture.meters, [{ allowed: true, success: true }, { allowed: true, success: true }]);

    // Leave the earlier application reads unchanged to isolate the case
    // where the durable authority changes before the meter runs.
    const requestDenied = { status: 503, message: "EXTERNAL_API_USAGE_WRITE_FAILED" };
    await database.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [otherOwner, site]);
    await assert.rejects(server.cameras(site), requestDenied);
    assert.deepEqual(fixture.meters.at(-2), { allowed: false, success: true });
    assert.deepEqual(fixture.meters.at(-1), { allowed: false, success: false });
    await database.query("update public.observer_sites set digital_observer_organization_id=$1 where id=$2", [owner, site]);
    await database.query("update public.digital_observer_service_accounts set revoked_at=now(), account_status='revoked' where id=$1", [account]);
    await assert.rejects(server.cameras(site), requestDenied);
    assert.deepEqual(fixture.meters.at(-2), { allowed: false, success: true });
    assert.deepEqual(fixture.meters.at(-1), { allowed: false, success: false });
    const totals = await database.query(`select sum(request_count)::int as requests, sum(success_count)::int as successes,
      sum(failure_count)::int as failures from public.digital_observer_external_api_usage_buckets where service_account_id=$1`, [account]);
    assert.deepEqual(totals.rows, [{ requests: 2, successes: 2, failures: 0 }]);

    const preflight = await fetch(`${endpoint}${embed}`, { method: "OPTIONS", headers: {
      origin, "access-control-request-method": "GET", "access-control-request-headers": "authorization,x-do-audience",
    } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
    assert.match(preflight.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
    const browser = new DigitalObserverEmbeddedClient({ endpoint: `${endpoint}${embed}`, token: embedToken, audience, fetch: async (url, init) => {
      const headers = new Headers(init.headers);
      headers.set("origin", origin);
      const response = await fetch(url, { ...init, headers });
      assert.match(response.headers.get("x-request-id"), /^[a-f0-9-]{36}$/);
      assert.equal(response.headers.get("access-control-allow-origin"), response.ok ? origin : null);
      return response;
    } });
    const allowed = await browser.dashboard();
    assert.equal(allowed.site.id, site);
    assert.deepEqual(allowed.cameras.map(({ id }) => id), [cameraA, cameraB]);
    const priorCameraReads = fixture.counters.cameraQueries;
    fixture.session.revoked_at = new Date().toISOString();
    await assert.rejects(browser.dashboard(), /EMBEDDED_SESSION_INACTIVE/);
    fixture.session.revoked_at = null;
    fixture.siteRow.digital_observer_organization_id = "other-tenant";
    await assert.rejects(browser.dashboard(), /EMBEDDED_SITE_SCOPE_DENIED/);
    assert.equal(fixture.counters.cameraQueries, priorCameraReads);
    const until = Date.now() + 2000;
    while (!fixture.audits.some((row) => row.api_endpoint === embed) && Date.now() < until) await sleep(25);
    assert.ok(fixture.audits.some((row) => row.api_endpoint === embed && row.compliance_context?.source === "next_proxy"));
    assert.deepEqual(fixture.restErrors, []);
  } catch (error) {
    t.diagnostic(logs());
    throw error;
  }
});

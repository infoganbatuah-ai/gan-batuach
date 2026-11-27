import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { audience, camerasTable, embeddedDashboardFixture, token } from "./embedded-dashboard-fixture.mjs";

const require = createRequire(import.meta.url);
const dashboardPath = "/api/digital-observer/embed/v1/dashboard";
const sdkPath = "/embedded-sdk.js";
const browserSdk = ts.transpileModule(readFileSync(new URL("../../packages/digital-observer-sdk/src/browser.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;

async function listen(t, handler) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

test("Chrome applies CORS before embedding and withholds data after revocation or Site transfer", { timeout: 30_000 }, async (t) => {
  const { chromium } = require(process.env.EMBEDDED_QA_PLAYWRIGHT_MODULE || "playwright");
  const hostOrigin = await listen(t, (req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Set-Cookie": "fixture=partner; SameSite=Lax; Path=/" });
      res.end("<!doctype html><title>Synthetic partner dashboard</title>");
    } else if (req.url === sdkPath) {
      res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
      res.end(browserSdk);
    } else {
      res.writeHead(404).end();
    }
  });

  const { GET, OPTIONS, state } = embeddedDashboardFixture(hostOrigin);
  const requests = [];
  const apiOrigin = await listen(t, async (req, res) => {
    const route = req.method === "OPTIONS" ? OPTIONS : GET;
    if (req.url !== dashboardPath || !["GET", "OPTIONS"].includes(req.method)) return res.writeHead(404).end();
    try {
      const response = await route(new Request(`http://${req.headers.host}${req.url}`, {
        method: req.method, headers: req.headers,
      }));
      const error = response.ok ? null : (await response.clone().json()).error?.code ?? null;
      requests.push({
        method: req.method, origin: req.headers.origin, cookie: Boolean(req.headers.cookie),
        authorization: Boolean(req.headers.authorization), requestedMethod: req.headers["access-control-request-method"],
        requestedHeaders: req.headers["access-control-request-headers"], status: response.status,
        allowOrigin: response.headers.get("access-control-allow-origin"), error,
      });
      res.writeHead(response.status, Object.fromEntries(response.headers)).end(await response.text());
    } catch (error) {
      t.diagnostic(`Local HTTP adapter failed: ${error.message}`);
      res.writeHead(500).end();
    }
  });
  assert.notEqual(hostOrigin, apiOrigin);

  const browser = await chromium.launch({
    executablePath: process.env.EMBEDDED_QA_CHROME || undefined,
    args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1", "--no-proxy-server"],
    timeout: 10_000,
  });
  try {
    const page = await browser.newPage();
    await page.goto(hostOrigin, { timeout: 5_000 });
    assert.equal(await page.evaluate(() => document.cookie), "fixture=partner");
    const dashboard = () => page.evaluate(async ({ endpoint, sdkPath, token, audience }) => {
      const { DigitalObserverEmbeddedClient } = await import(sdkPath);
      const client = new DigitalObserverEmbeddedClient({ endpoint, token, audience });
      try {
        const result = await client.dashboard();
        return { contract: result.contract, siteId: result.site.id, cameras: result.cameras.map(({ id }) => id), rawVideo: result.raw_video_embedded };
      } catch (error) {
        return { error: error.name, message: error.message };
      }
    }, { endpoint: `${apiOrigin}${dashboardPath}`, sdkPath, token, audience });

    const authorized = await dashboard();
    if (authorized.error) t.diagnostic(JSON.stringify({ authorized, requests }));
    assert.deepEqual(authorized, {
      contract: "digital-observer-embedded-v1", siteId: "site", cameras: ["expected-camera"], rawVideo: false,
    });
    assert.deepEqual(requests.slice(0, 2).map(({ method, status }) => [method, status]), [["OPTIONS", 204], ["GET", 200]]);
    assert.equal(requests[0].requestedMethod, "GET");
    assert.deepEqual(requests[0].requestedHeaders?.split(",").map((header) => header.trim()).sort(), ["authorization", "x-do-audience"]);
    assert.equal(requests[0].authorization, false);
    assert.equal(requests[1].authorization, true);
    assert.equal(requests[1].allowOrigin, hostOrigin);

    state.session.revoked_at = new Date().toISOString();
    assert.equal((await dashboard()).error, "TypeError");
    assert.equal(requests.at(-1).error, "EMBEDDED_SESSION_INACTIVE");
    assert.equal(requests.at(-1).status, 403);
    assert.equal(requests.at(-1).allowOrigin, null);

    // Reset the synthetic revocation to test site transfer independently with the same issued token.
    state.session.revoked_at = null;
    state.siteOrg = "other-tenant";
    assert.equal((await dashboard()).error, "TypeError");
    assert.equal(requests.at(-1).error, "EMBEDDED_SITE_SCOPE_DENIED");
    assert.equal(requests.at(-1).status, 403);
    assert.equal(requests.at(-1).allowOrigin, null);
    assert.equal(requests.filter(({ method }) => method === "GET").length, 3);
    assert.ok(requests.every(({ origin, cookie }) => origin === hostOrigin && !cookie));
    assert.equal(state.reads.filter((table) => table === camerasTable).length, 1);
    t.diagnostic(`Chrome ${browser.version()} recorded preflight 204, authorized GET 200, revoked GET 403, transferred Site GET 403.`);
  } finally {
    await browser.close();
  }
});

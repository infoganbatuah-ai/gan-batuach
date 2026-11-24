// Run on macOS with Xcode and the repository's Node dependencies. No provider connection.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as createTlsServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createQaProxy } from "../push44-owner-qa-proxy.mjs";
import { observerQaRedirect, observerQaRouteAllowed } from "../push44-observer-qa-ingress-policy.mjs";
import { resolveObserverLoginContext } from "../../../lib/domain/digital-observer/observer-login-auth.ts";
import { approvalCookie } from "./owner-approval.mjs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { NextRequest } from "next/server.js";
import { createServerClient } from "@supabase/ssr";
import {
  prepareObserverQaAuthConfig, OBSERVER_QA_ORIGIN as origin, OBSERVER_QA_BUNDLE_ID as bundleId,
  OBSERVER_QA_CALLBACK as callback
} from "../../../lib/domain/digital-observer/observer-qa-auth-build.mjs";

const root = new URL("../../../", import.meta.url);
const offline = JSON.parse(readFileSync(new URL("ios/qa-observer/capacitor.config.json", root)));
const login = "/digital-observer/login";
const dashboard = "/digital-observer/dashboard";
const action = "/api/digital-observer/auth/login";
const candidate = {
  optIn: "1", firstPartyLogin: "1", platform: "ios", bundleId,
  callback, origin, launchUrl: origin + login
};

test("only explicitly selected first-party iOS packaging keeps login, POST and dashboard in scope", () => {
  const { server } = prepareObserverQaAuthConfig(candidate, offline);
  assert.equal(server.url, origin + "/");
  assert.equal(new URL(server.appStartPath, server.url).href, candidate.launchUrl);
  for (const path of [login, action, dashboard]) assert.ok((origin + path).startsWith(server.url));
  for (const other of [origin + ".invalid/", origin + "@elsewhere.invalid/", "https://vercel.com/sso-api"]) {
    assert.ok(!other.startsWith(server.url));
  }
  for (const change of [{ firstPartyLogin: undefined }, { optIn: undefined }, { platform: "android" },
  { bundleId: "com.ganbatuach.app.qa" }, { origin: "https://preview.vercel.app" }]) {
    assert.throws(() => prepareObserverQaAuthConfig({ ...candidate, ...change }, offline));
  }
  assert.throws(() => prepareObserverQaAuthConfig(candidate, { ...offline, server: { ...offline.server, allowNavigation: ["*"] } }));
});

test("accounts awaiting site setup can follow the Product login redirect with read-only QA access", () => {
  const gate = { host: new URL(origin).host, trustedHttps: true, ownerAuthorized: true };
  const userId = randomUUID();
  for (const type of ["home", "business"]) {
    const context = resolveObserverLoginContext({ userId, requestedNext: dashboard, observerAdmin: false,
      profile: { data: { id: userId }, error: null },
      account: { data: { profile_id: userId, account_type: type }, error: null },
      ownedSite: { data: null, error: null }, membership: { data: null, error: null } });
    const expected = `/digital-observer/onboarding?type=${type}`;
    assert.deepEqual(context, { ok: true, destination: expected });
    assert.equal(observerQaRedirect(origin + context.destination, gate), expected);
    assert.equal(observerQaRouteAllowed({ ...gate, method: "POST", rawUrl: expected }), false);
  }
  for (const query of ["type=other", "type=home&type=business", "type=business&next=/admin", "code=abc"]) {
    assert.equal(observerQaRedirect("/digital-observer/onboarding?" + query, gate), null);
  }
});

test("one ephemeral macOS WebKit context posts to the Product login route and retains its session on reload and re-entry", async t => {
  const { server: config } = prepareObserverQaAuthConfig(candidate, offline);
  const fixtureOrigin = "https://auth-fixture.invalid";
  const fixtureUser = { id: randomUUID(), email: "owner@example.invalid", user_metadata: {}, app_metadata: {} };
  const token = randomUUID();
  let signIns = 0, dashboards = 0, reentries = 0, denials = 0;
  // Invalidate the synthetic session immediately after the third authorized read.
  let revoked = false;
  // Only Auth/Data responses are simulated. Use the real SSR cookie machinery and Next login POST.
  t.mock.method(globalThis, "fetch", async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(url.origin, fixtureOrigin);
    if (url.pathname === "/auth/v1/token" && request.method === "POST") {
      const body = await request.json();
      assert.equal(body.email, fixtureUser.email);
      assert.equal(body.password, "synthetic-only");
      signIns++;
      return Response.json({ user: fixtureUser, access_token: token, refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600 });
    }
    assert.equal(request.headers.get("authorization"), "Bearer " + token);
    if (url.pathname === "/auth/v1/user" && revoked) {
      return Response.json({ message: "Synthetic session revoked" }, { status: 401 });
    }
    const responses = new Map([
      ["/auth/v1/user", fixtureUser], ["/rest/v1/rpc/ensure_digital_observer_account", true],
      ["/rest/v1/profiles", [{ id: fixtureUser.id, active: true }]],
      ["/rest/v1/digital_observer_accounts", [{ profile_id: fixtureUser.id, account_type: "business" }]],
      ["/rest/v1/observer_sites", [{ id: "fixture-site" }]], ["/rest/v1/observer_site_memberships", []]
    ]);
    assert.ok(responses.has(url.pathname), url.pathname);
    return Response.json(responses.get(url.pathname));
  });
  // Node's TS loader has no Next path aliases. Keep the actual product functions.
  const aliases = new Map([
    ["@/lib/domain/digital-observer/access", "lib/domain/digital-observer/safe-return-path.ts"],
    ["@/lib/domain/digital-observer/observer-login-auth", "lib/domain/digital-observer/observer-login-auth.ts"]
  ]);
  const hooks = registerHooks({
    resolve(id, context, next) {
      if (aliases.has(id)) return { url: new URL(aliases.get(id), root).href, shortCircuit: true };
      return next(id === "next/server" ? "next/server.js" : id, context);
    }
  });
  t.after(() => hooks.deregister());
  process.env.NEXT_PUBLIC_SUPABASE_URL = fixtureOrigin;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "synthetic-only";
  process.env.NODE_ENV = "test"; // Loopback HTTP; no TLS or physical-device claim.
  const { POST } = await import(new URL("app/api/digital-observer/auth/login/route.ts", root));
  let failure;
  const server = createServer(async (req, res) => {
    try {
      assert.ok(!(req.headers.cookie || "").includes(approvalCookie));
      assert.ok(!req.url.includes("approval"));
      const url = new URL(req.url, origin);
      assert.equal(url.origin, origin);
      res.setHeader("Cache-Control", "no-store");
      if (req.method === "POST" && url.pathname === action) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const response = await POST(new NextRequest(url, { method: "POST", headers: req.headers, body: Buffer.concat(chunks) }));
        assert.equal(response.status, 303);
        assert.equal(response.headers.get("location"), origin + dashboard);
        res.writeHead(303, { location: response.headers.get("location"), "set-cookie": response.headers.getSetCookie() }).end();
        return;
      }
      assert.equal(req.method, "GET");
      assert.ok([login, dashboard].includes(url.pathname));
      const cookies = new NextRequest(url, { headers: req.headers }).cookies;
      const ssr = createServerClient(fixtureOrigin, "synthetic-only", { cookies: { getAll: () => cookies.getAll(), setAll() { } } });
      const { data: { user } } = await ssr.auth.getUser();
      if (url.pathname === dashboard) {
        if (revoked) {
          assert.equal(user, null);
          denials++;
          res.writeHead(403, { "Content-Type": "text/html" }).end("<title>Synthetic access denied</title>");
          return;
        }
        assert.equal(user?.id, fixtureUser.id);
        dashboards++;
        revoked = dashboards === 3;
        res.setHeader("Content-Type", "text/html");
        res.end("<title>Synthetic signed-in dashboard</title>");
      } else if (user) {
        assert.equal(user.id, fixtureUser.id);
        reentries++;
        res.writeHead(303, { location: dashboard }).end();
      } else {
        res.setHeader("Content-Type", "text/html");
        res.end(`<form method="post" action="${action}"><input name="email" value="${fixtureUser.email}"><input name="password" value="synthetic-only"><input name="next" value="${dashboard}"></form>`);
      }
    } catch (error) { failure = error; res.writeHead(500).end(); }
  });
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const probe = fileURLToPath(new URL("WebContext.swift", import.meta.url));
  const qaHost = new URL(origin).host;
  const proxy = createQaProxy({ qaHost, approvalCode: "12345678abcdef90",
    upstream: `http://127.0.0.1:${server.address().port}` });
  // The test TLS ingress maps only its own loopback authority to the pinned QA host.
  const dir = mkdtempSync(join(tmpdir(), "observer-gate-tls-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const key = join(dir, "key.pem"), cert = join(dir, "cert.pem"), anchor = join(dir, "anchor.der");
  execFileSync("openssl", ["req", "-new", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", key, "-out", cert, "-days", "1", "-subj", "/CN=127.0.0.1",
    "-addext", "subjectAltName=IP:127.0.0.1", "-addext", "extendedKeyUsage=serverAuth"], { stdio: "ignore" });
  execFileSync("openssl", ["x509", "-in", cert, "-outform", "DER", "-out", anchor]);
  let local;
  const trace = [];
  const ingress = createTlsServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
    if (req.headers.host !== new URL(local).host) { res.writeHead(421).end(); return; }
    res.on("finish", () => trace.push([req.method, req.url.split("?")[0], res.statusCode]));
    req.headers.host = qaHost;
    req.headers["x-forwarded-proto"] = "https";
    if (req.headers.origin === local) req.headers.origin = origin;
    proxy.emit("request", req, res);
  });
  await new Promise((resolve,reject) => ingress.once("error",reject).listen(0,"127.0.0.1",resolve));
  t.after(() => { ingress.closeAllConnections(); ingress.close(); });
  local = `https://127.0.0.1:${ingress.address().port}`;
  const start = new URL(config.appStartPath, local);
  const child = spawn("swift", [probe, start.href, anchor], { stdio: ["ignore", "ignore", "inherit"] });
  const exit = await new Promise((resolve, reject) => child.once("error", reject).once("exit", resolve));
  if (failure) throw failure;
  assert.equal(exit, 0, JSON.stringify(trace));
  assert.deepEqual({ signIns, dashboards, reentries, denials }, { signIns: 1, dashboards: 3, reentries: 1, denials: 1 });
});

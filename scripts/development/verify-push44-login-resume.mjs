import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { localCredentials } from "./local-client.mjs";
import { sql } from "./local-database.mjs";

// Local-only dedicated fixture; no secret, response body or token is logged.
const keys = localCredentials();
assert.equal(new URL(keys.url).hostname, "127.0.0.1");
const fixture = readFileSync("/private/tmp/push44-owner-development-F05GVY/credentials.txt", "utf8");
const email = fixture.match(/^Email: (.+)$/m)?.[1];
const password = fixture.match(/^Password: (.+)$/m)?.[1];
assert.equal(email, "owner-iphone@integration.qa.invalid");
assert.ok(password);
const userId = "00000000-0000-4000-8000-000000000f44";
const admin = createClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const jar = new Map();
const auth = createServerClient(keys.url, keys.anon, {
  auth: { autoRefreshToken: false },
  cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value))
  }
});
const tokens = [];
async function login() {
  jar.clear();
  const result = await auth.auth.signInWithPassword({ email, password });
  assert.equal(result.error, null);
  assert.equal(result.data.user.id, userId);
  const token = result.data.session.access_token;
  tokens.push(token);
  return token;
}
async function probe(label, cookie, resume, query = "") {
  const response = await fetch(`http://127.0.0.1:3001/digital-observer/login${query}`, {
    headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(20000)
  });
  const body = await response.text();
  const redirected = response.headers.get("location")?.split("?")[0] === "/digital-observer/dashboard"
    || (response.status === 200 && /url=\/digital-observer\/dashboard/.test(body));
  assert.equal(redirected, resume, label);
  if (!resume) assert.match(body, /name="email"/, label);
  console.log(JSON.stringify({ label, pass: true, status: response.status, resumes: redirected }));
}
const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
try {
  await probe("anonymous remains at login", "", false);
  const token = await login();
  const originalCookie = cookie();
  await probe("valid authorized session resumes", originalCookie, true);
  await probe("explicit error remains visible", originalCookie, false, "?error=session_expired");
  const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url"));
  assert.equal(claims.sub, userId);
  assert.match(claims.session_id, /^[a-f0-9-]{36}$/);
  assert.equal(sql(`UPDATE auth.sessions SET not_after=clock_timestamp()-interval '1 second' WHERE id='${claims.session_id}' AND user_id='${userId}' RETURNING id;`).trim(), claims.session_id);
  await probe("expired session cannot resume", originalCookie, false);
  const second = await login();
  const revokedCookie = cookie();
  assert.equal((await admin.auth.admin.signOut(second, "local")).error, null);
  await probe("revoked session cannot resume", revokedCookie, false);
  console.log(JSON.stringify({ status: "PASS", checks: 5, productionAccess: false, realDeviceProof: false }));
} finally {
  for (const token of tokens) await admin.auth.admin.signOut(token, "local");
}

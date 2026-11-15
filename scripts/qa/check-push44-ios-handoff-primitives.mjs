import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Development user validation exists, but the QA bootstrap does not bind it", () => {
  const access = source("lib/domain/digital-observer/access.ts");
  const proxy = source("scripts/qa/push44-owner-qa-proxy.mjs");
  assert.match(access, /getDigitalObserverApiUser\(request\?: Request\)/);
  assert.match(access, /currentObserverSessionActive\(supabase\)/);
  assert.match(proxy, /bootstrap\.searchParams\.get\("t"\)/);
  assert.doesNotMatch(proxy, /getDigitalObserverApiUser|currentObserverSessionActive/);
});

test("the existing single-use helper is browser-tab memoization, not atomic server redemption", () => {
  const helper = source("lib/domain/single-use-auth-code.ts");
  const callback = source("components/auth/auth-callback-client.tsx");
  assert.match(helper, /let lastAttempt:/);
  assert.match(helper, /if \(lastAttempt\?\.code === code\) return lastAttempt\.result/);
  assert.match(callback, /createClient\(\)\.auth\.exchangeCodeForSession\(code\)/);
  assert.doesNotMatch(helper, /consumed_at|update\(|rpc\(/);
});

test("SSO transaction receipt cannot be repurposed as an iPhone QA handoff", () => {
  const migration = source("supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql");
  const transaction = migration.match(/create table if not exists public\.digital_observer_sso_transactions \(([\s\S]*?)\n\);/)?.[1];
  assert.ok(transaction);
  assert.match(transaction, /sso_connection_id uuid not null/);
  assert.match(transaction, /state_hash text not null unique/);
  assert.match(transaction, /consumed_at timestamptz/);
  assert.doesNotMatch(transaction, /profile_id|session_id|installation_id|device_id/);
});

test("native callback and server exchange for this QA handoff are absent; remote build remains blocked", () => {
  const config = source("scripts/qa/prepare-push44-iphone-qa-config.mjs");
  const appDelegate = source("ios/App/App/AppDelegate.swift");
  const nativeSources = [appDelegate, source("ios/App/App/Info.plist"), source("ios/qa-personal-team/index.html")].join("\n");
  const observerRoutes = readdirSync(new URL("../../app/api/digital-observer/", import.meta.url));
  assert.match(config, /PUSH44_QA_REMOTE_BUILD_BLOCKED/);
  assert.match(appDelegate, /ApplicationDelegateProxy\.shared\.application\(application, continue: userActivity/);
  assert.doesNotMatch(nativeSources, /ASWebAuthenticationSession|qa-iphone-device-proof|push44_handoff/);
  assert.equal(observerRoutes.some((name) => /handoff|redeem|device-proof/i.test(name)), false);
});

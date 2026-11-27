import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { validateObserverQaHostedConfig, OBSERVER_QA_HOSTED_ORIGIN,
  OBSERVER_QA_HOSTED_CALLBACK } from "../../lib/domain/digital-observer/observer-qa-hosted-preflight.mjs";

const valid = {
  NEXT_PUBLIC_APP_URL: OBSERVER_QA_HOSTED_ORIGIN,
  APP_URL: OBSERVER_QA_HOSTED_ORIGIN,
  AUTH_REDIRECT_URL: OBSERVER_QA_HOSTED_CALLBACK,
  OBSERVER_QA_ACCESS_HOST: "observer-qa.ganbatuach.com",
  OBSERVER_QA_SUPABASE_REF: "abcdefghijklmnopqrst",
  PRODUCTION_SUPABASE_REF: "zyxwvutsrqponmlkjihg",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co"
};

test("exact isolated QA configuration receives only an offline verdict", () => {
  assert.equal(validateObserverQaHostedConfig(valid).status, "offline_configuration_only");
});

test("missing, Gan Production, malformed and redirected hosts fail closed", () => {
  for (const field of ["NEXT_PUBLIC_APP_URL", "APP_URL", "AUTH_REDIRECT_URL", "OBSERVER_QA_ACCESS_HOST"]) {
    assert.throws(() => validateObserverQaHostedConfig({ ...valid, [field]: undefined }));
    assert.throws(() => validateObserverQaHostedConfig({ ...valid, [field]: "https://ganbatuach.com" }));
  }
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, APP_URL: `${OBSERVER_QA_HOSTED_ORIGIN}/` }));
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, AUTH_REDIRECT_URL: `${OBSERVER_QA_HOSTED_CALLBACK}?next=/dashboard` }));
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, OBSERVER_QA_ACCESS_HOST: "*.ganbatuach.com" }));
});

test("unknown, mismatched, or Production Supabase ref fails closed", () => {
  for (const field of ["OBSERVER_QA_SUPABASE_REF", "PRODUCTION_SUPABASE_REF", "NEXT_PUBLIC_SUPABASE_URL"]) {
    assert.throws(() => validateObserverQaHostedConfig({ ...valid, [field]: undefined }));
  }
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, OBSERVER_QA_SUPABASE_REF: valid.PRODUCTION_SUPABASE_REF,
    NEXT_PUBLIC_SUPABASE_URL: `https://${valid.PRODUCTION_SUPABASE_REF}.supabase.co` }));
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "https://ganbatuach.com" }));
  assert.throws(() => validateObserverQaHostedConfig({ ...valid, OBSERVER_QA_SUPABASE_REF: "localhost" }));
});

test("runnable preflight is closed by default and prints no configuration values", () => {
  const path = new URL("./preflight-observer-qa-hosted-config.mjs", import.meta.url);
  const blocked = spawnSync(process.execPath, [path.pathname], { encoding: "utf8", env: {} });
  assert.equal(blocked.status, 1);
  assert.equal(blocked.stderr, "OBSERVER_QA_HOSTED_CONFIG_BLOCKED\n");
  const accepted = spawnSync(process.execPath, [path.pathname], { encoding: "utf8", env: valid });
  assert.equal(accepted.status, 0);
  assert.equal(accepted.stdout, "OBSERVER_QA_HOSTED_CONFIG_ONLY_PASS\n");
});

import assert from "node:assert/strict";
import test from "node:test";
import { isIsolatedPush38QualificationRuntime } from "../../lib/domain/digital-observer/qualification-runtime.ts";

const isolated = {
  NODE_ENV: "production",
  APP_ENV: "local",
  NEXT_PUBLIC_APP_ENV: "local",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:56421",
  SUPABASE_ADMIN_URL: "http://127.0.0.1:56431",
  OBSERVER_PUSH38_QUALIFICATION: "enabled",
  OBSERVER_PUSH38_QUALIFICATION_EXACT_BUILD: "enabled"
};

test("allows the exact local qualification build", () => {
  assert.equal(isIsolatedPush38QualificationRuntime(isolated), true);
});

test("allows local qualification development without the build flag", () => {
  assert.equal(isIsolatedPush38QualificationRuntime({
    ...isolated,
    NODE_ENV: "development",
    OBSERVER_PUSH38_QUALIFICATION_EXACT_BUILD: "disabled"
  }), true);
});

test("fails closed outside exact loopback QA services", () => {
  for (const changed of [
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { SUPABASE_ADMIN_URL: "http://localhost:56431" },
    { SUPABASE_ADMIN_URL: "http://127.0.0.1:56432" },
    { APP_ENV: "production" },
    { NEXT_PUBLIC_APP_ENV: "production" },
    { OBSERVER_PUSH38_QUALIFICATION: "disabled" },
    { OBSERVER_PUSH38_QUALIFICATION_EXACT_BUILD: "disabled" },
    { NODE_ENV: "test" }
  ]) assert.equal(isIsolatedPush38QualificationRuntime({ ...isolated, ...changed }), false);
});

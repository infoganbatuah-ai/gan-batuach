import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { authenticateAndPrepareObserverLogin, resolveObserverLoginContext } from "../../lib/domain/digital-observer/observer-login-auth.ts";

const ganUser = { id: "gan-auth-user", user_metadata: { product: "gan_batuach" }, app_metadata: {} };

function harness({ loginUser = ganUser, currentUser = ganUser, loginError = null, accountOk = true } = {}) {
  const calls = [];
  return {
    calls,
    dependencies: {
      async signIn(email, password) {
        calls.push(["signIn", email, password]);
        return { user: loginError ? null : loginUser, error: loginError };
      },
      async currentUser() {
        calls.push(["currentUser"]);
        return { user: currentUser, error: null };
      },
      async ensureOwnAccount(user) {
        calls.push(["ensureOwnAccount", user.id]);
        return { ok: accountOk, code: accountOk ? undefined : "qa_setup_failure" };
      },
      async signOut() { calls.push(["signOut"]); return { error: null }; }
    }
  };
}

test("fresh Gan login provisions only the authenticated user's Observer account", async () => {
  const { calls, dependencies } = harness();
  const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", "correct-password", dependencies);
  assert.equal(result.status, "ok");
  assert.equal(result.user.id, ganUser.id);
  assert.deepEqual(calls.map(([name]) => name), ["signIn", "currentUser", "ensureOwnAccount"]);
  assert.deepEqual(calls[2], ["ensureOwnAccount", ganUser.id]);
});

test("foreign current session is rejected before account provisioning", async () => {
  const { calls, dependencies } = harness({ currentUser: { ...ganUser, id: "other-auth-user" } });
  const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", "correct-password", dependencies);
  assert.equal(result.status, "identity_mismatch");
  assert.deepEqual(calls.map(([name]) => name), ["signIn", "currentUser", "signOut"]);
});

test("wrong password and recovery-like non-password input neither provision nor revoke another session", async () => {
  for (const password of ["wrong-password", "recovery-token"]) {
    const { calls, dependencies } = harness({ loginError: { code: "invalid_credentials" } });
    const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", password, dependencies);
    assert.equal(result.status, "invalid_login");
    assert.deepEqual(calls.map(([name]) => name), ["signIn"]);
  }
});

test("account preparation failure revokes the login session before returning", async () => {
  const { calls, dependencies } = harness({ accountOk: false });
  const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", "correct-password", dependencies);
  assert.equal(result.status, "observer_setup_required");
  assert.deepEqual(calls.map(([name]) => name), ["signIn", "currentUser", "ensureOwnAccount", "signOut"]);
});

test("account preparation exception attempts session cleanup and never reports success", async () => {
  const { calls, dependencies } = harness();
  dependencies.ensureOwnAccount = async () => {
    calls.push(["ensureOwnAccount"]);
    throw new Error("synthetic database failure");
  };
  const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", "correct-password", dependencies);
  assert.equal(result.status, "observer_setup_required");
  assert.deepEqual(calls.map(([name]) => name), ["signIn", "currentUser", "ensureOwnAccount", "signOut"]);
});

test("failed or throwing signOut never reports a safe redirect after a newly authenticated failure", async () => {
  for (const failure of ["error", "throw"]) {
    const { calls, dependencies } = harness({ accountOk: false });
    dependencies.signOut = async () => {
      calls.push(["signOut"]);
      if (failure === "throw") throw new Error("synthetic logout failure");
      return { error: { code: "synthetic_logout_failure" } };
    };
    const result = await authenticateAndPrepareObserverLogin("gan@example.invalid", "correct-password", dependencies);
    assert.equal(result.status, "session_cleanup_failed");
    assert.deepEqual(calls.map(([name]) => name), ["signIn", "currentUser", "ensureOwnAccount", "signOut"]);
  }
  const route = readFileSync(new URL("../../app/api/digital-observer/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(authentication\.status === "session_cleanup_failed"\) return cleanupFailure\(\)/);
  assert.match(route, /status: 503/);
  assert.match(route, /const cleanupFailure = \(\) => NextResponse\.json/);
});

test("real login route delegates authentication and keeps recovery outside the opt-in handler", () => {
  const route = readFileSync(new URL("../../app/api/digital-observer/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(route, /authenticateAndPrepareObserverLogin\(email, password/);
  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /if \(!email\.includes\("@"\) \|\| password\.length < 1\)/);
  assert.doesNotMatch(route, /verifyOtp|exchangeCodeForSession|resetPasswordForEmail/);
});

function context(overrides = {}) {
  return {
    userId: ganUser.id,
    observerAdmin: false,
    requestedNext: "/digital-observer/dashboard",
    profile: { data: { id: ganUser.id, active: true }, error: null },
    account: { data: { profile_id: ganUser.id, account_type: "business" }, error: null },
    ownedSite: { data: null, error: null },
    membership: { data: null, error: null },
    ...overrides
  };
}

test("healthy account without a site enters its own onboarding, never Gan", () => {
  assert.deepEqual(resolveObserverLoginContext(context()), {
    ok: true, destination: "/digital-observer/onboarding?type=business"
  });
  assert.deepEqual(resolveObserverLoginContext(context({ ownedSite: { data: { id: "own-site" }, error: null } })), {
    ok: true, destination: "/digital-observer/dashboard"
  });
});

test("every DB read failure, missing account, or foreign profile fails closed", () => {
  for (const field of ["profile", "account", "ownedSite", "membership"]) {
    const prior = context()[field];
    assert.deepEqual(resolveObserverLoginContext(context({ [field]: { ...prior, error: { code: "synthetic_query_failure" } } })), { ok: false }, field);
  }
  assert.deepEqual(resolveObserverLoginContext(context({ account: { data: null, error: null } })), { ok: false });
  assert.deepEqual(resolveObserverLoginContext(context({ account: { data: { profile_id: "foreign-user" }, error: null } })), { ok: false });
  assert.deepEqual(resolveObserverLoginContext(context({ profile: { data: { id: "foreign-user", active: true }, error: null } })), { ok: false });
});

test("route signs out on context failure before publishing active product cookie", () => {
  const route = readFileSync(new URL("../../app/api/digital-observer/auth/login/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!context\.ok\) \{\s*try \{\s*const cleanup = await supabase\.auth\.signOut\(\);\s*if \(cleanup\.error\) return cleanupFailure\(\)/);
  assert.match(route, /return buildRedirect\(context\.destination, true\)/);
});

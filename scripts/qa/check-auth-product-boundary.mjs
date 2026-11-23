import assert from "node:assert/strict";
import test from "node:test";
import { authCallbackUrl } from "../../lib/domain/auth-flow.ts";
import { hasExplicitGanBatuachAccess } from "../../lib/domain/gan-batuach/access.ts";
import { persistedProductReadFailed, resolvePersistedAuthProduct } from "../../lib/domain/auth-product-boundary.ts";

test("Digital Observer recovery remains in the Observer product", () => {
  const callback = new URL(authCallbackUrl("digital_observer", "/digital-observer/set-password", "recovery"));
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.search, "");
});

test("persisted Observer account without a Gan parent remains Observer-only", () => {
  assert.equal(resolvePersistedAuthProduct({
    hasObserverAccount: true,
    hasGanProfile: true,
    hasGanParent: false,
    ganRole: "parent"
  }), "digital_observer");
});

test("persisted Gan parent without an Observer account remains Gan-only", () => {
  assert.equal(resolvePersistedAuthProduct({
    hasObserverAccount: false,
    hasGanProfile: true,
    hasGanParent: true,
    ganRole: "parent"
  }), "gan_batuach");
});

test("a deliberately provisioned dual-product identity is explicit", () => {
  assert.equal(resolvePersistedAuthProduct({
    hasObserverAccount: true,
    hasGanProfile: true,
    hasGanParent: true,
    ganRole: "parent"
  }), "both");
});

test("first-time verification may fall back only after successful empty reads", () => {
  assert.equal(persistedProductReadFailed([{ data: null, error: null }, { data: null, error: null }]), false);
  assert.equal(resolvePersistedAuthProduct({
    hasObserverAccount: false,
    hasGanProfile: false,
    hasGanParent: false,
    ganRole: null
  }), "none");
});

test("any persisted product lookup failure blocks product routing", () => {
  assert.equal(persistedProductReadFailed([
    { data: null, error: { code: "database_unavailable" } },
    { data: null, error: null }
  ]), true);
});

test("an auth identity is not a Gan Batuach parent without an explicit parent row", async () => {
  const client = {
    from: () => ({
      select: () => ({
        or: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) })
        })
      })
    })
  };
  assert.equal(await hasExplicitGanBatuachAccess(client, { id: "observer-user", role: "parent" }), false);
});

test("an explicitly provisioned Gan Batuach parent is accepted", async () => {
  const client = {
    from: () => ({
      select: () => ({
        or: () => ({
          limit: () => ({ maybeSingle: async () => ({ data: { id: "parent-row" }, error: null }) })
        })
      })
    })
  };
  assert.equal(await hasExplicitGanBatuachAccess(client, { id: "gan-parent", role: "parent" }), true);
});

import assert from "node:assert/strict";
import test from "node:test";
import { authCallbackUrl } from "../../lib/domain/auth-flow.ts";
import { hasExplicitGanBatuachAccess } from "../../lib/domain/gan-batuach/access.ts";

test("Digital Observer recovery remains in the Observer product", () => {
  const callback = new URL(authCallbackUrl("digital_observer", "/digital-observer/set-password", "recovery"));
  assert.equal(callback.pathname, "/auth/callback");
  assert.equal(callback.searchParams.get("product"), "digital_observer");
  assert.equal(callback.searchParams.get("flow"), "recovery");
  assert.equal(callback.searchParams.get("next"), "/digital-observer/set-password");
});

test("Observer recovery rejects a cross-product next path", () => {
  const callback = new URL(authCallbackUrl("digital_observer", "/reset-password", "recovery"));
  assert.equal(callback.searchParams.get("next"), "/digital-observer/set-password");
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

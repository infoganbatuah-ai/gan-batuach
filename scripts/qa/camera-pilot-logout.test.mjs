import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { createCameraPilotSessionRegistry } from "../../lib/management/camera-pilot-grant.mjs";

test("logout stops the matching pilot session before signing out", async () => {
  const actions = [];
  const registry = createCameraPilotSessionRegistry({
    qaGardenId: "garden-a", now: () => 10_000,
    revoke: async () => { actions.push("stream-stop"); return true; }
  });
  const context = {
    sessionId: "session-a", viewer: { id: "viewer-a", role: "manager", active: true },
    camera: { id: "camera-a", gardenId: "garden-a", siteId: "site-a", active: true }
  };
  assert.ok(registry.register(context, { handle: "h".repeat(43), expiresAtMs: 15_000 }));
  let sessionId = "different-session";
  const { POST } = loadTs("app/api/auth/logout/route.ts", {
    "next/server": { NextResponse: Response },
    "@/lib/supabase/server": { createClient: async () => ({ auth: {
      getClaims: async () => ({ data: { claims: { session_id: sessionId } } }),
      signOut: async () => { actions.push("sign-out"); return { error: null }; }
    } }) },
    "@/lib/domain/push-service": {},
    "@/lib/management/camera-pilot-logout": { qaCameraPilotStop: () => registry.stop }
  });
  const request = () => new Request("http://127.0.0.1:3000/api/auth/logout", { method: "POST" });
  assert.equal((await POST(request())).status, 200);
  assert.ok(registry.lookup(context));
  sessionId = "session-a";
  assert.equal((await POST(request())).status, 200);
  assert.equal(registry.lookup(context), null);
  assert.deepEqual(actions, ["sign-out", "stream-stop", "sign-out"]);
});

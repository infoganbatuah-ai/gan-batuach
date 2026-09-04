// Public, unauthenticated acceptance probes only. No env files, browser state,
// keys, identifiers, camera sampling or physical commands are used.
import { pathToFileURL } from "node:url";

export const probes = [
  { name: "public_app_and_auth_health", path: "/api/health", method: "GET", expected: 200, health: true },
  { name: "deep_health_requires_secret", path: "/api/health/deep", method: "GET", expected: 401 },
  { name: "journal_requires_session", path: "/api/digital-observer/event-journal", method: "GET", expected: 401 },
  { name: "chat_requires_session", path: "/api/digital-observer/conversation", method: "POST", expected: 401 },
  { name: "capabilities_require_session", path: "/api/digital-observer/camera-capabilities", method: "POST", expected: 401 },
  { name: "gateway_health_write_requires_secret", path: "/api/video-gateway/health-checks", method: "POST", expected: 401 },
  // These separate local packages may not have been deployed yet. A 404 is a
  // coverage gap, not a successful authorization test.
  { name: "diagnostic_queue_requires_device", path: "/api/video-gateway/camera-actions", method: "POST", expected: 401 },
  { name: "garden_journal_requires_session", path: "/api/garden/observer-journal", method: "GET", expected: 401 }
];

export async function checkPublicGuardReadiness(fetcher = fetch) {
  const results = [];
  for (const probe of probes) {
    const started = Date.now();
    try {
      const response = await fetcher(`https://ganbatuach.com${probe.path}`, {
        method: probe.method, redirect: "manual", credentials: "omit", cache: "no-store",
        signal: AbortSignal.timeout(15000),
        ...(probe.method === "POST" ? { headers: { "content-type": "application/json" }, body: "{}" } : {})
      });
      const health = probe.health ? await response.json() : null;
      if (!probe.health) await response.body?.cancel();
      const passed = response.status === probe.expected && (!probe.health || (health?.ok === true && health?.app === "ok" && health?.supabase === "ok"));
      results.push({ probe: probe.name, status: response.status, outcome: passed ? "passed" : response.status === 404 ? "route_unavailable" : "failed",
        elapsed_ms: Date.now() - started,
        ...(probe.health ? { app_ready: health?.app === "ok", public_auth_reachable: health?.supabase === "ok" } : {}) });
    } catch {
      // Never echo unexpected response bodies, network messages or headers.
      results.push({ probe: probe.name, status: null, outcome: "unreachable", elapsed_ms: Date.now() - started });
    }
  }
  return { checked_at: new Date().toISOString(), results,
    coverage: { authenticated_user_flow_verified: false, database_schema_verified: false,
      detector_or_hardware_verified: false, secrets_used: false, camera_commands_sent: 0 } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await checkPublicGuardReadiness();
  console.log(JSON.stringify(report, null, 2));
  if (report.results.some(result => result.outcome !== "passed")) process.exitCode = 1;
}

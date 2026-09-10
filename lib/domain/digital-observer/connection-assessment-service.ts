import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { planCameraConnection } from "./connection-orchestrator";
import type { ConnectivityFamilyId } from "./connectivity-registry";

// Call only AFTER authorizing site management. One server-owned execution
// registry for assessment and mutations; the browser cannot supply path proofs.
export async function assessAuthorizedCameraSystem(siteId: string, family: ConnectivityFamilyId,
  computerAvailable: "YES" | "NO" | "UNKNOWN", nativeDiscoveryAvailable = false) {
  const result = await createAdminClient().from("video_gateway_device_enrollments")
    .select("metadata").eq("observer_site_id", siteId).eq("status", "delivered")
    .contains("metadata", { device_type: "SOFTWARE_CONNECTOR" }).limit(20);
  if (result.error) throw new Error("CONNECTION_ASSESSMENT_UNAVAILABLE");
  const connectorOnline = (result.data ?? []).some(row => {
    const parsed = z.object({ last_heartbeat_at: z.string(), health: z.object({ status: z.string() }).optional() }).safeParse(row.metadata);
    if (!parsed.success) return false;
    const age = Date.now() - Date.parse(parsed.data.last_heartbeat_at);
    return Number.isFinite(age) && age >= 0 && age < 120000 && ["healthy", "HEALTHY"].includes(parsed.data.health?.status ?? "");
  });
  // No executable vendor-cloud integration has been verified in this checkout.
  // Future supported adapters supply server-owned proofs HERE, never UI flags.
  const plan = planCameraConnection({ family, computerAvailable, connectorOnline,
    nativeDiscoveryAvailable, persistentPaths: [] });
  return { plan, connectorOnline };
}

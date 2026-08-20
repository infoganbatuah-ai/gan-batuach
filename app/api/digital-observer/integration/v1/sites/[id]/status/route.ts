import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requiredScopes = ["camera.health:read", "events.reviewed:read"] as const;

function noStore(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function hashToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function sameHash(left: string, right: string) {
  if (!left || !right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

async function writeAudit(supabase: ReturnType<typeof createAdminClient>, values: Record<string, unknown>) {
  try { await supabase.from("digital_observer_integration_audit_logs" as any).insert(values); } catch { /* The response must not expose audit storage errors. */ }
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get("x-request-id")?.slice(0, 120) || randomUUID();
  if (process.env.DIGITAL_OBSERVER_GAN_BATUACH_INTEGRATION_ENABLED !== "true") {
    return noStore({ error: "integration_disabled", request_id: requestId }, 503);
  }
  if (!isAdminClientConfigured() || !process.env.DIGITAL_OBSERVER_INTEGRATION_TOKEN_HASH) {
    return noStore({ error: "integration_not_configured", request_id: requestId }, 503);
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const presentedHash = token ? hashToken(token) : "";
  if (!sameHash(presentedHash, process.env.DIGITAL_OBSERVER_INTEGRATION_TOKEN_HASH)) {
    return noStore({ error: "unauthorized", request_id: requestId }, 401);
  }

  const supabase = createAdminClient();
  const clientResult = await supabase.from("digital_observer_integration_clients" as any)
    .select("id,client_key,product_key,active,allowed_scopes")
    .eq("product_key", "gan_batuach")
    .eq("token_hash", presentedHash)
    .eq("active", true)
    .maybeSingle();
  const client = clientResult.data as { id: string; allowed_scopes?: unknown } | null;
  if (!client) return noStore({ error: "unauthorized", request_id: requestId }, 401);

  const allowedScopes = Array.isArray(client.allowed_scopes) ? client.allowed_scopes.map(String) : [];
  if (!requiredScopes.every((scope) => allowedScopes.includes(scope))) {
    await writeAudit(supabase, { integration_client_id: client.id, request_id: requestId, requested_scope: requiredScopes.join(" "), action: "site_status", result_status: "denied", metadata: { reason: "missing_scope" } });
    return noStore({ error: "forbidden_scope", request_id: requestId }, 403);
  }

  const { id } = await context.params;
  const siteResult = await supabase.from("observer_sites" as any)
    .select("id,name,site_type,garden_id,active,monitoring_enabled")
    .eq("id", id)
    .eq("site_type", "kindergarten")
    .not("garden_id", "is", null)
    .maybeSingle();
  const site = siteResult.data as any;
  if (!site) {
    await writeAudit(supabase, { integration_client_id: client.id, observer_site_id: null, request_id: requestId, requested_scope: requiredScopes.join(" "), action: "site_status", result_status: "denied", metadata: { reason: "site_not_bound_to_kindergarten" } });
    return noStore({ error: "site_not_available", request_id: requestId }, 404);
  }

  const [cameraResult, eventResult] = await Promise.all([
    supabase.from("camera_streams" as any)
      .select("id,name,area,status,health_status,stream_status,gateway_registration_status,last_health_check_at,last_seen")
      .eq("observer_site_id", site.id)
      .limit(200),
    supabase.from("observer_intelligence_signals" as any)
      .select("id,signal_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,created_at,reviewed_at,resolved_at")
      .eq("observer_site_id", site.id)
      .in("review_status", ["reviewed", "resolved", "confirmed"])
      .order("created_at", { ascending: false })
      .limit(50)
  ]);
  if (cameraResult.error || eventResult.error) {
    await writeAudit(supabase, { integration_client_id: client.id, observer_site_id: site.id, request_id: requestId, requested_scope: requiredScopes.join(" "), action: "site_status", result_status: "failed", metadata: { reason: "data_unavailable" } });
    return noStore({ error: "integration_data_unavailable", request_id: requestId }, 503);
  }

  await writeAudit(supabase, { integration_client_id: client.id, observer_site_id: site.id, request_id: requestId, requested_scope: requiredScopes.join(" "), action: "site_status", result_status: "allowed", metadata: { camera_count: cameraResult.data?.length ?? 0, reviewed_event_count: eventResult.data?.length ?? 0 } });
  return noStore({
    request_id: requestId,
    site: { id: site.id, garden_id: site.garden_id, name: site.name, active: site.active, monitoring_enabled: site.monitoring_enabled },
    cameras: cameraResult.data ?? [],
    reviewed_events: eventResult.data ?? [],
    media: { snapshots: "signed_endpoint_required", clips: "signed_endpoint_required" },
    parent_camera_access_implied: false
  }, 200);
}

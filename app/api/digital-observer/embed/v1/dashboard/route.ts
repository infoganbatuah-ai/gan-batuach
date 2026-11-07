/* eslint-disable @typescript-eslint/no-explicit-any -- bounded reads span canonical domain tables. */
import { NextResponse } from "next/server";
import { authenticateEmbeddedSession } from "@/lib/domain/digital-observer/partner-platform-service";
import { publicBrandProfile } from "@/lib/domain/digital-observer/partner-platform";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!isAdminClientConfigured()) throw new Error("EMBEDDED_PLATFORM_UNAVAILABLE");
    const authorization = request.headers.get("authorization") ?? "";
    const token = authorization.startsWith("Bearer doemb_") ? authorization.slice(7).trim() : "";
    const audience = request.headers.get("x-do-audience") ?? "";
    const origin = request.headers.get("origin");
    const admin = createAdminClient();
    const session = await authenticateEmbeddedSession(admin, { token, audience, origin, requiredScope: "cameras.read" });
    const [brand, site, cameras, events, incidents, evidence] = await Promise.all([
      (admin as any).from("digital_observer_partner_brand_profiles").select("brand_name,product_name,logo_url,primary_color,accent_color,support_url,privacy_url,terms_url,customer_domain,domain_status,notification_sender_label,legally_required_notices,updated_at").eq("partner_id", session.partner_id).maybeSingle(),
      (admin as any).from("observer_sites").select("id,name,site_type,timezone,active,monitoring_enabled").eq("id", session.observer_site_id).is("garden_id", null).neq("site_type", "kindergarten").single(),
      (admin as any).from("digital_observer_camera_sources").select("id,display_name,location_label,status,health_status,last_health_check_at,last_seen_at,capabilities").eq("observer_site_id", session.observer_site_id).order("display_name").limit(100),
      (admin as any).from("observer_intelligence_signals").select("id,camera_id,signal_type,severity,confidence,review_status,recommended_action,risk_score,human_review_required,created_at,reviewed_at,resolved_at").eq("observer_site_id", session.observer_site_id).order("created_at", { ascending: false }).limit(50),
      (admin as any).from("observer_correlated_events").select("id,status,severity,confidence,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,current_risk_score,current_risk_band,current_decision,current_verification_status").eq("observer_site_id", session.observer_site_id).order("last_activity_at", { ascending: false }).limit(50),
      (admin as any).from("digital_observer_event_clips").select("id,camera_source_id,signal_id,clip_status,created_at").eq("observer_site_id", session.observer_site_id).order("created_at", { ascending: false }).limit(50)
    ]);
    if (site.error || !site.data) throw new Error("EMBEDDED_SITE_UNAVAILABLE");
    for (const result of [brand, cameras, events, incidents, evidence]) if (result.error) throw new Error("EMBEDDED_RESOURCE_UNAVAILABLE");
    const cameraHealth = (cameras.data ?? []).map((camera: any) => ({ camera_id: camera.id, status: camera.health_status,
      last_frame_at: camera.last_seen_at, last_heartbeat_at: camera.last_health_check_at }));
    return NextResponse.json({ contract: "digital-observer-embedded-v1", session: { expires_at: session.expires_at, scopes: session.scopes },
      brand: brand.data ? publicBrandProfile(brand.data) : null, site: site.data, cameras: cameras.data ?? [], camera_health: cameraHealth,
      events: session.scopes.includes("events.read") ? events.data ?? [] : [], incidents: session.scopes.includes("incidents.read") ? incidents.data ?? [] : [],
      evidence_references: session.scopes.includes("evidence.read") ? evidence.data ?? [] : [], raw_video_embedded: false,
      private_credentials_exposed: false, biometric_features_enabled: false, production_proof: false }, { headers: { "cache-control": "no-store", "vary": "Origin" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "EMBEDDED_REQUEST_FAILED";
    const status = /AUTH/.test(code) ? 401 : /DENIED|INACTIVE/.test(code) ? 403 : 503;
    return NextResponse.json({ error: { code } }, { status, headers: { "cache-control": "no-store" } });
  }
}

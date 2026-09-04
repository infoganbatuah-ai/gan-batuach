import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { discoverCameraCapabilities } from "@/lib/domain/digital-observer/guard-engine";
import { probeCameraCapabilities } from "@/lib/domain/digital-observer/camera-gateway-adapter";

const schema = z.object({ camera_source_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const supabase = session.supabase as unknown as ReturnType<typeof createAdminClient>;
    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,capabilities,metadata,source_mode,connector_type")
      .eq("id", payload.camera_source_id).maybeSingle();
    if (result.error || !result.data) return fail("המצלמה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, session.profile, result.data.observer_site_id);
    if (!site) return fail("אין הרשאה לגשת למצלמה הזו.", 403);
    let manifest = discoverCameraCapabilities({
      cameraId: result.data.id,
      cameraZoneName: result.data.location_label || result.data.display_name,
      capabilities: result.data.capabilities,
      metadata: result.data.metadata,
      sourceMode: result.data.source_mode
    });
    let gatewayProbeError: string | null = null;
    try {
      if (result.data.connector_type !== "demo") {
        const probe = await probeCameraCapabilities(result.data.id);
        manifest = { ...probe.manifest, cameraZoneName: manifest.cameraZoneName };
        manifest.raw = { evidence_id: probe.evidenceId, verified_at: probe.verifiedAt, gateway_provider: probe.gatewayProvider, capability_manifest_verified: true };
      }
      if (result.data.connector_type === "demo") {
        // Backfill older seeded/demo rows on first discovery so subsequent
        // dashboard and Guard requests use the same complete capability map.
        await supabase.from("digital_observer_camera_sources").update({
          capabilities: {
            ...(result.data.capabilities ?? {}),
            ptz: manifest.capabilities.ptz,
            twoWayAudio: manifest.capabilities.twoWayAudio,
            siren: manifest.capabilities.siren,
            lighting: manifest.capabilities.lighting
          },
          metadata: { ...(result.data.metadata ?? {}), capability_manifest: manifest.details ?? {}, capability_manifest_backfilled_at: new Date().toISOString() }
        }).eq("id", result.data.id);
      }
    } catch {
      gatewayProbeError = "CAPABILITY_PROBE_UNAVAILABLE";
    }
    return ok({ manifest, gatewayProbeError, message: manifest.source === "gateway" ? "היכולות אומתו מול מערכת המצלמה." : manifest.source === "simulated" ? "בדיקת דמו בלבד — לא נשלחה בקשה לחומרה אמיתית." : "הוצג מידע שמור בלבד. אין בכך אימות להפעלת חומרה." });
  } catch (error) { return handleRouteError(error); }
}

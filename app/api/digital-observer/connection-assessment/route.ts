import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { observerCameraPairingMethods } from "@/lib/domain/digital-observer/camera-connection-methods";
import {
  assertSafeCameraConnectionAssessmentPayload,
  assessCameraConnection,
  buildExistingSourceAssessmentInput,
  buildPairingConnectionAssessmentInput,
  cameraConnectionMetadataForAssessment
} from "@/lib/domain/digital-observer/camera-connection-layer";
import { digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";

const assessNewSchema = z.object({
  action: z.literal("assess_new"),
  observer_site_id: z.string().uuid(),
  connector_type: z.enum(digitalObserverConnectorTypes),
  connector_provider: z.string().trim().min(1).max(80).optional().default("unknown"),
  pairing_method: z.enum(observerCameraPairingMethods).optional().default("manual_network"),
  pairing_payload_kind: z.enum(["rtsp", "onvif", "web_link", "vendor_code", "unknown"]).optional().default("unknown")
}).strict();

const assessExistingSchema = z.object({
  action: z.literal("assess_existing"),
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid(),
  persist: z.boolean().optional().default(false)
}).strict();

const schema = z.discriminatedUnion("action", [assessNewSchema, assessExistingSchema]);

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    assertSafeCameraConnectionAssessmentPayload(payload);
    const { profile, supabase: sessionSupabase } = session;
    const observerAdmin = hasObserverAdminClaim(session.user.app_metadata);
    // The runtime table is migration-backed and not yet present in the generated Supabase type snapshot.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (observerAdmin ? createDigitalObserverAdminDataClient() : sessionSupabase) as any;
    const requiresManageAccess = payload.action === "assess_new" || payload.persist;
    const site = observerAdmin
      ? (await supabase.from("observer_sites")
        .select("id,site_type,garden_id")
        .eq("id", payload.observer_site_id)
        .is("garden_id", null)
        .neq("site_type", "kindergarten")
        .maybeSingle()).data
      : await getObserverSiteAccess(
        sessionSupabase,
        profile,
        payload.observer_site_id,
        requiresManageAccess ? { manage: true } : {}
      );
    if (!site) return fail(requiresManageAccess
      ? "אין הרשאת ניהול לחיבורי המצלמות באתר הזה."
      : "אין הרשאה לבדוק חיבור מצלמות באתר הזה.", 403);

    if (payload.action === "assess_new") {
      const assessment = assessCameraConnection(buildPairingConnectionAssessmentInput({
        siteId: payload.observer_site_id,
        connectorType: payload.connector_type,
        provider: payload.connector_provider,
        pairingMethod: payload.pairing_method,
        pairingPayloadKind: payload.pairing_payload_kind
      }));
      return ok({ assessment });
    }

    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,camera_stream_id,display_name,connector_type,connector_provider,source_mode,status,health_status,stream_protocol,gateway_provider,capabilities,last_health_check_at,last_seen_at,secret_reference,metadata")
      .eq("id", payload.camera_source_id)
      .eq("observer_site_id", payload.observer_site_id)
      .maybeSingle();
    if (result.error || !result.data) return fail("מקור המצלמה לא נמצא.", 404);

    const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(result.data));
    if (payload.persist) {
      const update = await supabase.from("digital_observer_camera_sources")
        .update({
          metadata: { ...(result.data.metadata ?? {}), ...cameraConnectionMetadataForAssessment(assessment) },
          updated_at: new Date().toISOString()
        })
        .eq("id", result.data.id)
        .eq("observer_site_id", payload.observer_site_id);
      if (update.error) return fail("לא ניתן לשמור את תוצאת בדיקת החיבור.", 400);
    }

    return ok({
      assessment,
      source: {
        id: result.data.id,
        observer_site_id: result.data.observer_site_id,
        display_name: result.data.display_name,
        connector_type: result.data.connector_type,
        credential_reference_configured: Boolean(result.data.secret_reference || result.data.metadata?.credentials_server_side),
        gateway_stream_configured: Boolean(result.data.metadata?.gateway_stream_id)
      },
      persisted: payload.persist
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

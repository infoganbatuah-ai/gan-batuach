import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { cameraActionSchema, executeCameraAction } from "@/lib/domain/digital-observer/camera-command-policy";
import { cameraCommandAdapter, probeCameraCapabilities } from "@/lib/domain/digital-observer/camera-gateway-adapter";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  camera_stream_id: z.string().uuid(), request_id: z.string().uuid(), requested_at: z.string().datetime(),
  confirmed: z.literal(true), action: z.enum(["ptz", "talk", "siren", "lighting"]), payload: z.unknown()
});
const demoClaims = new Set<string>();
function synthetic(camera: any) { return Boolean(camera.test_site_type || camera.metadata?.qa_demo || camera.metadata?.synthetic || String(camera.name ?? "").includes("[DEMO]")); }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const { id } = await params;
    const input = bodySchema.parse(await request.json());
    if (input.camera_stream_id !== id) return fail("המצלמה אינה תואמת לפקודה.", 409);
    const supabase = await createClient();
    const { data: camera, error } = await supabase.from("camera_streams" as any)
      .select("id,garden_id,name,area,status,health_status,system_type,source_type")
      .eq("id", id).eq("garden_id", profile.garden_id ?? "").maybeSingle();
    if (error || !camera) return fail("המצלמה לא נמצאה או אינה משויכת לגן שלך.", 404);
    const isDemo = synthetic(camera);
    if (isDemo) {
      if (demoClaims.has(input.request_id)) throw new Error("COMMAND_ALREADY_CLAIMED");
      demoClaims.add(input.request_id);
      return ok({ accepted: true, executed: null, state: "simulated", command_id: null, request_id: input.request_id, audit_recorded: false, simulated: true, message: "בדיקת הדמו הושלמה. לא נשלחה פקודה לחומרה אמיתית." });
    }
    const adapter = cameraCommandAdapter();
    if (!adapter) return fail("לא מוגדר Gateway לשליטת מצלמות. לא נשלחה פקודה.", 503);
    // Normalize the route's camera_stream_id into the command policy field;
    // never pass both IDs to the strict discriminated schema.
    const { camera_stream_id: _cameraStreamId, ...commandInput } = input;
    const payload = cameraActionSchema.parse({ ...commandInput, camera_source_id: id });
    const audit = createAdminClient() as any;
    const baseAudit = {
      event_category: "camera", actor_profile_id: profile.id, actor_role: profile.role,
      target_type: "camera_stream", target_id: id, camera_id: id, garden_id: camera.garden_id,
      request_id: payload.request_id, risk_level: "high"
    };
    const outcome = await executeCameraAction(payload, camera, {
      adapter,
      probe: probeCameraCapabilities,
      async claim(command, probe) {
        const { error } = await audit.from("immutable_audit_events").insert({
          ...baseAudit, id: command.requestId, event_type: "camera_command_dispatch_intent",
          metadata: { action: command.action, garden_id: camera.garden_id, confirmed: payload.confirmed,
            expires_at: command.expiresAt, evidence_id: probe.evidenceId,
            payload_digest: createHash("sha256").update(JSON.stringify(command.payload)).digest("hex") }
        });
        if (error?.code === "23505") throw new Error("COMMAND_ALREADY_CLAIMED");
        if (error) throw new Error("COMMAND_AUDIT_UNAVAILABLE");
      },
      async recordOutcome(value) {
        const { error } = await audit.from("immutable_audit_events").insert({
          ...baseAudit, event_type: `camera_command_${value.state}`,
          metadata: { action: payload.action, state: value.state, executed: value.executed, command_id: value.command_id }
        });
        if (error) throw new Error("COMMAND_AUDIT_UNAVAILABLE");
      }
    });
    return ok({ ...outcome, message: outcome.state === "executed" ? "המצלמה אישרה שהפעולה בוצעה." : "הפקודה התקבלה; הביצוע עדיין לא אושר." }, outcome.state === "executed" ? 200 : 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const failures: Record<string, [string, number]> = {
      CAMERA_OFFLINE: ["המצלמה אינה מקוונת. לא נשלחה פקודה.", 409],
      CAMERA_CAPABILITY_UNAVAILABLE: ["היכולת אינה זמינה במצלמה.", 422],
      HUMAN_CONFIRMATION_REQUIRED: ["נדרש אישור מפורש לפני פעולה פיזית.", 409],
      COMMAND_ALREADY_CLAIMED: ["הפקודה כבר נשלחה; לא נשלחה כפילות.", 409],
      COMMAND_AUDIT_UNAVAILABLE: ["לא ניתן לתעד את הפקודה. לא נשלחה פקודה.", 503],
      INVALID_CAPABILITY_EVIDENCE: ["אימות היכולות חסר או פג תוקף.", 428],
      CAPABILITY_EVIDENCE_REQUIRED: ["נדרש אימות חי של יכולות המצלמה.", 428]
    };
    if (failures[code]) return fail(...failures[code]);
    if (code.startsWith("COMMAND_GATEWAY_")) return fail("חיבור השליטה במצלמה לא זמין או לא תקין. לא נשלחה פקודה.", 503);
    return handleRouteError(error);
  }
}
import { createHash } from "node:crypto";

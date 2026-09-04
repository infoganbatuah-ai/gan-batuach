import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { DigitalGuardEngine } from "@/lib/domain/digital-observer/guard-engine";
import { diagnosticRequestSchema, diagnosticScopeSchema, GuardDiagnosticsService } from "@/lib/domain/digital-observer/guard-diagnostics-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request, write: boolean) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session || session.profile.id !== session.user.id) return fail("נדרשת התחברות לתצפיתן.", 401);
    const params = new URL(request.url).searchParams;
    if (!write && [...params.keys()].some(key => params.getAll(key).length !== 1)) return fail("מסנן כפול אינו מותר.", 422);
    const input = write ? diagnosticRequestSchema.parse(await request.json()) : diagnosticScopeSchema.parse(Object.fromEntries(params));
    const service = new GuardDiagnosticsService({ sessionDb: session.supabase, admin: createAdminClient, profile: session.profile, origin: "dashboard" });
    const engine = new DigitalGuardEngine(service);
    engine.registerCamera({ cameraId: input.camera_source_id });
    const diagnostic = write ? await engine.requestCameraDiagnostics(diagnosticRequestSchema.parse(input)) : await engine.cameraDiagnosticStatus(input);
    return ok({ diagnostic, message: "בדיקת יכולות בלבד. לא אושרה ולא בוצעה פעולה פיזית." }, write && ["queued", "running"].includes(diagnostic.state) ? 202 : 200);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "DIAGNOSTIC_FORBIDDEN" || code === "DIAGNOSTIC_CAMERA_FORBIDDEN") return fail("אין הרשאת ניהול למצלמה באתר Standard שנבחר.", 403);
    if (code === "DIAGNOSTIC_NOT_FOUND") return fail("בקשת האבחון לא נמצאה בתחום ההרשאה שלך.", 404);
    if (code === "DIAGNOSTIC_REQUEST_CONFLICT" || code === "DIAGNOSTIC_MAPPING_CHANGED") return fail("מזהה הבקשה או שיוך המצלמה השתנו. לא נוצרה בקשה חדשה.", 409);
    if (code === "DIAGNOSTIC_STORAGE_UNAVAILABLE") return fail("לא ניתן לשמור או לקרוא כרגע את האבחון. אין להסיק שבוצע.", 503);
    if (code.startsWith("CAMERA_QUEUE_") || code === "DIAGNOSTIC_EVIDENCE_INVALID") return fail("האבחון פג תוקף או שהראיות אינן תקינות.", 422);
    return handleRouteError(error);
  }
}

export const POST = (request: Request) => handle(request, true);
export const GET = (request: Request) => handle(request, false);

import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import {
  compileAuthorizedWatchRule,
  simulateWatchRuleAgainstRealHistory,
  watchRulePersistenceInput
} from "@/lib/domain/digital-observer/watch-rule-service";

export const dynamic = "force-dynamic";

const baseCompile = z.object({
  observer_site_id: z.string().uuid(),
  text: z.string().trim().min(3).max(1200),
  camera_source_id: z.string().uuid().optional().nullable(),
  editing_rule_id: z.string().uuid().optional().nullable()
});
const compileSchema = baseCompile.extend({ action: z.literal("compile") });
const confirmSchema = baseCompile.extend({
  action: z.literal("confirm"),
  candidate_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  idempotency_key: z.string().trim().min(8).max(160)
});
const stateSchema = z.object({
  action: z.literal("set_state"),
  rule_id: z.string().uuid(),
  state: z.enum(["ACTIVE", "DISABLED", "ARCHIVED"]),
  idempotency_key: z.string().trim().min(8).max(160)
});
const requestSchema = z.discriminatedUnion("action", [compileSchema, confirmSchema, stateSchema]);

type Row = Record<string, unknown>;
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

function callRpc(client: unknown, name: string, args: Record<string, unknown>) {
  return (client as RpcClient).rpc(name, args);
}

async function siteContext(
  session: NonNullable<Awaited<ReturnType<typeof getDigitalObserverApiUser>>>,
  observerSiteId: string,
  manage: boolean
) {
  const observerAdmin = session.profile.role === "admin" || hasObserverAdminClaim(session.user.app_metadata);
  const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
  const accessProfile = observerAdmin ? { ...session.profile, role: "admin" } : session.profile;
  const site = await getObserverSiteAccess(dataClient, accessProfile, observerSiteId, manage ? { manage: true } : {});
  return { observerAdmin, dataClient, site };
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const url = new URL(request.url);
    const siteId = url.searchParams.get("observer_site_id");
    if (!siteId || !z.string().uuid().safeParse(siteId).success) return fail("חסר מזהה אתר תקין.", 422);
    const { dataClient, site } = await siteContext(session, siteId, false);
    if (!site) return fail("אין הרשאה לכללי האתר הזה.", 403);
    const [rules, versions, evaluations] = await Promise.all([
      dataClient.from("observer_watch_requests" as never)
        .select("id,observer_site_id,camera_source_id,zone_id,title,description,watch_type,active,priority,schedule,original_natural_language,structured_rule,validation_status,compiler_version,rule_version,rule_state,confirmed_at,last_matched_at,match_count,archived_at,metadata,created_at,updated_at")
        .eq("observer_site_id", siteId).not("compiler_version", "is", null).order("updated_at", { ascending: false }).limit(200),
      dataClient.from("digital_observer_watch_rule_versions" as never)
        .select("id,rule_id,version,original_natural_language,structured_rule,validation_status,compiler_version,candidate_fingerprint,change_type,environment,created_at")
        .eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(500),
      dataClient.from("digital_observer_watch_rule_evaluations" as never)
        .select("id,rule_id,rule_version,event_id,incident_id,risk_evaluation_id,matched,matched_conditions,non_match_reasons,evaluation_version,event_provenance,evaluated_at")
        .eq("observer_site_id", siteId).order("evaluated_at", { ascending: false }).limit(500)
    ]);
    if (rules.error || versions.error || evaluations.error) throw new Error("WATCH_RULE_READ_FAILED");
    return ok({
      rules: rules.data ?? [],
      versions: versions.data ?? [],
      evaluations: evaluations.data ?? [],
      contract: {
        schema: "do-watch-rule-v1",
        compiler: "do-watch-compiler-v1",
        evaluator: "do-watch-evaluator-v1",
        confirmation_required: true,
        real_camera_events_only: true,
        arbitrary_actions: false,
        external_execution: false
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = requestSchema.parse(await request.json());

    if (payload.action === "set_state") {
      const observerAdmin = session.profile.role === "admin" || hasObserverAdminClaim(session.user.app_metadata);
      const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
      const existing = await dataClient.from("observer_watch_requests" as never)
        .select("id,observer_site_id,compiler_version").eq("id", payload.rule_id).maybeSingle();
      const row = existing.data as Row | null;
      if (!row?.observer_site_id || !row.compiler_version) return fail("הכלל לא נמצא.", 404);
      const { site } = await siteContext(session, String(row.observer_site_id), true);
      if (!site) return fail("אין הרשאה לעדכן את הכלל.", 403);
      const changed = await callRpc(session.supabase, "set_digital_observer_watch_rule_state", {
        requested_rule_id: payload.rule_id,
        requested_state: payload.state,
        requested_idempotency_key: payload.idempotency_key
      });
      if (changed.error || !changed.data) return fail("לא ניתן לעדכן את מצב הכלל.", 409);
      return ok({ rule: changed.data, message: payload.state === "ACTIVE" ? "הכלל הופעל מחדש." : payload.state === "DISABLED" ? "הכלל הושבת." : "הכלל הועבר לארכיון." });
    }

    const { dataClient, site } = await siteContext(session, payload.observer_site_id, true);
    if (!site) return fail("אין הרשאה ליצור כלל באתר הזה.", 403);
    if (payload.editing_rule_id) {
      const existing = await dataClient.from("observer_watch_requests" as never)
        .select("id,observer_site_id,compiler_version").eq("id", payload.editing_rule_id)
        .eq("observer_site_id", payload.observer_site_id).maybeSingle();
      if (!(existing.data as Row | null)?.compiler_version) return fail("הכלל לעריכה לא נמצא.", 404);
    }
    const { compilation } = await compileAuthorizedWatchRule({
      db: dataClient,
      observerSiteId: payload.observer_site_id,
      timezone: String(site.timezone ?? "Asia/Jerusalem"),
      text: payload.text,
      explicitCameraSourceId: payload.camera_source_id
    });
    const simulation = compilation.candidate && compilation.validation.valid
      ? await simulateWatchRuleAgainstRealHistory({ db: dataClient, rule: compilation.candidate, days: 7 })
      : null;

    if (payload.action === "compile") {
      return ok({ compilation, simulation, activated: false });
    }
    if (compilation.status !== "READY_FOR_CONFIRMATION" || !compilation.candidate || !compilation.candidateFingerprint) {
      return fail("הכלל אינו מוכן להפעלה ודורש תיקון או הבהרה.", 422, { compilation });
    }
    if (compilation.candidateFingerprint !== payload.candidate_fingerprint) {
      return fail("הפירוש השתנה מאז התצוגה המקדימה. יש לבדוק ולאשר אותו מחדש.", 409);
    }
    const persistence = watchRulePersistenceInput(compilation);
    const activated = await callRpc(session.supabase, "activate_digital_observer_watch_rule", {
      requested_observer_site_id: payload.observer_site_id,
      requested_rule_id: payload.editing_rule_id ?? null,
      requested_original_text: compilation.originalText,
      requested_structured_rule: compilation.candidate,
      requested_compiler_version: compilation.compilerVersion,
      requested_candidate_fingerprint: compilation.candidateFingerprint,
      requested_idempotency_key: payload.idempotency_key,
      requested_title: persistence.title,
      requested_watch_type: persistence.watchType,
      requested_priority: persistence.priority,
      requested_schedule: persistence.schedule,
      requested_metadata: persistence.metadata
    });
    if (activated.error || !activated.data) return fail("הכלל עבר validation אך לא ניתן היה להפעיל אותו.", 409);
    return ok({
      rule: activated.data,
      compilation,
      simulation,
      activated: true,
      message: "הכלל אושר והופעל. הוא ייבדק רק מול אירועי מצלמה אמיתיים; פעולה חיצונית אינה מופעלת."
    }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}

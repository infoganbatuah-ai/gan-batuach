import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import {
  buildFeedbackQualityMetrics,
  DIGITAL_OBSERVER_FEEDBACK_LABELS,
  type ReviewedCalibrationSample
} from "@/lib/domain/digital-observer/feedback-calibration";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

export const dynamic = "force-dynamic";

const label = z.enum(DIGITAL_OBSERVER_FEEDBACK_LABELS);
const targetType = z.enum(["INCIDENT", "EVENT", "VERIFICATION", "DECISION", "EVIDENCE"]);
const base = z.object({
  idempotency_key: z.string().trim().min(8).max(120),
  reason_code: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional()
});
const submitSchema = base.extend({
  action: z.literal("submit"),
  incident_id: z.string().uuid(),
  label,
  target_type: targetType.optional().default("INCIDENT"),
  target_id: z.string().uuid().optional()
});
const reviewSchema = base.extend({
  action: z.literal("review"),
  feedback_id: z.string().uuid(),
  label: label.optional()
});
const requestSchema = z.discriminatedUnion("action", [submitSchema, reviewSchema]);

type Row = Record<string, unknown>;
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function callRpc(client: unknown, name: string, args: Record<string, unknown>) {
  return (client as RpcClient).rpc(name, args);
}

async function canReviewSite(session: NonNullable<Awaited<ReturnType<typeof getDigitalObserverApiUser>>>, siteId: string) {
  if (session.profile.role === "admin" || hasObserverAdminClaim(session.user.app_metadata)) return true;
  const membership = await session.supabase.from("observer_site_memberships" as never)
    .select("id")
    .eq("observer_site_id", siteId)
    .eq("profile_id", session.profile.id)
    .eq("active", true)
    .in("member_role", ["admin", "reviewer"])
    .maybeSingle();
  return Boolean(membership.data);
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const observerAdmin = session.profile.role === "admin" || hasObserverAdminClaim(session.user.app_metadata);
    const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
    const accessProfile = observerAdmin ? { ...session.profile, role: "admin" } : session.profile;
    const url = new URL(request.url);
    const incidentId = url.searchParams.get("incident_id");
    if (!incidentId || !z.string().uuid().safeParse(incidentId).success) return fail("חסר מזהה תקרית תקין.", 422);

    const incident = await dataClient.from("observer_correlated_events" as never)
      .select("id,observer_site_id,provenance,current_feedback_label,latest_feedback_revision_id,feedback_updated_at,current_ground_truth_label,latest_ground_truth_review_id,ground_truth_reviewed_at")
      .eq("id", incidentId).eq("correlation_version", "do-track-v1").maybeSingle();
    const incidentRow = incident.data as Row | null;
    if (!incidentRow?.observer_site_id) return fail("התקרית לא נמצאה.", 404);
    const site = await getObserverSiteAccess(dataClient, accessProfile, String(incidentRow.observer_site_id));
    if (!site) return fail("אין הרשאה לתקרית הזאת.", 403);

    const [feedback, groundTruth] = await Promise.all([
      dataClient.from("digital_observer_feedback_revisions" as never)
        .select("id,target_type,target_id,label,actor_role,reason_code,note,previous_feedback_id,revision_number,feedback_version,source,environment,created_at")
        .eq("incident_id", incidentId).order("revision_number", { ascending: false }).limit(100),
      dataClient.from("observer_ground_truth_reviews" as never)
        .select("id,feedback_revision_id,canonical_label,review_state,reviewer_role,reason_code,previous_review_id,review_number,review_version,environment,created_at")
        .eq("incident_id", incidentId).not("canonical_label", "is", null).order("review_number", { ascending: false }).limit(100)
    ]);
    if (feedback.error || groundTruth.error) throw new Error("FEEDBACK_HISTORY_READ_FAILED");

    let calibration: unknown[] = [];
    let recommendations: unknown[] = [];
    let qualityMetrics: ReturnType<typeof buildFeedbackQualityMetrics> | null = null;
    if (observerAdmin) {
      const admin = createDigitalObserverAdminDataClient();
      const [samplesResult, reviewsResult, recommendationsResult] = await Promise.all([
        admin.from("digital_observer_calibration_samples" as never)
          .select("id,observer_site_id,camera_source_id,ground_truth_review_id,canonical_label,environment,incident_provenance,decision_snapshot,verification_snapshot,version_snapshot,decision_quality,calibration_signal_type,dataset_version,training_eligible,raw_media_copied,created_at")
          .eq("observer_site_id", site.id).order("created_at", { ascending: false }).limit(1000),
        admin.from("observer_ground_truth_reviews" as never)
          .select("id,review_state").eq("observer_site_id", site.id).not("canonical_label", "is", null).limit(1000),
        admin.from("digital_observer_calibration_recommendations" as never)
          .select("id,ground_truth_review_id,scope_type,scope_id,recommendation_type,status,sample_size,recommendation_confidence,evidence_summary,affected_versions,recommendation_version,requires_human_approval,production_change_applied,created_at")
          .eq("observer_site_id", site.id).order("created_at", { ascending: false }).limit(100)
      ]);
      if (samplesResult.error || reviewsResult.error || recommendationsResult.error) throw new Error("CALIBRATION_ADMIN_READ_FAILED");
      const reviewState = new Map((reviewsResult.data ?? []).map((row: Row) => [String(row.id), String(row.review_state)]));
      const rows = (samplesResult.data ?? []) as Row[];
      const mapped: ReviewedCalibrationSample[] = rows.map((row) => {
        const decision = objectValue(row.decision_snapshot);
        const verification = objectValue(row.verification_snapshot);
        return {
          id: String(row.id),
          canonicalLabel: String(row.canonical_label) as ReviewedCalibrationSample["canonicalLabel"],
          environment: String(row.environment) as ReviewedCalibrationSample["environment"],
          incidentProvenance: String(row.incident_provenance),
          reviewState: (reviewState.get(String(row.ground_truth_review_id)) ?? "REVIEWED") as ReviewedCalibrationSample["reviewState"],
          observerSiteId: String(row.observer_site_id),
          cameraSourceId: typeof row.camera_source_id === "string" ? row.camera_source_id : null,
          decision: typeof decision.decision === "string" ? decision.decision : null,
          verificationStatus: typeof verification.status === "string" ? verification.status : null,
          verificationClassification: typeof verification.classification === "string" ? verification.classification : null,
          versionSnapshot: objectValue(row.version_snapshot)
        };
      });
      calibration = rows;
      recommendations = recommendationsResult.data ?? [];
      qualityMetrics = buildFeedbackQualityMetrics(mapped);
    }

    return ok({
      incident: incidentRow,
      feedback_history: feedback.data ?? [],
      ground_truth_history: groundTruth.data ?? [],
      calibration_samples: calibration,
      calibration_recommendations: recommendations,
      quality_metrics: qualityMetrics,
      can_review: await canReviewSite(session, site.id),
      contract: {
        feedback_version: "do-feedback-v1",
        ground_truth_version: "do-ground-truth-v1",
        dataset_version: "do-feedback-dataset-v1",
        raw_feedback_is_ground_truth: false,
        automatic_production_mutation: false,
        recall_available: false
      }
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const observerAdmin = session.profile.role === "admin" || hasObserverAdminClaim(session.user.app_metadata);
    const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
    const accessProfile = observerAdmin ? { ...session.profile, role: "admin" } : session.profile;
    const payload = requestSchema.parse(await request.json());

    if (payload.action === "submit") {
      const incident = await dataClient.from("observer_correlated_events" as never)
        .select("id,observer_site_id,primary_camera_source_id,provenance")
        .eq("id", payload.incident_id).eq("correlation_version", "do-track-v1").maybeSingle();
      const incidentRow = incident.data as Row | null;
      if (!incidentRow?.observer_site_id) return fail("התקרית לא נמצאה.", 404);
      const site = await getObserverSiteAccess(dataClient, accessProfile, String(incidentRow.observer_site_id), { manage: true });
      if (!site) return fail("אין הרשאה לשמור משוב לתקרית הזאת.", 403);
      if (incidentRow.provenance !== "REAL_CAMERA_AI") return fail("משוב Production נרשם רק לתקרית מצלמה אמיתית.", 409);

      const result = await callRpc(session.supabase, "record_digital_observer_incident_feedback", {
        requested_incident_id: payload.incident_id,
        requested_label: payload.label,
        requested_reason_code: payload.reason_code || null,
        requested_note: payload.note || null,
        requested_source: "PRODUCT_UI",
        requested_idempotency_key: payload.idempotency_key,
        requested_target_type: payload.target_type,
        requested_target_id: payload.target_id || payload.incident_id
      });
      if (result.error || !result.data) return fail("לא ניתן לשמור את המשוב.", 409);
      await writeAuditEvent({
        eventType: "observer_incident_feedback_recorded",
        eventCategory: "observer",
        actorProfileId: session.profile.id,
        actorRole: session.profile.role,
        targetType: payload.target_type.toLowerCase(),
        targetId: payload.target_id || payload.incident_id,
        cameraId: typeof incidentRow.primary_camera_source_id === "string" ? incidentRow.primary_camera_source_id : null,
        riskLevel: "low",
        metadata: {
          observer_site_id: site.id,
          incident_id: payload.incident_id,
          label: payload.label,
          feedback_version: "do-feedback-v1",
          automatic_production_mutation: false
        }
      });
      return ok({
        feedback_id: result.data,
        label: payload.label,
        message: "המשוב נשמר וישמש לשיפור וכיול מבוקר של המערכת. לא בוצע שינוי אוטומטי במודל או במדיניות."
      });
    }

    const feedback = await dataClient.from("digital_observer_feedback_revisions" as never)
      .select("id,observer_site_id,incident_id,label")
      .eq("id", payload.feedback_id).maybeSingle();
    const feedbackRow = feedback.data as Row | null;
    if (!feedbackRow?.observer_site_id) return fail("המשוב לא נמצא.", 404);
    if (!await canReviewSite(session, String(feedbackRow.observer_site_id))) return fail("אין הרשאת Ground Truth לאתר הזה.", 403);

    const result = await callRpc(session.supabase, "review_digital_observer_incident_feedback", {
      requested_feedback_id: payload.feedback_id,
      requested_label: payload.label || null,
      requested_reason_code: payload.reason_code || null,
      requested_note: payload.note || null,
      requested_idempotency_key: payload.idempotency_key
    });
    if (result.error || !result.data) return fail("לא ניתן להשלים את ביקורת ה‑Ground Truth.", 409);
    const reviewed = objectValue(result.data);
    await writeAuditEvent({
      eventType: "observer_ground_truth_reviewed",
      eventCategory: "observer",
      actorProfileId: session.profile.id,
      actorRole: session.profile.role,
      targetType: "observer_correlated_event",
      targetId: String(feedbackRow.incident_id),
      riskLevel: "medium",
      metadata: {
        observer_site_id: feedbackRow.observer_site_id,
        feedback_id: payload.feedback_id,
        ground_truth_review_id: reviewed.ground_truth_review_id,
        calibration_sample_id: reviewed.calibration_sample_id,
        automatic_production_change: false
      }
    });
    return ok({
      review: reviewed,
      message: "התיוג אושר כ‑Ground Truth ונוסף לנתוני הכיול. כל שינוי Production עדיין מחייב אישור וגרסה חדשה."
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}

import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const siteId = new URL(request.url).searchParams.get("observer_site_id");
    const incidentId = new URL(request.url).searchParams.get("incident_id");
    if (!siteId) return fail("חסר מזהה אתר.", 422);
    const observerAdmin = hasObserverAdminClaim(session.user.app_metadata);
    const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
    const site = observerAdmin
      ? (await dataClient.from("observer_sites" as never).select("id,name,site_type,garden_id").eq("id", siteId)
        .is("garden_id", null).neq("site_type", "kindergarten").maybeSingle()).data
      : await getObserverSiteAccess(session.supabase, session.profile, siteId);
    if (!site) return fail("אין הרשאה לאתר הזה.", 403);
    const incidents = await dataClient.from("observer_correlated_events" as never)
      .select("id,observer_site_id,status,severity,confidence,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_camera_ids,involved_track_ids,related_event_ids,provenance,correlation_version,timeline_summary,current_risk_score,peak_risk_score,current_risk_band,risk_evaluation_confidence,current_decision,latest_risk_evaluation_id,risk_updated_at,current_verification_status,verification_classification,verification_confidence,final_decision,final_decision_confidence,latest_verification_id,verification_updated_at,current_feedback_label,latest_feedback_revision_id,feedback_updated_at,current_ground_truth_label,latest_ground_truth_review_id,ground_truth_reviewed_at,metadata")
      .eq("observer_site_id", site.id).eq("correlation_version", "do-track-v1")
      .order("last_activity_at", { ascending: false }).limit(100);
    if (incidents.error) throw new Error("INCIDENT_READ_FAILED");
    const incidentRows = (incidents.data ?? []) as unknown as Array<{ id: string }>;
    const selected = incidentId ? incidentRows.find((incident) => incident.id === incidentId) : null;
    if (incidentId && !selected) return fail("התקרית לא נמצאה באתר הזה.", 404);
    const [evaluations, decisions, verifications] = selected ? await Promise.all([
      dataClient.from("digital_observer_risk_evaluations" as never)
        .select("id,incident_id,triggering_event_id,risk_score,peak_risk_score,risk_band,evaluation_confidence,contributing_factors,mitigating_factors,matched_rules,baseline_context,explanation,recommended_decision,action_intents,risk_engine_version,factor_version,decision_version,evaluated_at,metadata")
        .eq("observer_site_id", site.id).eq("incident_id", selected.id).order("evaluated_at", { ascending: false }).limit(100),
      dataClient.from("digital_observer_decision_intents" as never)
        .select("id,incident_id,risk_evaluation_id,decision,status,cooldown_until,requires_human_review,external_execution_enabled,created_at,metadata")
        .eq("observer_site_id", site.id).eq("incident_id", selected.id).order("created_at", { ascending: false }).limit(100),
      dataClient.from("digital_observer_incident_verifications" as never)
        .select("id,incident_id,risk_evaluation_id,status,classification,verification_confidence,final_decision_confidence,confirmed_signals,contradictory_signals,verification_reasons,required_followup,final_decision,fast_path,metrics,verification_version,final_decision_version,previous_verification_id,evaluated_at")
        .eq("observer_site_id", site.id).eq("incident_id", selected.id).order("evaluated_at", { ascending: false }).limit(100)
    ]) : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];
    const metricRows = await dataClient.from("digital_observer_incident_verifications" as never)
      .select("status,classification,evaluated_at,metrics")
      .eq("observer_site_id", site.id).order("evaluated_at", { ascending: false }).limit(1000);
    if (evaluations.error || decisions.error || verifications.error || metricRows.error) throw new Error("INCIDENT_VERIFICATION_READ_FAILED");
    const metrics = (metricRows.data ?? []) as unknown as Array<{ status?: string; classification?: string; metrics?: { timeToVerificationMs?: number } }>;
    const verificationTimes = metrics.map((row) => Number(row.metrics?.timeToVerificationMs)).filter(Number.isFinite);
    return ok({
      incidents: incidents.data ?? [],
      count: incidents.data?.length ?? 0,
      source: "observer_correlated_events",
      risk_evaluations: evaluations.data ?? [],
      decision_intents: decisions.data ?? [],
      incident_verifications: verifications.data ?? [],
      verification_metrics: {
        total: metrics.length,
        confirmed_real: metrics.filter((row) => ["CONFIRMED", "RESOLVED"].includes(String(row.status))).length,
        uncertain: metrics.filter((row) => ["UNVERIFIED", "LIKELY", "UNCERTAIN"].includes(String(row.status))).length,
        rejected_false_detection: metrics.filter((row) => row.classification === "FALSE_DETECTION").length,
        expected_activity: metrics.filter((row) => row.classification === "TRUE_EXPECTED_ACTIVITY").length,
        average_time_to_verification_ms: verificationTimes.length
          ? Math.round(verificationTimes.reduce((sum, value) => sum + value, 0) / verificationTimes.length)
          : null
      },
      risk_contract: { engine: "do-risk-v1", deterministic: true, llm_decision: false, external_execution_enabled: false },
      verification_contract: {
        engine: "do-verification-v2",
        final_decision: "do-final-decision-v1",
        deterministic: true,
        real_provenance_only: true,
        admin_debug: observerAdmin,
        external_execution_enabled: false
      },
      feedback_contract: {
        version: "do-feedback-v1",
        ground_truth_version: "do-ground-truth-v1",
        reviewed_dataset_version: "do-feedback-dataset-v1",
        raw_feedback_is_ground_truth: false,
        automatic_model_or_policy_mutation: false
      }
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}

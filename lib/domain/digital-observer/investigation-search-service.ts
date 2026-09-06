import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CanonicalInvestigationQuery } from "./investigation-query";
import {
  assembleInvestigationResults,
  type InvestigationClipRow,
  type InvestigationEventRow,
  type InvestigationIncidentRow,
  type InvestigationRuleEvaluationRow,
  type InvestigationSearchResult,
  type InvestigationSource
} from "./investigation-results";

const scanCap = 500;

type InvestigationDb = SupabaseClient<Database>;

function cameraFilter(ids: string[]) {
  return ids.length ? `metadata->>camera_source_id.in.(${ids.join(",")}),camera_id.in.(${ids.join(",")})` : null;
}

export async function searchDigitalObserverInvestigation(input: {
  db: InvestigationDb;
  query: CanonicalInvestigationQuery;
  sources: InvestigationSource[];
  now?: Date;
}): Promise<InvestigationSearchResult & { queryLatencyMs: number }> {
  const started = performance.now();
  const query = input.query;
  let events = input.db.from("observer_intelligence_signals" as never)
    .select("id,observer_site_id,camera_id,signal_type,severity,confidence,review_status,recommended_action,metadata,created_at")
    .eq("observer_site_id", query.observerSiteId)
    .eq("metadata->>validated_event", "true")
    .in("metadata->>observation_provenance", [...query.provenance])
    .gte("created_at", query.fromInclusive)
    .lt("created_at", query.toExclusive);
  const sourceFilter = cameraFilter(query.cameraSourceIds);
  if (sourceFilter) events = events.or(sourceFilter);
  if (query.eventTypes.length) events = events.in("metadata->>event_type", [...query.eventTypes]);
  if (query.detectionConfidenceMin != null) events = events.gte("confidence", query.detectionConfidenceMin);
  events = events.order("created_at", { ascending: false }).limit(scanCap + 1);

  let incidents = input.db.from("observer_correlated_events" as never)
    .select("id,observer_site_id,status,title,summary,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_camera_ids,involved_track_ids,related_event_ids,provenance,correlation_version,timeline_summary,current_risk_score,peak_risk_score,current_risk_band,risk_evaluation_confidence,current_decision,current_verification_status,verification_classification,verification_confidence,final_decision,final_decision_confidence,current_feedback_label,current_ground_truth_label,metadata")
    .eq("observer_site_id", query.observerSiteId)
    .eq("correlation_version", "do-track-v1")
    .in("provenance", [...query.provenance])
    .lt("opened_at", query.toExclusive)
    .gte("last_activity_at", query.fromInclusive);
  if (query.cameraSourceIds.length) incidents = incidents.in("primary_camera_source_id", query.cameraSourceIds);
  if (query.incidentStatuses.length) incidents = incidents.in("status", query.incidentStatuses);
  if (query.riskBands.length) incidents = incidents.in("current_risk_band", query.riskBands);
  if (query.riskScore) incidents = incidents.gte("current_risk_score", query.riskScore.min).lte("current_risk_score", query.riskScore.max);
  if (query.verificationStates.length) incidents = incidents.in("current_verification_status", query.verificationStates);
  if (query.decisions.length) incidents = incidents.or(`current_decision.in.(${query.decisions.join(",")}),final_decision.in.(${query.decisions.join(",")})`);
  incidents = incidents.order("last_activity_at", { ascending: false }).limit(scanCap + 1);

  const clips = input.db.from("digital_observer_event_clips" as never)
    .select("id,observer_site_id,camera_source_id,signal_id,clip_status,media_status,media_missing_reason,captured_at,duration_seconds,delete_after,metadata")
    .eq("observer_site_id", query.observerSiteId)
    .gte("created_at", new Date(Date.parse(query.fromInclusive) - 3_600_000).toISOString())
    .lt("created_at", new Date(Date.parse(query.toExclusive) + 3_600_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(scanCap + 1);

  const ruleEvaluations = query.watchRuleMatched === true
    ? input.db.from("digital_observer_watch_rule_evaluations" as never)
      .select("id,observer_site_id,rule_id,event_id,incident_id,matched,event_provenance,evaluated_at")
      .eq("observer_site_id", query.observerSiteId).eq("matched", true).eq("event_provenance", "REAL_CAMERA_AI")
      .gte("evaluated_at", query.fromInclusive).lt("evaluated_at", query.toExclusive)
      .order("evaluated_at", { ascending: false }).limit(scanCap + 1)
    : Promise.resolve({ data: [], error: null });

  const [eventResult, incidentResult, clipResult, ruleResult] = await Promise.all([events, incidents, clips, ruleEvaluations]);
  if (eventResult.error) throw new Error(`INVESTIGATION_EVENT_READ_FAILED:${eventResult.error.code ?? "unknown"}`);
  if (incidentResult.error) throw new Error(`INVESTIGATION_INCIDENT_READ_FAILED:${incidentResult.error.code ?? "unknown"}`);
  if (clipResult.error) throw new Error(`INVESTIGATION_EVIDENCE_READ_FAILED:${clipResult.error.code ?? "unknown"}`);
  if (ruleResult.error) throw new Error(`INVESTIGATION_RULE_READ_FAILED:${ruleResult.error.code ?? "unknown"}`);

  const eventRows = (eventResult.data ?? []).slice(0, scanCap) as unknown as InvestigationEventRow[];
  const incidentRows = (incidentResult.data ?? []).slice(0, scanCap) as unknown as InvestigationIncidentRow[];
  const clipRows = (clipResult.data ?? []).slice(0, scanCap) as unknown as InvestigationClipRow[];
  const ruleRows = (ruleResult.data ?? []).slice(0, scanCap) as unknown as InvestigationRuleEvaluationRow[];
  const assembled = assembleInvestigationResults({
    query,
    sources: input.sources,
    eventRows,
    clipRows,
    incidentRows,
    ruleEvaluationRows: ruleRows,
    now: input.now,
    scanCapReached: [eventResult.data, incidentResult.data, clipResult.data, ruleResult.data].some((rows) => (rows?.length ?? 0) > scanCap)
  });
  return { ...assembled, queryLatencyMs: Math.max(0, Math.round((performance.now() - started) * 10) / 10) };
}

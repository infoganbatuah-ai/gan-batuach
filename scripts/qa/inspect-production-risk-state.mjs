import { createClient } from "@supabase/supabase-js";

const siteId = process.argv[2];
if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(siteId ?? "")) {
  throw new Error("A valid observer site ID is required");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Production database configuration is unavailable");
const projectRef = new URL(url).hostname.split(".")[0];
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const [events, incidents, evaluations, decisions, schedule, baseline, rules] = await Promise.all([
  db.from("observer_intelligence_signals")
    .select("id,created_at,confidence,metadata")
    .eq("observer_site_id", siteId)
    .eq("source_type", "system")
    .order("created_at", { ascending: false })
    .limit(12),
  db.from("observer_correlated_events")
    .select("id,status,opened_at,last_activity_at,closed_at,involved_track_ids,related_event_ids,current_risk_score,peak_risk_score,current_risk_band,risk_evaluation_confidence,current_decision,risk_updated_at,latest_risk_evaluation_id")
    .eq("observer_site_id", siteId)
    .order("last_activity_at", { ascending: false })
    .limit(8),
  db.from("digital_observer_risk_evaluations")
    .select("id,incident_id,triggering_event_id,risk_score,peak_risk_score,risk_band,evaluation_confidence,contributing_factors,mitigating_factors,matched_rules,baseline_context,explanation,recommended_decision,action_intents,risk_engine_version,factor_version,decision_version,evaluated_at")
    .eq("observer_site_id", siteId)
    .order("evaluated_at", { ascending: false })
    .limit(12),
  db.from("digital_observer_decision_intents")
    .select("id,incident_id,risk_evaluation_id,decision,status,dedupe_key,cooldown_until,requires_human_review,external_execution_enabled,created_at")
    .eq("observer_site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(12),
  db.from("observer_monitoring_schedules")
    .select("status,schedule_mode,timezone,active_days,active_hours,schedule")
    .eq("observer_site_id", siteId)
    .maybeSingle(),
  db.from("site_behavior_baselines")
    .select("confidence_level,baseline_value,metadata")
    .eq("observer_site_id", siteId)
    .eq("baseline_type", "normal_movement_patterns")
    .maybeSingle(),
  db.from("observer_watch_requests")
    .select("id,camera_id,camera_source_id,title,watch_type,priority,active,metadata,updated_at")
    .eq("observer_site_id", siteId)
    .eq("active", true)
    .limit(100)
]);

for (const [name, result] of Object.entries({ events, incidents, evaluations, decisions, schedule, baseline, rules })) {
  if (result.error) throw new Error(`${name} query failed: ${result.error.code ?? "unknown"}`);
}

console.log(JSON.stringify({
  project_ref: projectRef,
  observer_site_id: siteId,
  events: events.data.map((event) => ({
    id: event.id,
    created_at: event.created_at,
    confidence: event.confidence,
    event_type: event.metadata?.event_type ?? null,
    provenance: event.metadata?.observation_provenance ?? null,
    camera_source_id: event.metadata?.camera_source_id ?? null,
    stream_id: event.metadata?.stream_id ?? null,
    track_id: event.metadata?.track_id ?? null
  })),
  incidents: incidents.data,
  evaluations: evaluations.data,
  decisions: decisions.data,
  schedule: schedule.data,
  baseline: baseline.data ? {
    confidence_level: baseline.data.confidence_level,
    maturity: baseline.data.baseline_value?.real_event_context?.baseline_maturity ?? null,
    version: baseline.data.baseline_value?.real_event_context?.version ?? null,
    real_event_count: baseline.data.baseline_value?.real_event_context?.real_event_count ?? null
  } : null,
  rules: rules.data.map((rule) => ({
    id: rule.id,
    camera_id: rule.camera_source_id ?? rule.camera_id ?? null,
    title: rule.title,
    watch_type: rule.watch_type,
    priority: rule.priority,
    active: rule.active,
    risk_policy: rule.metadata?.risk_policy ?? null,
    updated_at: rule.updated_at
  }))
}, null, 2));

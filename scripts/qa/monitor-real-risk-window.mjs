import { createClient } from "@supabase/supabase-js";

const siteId = process.argv[2];
const durationSeconds = Math.max(30, Math.min(300, Number(process.argv[3] ?? 180)));
if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(siteId ?? "")) {
  throw new Error("A valid observer site ID is required");
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Production database configuration is unavailable");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const startedAt = new Date();
const deadline = Date.now() + durationSeconds * 1_000;
const seen = new Set();

console.log(JSON.stringify({ status: "REAL_RISK_WINDOW_ACTIVE", started_at: startedAt.toISOString(), duration_seconds: durationSeconds }));

while (Date.now() < deadline) {
  const events = await db.from("observer_intelligence_signals")
    .select("id,created_at,confidence,metadata")
    .eq("observer_site_id", siteId)
    .eq("source_type", "system")
    .gte("created_at", startedAt.toISOString())
    .order("created_at", { ascending: true });
  if (events.error) throw new Error(`Event query failed: ${events.error.code ?? "unknown"}`);

  for (const event of events.data ?? []) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const metadata = event.metadata ?? {};
    console.log(JSON.stringify({
      kind: "event",
      id: event.id,
      created_at: event.created_at,
      event_type: metadata.event_type ?? null,
      confidence: event.confidence,
      provenance: metadata.observation_provenance ?? null,
      camera_source_id: metadata.camera_source_id ?? null,
      stream_id: metadata.stream_id ?? null,
      track_id: metadata.track_id ?? null
    }));
  }

  const evaluations = await db.from("digital_observer_risk_evaluations")
    .select("id,incident_id,triggering_event_id,risk_score,peak_risk_score,risk_band,evaluation_confidence,recommended_decision,contributing_factors,mitigating_factors,matched_rules,baseline_context,explanation,evaluated_at")
    .eq("observer_site_id", siteId)
    .gte("evaluated_at", startedAt.toISOString())
    .order("evaluated_at", { ascending: true });
  if (evaluations.error) throw new Error(`Risk query failed: ${evaluations.error.code ?? "unknown"}`);

  for (const evaluation of evaluations.data ?? []) {
    const marker = `risk:${evaluation.id}`;
    if (seen.has(marker)) continue;
    seen.add(marker);
    console.log(JSON.stringify({ kind: "risk", ...evaluation }));
  }

  if ((evaluations.data ?? []).some((evaluation) => evaluation.recommended_decision)) {
    console.log(JSON.stringify({ status: "REAL_RISK_OBSERVED", ended_at: new Date().toISOString() }));
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 5_000));
}

console.log(JSON.stringify({ status: "WINDOW_COMPLETE", ended_at: new Date().toISOString(), observed_records: seen.size }));

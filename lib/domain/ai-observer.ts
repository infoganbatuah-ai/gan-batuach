import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const aiDetectionTypes = [
  "violence_detection",
  "child_alone_detection",
  "restricted_area_detection",
  "cry_detection",
  "staff_absence_detection",
  "child_outside_allowed_zone",
  "fall_detection",
  "crowding_detection",
  "overcrowding_detection",
  "sleeping_anomaly",
  "no_movement",
  "panic_movement",
  "camera_covered",
  "camera_disconnected"
] as const;

export const aiObservationSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  event_type: z.enum(aiDetectionTypes),
  confidence: z.number().min(0).max(1),
  snapshot_storage_path: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  notes: z.string().optional()
});

const severityByEvent: Record<(typeof aiDetectionTypes)[number], "low" | "medium" | "high" | "critical"> = {
  violence_detection: "critical",
  child_alone_detection: "high",
  restricted_area_detection: "critical",
  cry_detection: "medium",
  staff_absence_detection: "high",
  child_outside_allowed_zone: "critical",
  fall_detection: "critical",
  crowding_detection: "medium",
  overcrowding_detection: "high",
  sleeping_anomaly: "high",
  no_movement: "high",
  panic_movement: "high",
  camera_covered: "high",
  camera_disconnected: "high"
};

function pickRule(rules: any[], gardenId: string, cameraStreamId?: string) {
  return (
    rules.find((rule) => rule.camera_stream_id && cameraStreamId && rule.camera_stream_id === cameraStreamId) ??
    rules.find((rule) => rule.garden_id === gardenId && !rule.camera_stream_id) ??
    rules.find((rule) => !rule.garden_id && !rule.camera_stream_id) ??
    null
  );
}

export async function registerAiObservation(payload: z.infer<typeof aiObservationSchema>) {
  // Future architecture integration point:
  // AI_GATEWAY_URL will orchestrate face-recognition-service,
  // speech-analysis-service and motion analysis. This function is the current
  // signed event ingestion contract for structured AI events after gateway-side
  // analysis, without claiming live AI is active before the gateway exists.
  const parsed = aiObservationSchema.parse(payload);
  const supabase = createAdminClient();
  const { data: rules, error: rulesError } = await supabase
    .from("ai_observer_rules")
    .select("*")
    .eq("event_type", parsed.event_type)
    .eq("enabled", true)
    .or(`garden_id.is.null,garden_id.eq.${parsed.garden_id}` as any);
  if (rulesError) throw new Error(rulesError.message);

  const rule = pickRule((rules as any[]) ?? [], parsed.garden_id, parsed.camera_stream_id);
  const threshold = Number(rule?.threshold ?? 0.75);
  const cooldownSeconds = Number(rule?.cooldown_seconds ?? 60);
  const severity = (rule?.severity ?? severityByEvent[parsed.event_type]) as "low" | "medium" | "high" | "critical";

  if (parsed.confidence < threshold) {
    return {
      status: "suppressed",
      reason: "below_threshold",
      event_type: parsed.event_type,
      confidence: parsed.confidence,
      threshold
    };
  }

  const cooldownSince = new Date(Date.now() - cooldownSeconds * 1000).toISOString();
  let cooldownQuery = supabase
    .from("ai_events")
    .select("id, created_at")
    .eq("garden_id", parsed.garden_id)
    .eq("event_type", parsed.event_type)
    .gte("created_at", cooldownSince)
    .limit(1);
  cooldownQuery = parsed.camera_stream_id ? cooldownQuery.eq("camera_stream_id", parsed.camera_stream_id) : cooldownQuery.is("camera_stream_id", null);
  const { data: recentEvent, error: cooldownError } = await cooldownQuery.maybeSingle();
  if (cooldownError) throw new Error(cooldownError.message);

  if (recentEvent) {
    return {
      status: "suppressed",
      reason: "cooldown",
      event_type: parsed.event_type,
      cooldown_seconds: cooldownSeconds,
      previous_event_id: (recentEvent as any).id
    };
  }

  let snapshotId: string | null = null;
  if (parsed.snapshot_storage_path) {
    const { data: snapshot, error: snapshotError } = await supabase
      .from("camera_snapshots")
      .insert({
        garden_id: parsed.garden_id,
        camera_stream_id: parsed.camera_stream_id,
        storage_path: parsed.snapshot_storage_path,
        source: "ai_observer",
        metadata: parsed.metadata
      } as any)
      .select("*")
      .single();
    if (snapshotError) throw new Error(snapshotError.message);
    snapshotId = String(snapshot.id);
  }

  const { data: event, error } = await supabase
    .from("ai_events")
    .insert({
      garden_id: parsed.garden_id,
      camera_stream_id: parsed.camera_stream_id,
      event_type: parsed.event_type,
      event_key: `${parsed.event_type}:${parsed.camera_stream_id ?? parsed.garden_id}`,
      severity,
      confidence: parsed.confidence,
      snapshot_id: snapshotId,
      screenshot_url: parsed.snapshot_storage_path,
      metadata: { ...parsed.metadata, threshold, cooldown_seconds: cooldownSeconds, rule_id: rule?.id ?? null },
      notes: parsed.notes
    } as any)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return event;
}

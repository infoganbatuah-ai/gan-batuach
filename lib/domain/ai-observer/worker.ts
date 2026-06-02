import type { ObserverDetection } from "@/lib/domain/ai-observer/detection-engine";
import { createLocalDetector } from "@/lib/domain/ai-observer/local-detector";
import { evaluateObserverRule } from "@/lib/domain/ai-observer/rule-engine";

type SupabaseLike = any;

async function logJob(supabase: SupabaseLike, payload: Record<string, unknown>) {
  await supabase.from("observer_job_logs" as any).insert(payload as any);
}

async function getMockWorker(supabase: SupabaseLike) {
  const { data: worker } = await supabase.from("observer_workers" as any).select("*").eq("worker_type", "mock").limit(1).maybeSingle();
  if (worker) return worker;
  const { data, error } = await supabase
    .from("observer_workers" as any)
    .insert({ name: "Mock Observer Worker", worker_type: "mock", status: "idle", metadata: { phase: "2D", real_video_processing: false } })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function enqueueObserverJob(supabase: SupabaseLike, payload: { kindergarten_id?: string; camera_id?: string; rule_key?: string; priority?: number; metadata?: Record<string, unknown> }) {
  const worker = await getMockWorker(supabase);
  let camera: Record<string, any> | null = null;
  if (payload.camera_id) {
    const { data, error } = await supabase.from("camera_streams" as any).select("*").eq("id", payload.camera_id).maybeSingle();
    if (error) throw new Error(error.message);
    camera = data;
  } else {
    let query = supabase.from("camera_streams" as any).select("*").order("created_at", { ascending: false }).limit(1);
    if (payload.kindergarten_id) query = query.eq("garden_id", payload.kindergarten_id);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    camera = data;
  }

  if (!camera && !payload.kindergarten_id) throw new Error("לא נמצאה מצלמה להרצת mock observer.");
  const kindergartenId = payload.kindergarten_id ?? camera?.garden_id;
  if (!kindergartenId) throw new Error("לא נמצא גן להרצת mock observer.");

  const { data: zone } = camera?.id
    ? await supabase.from("camera_zones" as any).select("*").eq("camera_id", camera.id).eq("is_active", true).limit(1).maybeSingle()
    : { data: null };

  const { data: rule } = payload.rule_key
    ? await supabase.from("observer_rules" as any).select("*").eq("rule_key", payload.rule_key).eq("enabled", true).limit(1).maybeSingle()
    : await supabase.from("observer_rules" as any).select("*").eq("enabled", true).order("priority", { ascending: false }).limit(1).maybeSingle();

  const { data: job, error } = await supabase
    .from("observer_jobs" as any)
    .insert({
      worker_id: worker.id,
      kindergarten_id: kindergartenId,
      camera_id: camera?.id ?? null,
      zone_id: zone?.id ?? null,
      rule_id: rule?.id ?? null,
      job_type: "mock_detection",
      status: "queued",
      priority: payload.priority ?? Number(rule?.priority ?? 5),
      metadata: { ...(payload.metadata ?? {}), requested_rule_key: payload.rule_key ?? null, mock: true }
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logJob(supabase, { job_id: job.id, worker_id: worker.id, kindergarten_id: kindergartenId, camera_id: camera?.id ?? null, level: "info", message: "Mock observer job queued", metadata: { rule_key: payload.rule_key ?? rule?.rule_key ?? null } });
  return job;
}

export async function markJobFailed(supabase: SupabaseLike, job: Record<string, any>, failureReason: string) {
  const { data, error } = await supabase
    .from("observer_jobs" as any)
    .update({ status: "failed", failure_reason: failureReason, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "error", message: "Mock observer job failed", failure_reason: failureReason });
  return data;
}

export async function markJobCompleted(supabase: SupabaseLike, job: Record<string, any>, resultEventId?: string | null) {
  const { data, error } = await supabase
    .from("observer_jobs" as any)
    .update({ status: "completed", result_event_id: resultEventId ?? null, completed_at: new Date().toISOString(), last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "success", message: resultEventId ? "Mock observer event created" : "Mock observer job completed without event", metadata: { result_event_id: resultEventId ?? null } });
  return data;
}

export async function retryObserverJob(supabase: SupabaseLike, jobId: string) {
  const { data: job, error } = await supabase.from("observer_jobs" as any).select("*").eq("id", jobId).single();
  if (error || !job) throw new Error(error?.message ?? "Job not found");
  if (Number(job.retry_count ?? 0) >= Number(job.max_retries ?? 3)) throw new Error("ה-job הגיע למספר ניסיונות מרבי.");
  const { data, error: updateError } = await supabase
    .from("observer_jobs" as any)
    .update({ status: "retrying", retry_count: Number(job.retry_count ?? 0) + 1, failure_reason: null, scheduled_for: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);
  await logJob(supabase, { job_id: jobId, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "info", message: "Mock observer job retry requested" });
  return processObserverJobMock(supabase, data);
}

export async function processObserverJobMock(supabase: SupabaseLike, inputJob: Record<string, any>) {
  const { data: job, error: startError } = await supabase
    .from("observer_jobs" as any)
    .update({ status: "running", started_at: new Date().toISOString(), last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", inputJob.id)
    .select("*")
    .single();
  if (startError) throw new Error(startError.message);

  try {
    await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "info", message: "Local shadow sampler started", metadata: { real_video_processing: false, shadow_mode: true } });
    const [{ data: camera }, { data: zone }, { data: rules }, { data: routine }, { data: learningProfile }] = await Promise.all([
      job.camera_id ? supabase.from("camera_streams" as any).select("*").eq("id", job.camera_id).maybeSingle() : Promise.resolve({ data: null }),
      job.zone_id ? supabase.from("camera_zones" as any).select("*").eq("id", job.zone_id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("observer_rules" as any).select("*").or(`kindergarten_id.is.null,kindergarten_id.eq.${job.kindergarten_id}` as any).limit(200),
      supabase.from("kindergarten_routine_configs" as any).select("*").eq("kindergarten_id", job.kindergarten_id).maybeSingle(),
      supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", job.kindergarten_id).maybeSingle()
    ]);
    const detector = createLocalDetector();
    const localDetections = await detector.analyze({
      camera_id: job.camera_id,
      kindergarten_id: job.kindergarten_id,
      gateway_snapshot_url: null,
      frame_metadata: { synthetic: true, shadow_mode: true, frame_hash: job.metadata?.frame_hash ?? null },
      zone_id: job.zone_id,
      timestamp: new Date().toISOString(),
      previous_frame_hash: job.metadata?.previous_frame_hash ?? null,
      motion_score: typeof job.metadata?.motion_score === "number" ? job.metadata.motion_score : null,
      mock_scenario: job.metadata?.requested_rule_key
    }, { camera, zone, routine, learningProfile });
    const detections: ObserverDetection[] = localDetections.map((detection) => ({
      rule_key: ruleKeyForLocalDetection(detection.event_type),
      event_type: detection.event_type,
      confidence: detection.confidence_score,
      title: detection.title,
      description: detection.description,
      explanation: detection.recommended_action,
      metadata: { ...detection.metadata, recommended_action: detection.recommended_action, local_dedupe_key: detection.dedupe_key }
    }));
    await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "info", message: `Local shadow detector returned ${detections.length} detection(s)`, metadata: { provider: detector.provider, mode: detector.mode } });

    for (const detection of detections) {
      const selectedRule = rules?.find((rule: any) => rule.rule_key === detection.rule_key);
      const cooldownSince = new Date(Date.now() - Number(selectedRule?.cooldown_seconds ?? 300) * 1000).toISOString();
      const { data: recentEvent } = await supabase
        .from("ai_camera_events" as any)
        .select("id, created_at")
        .eq("kindergarten_id", job.kindergarten_id)
        .eq("event_type", detection.event_type)
        .gte("created_at", cooldownSince)
        .limit(1)
        .maybeSingle();
      const decision = evaluateObserverRule({ detection, rules: rules ?? [], kindergartenId: job.kindergarten_id, cameraId: job.camera_id, zoneId: job.zone_id, recentEvent });
      if (decision.status === "suppressed") {
        await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "warning", message: `Mock detection suppressed: ${decision.reason}`, metadata: decision });
        return markJobCompleted(supabase, job, null);
      }

      const { data: event, error: eventError } = await supabase
        .from("ai_camera_events" as any)
        .insert({
          kindergarten_id: job.kindergarten_id,
          camera_id: job.camera_id,
          event_type: detection.event_type,
          severity: decision.severity,
          title: detection.title,
          description: detection.description,
          confidence_score: detection.confidence,
          recommended_action: String(detection.metadata?.recommended_action ?? "בדיקה אנושית"),
          detected_entities: [],
          dedupe_key: String(detection.metadata?.local_dedupe_key ?? decision.dedupeKey),
          shadow_mode: true,
          requires_human_review: true,
          parent_visible: false,
          detector_provider: "local_mock",
          detector_mode: "local_shadow",
          metadata: { ...(detection.metadata ?? {}), observer_job_id: job.id, observer_rule_id: decision.rule.id, worker_mode: "local_shadow", shadow_mode: true, requires_human_review: true, parent_visible: false },
          is_demo: true
        })
        .select("*")
        .single();
      if (eventError) {
        if (eventError.message.includes("duplicate key")) {
          await logJob(supabase, { job_id: job.id, worker_id: job.worker_id, kindergarten_id: job.kindergarten_id, camera_id: job.camera_id, level: "warning", message: "Mock event suppressed by dedupe key", failure_reason: eventError.message });
          return markJobCompleted(supabase, job, null);
        }
        throw new Error(eventError.message);
      }

      if (decision.rule.id) await supabase.from("observer_rules" as any).update({ last_triggered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", decision.rule.id);
      if (["high", "urgent", "critical"].includes(decision.severity)) {
        await createObserverNotifications(supabase, event, detection.title, decision.severity);
      }
      return markJobCompleted(supabase, job, event.id);
    }
    return markJobCompleted(supabase, job, null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mock observer job failed";
    return markJobFailed(supabase, job, message);
  }
}

function ruleKeyForLocalDetection(eventType: string) {
  const map: Record<string, string> = {
    camera_offline: "camera_offline",
    camera_frozen_suspected: "camera_offline",
    motion_detected: "crowding_suspected",
    no_motion_too_long: "child_missing_from_area",
    person_detected: "person_in_restricted_area",
    multiple_persons_detected: "crowding_suspected",
    restricted_area_occupancy: "person_in_restricted_area",
    camera_obstruction_suspected: "camera_offline"
  };
  return map[eventType] ?? eventType;
}

async function createObserverNotifications(supabase: SupabaseLike, event: Record<string, any>, title: string, severity: string) {
  const { data: recipients } = await supabase
    .from("profiles" as any)
    .select("id, role, garden_id")
    .or(`role.eq.admin,garden_id.eq.${event.kindergarten_id}`);
  const rows = ((recipients ?? []) as any[])
    .filter((recipient) => recipient.role === "admin" || recipient.role === "manager" || recipient.role === "owner")
    .map((recipient) => ({
      garden_id: event.kindergarten_id,
      kindergarten_id: event.kindergarten_id,
      recipient_id: recipient.id,
      recipient_profile_id: recipient.id,
      recipient_role: recipient.role,
      title: "אירוע תצפיתן דורש review",
      body: title,
      message: title,
      entity_type: "ai_camera_event",
      entity_id: event.id,
      action_url: recipient.role === "admin" ? "/dashboard/admin/ai-events" : "/dashboard/garden/ai-events",
      metadata: { ai_camera_event_id: event.id, severity, mock: true, human_review_required: true }
    }));
  if (rows.length) await supabase.from("notifications" as any).insert(rows);
}

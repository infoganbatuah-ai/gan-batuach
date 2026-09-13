import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { JournalTracker, sampleAllCameras } from "./journal-tracker.mjs";
import { createDurableOfflineQueue } from "./durable-offline-queue.mjs";
import { createPreprocessingEngine } from "./preprocessing-policy.mjs";
import { createAdaptiveSamplingScheduler } from "./adaptive-sampling-scheduler.mjs";
import { createAiJob } from "./ai-job-contract.mjs";
import { createDurableAiJobQueue } from "./durable-ai-job-queue.mjs";
import { createPortableInferenceWorker } from "./portable-inference-worker.mjs";
import { createExecutionTarget, createHybridAiRouter } from "./ai-routing-policy.mjs";

// The lease is local evidence, not an accepted field in the cloud event schema.
export function eventForCloud(event, queuedAt = Date.now(), deliveredAt = Date.now()) {
  const cloudEvent = { ...event };
  delete cloudEvent.source_anchor;
  const delay = Math.max(0, deliveredAt - Date.parse(event.timestamp));
  cloudEvent.delivery = { mode: delay > 60_000 ? "BACKFILL_RESYNC" : "LIVE", queued_at: new Date(queuedAt).toISOString(), delivery_delay_ms: delay, schema_version: 1 };
  return cloudEvent;
}

export function journalCoverage(manifest, results, schedulerPlan = null) {
  const cameras=Array.isArray(manifest.cameras)?manifest.cameras:[];
  const enabled=manifest.monitoring_enabled===true?cameras.filter(camera=>camera.monitoring_enabled):[];
  const activeIds=new Set(enabled.map(camera=>camera.camera_id));
  const samples=new Set(results.filter(result=>activeIds.has(result.camera_id)&&result.status==="sampled").map(result=>result.camera_id));
  const attempted=new Set(results.filter(result=>activeIds.has(result.camera_id)).map(result=>result.camera_id));
  const requested = schedulerPlan ? new Set(schedulerPlan.decisions.filter(decision => decision.request_sample).map(decision => decision.camera_id)) : activeIds;
  const requestedSamples = new Set([...samples].filter(id => requested.has(id)));
  const unavailable = Math.max(0, requested.size - requestedSamples.size);
  const status=manifest.monitoring_enabled!==true?"paused":!enabled.length?"awaiting_sources":unavailable===0?"running":"degraded";
  return {status,configured:cameras.length,enabled:enabled.length,attempted:attempted.size,sampled:samples.size,
    ...(schedulerPlan ? { scheduled:requested.size,deferred:Math.max(0,enabled.length-requested.size) } : {}), unavailable};
}

// Upstream validation details may include request-specific data. Retain only a
// small, non-sensitive category so an authenticated outbox retry can diagnose
// a contract mismatch without persisting an upstream response body.
export function safeEventValidationCategory(value) {
  const fieldErrors = value?.details?.fieldErrors;
  if (!fieldErrors || typeof fieldErrors !== "object" || Array.isArray(fieldErrors)) return "validation_shape";
    const allowed = new Set(["event_id", "camera_source_id", "stream_id", "event_type", "severity", "confidence", "timestamp", "track_id", "evidence_kind", "model_provenance", "verification_evidence", "media_failure_reason"]);
  const field = Object.keys(fieldErrors).find((name) => allowed.has(name));
  return field ? `validation_${field}` : "validation_shape";
}

export function startJournalLoop({ gatewayUrl, gatewaySecret, databasePath, observerSiteId = "local-fixture-site", deviceId = "local-fixture-device", tenantId = observerSiteId, report = () => {}, pollIntervalMs = 1_000, manifestRefreshIntervalMs = 10_000, personConfirmations = 3, cameraFilter = null, spatialTrace = false, resourcePressure = () => "NORMAL" }) {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS camera_health(camera_id TEXT PRIMARY KEY, misses INTEGER NOT NULL DEFAULT 0, offline INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)");
  const queue = createDurableOfflineQueue({ databasePath, encryptionKey: gatewaySecret, tenantId, siteId: observerSiteId, deviceId,
    policy: { maxRecords: 10_000, maxBytes: 512 * 1024 * 1024, batchSize: 2, retryBaseMs: 5_000, retryMaxMs: 300_000 } });
  // One-way, idempotent conversion of the pre-PUSH 21 plaintext event table.
  // A row is removed only after its encrypted stable-ID copy is durable.
  if (db.prepare("SELECT 1 present FROM sqlite_master WHERE type='table' AND name='outbox'").get()) {
    for (const row of db.prepare("SELECT id,payload,created_at FROM outbox ORDER BY created_at LIMIT 10000").all()) {
      try {
        const event = JSON.parse(String(row.payload));
        queue.enqueue({ id: String(row.id), kind: "EVENT", orderingKey: `${observerSiteId}:${event.camera_source_id || "unknown"}:${event.track_id || event.stream_id || row.id}`,
          sourceId: event.camera_source_id || null, observedAt: event.timestamp || new Date(Number(row.created_at)).toISOString(), priority: 50, payload: event });
        db.prepare("DELETE FROM outbox WHERE id=?").run(row.id);
      } catch { /* Leave an invalid legacy row untouched for explicit operator review. */ }
    }
  }
  const spatialTraceEntries = [];
  const tracker = new JournalTracker({ personConfirmations, trace: spatialTrace ? entry => {
    spatialTraceEntries.push(entry);
    if (spatialTraceEntries.length > 240) spatialTraceEntries.splice(0, spatialTraceEntries.length - 240);
  } : null });
  const preprocessing = createPreprocessingEngine();
  const scheduler = createAdaptiveSamplingScheduler();
  // The AI queue is intentionally separate from PUSH 21's cloud-delivery
  // outbox. It persists internal inference work; it never stores Product Events.
  const localWorkerCapability = Symbol("journal-local-inference-worker");
  const aiQueue = createDurableAiJobQueue({ databasePath, policy: { maxJobs: 20_000, leaseMs: 90_000 },
    workerAuthorizer: worker => worker.identity?.local_capability === localWorkerCapability });
  const aiRouter = createHybridAiRouter();
  const localTargetId = `${deviceId}:edge-local`;
  const health = new Map(db.prepare("SELECT camera_id,misses,offline FROM camera_health").all()
    .map(row => [String(row.camera_id), { misses:Number(row.misses)||0, offline:Number(row.offline)===1 }]));
  let stopped = false;
  let timer;
  let cyclePromise;
  const deliveries = new Map();
  const deliveryCameras = new Set();
  let deliveryManifest;
  let deliveryManifestAt = 0;
  const mediaFailures = new Map();
  const deliveryFailuresByReason = new Map();
  const knownMediaReasons = new Set(["source_anchor_required", "source_anchor_mismatch", "source_anchor_expired", "source_generation_changed",
    "monitoring_not_authorized", "recording_not_authorized", "prebuffer_missing", "postbuffer_gap", "timeline_discontinuous",
    "source_window_unavailable", "media_size_not_allowed", "complete_segment_window_too_large", "capture_failed"]);
  const failedCapture = reason => ({ ok: false, reason: knownMediaReasons.has(reason) || /^event_media_(?:http_(?:400|401|403|409|413|422|429|500|502|503|504)|response_(?:suppressed|pending|unexpected)|failure_(?:validation_failed|EVIDENCE_(?:UPLOAD_IDEMPOTENCY_WRITE_FAILED|STORAGE_UPLOAD_FAILED|METADATA_WRITE_FAILED|PERSISTENCE_UNEXPECTED)|EVENT_(?:MEDIA_LINK_FAILED|READ_FAILED|SCOPE_UNAVAILABLE)|unsafe_event_summary))$/.test(reason) ? reason : "capture_failed" });
  // Delivery failures are operationally actionable, but raw upstream errors may
  // contain headers, URLs, or provider diagnostics. Persist only bounded
  // categories already emitted by this module.
  const deliveryFailureReason = error => {
    const reason = String(error?.message || "");
    return /^(?:journal_http_[0-9]{3}(?:_validation_(?:shape|event_id|camera_source_id|stream_id|event_type|severity|confidence|timestamp|track_id|evidence_kind|model_provenance|media_failure_reason))?|event_capture_unavailable|event_media_upload_failed|media_status_not_acknowledged|notification_retry_pending|event_not_acknowledged)$/.test(reason)
      ? reason
      : "delivery_unclassified";
  };
  const request = async (path, body, options = {}) => {
    const requestTimeout = options.timeoutMs ?? (path.includes("/detections") ? 60_000 : 30_000);
    const res = await fetch(gatewayUrl + path, {method: body === undefined ? "GET" : "POST", headers:{"x-video-gateway-secret":gatewaySecret,"content-type":"application/json"}, body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(requestTimeout)});
    const value = await res.json().catch(()=>({}));
    if (!res.ok) {
      const category = path === "/cloud/events" && res.status === 422
        ? safeEventValidationCategory(value)
        : null;
      throw new Error(category ? `journal_http_${res.status}_${category}` : `journal_http_${res.status}`);
    }
    return value.data ?? value;
  };
  const inferenceWorker = createPortableInferenceWorker({
    workerId: localTargetId, environment: "EDGE_LOCAL", capabilities: ["OBJECT_DETECTION"],
    identity: { authenticated: true, revoked: false, device_id: deviceId, tenant_ids: [tenantId], site_ids: [observerSiteId], local_capability: localWorkerCapability },
    infer: async job => {
      if (job.input_ref.kind !== "GATEWAY_SOURCE_SAMPLE" || !job.input_ref.reference.startsWith("stream:")) {
        const error = new Error("input_reference_unsupported"); error.retryable = false; error.category = "INPUT_REFERENCE_UNSUPPORTED"; throw error;
      }
      const streamId = job.input_ref.reference.slice("stream:".length);
      const data = await request(`/camera/${encodeURIComponent(streamId)}/detections`);
      if (!data.local_processing || data.insight?.object_detection?.status !== "sampled") {
        const error = new Error("detector_unavailable"); error.retryable = true; error.category = "DETECTOR_UNAVAILABLE"; throw error;
      }
      return { detections: data.insight.object_detection.detections, source_anchor: data.insight.source_anchor ?? null, observation_timestamp: data.insight.sampled_at,
        model_provenance: data.insight.object_detection.model_provenance ?? null };
    }
  });
  const localTarget = () => createExecutionTarget({ target_id: localTargetId, target_class: "EDGE_LOCAL", environment: "EDGE_LOCAL",
    supported_capabilities: ["OBJECT_DETECTION"], supported_model_classes: ["GENERAL_OBJECT_DETECTION"], supported_input_kinds: ["GATEWAY_SOURCE_SAMPLE"],
    health: "HEALTHY", available: true, capacity: { max_concurrency: 1, in_flight: inferenceWorker.snapshot().busy ? 1 : 0, queue_depth: aiQueue.snapshot().queue_depth },
    tenant_eligibility: { mode: "ALLOWLIST", tenant_ids: [tenantId] }, privacy_eligibility: ["EDGE_ONLY", "LOCAL_ALLOWED", "CLOUD_ALLOWED"],
    input_access: { locality: ["MANAGED_COMPONENT_ONLY"], source_ids: ["*"] }, latency: { expected_ms: inferenceWorker.snapshot().average_inference_ms ?? 1_000, sample_count: inferenceWorker.snapshot().processed },
    cost_hook: { measured: false, compute_class: "LOCAL_CPU", bandwidth_class: "NONE" } });
  async function executeAiJob(job) {
    // Drain bounded ready work so a recovered job is not starved by the newest
    // camera sample. Normal operation completes in one iteration.
    for (let attempt = 0; attempt < 32; attempt += 1) {
      const ready = aiQueue.result(job.job_id);
      if (ready) return aiQueue.result(job.job_id, { consume: true });
      const processed = await aiRouter.execute({ job, queue: aiQueue, targets: [localTarget()], workers: new Map([[localTargetId, inferenceWorker]]) });
      if (processed.status === "NO_ELIGIBLE_TARGET") throw new Error("no_eligible_ai_target");
      if (processed.status === "IDLE") break;
    }
    return aiQueue.result(job.job_id, { consume: true });
  }
  async function releaseUnusedEvidence(streamId, leaseId) {
    if (!leaseId) return;
    // Cleanup is bounded; the RAM TTL remains the fallback if transport fails.
    await fetch(gatewayUrl + `/camera/${encodeURIComponent(streamId)}/event-evidence/release`, {
      method:"POST", headers:{"x-video-gateway-secret":gatewaySecret,"content-type":"application/json"},
      body:JSON.stringify({lease_id:leaseId}), signal:AbortSignal.timeout(1000)
    }).catch(()=>{});
  }
  async function finishEvent(rowId, event) {
    queue.acknowledge(rowId);
    await releaseUnusedEvidence(event.stream_id, event.source_anchor?.lease_id);
  }
  async function uploadMediaWork(work) {
    const form = new FormData();
    form.set("metadata", JSON.stringify(work.metadata));
    form.set("clip", new Blob([Buffer.from(work.clip_base64, "base64")], { type: "video/mp4" }), "clip.mp4");
    form.set("thumbnail", new Blob([Buffer.from(work.thumbnail_base64, "base64")], { type: "image/jpeg" }), "thumbnail.jpg");
    const uploaded = await fetch(gatewayUrl + "/cloud/event-media", { method:"POST", headers:{"x-video-gateway-secret":gatewaySecret}, body:form, signal:AbortSignal.timeout(30_000) });
    const result = await uploaded.json().catch(()=>({}));
    if (!uploaded.ok) {
      const code = typeof result?.details?.code === "string" ? result.details.code : "";
      return failedCapture(code ? `event_media_failure_${code}` : `event_media_http_${uploaded.status}`);
    }
    const status = typeof result?.data?.status === "string" ? result.data.status : typeof result?.status === "string" ? result.status : "unexpected";
    return status === "stored" ? { ok:true } : failedCapture(`event_media_response_${["suppressed", "pending"].includes(status) ? status : "unexpected"}`);
  }
  async function capture(event, saved, manifest) {
    if (!event.source_anchor?.lease_id) return failedCapture("source_anchor_required");
    if (event.source_anchor.observer_site_id !== manifest.observer_site_id || event.source_anchor.gateway_id !== manifest.gateway_id
      || event.source_anchor.camera_source_id !== event.camera_source_id || event.source_anchor.stream_id !== event.stream_id) return failedCapture("source_anchor_mismatch");
    if (!saved.recording_grant) return failedCapture("recording_not_authorized");
    const media = await request(`/camera/${encodeURIComponent(event.stream_id)}/event-media`, {
      source_anchor:event.source_anchor, recording_grant:saved.recording_grant, recording_required:true, window_seconds_before:3,window_seconds_after:5 });
    if (media.status !== "available") {
      if (media.retryable === false || media.status === "not_required") return failedCapture(media.reason);
      throw new Error("event_capture_unavailable");
    }
    const evidence = media.source_evidence;
    if (!media.clip?.base64 || !media.thumbnail?.base64 || evidence?.whole_segments_preserved !== true
      || ["observer_site_id","gateway_id","camera_source_id","stream_id","source_generation","sequence","discontinuity","offset_seconds","segment_sha256","observed_at"].some(k=>evidence.anchor?.[k]!==event.source_anchor[k])
      || !Number.isFinite(evidence.actual_duration_seconds) || evidence.actual_duration_seconds <= 0 || evidence.actual_duration_seconds > 30
      || !Number.isFinite(evidence.event_offset_seconds) || evidence.event_offset_seconds < 3
      || !Number.isFinite(evidence.actual_after_seconds) || evidence.actual_after_seconds < 5
      || Math.abs(evidence.event_offset_seconds+evidence.actual_after_seconds-evidence.actual_duration_seconds)>0.001
      || media.captured_at !== event.timestamp) return failedCapture("source_anchor_mismatch");
    const safeEvidence = {
      anchor: Object.fromEntries(["observer_site_id","gateway_id","camera_source_id","stream_id","source_generation","sequence","discontinuity","offset_seconds","segment_sha256","observed_at","offset_basis","source_capture_utc_known"].map(k=>[k,evidence.anchor[k]])),
      whole_segments_preserved:true, actual_duration_seconds:evidence.actual_duration_seconds,
      event_offset_seconds:evidence.event_offset_seconds, actual_after_seconds:evidence.actual_after_seconds,
      timestamp_basis:"local_source_observed_at_not_capture_utc"
    };
    const work = { metadata: {
      gateway_id:manifest.gateway_id, observer_site_id:manifest.observer_site_id, event_id:saved.media_event_id,
      camera_source_id:event.camera_source_id, stream_id:event.stream_id, event_type:event.event_type,
      // Cloud media validation must receive the same typed evidence that
      // qualified the persisted Event. In particular, a critical directional
      // crossing is not interchangeable with a passive person observation.
      evidence_kind:event.evidence_kind,
      severity:{INFO:"info",WARNING:"medium",CRITICAL:"critical"}[event.severity],confidence:event.confidence,
      captured_at:media.captured_at,duration_seconds:media.duration_seconds,
      window_seconds_before:media.window_seconds_before,window_seconds_after:media.window_seconds_after,
      local_capture:true,read_only:true,controls_supported:false,no_dvr_credentials_returned:true,no_rtsp_returned:true,
      metadata:{track_id:event.track_id,recording_required:true,source_evidence:safeEvidence,event_timestamp:event.timestamp,
        generated_at:Number.isFinite(Date.parse(media.generated_at)) ? media.generated_at : undefined}
    }, clip_base64:media.clip.base64, thumbnail_base64:media.thumbnail.base64 };
    try {
      const result = await uploadMediaWork(work);
      return result.ok ? result : { ...result, mediaWork: work };
    } catch { return { ...failedCapture("event_media_upload_failed"), mediaWork: work }; }
  }
  async function deliver(row) {
        try {
          if (row.kind === "EVIDENCE_MEDIA") {
            const uploaded = await uploadMediaWork(row.payload);
            if (!uploaded.ok) throw new Error("event_media_upload_failed");
            queue.acknowledge(row.id);
            return;
          }
          const event = row.payload;
          const cloudEvent = eventForCloud(event, Number(row.queued_at));
          const manifest = deliveryManifest;
          const active = manifest?.monitoring_enabled && manifest.cameras?.some(camera => camera.camera_id === event.camera_source_id && camera.monitoring_enabled);
          // Consent is checked again server-side, including during a concurrent manifest refresh.
          if (!active) { queue.discard(row.id, "monitoring_policy_revoked"); await releaseUnusedEvidence(event.stream_id, event.source_anchor?.lease_id); return; }
          const saved = await request("/cloud/events", cloudEvent);
          if (saved.status === "stored" && saved.recording_required && !["available", "missing"].includes(saved.media_status)) {
            if (Date.now() - Date.parse(event.timestamp) > 60_000 || Number(row.attempts) >= 5) {
              const missing = await request("/cloud/events", { ...cloudEvent, media_failure_reason: "capture_window_elapsed" });
              if (missing.status !== "stored" || missing.media_status !== "missing") throw new Error("media_status_not_acknowledged");
            } else {
              const captured = await capture(event, saved, manifest);
              if (!captured.ok) {
                mediaFailures.set(captured.reason, (mediaFailures.get(captured.reason) ?? 0) + 1);
                if (captured.mediaWork) {
                  queue.enqueue({ id:`${event.event_id}:media`, kind:"EVIDENCE_MEDIA", orderingKey:`${observerSiteId}:${event.camera_source_id}:media:${event.event_id}`,
                    sourceId:event.camera_source_id, observedAt:event.timestamp, priority:95, payload:captured.mediaWork });
                } else {
                // The deployed cloud schema has only this coarse enum; retain
                // the precise bounded reason in local status, not an invalid field.
                const missing = await request("/cloud/events", { ...cloudEvent, media_failure_reason: "capture_failed" });
                if (missing.status !== "stored" || missing.media_status !== "missing") throw new Error("media_status_not_acknowledged");
                }
              }
            }
          }
          if (saved.notifications_pending) throw new Error("notification_retry_pending");
          if (saved.status === "stored" || saved.status === "suppressed") await finishEvent(row.id, event);
          else throw new Error("event_not_acknowledged");
        } catch (error) {
          const reason = deliveryFailureReason(error);
          deliveryFailuresByReason.set(reason, (deliveryFailuresByReason.get(reason) ?? 0) + 1);
          queue.fail(row.id, reason);
        }
  }
  function kickDelivery() {
    if (stopped || !deliveryManifest || Date.now() - deliveryManifestAt >= 30_000 || deliveries.size >= 2) return;
    while (deliveries.size < 2) {
      const row = queue.ready().find(candidate => !deliveryCameras.has(candidate.payload.camera_source_id));
      if (!row) break;
      queue.begin(row.id);
      const cameraId = row.payload.camera_source_id ?? "";
      deliveryCameras.add(cameraId);
      const job = deliver(row).finally(() => { deliveries.delete(row.id); deliveryCameras.delete(cameraId); if (!stopped) kickDelivery(); });
      deliveries.set(row.id, job);
      // Storage failures must not cause unhandled promise rejections.
      job.catch(() => {});
    }
  }
  async function cycle() {
    try {
      // Refresh consent, source list and rules at a bounded cadence, but never let a
      // slow cloud refresh block local real-camera sampling. Once a manifest
      // has been accepted, keep using that last-known-good contract while the
      // bounded refresh retries in the background on later cycles.
      if (!deliveryManifest || Date.now() - deliveryManifestAt >= Math.min(Math.max(manifestRefreshIntervalMs, pollIntervalMs), 20_000)) {
        try {
          const manifest = await request("/cloud/event-manifest", undefined, { timeoutMs: 2_500 });
          deliveryManifest = manifest;
          deliveryManifestAt = Date.now();
        } catch (error) {
          if (!deliveryManifest) throw error;
        }
      }
      const manifest = deliveryManifest;
      kickDelivery();
      const cameras = Array.isArray(manifest.cameras) && manifest.monitoring_enabled ? manifest.cameras : [];
      // An explicitly selected, one-camera evidence test gives a slow edge
      // model enough temporal coverage for a real crossing. It is opt-in,
      // does not alter event rules or confirmations, and is reported as a
      // limited diagnostic scope rather than normal all-camera coverage.
      const eligibleCameras = typeof cameraFilter === "string" && cameraFilter
        ? cameras.filter((camera) => camera.camera_id === cameraFilter)
        : cameras;
      const adaptiveEnabled = manifest.sampling?.contract === "observer-adaptive-sampling-v1";
      const schedulerPlan = adaptiveEnabled ? scheduler.plan(eligibleCameras.map((camera) => ({
        ...camera, site_id: observerSiteId,
        active_watch_rule: camera.sampling?.active_watch_rule === true || camera.preprocessing?.active_watch_rule === true,
        critical_policy: camera.sampling?.critical_policy === true || camera.preprocessing?.critical_policy === true,
        active_incident: camera.sampling?.active_incident === true,
        active_track: (tracker.cameras.get(camera.camera_id)?.tracks ?? []).some((track) => Date.now() - Number(track.at) < 10_000),
        recovering: camera.sampling?.recovering === true,
        learning_under_covered: false,
        health: { summary: camera.status, frame_fresh: camera.sampling?.frame_fresh ?? null }
      })), { budget: Number(manifest.sampling?.cycle_budget ?? eligibleCameras.length), resourcePressure: resourcePressure() }) : null;
      const decisionByCamera = new Map((schedulerPlan?.decisions ?? []).map((decision) => [decision.camera_id, decision]));
      // Manifests predating PUSH 30 retain the fixed path. New manifests use
      // the one canonical scheduler, with an explicit diagnostic camera filter
      // still allowed for bounded evidence tests.
      const sampledCameras = adaptiveEnabled
        ? eligibleCameras.filter((camera) => decisionByCamera.get(camera.camera_id)?.request_sample)
        : eligibleCameras;
      const active = new Set(cameras.filter(c=>c.monitoring_enabled).map(c=>c.camera_id));
      for (const id of tracker.cameras.keys()) if (!active.has(id)) tracker.forget(id);
      const results = await sampleAllCameras(sampledCameras, async camera => {
        if (["offline", "failed", "error"].includes(camera.status)) throw new Error("camera_offline");
        if (camera.object_analysis_enabled === false) throw new Error("analysis_policy_not_verified");
        // Running an object model is pointless when this camera has no enabled
        // visual event rule (for example parking without a verified crossing line).
        // Keep its health result visible instead of implying analysis coverage.
        if (Array.isArray(camera.supported_event_types) && !camera.supported_event_types.some(type=>["person_detected","person_entered","person_exited","vehicle_entered","vehicle_exited","person_near_pool_off_hours","unauthorized_night_motion"].includes(type))) {
          throw new Error(camera.zone_type==="PARKING"?"crossing_line_not_configured":"no_supported_visual_event_rule");
        }
        const policy = camera.preprocessing?.policy ?? "ALWAYS_ANALYZE";
        let activity = null;
        if (policy !== "ALWAYS_ANALYZE") {
          try { activity = await request(`/camera/${encodeURIComponent(camera.stream_id)}/activity`); }
          catch { /* Missing/malformed cheap metadata fails safely into periodic/full analysis below. */ }
        }
        const decision = preprocessing.evaluate({
          camera: { camera_id: camera.camera_id, site_id: manifest.observer_site_id, vendor: camera.preprocessing?.vendor,
            channel_assignment: camera.channel_assignment, physical_camera_attached: camera.physical_camera_attached },
          policy,
          active_watch_rule: camera.preprocessing?.active_watch_rule === true,
          critical_policy: camera.preprocessing?.critical_policy === true,
          health: { source: camera.status, frame_fresh: activity ? true : null },
          metadata_available: policy === "ALWAYS_ANALYZE" || Boolean(activity),
          motion_score: activity?.insight?.motion_score,
          observed_at: activity?.insight?.sampled_at,
          motion_threshold: camera.preprocessing?.motion_threshold,
          coalesce_window_ms: camera.preprocessing?.coalesce_window_ms,
          max_quiet_interval_ms: camera.preprocessing?.max_quiet_interval_ms
        });
        scheduler.recordActivity(camera.camera_id, activity?.insight?.motion_score, camera.preprocessing?.motion_threshold);
        if (!decision.request_ai) return { sampled_at: activity?.insight?.sampled_at ?? new Date().toISOString(),
          object_detection: { status: "preprocessing_suppressed", detections: [], model_provenance: null }, preprocessing: decision };
        const samplingDecision = decisionByCamera.get(camera.camera_id);
        const observedAt = activity?.insight?.sampled_at ?? new Date().toISOString();
        const enqueued = aiQueue.enqueue(createAiJob({ tenant_id: tenantId, site_id: observerSiteId, source_id: camera.camera_id,
          observation_timestamp: observedAt, candidate: samplingDecision?.candidate ?? null, priority: samplingDecision?.priority ?? "NORMAL",
          purpose: samplingDecision?.purpose ?? "REALTIME_DETECTION", requested_capability: "OBJECT_DETECTION", model_class: "GENERAL_OBJECT_DETECTION",
          input_ref: { kind: "GATEWAY_SOURCE_SAMPLE", reference: `stream:${camera.stream_id}`, locality: "MANAGED_COMPONENT_ONLY" },
          expires_at: new Date(Date.now() + 60_000).toISOString(), retry_policy: { max_attempts: 3, base_backoff_ms: 500 },
          privacy_constraints: { raw_media_telemetry: false, tenant_scoped_input: true, retention: "EPHEMERAL_SOURCE_REFERENCE" },
          scheduler_reason: samplingDecision?.reason ?? decision.reason ?? "FIXED_COMPATIBILITY",
          scheduler_version: samplingDecision?.contract ?? "legacy-fixed-sampling", ordering_key: `${observerSiteId}:${camera.camera_id}` }));
        const result = await executeAiJob(enqueued.job);
        if (!result) throw new Error("detector_queued_or_unavailable");
        return { sampled_at: result.observation_timestamp, source_anchor: result.source_anchor,
          object_detection: { status: "sampled", detections: result.detections, model_provenance: { model: result.model, expected_sha256: result.model_version, runtime: result.runtime, worker_id: result.worker_id, worker_environment: result.worker_environment } }, preprocessing: decision,
          ai_job: { job_id: result.job_id, queue_wait_ms: result.queue_wait_ms, inference_ms: result.inference_ms } };
      }, async (camera, insight) => {
        try { const events = tracker.observe(camera, insight.object_detection.detections, insight.sampled_at, insight.source_anchor ?? null, insight.object_detection.model_provenance ?? null);
        preprocessing.recordCanonicalEvents(events.length);
        for (const event of events) {
          queue.enqueue({ id: event.event_id, kind: "EVENT", orderingKey: `${observerSiteId}:${camera.camera_id}:${event.track_id || event.stream_id}`,
            sourceId: camera.camera_id, observedAt: event.timestamp, priority: event.severity === "CRITICAL" ? 100 : event.severity === "WARNING" ? 75 : 50, payload: event });
          // Do not wait for a slow/disconnected camera before delivering this event.
          kickDelivery();
        } } finally { await releaseUnusedEvidence(camera.stream_id, insight.source_anchor?.lease_id); }
      // The local object model owns one warm inference session. Serial camera
      // sampling prevents parallel callers from exhausting its queue and
      // killing a healthy worker on an artificial timeout.
      }, 1);
      for (const result of results) {
        const camera = cameras.find(c => c.camera_id === result.camera_id);
        const previous = health.get(result.camera_id) ?? { misses:0, offline:false };
        // Model unavailability is not a camera outage. Only report confirmed stream outages.
        if (result.status === "sampled" || result.reason === "camera_offline") {
          previous.misses = result.status === "sampled" ? 0 : previous.misses+1;
          const offline = previous.misses >= 3;
          if (offline !== previous.offline) {
            const id=randomUUID();
            const event={event_id:id,camera_source_id:camera.camera_id,stream_id:camera.stream_id,event_type:offline?"camera_offline":"camera_reconnected",severity:offline?"WARNING":"INFO",confidence:1,timestamp:new Date().toISOString(),evidence_kind:"stream_health"};
            queue.enqueue({ id, kind: "OPERATIONAL_STATE", orderingKey: `${observerSiteId}:${camera.camera_id}:health`, sourceId: camera.camera_id,
              observedAt: event.timestamp, priority: offline ? 80 : 60, payload: event });
            previous.offline=offline;
          }
          health.set(result.camera_id,previous);
          db.prepare("INSERT INTO camera_health(camera_id,misses,offline,updated_at) VALUES(?,?,?,?) ON CONFLICT(camera_id) DO UPDATE SET misses=excluded.misses,offline=excluded.offline,updated_at=excluded.updated_at")
            .run(result.camera_id, previous.misses, previous.offline ? 1 : 0, Date.now());
        }
      }
      // Keep sampling/consent refresh independent of a slow cloud response or
      // clip upload. Each row stays single-flight; shutdown drains both slots.
      kickDelivery();
      const queueStatus = queue.snapshot();
      const deliveryFailures = queueStatus.retry_count;
      const pending = queueStatus.queue_depth;
      const coverage=journalCoverage(manifest,results,schedulerPlan);
      report({ status: deliveryFailures ? "delivery_retrying" : coverage.status, checked_at: new Date().toISOString(), coverage, cameras: results,
        ...(typeof cameraFilter === "string" && cameraFilter ? { evidence_test_camera_filter: cameraFilter, coverage_scope: "single_camera_diagnostic" } : {}),
        ...(spatialTrace ? { spatial_trace_scope:"diagnostic_metadata_only", spatial_trace:[...spatialTraceEntries] } : {}),
        delivery_in_progress:pending>0 && deliveries.size>0, delivery_failures:deliveryFailures, delivery_failures_by_reason:Object.fromEntries(deliveryFailuresByReason), media_failures_by_reason:Object.fromEntries(mediaFailures), pending,
        preprocessing: preprocessing.snapshot(),
        adaptive_sampling: schedulerPlan ? { ...scheduler.snapshot(), current: schedulerPlan } : { contract: "legacy-fixed-sampling", enabled: false },
        ai_queue: aiQueue.snapshot(),
        ai_worker: inferenceWorker.snapshot(),
        ai_routing: aiRouter.snapshot(),
        offline_buffer: queueStatus, local_monitoring_operational: true, cloud_sync_state: queueStatus.state });
    } catch (error) { deliveryManifest = null; report({status:"unavailable", reason: error.message, checked_at:new Date().toISOString()}); }
    if (!stopped) timer = setTimeout(run, pollIntervalMs);
  }
  function run() { cyclePromise = cycle(); }
  run();
  return async () => { stopped = true; clearTimeout(timer); await cyclePromise; await Promise.allSettled([...deliveries.values()]); aiQueue.close(); queue.close(); db.close(); };
}

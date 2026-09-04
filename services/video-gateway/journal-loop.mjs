import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { JournalTracker, sampleAllCameras } from "./journal-tracker.mjs";

// The lease is local evidence, not an accepted field in the cloud event schema.
export function eventForCloud(event) {
  const { source_anchor, ...cloudEvent } = event;
  return cloudEvent;
}

export function journalCoverage(manifest, results) {
  const cameras=Array.isArray(manifest.cameras)?manifest.cameras:[];
  const enabled=manifest.monitoring_enabled===true?cameras.filter(camera=>camera.monitoring_enabled):[];
  const activeIds=new Set(enabled.map(camera=>camera.camera_id));
  const samples=new Set(results.filter(result=>activeIds.has(result.camera_id)&&result.status==="sampled").map(result=>result.camera_id));
  const attempted=new Set(results.filter(result=>activeIds.has(result.camera_id)).map(result=>result.camera_id));
  const status=manifest.monitoring_enabled!==true?"paused":!enabled.length?"awaiting_sources":samples.size===enabled.length?"running":"degraded";
  return {status,configured:cameras.length,enabled:enabled.length,attempted:attempted.size,sampled:samples.size,unavailable:enabled.length-samples.size};
}

export function startJournalLoop({ gatewayUrl, gatewaySecret, databasePath, report = () => {}, pollIntervalMs = 1_000 }) {
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS camera_health(camera_id TEXT PRIMARY KEY, misses INTEGER NOT NULL DEFAULT 0, offline INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)");
  const tracker = new JournalTracker();
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
  const knownMediaReasons = new Set(["source_anchor_required", "source_anchor_mismatch", "source_anchor_expired", "source_generation_changed",
    "monitoring_not_authorized", "recording_not_authorized", "prebuffer_missing", "postbuffer_gap", "timeline_discontinuous",
    "source_window_unavailable", "media_size_not_allowed", "complete_segment_window_too_large", "capture_failed"]);
  const failedCapture = reason => ({ ok: false, reason: knownMediaReasons.has(reason) ? reason : "capture_failed" });
  const request = async (path, body) => {
    const requestTimeout = path.includes("/detections") ? 60_000 : 30_000;
    const res = await fetch(gatewayUrl + path, {method: body === undefined ? "GET" : "POST", headers:{"x-video-gateway-secret":gatewaySecret,"content-type":"application/json"}, body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(requestTimeout)});
    const value = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(`journal_http_${res.status}`);
    return value.data ?? value;
  };
  async function releaseUnusedEvidence(streamId, leaseId) {
    if (!leaseId || db.prepare("SELECT 1 FROM outbox WHERE json_extract(payload,'$.source_anchor.lease_id')=? LIMIT 1").get(leaseId)) return;
    // Cleanup is bounded; the RAM TTL remains the fallback if transport fails.
    await fetch(gatewayUrl + `/camera/${encodeURIComponent(streamId)}/event-evidence/release`, {
      method:"POST", headers:{"x-video-gateway-secret":gatewaySecret,"content-type":"application/json"},
      body:JSON.stringify({lease_id:leaseId}), signal:AbortSignal.timeout(1000)
    }).catch(()=>{});
  }
  async function finishEvent(rowId, event) {
    db.prepare("DELETE FROM outbox WHERE id=?").run(rowId);
    await releaseUnusedEvidence(event.stream_id, event.source_anchor?.lease_id);
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
    const form = new FormData();
    form.set("metadata", JSON.stringify({
      gateway_id:manifest.gateway_id, observer_site_id:manifest.observer_site_id, event_id:saved.media_event_id,
      camera_source_id:event.camera_source_id, stream_id:event.stream_id, event_type:event.event_type,
      severity:{INFO:"info",WARNING:"medium",CRITICAL:"critical"}[event.severity],confidence:event.confidence,
      captured_at:media.captured_at,duration_seconds:media.duration_seconds,
      window_seconds_before:media.window_seconds_before,window_seconds_after:media.window_seconds_after,
      local_capture:true,read_only:true,controls_supported:false,no_dvr_credentials_returned:true,no_rtsp_returned:true,
      metadata:{track_id:event.track_id,recording_required:true,source_evidence:safeEvidence,event_timestamp:event.timestamp,
        generated_at:Number.isFinite(Date.parse(media.generated_at)) ? media.generated_at : undefined}
    }));
    form.set("clip",new Blob([Buffer.from(media.clip.base64,"base64")],{type:"video/mp4"}),"clip.mp4");
    form.set("thumbnail",new Blob([Buffer.from(media.thumbnail.base64,"base64")],{type:"image/jpeg"}),"thumbnail.jpg");
    const uploaded = await fetch(gatewayUrl+"/cloud/event-media",{method:"POST",headers:{"x-video-gateway-secret":gatewaySecret},body:form,signal:AbortSignal.timeout(30_000)});
    const result = await uploaded.json().catch(()=>({}));
    if (!uploaded.ok || result.data?.status !== "stored") throw new Error("event_media_upload_failed");
    return { ok: true };
  }
  async function deliver(row) {
        try {
          const event = JSON.parse(row.payload);
          const cloudEvent = eventForCloud(event);
          const manifest = deliveryManifest;
          const active = manifest?.monitoring_enabled && manifest.cameras?.some(camera => camera.camera_id === event.camera_source_id && camera.monitoring_enabled);
          // Consent is checked again server-side, including during a concurrent manifest refresh.
          if (!active) { await finishEvent(row.id, event); return; }
          const saved = await request("/cloud/events", cloudEvent);
          if (saved.status === "stored" && saved.recording_required && !["available", "missing"].includes(saved.media_status)) {
            if (Date.now() - Date.parse(event.timestamp) > 60_000 || Number(row.attempts) >= 5) {
              const missing = await request("/cloud/events", { ...cloudEvent, media_failure_reason: "capture_window_elapsed" });
              if (missing.status !== "stored" || missing.media_status !== "missing") throw new Error("media_status_not_acknowledged");
            } else {
              const captured = await capture(event, saved, manifest);
              if (!captured.ok) {
                mediaFailures.set(captured.reason, (mediaFailures.get(captured.reason) ?? 0) + 1);
                // The deployed cloud schema has only this coarse enum; retain
                // the precise bounded reason in local status, not an invalid field.
                const missing = await request("/cloud/events", { ...cloudEvent, media_failure_reason: "capture_failed" });
                if (missing.status !== "stored" || missing.media_status !== "missing") throw new Error("media_status_not_acknowledged");
              }
            }
          }
          if (saved.notifications_pending) throw new Error("notification_retry_pending");
          if (saved.status === "stored" || saved.status === "suppressed") await finishEvent(row.id, event);
          else throw new Error("event_not_acknowledged");
        } catch {
          db.prepare("UPDATE outbox SET attempts=attempts+1,next_attempt_at=? WHERE id=?").run(Date.now()+Math.min(300_000,5_000*2**Math.min(Number(row.attempts),6)),row.id);
        }
  }
  function kickDelivery() {
    if (stopped || !deliveryManifest || Date.now() - deliveryManifestAt >= 30_000 || deliveries.size >= 2) return;
    while (deliveries.size < 2) {
      const occupied = [...deliveryCameras];
      // A backlog from one blocked camera cannot occupy both delivery slots
      // or hide another camera behind the first page of pending rows.
      const filter = occupied.length ? ` AND COALESCE(json_extract(payload,'$.camera_source_id'),'') NOT IN (${occupied.map(()=>"?").join(",")})` : "";
      const row = db.prepare(`SELECT id,payload,attempts FROM outbox WHERE next_attempt_at <= ?${filter} ORDER BY created_at LIMIT 1`).get(Date.now(),...occupied);
      if (!row) break;
      const cameraId = JSON.parse(row.payload).camera_source_id ?? "";
      deliveryCameras.add(cameraId);
      const job = deliver(row).finally(() => { deliveries.delete(row.id); deliveryCameras.delete(cameraId); if (!stopped) kickDelivery(); });
      deliveries.set(row.id, job);
      // Storage failures must not cause unhandled promise rejections.
      job.catch(() => {});
    }
  }
  async function cycle() {
    try {
      // Refresh consent, source list and rules every cycle, not only at startup.
      const manifest = await request("/cloud/event-manifest");
      deliveryManifest = manifest;
      deliveryManifestAt = Date.now();
      kickDelivery();
      const cameras = Array.isArray(manifest.cameras) && manifest.monitoring_enabled ? manifest.cameras : [];
      const active = new Set(cameras.filter(c=>c.monitoring_enabled).map(c=>c.camera_id));
      for (const id of tracker.cameras.keys()) if (!active.has(id)) tracker.forget(id);
      const results = await sampleAllCameras(cameras, async camera => {
        if (["offline", "failed", "error"].includes(camera.status)) throw new Error("camera_offline");
        if (camera.object_analysis_enabled === false) throw new Error("analysis_policy_not_verified");
        // Running an object model is pointless when this camera has no enabled
        // visual event rule (for example parking without a verified crossing line).
        // Keep its health result visible instead of implying analysis coverage.
        if (Array.isArray(camera.supported_event_types) && !camera.supported_event_types.some(type=>["person_detected","person_entered","person_exited","vehicle_entered","vehicle_exited","person_near_pool_off_hours","unauthorized_night_motion"].includes(type))) {
          throw new Error(camera.zone_type==="PARKING"?"crossing_line_not_configured":"no_supported_visual_event_rule");
        }
        const data = await request(`/camera/${encodeURIComponent(camera.stream_id)}/detections`);
        if (!data.local_processing || data.insight?.object_detection?.status !== "sampled") throw new Error("detector_unavailable");
        return data.insight;
      }, async (camera, insight) => {
        try { for (const event of tracker.observe(camera, insight.object_detection.detections, insight.sampled_at, insight.source_anchor ?? null)) {
          if (db.prepare("SELECT count(*) AS n FROM outbox").get().n >= 10000) throw new Error("journal_outbox_full");
          db.prepare("INSERT OR IGNORE INTO outbox(id,payload,created_at) VALUES(?,?,?)").run(event.event_id, JSON.stringify(event), Date.now());
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
            db.prepare("INSERT OR IGNORE INTO outbox(id,payload,created_at) VALUES(?,?,?)").run(id,JSON.stringify(event),Date.now());
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
      const deliveryFailures = Number(db.prepare("SELECT count(*) AS n FROM outbox WHERE attempts>0").get().n);
      const pending = Number(db.prepare("SELECT count(*) AS n FROM outbox").get().n);
      const coverage=journalCoverage(manifest,results);
      report({ status: deliveryFailures ? "delivery_retrying" : coverage.status, checked_at: new Date().toISOString(), coverage, cameras: results, delivery_in_progress:pending>0 && deliveries.size>0, delivery_failures:deliveryFailures, media_failures_by_reason:Object.fromEntries(mediaFailures), pending });
    } catch (error) { deliveryManifest = null; report({status:"unavailable", reason: error.message, checked_at:new Date().toISOString()}); }
    if (!stopped) timer = setTimeout(run, pollIntervalMs);
  }
  function run() { cyclePromise = cycle(); }
  run();
  return async () => { stopped = true; clearTimeout(timer); await cyclePromise; await Promise.allSettled([...deliveries.values()]); db.close(); };
}

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { JournalTracker, sampleAllCameras } from "./journal-tracker.mjs";

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
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL DEFAULT 0)");
  const tracker = new JournalTracker();
  const health = new Map();
  let stopped = false;
  let timer;
  let cyclePromise;
  let deliveryPromise;
  let deliveryManifest;
  const request = async (path, body) => {
    const res = await fetch(gatewayUrl + path, {method: body === undefined ? "GET" : "POST", headers:{"x-video-gateway-secret":gatewaySecret,"content-type":"application/json"}, body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(30_000)});
    const value = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(`journal_http_${res.status}`);
    return value.data ?? value;
  };
  async function capture(event, saved, manifest) {
    const media = await request(`/camera/${encodeURIComponent(event.stream_id)}/event-media`, {window_seconds_before:3,window_seconds_after:5});
    if (media.status !== "available" || !media.clip?.base64 || !media.thumbnail?.base64) throw new Error("event_capture_unavailable");
    const form = new FormData();
    form.set("metadata", JSON.stringify({
      gateway_id:manifest.gateway_id, observer_site_id:manifest.observer_site_id, event_id:saved.media_event_id,
      camera_source_id:event.camera_source_id, stream_id:event.stream_id, event_type:event.event_type,
      severity:{INFO:"info",WARNING:"medium",CRITICAL:"critical"}[event.severity],confidence:event.confidence,
      captured_at:media.captured_at,duration_seconds:media.duration_seconds,window_seconds_before:3,window_seconds_after:5,
      local_capture:true,read_only:true,controls_supported:false,no_dvr_credentials_returned:true,no_rtsp_returned:true,
      metadata:{track_id:event.track_id,recording_required:true}
    }));
    form.set("clip",new Blob([Buffer.from(media.clip.base64,"base64")],{type:"video/mp4"}),"clip.mp4");
    form.set("thumbnail",new Blob([Buffer.from(media.thumbnail.base64,"base64")],{type:"image/jpeg"}),"thumbnail.jpg");
    const uploaded = await fetch(gatewayUrl+"/cloud/event-media",{method:"POST",headers:{"x-video-gateway-secret":gatewaySecret},body:form,signal:AbortSignal.timeout(30_000)});
    const result = await uploaded.json().catch(()=>({}));
    if (!uploaded.ok || result.data?.status !== "stored") throw new Error("event_media_upload_failed");
  }
  async function flushPending() {
    const rows = db.prepare("SELECT id,payload,attempts FROM outbox WHERE next_attempt_at <= ? ORDER BY created_at LIMIT 100").all(Date.now());
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(2, rows.length) }, async () => {
      while (next < rows.length) {
        const row = rows[next++];
        try {
          const event = JSON.parse(row.payload);
          const manifest = deliveryManifest;
          const active = manifest?.monitoring_enabled && manifest.cameras?.some(camera => camera.camera_id === event.camera_source_id && camera.monitoring_enabled);
          // Consent is checked again server-side, including during a concurrent manifest refresh.
          if (!active) { db.prepare("DELETE FROM outbox WHERE id=?").run(row.id); continue; }
          const saved = await request("/cloud/events", event);
          if (saved.status === "stored" && saved.recording_required && !["available", "missing"].includes(saved.media_status)) {
            if (Date.now() - Date.parse(event.timestamp) > 60_000 || Number(row.attempts) >= 5) {
              const missing = await request("/cloud/events", { ...event, media_failure_reason: "capture_window_elapsed" });
              if (missing.status !== "stored" || missing.media_status !== "missing") throw new Error("media_status_not_acknowledged");
            } else await capture(event, saved, manifest);
          }
          if (saved.notifications_pending) throw new Error("notification_retry_pending");
          if (saved.status === "stored" || saved.status === "suppressed") db.prepare("DELETE FROM outbox WHERE id=?").run(row.id);
          else throw new Error("event_not_acknowledged");
        } catch {
          db.prepare("UPDATE outbox SET attempts=attempts+1,next_attempt_at=? WHERE id=?").run(Date.now()+Math.min(300_000,5_000*2**Math.min(Number(row.attempts),6)),row.id);
        }
      }
    }));
  }
  function kickDelivery() {
    if (deliveryPromise || !deliveryManifest) return;
    deliveryPromise = flushPending().finally(() => { deliveryPromise = null; });
    // A storage failure is reflected in the cycle report, never an unhandled rejection.
    deliveryPromise.catch(() => {});
  }
  async function cycle() {
    try {
      // Refresh consent, source list and rules every cycle, not only at startup.
      const manifest = await request("/cloud/event-manifest");
      deliveryManifest = manifest;
      kickDelivery();
      const cameras = Array.isArray(manifest.cameras) && manifest.monitoring_enabled ? manifest.cameras : [];
      const active = new Set(cameras.filter(c=>c.monitoring_enabled).map(c=>c.camera_id));
      for (const id of tracker.cameras.keys()) if (!active.has(id)) tracker.forget(id);
      const results = await sampleAllCameras(cameras, async camera => {
        if (["offline", "failed", "error"].includes(camera.status)) throw new Error("camera_offline");
        if (camera.object_analysis_enabled === false) throw new Error("analysis_policy_not_verified");
        if (["POOL","PERIMETER"].includes(camera.zone_type)) throw new Error("specialized_detector_unavailable");
        // Running an object model is pointless when this camera has no enabled
        // visual event rule (for example parking without a verified crossing line).
        // Keep its health result visible instead of implying analysis coverage.
        if (Array.isArray(camera.supported_event_types) && !camera.supported_event_types.some(type=>["person_detected","person_entered","person_exited","vehicle_entered","vehicle_exited"].includes(type))) {
          throw new Error(camera.zone_type==="PARKING"?"crossing_line_not_configured":"no_supported_visual_event_rule");
        }
        const data = await request(`/camera/${encodeURIComponent(camera.stream_id)}/detections`);
        if (!data.local_processing || data.insight?.object_detection?.status !== "sampled") throw new Error("detector_unavailable");
        return data.insight;
      }, async (camera, insight) => {
        for (const event of tracker.observe(camera, insight.object_detection.detections, insight.sampled_at)) {
          if (db.prepare("SELECT count(*) AS n FROM outbox").get().n >= 10000) throw new Error("journal_outbox_full");
          db.prepare("INSERT OR IGNORE INTO outbox(id,payload,created_at) VALUES(?,?,?)").run(event.event_id, JSON.stringify(event), Date.now());
          // Do not wait for a slow/disconnected camera before delivering this event.
          kickDelivery();
        }
      }, 4);
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
        }
      }
      // Keep sampling/consent refresh independent of a slow cloud response or
      // clip upload. kickDelivery remains single-flight; shutdown still drains it.
      kickDelivery();
      const deliveryFailures = Number(db.prepare("SELECT count(*) AS n FROM outbox WHERE attempts>0").get().n);
      const pending = Number(db.prepare("SELECT count(*) AS n FROM outbox").get().n);
      const coverage=journalCoverage(manifest,results);
      report({ status: deliveryFailures ? "delivery_retrying" : coverage.status, checked_at: new Date().toISOString(), coverage, cameras: results, delivery_in_progress:pending>0 && Boolean(deliveryPromise), delivery_failures:deliveryFailures, pending });
    } catch (error) { report({status:"unavailable", reason: error.message, checked_at:new Date().toISOString()}); }
    if (!stopped) timer = setTimeout(run, pollIntervalMs);
  }
  function run() { cyclePromise = cycle(); }
  run();
  return async () => { stopped = true; clearTimeout(timer); await cyclePromise; await deliveryPromise; db.close(); };
}

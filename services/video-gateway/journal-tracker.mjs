import { randomUUID } from "node:crypto";

const vehicleLabels = new Set(["car", "truck", "bus", "motorcycle"]);
const offHoursEventForZone = Object.freeze({ POOL: "person_near_pool_off_hours", PERIMETER: "unauthorized_night_motion" });
function point(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(v => Number.isFinite(v) && v >= 0 && v <= 1) || box[2] <= box[0] || box[3] <= box[1]) return null;
  return { x: (box[1] + box[3]) / 2, y: (box[0] + box[2]) / 2 };
}
export function validCrossingLine(line) {
  return line && ["x", "y"].includes(line.axis) && Number.isFinite(line.position) && line.position > 0 && line.position < 1 && ["positive", "negative"].includes(line.inside);
}

/** Frame disappearance is never a directional exit. Tracks never cross cameras. */
export class JournalTracker {
  constructor({ confirmations = 3, maxGapMs = 60_000, cooldownMs = 30_000 } = {}) {
    this.confirmations = confirmations;
    this.maxGapMs = maxGapMs;
    this.cooldownMs = cooldownMs;
    this.cameras = new Map();
  }
  forget(cameraId) { this.cameras.delete(cameraId); }
  observe(camera, detections, timestamp, sourceAnchor = null) {
    const now = Date.parse(timestamp);
    if (!Number.isFinite(now) || camera.monitoring_enabled !== true) return [];
    if (sourceAnchor && (sourceAnchor.stream_id !== camera.stream_id
      || sourceAnchor.camera_source_id !== camera.camera_id
      || typeof sourceAnchor.source_generation !== "string" || !sourceAnchor.source_generation
      || !Number.isSafeInteger(sourceAnchor.sequence) || sourceAnchor.sequence < 0
      || !Number.isSafeInteger(sourceAnchor.discontinuity) || sourceAnchor.discontinuity < 0
      || !Number.isFinite(sourceAnchor.offset_seconds) || sourceAnchor.offset_seconds < 0
      || sourceAnchor.observed_at !== timestamp)) return [];
    const line = validCrossingLine(camera.crossing_line) ? camera.crossing_line : null;
    // Manifest refreshes may replace a source or move its spatial boundary.
    // Old positions must never become evidence of crossing a new boundary.
    // Cosmetic names and rule ordering do not invalidate a continuous track.
    const scope = JSON.stringify([camera.stream_id ?? null, camera.zone_type ?? null,
      line ? [line.axis, line.position, line.inside] : null,
      camera.off_hours_active === true,
      [...new Set((Array.isArray(camera.allowed_event_types) ? camera.allowed_event_types : []).filter(type => typeof type === "string"))].sort(),
      [...new Set((Array.isArray(camera.supported_event_types) ? camera.supported_event_types : []).filter(type => typeof type === "string"))].sort(),
      [...new Set((Array.isArray(camera.verified_event_types) ? camera.verified_event_types : []).filter(type => typeof type === "string"))].sort(),
      [...new Set((Array.isArray(camera.critical_event_types) ? camera.critical_event_types : []).filter(type => typeof type === "string"))].sort(),
      sourceAnchor ? [sourceAnchor.observer_site_id, sourceAnchor.gateway_id, sourceAnchor.source_generation, sourceAnchor.discontinuity] : null]);
    const previousState = this.cameras.get(camera.camera_id);
    const state = previousState?.scope === scope ? previousState : { at: previousState?.at ?? 0, tracks: [], scope };
    if (now <= state.at) return [];
    // Re-reading the same HLS frame is not a new confirmation. A replacement
    // generation or discontinuity starts fresh evidence through the scope above.
    if (sourceAnchor && state.frame && (sourceAnchor.sequence < state.frame.sequence
      || sourceAnchor.sequence === state.frame.sequence && sourceAnchor.offset_seconds <= state.frame.offset)) return [];
    state.frame = sourceAnchor ? { sequence: sourceAnchor.sequence, offset: sourceAnchor.offset_seconds } : null;
    if (now - state.at > this.maxGapMs) state.tracks = [];
    state.at = now;
    state.tracks = state.tracks.filter(t => now - t.at <= this.maxGapMs);
    const used = new Set();
    const events = [];
    for (const detection of detections) {
      const p = point(detection.box);
      if (!p || !Number.isFinite(detection.confidence) || detection.confidence < 0.65 || detection.confidence > 1) continue;
      const kind = detection.label === "person" ? "person" : vehicleLabels.has(detection.label) ? "vehicle" : null;
      if (!kind || (kind === "vehicle" && camera.zone_type !== "PARKING")) continue;
      // Zone-specific presence below never promotes a generic person/vehicle
      // box into drowning, child supervision, fence climbing, fire or smoke.
      const candidates = state.tracks.filter(t => t.kind === kind && !used.has(t.id))
        .map(t => ({t, distance: Math.hypot(t.p.x - p.x, t.p.y - p.y)})).filter(c => c.distance < 0.22).sort((a,b) => a.distance - b.distance);
      // An ambiguous association must not invent a crossing by swapping people.
      if (candidates.length > 1 && candidates[1].distance - candidates[0].distance < 0.035) continue;
      let track = candidates[0]?.t;
      if (!track) {
        track = { id: randomUUID(), kind, p, at: now, hits: 0, side: 0, nextSide: 0, sideHits: 0, lastEventAt: 0, presence: false };
        state.tracks.push(track);
      }
      used.add(track.id);
      track.p = p; track.at = now; track.hits++;
      const emit = (type, evidence, severity = "INFO") => {
        if (!camera.allowed_event_types?.includes(type) || !camera.supported_event_types?.includes(type)) return;
        if (evidence === "object_detection_off_hours" && (camera.off_hours_active !== true
          || offHoursEventForZone[camera.zone_type] !== type || !camera.verified_event_types?.includes(type))) return;
        events.push({event_id:randomUUID(), camera_source_id:camera.camera_id, stream_id:camera.stream_id,
          event_type:type, severity, confidence:detection.confidence, timestamp, track_id:track.id, evidence_kind:evidence,
          ...(sourceAnchor ? { source_anchor: { ...sourceAnchor } } : {}) });
      };
      if (track.hits >= this.confirmations && !track.presence) {
        if (kind === "person") {
          if (camera.zone_type === "POOL" && camera.off_hours_active === true) emit("person_near_pool_off_hours", "object_detection_off_hours", "WARNING");
          else if (camera.zone_type === "PERIMETER" && camera.off_hours_active === true) emit("unauthorized_night_motion", "object_detection_off_hours", "WARNING");
          else emit("person_detected", "object_detection");
        }
        track.presence = true;
      }
      if (!line) continue;
      const delta = p[line.axis] - line.position;
      const side = Math.abs(delta) < 0.04 ? 0 : Math.sign(delta);
      if (!side) { track.nextSide = 0; track.sideHits = 0; continue; }
      track.sideHits = track.nextSide === side ? track.sideHits + 1 : 1;
      track.nextSide = side;
      if (track.sideHits < this.confirmations) continue;
      const previous = track.side;
      track.side = side;
      if (!previous || previous === side || now - track.lastEventAt < this.cooldownMs) continue;
      track.lastEventAt = now;
      const entered = side === (line.inside === "positive" ? 1 : -1);
      const directionalType = `${kind}_${entered ? "entered" : "exited"}`;
      emit(directionalType, "line_crossing", camera.critical_event_types?.includes(directionalType) ? "CRITICAL" : "INFO");
    }
    this.cameras.set(camera.camera_id, state);
    return events;
  }
}

/** Bounded parallel work: one failed camera cannot prevent sampling the rest. */
export async function sampleAllCameras(cameras, sample, consume, concurrency = 2) {
  const queue = cameras.filter(c => c.monitoring_enabled && c.stream_id);
  let cursor = 0;
  const results = [];
  await Promise.all(Array.from({length: Math.min(Math.max(1, concurrency), queue.length)}, async () => {
    while (cursor < queue.length) {
      const camera = queue[cursor++];
      try { await consume(camera, await sample(camera)); results.push({ camera_id: camera.camera_id, status: "sampled" }); }
      catch (error) { results.push({ camera_id: camera.camera_id, status: "unavailable", reason: String(error.message).slice(0,80) }); }
    }
  }));
  return results;
}

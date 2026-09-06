import { randomUUID } from "node:crypto";

const vehicleLabels = new Set(["car", "truck", "bus", "motorcycle"]);
const offHoursEventForZone = Object.freeze({ POOL: "person_near_pool_off_hours", PERIMETER: "unauthorized_night_motion" });
export function crossingPoint(box) {
  if (!Array.isArray(box) || box.length !== 4 || !box.every(v => Number.isFinite(v) && v >= 0 && v <= 1) || box[2] <= box[0] || box[3] <= box[1]) return null;
  return { x: (box[1] + box[3]) / 2, y: (box[0] + box[2]) / 2 };
}
export function sideOfLine(pointValue, line, epsilon = 0.04) {
  if (!pointValue || !validCrossingLine(line) || !Number.isFinite(epsilon) || epsilon < 0 || epsilon >= 0.5) return 0;
  const delta = pointValue[line.axis] - line.position;
  return Math.abs(delta) < epsilon ? 0 : Math.sign(delta);
}
function canBridgeConfirmedCrossing(track, pointValue, line, now) {
  if (!line || track.side === 0 || now - track.at > 1_500) return false;
  const previousDelta = track.p[line.axis] - line.position;
  const currentDelta = pointValue[line.axis] - line.position;
  const previousSide = Math.abs(previousDelta) < 0.04 ? 0 : Math.sign(previousDelta);
  const currentSide = Math.abs(currentDelta) < 0.04 ? 0 : Math.sign(currentDelta);
  if (!previousSide || !currentSide || previousSide === currentSide) return false;
  const alongAxis = line.axis === "y" ? "x" : "y";
  return Math.abs(pointValue[alongAxis] - track.p[alongAxis]) < 0.16
    && Math.abs(currentDelta - previousDelta) < 0.42;
}
export function validCrossingLine(line) {
  return line && ["x", "y"].includes(line.axis) && Number.isFinite(line.position) && line.position > 0 && line.position < 1 && ["positive", "negative"].includes(line.inside);
}

/** Frame disappearance is never a directional exit. Tracks never cross cameras. */
export class JournalTracker {
  constructor({ confirmations = 3, personConfirmations = 2, maxGapMs = 60_000, cooldownMs = 30_000, trace = null } = {}) {
    this.confirmations = confirmations;
    this.personConfirmations = personConfirmations;
    this.maxGapMs = maxGapMs;
    this.cooldownMs = cooldownMs;
    this.trace = typeof trace === "function" ? trace : null;
    this.cameras = new Map();
  }
  forget(cameraId) { this.cameras.delete(cameraId); }
  observe(camera, detections, timestamp, sourceAnchor = null, modelProvenance = null) {
    const now = Date.parse(timestamp);
    if (!Number.isFinite(now) || camera.monitoring_enabled !== true
      || ["demo", "mock", "local_shadow"].includes(camera.source_mode)) return [];
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
      const p = crossingPoint(detection.box);
      if (!p || !Number.isFinite(detection.confidence) || detection.confidence < 0.65 || detection.confidence > 1) continue;
      const kind = detection.label === "person" ? "person" : vehicleLabels.has(detection.label) ? "vehicle" : null;
      if (!kind || (kind === "vehicle" && camera.zone_type !== "PARKING")) continue;
      // Zone-specific presence below never promotes a generic person/vehicle
      // box into drowning, child supervision, fence climbing, fire or smoke.
      const candidates = state.tracks.filter(t => t.kind === kind && !used.has(t.id))
        .map(t => ({ t, distance: Math.hypot(t.p.x - p.x, t.p.y - p.y),
          crossingBridge: canBridgeConfirmedCrossing(t, p, line, now) }))
        .filter(c => c.distance < 0.22 || c.crossingBridge)
        .sort((a,b) => a.distance - b.distance);
      // An ambiguous association must not invent a crossing by swapping people.
      if (candidates.length > 1 && candidates[1].distance - candidates[0].distance < 0.035) continue;
      let track = candidates[0]?.t;
      const createdTrack = !track;
      if (!track) {
        track = { id: randomUUID(), kind, p, at: now, firstAt: now, hits: 0, side: 0, nextSide: 0, sideHits: 0, lastEventAt: 0, presence: false };
        state.tracks.push(track);
      }
      const stateBefore = { hits: track.hits, side: track.side, next_side: track.nextSide, side_hits: track.sideHits,
        presence: track.presence, observed_at: track.at ? new Date(track.at).toISOString() : null };
      const emittedBefore = events.length;
      used.add(track.id);
      if (!Number.isFinite(track.firstAt)) track.firstAt = now;
      track.p = p; track.at = now; track.hits++;
      const safeModelProvenance = modelProvenance && typeof modelProvenance === "object"
        && typeof modelProvenance.model === "string" && modelProvenance.model.length <= 160
        && typeof modelProvenance.runtime === "string" && modelProvenance.runtime.length <= 160
        && typeof modelProvenance.execution_provider === "string" && modelProvenance.execution_provider.length <= 80
        ? { model: modelProvenance.model, runtime: modelProvenance.runtime, execution_provider: modelProvenance.execution_provider,
          ...(typeof modelProvenance.expected_sha256 === "string" && /^[a-f0-9]{64}$/i.test(modelProvenance.expected_sha256) ? { expected_sha256: modelProvenance.expected_sha256 } : {}) }
        : null;
      const emit = (type, evidence, severity = "INFO") => {
        if (!camera.allowed_event_types?.includes(type) || !camera.supported_event_types?.includes(type)) return;
        if (evidence === "object_detection_off_hours" && (camera.off_hours_active !== true
          || offHoursEventForZone[camera.zone_type] !== type || !camera.verified_event_types?.includes(type))) return;
        events.push({event_id:randomUUID(), camera_source_id:camera.camera_id, stream_id:camera.stream_id,
          event_type:type, severity, confidence:detection.confidence, timestamp, track_id:track.id, evidence_kind:evidence,
          verification_evidence:{ distinct_source_frames:track.hits,
            directional_confirmations:evidence==="line_crossing"?track.sideHits:0,
            source_sequence:Number.isSafeInteger(sourceAnchor?.sequence)?sourceAnchor.sequence:null,
            source_anchor_verified:Boolean(sourceAnchor), tracking_duration_ms:Math.max(0,now-track.firstAt) },
          ...(sourceAnchor ? { source_anchor: { ...sourceAnchor } } : {}),
          ...(safeModelProvenance ? { model_provenance: safeModelProvenance } : {}) });
      };
      if (track.hits >= (kind === "person" ? this.personConfirmations : this.confirmations) && !track.presence) {
        if (kind === "person") {
          if (camera.zone_type === "POOL" && camera.off_hours_active === true) emit("person_near_pool_off_hours", "object_detection_off_hours", "WARNING");
          else if (camera.zone_type === "PERIMETER" && camera.off_hours_active === true) emit("unauthorized_night_motion", "object_detection_off_hours", "WARNING");
          else emit("person_detected", "object_detection");
        }
        track.presence = true;
      }
      const reportTrace = ({ side = 0, delta = null, countsTowardCrossing = false } = {}) => {
        if (!this.trace) return;
        try {
          this.trace({ camera_id:camera.camera_id, stream_id:camera.stream_id, timestamp,
            source_sequence:sourceAnchor?.sequence ?? null, confidence:detection.confidence,
            box:[...detection.box], crossing_point:{ kind:"box_centroid", x:p.x, y:p.y },
            line:line ? { ...line, epsilon:0.04 } : null, signed_delta:delta,
            side, side_label:side === 0 ? "ON_LINE" : side > 0 ? "POSITIVE" : "NEGATIVE",
            track_id:track.id, association:{ created_track:createdTrack,
              distance:candidates[0]?.distance ?? null, crossing_bridge:candidates[0]?.crossingBridge === true },
            state_before:stateBefore,
            state_after:{ hits:track.hits, side:track.side, next_side:track.nextSide, side_hits:track.sideHits,
              presence:track.presence, observed_at:new Date(track.at).toISOString() },
            counts_toward_crossing:countsTowardCrossing,
            emitted_event_types:events.slice(emittedBefore).map(event => event.event_type) });
        } catch { /* Diagnostic tracing must never affect tracking. */ }
      };
      if (!line) { reportTrace(); continue; }
      const delta = p[line.axis] - line.position;
      const side = sideOfLine(p, line);
      if (!side) { track.nextSide = 0; track.sideHits = 0; reportTrace({ side, delta }); continue; }
      track.sideHits = track.nextSide === side ? track.sideHits + 1 : 1;
      track.nextSide = side;
      if (track.sideHits < this.confirmations) { reportTrace({ side, delta, countsTowardCrossing:true }); continue; }
      const previous = track.side;
      track.side = side;
      if (!previous || previous === side || now - track.lastEventAt < this.cooldownMs) {
        reportTrace({ side, delta, countsTowardCrossing:true });
        continue;
      }
      track.lastEventAt = now;
      const entered = side === (line.inside === "positive" ? 1 : -1);
      const directionalType = `${kind}_${entered ? "entered" : "exited"}`;
      emit(directionalType, "line_crossing", camera.critical_event_types?.includes(directionalType) ? "CRITICAL" : "INFO");
      reportTrace({ side, delta, countsTowardCrossing:true });
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

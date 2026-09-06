import { createHash, randomUUID } from "node:crypto";
import { parseEventClipPlaylist, planEventClipWindow } from "./event-clip-window.mjs";

const failure = reason => ({ status: "unavailable", reason });
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const namespacedEventId = (siteId, eventId) => {
  const hex = createHash("sha256").update(`${siteId}:${eventId}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};
const validEventId = value => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const specializedRecordableEvent = Object.freeze({
  POOL: "person_near_pool_off_hours",
  PERIMETER: "unauthorized_night_motion"
});

export function evidencePlaylist(segments, ended = true) {
  return ["#EXTM3U", "#EXT-X-VERSION:3", "#EXT-X-TARGETDURATION:" + Math.ceil(Math.max(...segments.map(s => s.duration_seconds))),
    "#EXT-X-MEDIA-SEQUENCE:" + segments[0].sequence,
    "#EXT-X-DISCONTINUITY-SEQUENCE:" + segments[0].discontinuity,
    ...segments.flatMap(s => [`#EXTINF:${s.duration_seconds},`, s.name]), ended ? "#EXT-X-ENDLIST" : ""].join("\n") + "\n";
}

/** Bounded, short-lived RAM leases, never persistent passive recordings.
 * readSegment must read only completed local files from this relay's directory.
 * Callers may write a snapshot only AFTER cloud validation requires a clip. */
export function createEventEvidenceStore({ now = Date.now, leaseMs = 30_000, manifestMs = 30_000, maxBytes = 64 * 1024 * 1024,
  maxSegmentBytes = 8 * 1024 * 1024, maxLeases = 32, maxLeasesPerStream = 2, maxBytesPerStream = 4 * 1024 * 1024 } = {}) {
  const leases = new Map();
  const grants = new Map();
  const decisions = new Map();
  const authorizationFailures = new Map();
  let bindings = new Map(), manifestExpires = 0;
  let retainedBytes = 0;
  function authorizationFailure(reason) {
    authorizationFailures.set(reason, (authorizationFailures.get(reason) ?? 0) + 1);
    return null;
  }
  function claimFailure(reason) {
    authorizationFailures.set(`claim_${reason}`, (authorizationFailures.get(`claim_${reason}`) ?? 0) + 1);
    return false;
  }
  function release(id, reason = "evidence_released") {
    const lease = leases.get(id);
    if (!lease) return;
    leases.delete(id);
    retainedBytes -= lease.bytes;
    lease.controller.abort(reason);
    // Drop references; do not overwrite buffers still owned by a bounded decoder.
    lease.segments.clear();
  }
  function sweep() {
    if (manifestExpires <= now()) bindings.clear();
    for (const [id, lease] of leases) {
      if (bindings.get(lease.streamId)?.version !== lease.binding.version) release(id, "monitoring_not_authorized");
      else if (lease.expires <= now()) release(id, "source_anchor_expired");
    }
    for (const [id, grant] of grants) if (grant.expires <= now() || bindings.get(grant.streamId)?.version !== grant.version) grants.delete(id);
    // A manifest refresh revokes leases and grants, but must not revive a cloud
    // recording decision that was already accepted within its event horizon.
    for (const [id, decision] of decisions) if (decision.expires <= now()) decisions.delete(id);
  }
  function get(id) { sweep(); return leases.get(id); }
  function copySegment(lease, segment, readSegment) {
    const input = readSegment(segment.name);
    if (!Buffer.isBuffer(input) || !input.length || input.length > maxSegmentBytes) throw Error("segment_size_invalid");
    if (retainedBytes + input.length > maxBytes) throw Error("evidence_memory_limit");
    const streamBytes = [...leases.values()].filter(item => item.streamId === lease.streamId).reduce((n, item) => n + item.bytes, 0);
    if (streamBytes + input.length > maxBytesPerStream) throw Error("evidence_stream_memory_limit");
    const bytes = Buffer.from(input);
    lease.segments.set(segment.sequence, { ...segment, bytes, sha256: digest(bytes) });
    lease.bytes += bytes.length;
    retainedBytes += bytes.length;
  }
  return {
    updateManifest(manifest) {
      sweep();
      const next = new Map(), duplicates = new Set(), seen = new Set();
      const validId = value => typeof value === "string" && value.length > 0 && value.length <= 160;
      if (manifest?.monitoring_enabled === true && validId(manifest.observer_site_id) && validId(manifest.gateway_id)
        && Array.isArray(manifest.cameras) && manifest.cameras.length <= 256) {
        for (const camera of manifest.cameras) {
          if (!validId(camera?.stream_id)) continue;
          if (seen.has(camera.stream_id)) { duplicates.add(camera.stream_id); continue; }
          seen.add(camera.stream_id);
          if (!validId(camera.camera_id)) continue;
          const supported = Array.isArray(camera.supported_event_types) && camera.supported_event_types.length <= 64
            ? camera.supported_event_types.filter(type => typeof type === "string") : [];
          const allowed = Array.isArray(camera.allowed_event_types) && camera.allowed_event_types.length <= 64
            ? camera.allowed_event_types.filter(type => typeof type === "string") : [];
          const verified = Array.isArray(camera.verified_event_types) && camera.verified_event_types.length <= 64
            ? camera.verified_event_types.filter(type => typeof type === "string") : [];
          const specialized = specializedRecordableEvent[camera.zone_type];
          const eventCaptureAuthorized = specialized
            ? camera.off_hours_active === true && allowed.includes(specialized) && supported.includes(specialized) && verified.includes(specialized)
            : supported.some(type => ["person_detected", "person_entered", "person_exited", "vehicle_entered", "vehicle_exited"].includes(type));
          if (camera.monitoring_enabled !== true || camera.object_analysis_enabled !== true
            || !["connected", "online"].includes(camera.status) || !eventCaptureAuthorized) continue;
          const binding = { observer_site_id: manifest.observer_site_id, gateway_id: manifest.gateway_id,
            camera_source_id: camera.camera_id, specialized_event_type: specialized ?? null };
          const signature = JSON.stringify([binding, camera.zone_type, camera.crossing_line ?? null,
            camera.off_hours_active === true, [...allowed].sort(), [...supported].sort(), [...verified].sort()]);
          const previous = bindings.get(camera.stream_id);
          next.set(camera.stream_id, { ...binding, signature, version: previous?.signature === signature ? previous.version : randomUUID() });
        }
      }
      for (const streamId of duplicates) next.delete(streamId);
      bindings = next;
      manifestExpires = now() + manifestMs;
      // Revocation/mapping replacement immediately aborts in-flight capture.
      sweep();
    },
    binding(streamId) { sweep(); return bindings.get(streamId) ?? null; },
    // Called only with a successful authenticated cloud response, not request flags.
    authorizeRecording(event, saved, version) {
      sweep();
      const binding = bindings.get(event?.stream_id);
      const eventTime = Date.parse(event?.timestamp);
      const expectedMediaEventId = binding && validEventId(event?.event_id)
        ? namespacedEventId(binding.observer_site_id, event.event_id) : null;
      const decisionId = binding && expectedMediaEventId
        ? JSON.stringify([binding.observer_site_id, event.event_id, expectedMediaEventId]) : "";
      // Expose only bounded condition categories in health. Never include an
      // event ID, source anchor, token, URL, or any payload content here.
      if (!binding) return authorizationFailure("binding_unavailable");
      if (binding.version !== version) return authorizationFailure("binding_version_changed");
      if (binding.camera_source_id !== event.camera_source_id) return authorizationFailure("camera_binding_mismatch");
      if (binding.specialized_event_type && (event.evidence_kind !== "object_detection_off_hours" || event.event_type !== binding.specialized_event_type)) return authorizationFailure("specialized_event_mismatch");
      if (saved?.status !== "stored") return authorizationFailure("cloud_event_not_stored");
      if (saved.recording_required !== true) return authorizationFailure("recording_not_required");
      if (saved.media_status !== "pending") return authorizationFailure("media_not_pending");
      if (!expectedMediaEventId || saved.media_event_id !== expectedMediaEventId) return authorizationFailure("media_event_identity_mismatch");
      if (decisions.has(decisionId)) return authorizationFailure("duplicate_recording_decision");
      if (!Number.isFinite(eventTime) || eventTime > now() || now() - eventTime >= 60_000) return authorizationFailure("event_time_outside_capture_horizon");
      if (grants.size >= 64 || decisions.size >= 64) return authorizationFailure("recording_capacity_reached");
      const token = randomUUID();
      const decisionExpires = eventTime + 60_000;
      const expires = Math.min(now() + 30_000, decisionExpires);
      grants.set(token, { streamId: event.stream_id, version, eventId: event.event_id, decisionId,
        observedAt: event.timestamp, expires, active: false });
      decisions.set(decisionId, { observerSiteId: binding.observer_site_id, eventId: event.event_id,
        mediaEventId: expectedMediaEventId, streamId: event.stream_id, expires: decisionExpires, state: "pending" });
      return token;
    },
    claimRecording(token, anchor) {
      sweep();
      const grant = grants.get(token), lease = leases.get(anchor?.lease_id);
      // As above, reasons are bounded operational categories only. They are
      // intentionally not tied to an event, source, anchor, token or URL.
      if (!grant) return claimFailure("grant_missing");
      if (grant.active) return claimFailure("grant_active");
      if (!lease?.anchor) return claimFailure("anchor_missing");
      if (grant.streamId !== lease.streamId) return claimFailure("stream_mismatch");
      if (grant.version !== lease.binding.version) return claimFailure("binding_version_changed");
      if (grant.observedAt !== lease.anchor.observed_at) return claimFailure("observed_at_mismatch");
      if (Object.keys(lease.anchor).some(k => anchor[k] !== lease.anchor[k])) return claimFailure("anchor_mismatch");
      grant.active = true;
      const decision = decisions.get(grant.decisionId);
      if (!decision || decision.state !== "pending") { grant.active = false; return claimFailure("decision_not_pending"); }
      decision.state = "active";
      return true;
    },
    finishRecording(token, success) {
      const grant = grants.get(token);
      const decision = grant ? decisions.get(grant.decisionId) : null;
      if (success) {
        grants.delete(token);
        if (decision) decision.state = "finished";
      } else if (grant) {
        grant.active = false;
        if (decision) decision.state = "pending";
      }
    },
    releaseForStream(streamId, id) { if (leases.get(id)?.streamId === streamId) release(id); },
    prepare({ streamId, sourceGeneration, sequenceFloor, playlistText, readSegment }) {
      sweep();
      const binding = bindings.get(streamId);
      if (!binding) return failure("monitoring_not_authorized");
      if (typeof streamId !== "string" || !streamId || typeof sourceGeneration !== "string" || !sourceGeneration
        || !Number.isSafeInteger(sequenceFloor) || sequenceFloor < 0) return failure("source_identity_invalid");
      if (leases.size >= maxLeases) return failure("evidence_lease_limit");
      if ([...leases.values()].filter(lease => lease.streamId === streamId).length >= maxLeasesPerStream) return failure("evidence_stream_lease_limit");
      const parsed = parseEventClipPlaylist(playlistText, streamId);
      if (!parsed) return failure("playlist_invalid");
      const last = parsed.segments.at(-1);
      if (last.sequence < sequenceFloor) return failure("current_generation_not_ready");
      // Do not pull prebuffer across a reconnect or across discontinuities.
      const segments = parsed.segments.filter(s => s.sequence >= sequenceFloor && s.discontinuity === last.discontinuity);
      const id = randomUUID();
      const lease = { streamId, sourceGeneration, binding, controller: new AbortController(), observedAt: new Date(now()).toISOString(), expires: now() + leaseMs,
        segments: new Map(), bytes: 0, anchor: null, last, ended: parsed.ended };
      leases.set(id, lease);
      try {
        for (const segment of segments) copySegment(lease, segment, readSegment);
        return { status: "prepared", lease_id: id, segment: { ...last }, bytes: lease.segments.get(last.sequence).bytes, signal: lease.controller.signal };
      } catch (error) { release(id); return failure(["segment_size_invalid", "evidence_memory_limit", "evidence_stream_memory_limit"].includes(error.message) ? error.message : "source_segment_unavailable"); }
    },
    bindFrame(id, offsetSeconds) {
      const lease = get(id);
      if (!lease) return failure("source_anchor_expired");
      if (lease.anchor) return failure("frame_anchor_already_bound");
      if (!Number.isFinite(offsetSeconds) || offsetSeconds < 0 || offsetSeconds >= lease.last.duration_seconds) {
        release(id); return failure("frame_offset_invalid");
      }
      lease.anchor = Object.freeze({ lease_id: id, stream_id: lease.streamId, source_generation: lease.sourceGeneration,
        observer_site_id: lease.binding.observer_site_id, gateway_id: lease.binding.gateway_id, camera_source_id: lease.binding.camera_source_id,
        sequence: lease.last.sequence, discontinuity: lease.last.discontinuity, offset_seconds: offsetSeconds,
        observed_at: lease.observedAt, segment_sha256: lease.segments.get(lease.last.sequence).sha256,
        offset_basis: "ffmpeg_start_at_zero_showinfo", source_capture_utc_known: false });
      return { status: "anchored", anchor: { ...lease.anchor } };
    },
    window({ anchor, streamId, sourceGeneration, playlistText, readSegment, recordingRequired, beforeSeconds = 3, afterSeconds = 5 }) {
      if (recordingRequired !== true) return { status: "not_required" };
      sweep();
      if (!bindings.has(streamId)) return failure("monitoring_not_authorized");
      const lease = get(anchor?.lease_id);
      if (!lease?.anchor) return failure("source_anchor_expired");
      if (lease.streamId !== streamId || lease.sourceGeneration !== sourceGeneration
        || ["observer_site_id", "gateway_id", "camera_source_id", "stream_id", "source_generation", "sequence", "discontinuity", "offset_seconds", "segment_sha256", "observed_at"].some(k => anchor[k] !== lease.anchor[k])) {
        return failure("source_anchor_mismatch");
      }
      const plan = ended => planEventClipWindow({ playlistText: evidencePlaylist([...lease.segments.values()], ended),
        streamId, sourceGeneration, anchor: lease.anchor, recordingRequired: true, beforeSeconds, afterSeconds });
      let result = plan(lease.ended);
      if (result.status === "awaiting_future") {
        const current = parseEventClipPlaylist(playlistText, streamId);
        if (!current) return failure("playlist_invalid");
        const previous = [...lease.segments.values()].at(-1);
        const additions = current.segments.filter(s => s.sequence > previous.sequence);
        if (additions.length && additions[0].sequence !== previous.sequence + 1) return failure("postbuffer_gap");
        try {
          for (const segment of additions) {
            if (segment.discontinuity !== lease.anchor.discontinuity) return failure("timeline_discontinuous");
            copySegment(lease, segment, readSegment);
            result = plan(false);
            if (result.status !== "awaiting_future") break;
          }
        } catch (error) { return failure(["segment_size_invalid", "evidence_memory_limit", "evidence_stream_memory_limit"].includes(error.message) ? error.message : "source_segment_unavailable"); }
        lease.ended = current.ended;
        result = plan(lease.ended);
      }
      if (result.status !== "ready") return result;
      const selected = result.segments.map(s => lease.segments.get(s.sequence));
      const duration = selected.reduce((sum, s) => sum + s.duration_seconds, 0);
      const before = result.trim_start_seconds + beforeSeconds;
      // Preserve whole segments so the identified frame is not cropped away.
      if (duration > 30 || before > 15 || duration - before > 15) return failure("complete_segment_window_too_large");
      return { status: "ready", anchor: { ...lease.anchor }, signal: lease.controller.signal, segments: selected.map(s => ({ ...s })),
        playlist: evidencePlaylist(selected), actual_duration_seconds: duration,
        event_offset_seconds: before, actual_after_seconds: duration - before };
    },
    release,
    sweep,
    status() {
      sweep();
      return {
        leases: leases.size,
        retained_bytes: retainedBytes,
        authorization_failures_by_reason: Object.fromEntries(authorizationFailures)
      };
    }
  };
}

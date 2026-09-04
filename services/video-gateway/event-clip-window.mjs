// Pure planning only. The caller must obtain an anchor from the decoded source
// frame, authorize recording, and pin/copy the selected segments before FFmpeg
// consumes them. Never substitute a newer live playlist when history expired.
const unavailable = reason => ({ status: "unavailable", reason });
const segmentName = /^segment-[0-9]{1,18}\.ts$/;

export function parseEventClipPlaylist(text, streamId) {
  if (typeof text !== "string" || text.length > 262_144 || typeof streamId !== "string" || !streamId) return null;
  const lines = text.trim().split(/\r?\n/).map(line => line.trim());
  if (lines[0] !== "#EXTM3U" || lines.length > 4096) return null;
  let sequence = null, discontinuity = 0, duration = null, ended = false, discontinuitySequenceSeen = false, discontinuitySeen = false;
  const segments = [], names = new Set();
  for (const line of lines.slice(1)) {
    if (!line) continue;
    if (line.startsWith("#EXT-X-MEDIA-SEQUENCE:")) {
      const value = line.slice("#EXT-X-MEDIA-SEQUENCE:".length);
      if (sequence !== null || segments.length || !/^[0-9]+$/.test(value)) return null;
      sequence = Number(value);
      if (!Number.isSafeInteger(sequence)) return null;
    } else if (line.startsWith("#EXT-X-DISCONTINUITY-SEQUENCE:")) {
      const value = line.slice("#EXT-X-DISCONTINUITY-SEQUENCE:".length);
      if (discontinuitySequenceSeen || discontinuitySeen || segments.length || !/^[0-9]+$/.test(value)) return null;
      discontinuitySequenceSeen = true;
      discontinuity = Number(value);
      if (!Number.isSafeInteger(discontinuity)) return null;
    } else if (line === "#EXT-X-DISCONTINUITY") {
      if (duration !== null || ended) return null;
      discontinuitySeen = true;
      discontinuity++;
      if (!Number.isSafeInteger(discontinuity)) return null;
    } else if (line.startsWith("#EXTINF:")) {
      if (duration !== null || ended) return null;
      const value = line.slice(8).split(",")[0];
      if (!/^[0-9]+(?:\.[0-9]+)?$/.test(value)) return null;
      duration = Number(value);
      if (!(duration > 0 && duration <= 60)) return null;
    } else if (line === "#EXT-X-ENDLIST") {
      if (duration !== null) return null;
      ended = true;
    } else if (/^#EXT-X-(?:KEY|MAP|BYTERANGE|GAP|STREAM-INF|I-FRAMES-ONLY|PART|SKIP)(?::|$)/.test(line)) {
      return null; // The Gateway currently produces complete, unencrypted TS segments only.
    } else if (!line.startsWith("#")) {
      if (ended || sequence === null || duration === null || !segmentName.test(line) || names.has(line)) return null;
      if (!Number.isSafeInteger(sequence)) return null;
      names.add(line);
      segments.push({ name: line, sequence: sequence++, discontinuity, duration_seconds: duration });
      duration = null;
    }
  }
  if (duration !== null || !segments.length) return null;
  return { stream_id: streamId, ended, segments };
}

export function planEventClipWindow({ playlistText, streamId, sourceGeneration, anchor, recordingRequired, beforeSeconds = 3, afterSeconds = 5 }) {
  if (recordingRequired !== true) return { status: "not_required" };
  if (![beforeSeconds, afterSeconds].every(value => Number.isFinite(value) && value >= 0 && value <= 15)
    || beforeSeconds + afterSeconds <= 0) return unavailable("window_invalid");
  if (typeof sourceGeneration !== "string" || !sourceGeneration || !anchor || anchor.source_generation !== sourceGeneration
    || anchor.stream_id !== streamId || !Number.isSafeInteger(anchor.sequence) || anchor.sequence < 0
    || !Number.isSafeInteger(anchor.discontinuity) || anchor.discontinuity < 0
    || !Number.isFinite(anchor.offset_seconds) || anchor.offset_seconds < 0) return unavailable("anchor_invalid");
  const playlist = parseEventClipPlaylist(playlistText, streamId);
  if (!playlist) return unavailable("playlist_invalid");
  const index = playlist.segments.findIndex(segment => segment.sequence === anchor.sequence && segment.discontinuity === anchor.discontinuity);
  if (index < 0) return unavailable("anchor_missing");
  if (anchor.offset_seconds >= playlist.segments[index].duration_seconds) return unavailable("anchor_invalid");

  // Use actual media durations, never mtime, request time, or assumed 1s chunks.
  let start = index, prebuffer = anchor.offset_seconds;
  while (prebuffer < beforeSeconds && start > 0) {
    const previous = playlist.segments[start - 1];
    if (previous.discontinuity !== anchor.discontinuity) return unavailable("timeline_discontinuous");
    start--;
    prebuffer += previous.duration_seconds;
  }
  if (prebuffer < beforeSeconds) return unavailable("prebuffer_missing");
  let end = index, postbuffer = playlist.segments[index].duration_seconds - anchor.offset_seconds;
  while (postbuffer < afterSeconds && end + 1 < playlist.segments.length) {
    const next = playlist.segments[end + 1];
    if (next.discontinuity !== anchor.discontinuity) return unavailable("timeline_discontinuous");
    end++;
    postbuffer += next.duration_seconds;
  }
  if (postbuffer < afterSeconds) return playlist.ended ? unavailable("postbuffer_missing") : { status: "awaiting_future", reason: "postbuffer_pending" };
  return {
    status: "ready", stream_id: streamId, source_generation: sourceGeneration, anchor_sequence: anchor.sequence,
    segments: playlist.segments.slice(start, end + 1).map(segment => ({ ...segment })),
    trim_start_seconds: prebuffer - beforeSeconds, duration_seconds: beforeSeconds + afterSeconds,
    event_offset_seconds: beforeSeconds, source_discontinuity: anchor.discontinuity
  };
}

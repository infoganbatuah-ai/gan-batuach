const SEGMENT_LINE = /^segment-(\d+)\.ts$/;
const MEDIA_SEQUENCE_LINE = /^#EXT-X-MEDIA-SEQUENCE:(\d+)$/;

// The Home recorder permits one productive response per channel. Its measured
// exclusive renewal takes a little over four seconds before the replacement
// publishes media. Keep Product viewers six target durations behind the live
// edge so the already-bounded twelve-segment ring can bridge that source-side
// handoff without relaxing source freshness or ownership gates.
export const HLS_PLAYBACK_HOLDBACK_SEGMENTS = 6;

export function summarizeRelayAvailability(relayContinuity) {
  if (!Array.isArray(relayContinuity))
    throw new Error("RELAY_AVAILABILITY_INPUT_INVALID");
  const states = relayContinuity.map(entry => Array.isArray(entry) ? entry[1] : entry);
  if (states.some(state => !state || typeof state !== "object"))
    throw new Error("RELAY_AVAILABILITY_INPUT_INVALID");
  return {
    progressingRelays: states.filter(state => state.progressing === true).length,
    renewingRelays: states.filter(state => state.renewing === true).length,
    // A source can have new media and still be inside its renewal handoff for
    // one sample. It is one available source, not two available cameras.
    availableRelays: states.filter(state =>
      state.progressing === true || state.renewing === true).length,
    stalledRelays: states.filter(state =>
      state.progressing !== true && state.renewing !== true).length,
  };
}

export function inspectHlsPlaybackPlaylist(playlist) {
  const lines = String(playlist || "").split(/\r?\n/);
  const mediaSequence = Number(MEDIA_SEQUENCE_LINE.exec(
    lines.find(line => MEDIA_SEQUENCE_LINE.test(line)) || "")?.[1]);
  const segments = lines.map(line => SEGMENT_LINE.exec(line)?.[1])
    .filter(value => value !== undefined).map(Number);
  if (!Number.isSafeInteger(mediaSequence) || mediaSequence < 0 || !segments.length ||
    segments.some(sequence => !Number.isSafeInteger(sequence) || sequence < 0)) return null;
  return { mediaSequence, segmentCount: segments.length,
    lastSequence: mediaSequence + segments.length - 1 };
}

export function nextHlsPlaybackOffset(inspected, {
  currentOffset = 0,
  lastExternalFirstSequence = -1,
  lastExternalLastSequence = -1,
  generationChanged = false
} = {}) {
  if (!inspected || !Number.isSafeInteger(inspected.mediaSequence) ||
    !Number.isSafeInteger(inspected.lastSequence) || inspected.mediaSequence < 0 ||
    inspected.lastSequence < inspected.mediaSequence ||
    !Number.isSafeInteger(currentOffset) || currentOffset < 0 ||
    !Number.isSafeInteger(lastExternalFirstSequence) ||
    !Number.isSafeInteger(lastExternalLastSequence))
    throw new Error("HLS_PLAYBACK_PROJECTION_STATE_INVALID");
  if (!generationChanged) return currentOffset;
  return Math.max(currentOffset, 0,
    lastExternalFirstSequence - inspected.mediaSequence,
    lastExternalLastSequence + 1 - inspected.lastSequence);
}

export function projectHlsPlaybackPlaylist(playlist, { offset = 0, generation,
  revision = 0, token, holdbackSegments = HLS_PLAYBACK_HOLDBACK_SEGMENTS }) {
  if (!Number.isSafeInteger(offset) || offset < 0 ||
    !/^[a-f0-9-]{36}$/i.test(generation || "") ||
    !Number.isSafeInteger(revision) || revision < 0 || !token ||
    !Number.isSafeInteger(holdbackSegments) || holdbackSegments < 1)
    throw new Error("HLS_PLAYBACK_PROJECTION_INVALID");
  const inspected = inspectHlsPlaybackPlaylist(playlist);
  if (!inspected || inspected.lastSequence + offset > Number.MAX_SAFE_INTEGER)
    throw new Error("HLS_PLAYBACK_PLAYLIST_INVALID");
  const query = `generation=${encodeURIComponent(generation)}&revision=${revision}` +
    `&token=${encodeURIComponent(token)}`;
  const start = `#EXT-X-START:TIME-OFFSET=-${holdbackSegments},PRECISE=YES`;
  const withHoldback = /^#EXT-X-START:/m.test(String(playlist))
    ? String(playlist).replace(/^#EXT-X-START:.*$/m, start)
    : String(playlist).replace(/^#EXTM3U$/m, `#EXTM3U\n${start}`);
  return {
    playlist: withHoldback
      .replace(/^#EXT-X-MEDIA-SEQUENCE:(\d+)$/m,
        `#EXT-X-MEDIA-SEQUENCE:${inspected.mediaSequence + offset}`)
      .replace(/^(segment-\d+\.ts)$/gm, `$1?${query}`),
    firstSequence: inspected.mediaSequence + offset,
    lastSequence: inspected.lastSequence + offset,
    actualLastSequence: inspected.lastSequence
  };
}

const SEGMENT_LINE = /^segment-(\d+)\.ts$/;
const MEDIA_SEQUENCE_LINE = /^#EXT-X-MEDIA-SEQUENCE:(\d+)$/;

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

export function projectHlsPlaybackPlaylist(playlist, { offset = 0, generation,
  revision = 0, token }) {
  if (!Number.isSafeInteger(offset) || offset < 0 ||
    !/^[a-f0-9-]{36}$/i.test(generation || "") ||
    !Number.isSafeInteger(revision) || revision < 0 || !token)
    throw new Error("HLS_PLAYBACK_PROJECTION_INVALID");
  const inspected = inspectHlsPlaybackPlaylist(playlist);
  if (!inspected || inspected.lastSequence + offset > Number.MAX_SAFE_INTEGER)
    throw new Error("HLS_PLAYBACK_PLAYLIST_INVALID");
  const query = `generation=${encodeURIComponent(generation)}&revision=${revision}` +
    `&token=${encodeURIComponent(token)}`;
  return {
    playlist: String(playlist)
      .replace(/^#EXT-X-MEDIA-SEQUENCE:(\d+)$/m,
        `#EXT-X-MEDIA-SEQUENCE:${inspected.mediaSequence + offset}`)
      .replace(/^(segment-\d+\.ts)$/gm, `$1?${query}`),
    firstSequence: inspected.mediaSequence + offset,
    lastSequence: inspected.lastSequence + offset,
    actualLastSequence: inspected.lastSequence
  };
}

import { playbackIngressAllows } from "./playback-ingress.mjs";

export const PUSH38_R2_ACCOUNT_ID = "693f824a750afcc264fe6ee58c8a86ab";
export const PUSH38_R2_BUCKET = "digital-observer-releases";
export const PUSH38_R2_ORIGIN = `https://${PUSH38_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const sessionPattern = /^[A-Za-z0-9_-]{22}$/;

export function push38R2MediaPrefix(sessionId) {
  if (!sessionPattern.test(sessionId || "")) throw new Error("P38_R2_MEDIA_SESSION_INVALID");
  return `home-qa-media/${sessionId}`;
}

export function assertPush38R2MediaCapability(raw, sessionId) {
  const value = new URL(String(raw || ""));
  const prefix = `/${PUSH38_R2_BUCKET}/${push38R2MediaPrefix(sessionId)}/`;
  const keys = [...value.searchParams.keys()];
  if (value.origin !== PUSH38_R2_ORIGIN || value.username || value.password || value.hash ||
    !value.pathname.startsWith(prefix) || !value.pathname.endsWith("/index.m3u8") ||
    value.searchParams.get("X-Amz-Algorithm") !== "AWS4-HMAC-SHA256" ||
    !value.searchParams.has("X-Amz-Credential") || !value.searchParams.has("X-Amz-Date") ||
    !/^[0-9a-f]{64}$/.test(value.searchParams.get("X-Amz-Signature") || "") ||
    !/^(?:[1-9]\d{0,3})$/.test(value.searchParams.get("X-Amz-Expires") || "") ||
    Number(value.searchParams.get("X-Amz-Expires")) > 1200 ||
    keys.some(key => !["X-Amz-Algorithm", "X-Amz-Content-Sha256", "X-Amz-Credential", "X-Amz-Date",
      "X-Amz-Expires", "X-Amz-Security-Token", "X-Amz-SignedHeaders", "X-Amz-Signature",
      "x-amz-checksum-mode", "x-id"].includes(key)))
    throw new Error("P38_R2_MEDIA_CAPABILITY_INVALID");
  return value;
}

export function parsePush38HlsSnapshot(text, rawPlaylistUrl) {
  const playlistUrl = new URL(rawPlaylistUrl);
  const lines = String(text || "").split(/\r?\n/);
  if (lines[0] !== "#EXTM3U" || lines.some(line => /^#EXT-X-(?:KEY|MAP|MEDIA|I-FRAME-STREAM-INF|PART|PRELOAD-HINT):/.test(line)))
    throw new Error("P38_R2_MEDIA_PLAYLIST_UNSUPPORTED");
  const segments = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.startsWith("#")) continue;
    const segment = new URL(line, playlistUrl);
    if (segment.origin !== playlistUrl.origin || segment.username || segment.password || segment.hash ||
      !playbackIngressAllows("GET", segment.pathname, segment.search))
      throw new Error("P38_R2_MEDIA_SEGMENT_SCOPE_INVALID");
    segments.push({ index, url: segment });
  }
  if (segments.length < 2 || segments.length > 12)
    throw new Error("P38_R2_MEDIA_SEGMENT_COUNT_INVALID");
  return { lines, segments };
}

export function buildPush38HlsSnapshot(parsed, signedUrls) {
  if (!parsed || !Array.isArray(parsed.lines) || !Array.isArray(parsed.segments) ||
    !Array.isArray(signedUrls) || signedUrls.length !== parsed.segments.length)
    throw new Error("P38_R2_MEDIA_SNAPSHOT_INPUT_INVALID");
  const byIndex = new Map(parsed.segments.map((segment, index) => [segment.index, signedUrls[index]]));
  const output = parsed.lines.filter(line => line !== "#EXT-X-ENDLIST");
  for (const [index, value] of byIndex) output[index] = String(value);
  if (!output.includes("#EXT-X-PLAYLIST-TYPE:VOD")) output.splice(1, 0, "#EXT-X-PLAYLIST-TYPE:VOD");
  while (!output.at(-1)) output.pop();
  output.push("#EXT-X-ENDLIST", "");
  return output.join("\n");
}

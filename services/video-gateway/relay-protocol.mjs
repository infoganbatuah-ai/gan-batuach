export const RELAY_ORIGIN = "https://video-relay.ganbatuach.com";
export const CLOUD_ORIGIN = "https://gan-batuach.vercel.app";
export const BROWSER_ORIGINS = new Set(["https://gan-batuach.vercel.app", "https://ganbatuach.com", "https://www.ganbatuach.com"]);
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const SESSION_TTL_MS = 120_000;
export const ASSET = /^(index\.m3u8|segment-\d{1,12}\.ts)$/;

export function sanitizePlaylist(text, token) {
  if (text.length > 32_768 || !text.startsWith("#EXTM3U\n")) throw new Error("invalid_playlist");
  return text.split("\n").map((line) => {
    const value = line.trim();
    if (!value) return "";
    if (/^segment-\d{1,12}\.ts$/.test(value)) return `${value}?token=${encodeURIComponent(token)}`;
    if (/^#(?:EXTM3U|EXT-X-(?:INDEPENDENT-SEGMENTS|ENDLIST|DISCONTINUITY))$/.test(value)
      || /^#EXT-X-(?:VERSION|TARGETDURATION|MEDIA-SEQUENCE|DISCONTINUITY-SEQUENCE):\d+$/.test(value)
      || /^#EXTINF:\d+(?:\.\d+)?,?$/.test(value)) return value;
    throw new Error("unsafe_playlist_reference");
  }).join("\n");
}

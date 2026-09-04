export const MAX_PROBE_OUTPUT_BYTES = 20000;

export function parseProbeResult(output) {
  if (typeof output !== "string" || !output.trim()) return { ok: false, reason: "invalid_probe_response" };
  if (Buffer.byteLength(output, "utf8") > MAX_PROBE_OUTPUT_BYTES) return { ok: false, reason: "probe_response_too_large" };
  try {
    const parsed = JSON.parse(output);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || !Array.isArray(parsed.streams)) {
      return { ok: false, reason: "invalid_probe_response" };
    }
    const video = parsed.streams.find(item => item?.codec_type === "video");
    const audio = parsed.streams.find(item => item?.codec_type === "audio");
    return {
      ok: Boolean(video), reason: video ? "video_stream_found" : "no_video_stream",
      audio: Boolean(audio), audio_codec: audio?.codec_name ?? null,
      width: video?.width ?? null, height: video?.height ?? null
    };
  } catch {
    return { ok: false, reason: "invalid_probe_response" };
  }
}

const SAFE_INPUT_CODES = new Set(["UND_ERR_SOCKET", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "EPIPE"]);

export function safeInputCode(error) {
  const code = error?.cause?.code || error?.code;
  return SAFE_INPUT_CODES.has(code) ? code : "OTHER_TRANSPORT_ERROR";
}

export function classifyRelayExit({ stopReason, inputErrorCode, stderr = "", code,
  sustainedMedia = false, responseRetirementEligible = false } = {}) {
  if (stopReason) return stopReason;
  if (/network is unreachable/i.test(stderr)) return "HOST_NETWORK_UNREACHABLE";
  if (/connection refused/i.test(stderr)) return "SOURCE_CONNECTION_REFUSED";
  if (/(?:401|403|unauthorized)/i.test(stderr)) return "SOURCE_AUTH_REJECTED";
  if (/timed? out/i.test(stderr)) return "SOURCE_TIMEOUT";
  // A zero decoder exit means the complete native response was consumed.
  // Undici can still surface the recorder's response-boundary socket close
  // while ffmpeg exits successfully; that boundary is not a failed transport.
  if (code === 0) return "SOURCE_STREAM_ENDED";
  // The owned recorder also retires a long-running HTTP-MP4 response by
  // closing its socket. This label is intentionally available only after a
  // sustained media window; a startup/network socket error remains transport.
  // A new login is still gated on the subsequent exact-channel reopen being
  // rejected as non-media, so this signal alone never rotates a session.
  if (inputErrorCode === "UND_ERR_SOCKET" && sustainedMedia)
    return "SOURCE_RESPONSE_RETIRED";
  // The owned recorder also uses ECONNRESET after a sustained media response.
  // This label is only phase one of a two-step proof: the Gateway first retries
  // the exact channel with the same login, and rotates only if that reopen is
  // rejected as non-media. A recoverable transport reset therefore reuses the
  // login and cannot rotate shared authentication.
  if (inputErrorCode === "ECONNRESET" && sustainedMedia
    && responseRetirementEligible) return "SOURCE_RESPONSE_RETIRED";
  if (inputErrorCode) return `UPSTREAM_${inputErrorCode}`;
  return "DECODER_OR_RELAY_EXIT";
}

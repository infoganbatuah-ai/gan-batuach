const SAFE_INPUT_CODES = new Set(["UND_ERR_SOCKET", "ECONNRESET", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "EPIPE"]);

export function safeInputCode(error) {
  const code = error?.cause?.code || error?.code;
  return SAFE_INPUT_CODES.has(code) ? code : "OTHER_TRANSPORT_ERROR";
}

export function classifyRelayExit({ stopReason, inputErrorCode, stderr = "", code } = {}) {
  if (stopReason) return stopReason;
  if (/network is unreachable/i.test(stderr)) return "HOST_NETWORK_UNREACHABLE";
  if (/connection refused/i.test(stderr)) return "SOURCE_CONNECTION_REFUSED";
  if (/(?:401|403|unauthorized)/i.test(stderr)) return "SOURCE_AUTH_REJECTED";
  if (/timed? out/i.test(stderr)) return "SOURCE_TIMEOUT";
  if (inputErrorCode) return `UPSTREAM_${inputErrorCode}`;
  return code === 0 ? "SOURCE_STREAM_ENDED" : "DECODER_OR_RELAY_EXIT";
}

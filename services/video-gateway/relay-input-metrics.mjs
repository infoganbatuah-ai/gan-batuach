// Retain only a format hint and counters, never source bytes or addresses.
export function createRelayInputMetrics(now = Date.now) {
  const started = now();
  let bytes = 0, chunks = 0, lastAt = null, prefix = Buffer.alloc(0), format = "pending";
  return {
    observe(value) {
      bytes += value.byteLength;
      chunks += 1;
      lastAt = now();
      if (format !== "pending") return;
      prefix = Buffer.concat([prefix, value.subarray(0, Math.max(0, 16 - prefix.length))]);
      if (prefix.length < 16) return;
      const box = prefix.toString("ascii", 4, 8);
      format = ["ftyp", "moov", "moof", "styp"].includes(box) ? "isobmff"
        : prefix.readUInt32BE(0) === 0x000001ba ? "mpeg_ps"
        : prefix[0] === 0x47 ? "mpeg_ts_candidate"
        : prefix.subarray(0, 4).equals(Buffer.from([0, 0, 0, 1]))
          || prefix.subarray(0, 3).equals(Buffer.from([0, 0, 1])) ? "annex_b_candidate"
        : "unrecognized";
      prefix.fill(0);
      prefix = Buffer.alloc(0);
    },
    snapshot() {
      return { format, bytes, chunks, age_ms: Math.max(0, now() - started), input_idle_ms: lastAt === null ? null : Math.max(0, now() - lastAt) };
    }
  };
}

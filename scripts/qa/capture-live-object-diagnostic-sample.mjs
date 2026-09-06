#!/usr/bin/env node
/**
 * Captures a bounded, local-only set of distinct relay segments for detector
 * diagnostics. Segments are copied from the local HLS ring buffer only after
 * the Gateway has decoded them for an authenticated object-sample request.
 * The caller is responsible for securely deleting the returned directory.
 */
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const streamId = process.env.OBSERVER_DIAGNOSTIC_STREAM_ID || "dvr_84e4cdf200faab18d9_11";
const secondsIndex = process.argv.indexOf("--seconds");
const seconds = secondsIndex >= 0 ? Number(process.argv[secondsIndex + 1]) : 60;
if (!Number.isFinite(seconds) || seconds < 20 || seconds > 90) throw new Error("invalid_duration");
const outputDirectory = join(tmpdir(), `observer-live-detector-${Date.now()}`);
const relayDirectory = join(tmpdir(), "gan-batuach-video-gateway-hls", streamId.replace(/[^a-z0-9_-]/gi, "_"));
const service = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";
const secret = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-a", "gateway_signing_secret", "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
if (!secret) throw new Error("gateway_auth_unavailable");
await mkdir(outputDirectory, { recursive: true, mode: 0o700 });

const startedAt = new Date();
const deadline = Date.now() + seconds * 1000;
const seen = new Set();
const records = [];
while (Date.now() < deadline && records.length < 50) {
  const requestStarted = Date.now();
  try {
    const response = await fetch(`http://127.0.0.1:18082/camera/${encodeURIComponent(streamId)}/detections`, {
      headers: { "x-video-gateway-secret": secret }, signal: AbortSignal.timeout(12_000)
    });
    const body = await response.json().catch(() => ({}));
    const insight = body?.insight;
    const anchor = insight?.source_anchor;
    const sequence = Number(anchor?.sequence);
    if (response.ok && Number.isInteger(sequence) && sequence >= 0 && !seen.has(sequence)) {
      const source = join(relayDirectory, `segment-${String(sequence).padStart(6, "0")}.ts`);
      const destination = join(outputDirectory, `segment-${String(sequence).padStart(6, "0")}.ts`);
      try {
        const details = await stat(source);
        if (details.isFile() && details.size > 0 && details.size < 8 * 1024 * 1024) {
          await copyFile(source, destination);
          seen.add(sequence);
          records.push({ sequence, observed_at: anchor.observed_at, offset_seconds: anchor.offset_seconds, request_latency_ms: Date.now() - requestStarted,
            gateway_person_detections: (insight?.object_detection?.detections || []).filter(item => item?.label === "person").map(item => ({ confidence: item.confidence, box: item.box })) });
        }
      } catch { /* Ring-buffer rollover is expected; try the next distinct source frame. */ }
    }
  } catch { /* A transient local queue miss must not end the controlled window. */ }
  const remaining = deadline - Date.now();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(950, remaining)));
}
process.stdout.write(`${JSON.stringify({
  status: "complete", stream_id: streamId, started_at: startedAt.toISOString(), ended_at: new Date().toISOString(),
  requested_seconds: seconds, distinct_segments_copied: records.length, temporary_directory: outputDirectory, records
}, null, 2)}\n`);

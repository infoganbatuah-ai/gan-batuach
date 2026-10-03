import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { setDefaultResultOrder } from "node:dns";
import { createReadStream, lstatSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { open } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand,
  GetObjectCommand, HeadObjectCommand, S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "../../services/video-gateway/edge-release-object.mjs";
import { buildPush38GatewayFiniteStreamHandoffManifest } from "../../services/video-gateway/push38-home-qa-gateway-finite-stream-handoff.mjs";
import { buildPush38GatewaySupervisorRecoveryManifest } from "../../services/video-gateway/push38-home-qa-gateway-supervisor-recovery.mjs";
import { buildPush38GatewayStableHandoffManifest } from "../../services/video-gateway/push38-home-qa-gateway-stable-handoff.mjs";
import { buildPush38GatewayMediaCadenceManifest } from "../../services/video-gateway/push38-home-qa-gateway-media-cadence.mjs";
import { buildPush38GatewayMaintenanceIsolationManifest } from "../../services/video-gateway/push38-home-qa-gateway-maintenance-isolation.mjs";
import { buildPush38GatewaySessionSweepManifest } from "../../services/video-gateway/push38-home-qa-gateway-session-sweep.mjs";
import { buildPush38GatewayHeartbeatLoginManifest } from "../../services/video-gateway/push38-home-qa-gateway-heartbeat-login.mjs";
import { buildPush38GatewayIdleHandoffManifest } from "../../services/video-gateway/push38-home-qa-gateway-idle-handoff.mjs";
import { buildPush38GatewayBufferedOutputManifest } from "../../services/video-gateway/push38-home-qa-gateway-buffered-output.mjs";
import { buildPush38GatewayOutputRescueManifest } from "../../services/video-gateway/push38-home-qa-gateway-output-rescue.mjs";
import { buildPush38GatewayConfirmedHandoffManifest } from "../../services/video-gateway/push38-home-qa-gateway-confirmed-handoff.mjs";
import { buildPush38GatewayStartupWindowManifest } from "../../services/video-gateway/push38-home-qa-gateway-startup-window.mjs";
import { buildPush38GatewayHandoffProbationManifest } from "../../services/video-gateway/push38-home-qa-gateway-handoff-probation.mjs";
import { buildPush38GatewayRetainedFallbackManifest } from "../../services/video-gateway/push38-home-qa-gateway-retained-fallback.mjs";
import { buildPush38GatewayContinuousHandoffManifest } from "../../services/video-gateway/push38-home-qa-gateway-continuous-handoff.mjs";
import { buildPush38GatewayRoutineProvisionalManifest } from "../../services/video-gateway/push38-home-qa-gateway-routine-provisional.mjs";
import { buildPush38GatewayProbationBudgetManifest } from "../../services/video-gateway/push38-home-qa-gateway-probation-budget.mjs";
import { buildPush38GatewayRescueCapacityManifest } from "../../services/video-gateway/push38-home-qa-gateway-rescue-capacity.mjs";
import { buildPush38GatewayCodecPreservationManifest } from "../../services/video-gateway/push38-home-qa-gateway-codec-preservation.mjs";
import { buildPush38GatewayHandoffHardwareManifest } from "../../services/video-gateway/push38-home-qa-gateway-handoff-hardware.mjs";
import { buildPush38GatewayRelayHandoffRemediationManifest } from "../../services/video-gateway/push38-home-qa-gateway-relay-handoff-remediation.mjs";
import { buildPush38GatewayHandoffContinuityManifest } from "../../services/video-gateway/push38-home-qa-gateway-handoff-continuity.mjs";
import { buildPush38GatewayHandoffOwnerContinuityManifest } from "../../services/video-gateway/push38-home-qa-gateway-handoff-owner-continuity.mjs";
import { buildPush38GatewaySweepDeadlineManifest } from "../../services/video-gateway/push38-home-qa-gateway-sweep-deadline.mjs";
import { buildPush38GatewayDeadlineBudgetManifest } from "../../services/video-gateway/push38-home-qa-gateway-deadline-budget.mjs";
import { buildPush38GatewayRecoveryContinuityManifest } from "../../services/video-gateway/push38-home-qa-gateway-recovery-continuity.mjs";
import { buildPush38GatewayRoutineConfirmationManifest } from "../../services/video-gateway/push38-home-qa-gateway-routine-confirmation.mjs";
import { buildPush38GatewaySessionRenewalContinuityManifest } from "../../services/video-gateway/push38-home-qa-gateway-session-renewal-continuity.mjs";
import { buildPush38GatewayProactiveExclusiveRenewalManifest } from "../../services/video-gateway/push38-home-qa-gateway-proactive-exclusive-renewal.mjs";
import { readR2KeychainCredentials } from "./macos-r2-keychain.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const restrictedRoot = resolve(process.env.OBSERVER_RESTRICTED_EXPORT_ROOT ||
  fileURLToPath(new URL("../../exports/restricted/", import.meta.url)));
const multipartPartSize = 5 * 1024 * 1024;
// The measured Home QA IPv6 path stalls large R2 uploads; keep this publisher on
// the verified IPv4 path without changing any Product/runtime network behavior.
setDefaultResultOrder("ipv4first");
const fail = code => { throw new Error(code); };
async function hashStream(stream, limit) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) fail("P38_GATEWAY_FINITE_HANDOFF_R2_SIZE_LIMIT");
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), size };
}

async function headObjectOrNull(client, bucket, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || error.name === "NotFound") return null;
    throw error;
  }
}

async function uploadMultipart({ client, bucket, key, path, size, sha256, releaseId }) {
  let created;
  try {
    created = await client.send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key,
      ContentType: "application/gzip", StorageClass: "STANDARD",
      Metadata: { sha256, release_id: releaseId } }),
    { abortSignal: AbortSignal.timeout(60_000) });
  } catch { fail("P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_CREATE_REQUEST_FAILED"); }
  if (!created.UploadId) fail("P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_CREATE_FAILED");
  const uploadId = created.UploadId, parts = [];
  let handle;
  try {
    handle = await open(path, "r");
    for (let offset = 0, partNumber = 1; offset < size; offset += multipartPartSize, partNumber++) {
      const length = Math.min(multipartPartSize, size - offset), body = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(body, 0, length, offset);
      if (bytesRead !== length) fail("P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_READ_FAILED");
      const partDirectory = mkdtempSync(join(tmpdir(), "observer-p38-r2-part-"));
      const partPath = join(partDirectory, `part-${partNumber}.bin`);
      writeFileSync(partPath, body, { mode: 0o600, flag: "wx" });
      let etag = "";
      try {
        for (let attempt = 1; attempt <= 3 && !etag; attempt += 1) {
          try {
            const command = new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId,
              PartNumber: partNumber });
            const capability = await getSignedUrl(client, command, { expiresIn: 15 * 60 });
            if (partNumber === 1 && attempt === 1) {
              const scoped = new URL(capability);
              console.error(JSON.stringify({ stage: "multipart_capability_contract",
                query_keys: [...scoped.searchParams.keys()].sort(),
                signed_headers: scoped.searchParams.get("X-Amz-SignedHeaders") }));
            }
            const response = spawnSync("curl", ["--ipv4", "--silent", "--show-error", "--fail-with-body",
              "--header", "Expect:", "--upload-file", partPath, "--dump-header", "-", "--output", "-",
              "--max-time", "120", capability], { encoding: "utf8",
              maxBuffer: 64 * 1024, timeout: 125_000 });
            if (response.status !== 0)
              throw new Error(`CURL_${response.status ?? "UNKNOWN"}_${String(response.stdout || "")
                .match(/<Code>([^<]+)<\/Code>/)?.[1] ||
                String(response.stdout || "").match(/HTTP\/\S+\s+(\d{3})/)?.[1] ||
                "NO_PROVIDER_CODE"}_${String(response.stderr || "")
                .replace(/https?:\/\/\S+/g, "[redacted-url]").replace(/[^A-Za-z0-9_. -]/g, "_").slice(0, 120)}`);
            if (response.status === 0) {
              const matches = [...response.stdout.matchAll(/^etag:\s*(.+)$/gim)];
              etag = matches.at(-1)?.[1]?.trim() || "";
            }
          } catch (error) {
            if (attempt === 3) throw error;
          }
        }
        if (!etag) fail("P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_PART_FAILED");
      } catch (error) {
        console.error(JSON.stringify({ stage: "multipart_upload_part", part_number: partNumber,
          error_name: String(error?.name || "UNKNOWN").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64),
          error_code: String(error?.message || "UNKNOWN").replace(/[^A-Za-z0-9_. -]/g, "_").slice(0, 160),
          http_status: Number(error?.$metadata?.httpStatusCode) || null }));
        fail(`P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_PART_${partNumber}_REQUEST_FAILED`);
      } finally { rmSync(partDirectory, { recursive: true, force: true }); }
      parts.push({ ETag: etag, PartNumber: partNumber });
      console.error(JSON.stringify({ stage: "multipart_part_complete", part_number: partNumber,
        bytes: length }));
    }
    await handle.close(); handle = undefined;
    try {
      await client.send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId,
        MultipartUpload: { Parts: parts } }), { abortSignal: AbortSignal.timeout(180_000) });
    } catch { fail("P38_GATEWAY_FINITE_HANDOFF_R2_MULTIPART_COMPLETE_REQUEST_FAILED"); }
  } catch (error) {
    await handle?.close().catch(() => {});
    await client.send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
      { abortSignal: AbortSignal.timeout(30_000) }).catch(() => {});
    throw error;
  }
}

export async function publishPush38GatewayFiniteStreamHandoff({ artifactPath, evidencePath,
  supervisorRecovery = false, stableHandoff = false, mediaCadence = false,
  maintenanceIsolation = false, sessionSweep = false, heartbeatLogin = false,
  idleHandoff = false, bufferedOutput = false, outputRescue = false,
  confirmedHandoff = false, startupWindow = false, handoffProbation = false,
  retainedFallback = false, continuousHandoff = false, routineProvisional = false,
  probationBudget = false, rescueCapacity = false, codecPreservation = false,
  handoffHardware = false, relayHandoff = false, handoffContinuity = false,
  handoffOwnerContinuity = false, sweepDeadline = false, deadlineBudget = false,
  recoveryContinuity = false, routineConfirmation = false, sessionRenewal = false,
  proactiveExclusive = false }) {
  if ([supervisorRecovery, stableHandoff, mediaCadence, maintenanceIsolation, sessionSweep,
    heartbeatLogin, idleHandoff, bufferedOutput, outputRescue, confirmedHandoff, startupWindow,
    handoffProbation, retainedFallback, continuousHandoff, routineProvisional, probationBudget,
    rescueCapacity, codecPreservation, handoffHardware, relayHandoff, handoffContinuity,
    handoffOwnerContinuity, sweepDeadline, deadlineBudget, recoveryContinuity, routineConfirmation,
    sessionRenewal, proactiveExclusive]
    .filter(Boolean).length > 1)
    fail("P38_GATEWAY_FINITE_HANDOFF_R2_MODE_INVALID");
  const builder = proactiveExclusive ? buildPush38GatewayProactiveExclusiveRenewalManifest :
    sessionRenewal ? buildPush38GatewaySessionRenewalContinuityManifest :
    routineConfirmation ? buildPush38GatewayRoutineConfirmationManifest :
    recoveryContinuity ? buildPush38GatewayRecoveryContinuityManifest :
    deadlineBudget ? buildPush38GatewayDeadlineBudgetManifest :
    sweepDeadline ? buildPush38GatewaySweepDeadlineManifest :
    handoffOwnerContinuity ? buildPush38GatewayHandoffOwnerContinuityManifest :
    handoffContinuity ? buildPush38GatewayHandoffContinuityManifest :
    relayHandoff ? buildPush38GatewayRelayHandoffRemediationManifest :
    handoffHardware ? buildPush38GatewayHandoffHardwareManifest :
    codecPreservation ? buildPush38GatewayCodecPreservationManifest :
    rescueCapacity ? buildPush38GatewayRescueCapacityManifest :
    probationBudget ? buildPush38GatewayProbationBudgetManifest :
    routineProvisional ? buildPush38GatewayRoutineProvisionalManifest :
    continuousHandoff ? buildPush38GatewayContinuousHandoffManifest :
    retainedFallback ? buildPush38GatewayRetainedFallbackManifest :
    handoffProbation ? buildPush38GatewayHandoffProbationManifest :
    startupWindow ? buildPush38GatewayStartupWindowManifest :
    confirmedHandoff ? buildPush38GatewayConfirmedHandoffManifest :
    outputRescue ? buildPush38GatewayOutputRescueManifest :
    bufferedOutput ? buildPush38GatewayBufferedOutputManifest :
    idleHandoff ? buildPush38GatewayIdleHandoffManifest :
    heartbeatLogin ? buildPush38GatewayHeartbeatLoginManifest :
    sessionSweep ? buildPush38GatewaySessionSweepManifest :
    maintenanceIsolation ? buildPush38GatewayMaintenanceIsolationManifest :
    mediaCadence ? buildPush38GatewayMediaCadenceManifest :
    stableHandoff ? buildPush38GatewayStableHandoffManifest :
    supervisorRecovery ? buildPush38GatewaySupervisorRecoveryManifest :
    buildPush38GatewayFiniteStreamHandoffManifest;
  const { document } = builder({ signingKeyId: "observer-kms-release-v1",
    artifactOrigin: origin, releasedAt: new Date().toISOString() });
  const path = resolve(artifactPath), info = lstatSync(path), artifactRelative = relative(restrictedRoot, path);
  if (!artifactRelative || artifactRelative === ".." || artifactRelative.startsWith(`..${sep}`) ||
    isAbsolute(artifactRelative) || !info.isFile() || info.isSymbolicLink() || statSync(path).size !== document.artifact_size)
    fail("P38_GATEWAY_FINITE_HANDOFF_R2_LOCAL_ARTIFACT_INVALID");
  const local = await hashStream(createReadStream(path), document.artifact_size);
  if (local.sha256 !== document.artifact_sha256 || local.size !== document.artifact_size)
    fail("P38_GATEWAY_FINITE_HANDOFF_R2_LOCAL_ARTIFACT_HASH_MISMATCH");
  const key = edgeReleaseObjectPath(document), keychain = join(homedir(), "Library/Keychains/login.keychain-db");
  const readerService = process.env.OBSERVER_R2_READER_SERVICE ||
    "digital-observer-r2-home-qa-reader-20260922";
  if (!["digital-observer-r2-home-qa-reader-20260922",
    "digital-observer-r2-home-qa-publisher-20260922-v2"].includes(readerService))
    fail("P38_GATEWAY_FINITE_HANDOFF_R2_READER_SERVICE_INVALID");
  const clientOptions = { region: "auto", endpoint: origin, forcePathStyle: true,
    maxAttempts: 3, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" };
  const publisher = new S3Client({ ...clientOptions,
    credentials: readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-publisher-20260922-v2", keychain }) });
  const reader = new S3Client({ ...clientOptions,
    credentials: readR2KeychainCredentials({ service: readerService, keychain }) });
  try {
    const existing = await headObjectOrNull(reader, EDGE_RELEASE_R2_BUCKET, key);
    const uploaded = !existing;
    if (!existing) await uploadMultipart({ client: publisher, bucket: EDGE_RELEASE_R2_BUCKET, key, path,
      size: local.size, sha256: local.sha256, releaseId: document.release_id });
    const head = await reader.send(new HeadObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(30_000) });
    if (head.ContentLength !== local.size || head.Metadata?.sha256 !== local.sha256 ||
      head.Metadata?.release_id !== document.release_id)
      fail("P38_GATEWAY_FINITE_HANDOFF_R2_EXISTING_OBJECT_CONFLICT");
    const capability = await getSignedUrl(reader,
      new GetObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }), { expiresIn: 120 });
    const url = new URL(capability);
    if (url.origin !== origin || url.pathname !== `/${EDGE_RELEASE_R2_BUCKET}/${key}` ||
      url.searchParams.get("X-Amz-Expires") !== "120")
      fail("P38_GATEWAY_FINITE_HANDOFF_R2_CAPABILITY_SCOPE_INVALID");
    const response = await fetch(capability, { redirect: "error", signal: AbortSignal.timeout(600_000) });
    if (!response.ok || Number(response.headers.get("content-length")) !== local.size)
      fail("P38_GATEWAY_FINITE_HANDOFF_R2_DOWNLOAD_INVALID");
    const downloaded = await hashStream(response.body, local.size);
    if (downloaded.sha256 !== local.sha256 || downloaded.size !== local.size)
      fail("P38_GATEWAY_FINITE_HANDOFF_R2_ROUND_TRIP_MISMATCH");
    const anonymous = await fetch(`${origin}/${EDGE_RELEASE_R2_BUCKET}/${key}`, { redirect: "error",
      signal: AbortSignal.timeout(30_000) });
    await anonymous.body?.cancel();
    if (anonymous.ok) fail("P38_GATEWAY_FINITE_HANDOFF_R2_PUBLIC_ACCESS_ENABLED");
    const result = { protocol: proactiveExclusive ?
      "observer-push38-gateway-proactive-exclusive-renewal-r2-publication-v1" : sessionRenewal ?
      "observer-push38-gateway-session-renewal-continuity-r2-publication-v1" : routineConfirmation ?
      "observer-push38-gateway-routine-confirmation-r2-publication-v1" : recoveryContinuity ?
      "observer-push38-gateway-recovery-continuity-r2-publication-v1" : deadlineBudget ?
      "observer-push38-gateway-deadline-budget-r2-publication-v1" : sweepDeadline ?
      "observer-push38-gateway-sweep-deadline-r2-publication-v1" : handoffOwnerContinuity ?
      "observer-push38-gateway-handoff-owner-continuity-r2-publication-v1" : handoffContinuity ?
      "observer-push38-gateway-handoff-continuity-r2-publication-v1" : relayHandoff ?
      "observer-push38-gateway-relay-handoff-r2-publication-v1" : handoffHardware ?
      "observer-push38-gateway-handoff-hardware-r2-publication-v1" : codecPreservation ?
      "observer-push38-gateway-codec-preservation-r2-publication-v1" : rescueCapacity ?
      "observer-push38-gateway-rescue-capacity-r2-publication-v1" : probationBudget ?
      "observer-push38-gateway-probation-budget-r2-publication-v1" : routineProvisional ?
      "observer-push38-gateway-routine-provisional-r2-publication-v1" : continuousHandoff ?
      "observer-push38-gateway-continuous-handoff-r2-publication-v1" : retainedFallback ?
      "observer-push38-gateway-retained-fallback-r2-publication-v1" : handoffProbation ?
      "observer-push38-gateway-handoff-probation-r2-publication-v1" : startupWindow ?
      "observer-push38-gateway-startup-window-r2-publication-v1" : confirmedHandoff ?
      "observer-push38-gateway-confirmed-handoff-r2-publication-v1" : outputRescue ?
      "observer-push38-gateway-output-rescue-r2-publication-v1" : bufferedOutput ?
      "observer-push38-gateway-buffered-output-r2-publication-v1" : idleHandoff ?
      "observer-push38-gateway-idle-handoff-r2-publication-v1" : heartbeatLogin ?
      "observer-push38-gateway-heartbeat-login-r2-publication-v1" : sessionSweep ?
      "observer-push38-gateway-session-sweep-r2-publication-v1" : maintenanceIsolation ?
      "observer-push38-gateway-maintenance-isolation-r2-publication-v1" : mediaCadence ?
      "observer-push38-gateway-media-cadence-r2-publication-v1" : stableHandoff ?
      "observer-push38-gateway-stable-handoff-r2-publication-v1" : supervisorRecovery ?
      "observer-push38-gateway-supervisor-recovery-r2-publication-v1" :
      "observer-push38-gateway-finite-stream-handoff-r2-publication-v1",
      at: new Date().toISOString(), bucket: EDGE_RELEASE_R2_BUCKET, storage_class: "STANDARD",
      release_id: document.release_id, object_key: key, artifact_sha256: local.sha256,
      bytes: local.size, uploaded, round_trip: "PASS", anonymous_access_denied: true,
      runtime_activation: false };
    writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    return result;
  } finally { publisher.destroy(); reader.destroy(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const supervisorRecovery = process.argv.includes("--supervisor-recovery");
    const stableHandoff = process.argv.includes("--stable-handoff");
    const mediaCadence = process.argv.includes("--media-cadence");
    const maintenanceIsolation = process.argv.includes("--maintenance-isolation");
    const sessionSweep = process.argv.includes("--session-sweep");
    const heartbeatLogin = process.argv.includes("--heartbeat-login");
    const idleHandoff = process.argv.includes("--idle-handoff");
    const bufferedOutput = process.argv.includes("--buffered-output");
    const outputRescue = process.argv.includes("--output-rescue");
    const confirmedHandoff = process.argv.includes("--confirmed-handoff");
    const startupWindow = process.argv.includes("--startup-window");
    const handoffProbation = process.argv.includes("--handoff-probation");
    const retainedFallback = process.argv.includes("--retained-fallback");
    const continuousHandoff = process.argv.includes("--continuous-handoff");
    const routineProvisional = process.argv.includes("--routine-provisional");
    const probationBudget = process.argv.includes("--probation-budget");
    const rescueCapacity = process.argv.includes("--rescue-capacity");
    const codecPreservation = process.argv.includes("--gateway-codec-preservation");
    const handoffHardware = process.argv.includes("--gateway-handoff-hardware");
    const relayHandoff = process.argv.includes("--gateway-relay-handoff");
    const handoffContinuity = process.argv.includes("--gateway-handoff-continuity");
    const handoffOwnerContinuity = process.argv.includes("--gateway-handoff-owner-continuity");
    const sweepDeadline = process.argv.includes("--gateway-sweep-deadline");
    const deadlineBudget = process.argv.includes("--gateway-deadline-budget");
    const recoveryContinuity = process.argv.includes("--gateway-recovery-continuity");
    const routineConfirmation = process.argv.includes("--gateway-routine-confirmation");
    const sessionRenewal = process.argv.includes("--gateway-session-renewal");
    const proactiveExclusive = process.argv.includes("--gateway-proactive-exclusive");
    const [artifact, evidence] = process.argv.slice(2)
      .filter(value => !["--supervisor-recovery", "--stable-handoff", "--media-cadence",
        "--maintenance-isolation", "--session-sweep", "--heartbeat-login",
        "--idle-handoff", "--buffered-output", "--output-rescue", "--confirmed-handoff",
        "--startup-window", "--handoff-probation", "--retained-fallback", "--continuous-handoff",
        "--routine-provisional", "--probation-budget", "--rescue-capacity",
        "--gateway-codec-preservation", "--gateway-handoff-hardware",
        "--gateway-relay-handoff", "--gateway-handoff-continuity",
        "--gateway-handoff-owner-continuity", "--gateway-sweep-deadline",
        "--gateway-deadline-budget", "--gateway-recovery-continuity",
        "--gateway-routine-confirmation", "--gateway-session-renewal",
        "--gateway-proactive-exclusive"]
        .includes(value));
    const scoped = evidence ? relative(restrictedRoot, resolve(evidence)) : "";
    if (!artifact || !evidence || !scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped))
      fail("P38_GATEWAY_FINITE_HANDOFF_R2_INPUT_SCOPE_INVALID");
    console.log(JSON.stringify({ result: "PASS", publication: await publishPush38GatewayFiniteStreamHandoff({
      artifactPath: artifact, evidencePath: resolve(evidence), supervisorRecovery, stableHandoff,
      mediaCadence, maintenanceIsolation, sessionSweep, heartbeatLogin, idleHandoff,
      bufferedOutput, outputRescue, confirmedHandoff, startupWindow, handoffProbation,
      retainedFallback, continuousHandoff, routineProvisional, probationBudget, rescueCapacity,
      codecPreservation, handoffHardware, relayHandoff, handoffContinuity,
      handoffOwnerContinuity, sweepDeadline, deadlineBudget, recoveryContinuity,
      routineConfirmation, sessionRenewal, proactiveExclusive }) }));
  } catch (error) {
    console.error(/^P38_GATEWAY_FINITE_HANDOFF_R2_[A-Z0-9_]+$/.test(error.message) ? error.message :
      "P38_GATEWAY_FINITE_HANDOFF_R2_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import { createReadStream, lstatSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "../../services/video-gateway/edge-release-object.mjs";
import { buildPush38ConnectorPidfixManifest } from "../../services/video-gateway/push38-home-qa-connector-pidfix.mjs";
import { buildPush38ConnectorRecoveryManifest } from "../../services/video-gateway/push38-home-qa-connector-recovery.mjs";
import { buildPush38ConnectorStartupRecoveryManifest } from "../../services/video-gateway/push38-home-qa-connector-startup.mjs";
import { buildPush38ConnectorLivenessRecoveryManifest } from "../../services/video-gateway/push38-home-qa-connector-liveness.mjs";
import { buildPush38ConnectorParentExitRecoveryManifest } from "../../services/video-gateway/push38-home-qa-connector-parent-exit.mjs";
import { buildPush38ConnectorRtspSessionRecoveryManifest } from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";
import { readR2KeychainCredentials } from "./macos-r2-keychain.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
// A worktree may intentionally use the canonical restricted export store from
// the project root. Keep that location explicit at invocation time rather than
// encoding one developer machine path in the release tool.
const restrictedRoot = resolve(process.env.OBSERVER_RESTRICTED_EXPORT_ROOT ||
  fileURLToPath(new URL("../../exports/restricted/", import.meta.url)));
const fail = code => { throw new Error(code); };
async function hashStream(stream, limit) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of stream) { size += chunk.length; if (size > limit) fail("P38_PIDFIX_R2_SIZE_LIMIT"); hash.update(chunk); }
  return { sha256: hash.digest("hex"), size };
}

async function publish({ artifactPath, evidencePath, recovery = false, startupRecovery = false,
  livenessRecovery = false, parentExitRecovery = false, rtspSessionRecovery = false }) {
  const builder = rtspSessionRecovery ? buildPush38ConnectorRtspSessionRecoveryManifest :
    parentExitRecovery ? buildPush38ConnectorParentExitRecoveryManifest :
    livenessRecovery ? buildPush38ConnectorLivenessRecoveryManifest :
    startupRecovery ? buildPush38ConnectorStartupRecoveryManifest :
    recovery ? buildPush38ConnectorRecoveryManifest : buildPush38ConnectorPidfixManifest;
  const { document } = builder({ signingKeyId: "observer-kms-release-v1",
    artifactOrigin: origin, releasedAt: new Date().toISOString() });
  const path = resolve(artifactPath), info = lstatSync(path);
  const artifactRelative = relative(restrictedRoot, path);
  if (!artifactRelative || artifactRelative === ".." || artifactRelative.startsWith(`..${sep}`) ||
    isAbsolute(artifactRelative) || !info.isFile() || info.isSymbolicLink() ||
    statSync(path).size !== document.artifact_size)
    fail("P38_PIDFIX_R2_LOCAL_ARTIFACT_INVALID");
  const local = await hashStream(createReadStream(path), document.artifact_size);
  if (local.sha256 !== document.artifact_sha256 || local.size !== document.artifact_size)
    fail("P38_PIDFIX_R2_LOCAL_ARTIFACT_HASH_MISMATCH");
  const key = edgeReleaseObjectPath(document), keychain = join(homedir(), "Library/Keychains/login.keychain-db");
  const clientOptions = { region: "auto", endpoint: origin, forcePathStyle: true,
    maxAttempts: 1, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" };
  const publisher = new S3Client({ ...clientOptions,
    credentials: readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-publisher-20260922-v2", keychain }) });
  const reader = new S3Client({ ...clientOptions,
    credentials: readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-reader-20260922", keychain }) });
  try {
    let existed = false;
    try {
      await publisher.send(new PutObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key,
        Body: createReadStream(path), ContentLength: local.size, ContentType: "application/gzip",
        StorageClass: "STANDARD", IfNoneMatch: "*", Metadata: { sha256: local.sha256,
          release_id: document.release_id } }), { abortSignal: AbortSignal.timeout(600_000) });
    } catch (error) {
      if (error.$metadata?.httpStatusCode !== 412 && error.name !== "PreconditionFailed") throw error;
      existed = true;
    }
    const head = await reader.send(new HeadObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(30_000) });
    if (head.ContentLength !== local.size || head.Metadata?.sha256 !== local.sha256 ||
      head.Metadata?.release_id !== document.release_id) fail("P38_PIDFIX_R2_EXISTING_OBJECT_CONFLICT");
    const capability = await getSignedUrl(reader,
      new GetObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }), { expiresIn: 120 });
    const url = new URL(capability);
    if (url.origin !== origin || url.pathname !== `/${EDGE_RELEASE_R2_BUCKET}/${key}` ||
      url.searchParams.get("X-Amz-Expires") !== "120") fail("P38_PIDFIX_R2_CAPABILITY_SCOPE_INVALID");
    const response = await fetch(capability, { redirect: "error", signal: AbortSignal.timeout(600_000) });
    if (!response.ok || Number(response.headers.get("content-length")) !== local.size)
      fail("P38_PIDFIX_R2_DOWNLOAD_INVALID");
    const downloaded = await hashStream(response.body, local.size);
    if (downloaded.sha256 !== local.sha256 || downloaded.size !== local.size)
      fail("P38_PIDFIX_R2_ROUND_TRIP_MISMATCH");
    const anonymous = await fetch(`${origin}/${EDGE_RELEASE_R2_BUCKET}/${key}`, { redirect: "error",
      signal: AbortSignal.timeout(30_000) });
    await anonymous.body?.cancel();
    if (anonymous.ok) fail("P38_PIDFIX_R2_PUBLIC_ACCESS_ENABLED");
    const result = { protocol: rtspSessionRecovery ? "observer-push38-rtsp-session-recovery-r2-publication-v1" :
      parentExitRecovery ? "observer-push38-parent-exit-recovery-r2-publication-v1" :
      livenessRecovery ? "observer-push38-liveness-recovery-r2-publication-v1" :
      startupRecovery ? "observer-push38-startup-recovery-r2-publication-v1" :
      recovery ? "observer-push38-recovery-r2-publication-v1" :
      "observer-push38-pidfix-r2-publication-v1", at: new Date().toISOString(),
      bucket: EDGE_RELEASE_R2_BUCKET, storage_class: "STANDARD", release_id: document.release_id,
      object_key: key, artifact_sha256: local.sha256, bytes: local.size, uploaded: !existed,
      round_trip: "PASS", anonymous_access_denied: true, runtime_activation: false };
    writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    return result;
  } finally { publisher.destroy(); reader.destroy(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const recovery = process.argv.includes("--health-recovery");
    const startupRecovery = process.argv.includes("--startup-recovery");
    const livenessRecovery = process.argv.includes("--liveness-recovery");
    const parentExitRecovery = process.argv.includes("--parent-exit-recovery");
    const rtspSessionRecovery = process.argv.includes("--rtsp-session-recovery");
    if ([recovery, startupRecovery, livenessRecovery, parentExitRecovery, rtspSessionRecovery]
      .filter(Boolean).length > 1)
      fail("P38_PIDFIX_R2_MODE_INVALID");
    const [artifact, evidence] = process.argv.slice(2)
      .filter(value => !["--health-recovery", "--startup-recovery", "--liveness-recovery",
        "--parent-exit-recovery", "--rtsp-session-recovery"].includes(value));
    const evidenceRelative = evidence ? relative(restrictedRoot, resolve(evidence)) : "";
    if (!artifact || !evidence || !evidenceRelative || evidenceRelative === ".." ||
      evidenceRelative.startsWith(`..${sep}`) || isAbsolute(evidenceRelative)) fail("P38_PIDFIX_R2_INPUT_SCOPE_INVALID");
    console.log(JSON.stringify({ result: "PASS", publication: await publish({ artifactPath: artifact,
      evidencePath: resolve(evidence), recovery, startupRecovery, livenessRecovery, parentExitRecovery,
      rtspSessionRecovery }) }));
  } catch (error) {
    console.error(/^P38_PIDFIX_R2_[A-Z0-9_]+$/.test(error.message) ? error.message : "P38_PIDFIX_R2_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}

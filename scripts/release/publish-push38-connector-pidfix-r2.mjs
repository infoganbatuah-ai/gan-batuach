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
import { readR2KeychainCredentials } from "./macos-r2-keychain.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const fail = code => { throw new Error(code); };
async function hashStream(stream, limit) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of stream) { size += chunk.length; if (size > limit) fail("P38_PIDFIX_R2_SIZE_LIMIT"); hash.update(chunk); }
  return { sha256: hash.digest("hex"), size };
}

async function publish({ artifactPath, evidencePath, recovery = false }) {
  const builder = recovery ? buildPush38ConnectorRecoveryManifest : buildPush38ConnectorPidfixManifest;
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
    const result = { protocol: recovery ? "observer-push38-recovery-r2-publication-v1" :
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
    const [artifact, evidence] = process.argv.slice(2).filter(value => value !== "--health-recovery");
    const evidenceRelative = evidence ? relative(restrictedRoot, resolve(evidence)) : "";
    if (!artifact || !evidence || !evidenceRelative || evidenceRelative === ".." ||
      evidenceRelative.startsWith(`..${sep}`) || isAbsolute(evidenceRelative)) fail("P38_PIDFIX_R2_INPUT_SCOPE_INVALID");
    console.log(JSON.stringify({ result: "PASS", publication: await publish({ artifactPath: artifact,
      evidencePath: resolve(evidence), recovery }) }));
  } catch (error) {
    console.error(/^P38_PIDFIX_R2_[A-Z0-9_]+$/.test(error.message) ? error.message : "P38_PIDFIX_R2_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}

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
import { edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from
  "../../services/video-gateway/edge-release-object.mjs";
import { buildPush38ManagedAuthContinuityManifest } from
  "../../services/video-gateway/push38-home-qa-managed-auth-continuity.mjs";
import { readR2KeychainCredentials } from "./macos-r2-keychain.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const restrictedRoot = resolve(process.env.OBSERVER_RESTRICTED_EXPORT_ROOT ||
  fileURLToPath(new URL("../../exports/restricted/", import.meta.url)));
const partSize = 5 * 1024 * 1024;
const fail = code => { throw new Error(code); };
setDefaultResultOrder("ipv4first");

async function hashStream(stream, limit) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > limit) fail("P38_MANAGED_AUTH_R2_SIZE_LIMIT");
    hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), size };
}

async function headOrNull(client, key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }),
      { abortSignal: AbortSignal.timeout(30_000) });
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404 || ["NotFound", "NoSuchKey"].includes(error.name))
      return null;
    throw error;
  }
}

async function uploadMultipart({ client, key, path, size, sha256, releaseId }) {
  const created = await client.send(new CreateMultipartUploadCommand({ Bucket: EDGE_RELEASE_R2_BUCKET,
    Key: key, ContentType: "application/gzip", StorageClass: "STANDARD",
    Metadata: { sha256, release_id: releaseId } }),
  { abortSignal: AbortSignal.timeout(60_000) });
  if (!created.UploadId) fail("P38_MANAGED_AUTH_R2_MULTIPART_CREATE_FAILED");
  let handle;
  try {
    handle = await open(path, "r");
    const parts = [];
    for (let offset = 0, number = 1; offset < size; offset += partSize, number += 1) {
      const length = Math.min(partSize, size - offset);
      const body = Buffer.allocUnsafe(length);
      if ((await handle.read(body, 0, length, offset)).bytesRead !== length)
        fail("P38_MANAGED_AUTH_R2_MULTIPART_READ_FAILED");
      const directory = mkdtempSync(join(tmpdir(), "observer-p38-auth-r2-part-"));
      const partPath = join(directory, `part-${number}.bin`);
      writeFileSync(partPath, body, { flag: "wx", mode: 0o600 });
      let etag = "";
      try {
        for (let attempt = 1; attempt <= 3 && !etag; attempt += 1) {
          const capability = await getSignedUrl(client, new UploadPartCommand({
            Bucket: EDGE_RELEASE_R2_BUCKET, Key: key, UploadId: created.UploadId,
            PartNumber: number }), { expiresIn: 900 });
          const response = spawnSync("curl", ["--ipv4", "--silent", "--show-error", "--fail-with-body",
            "--header", "Expect:", "--upload-file", partPath, "--dump-header", "-", "--output", "-",
            "--max-time", "120", capability], { encoding: "utf8", timeout: 125_000,
            maxBuffer: 64 * 1024 });
          if (response.status === 0)
            etag = [...response.stdout.matchAll(/^etag:\s*(.+)$/gim)].at(-1)?.[1]?.trim() || "";
          else if (attempt === 3) fail("P38_MANAGED_AUTH_R2_MULTIPART_PART_FAILED");
        }
      } finally { rmSync(directory, { recursive: true, force: true }); }
      if (!etag) fail("P38_MANAGED_AUTH_R2_MULTIPART_PART_FAILED");
      parts.push({ ETag: etag, PartNumber: number });
      console.error(JSON.stringify({ stage: "multipart_part_complete", part_number: number,
        bytes: length }));
    }
    await handle.close(); handle = undefined;
    await client.send(new CompleteMultipartUploadCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key,
      UploadId: created.UploadId, MultipartUpload: { Parts: parts } }),
    { abortSignal: AbortSignal.timeout(180_000) });
  } catch (error) {
    await handle?.close().catch(() => {});
    await client.send(new AbortMultipartUploadCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key,
      UploadId: created.UploadId }), { abortSignal: AbortSignal.timeout(30_000) }).catch(() => {});
    throw error;
  }
}

export async function publishPush38ManagedAuthContinuity({ component, artifactPath, evidencePath }) {
  if (!["connector", "gateway"].includes(component)) fail("P38_MANAGED_AUTH_R2_COMPONENT_INVALID");
  const document = buildPush38ManagedAuthContinuityManifest({ component,
    signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
    releasedAt: new Date().toISOString() }).document;
  const path = resolve(artifactPath), evidence = resolve(evidencePath);
  for (const candidate of [path, evidence]) {
    const scoped = relative(restrictedRoot, candidate);
    if (!scoped || scoped === ".." || scoped.startsWith(`..${sep}`) || isAbsolute(scoped))
      fail("P38_MANAGED_AUTH_R2_INPUT_SCOPE_INVALID");
  }
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || statSync(path).size !== document.artifact_size)
    fail("P38_MANAGED_AUTH_R2_LOCAL_ARTIFACT_INVALID");
  const local = await hashStream(createReadStream(path), document.artifact_size);
  if (local.sha256 !== document.artifact_sha256 || local.size !== document.artifact_size)
    fail("P38_MANAGED_AUTH_R2_LOCAL_ARTIFACT_HASH_MISMATCH");
  const key = edgeReleaseObjectPath(document);
  const keychain = join(homedir(), "Library/Keychains/login.keychain-db");
  const options = { region: "auto", endpoint: origin, forcePathStyle: true, maxAttempts: 3,
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" };
  const publisher = new S3Client({ ...options, credentials: readR2KeychainCredentials({
    service: "digital-observer-r2-home-qa-publisher-20260922-v2", keychain }) });
  const reader = new S3Client({ ...options, credentials: readR2KeychainCredentials({
    service: "digital-observer-r2-home-qa-reader-20260922", keychain }) });
  try {
    const existing = await headOrNull(reader, key);
    if (!existing) await uploadMultipart({ client: publisher, key, path, size: local.size,
      sha256: local.sha256, releaseId: document.release_id });
    const head = await headOrNull(reader, key);
    if (!head || head.ContentLength !== local.size || head.Metadata?.sha256 !== local.sha256 ||
      head.Metadata?.release_id !== document.release_id)
      fail("P38_MANAGED_AUTH_R2_OBJECT_CONFLICT");
    const capability = await getSignedUrl(reader, new GetObjectCommand({
      Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }), { expiresIn: 120 });
    const url = new URL(capability);
    if (url.origin !== origin || url.pathname !== `/${EDGE_RELEASE_R2_BUCKET}/${key}` ||
      url.searchParams.get("X-Amz-Expires") !== "120")
      fail("P38_MANAGED_AUTH_R2_CAPABILITY_SCOPE_INVALID");
    const response = await fetch(capability, { redirect: "error", signal: AbortSignal.timeout(600_000) });
    if (!response.ok || Number(response.headers.get("content-length")) !== local.size)
      fail("P38_MANAGED_AUTH_R2_DOWNLOAD_INVALID");
    const downloaded = await hashStream(response.body, local.size);
    if (downloaded.sha256 !== local.sha256 || downloaded.size !== local.size)
      fail("P38_MANAGED_AUTH_R2_ROUND_TRIP_MISMATCH");
    const anonymous = await fetch(`${origin}/${EDGE_RELEASE_R2_BUCKET}/${key}`, {
      redirect: "error", signal: AbortSignal.timeout(30_000) });
    await anonymous.body?.cancel();
    if (anonymous.ok) fail("P38_MANAGED_AUTH_R2_PUBLIC_ACCESS_ENABLED");
    const result = { protocol: "observer-push38-managed-auth-continuity-r2-publication-v1",
      component, at: new Date().toISOString(), bucket: EDGE_RELEASE_R2_BUCKET,
      storage_class: "STANDARD", release_id: document.release_id, object_key: key,
      artifact_sha256: local.sha256, bytes: local.size, uploaded: !existing,
      round_trip: "PASS", anonymous_access_denied: true, runtime_activation: false };
    writeFileSync(evidence, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    return result;
  } finally { publisher.destroy(); reader.destroy(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const component = process.argv.find(value => value.startsWith("--component="))?.slice(12);
    const [artifactPath, evidencePath] = process.argv.slice(2).filter(value => !value.startsWith("--"));
    if (!artifactPath || !evidencePath) fail("P38_MANAGED_AUTH_R2_ARGUMENTS_REQUIRED");
    console.log(JSON.stringify({ status: "PASS", publication:
      await publishPush38ManagedAuthContinuity({ component, artifactPath, evidencePath }) }));
  } catch (error) {
    console.error(/^P38_MANAGED_AUTH_R2_[A-Z0-9_]+$/.test(error.message)
      ? error.message : "P38_MANAGED_AUTH_R2_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}

// Publishes only the corrected QA remediation archives. Never overwrites an
// existing object and never places credentials or signed URLs in evidence.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { S3Client, HeadObjectCommand, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildPush38HomeQaManifests } from "../../services/video-gateway/push38-home-qa-manifests.mjs";
import { edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "../../services/video-gateway/edge-release-object.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const bucket = EDGE_RELEASE_R2_BUCKET;
const fail = code => { throw new Error(code); };
async function hashStream(stream, limit) {
  const hash = createHash("sha256"); let size = 0;
  for await (const chunk of stream) {
    size += chunk.length; if (size > limit) fail("P38_R2_SIZE_LIMIT"); hash.update(chunk);
  }
  return { sha256: hash.digest("hex"), size };
}
function credentials() {
  const service = "digital-observer-r2-home-qa-publisher-20260919";
  const keychain = join(homedir(), "Library/Keychains/login.keychain-db");
  const opts = { encoding: "utf8", timeout: 45_000, maxBuffer: 16_384,
    stdio: ["ignore", "pipe", "ignore"] };
  const account = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, keychain], opts)
    .match(/"acct"<blob>=(?:0x[0-9A-Fa-f]+\s+)?"([\s\S]*?)"/)?.[1]?.replace(/\\012|\\n/g, "\n").trim();
  const raw = execFileSync("/usr/bin/security", ["find-generic-password", "-s", service, "-w", keychain], opts).trim();
  const decoded = /^(?:[a-fA-F0-9]{2})+$/.test(raw) ? Buffer.from(raw, "hex").toString("utf8").trim() : "";
  const secret = /^[a-fA-F0-9]{64}$/.test(raw) ? raw : /^[a-fA-F0-9]{64}$/.test(decoded) ? decoded : "";
  if (!/^[a-f0-9]{32}$/.test(account || "") || !secret) fail("P38_R2_KEYCHAIN_INVALID");
  return { accessKeyId: account, secretAccessKey: secret };
}
async function publish({ connector, gateway, evidencePath }) {
  const manifests = buildPush38HomeQaManifests({ signingKeyId: "observer-kms-release-v1",
    artifactOrigin: origin, releasedAt: new Date().toISOString() });
  const files = new Map([["CONNECTOR_REMEDIATION", resolve(connector)], ["GATEWAY_REMEDIATION", resolve(gateway)]]);
  const prepared = [];
  for (const { role, document } of manifests.filter(item => files.has(item.role))) {
    const path = files.get(role), info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || statSync(path).size !== document.artifact_size)
      fail("P38_R2_LOCAL_ARTIFACT_INVALID");
    const local = await hashStream(createReadStream(path), document.artifact_size);
    if (local.sha256 !== document.artifact_sha256 || local.size !== document.artifact_size)
      fail("P38_R2_LOCAL_ARTIFACT_HASH_MISMATCH");
    prepared.push({ role, path, document, local, key: edgeReleaseObjectPath(document) });
  }
  const client = new S3Client({ region: "auto", endpoint: origin, forcePathStyle: true,
    credentials: credentials(), maxAttempts: 1, requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED" });
  const results = [];
  try {
    for (const item of prepared) {
      const { role, path, document, local, key } = item;
      let existed = false;
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }),
          { abortSignal: AbortSignal.timeout(30_000) });
        if (head.ContentLength !== local.size || head.Metadata?.sha256 !== local.sha256 ||
          head.Metadata?.release_id !== document.release_id) fail("P38_R2_EXISTING_OBJECT_CONFLICT");
        existed = true;
      } catch (error) { if (error.$metadata?.httpStatusCode !== 404) throw error; }
      if (!existed) await client.send(new PutObjectCommand({ Bucket: bucket, Key: key,
        Body: createReadStream(path), ContentLength: local.size, ContentType: "application/gzip",
        StorageClass: "STANDARD", IfNoneMatch: "*", Metadata: { sha256: local.sha256,
          release_id: document.release_id } }), { abortSignal: AbortSignal.timeout(600_000) });
      const capability = await getSignedUrl(client,
        new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 120 });
      const url = new URL(capability);
      if (url.origin !== origin || url.pathname !== `/${bucket}/${key}` ||
        url.searchParams.get("X-Amz-Expires") !== "120") fail("P38_R2_CAPABILITY_SCOPE_INVALID");
      const response = await fetch(capability, { redirect: "error", signal: AbortSignal.timeout(600_000) });
      if (!response.ok || Number(response.headers.get("content-length")) !== local.size)
        fail("P38_R2_DOWNLOAD_INVALID");
      const downloaded = await hashStream(response.body, local.size);
      if (downloaded.sha256 !== local.sha256 || downloaded.size !== local.size)
        fail("P38_R2_ROUND_TRIP_MISMATCH");
      const anonymous = await fetch(`${origin}/${bucket}/${key}`, { redirect: "error",
        signal: AbortSignal.timeout(30_000) });
      await anonymous.body?.cancel();
      if (anonymous.ok) fail("P38_R2_PUBLIC_ACCESS_ENABLED");
      results.push({ role, release_id: document.release_id, object_key: key,
        artifact_sha256: local.sha256, bytes: local.size, uploaded: !existed,
        round_trip: "PASS", anonymous_access_denied: true });
      console.log(JSON.stringify({ role, round_trip: "PASS", artifact_sha256: local.sha256,
        bytes: local.size, uploaded: !existed }));
    }
    const listing = await fetch(`${origin}/${bucket}?list-type=2`, { redirect: "error",
      signal: AbortSignal.timeout(30_000) });
    await listing.body?.cancel();
    if (listing.ok) fail("P38_R2_PUBLIC_LISTING_ENABLED");
    writeFileSync(evidencePath, `${JSON.stringify({ protocol: "observer-push38-health-r2-publication-v1",
      at: new Date().toISOString(), bucket, storage_class: "STANDARD", artifacts: results,
      public_listing_denied: true, runtime_activation: false }, null, 2)}\n`,
    { mode: 0o600, flag: "wx" });
    return results;
  } finally { client.destroy(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const [connector, gateway, evidencePath] = process.argv.slice(2);
    const evidenceRoot = fileURLToPath(new URL("../../exports/restricted/", import.meta.url));
    const evidenceRelative = evidencePath ? relative(evidenceRoot, resolve(evidencePath)) : "";
    if (!connector || !gateway || !evidencePath || !evidenceRelative ||
      evidenceRelative === ".." || evidenceRelative.startsWith(`..${sep}`) ||
      isAbsolute(evidenceRelative))
      fail("P38_R2_INPUT_SCOPE_INVALID");
    const results = await publish({ connector, gateway, evidencePath: resolve(evidencePath) });
    console.log(JSON.stringify({ result: "PASS", artifacts: results.length, runtime_activation: false }));
  } catch (error) {
    console.error(/^P38_R2_[A-Z0-9_]+$/.test(error.message) ? error.message : "P38_R2_PUBLICATION_FAILED");
    process.exitCode = 1;
  }
}

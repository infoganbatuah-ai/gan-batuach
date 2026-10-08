import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { DeleteBucketCorsCommand, DeleteObjectsCommand, GetBucketCorsCommand, GetObjectCommand,
  PutBucketCorsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";
import { buildPush38HlsSnapshot, parsePush38HlsSnapshot, PUSH38_R2_BUCKET,
  PUSH38_R2_ORIGIN, push38R2MediaPrefix } from "../../services/video-gateway/push38-r2-phone-media.mjs";
import { verifyGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const inputPath = realpathSync(resolve(option("session")));
if (!inputPath.startsWith(restricted) || !statSync(inputPath).isFile() || (statSync(inputPath).mode & 0o077) !== 0)
  throw new Error("P38_R2_MEDIA_SESSION_FILE_UNSAFE");
const outputPath = name => {
  const path = resolve(option(name));
  if (!path.startsWith(restricted) || existsSync(path)) throw new Error("P38_R2_MEDIA_OUTPUT_UNSAFE");
  return path;
};
const payloadOutput = outputPath("payload-output");
const evidenceOutput = outputPath("evidence-output");
const cleanupOutput = outputPath("cleanup-output");
const payload = JSON.parse(readFileSync(inputPath, "utf8"));
const runtimeSecretPath = realpathSync(resolve(option("runtime-secret")));
if (!runtimeSecretPath.startsWith(restricted) || !statSync(runtimeSecretPath).isFile() ||
  (statSync(runtimeSecretPath).mode & 0o077) !== 0)
  throw new Error("P38_R2_MEDIA_RUNTIME_SECRET_UNSAFE");
const runtimeSecrets = JSON.parse(readFileSync(runtimeSecretPath, "utf8"));
if (runtimeSecrets.protocol !== "observer-push38-remote-runtime-secrets-v1" ||
  !/^[A-Za-z0-9_-]{64}$/.test(runtimeSecrets.cloud_discovery_secret || ""))
  throw new Error("P38_R2_MEDIA_RUNTIME_SECRET_INVALID");
const expiresAt = new Date(payload.expires_at).getTime();
if (payload.protocol !== "observer-push38-remote-phone-payload-v1" ||
  !/^[A-Za-z0-9_-]{22}$/.test(payload.session_id || "") || !Number.isFinite(expiresAt) ||
  expiresAt < Date.now() + 5 * 60_000 || expiresAt > Date.now() + 20 * 60_000 ||
  !payload.config?.t || payload.config?.t.split(".").length !== 3 || !payload.config?.s ||
  !Array.isArray(payload.config?.c) || payload.config.c.length !== 11)
  throw new Error("P38_R2_MEDIA_SESSION_INVALID");
const visual = payload.config.c.filter(source => source?.p === true);
if (visual.length !== 4 || visual.filter(source => source.k === "DVR").length !== 3 ||
  visual.filter(source => source.k === "TAPO").length !== 1)
  throw new Error("P38_R2_MEDIA_VISUAL_SCOPE_INVALID");

const keychain = option("keychain") || `${homedir()}/Library/Keychains/login.keychain-db`;
const credentials = readR2KeychainCredentials({
  service: "digital-observer-r2-home-qa-publisher-20260922-v2", keychain
});
const client = new S3Client({ region: "auto", endpoint: PUSH38_R2_ORIGIN, forcePathStyle: true, credentials });
const capabilitySeconds = Math.min(900, Math.floor((expiresAt - Date.now()) / 1000));
if (capabilitySeconds < 300) throw new Error("P38_R2_MEDIA_CAPABILITY_WINDOW_INVALID");
const prefix = push38R2MediaPrefix(payload.session_id);
const corsRule = { ID: "push38-homeqa-phone-proof", AllowedHeaders: ["*"], AllowedMethods: ["GET", "HEAD"],
  AllowedOrigins: ["https://gateway.ganbatuach.com"],
  ExposeHeaders: ["accept-ranges", "content-length", "content-range", "etag"], MaxAgeSeconds: 300 };
let previousCors = null;
let corsManageable = true;
try {
  previousCors = (await client.send(new GetBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET }))).CORSRules || [];
} catch (error) {
  if (error?.name === "AccessDenied") corsManageable = false;
  else if (!["NoSuchCORSConfiguration", "NoSuchCORS", "NotFound"].includes(error?.name))
    throw new Error("P38_R2_MEDIA_CORS_READ_FAILED");
}
if (corsManageable && (previousCors || []).some(rule => rule.ID === corsRule.ID))
  throw new Error("P38_R2_MEDIA_CORS_RULE_CONFLICT");
const appliedCors = corsManageable ? [...(previousCors || []), corsRule] : null;
const uploaded = [];
let totalBytes = 0;
let corsApplied = false;
let cleanupCreated = false;
const cleanupState = { protocol: "observer-push38-r2-phone-media-cleanup-v1", status: "PENDING",
  session_id: payload.session_id, created_at: new Date().toISOString(), expires_at: payload.expires_at,
  bucket: PUSH38_R2_BUCKET, prefix, keys: [], cors_managed: corsManageable,
  previous_cors: previousCors, applied_cors: appliedCors };
const persistCleanup = update => {
  Object.assign(cleanupState, update, { keys: uploaded.map(item => item.key) });
  writeFileSync(cleanupOutput, `${JSON.stringify(cleanupState, null, 2)}\n`,
    { ...(cleanupCreated ? {} : { flag: "wx" }), mode: 0o600 });
  cleanupCreated = true;
};
const sha256 = value => createHash("sha256").update(value).digest("hex");
const readGatewaySecret = () => execFileSync("/usr/bin/security", ["find-generic-password", "-s",
  "com.ganbatuach.video-gateway.runtime", "-a", "gateway_signing_secret", "-w"],
{ encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "ignore"] }).trim();
const connectorSecretPath = `${homedir()}/Library/Application Support/Digital Observer/Tapo Connector/secrets/gateway_signing_secret`;
const connectorInfo = lstatSync(connectorSecretPath);
if (!connectorInfo.isFile() || connectorInfo.isSymbolicLink() || (connectorInfo.mode & 0o077) !== 0)
  throw new Error("P38_R2_MEDIA_CONNECTOR_SECRET_UNSAFE");
const mediaSecrets = { DVR: readGatewaySecret(), TAPO: readFileSync(connectorSecretPath, "utf8").trim() };
if (Object.values(mediaSecrets).some(value => typeof value !== "string" || value.length < 32))
  throw new Error("P38_R2_MEDIA_EDGE_SECRET_INVALID");
const put = async (key, body, contentType) => {
  totalBytes += body.length;
  if (body.length > 3 * 1024 * 1024 || totalBytes > 25 * 1024 * 1024)
    throw new Error("P38_R2_MEDIA_BYTE_LIMIT_EXCEEDED");
  await client.send(new PutObjectCommand({ Bucket: PUSH38_R2_BUCKET, Key: key, Body: body,
    ContentType: contentType, CacheControl: "private, max-age=30, no-transform",
    Metadata: { sha256: sha256(body), qualification: "push38-homeqa-phone" } }));
  uploaded.push({ key, bytes: body.length, sha256: sha256(body), content_type: contentType });
  persistCleanup({ status: "PENDING" });
};
const restoreCors = async () => {
  if (!corsApplied) return;
  if (previousCors === null) await client.send(new DeleteBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET }));
  else await client.send(new PutBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET,
    CORSConfiguration: { CORSRules: previousCors } }));
  corsApplied = false;
};
try {
  if (corsManageable) {
    await client.send(new PutBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET,
      CORSConfiguration: { CORSRules: appliedCors } }));
    corsApplied = true;
  }
  persistCleanup({ status: "PENDING" });
  for (const source of visual) {
    const authorization = await fetch("http://127.0.0.1:3100/api/digital-observer/dvr-gateway", {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${payload.config.t}` },
      body: JSON.stringify({ observer_site_id: payload.config.s, camera_source_id: source.i, mode: "live" }),
      cache: "no-store", signal: AbortSignal.timeout(20_000)
    });
    const authorized = await authorization.json().catch(() => ({}));
    if (!authorization.ok || authorized.data?.private_source_hidden !== true ||
      typeof authorized.data?.playback?.grant !== "string")
      throw new Error(`P38_R2_MEDIA_AUTHORIZATION_${source.k}_FAILED`);
    const port = source.k === "TAPO" ? 18083 : 18082;
    const grant = verifyGatewayPlaybackGrant(authorized.data.playback.grant,
      runtimeSecrets.cloud_discovery_secret);
    const expectedGatewayId = source.k === "DVR"
      ? "62df97e2-3c0b-427f-9108-bde029bc10e7"
      : "db267b52-6282-4944-bcee-5d4857698fb0";
    if (!grant || grant.camera_source_id !== source.i || grant.observer_site_id !== payload.config.s ||
      grant.gateway_id !== expectedGatewayId)
      throw new Error(`P38_R2_MEDIA_GRANT_${source.k}_FAILED`);
    const claim = await fetch(`http://127.0.0.1:${port}/camera/${encodeURIComponent(grant.gateway_stream_id)}/playback`, {
      headers: { "x-video-gateway-secret": mediaSecrets[source.k] }, cache: "no-store",
      signal: AbortSignal.timeout(20_000) });
    const claimed = await claim.json().catch(() => ({}));
    if (!claim.ok || typeof claimed.playback?.hls_url !== "string")
      throw new Error(`P38_R2_MEDIA_CLAIM_${source.k}_${claim.status}`);
    const hls = new URL(claimed.playback.hls_url);
    if (hls.protocol !== "http:" ||
      hls.hostname !== "127.0.0.1" || Number(hls.port) !== port)
      throw new Error(`P38_R2_MEDIA_CLAIM_${source.k}_FAILED`);
    const playlistResponse = await fetch(hls, { headers: { origin: "https://gateway.ganbatuach.com" },
      cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!playlistResponse.ok) throw new Error(`P38_R2_MEDIA_PLAYLIST_${source.k}_FAILED`);
    const parsed = parsePush38HlsSnapshot(await playlistResponse.text(), hls);
    const sourceKey = `${prefix}/${source.k.toLowerCase()}-${source.i}`;
    const segmentUrls = [];
    for (let index = 0; index < parsed.segments.length; index += 1) {
      const segmentResponse = await fetch(parsed.segments[index].url, {
        headers: { origin: "https://gateway.ganbatuach.com" }, cache: "no-store",
        signal: AbortSignal.timeout(20_000)
      });
      const segment = Buffer.from(await segmentResponse.arrayBuffer());
      if (!segmentResponse.ok || segment.length < 1024)
        throw new Error(`P38_R2_MEDIA_SEGMENT_${source.k}_FAILED`);
      const key = `${sourceKey}/segment-${index + 1}.ts`;
      await put(key, segment, "video/mp2t");
      segmentUrls.push(await getSignedUrl(client,
        new GetObjectCommand({ Bucket: PUSH38_R2_BUCKET, Key: key }), { expiresIn: capabilitySeconds }));
    }
    const snapshot = Buffer.from(buildPush38HlsSnapshot(parsed, segmentUrls));
    const playlistKey = `${sourceKey}/index.m3u8`;
    await put(playlistKey, snapshot, "application/vnd.apple.mpegurl");
    source.q = await getSignedUrl(client,
      new GetObjectCommand({ Bucket: PUSH38_R2_BUCKET, Key: playlistKey }), { expiresIn: capabilitySeconds });
    source.n = !corsManageable;
  }
  const playlistObject = uploaded.find(item => item.content_type === "application/vnd.apple.mpegurl");
  const anonymous = await fetch(`${PUSH38_R2_ORIGIN}/${PUSH38_R2_BUCKET}/${playlistObject.key}`, {
    redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15_000)
  });
  if (anonymous.ok) throw new Error("P38_R2_MEDIA_ANONYMOUS_ACCESS_ENABLED");
  const evidence = { protocol: "observer-push38-r2-phone-media-evidence-v1", status: "READY",
    at: new Date().toISOString(), expires_at: payload.expires_at, source_count: visual.length,
    dvr_samples: visual.filter(source => source.k === "DVR").length,
    tapo_samples: visual.filter(source => source.k === "TAPO").length,
    object_count: uploaded.length, bytes_stored: totalBytes, class_a_operations: uploaded.length + 1,
    projected_billable_cost_usd_before_tax: 0, within_owner_cap_usd: 0.015,
    private_bucket: true, anonymous_access_denied: true, cors_origin_exact: corsManageable,
    cors_managed: corsManageable, native_hls_required: !corsManageable,
    capability_seconds: capabilitySeconds, credentials_exposed: false, private_camera_credentials_exposed: false,
    media_bytes_through_control_plane: false, cleanup_required: true,
    objects: uploaded.map(item => ({ bytes: item.bytes, sha256: item.sha256, content_type: item.content_type })) };
  writeFileSync(payloadOutput, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  writeFileSync(evidenceOutput, `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  persistCleanup({ status: "PENDING", ready_at: new Date().toISOString() });
  console.log(JSON.stringify({ status: "READY", source_count: visual.length, object_count: uploaded.length,
    bytes_stored: totalBytes, private_bucket: true, anonymous_access_denied: true,
    projected_billable_cost_usd_before_tax: 0, within_owner_cap_usd: 0.015 }));
} catch (error) {
  if (uploaded.length) await client.send(new DeleteObjectsCommand({ Bucket: PUSH38_R2_BUCKET,
    Delete: { Objects: uploaded.map(item => ({ Key: item.key })), Quiet: true } })).catch(() => {});
  await restoreCors().catch(() => {});
  if (cleanupCreated) persistCleanup({ status: "ROLLED_BACK", rolled_back_at: new Date().toISOString() });
  throw error;
}

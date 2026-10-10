import { readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";
import { DeleteBucketCorsCommand, DeleteObjectsCommand, GetBucketCorsCommand, HeadObjectCommand,
  PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";
import { PUSH38_R2_BUCKET, PUSH38_R2_ORIGIN, push38R2MediaPrefix
} from "../../services/video-gateway/push38-r2-phone-media.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const manifestPath = realpathSync(resolve(option("manifest")));
if (!manifestPath.startsWith(restricted) || !statSync(manifestPath).isFile() ||
  (statSync(manifestPath).mode & 0o077) !== 0) throw new Error("P38_R2_MEDIA_CLEANUP_FILE_UNSAFE");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const expectedPrefix = push38R2MediaPrefix(manifest.session_id);
if (manifest.protocol !== "observer-push38-r2-phone-media-cleanup-v1" || manifest.status !== "PENDING" ||
  manifest.bucket !== PUSH38_R2_BUCKET || manifest.prefix !== expectedPrefix ||
  !Array.isArray(manifest.keys) || !manifest.keys.length || manifest.keys.length > 100 ||
  manifest.keys.some(key => typeof key !== "string" || !key.startsWith(`${expectedPrefix}/`)) ||
  typeof manifest.cors_managed !== "boolean" ||
  !(manifest.applied_cors === null || Array.isArray(manifest.applied_cors)) ||
  !(manifest.previous_cors === null || Array.isArray(manifest.previous_cors)))
  throw new Error("P38_R2_MEDIA_CLEANUP_MANIFEST_INVALID");
if (process.argv.includes("--wait-until-expiry")) {
  const delay = new Date(manifest.expires_at).getTime() - Date.now();
  if (!Number.isFinite(delay) || delay < 0 || delay > 20 * 60_000)
    throw new Error("P38_R2_MEDIA_CLEANUP_WINDOW_INVALID");
  await new Promise(resolveWait => setTimeout(resolveWait, delay + 2_000));
}
const keychain = option("keychain") || `${homedir()}/Library/Keychains/login.keychain-db`;
const credentials = readR2KeychainCredentials({
  service: "digital-observer-r2-home-qa-publisher-20260922-v2", keychain
});
const client = new S3Client({ region: "auto", endpoint: PUSH38_R2_ORIGIN, forcePathStyle: true, credentials });
await client.send(new DeleteObjectsCommand({ Bucket: PUSH38_R2_BUCKET,
  Delete: { Objects: manifest.keys.map(Key => ({ Key })), Quiet: true } }));
if (manifest.cors_managed) {
  let currentCors = null;
  try { currentCors = (await client.send(new GetBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET }))).CORSRules || []; }
  catch (error) {
    if (!["NoSuchCORSConfiguration", "NoSuchCORS", "NotFound"].includes(error?.name))
      throw new Error("P38_R2_MEDIA_CLEANUP_CORS_READ_FAILED");
  }
  if (JSON.stringify(currentCors) !== JSON.stringify(manifest.applied_cors))
    throw new Error("P38_R2_MEDIA_CLEANUP_CORS_CONFLICT");
  if (manifest.previous_cors === null)
    await client.send(new DeleteBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET }));
  else await client.send(new PutBucketCorsCommand({ Bucket: PUSH38_R2_BUCKET,
    CORSConfiguration: { CORSRules: manifest.previous_cors } }));
}
for (const Key of manifest.keys) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: PUSH38_R2_BUCKET, Key }));
    throw new Error("P38_R2_MEDIA_CLEANUP_OBJECT_REMAINS");
  } catch (error) {
    if (error?.message === "P38_R2_MEDIA_CLEANUP_OBJECT_REMAINS" ||
      !["NotFound", "NoSuchKey", "NoSuchObject"].includes(error?.name)) throw error;
  }
}
writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, status: "CLOSED",
  closed_at: new Date().toISOString(), objects_deleted: manifest.keys.length, cors_restored: true }, null, 2)}\n`,
{ mode: 0o600 });
console.log(JSON.stringify({ status: "CLOSED", objects_deleted: manifest.keys.length,
  cors_restored: true, private_bucket: true }));

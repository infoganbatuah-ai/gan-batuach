import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath, EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const EXPIRES_SECONDS = 120;

export async function authorizeHomeQaR2Download(manifest, { accountId, accessKeyId, secretAccessKey }) {
  if (manifest?.channel !== "HOME_QA" || !ACCOUNT_ID.test(accountId || "") ||
    typeof accessKeyId !== "string" || accessKeyId.length < 16 ||
    typeof secretAccessKey !== "string" || secretAccessKey.length < 32)
    throw new Error("EDGE_R2_DELIVERY_CONFIG_INVALID");
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const key = assertEdgeReleaseObjectUrl(manifest, endpoint);
  if (key !== edgeReleaseObjectPath(manifest)) throw new Error("EDGE_R2_OBJECT_MISMATCH");
  const client = new S3Client({ region: "auto", endpoint, forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey } });
  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: EDGE_RELEASE_R2_BUCKET, Key: key }),
    { expiresIn: EXPIRES_SECONDS });
  const signed = new URL(url);
  if (signed.origin !== endpoint || signed.pathname !== `/${EDGE_RELEASE_R2_BUCKET}/${key}` ||
    signed.searchParams.get("X-Amz-Expires") !== String(EXPIRES_SECONDS) ||
    !signed.searchParams.has("X-Amz-Signature")) throw new Error("EDGE_R2_AUTHORIZATION_INVALID");
  return { url, expires_at: new Date(Date.now() + EXPIRES_SECONDS * 1000).toISOString() };
}

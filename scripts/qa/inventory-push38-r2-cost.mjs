import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { join } from "node:path";
import { homedir } from "node:os";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";
import { EDGE_RELEASE_R2_BUCKET } from "../../services/video-gateway/edge-release-object.mjs";

const endpoint = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const keychain = join(homedir(), "Library/Keychains/login.keychain-db");
const addedBytes = process.argv.slice(2)
  .filter(value => value.startsWith("--added-bytes="))
  .map(value => Number(value.slice(14)))
  .reduce((total, value) => total + value, 0);
if (!Number.isSafeInteger(addedBytes) || addedBytes < 0) throw new Error("P38_R2_ADDED_BYTES_INVALID");

const client = new S3Client({ region: "auto", endpoint, forcePathStyle: true, maxAttempts: 3,
  credentials: readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-reader-20260922", keychain }) });
let continuationToken;
let objectCount = 0;
let storedBytes = 0;
let listOperations = 0;
try {
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: EDGE_RELEASE_R2_BUCKET,
      ContinuationToken: continuationToken }));
    listOperations += 1;
    for (const object of page.Contents || []) {
      objectCount += 1;
      storedBytes += Number(object.Size || 0);
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
} finally { client.destroy(); }

const projectedBytes = storedBytes + addedBytes;
const pricePerGbMonth = 0.015;
const includedGbMonth = 10;
const monthlyCost = bytes => Math.max(0, bytes / 1_000_000_000 - includedGbMonth) * pricePerGbMonth;
console.log(JSON.stringify({
  contract: "observer-push38-r2-cost-inventory-v1",
  bucket: EDGE_RELEASE_R2_BUCKET,
  storage_class: "STANDARD",
  object_count: objectCount,
  stored_bytes: storedBytes,
  added_bytes: addedBytes,
  projected_bytes: projectedBytes,
  list_operations_this_probe: listOperations,
  pricing_source: "https://developers.cloudflare.com/r2/pricing/",
  pricing_checked_at: new Date().toISOString(),
  included_gb_month: includedGbMonth,
  price_usd_per_gb_month: pricePerGbMonth,
  current_storage_cost_usd_month_before_tax: Number(monthlyCost(storedBytes).toFixed(6)),
  projected_storage_cost_usd_month_before_tax: Number(monthlyCost(projectedBytes).toFixed(6)),
  incremental_storage_cost_usd_month_before_tax: Number((monthlyCost(projectedBytes) - monthlyCost(storedBytes)).toFixed(6))
}, null, 2));

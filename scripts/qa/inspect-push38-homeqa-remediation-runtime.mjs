// Read-only inspection of the exact AWS-signed Connector remediation object.
// The presigned R2 URL and publisher credentials never enter output or logs.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, mkdtempSync, rmSync, statSync } from "node:fs";
import { once } from "node:events";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { authorizeHomeQaR2Download } from "../../services/video-gateway/edge-r2-download.mjs";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";

const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip";
const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, "connector_remediation.json"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.release_id !== "qa-p38-health-connector-1b076f596574" ||
  manifest.channel !== "HOME_QA" || manifest.artifact_sha256 !==
    "1b076f5965744a903c3c601d8c424c7b127bdcb0d06f49c72eff8b9345bdfc27")
  throw new Error("P38_HOME_QA_REMEDIATION_MANIFEST_INVALID");
const credentials = readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-publisher-20260919",
  keychain: join(homedir(), "Library/Keychains/login.keychain-db") });
const capability = await authorizeHomeQaR2Download(manifest, { accountId: "693f824a750afcc264fe6ee58c8a86ab",
  ...credentials });
const directory = mkdtempSync(join(tmpdir(), "observer-p38-remediation-inspect-"));
const archive = join(directory, "artifact.tar.gz");
try {
  const response = await fetch(capability.url, { redirect: "error", signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) !== manifest.artifact_size)
    throw new Error("P38_HOME_QA_REMEDIATION_DOWNLOAD_INVALID");
  const writer = createWriteStream(archive, { flags: "wx", mode: 0o600 });
  const digest = createHash("sha256"); let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > manifest.artifact_size) throw new Error("P38_HOME_QA_REMEDIATION_OVERSIZE");
    digest.update(chunk);
    if (!writer.write(chunk)) await once(writer, "drain");
  }
  writer.end(); await once(writer, "finish");
  if (size !== manifest.artifact_size || statSync(archive).size !== size ||
    digest.digest("hex") !== manifest.artifact_sha256)
    throw new Error("P38_HOME_QA_REMEDIATION_HASH_MISMATCH");
  const prefix = "Digital Observer.app/Contents/Resources/runtime/services/video-gateway/";
  const names = execFileSync("tar", ["-tzf", archive], { encoding: "utf8", timeout: 120_000,
    maxBuffer: 4_000_000 }).split("\n");
  const serviceName = `${prefix}edge-installed-ota-service.mjs`;
  const cloudName = `${prefix}software-connector-cloud.mjs`;
  if (!names.includes(serviceName) || !names.includes(cloudName))
    throw new Error("P38_HOME_QA_REMEDIATION_MANAGEMENT_CODE_MISSING");
  const service = execFileSync("tar", ["-xOzf", archive, serviceName],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 2_000_000 });
  const cloud = execFileSync("tar", ["-xOzf", archive, cloudName],
    { encoding: "utf8", timeout: 120_000, maxBuffer: 2_000_000 });
  console.log(JSON.stringify({ status: "PASS", release_id: manifest.release_id,
    artifact_sha256: manifest.artifact_sha256, bytes: size, aws_signature: "PASS",
    management_service_present: true,
    ota_only_secret_store_configurable: service.includes("config.secretDir") && service.includes("config.keychainService"),
    cloud_url_from_store: cloud.includes('store.read("device_cloud_base_url")'),
    managed_proof_supported: cloud.includes("createManagedDeviceProofHeaders"),
    qa_loopback_http_requires_development: cloud.includes('process.env.NODE_ENV === "development"'),
    runtime_writes: 0 }));
} finally { rmSync(directory, { recursive: true, force: true }); }

// Actual installed-credential -> isolated authorization -> private R2 ->
// verified temporary staging proof. Never installs or changes a runtime.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createWriteStream, mkdtempSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { once } from "node:events";
import { join, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createKeychainStore } from "../../services/video-gateway/keychain-store.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl } from "../../services/video-gateway/edge-release-object.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { deriveHomeQaLegacyProofKey, signHomeQaLegacyProof } from "../../services/video-gateway/home-qa-legacy-proof.mjs";

const evidenceOption = process.argv.find(arg => arg.startsWith("--identity="))?.slice(11);
const evidenceDigest = process.argv.find(arg => arg.startsWith("--sha256="))?.slice(9);
const resultOption = process.argv.find(arg => arg.startsWith("--result="))?.slice(9);
const profileOption = process.argv.find(arg => arg.startsWith("--profile="))?.slice(10) || "";
const allowed = process.argv.includes("--stage-only");
if (!evidenceOption || !resultOption || !/^[a-f0-9]{64}$/.test(evidenceDigest || "") || !allowed ||
  (profileOption && !["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"].includes(profileOption)))
  throw new Error("P38_HOME_QA_STAGING_INPUT_INVALID");
const restricted = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted") + sep;
const identityPath = realpathSync(resolve(evidenceOption));
const resultPath = resolve(resultOption);
if (!identityPath.startsWith(restricted) || !resultPath.startsWith(restricted) ||
  (statSync(identityPath).mode & 0o077) !== 0)
  throw new Error("P38_HOME_QA_RESTRICTED_EVIDENCE_REQUIRED");
const raw = readFileSync(identityPath);
if (createHash("sha256").update(raw).digest("hex") !== evidenceDigest)
  throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_CHANGED");
const identity = JSON.parse(raw.toString("utf8"));
if (identity.protocol !== "observer-push38-home-identity-reconciliation-v1" || identity.devices?.length !== 2)
  throw new Error("P38_HOME_QA_IDENTITY_EVIDENCE_INVALID");
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("P38_HOME_QA_PRODUCT_READ_REQUIRED");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const keychain = createKeychainStore({ service: "com.ganbatuach.video-gateway.runtime" });
const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip";
const trust = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const specs = [
  { profile: "SOFTWARE_CONNECTOR", name: "connector_transition", release: "qa-connector-legacy-transition-v2-6e7988808b05" },
  { profile: "PHYSICAL_GATEWAY", name: "gateway_remediation", release: "qa-p38-health-gateway-6c9d08327ec6" }
].filter(spec => !profileOption || spec.profile === profileOption);
const staging = mkdtempSync("/private/tmp/push38-homeqa-staging-");
const results = [];
for (const spec of specs) {
  const component = identity.devices.find(row => row.profile === spec.profile);
  if (!component) throw new Error("P38_HOME_QA_COMPONENT_MISSING");
  const token = spec.profile === "PHYSICAL_GATEWAY" ? await keychain.read("device_refresh_token") :
    readFileSync("/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets/device_refresh_token", "utf8").trim();
  const product = await db.from("video_gateway_device_enrollments")
    .select("id,gateway_id,observer_site_id,tenant_id,deployment_profile,status,lifecycle_state,identity_scheme,refresh_token_hash,config_version")
    .eq("id", component.enrollment_id).eq("gateway_id", component.device_id).limit(2);
  if (product.error || product.data?.length !== 1) throw new Error("P38_HOME_QA_PRODUCT_DEVICE_UNAVAILABLE");
  const row = product.data[0];
  const actual = createHash("sha256").update(token, "utf8").digest();
  const stored = Buffer.from(row.refresh_token_hash || "", "hex");
  const productVerifierMatches = stored.length === actual.length && timingSafeEqual(stored, actual);
  const pinnedTransitionProof = component.installed_credential_matches_product_verifier === false &&
    component.legacy_transition_proof_matches_home_qa === true &&
    component.legacy_refresh_state === "ORPHANED_ROTATION_REQUIRES_MANAGED_BOOTSTRAP";
  if ((!productVerifierMatches && !pinnedTransitionProof) ||
    row.status !== "delivered" || row.lifecycle_state !== "ACTIVE" || row.identity_scheme !== "LEGACY_HMAC" ||
    row.observer_site_id !== component.site_id || row.tenant_id !== component.tenant_id ||
    row.deployment_profile !== spec.profile || row.config_version !== component.config_version)
    throw new Error("P38_HOME_QA_PRODUCT_LEGACY_PROOF_CHANGED");
  const localSigningSecret = spec.profile === "PHYSICAL_GATEWAY" ? await keychain.read("gateway_signing_secret") :
    readFileSync("/Users/danielderi/Library/Application Support/Digital Observer/Tapo Connector/secrets/gateway_signing_secret", "utf8").trim();
  const proof = deriveHomeQaLegacyProofKey({ localSigningSecret, device_id: component.device_id,
    enrollment_id: component.enrollment_id, site_id: component.site_id,
    tenant_id: component.tenant_id, profile: spec.profile });
  const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, `${spec.name}.json`],
    { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
  if (!verifyEdgeUpdateManifest(manifest, trust).ok || manifest.release_id !== spec.release ||
    manifest.profile !== spec.profile || manifest.channel !== "HOME_QA" ||
    manifest.architecture !== "arm64" || manifest.platform !== "darwin" ||
    JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([component.device_id]))
    throw new Error("P38_HOME_QA_SIGNED_MANIFEST_INVALID");
  const objectKey = assertEdgeReleaseObjectUrl(manifest, origin);
  const claim = { device_id: component.device_id, enrollment_id: component.enrollment_id,
    site_id: component.site_id, tenant_id: component.tenant_id, profile: spec.profile,
    platform: "darwin", architecture: "arm64", channel: "HOME_QA",
    current_version: "0.1.0-legacy", config_version: component.config_version,
    release_id: spec.release, timestamp: new Date().toISOString(),
    nonce: randomBytes(32).toString("base64url") };
  // Node must be launched with NODE_EXTRA_CA_CERTS set to the pinned local QA
  // certificate. Never downgrade this device-to-control-plane proof to HTTP.
  if (!process.env.NODE_EXTRA_CA_CERTS ||
    realpathSync(process.env.NODE_EXTRA_CA_CERTS) !==
      realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt"))
    throw new Error("P38_HOME_QA_TLS_PIN_REQUIRED");
  const response = await fetch("https://127.0.0.1:3101/api/video-gateway/home-qa-legacy-download", {
    method: "POST", headers: { "content-type": "application/json",
      "x-observer-home-qa-legacy-signature": signHomeQaLegacyProof(claim, proof.privateKey) },
    body: JSON.stringify(claim), redirect: "error", signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) {
    const denied = await response.json().catch(() => ({}));
    throw new Error(`P38_HOME_QA_AUTHORIZATION_HTTP_${response.status}_${spec.name}_${String(denied.error?.code || denied.error || "DENIED").slice(0, 80)}`);
  }
  const grant = (await response.json()).data;
  if (grant?.release_id !== manifest.release_id || grant.artifact_sha256 !== manifest.artifact_sha256 ||
    grant.artifact_size !== manifest.artifact_size || grant.install_authorized !== false ||
    grant.identity_phase !== "LEGACY_VERIFIED_FOR_TRANSITION" ||
    Date.parse(grant.expires_at) > Date.now() + 120_000 || Date.parse(grant.expires_at) <= Date.now())
    throw new Error("P38_HOME_QA_AUTHORIZATION_SCOPE_INVALID");
  const capability = new URL(grant.url);
  if (capability.origin !== origin || capability.pathname !== `/digital-observer-releases/${objectKey}` ||
    capability.searchParams.get("X-Amz-Expires") !== "120")
    throw new Error("P38_HOME_QA_R2_CAPABILITY_SCOPE_INVALID");
  const downloaded = await fetch(grant.url, { redirect: "error", signal: AbortSignal.timeout(600_000) });
  const declaredLength = downloaded.headers.get("content-length");
  if (!downloaded.ok || !downloaded.body ||
    (declaredLength !== null && Number(declaredLength) !== manifest.artifact_size))
    throw new Error(`P38_HOME_QA_R2_DOWNLOAD_INVALID_STATUS_${downloaded.status}_DECLARED_${declaredLength ?? "NONE"}_EXPECTED_${manifest.artifact_size}_BODY_${Boolean(downloaded.body)}`);
  const partial = join(staging, `${spec.name}.partial`);
  const verifiedPath = join(staging, `${spec.name}.verified.tar.gz`);
  const writer = createWriteStream(partial, { flags: "wx", mode: 0o600 });
  const digest = createHash("sha256"); let bytes = 0;
  for await (const chunk of downloaded.body) {
    bytes += chunk.length;
    if (bytes > manifest.artifact_size) throw new Error("P38_HOME_QA_R2_OVERSIZE");
    digest.update(chunk);
    if (!writer.write(chunk)) await once(writer, "drain");
  }
  writer.end(); await once(writer, "finish");
  const sha256 = digest.digest("hex");
  if (bytes !== manifest.artifact_size || statSync(partial).size !== bytes ||
    sha256 !== manifest.artifact_sha256 || !verifyEdgeUpdateManifest(manifest, trust).ok)
    throw new Error("P38_HOME_QA_R2_ARTIFACT_MISMATCH");
  renameSync(partial, verifiedPath);
  results.push({ component: spec.profile, release_id: spec.release, device_id: component.device_id,
    artifact_sha256: sha256, bytes, manifest_signature: "PASS", private_r2: "PASS",
    verified_staging_path: verifiedPath, install_authorized: false,
    legacy_proof_basis: productVerifierMatches ? "CURRENT_PRODUCT_VERIFIER" : "PINNED_HOME_QA_TRANSITION_PROOF" });
  console.log(JSON.stringify({ component: spec.profile, release_id: spec.release,
    sha256, bytes, verified_staging: true, runtime_writes: 0 }));
}
writeFileSync(resultPath, `${JSON.stringify({ protocol: "observer-push38-homeqa-legacy-staging-v1",
  at: new Date().toISOString(), identity_evidence_sha256: evidenceDigest,
  results, staging_only: true, runtime_writes: 0 }, null, 2)}\n`,
{ mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "PASS", downloads: results.length,
  staging_only: true, runtime_writes: 0, signed_urls_logged: false }));

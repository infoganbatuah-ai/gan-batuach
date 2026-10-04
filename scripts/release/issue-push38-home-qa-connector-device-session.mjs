import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPush38ConnectorDeviceSessionRecoveryManifest,
  PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY
} from "../../services/video-gateway/push38-home-qa-connector-device-session.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { signRemoteEdgeDocument, validateRemoteSignerConfig } from "./remote-ed25519-signer.mjs";

const fail = code => { throw new Error(code); };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function issuePush38ConnectorDeviceSessionRecovery({ env = process.env, call }) {
  if (env.GITHUB_REPOSITORY !== "infoganbatuah-ai/gan-batuach" ||
    env.GITHUB_REF !== "refs/heads/codex/push-38-aws-signing" ||
    env.PUSH38_CANDIDATE_SHA !== PUSH38_CONNECTOR_DEVICE_SESSION_RECOVERY.buildSha ||
    !env.RUNNER_TEMP || !env.HOME_QA_OUTPUT_DIR)
    fail("P38_CONNECTOR_DEVICE_SESSION_SIGNING_CONTEXT_INVALID");
  const runner = resolve(env.RUNNER_TEMP), output = resolve(env.HOME_QA_OUTPUT_DIR);
  if (!output.startsWith(`${runner}/`) || existsSync(output) || lstatSync(runner).isSymbolicLink())
    fail("P38_CONNECTOR_DEVICE_SESSION_OUTPUT_SCOPE_INVALID");
  const config = { keyArn: env.SIGNER_KEY_ARN, keyId: env.SIGNER_KEY_ID,
    publicKeySha256: env.SIGNER_PUBLIC_KEY_SHA256, role: "RELEASE_MANIFEST" };
  validateRemoteSignerConfig(config);
  const publicResult = await call("get-public-key", { KeyId: config.keyArn });
  if (publicResult.KeyId !== config.keyArn || typeof publicResult.PublicKey !== "string")
    fail("P38_CONNECTOR_DEVICE_SESSION_PUBLIC_KEY_INVALID");
  const publicBytes = Buffer.from(publicResult.PublicKey, "base64");
  if (digest(publicBytes) !== config.publicKeySha256)
    fail("P38_CONNECTOR_DEVICE_SESSION_PUBLIC_KEY_PIN_MISMATCH");
  const item = buildPush38ConnectorDeviceSessionRecoveryManifest({ signingKeyId: config.keyId,
    artifactOrigin: env.HOME_QA_R2_ORIGIN, releasedAt: new Date().toISOString() });
  const result = await signRemoteEdgeDocument({ document: item.document, config, call });
  if (!verifyEdgeUpdateManifest(result.document, { [config.keyId]: publicBytes.toString("base64url") }).ok)
    fail("P38_CONNECTOR_DEVICE_SESSION_SIGNED_MANIFEST_INVALID");
  mkdirSync(output, { mode: 0o700 });
  const bytes = Buffer.from(`${JSON.stringify(result.document, null, 2)}\n`);
  writeFileSync(join(output, "connector_remediation_device_session.json"), bytes,
    { flag: "wx", mode: 0o600 });
  writeFileSync(join(output, "connector_remediation_device_session.evidence.json"),
    `${JSON.stringify({ ...result.evidence, role: item.role, device_id: item.deviceId,
      artifact_sha256: result.document.artifact_sha256, manifest_file_sha256: digest(bytes),
      source_commit: env.PUSH38_CANDIDATE_SHA, signing_workflow_commit: env.GITHUB_SHA }, null, 2)}\n`,
    { flag: "wx", mode: 0o600 });
  return { role: item.role, release_id: result.document.release_id, device_id: item.deviceId,
    artifact_sha256: result.document.artifact_sha256, signing_key_id: config.keyId,
    signature_verified: true };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const temporary = mkdtempSync(join(tmpdir(), "observer-p38-device-session-sign-"));
  let sequence = 0;
  try {
    const region = process.env.SIGNER_KEY_ARN?.split(":")[3];
    const call = async (operation, input) => {
      const request = join(temporary, `request-${++sequence}.json`);
      writeFileSync(request, JSON.stringify(input), { flag: "wx", mode: 0o600 });
      try { return JSON.parse(execFileSync("aws", ["kms", operation, "--region", region,
        "--cli-input-json", `file://${request}`, "--output", "json", "--cli-binary-format", "base64",
        "--no-cli-pager"], { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, AWS_MAX_ATTEMPTS: "2" } })); }
      catch { fail("P38_CONNECTOR_DEVICE_SESSION_KMS_REQUEST_FAILED"); }
    };
    console.log(JSON.stringify({ result: "PASS",
      manifest: await issuePush38ConnectorDeviceSessionRecovery({ call }) }));
  } catch (error) {
    console.error(/^P38_CONNECTOR_DEVICE_SESSION_[A-Z0-9_]+$/.test(error.message) ? error.message :
      "P38_CONNECTOR_DEVICE_SESSION_ISSUANCE_FAILED");
    process.exitCode = 1;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

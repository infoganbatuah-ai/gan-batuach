// Fixed-scope Home QA issuance. Run only inside the protected AWS signing job.
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPush38HomeQaManifests } from "../../services/video-gateway/push38-home-qa-manifests.mjs";
import { validateRemoteSignerConfig, signRemoteEdgeDocument } from "./remote-ed25519-signer.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const fail = code => { throw new Error(code); };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

export async function issuePush38HomeQaManifests({ env = process.env, call }) {
  if (env.GITHUB_REPOSITORY !== "infoganbatuah-ai/gan-batuach" ||
    env.GITHUB_REF !== "refs/heads/codex/push-38-aws-signing" ||
    !/^[a-f0-9]{40}$/.test(env.PUSH38_CANDIDATE_SHA || "") || !env.RUNNER_TEMP || !env.HOME_QA_OUTPUT_DIR)
    fail("P38_HOME_QA_SIGNING_CONTEXT_INVALID");
  const runner = resolve(env.RUNNER_TEMP), output = resolve(env.HOME_QA_OUTPUT_DIR);
  if (!output.startsWith(`${runner}/`) || existsSync(output) || lstatSync(runner).isSymbolicLink())
    fail("P38_HOME_QA_OUTPUT_SCOPE_INVALID");
  const config = { keyArn: env.SIGNER_KEY_ARN, keyId: env.SIGNER_KEY_ID,
    publicKeySha256: env.SIGNER_PUBLIC_KEY_SHA256, role: "RELEASE_MANIFEST" };
  validateRemoteSignerConfig(config);
  const publicResult = await call("get-public-key", { KeyId: config.keyArn });
  if (publicResult.KeyId !== config.keyArn || typeof publicResult.PublicKey !== "string")
    fail("P38_HOME_QA_PUBLIC_KEY_INVALID");
  const publicBytes = Buffer.from(publicResult.PublicKey, "base64");
  if (digest(publicBytes) !== config.publicKeySha256) fail("P38_HOME_QA_PUBLIC_KEY_PIN_MISMATCH");
  const publicKey = publicBytes.toString("base64url");
  const manifests = buildPush38HomeQaManifests({ signingKeyId: config.keyId,
    artifactOrigin: env.HOME_QA_R2_ORIGIN, releasedAt: new Date().toISOString() });
  const signed = [];
  for (const item of manifests) {
    const result = await signRemoteEdgeDocument({ document: item.document, config, call });
    if (!verifyEdgeUpdateManifest(result.document, { [config.keyId]: publicKey }).ok)
      fail("P38_HOME_QA_SIGNED_MANIFEST_INVALID");
    signed.push({ ...item, result });
  }
  mkdirSync(output, { mode: 0o700 });
  for (const item of signed) {
    const bytes = Buffer.from(`${JSON.stringify(item.result.document, null, 2)}\n`);
    writeFileSync(join(output, `${item.role.toLowerCase()}.json`), bytes, { flag: "wx", mode: 0o600 });
    writeFileSync(join(output, `${item.role.toLowerCase()}.evidence.json`),
      `${JSON.stringify({ ...item.result.evidence, role: item.role, device_id: item.deviceId,
        artifact_sha256: item.result.document.artifact_sha256,
        manifest_file_sha256: digest(bytes), source_commit: env.PUSH38_CANDIDATE_SHA,
        signing_workflow_commit: env.GITHUB_SHA }, null, 2)}\n`,
      { flag: "wx", mode: 0o600 });
  }
  return signed.map(item => ({ role: item.role, release_id: item.result.document.release_id,
    device_id: item.deviceId, artifact_sha256: item.result.document.artifact_sha256,
    signing_key_id: config.keyId, signature_verified: true }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const temporary = mkdtempSync(join(tmpdir(), "observer-p38-manifest-sign-"));
  let sequence = 0;
  try {
    const config = { keyArn: process.env.SIGNER_KEY_ARN };
    const region = config.keyArn?.split(":")[3];
    const call = async (operation, input) => {
      const request = join(temporary, `request-${++sequence}.json`);
      writeFileSync(request, JSON.stringify(input), { flag: "wx", mode: 0o600 });
      try { return JSON.parse(execFileSync("aws", ["kms", operation, "--region", region,
        "--cli-input-json", `file://${request}`, "--output", "json", "--cli-binary-format", "base64",
        "--no-cli-pager"], { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, AWS_MAX_ATTEMPTS: "2" } })); }
      catch { fail("P38_HOME_QA_KMS_REQUEST_FAILED"); }
    };
    const result = await issuePush38HomeQaManifests({ call });
    console.log(JSON.stringify({ result: "PASS", manifests: result }));
  } catch (error) {
    console.error(/^P38_HOME_QA_[A-Z0-9_]+$/.test(error.message) ? error.message : "P38_HOME_QA_ISSUANCE_FAILED");
    process.exitCode = 1;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

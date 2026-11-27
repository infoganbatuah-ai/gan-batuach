import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { BACKEND_SOURCE, CLIENT_SOURCE, issueHomeMediaRecovery,
  prepareHomeMediaRecovery, preparePinnedHomeMediaRecovery } from "./issue-home-media-recovery.mjs";

import { detachedResultKey, encryptDetachedHomeMediaResult } from "./detached-home-media-result.mjs";
import { createHomeMediaKmsTransport } from "./home-media-kms-transport.mjs";

const env = process.env;
const repo = "infoganbatuah-ai/gan-batuach";
const ref = "refs/heads/codex/push-38-aws-signing";
const keyId = "observer-kms-release-v1";
const profiles = ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"];
const sizes = { SOFTWARE_CONNECTOR: 147479760, PHYSICAL_GATEWAY: 135883624 };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");

function readInput(root, name, maxBytes) {
  const path = join(root, name);
  const stat = lstatSync(path);
  if (!stat.isFile() || realpathSync(path) !== path || stat.size < 1 || stat.size > maxBytes)
    throw new Error("HOME_MEDIA_INPUT_UNSAFE");
  return readFileSync(path);
}

function decodeProtectedInput(value, maxBytes) {
  if (typeof value !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length > 4 * Math.ceil(maxBytes / 3))
    throw new Error("HOME_MEDIA_PROTECTED_INPUT_INVALID");
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > maxBytes) throw new Error("HOME_MEDIA_PROTECTED_INPUT_INVALID");
  return bytes;
}

async function main() {
  if (!env.RUNNER_TEMP || env.GITHUB_ACTIONS !== "true" || env.GITHUB_EVENT_NAME !== "push" ||
    env.GITHUB_REPOSITORY !== repo || env.GITHUB_REF !== ref || env.GITHUB_RUN_ATTEMPT !== "1" ||
    env.GITHUB_WORKFLOW_REF !== `${repo}/.github/workflows/home-media-recovery-signing.yml@${ref}` ||
    env.HOME_MEDIA_SIGNING_ENVIRONMENT !== "HOME_QA_SIGNING" || env.HOME_MEDIA_CLIENT_SHA !== CLIENT_SOURCE ||
    env.HOME_MEDIA_BACKEND_SHA !== BACKEND_SOURCE || !/^[a-f0-9]{40}$/.test(env.HOME_MEDIA_APPROVED_SHA || "") ||
    env.GITHUB_SHA !== env.HOME_MEDIA_APPROVED_SHA || env.SIGNER_KEY_ID !== keyId)
    throw new Error("HOME_MEDIA_JOB_CONTEXT_INVALID");
  const mode = process.argv[2];
  if (process.argv.length !== 3 || !["preflight", "sign"].includes(mode)) throw new Error("HOME_MEDIA_JOB_MODE_INVALID");
  const detached = env.HOME_MEDIA_SIGNING_INPUT_MODE === "DETACHED";
  const runner = realpathSync(env.RUNNER_TEMP);
  const input = resolve(runner, "home-media-recovery-inputs");
  if (!detached && realpathSync(input) !== input) throw new Error("HOME_MEDIA_INPUT_UNSAFE");
  const publicKey = detached
    ? decodeProtectedInput(env.HOME_MEDIA_TRUSTED_PUBLIC_KEY, 512)
    : readInput(input, "release-public-key.der", 512);
  if (digest(publicKey) !== env.SIGNER_PUBLIC_KEY_SHA256) throw new Error("HOME_MEDIA_KEY_PIN_MISMATCH");
  const trustedPublicKeys = { [keyId]: publicKey.toString("base64url") };
  const returnKey = detached ? detachedResultKey(env.HOME_MEDIA_RETURN_PUBLIC_KEY, env.HOME_MEDIA_RETURN_KEY_SHA256) : null;
  const inputs = profiles.map(profile => ({ profile, trustedPublicKeys, releasedAt: new Date().toISOString(),
    baselineRelease: detached ? decodeProtectedInput(env[`HOME_MEDIA_BASELINE_${profile}`], 8192)
      : readInput(input, `${profile}.baseline.json`, 8192),
    ...(detached ? {} : { artifact: readInput(input, `${profile}.tar.gz`, sizes[profile]) }) }));
  for (const item of inputs) {
    if (detached) encryptDetachedHomeMediaResult(preparePinnedHomeMediaRecovery(item), returnKey);
    else prepareHomeMediaRecovery(item);
  }
  if (mode === "preflight") return { result: "HOME_MEDIA_SIGNING_PREFLIGHT_PASS", kms_calls: 0 };

  const output = join(runner, "home-media-recovery-signed");
  if (!detached) mkdirSync(output, { mode: 0o700 });
  const config = { keyArn: env.SIGNER_KEY_ARN, keyId, publicKeySha256: env.SIGNER_PUBLIC_KEY_SHA256, role: "RELEASE_MANIFEST" };
  const transport = createHomeMediaKmsTransport({ runner, keyArn: config.keyArn, env });
  const signed = [];
  try {
    for (const item of inputs) signed.push(await issueHomeMediaRecovery({ ...item, config, call: transport.call, detached,
      approvedWorkflowSha: env.HOME_MEDIA_APPROVED_SHA, env: { ...env, HOME_MEDIA_PROFILE: item.profile } }));
  } catch (error) {
    if (transport.failure) console.error(JSON.stringify({ result: "HOME_MEDIA_KMS_CALL_FAILED", ...transport.failure }));
    throw error;
  }
  const calls = transport.count;
  if (calls !== 6) throw new Error("HOME_MEDIA_KMS_COUNT_INVALID");
  if (detached) return { result: "HOME_MEDIA_SIGNED_MANIFESTS_ENCRYPTED", kms_calls: calls,
    ciphertext: signed.map(item => encryptDetachedHomeMediaResult(item.document, returnKey)) };
  for (const item of signed) {
    const { profile } = item.document;
    writeFileSync(join(output, `${profile}.release.json`), `${JSON.stringify(item.document, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    writeFileSync(join(output, `${profile}.evidence.json`), `${JSON.stringify(item.evidence, null, 2)}\n`, { flag: "wx", mode: 0o600 });
  }
  return { result: "HOME_MEDIA_SIGNED_MANIFESTS_VERIFIED", kms_calls: calls, manifests: signed.length };
}

try { console.log(JSON.stringify(await main())); }
catch (error) {
  console.error(/^(HOME_MEDIA_|REMOTE_SIGNER_)[A-Z0-9_]+$/.test(error.message) ? error.message : "HOME_MEDIA_JOB_FAILED");
  process.exitCode = 1;
}

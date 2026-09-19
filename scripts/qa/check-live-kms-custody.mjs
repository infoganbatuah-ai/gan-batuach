// Explicit owner-reviewed provider test. No artifact publication or installation.
// Never emit provider errors, AWS credentials, OIDC tokens, or signed documents.
import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { signRemoteEdgeDocument, validateRemoteSignerConfig } from '../release/remote-ed25519-signer.mjs';

const env = process.env;
const root = env.PROOF_ENVIRONMENT === 'ROOT_TRUST_SIGNING';
const config = { keyArn: env.SIGNER_KEY_ARN, keyId: env.SIGNER_KEY_ID,
  publicKeySha256: env.SIGNER_PUBLIC_KEY_SHA256,
  role: root ? 'ROOT_REGISTRY' : 'RELEASE_MANIFEST' };
let temporary;
try {
  assert.equal(env.GITHUB_REPOSITORY, 'infoganbatuah-ai/gan-batuach');
  assert.equal(env.GITHUB_REF, 'refs/heads/codex/push-38-aws-signing');
  assert.ok(['ROOT_TRUST_SIGNING', 'HOME_QA_SIGNING'].includes(env.PROOF_ENVIRONMENT));
  validateRemoteSignerConfig(config);
  assert.match(env.DENIED_KEY_ARN, /^arn:aws:kms:us-east-1:\d{12}:key\/[a-f0-9-]{36}$/);
  assert.notEqual(env.DENIED_KEY_ARN, config.keyArn);
  temporary = mkdtempSync(join(tmpdir(), 'observer-custody-proof-'));
  let sequence = 0;
  function call(operation, request) {
    const path = join(temporary, `request-${++sequence}.json`);
    writeFileSync(path, JSON.stringify(request), { mode: 0o600, flag: 'wx' });
    return JSON.parse(execFileSync('aws', ['kms', operation, '--region', 'us-east-1',
      '--cli-input-json', `file://${path}`, '--cli-binary-format', 'base64', '--output', 'json', '--no-cli-pager'],
    { encoding: 'utf8', timeout: 20000, maxBuffer: 65536, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...env, AWS_MAX_ATTEMPTS: '1', AWS_RETRY_MODE: 'standard' } }));
  }
  function denied(operation, request) {
    let rejected = false;
    try { call(operation, request); }
    catch (error) { rejected = /AccessDeniedException/.test(String(error.stderr || '')); }
    assert.ok(rejected, 'EXPECTED_EXPLICIT_ACCESS_DENIAL');
  }
  const message = Buffer.from(`Digital Observer custody proof ${env.GITHUB_SHA} ${env.GITHUB_RUN_ID}`);
  const request = { KeyId: config.keyArn, Message: message.toString('base64'),
    MessageType: 'RAW', SigningAlgorithm: 'ED25519_SHA_512' };
  const result = call('sign', request);
  const publicResult = call('get-public-key', { KeyId: config.keyArn });
  const bytes = Buffer.from(publicResult.PublicKey, 'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), config.publicKeySha256);
  const publicKey = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
  assert.equal(publicKey.asymmetricKeyType, 'ed25519');
  assert.equal(result.KeyId, config.keyArn);
  assert.equal(result.SigningAlgorithm, request.SigningAlgorithm);
  const signature = Buffer.from(result.Signature, 'base64');
  assert.equal(verify(null, message, publicKey, signature), true);
  assert.equal(verify(null, Buffer.concat([message, Buffer.from('tampered')]), publicKey, signature), false);
  denied('sign', { ...request, KeyId: env.DENIED_KEY_ARN });
  denied('get-public-key', { KeyId: env.DENIED_KEY_ARN });
  denied('sign', { ...request, SigningAlgorithm: 'ED25519_PH_SHA_512' });
  denied('sign', { ...request, MessageType: 'DIGEST' });

  // Synthetic exact-device manifest / root registry: never publish these fixtures.
  const document = root ? { protocol: 'observer-edge-trust-registry-v1', epoch: 1,
    issued_at: new Date().toISOString(), root_key_id: config.keyId,
    keys: [{ key_id: 'observer-kms-release-v1', state: 'TRUSTED',
      public_key: Buffer.from('MCowBQYDK2VwAyEAnb2qpu74Ab88VI0WL+Q5SWGzzTksur+/iMblLgKVgYw=', 'base64').toString('base64url') }], signature: '' }
    : { protocol: 'observer-edge-update-v1', release_id: 'custody-proof-not-a-release', version: '1.0.1',
      build_sha: env.GITHUB_SHA, channel: 'INTERNAL', platform: 'darwin', architecture: 'arm64', profile: 'SOFTWARE_CONNECTOR',
      artifact_url: 'https://example.invalid/not-published', artifact_sha256: 'b'.repeat(64), artifact_size: 1,
      signing_key_id: config.keyId, compatibility: { minimum_current_version: '1.0.0', maximum_current_version: null,
        minimum_config_version: 1, maximum_config_version: 1, security_floor_version: '1.0.0' },
      released_at: new Date().toISOString(), rollout: { stage: 'INTERNAL_QA', cohort_seed: 'custody-proof',
        cohort_percent: 0, explicit_device_ids: ['nonexistent-custody-fixture'] }, signature: '' };
  const signed = await signRemoteEdgeDocument({ document, config, call });
  console.log(JSON.stringify({ result: 'PASS', evidence_level: 'REAL_KMS_OIDC_ROLE',
    environment: env.PROOF_ENVIRONMENT, commit: env.GITHUB_SHA, run_id: env.GITHUB_RUN_ID,
    signature_verified: true, altered_payload_rejected: true, wrong_key_denied: true,
    wrong_algorithm_denied: true, digest_mode_denied: true,
    canonical_protocol_verified: signed.evidence.provider_signature_verified,
    canonical_payload_sha256: signed.evidence.payload_sha256, private_key_exported: false,
    release_published: false, runtime_modified: false }));
} catch {
  console.error('LIVE_KMS_CUSTODY_PROOF_FAILED');
  process.exitCode = 1;
} finally {
  if (temporary) rmSync(temporary, { recursive: true, force: true });
}

import { verifyQaDeviceProof } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

// Review-only adapter: no route imports it and no database is connected here.
// query must be a trusted server-side PostgreSQL client, never a mobile client.
const loadSql = `SELECT c.id, c.nonce, c.account_profile_id AS "accountId",
  c.auth_session_id AS "sessionId", c.installation_id AS "installationId",
  c.audience, c.issued_at AS "issuedAt", c.expires_at AS "expiresAt",
  c.consumed_at AS "consumedAt", c.revoked_at AS "revokedAt",
  i.public_key_spki_base64 AS "publicKeySpkiBase64"
FROM observer_qa_private.device_handoff_challenges c
JOIN observer_qa_private.approved_installations i
  ON i.id = c.installation_id AND i.account_profile_id = c.account_profile_id
WHERE c.id = $1 AND i.approved_at IS NOT NULL AND i.revoked_at IS NULL
  AND i.expires_at > clock_timestamp()`;

// The private function owns the Auth row lock. service_role cannot SELECT auth.sessions.
const consumeSql = `SELECT observer_qa_private.consume_device_handoff_challenge(
  $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text
) AS consumed`;

const millis = (value) => typeof value === "number" ? value : new Date(value).getTime();
const nonempty = (value) => typeof value === "string" && value.length > 0;

export async function consumeStoredQaChallenge(db, input, verifyLiveSession) {
  if (typeof db?.query !== "function" || typeof verifyLiveSession !== "function" || !input
    || !nonempty(input.challengeId) || !nonempty(input.accountId)
    || !nonempty(input.sessionId) || !nonempty(input.installationId)
    || !nonempty(input.audience) || !nonempty(input.signatureBase64)
    || !Number.isSafeInteger(input.now)) return false;
  try {
    // Only a trusted server-side Auth verifier may return this identity.
    const identity = await verifyLiveSession();
    if (identity?.accountId !== input.accountId || identity?.sessionId !== input.sessionId) return false;
    const loaded = await db.query(loadSql, [input.challengeId]);
    if (loaded.rows?.length !== 1) return false;
    const row = loaded.rows[0];
    if (row.accountId !== input.accountId || row.sessionId !== input.sessionId
      || row.installationId !== input.installationId || row.audience !== input.audience) return false;
    const challenge = { ...row, issuedAt: millis(row.issuedAt), expiresAt: millis(row.expiresAt) };
    if (!verifyQaDeviceProof(challenge, input.signatureBase64, input.now)) return false;
    const consumed = await db.query(consumeSql, [row.id, input.accountId,
      input.sessionId, input.installationId, input.audience, row.nonce, row.publicKeySpkiBase64]);
    return consumed.rows?.length === 1 && consumed.rows[0].consumed === true;
  } catch {
    return false;
  }
}

export const qaChallengeStoreSql = Object.freeze({ loadSql, consumeSql });

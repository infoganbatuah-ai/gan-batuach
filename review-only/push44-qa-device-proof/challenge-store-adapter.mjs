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

// The Auth row lock serializes receipt consumption with concurrent session deletion.
// This remains review-only until auth.sessions access and transaction behavior are verified.
const consumeSql = `WITH live_session AS MATERIALIZED (
  SELECT s.id, s.user_id FROM auth.sessions AS s
  WHERE s.id = $3 AND s.user_id = $2
    AND (s.not_after IS NULL OR s.not_after > clock_timestamp())
  FOR SHARE
)
UPDATE observer_qa_private.device_handoff_challenges AS c
SET consumed_at = clock_timestamp()
FROM observer_qa_private.approved_installations AS i, live_session AS s
WHERE c.id = $1 AND c.account_profile_id = $2 AND c.auth_session_id = $3
  AND s.id = c.auth_session_id AND s.user_id = c.account_profile_id
  AND c.installation_id = $4 AND c.audience = $5 AND c.nonce = $6
  AND i.id = c.installation_id AND i.account_profile_id = c.account_profile_id
  AND i.public_key_spki_base64 = $7 AND i.approved_at IS NOT NULL
  AND i.revoked_at IS NULL AND i.expires_at > clock_timestamp()
  AND c.consumed_at IS NULL AND c.revoked_at IS NULL
  AND c.expires_at > clock_timestamp()
  AND c.expires_at <= c.issued_at + interval '60 seconds'
RETURNING c.id`;

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
    return consumed.rows?.length === 1 && consumed.rows[0].id === row.id;
  } catch {
    return false;
  }
}

export const qaChallengeStoreSql = Object.freeze({ loadSql, consumeSql });

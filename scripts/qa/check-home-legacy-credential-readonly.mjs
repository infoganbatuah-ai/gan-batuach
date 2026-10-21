import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { compareLegacyCredentialReadonly } from "../../services/video-gateway/legacy-identity-bridge.mjs";

const site = "synthetic-site", tenant = "synthetic-tenant";
const token = "synthetic-token-only-never-used-on-a-device-0001";
for (const [profile, device] of [["PHYSICAL_GATEWAY", "synthetic-gateway"],
  ["SOFTWARE_CONNECTOR", "synthetic-connector"]]) {
  const expected = { id: `synthetic-enrollment-${device}`, gateway_id: device, observer_site_id: site,
    tenant_id: tenant, deployment_profile: profile, config_version: 1 };
  const row = { ...expected, status: "delivered", lifecycle_state: "ACTIVE", identity_scheme: "LEGACY_HMAC",
    refresh_token_hash: createHash("sha256").update(token).digest("hex") };
  const compare = (rows, credential = token) => compareLegacyCredentialReadonly({ rows, expected, localCredential: credential });
  assert.equal(compare([row]), "MATCH");
  assert.equal(compare([row], "different-synthetic-token-never-used-0001"), "MISMATCH");
  for (const invalid of [[], [row, row], [{ ...row, tenant_id: "other-tenant" }],
    [{ ...row, observer_site_id: "other-site" }], [{ ...row, identity_scheme: "ED25519_V1" }],
    [{ ...row, status: "revoked" }], [{ ...row, refresh_token_hash: "malformed" }]])
    assert.equal(compare(invalid), "UNKNOWN");
}
console.log("Home legacy read-only comparator PASS: Gateway and Connector synthetic MATCH/MISMATCH/UNKNOWN; no Production access");

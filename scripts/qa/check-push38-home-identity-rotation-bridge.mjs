import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const command = readFileSync("scripts/qa/reconcile-push38-home-identity.mjs", "utf8");

test("legacy credential rotation bridge is available to both exact Home components", () => {
  assert.match(command, /requireValue\(Boolean\(priorEvidence\), `\$\{component\.profile\}_INSTALLED_PROOF_MISMATCH`\)/);
  assert.doesNotMatch(command, /component\.profile === "SOFTWARE_CONNECTOR" && priorEvidence/);
});

test("rotation bridge remains bound to exact prior identity and the pinned HOME_QA public proof", () => {
  for (const binding of [
    /item\.device_id === component\.id/,
    /item\.enrollment_id === row\.id/,
    /item\.profile === component\.profile/,
    /item\.site_id === SITE_ID/,
    /item\.tenant_id === tenantId/,
    /item\.config_version === row\.config_version/,
    /item\.installed_credential_matches_product_verifier === true/,
    /Date\.parse\(priorEvidence\.observed_at\) < Date\.parse\(row\.updated_at\)/,
    /homeQaLegacyProofMatches\(result\)/
  ]) assert.match(command, binding);
  assert.match(command, /row\.profile === "PHYSICAL_GATEWAY" \? gatewaySigningSecret/);
  assert.match(command, /row\.profile === "SOFTWARE_CONNECTOR" \? connectorSigningSecret/);
  assert.doesNotMatch(command, /if \(row\.profile !== "SOFTWARE_CONNECTOR"\) return false/);
});

test("an already managed component uses its local key and fresh QA challenge instead of legacy proof", () => {
  assert.match(command, /homeQaManagedProofMatches/);
  assert.match(command, /device_private_key_pkcs8/);
  assert.match(command, /observer_managed_device_credentials/);
  assert.match(command, /observer_managed_device_auth_nonces/);
  assert.match(command, /MANAGED_IDENTITY_VERIFIED/);
  assert.match(command, /SUPERSEDED_BY_MANAGED_IDENTITY/);
  assert.match(command, /if \(managedProof\)/);
});

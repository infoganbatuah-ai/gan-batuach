// Authorized local-administrator operation; release updates cannot modify trust.
import { readFileSync } from "node:fs";
import { PROTECTED_EDGE_TRUST_REGISTRY_PATH, PROTECTED_EDGE_TRUST_ROOT_PATH, installEdgeTrustRegistry } from "../services/video-gateway/edge-release-trust.mjs";

if (process.geteuid() !== 0) throw new Error("EDGE_TRUST_REGISTRY_ADMIN_REQUIRED");
const source = process.argv[2];
if (!source || process.argv.length !== 3) throw new Error("EDGE_TRUST_REGISTRY_FILE_REQUIRED");
const pin = JSON.parse(readFileSync(PROTECTED_EDGE_TRUST_ROOT_PATH, "utf8"));
if (pin.protocol !== "observer-edge-trust-root-v1") throw new Error("EDGE_TRUST_ROOT_PIN_INVALID");
const registry = JSON.parse(readFileSync(source, "utf8"));
const result = installEdgeTrustRegistry({ path: PROTECTED_EDGE_TRUST_REGISTRY_PATH, registry,
  pinnedRootKeyId: pin.root_key_id, pinnedRootPublicKey: pin.root_public_key });
console.log(JSON.stringify({ status: "TRUST_REGISTRY_INSTALLED", epoch: result.epoch, trusted_key_ids: Object.keys(result.trustedPublicKeys) }));

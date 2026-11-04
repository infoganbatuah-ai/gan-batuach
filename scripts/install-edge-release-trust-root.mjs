// Separate local-administrator step. Never runs in cloud response handling.
import { createHash, createPublicKey } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PROTECTED_EDGE_TRUST_ROOT_PATH } from "../services/video-gateway/edge-release-trust.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
if (process.geteuid() !== 0) throw new Error("EDGE_TRUST_ROOT_ADMIN_REQUIRED");
if (!args["--key-id"] || !args["--public-key"] || !args["--confirm-fingerprint"]) throw new Error("EDGE_TRUST_ROOT_APPROVED_INPUT_REQUIRED");
const publicBytes = Buffer.from(args["--public-key"], "base64url");
if (createPublicKey({ key: publicBytes, format: "der", type: "spki" }).asymmetricKeyType !== "ed25519") throw new Error("EDGE_TRUST_ROOT_ALGORITHM_INVALID");
const fingerprint = createHash("sha256").update(publicBytes).digest("hex");
if (fingerprint !== args["--confirm-fingerprint"]) throw new Error("EDGE_TRUST_ROOT_FINGERPRINT_NOT_CONFIRMED");
const path = PROTECTED_EDGE_TRUST_ROOT_PATH, directory = dirname(path);
mkdirSync(directory, { recursive: true, mode: 0o755 });
if (lstatSync(directory).uid !== 0 || (lstatSync(directory).mode & 0o022)) throw new Error("EDGE_TRUST_ROOT_DIRECTORY_UNSAFE");
const pin = { protocol: "observer-edge-trust-root-v1", root_key_id: args["--key-id"], root_public_key: args["--public-key"] };
if (existsSync(path)) { const previous = JSON.parse(readFileSync(path, "utf8"));
  if (JSON.stringify(previous) !== JSON.stringify(pin)) throw new Error("EDGE_TRUST_ROOT_ALREADY_PINNED"); }
else writeFileSync(path, `${JSON.stringify(pin, null, 2)}\n`, { mode: 0o644, flag: "wx" });
console.log(JSON.stringify({ status: "ROOT_PINNED", key_id: pin.root_key_id, fingerprint_sha256: fingerprint }));

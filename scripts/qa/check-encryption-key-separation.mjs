import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../lib/security/encryption.ts", import.meta.url), "utf8");
if (source.includes("SUPABASE_SERVICE_ROLE_KEY")) throw new Error("Encryption helper must not reference the Supabase service-role key");

const baseEnv = { ...process.env };
delete baseEnv.FIELD_ENCRYPTION_KEY;
delete baseEnv.FIELD_ENCRYPTION_KEY_CURRENT;
delete baseEnv.SUPABASE_SERVICE_ROLE_KEY;

const run = (code, extra = {}) => execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", code], {
  env: { ...baseEnv, ...extra }, encoding: "utf8"
}).trim();

const failClosed = run('const { encryptField } = await import("./lib/security/encryption.ts"); try { encryptField("sentinel"); process.exit(1); } catch (error) { if (String(error.message).includes("SUPABASE_SERVICE_ROLE_KEY") || String(error.message).includes("sentinel")) process.exit(2); }', { SUPABASE_SERVICE_ROLE_KEY: "service-role-sentinel" });
if (failClosed !== "") throw new Error("Unexpected encryption output without a dedicated key");

const roundTrip = run('const { encryptField, decryptField } = await import("./lib/security/encryption.ts"); const value = encryptField("sentinel"); if (decryptField(value) !== "sentinel" || value.includes("sentinel")) process.exit(1);', { FIELD_ENCRYPTION_KEY_CURRENT: "dedicated-key-sentinel" });
if (roundTrip !== "") throw new Error("Dedicated encryption key round-trip failed");

console.log("Encryption key separation PASS: dedicated key required, service-role-only mode fails closed, plaintext is not emitted.");

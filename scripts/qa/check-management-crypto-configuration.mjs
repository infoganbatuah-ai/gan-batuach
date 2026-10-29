import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ts from "typescript";

const helper = readFileSync(new URL("../../lib/security/field-encryption.ts", import.meta.url), "utf8");
const observerAccessRoute = readFileSync(new URL("../../app/api/digital-observer/access-settings/route.ts", import.meta.url), "utf8");
if (helper.includes("SUPABASE_SERVICE_ROLE_KEY")) {
  throw new Error("Management field protection must not use the Supabase service-role key");
}
if (
  !observerAccessRoute.includes("hashForLegacyLookup")
  || !observerAccessRoute.includes('.in("device_reference_hash", candidateHashes)')
  || observerAccessRoute.includes("process.env.FIELD_HASH_PEPPER || process.env.FIELD_ENCRYPTION_KEY_CURRENT")
) {
  throw new Error("Digital Observer device registration must lazily migrate legacy hashes without writing with the encryption key");
}

const cleanEnv = { ...process.env };
for (const name of [
  "FIELD_HASH_PEPPER",
  "FIELD_ENCRYPTION_KEY_CURRENT",
  "FIELD_ENCRYPTION_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
]) delete cleanEnv[name];

const transformed = ts.transpileModule(helper.replace('import "server-only";', ""), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transformed).toString("base64")}`;

const runModule = (code, extra = {}) => spawnSync(
  process.execPath,
  ["--input-type=module", "-e", code.replace("__MODULE_URL__", JSON.stringify(moduleUrl))],
  { cwd: process.cwd(), env: { ...cleanEnv, ...extra }, encoding: "utf8" }
);

const productionFallback = runModule(
  'const { hashForLookup } = await import(__MODULE_URL__); hashForLookup("sentinel");',
  { APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "encryption-key-only" }
);
if (productionFallback.status === 0 || !productionFallback.stderr.includes("FIELD_HASH_PEPPER is required")) {
  throw new Error("Production lookup hashing did not fail closed without a dedicated pepper");
}

const first = runModule(
  'const { hashForLookup } = await import(__MODULE_URL__); process.stdout.write(hashForLookup(" 050 123 4567 ") ?? "");',
  { APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "encryption-key", FIELD_HASH_PEPPER: "pepper-one" }
);
if (first.status !== 0 || first.stdout.length !== 64 || first.stdout.includes("0501234567")) {
  throw new Error(`Dedicated Production lookup hashing failed: ${first.stderr}`);
}

const second = runModule(
  'const { hashForLookup } = await import(__MODULE_URL__); process.stdout.write(hashForLookup("0501234567") ?? "");',
  { APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "encryption-key", FIELD_HASH_PEPPER: "pepper-two" }
);
if (second.status !== 0 || first.stdout === second.stdout) {
  throw new Error(`Changing the dedicated pepper did not change the lookup hash: ${second.stderr}`);
}

const legacy = runModule(
  'const { hashForLegacyLookup, hashForLookup } = await import(__MODULE_URL__); const current = hashForLookup("device-reference"); const previous = hashForLegacyLookup("device-reference"); if (!previous || previous === current) process.exit(1); process.stdout.write(previous);',
  { APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "legacy-encryption-key", FIELD_HASH_PEPPER: "dedicated-pepper" }
);
if (legacy.status !== 0 || legacy.stdout.length !== 64) {
  throw new Error(`Legacy lookup compatibility hash failed: ${legacy.stderr}`);
}

const noLegacyReuse = runModule(
  'const { hashForLegacyLookup } = await import(__MODULE_URL__); if (hashForLegacyLookup("device-reference") !== null) process.exit(1);',
  { APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "same-secret", FIELD_HASH_PEPPER: "same-secret" }
);
if (noLegacyReuse.status !== 0) {
  throw new Error(`Legacy lookup compatibility must not duplicate the current hash: ${noLegacyReuse.stderr}`);
}

const validation = spawnSync(process.execPath, ["scripts/validate-environment-safety.mjs"], {
  cwd: process.cwd(),
  env: { ...cleanEnv, APP_ENV: "production", FIELD_ENCRYPTION_KEY_CURRENT: "encryption-key-only" },
  encoding: "utf8"
});
if (validation.status === 0 || !validation.stderr.includes("FIELD_HASH_PEPPER")) {
  throw new Error("Production environment validation did not require FIELD_HASH_PEPPER");
}

console.log("Management crypto configuration PASS: Production requires separate encryption and lookup-hash secrets.");

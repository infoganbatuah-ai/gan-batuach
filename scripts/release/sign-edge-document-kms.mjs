// Requires an already authorized remote KMS key and short-lived AWS credentials.
// This command neither creates a key nor changes device/provider configuration.
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { signRemoteEdgeDocument } from "./remote-ed25519-signer.mjs";

try {
  const values = process.argv.slice(2);
  if (values.length !== 3) throw new Error("SIGNER_REQUIRES_INPUT_CONFIG_OUTPUT");
  const [input, configPath, output] = values.map(value => resolve(value));
  if (existsSync(output) || existsSync(`${output}.evidence.json`)) throw new Error("SIGNER_OUTPUT_EXISTS");
  const parent = lstatSync(dirname(output));
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077)) throw new Error("SIGNER_OUTPUT_DIRECTORY_UNSAFE");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const document = JSON.parse(readFileSync(input, "utf8"));
  const temporary = mkdtempSync(join(tmpdir(), "observer-kms-request-"));
  let sequence = 0;
  try {
    const call = async (operation, request) => {
      const path = join(temporary, `request-${++sequence}.json`);
      writeFileSync(path, JSON.stringify(request), { mode: 0o600, flag: "wx" });
      const region = config.keyArn.split(":")[3];
      const response = execFileSync("aws", ["kms", operation, "--region", region, "--cli-input-json", `file://${path}`,
        "--output", "json", "--cli-binary-format", "base64", "--no-cli-pager"], { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "ignore"], env: { ...process.env, AWS_MAX_ATTEMPTS: "2", AWS_RETRY_MODE: "standard" } });
      return JSON.parse(response);
    };
    const result = await signRemoteEdgeDocument({ document, config, call });
    writeFileSync(`${output}.evidence.json`, `${JSON.stringify(result.evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    writeFileSync(output, `${JSON.stringify(result.document, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ result: "REMOTE_SIGNATURE_VERIFIED", ...result.evidence }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
} catch (error) {
  // Never print provider errors, credentials, unsigned payloads or private paths.
  const code = /^(REMOTE_SIGNER_|SIGNER_|EDGE_UPDATE_)[A-Z0-9_]+$/.test(error.message) ? error.message : "SIGNER_FAILED";
  console.error(code);
  process.exitCode = 1;
}

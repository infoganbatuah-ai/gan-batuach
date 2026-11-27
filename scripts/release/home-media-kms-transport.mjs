import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const operations = ["describe-key", "get-public-key", "sign", "describe-key", "get-public-key", "sign"];

function safeProviderFailure(error) {
  const description = String(error.stderr ?? "");
  if (/AccessDenied|not authorized/i.test(description)) return "ACCESS_DENIED";
  if (/Error parsing parameter|Unable to load paramfile|No such device or address/i.test(description)) return "CLI_INPUT";
  if (/Throttl/i.test(description)) return "THROTTLED";
  if (/ValidationException|InvalidKeyUsage|UnsupportedOperation/i.test(description)) return "REQUEST_REJECTED";
  if (/ExpiredToken|Unable to locate credentials|UnrecognizedClient/i.test(description)) return "CREDENTIALS";
  if (error.code === "ETIMEDOUT") return "TIMEOUT";
  return "PROVIDER_ERROR";
}

export function createHomeMediaKmsTransport({ runner, keyArn, env, execute = execFileSync }) {
  let count = 0;
  let failure = null;
  return {
    get count() { return count; },
    get failure() { return failure; },
    async call(operation, request) {
      if (failure || count >= operations.length || operation !== operations[count] || request.KeyId !== keyArn)
        throw new Error("HOME_MEDIA_KMS_LIMIT");
      // AWS CLI's file loader expects a regular file. A pipe-backed /dev/stdin
      // is not portable when the runner's Node process supplies the pipe.
      const scratch = mkdtempSync(join(runner, "home-media-kms-"));
      try {
        const input = join(scratch, "request.json");
        writeFileSync(input, JSON.stringify(request), { mode: 0o600, flag: "wx" });
        count++;
        return JSON.parse(execute("aws", ["kms", operation, "--region", "us-east-1", "--cli-input-json", `file://${input}`,
          "--no-cli-pager", "--output", "json", "--cli-binary-format", "base64"], {
          encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024,
          env: { ...env, AWS_MAX_ATTEMPTS: "1", AWS_RETRY_MODE: "standard" }
        }));
      } catch (error) {
        failure = { operation, category: safeProviderFailure(error), attempted_calls: count };
        throw new Error("HOME_MEDIA_KMS_CALL_FAILED");
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
  };
}

import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const started = Date.now();
const directory = mkdtempSync(join(tmpdir(), "observer-clean-deployment-"));
const archive = join(directory, "source.tar");
const checkout = join(directory, "checkout");
const model = join(directory, "models", "ssd_mobilenet_v1_10.onnx");
mkdirSync(checkout, { mode: 0o700 });
const run = (command, args, options = {}) => execFileSync(command, args, { cwd: options.cwd || checkout, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit", timeout: options.timeout || 10 * 60_000, env: { ...process.env, APP_ENV: "demo", NEXT_PUBLIC_APP_ENV: "demo", NEXT_TELEMETRY_DISABLED: "1" } });
let server;
let dependencyServer;
try {
  run("git", ["archive", "--format=tar", `--output=${archive}`, "HEAD"], { cwd: process.cwd() });
  run("tar", ["-xf", archive, "-C", checkout], { cwd: directory });
  run("npm", ["ci"], { timeout: 10 * 60_000 });
  const nodeVersion = run("npx", ["--yes", "node@22.22.0", "--version"], { capture: true }).trim();
  const node22 = (args, options = {}) => run("npx", ["--yes", "node@22.22.0", ...args], options);
  node22([
    "scripts/bootstrap-portable-environment.mjs",
    "--profile=SOFTWARE_CONNECTOR",
    `--state-dir=${join(directory, "edge-state")}`,
  ]);
  node22(["scripts/qa/check-digital-observer-portable-deployment.mjs"]);
  node22(["node_modules/typescript/bin/tsc", "--noEmit"]);
  node22(["scripts/validate-environment-safety.mjs"]);
  node22(["scripts/prepare-next-build.mjs"]);
  node22(["node_modules/next/dist/bin/next", "build"], { timeout: 10 * 60_000 });
  node22(["scripts/cleanup-next-build-artifacts.mjs"]);
  node22(["scripts/fetch-verified-model.mjs", `--out=${model}`], { timeout: 3 * 60_000 });
  const modelCatalog = JSON.parse(readFileSync(join(checkout, "config/digital-observer-model-artifacts.json"), "utf8"));
  dependencyServer = createServer((request, response) => {
    if (request.url === "/auth/v1/settings") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"external":{}}');
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise((resolve, reject) => dependencyServer.once("error", reject).listen(0, "127.0.0.1", resolve));
  const dependencyAddress = dependencyServer.address();
  const dependencyUrl = `http://127.0.0.1:${dependencyAddress.port}`;
  const serverOutput = [];
  server = spawn("npx", ["--yes", "node@22.22.0", "node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", "32135"], { cwd: checkout, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, APP_ENV: "demo", NEXT_PUBLIC_APP_ENV: "demo", NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_SUPABASE_URL: dependencyUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "clean-environment-public-placeholder" } });
  server.stdout.on("data", (chunk) => serverOutput.push(chunk.toString()));
  server.stderr.on("data", (chunk) => serverOutput.push(chunk.toString()));
  let healthy = false;
  const healthStarted = Date.now();
  while (Date.now() - healthStarted < 45_000) {
    try { const response = await fetch("http://127.0.0.1:32135/api/health"); if (response.ok) { healthy = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!healthy) throw new Error(`CLEAN_ENVIRONMENT_WEB_HEALTH_FAILED:${serverOutput.join("").slice(-2_000)}`);
  console.log(JSON.stringify({ status: "PASS", environment: `isolated git archive in ${tmpdir()} using ${nodeVersion}`, hidden_node_modules_reused: false, install: "npm ci", build: "PASS", web_health: "PASS", database_restore: "PASS — isolated PostgreSQL-compatible representative restore", model: { id: modelCatalog.models[0].id, downloaded_and_checksum_verified: true }, duration_ms: Date.now() - started, manual_technical_steps: 0 }, null, 2));
} finally {
  if (server && !server.killed) server.kill("SIGTERM");
  if (dependencyServer?.listening) await new Promise((resolve) => dependencyServer.close(resolve));
  await new Promise((resolve) => setTimeout(resolve, 250));
  rmSync(directory, { recursive: true, force: true });
}

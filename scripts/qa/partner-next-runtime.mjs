import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const external = "/api/digital-observer/external/v1";
const embed = "/api/digital-observer/embed/v1/dashboard";

export async function openLoopback(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}

export function closeLoopback(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

export async function startNext(t, { supabaseUrl, publishableKey, serviceRoleKey, pepper }) {
  const configured = new URL(supabaseUrl);
  assert.equal(configured.hostname, "127.0.0.1");
  assert.equal(configured.protocol, "http:");
  const directory = mkdtempSync(join(root, ".partner-next-"));
  const projectPath = (relative) => join(directory, relative);
  let child;
  t.after(async () => {
    if (child?.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    rmSync(directory, { recursive: true, force: true });
  });
  for (const file of ["proxy.ts", `app${external}/[...segments]/route.ts`, `app${embed}/route.ts`]) {
    mkdirSync(dirname(projectPath(file)), { recursive: true });
    cpSync(join(root, file), projectPath(file));
  }
  for (const link of ["node_modules", "lib"]) symlinkSync(join(root, link), projectPath(link), "dir");
  writeFileSync(projectPath("package.json"), '{"private":true}');
  writeFileSync(projectPath("next.config.mjs"), "export default { devIndicators: false };\n");
  writeFileSync(projectPath("tsconfig.json"), JSON.stringify({
    compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] }, moduleResolution: "bundler" },
  }));
  const reservation = createServer();
  const port = await openLoopback(reservation);
  await closeLoopback(reservation);
  const endpoint = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: directory,
    env: { PATH: process.env.PATH, TMPDIR: directory, NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey, DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER: pepper },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  child.stdout.on("data", (data) => { logs = (logs + data).slice(-12_000); });
  child.stderr.on("data", (data) => { logs = (logs + data).slice(-12_000); });
  for (let attempt = 0; attempt < 90; attempt++) {
    if (child.exitCode !== null) break;
    try {
      const ready = await fetch(`${endpoint}${external}/openapi.json`, { signal: AbortSignal.timeout(30_000) });
      if (ready.ok) return { endpoint, logs: () => logs };
    } catch (error) {
      if (!["ECONNREFUSED", "ECONNRESET"].includes(error.cause?.code)) break;
    }
    await sleep(250);
  }
  throw new Error(`Isolated Next did not start: ${logs}`);
}

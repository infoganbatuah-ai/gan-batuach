import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const projectId = "gan-batuach-push38t";
const dockerContext = "colima-push38t";
const container = `supabase_db_${projectId}`;
const baseEnv = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
  DOCKER_CONTEXT: dockerContext };
const run = (command, args) => execFileSync(command, args, { cwd: root, env: baseEnv,
  encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"] });

// A separate Docker context and project label are mandatory. No linked-cloud
// Supabase URL or inherited provider credential may reach the QA process.
const labels = JSON.parse(run("docker", ["--context", dockerContext, "inspect", "--format",
  "{{json .Config.Labels}}", container]));
if (labels["com.supabase.cli.project"] !== projectId) throw new Error("Wrong QA database container");
const variables = Object.fromEntries(run("supabase", ["status", "--workdir", root, "--output", "env"])
  .split("\n").filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const separator = line.indexOf("=");
    const raw = line.slice(separator + 1);
    return [line.slice(0, separator), raw.startsWith('"') ? JSON.parse(raw) : raw];
  }));
if (variables.API_URL !== "http://127.0.0.1:56421" ||
  !variables.DB_URL?.includes("127.0.0.1:56422") ||
  !variables.SERVICE_ROLE_KEY || !variables.PUBLISHABLE_KEY)
  throw new Error("QA stack URL or credentials are incomplete or non-local");

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3100"], {
  cwd: root,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_ENV: "development", APP_ENV: "local", NEXT_PUBLIC_APP_ENV: "local",
    OBSERVER_PUSH38_QUALIFICATION: "enabled", OBSERVER_EDGE_PRIVATE_RELEASE_DELIVERY: "disabled",
    NEXT_PUBLIC_SUPABASE_URL: variables.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: variables.PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: variables.SERVICE_ROLE_KEY,
    VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: randomBytes(48).toString("base64url") },
  stdio: "inherit"
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", code => { process.exitCode = code ?? 1; });
console.log(JSON.stringify({ environment: "PUSH38T_QUALIFICATION", projectId,
  url: "http://127.0.0.1:3100", productionAccess: false, releaseDelivery: "DISABLED_UNTIL_ENROLLMENT" }));

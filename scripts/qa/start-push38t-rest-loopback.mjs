import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const context = "colima-push38t";
const network = "push38t-loopback";
const name = "push38t-postgrest-loopback";
const image = "public.ecr.aws/supabase/kong:2.8.1";
const config = resolve(root, "config/push38t-postgrest-loopback-nginx.conf");
const docker = (args, options = {}) => execFileSync("docker", ["--context", context, ...args], {
  cwd: root, encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"], ...options
});

const qaDbLabels = JSON.parse(docker(["inspect", "--format", "{{json .Config.Labels}}",
  "supabase_db_gan-batuach-push38t"]));
if (qaDbLabels["com.supabase.cli.project"] !== "gan-batuach-push38t")
  throw new Error("P38_QA_DATABASE_IDENTITY_MISMATCH");
const loopback = docker(["network", "inspect", network, "--format",
  "{{(index .IPAM.Config 0).Gateway}}"]); // Existence check; the host binding below is the exposure boundary.
if (!loopback.trim()) throw new Error("P38_QA_NETWORK_UNAVAILABLE");

let existing = "";
try { existing = docker(["inspect", "--format", "{{.State.Status}}|{{index .Config.Labels \"observer.purpose\"}}", name]).trim(); }
catch { /* not created yet */ }
if (existing && !existing.endsWith("|push38t-postgrest-loopback")) {
  throw new Error("P38_QA_LOOPBACK_PROXY_IDENTITY_MISMATCH");
}
if (existing && existing !== "running|push38t-postgrest-loopback") {
  docker(["rm", name]);
  existing = "";
}
if (!existing) {
  docker(["create", "--name", name,
    "--label", "observer.purpose=push38t-postgrest-loopback", "--network", network,
    "--publish", "127.0.0.1:56431:8080", "--entrypoint", "/usr/local/bin/nginx", image,
    "-p", "/tmp/nginx/", "-e", "stderr", "-c", "/usr/local/openresty/nginx/conf/nginx.conf",
    "-g", "daemon off;"]);
  docker(["cp", config, `${name}:/usr/local/openresty/nginx/conf/nginx.conf`]);
  docker(["start", name]);
}

let ready = false;
for (let attempt = 0; attempt < 20; attempt++) {
  try {
    const response = await fetch("http://127.0.0.1:56431/not-exposed");
    ready = response.status === 404;
    if (ready) break;
  } catch { /* startup */ }
  await new Promise(resolveDelay => setTimeout(resolveDelay, 250));
}
if (!ready) throw new Error("P38_QA_LOOPBACK_PROXY_NOT_READY");
console.log(JSON.stringify({ status: "PASS", endpoint: "http://127.0.0.1:56431",
  exposure: "LOOPBACK_ONLY_REST_V1", public_ingress: false }));

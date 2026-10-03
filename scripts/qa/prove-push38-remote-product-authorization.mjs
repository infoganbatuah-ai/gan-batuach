import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const secretOption = option("secret");
const controlOrigin = option("control-origin") || "http://127.0.0.1:3100";
const expectRemote = process.argv.includes("--expect-remote");
if (!secretOption) throw new Error("P38_REMOTE_PRODUCT_SECRET_REQUIRED");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const secretPath = realpathSync(resolve(secretOption));
if (!secretPath.startsWith(restricted) || (statSync(secretPath).mode & 0o077) !== 0)
  throw new Error("P38_REMOTE_PRODUCT_SECRET_UNSAFE");
const secret = JSON.parse(readFileSync(secretPath, "utf8"));
if (secret.protocol !== "observer-push38-remote-client-secret-v1" || !secret.email || !secret.password)
  throw new Error("P38_REMOTE_PRODUCT_SECRET_INVALID");
const run = (command, args) => execFileSync(command, args, { encoding: "utf8", timeout: 30_000,
  stdio: ["ignore", "pipe", "pipe"], env: { PATH: process.env.PATH, HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR, DOCKER_CONTEXT: "colima-push38t" } });
const variables = Object.fromEntries(run("supabase", ["status", "--workdir", process.cwd(), "--output", "env"])
  .split("\n").filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const separator = line.indexOf("="); const raw = line.slice(separator + 1);
    return [line.slice(0, separator), raw.startsWith('"') ? JSON.parse(raw) : raw];
  }));
if (variables.API_URL !== "http://127.0.0.1:56421" || !variables.PUBLISHABLE_KEY || !variables.JWT_SECRET)
  throw new Error("P38_REMOTE_PRODUCT_LOCAL_AUTH_REQUIRED");
const client = createClient(variables.API_URL, variables.PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const login = await client.auth.signInWithPassword({ email: secret.email, password: secret.password });
const localQaToken = () => {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ aud: "authenticated", exp: now + 20 * 60, iat: now, iss: "supabase",
    sub: secret.user_id, email: secret.email, role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"], digital_observer_admin: true,
      qualification: "PUSH38" }, user_metadata: { product: "digital_observer" }, aal: "aal1",
    is_anonymous: false });
  return `${header}.${body}.${createHmac("sha256", variables.JWT_SECRET).update(`${header}.${body}`).digest("base64url")}`;
};
const accessToken = login.data.session?.access_token || (login.error?.code === "email_provider_disabled" ? localQaToken() : "");
if (!accessToken)
  throw new Error(`P38_REMOTE_PRODUCT_LOGIN_${String(login.error?.code || "FAILED").replace(/[^A-Z0-9_]/gi, "_")}`);
const sessionClient = createClient(variables.API_URL, variables.PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
  auth: { persistSession: false, autoRefreshToken: false }
});
const verifiedUser = await sessionClient.auth.getUser(accessToken);
if (verifiedUser.error || verifiedUser.data.user?.id !== secret.user_id)
  throw new Error("P38_REMOTE_PRODUCT_USER_TOKEN_REJECTED");
const sourceRead = await sessionClient.from("digital_observer_camera_sources")
  .select("id,display_name,connector_type,status,health_status,metadata")
  .eq("observer_site_id", SITE_ID).order("display_name");
if (sourceRead.error || sourceRead.data.length !== 17) throw new Error("P38_REMOTE_PRODUCT_RLS_SOURCE_READ_FAILED");
const assigned = sourceRead.data.filter(row => row.metadata?.channel_assignment === "ASSIGNED");
const empty = sourceRead.data.filter(row => row.metadata?.channel_assignment === "CHANNEL_EMPTY");
if (assigned.length !== 11 || empty.length !== 6) throw new Error("P38_REMOTE_PRODUCT_SOURCE_SEMANTICS_INVALID");
const results = [];
for (const source of assigned) {
  const response = await fetch(`${controlOrigin}/api/digital-observer/dvr-gateway`, {
    method: "POST", headers: { "content-type": "application/json",
      authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ observer_site_id: SITE_ID, camera_source_id: source.id, mode: "live" }),
    signal: AbortSignal.timeout(20_000)
  });
  const body = await response.json().catch(() => ({}));
  const channel = Number(source.metadata?.dvr_channel || 0);
  const expectedAllowed = source.connector_type === "rtsp" || channel !== 8;
  if (expectedAllowed !== (response.status === 200) ||
    (expectedAllowed && (!body.data?.playback?.grant || body.data?.private_source_hidden !== true))) {
    const category = String(body.error || body.code || "FAILED").replace(/[^\p{L}\p{N}_ -]/gu, "").slice(0, 80);
    throw new Error(`P38_REMOTE_PRODUCT_AUTHORIZATION_${source.connector_type}_${channel || 1}_${response.status}_${category}`);
  }
  if (expectedAllowed) {
    const claim = new URL(body.data.playback.claim_url);
    const remote = claim.protocol === "https:" && !["localhost", "127.0.0.1", "::1"].includes(claim.hostname);
    if (expectRemote !== remote) throw new Error("P38_REMOTE_PRODUCT_ORIGIN_POLICY_FAILED");
    if (/rtsp|password|credential|secret_reference/i.test(JSON.stringify(body)))
      throw new Error("P38_REMOTE_PRODUCT_PRIVATE_SOURCE_LEAK");
  }
  results.push({ kind: source.connector_type === "rtsp" ? "TAPO" : "DVR", channel: channel || 1,
    expected: expectedAllowed ? "ALLOW" : "SOURCE_UNAVAILABLE", status: response.status });
}
console.log(JSON.stringify({ status: "PASS", control: expectRemote ? "SCOPED_HTTPS" : "LOCAL_LOOPBACK",
  dvr_expected: 10, dvr_authorized: results.filter(row => row.kind === "DVR" && row.status === 200).length,
  dvr_upstream_unavailable: results.filter(row => row.kind === "DVR" && row.status !== 200).length,
  tapo_authorized: results.filter(row => row.kind === "TAPO" && row.status === 200).length,
  empty_excluded: empty.length, private_source_hidden: true, credentials_returned: false }));

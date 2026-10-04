import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { chmodSync, existsSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

const SITE_ID = "cc1673b8-3eb0-4785-a12c-1fb88f425a41";
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const checkedSecret = name => {
  const path = realpathSync(resolve(option(name)));
  if (!path.startsWith(restricted) || !statSync(path).isFile() || (statSync(path).mode & 0o077) !== 0)
    throw new Error(`P38_REMOTE_PHONE_${name.toUpperCase().replace(/-/g, "_")}_UNSAFE`);
  return JSON.parse(readFileSync(path, "utf8"));
};
const qaSecret = checkedSecret("qa-secret");
const runtimeSecret = checkedSecret("runtime-secret");
if (qaSecret.protocol !== "observer-push38-remote-client-secret-v1" || !qaSecret.user_id || !qaSecret.email ||
  runtimeSecret.protocol !== "observer-push38-remote-runtime-secrets-v1" ||
  !/^[A-Za-z0-9_-]{43}$/.test(runtimeSecret.result_token || ""))
  throw new Error("P38_REMOTE_PHONE_SECRET_INVALID");
const outputPath = name => {
  const path = resolve(option(name));
  if (!path.startsWith(restricted) || existsSync(path)) throw new Error("P38_REMOTE_PHONE_OUTPUT_UNSAFE");
  return path;
};
const qrPath = outputPath("qr-output");
const sessionPath = outputPath("session-output");
const pageOrigin = new URL(option("page-origin") || "https://gateway.ganbatuach.com");
if (pageOrigin.protocol !== "https:" || pageOrigin.hostname !== "gateway.ganbatuach.com" || pageOrigin.username ||
  pageOrigin.password || pageOrigin.pathname !== "/" || pageOrigin.search || pageOrigin.hash)
  throw new Error("P38_REMOTE_PHONE_PAGE_ORIGIN_INVALID");

const run = (command, args, options = {}) => execFileSync(command, args, { encoding: "utf8", timeout: 45_000,
  stdio: [options.input ? "pipe" : "ignore", "pipe", "pipe"], input: options.input,
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    DOCKER_CONTEXT: "colima-push38t" } });
const variables = Object.fromEntries(run("supabase", ["status", "--workdir", process.cwd(), "--output", "env"])
  .split("\n").filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => {
    const separator = line.indexOf("="); const raw = line.slice(separator + 1);
    return [line.slice(0, separator), raw.startsWith('"') ? JSON.parse(raw) : raw];
  }));
if (variables.API_URL !== "http://127.0.0.1:56421" || !variables.PUBLISHABLE_KEY || !variables.JWT_SECRET)
  throw new Error("P38_REMOTE_PHONE_LOCAL_AUTH_REQUIRED");
const now = Math.floor(Date.now() / 1000);
const expires = now + 20 * 60;
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const header = encode({ alg: "HS256", typ: "JWT" });
const payload = encode({ aud: "authenticated", exp: expires, iat: now, iss: "supabase",
  sub: qaSecret.user_id, email: qaSecret.email, role: "authenticated",
  app_metadata: { provider: "email", providers: ["email"], digital_observer_admin: true, qualification: "PUSH38" },
  user_metadata: { product: "digital_observer" }, aal: "aal1", is_anonymous: false });
const accessToken = `${header}.${payload}.${createHmac("sha256", variables.JWT_SECRET)
  .update(`${header}.${payload}`).digest("base64url")}`;
const client = createClient(variables.API_URL, variables.PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
  auth: { persistSession: false, autoRefreshToken: false }
});
const verified = await client.auth.getUser(accessToken);
if (verified.error || verified.data.user?.id !== qaSecret.user_id) throw new Error("P38_REMOTE_PHONE_TOKEN_REJECTED");
const sourceRead = await client.from("digital_observer_camera_sources")
  .select("id,connector_type,status,metadata").eq("observer_site_id", SITE_ID).order("display_name");
if (sourceRead.error || sourceRead.data.length !== 17) throw new Error("P38_REMOTE_PHONE_SOURCE_READ_FAILED");
const assigned = sourceRead.data.filter(row => row.metadata?.channel_assignment === "ASSIGNED");
const empty = sourceRead.data.filter(row => row.metadata?.channel_assignment === "CHANNEL_EMPTY");
const dvr = assigned.filter(row => row.connector_type === "dvr")
  .sort((left, right) => Number(left.metadata?.dvr_channel) - Number(right.metadata?.dvr_channel));
const tapo = assigned.filter(row => row.connector_type === "rtsp");
const dvrAvailable = dvr.filter(row => row.status === "connected");
const dvrUnavailable = dvr.filter(row => row.status !== "connected");
if (dvr.length !== 10 || dvrAvailable.length !== 9 || dvrUnavailable.length !== 1 ||
  Number(dvrUnavailable[0]?.metadata?.dvr_channel) !== 8 || tapo.length !== 1 || tapo[0].status !== "connected" ||
  empty.length !== 6) throw new Error("P38_REMOTE_PHONE_SOURCE_TRUTH_INVALID");
const representativeChannels = new Set([1, 3, 11]);
const sources = [...dvr.map(row => {
  const channel = Number(row.metadata.dvr_channel);
  return { i: row.id, l: `DVR CH${channel}`, k: "DVR", e: channel === 8 ? "DENY" : "ALLOW",
    p: representativeChannels.has(channel) };
}), { i: tapo[0].id, l: "Tapo", k: "TAPO", e: "ALLOW", p: true }];
const config = { t: accessToken, r: runtimeSecret.result_token, s: SITE_ID, c: sources };
const phoneUrl = `${pageOrigin.origin}/push38/remote-playback#${Buffer.from(JSON.stringify(config)).toString("base64url")}`;
run("/opt/homebrew/bin/qrencode", ["-l", "L", "-s", "8", "-m", "4", "-o", qrPath], { input: phoneUrl });
chmodSync(qrPath, 0o600);
writeFileSync(sessionPath, `${JSON.stringify({ protocol: "observer-push38-remote-phone-session-v1",
  status: "READY", issued_at: new Date(now * 1000).toISOString(), expires_at: new Date(expires * 1000).toISOString(),
  client_class: "OWNER_PHONE_BROWSER", edge_software_required: false, source_authorizations: sources.length,
  dvr_authorizations: 10, dvr_visual_samples: [...representativeChannels], tapo_visual_samples: 1,
  expected_dvr_denials: 1, empty_excluded: 6, url_logged: false, secrets_logged: false,
  qr_contains_short_lived_bearer: true }, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ status: "PASS", session: "SHORT_LIVED_RESTRICTED_QR", expires_at: new Date(expires * 1000).toISOString(),
  source_authorizations: sources.length, dvr_visual_samples: representativeChannels.size,
  tapo_visual_samples: 1, edge_software_required: false, secrets_logged: false }));

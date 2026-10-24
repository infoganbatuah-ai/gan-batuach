import { readFileSync, statSync, writeFileSync } from "node:fs";

const [templatePath, outputPath, rawUrl] = process.argv.slice(2);
if (!templatePath || !outputPath || !rawUrl) throw new Error("QA config template, output and HTTPS URL are required");
const qaHost = process.env.PUSH44_QA_HOST;
const tokenFile = process.env.PUSH44_QA_TOKEN_FILE;
const controlOnly = process.env.PUSH44_QA_CONTROL_ONLY === "1";
if (process.env.PUSH44_QA_CONTROL_ONLY && !controlOnly) throw new Error("Unknown QA build mode");
if (!qaHost || !/^qa-iphone-[a-z0-9-]+\.ganbatuach\.com$/.test(qaHost)) {
  throw new Error("One scoped QA hostname is required");
}

const url = new URL(rawUrl);
if (url.protocol !== "https:" || url.hostname !== qaHost || url.username || url.password ||
  url.port || url.search || url.hash) throw new Error("QA URL must be exact HTTPS without credentials or parameters");

const config = JSON.parse(readFileSync(templatePath, "utf8"));
if (config.appId !== "com.ganbatuach.app.qa" || !Array.isArray(config.packageClassList) ||
  config.packageClassList.includes("PushNotificationsPlugin") || config.server?.url) {
  throw new Error("Only the isolated no-Push Personal Team QA bundle may use this endpoint");
}
let target;
if (controlOnly) {
  if (qaHost !== "qa-iphone-device-proof.ganbatuach.com" ||
    rawUrl !== `https://${qaHost}/` || tokenFile) {
    throw new Error("Control-only QA requires the exact origin and no bootstrap token");
  }
  target = rawUrl;
} else {
  if (qaHost === "qa-iphone-device-proof.ganbatuach.com" ||
    url.pathname !== "/digital-observer" || !tokenFile) {
    throw new Error("QA URL must be the exact named HTTPS /digital-observer endpoint with a private token file");
  }
  if (statSync(tokenFile).mode & 0o077) throw new Error("QA token file must be owner-readable only");
  const ownerToken = readFileSync(tokenFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(ownerToken)) throw new Error("QA token must be 256-bit hex");
  target = `https://${qaHost}/__push44/bootstrap?t=${ownerToken}`;
}
config.server = {
  ...config.server,
  url: target,
  cleartext: false,
  allowNavigation: [qaHost]
};
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("PUSH44 Personal Team QA HTTPS configuration prepared; canonical Release configuration untouched");

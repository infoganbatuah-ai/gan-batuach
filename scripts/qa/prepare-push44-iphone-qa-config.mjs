import { readFileSync, statSync, writeFileSync } from "node:fs";

const [templatePath, outputPath, rawUrl] = process.argv.slice(2);
if (!templatePath || !outputPath || !rawUrl) throw new Error("QA config template, output and HTTPS URL are required");
const qaHost = process.env.PUSH44_QA_HOST;
const tokenFile = process.env.PUSH44_QA_TOKEN_FILE;
if (!qaHost || !/^qa-iphone-[a-z0-9-]+\.ganbatuach\.com$/.test(qaHost) || !tokenFile) {
  throw new Error("One scoped QA hostname and private temporary token file are required");
}
if (statSync(tokenFile).mode & 0o077) throw new Error("QA token file must be owner-readable only");
const ownerToken = readFileSync(tokenFile, "utf8").trim();
if (!/^[a-f0-9]{64}$/.test(ownerToken)) throw new Error("QA token must be 256-bit hex");

const url = new URL(rawUrl);
if (url.protocol !== "https:" || url.hostname !== qaHost
  || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/digital-observer") {
  throw new Error("QA URL must be the exact named HTTPS /digital-observer endpoint");
}

const config = JSON.parse(readFileSync(templatePath, "utf8"));
if (config.appId !== "com.ganbatuach.app.qa" || config.packageClassList.includes("PushNotificationsPlugin")) {
  throw new Error("Only the isolated no-Push Personal Team QA bundle may use this endpoint");
}
config.server = {
  ...config.server,
  url: `https://${qaHost}/__push44/bootstrap?t=${ownerToken}`,
  cleartext: false,
  allowNavigation: [qaHost]
};
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("PUSH44 Personal Team QA HTTPS endpoint prepared; canonical Release configuration untouched");

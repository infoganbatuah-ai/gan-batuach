import { readFileSync } from "node:fs";

const [templatePath, outputPath, rawUrl] = process.argv.slice(2);
if (!templatePath || !outputPath || !rawUrl) throw new Error("QA config template, output and HTTPS URL are required");
const qaHost = process.env.PUSH44_QA_HOST;
if (!qaHost || !/^qa-iphone-[a-z0-9-]+\.ganbatuach\.com$/.test(qaHost)) {
  throw new Error("One scoped QA hostname is required");
}

const url = new URL(rawUrl);
if (url.protocol !== "https:" || url.hostname !== qaHost
  || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/digital-observer") {
  throw new Error("QA URL must be the exact named HTTPS /digital-observer endpoint");
}

const config = JSON.parse(readFileSync(templatePath, "utf8"));
if (config.appId !== "com.ganbatuach.app.qa" || config.packageClassList.includes("PushNotificationsPlugin")) {
  throw new Error("Only the isolated no-Push Personal Team QA bundle may use this endpoint");
}
// The old flow embedded a bearer bootstrap token in capacitor.config.json.
// That file is packaged inside the signed IPA and is readable by recipients.
// Keep the disconnected local QA build available, but refuse a remote build
// until a runtime owner-auth handoff exists that never packages the secret.
throw new Error("PUSH44_QA_REMOTE_BUILD_BLOCKED: owner token must not be embedded in an iOS app bundle");

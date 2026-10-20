import { readFileSync, writeFileSync } from "node:fs";

const [templatePath, outputPath, rawUrl] = process.argv.slice(2);
if (!templatePath || !outputPath || !rawUrl) throw new Error("QA config template, output and HTTPS URL are required");

const url = new URL(rawUrl);
if (url.protocol !== "https:" || !/^[a-z0-9-]+\.trycloudflare\.com$/i.test(url.hostname)
  || url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/digital-observer") {
  throw new Error("QA URL must be a protected trycloudflare.com HTTPS /digital-observer endpoint");
}

const config = JSON.parse(readFileSync(templatePath, "utf8"));
if (config.appId !== "com.ganbatuach.app.qa" || config.packageClassList.includes("PushNotificationsPlugin")) {
  throw new Error("Only the isolated no-Push Personal Team QA bundle may use this endpoint");
}
config.server = {
  ...config.server,
  url: url.href,
  cleartext: false,
  allowNavigation: [url.hostname, "login.trycloudflare.com", "cf-cloudflare-quicktunnels.cloudflareaccess.com"]
};
writeFileSync(outputPath, `${JSON.stringify(config, null, 2)}\n`);
console.log("PUSH44 Personal Team QA HTTPS endpoint prepared; canonical Release configuration untouched");

import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const headersFor = (source) => config.headers.find((entry) => entry.source === source)?.headers ?? [];
const cspFor = (source) => headersFor(source).find((header) => header.key.toLowerCase() === "content-security-policy")?.value ?? "";
const requiredSecurityHeaders = ["strict-transport-security", "x-frame-options", "x-content-type-options", "referrer-policy", "permissions-policy"];
const observerSources = ["/digital-observer", "/digital-observer/:path*"];

for (const source of observerSources) {
  const csp = cspFor(source);
  if (!csp.includes("connect-src 'self' https: wss: http://127.0.0.1:18082")) throw new Error(`Missing exact loopback connect-src for ${source}`);
  if (!csp.includes("media-src 'self' blob: https: http://127.0.0.1:18082")) throw new Error(`Missing exact loopback media-src for ${source}`);
  if (csp.includes("upgrade-insecure-requests")) throw new Error(`Observer CSP must not rewrite the local Gateway for ${source}`);
  for (const key of requiredSecurityHeaders) if (!headersFor(source).some((header) => header.key.toLowerCase() === key)) throw new Error(`Missing ${key} for ${source}`);
}

const fallbackSource = "/:path((?!digital-observer(?:/|$)).*)";
const fallbackCsp = cspFor(fallbackSource);
if (!fallbackCsp.includes("upgrade-insecure-requests")) throw new Error("Non-observer routes must retain HTTPS upgrading");
if ((fallbackCsp.match(/http:\/\/127\.0\.0\.1:18082/g) ?? []).length !== 2) throw new Error("Loopback origin must stay exact and limited");

console.log("Observer loopback CSP QA PASS");

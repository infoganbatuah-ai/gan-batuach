// Dormant route policy for a distinct Observer QA origin. The caller must
// establish owner authorization and trusted TLS independently; no server or
// tunnel imports this module today.
export const OBSERVER_QA_HOST = "observer-qa.ganbatuach.com";
const localOrigin = `https://${OBSERVER_QA_HOST}`;
const exactGet = new Set([
  "/digital-observer/login", "/digital-observer/dashboard",
  "/digital-observer/onboarding", "/favicon.ico"
]);
const exactPost = new Set(["/api/digital-observer/auth/login", "/api/auth/logout"]);
const assetPrefixes = ["/_next/static/", "/assets/digital-observer/"];
const secretKeys = /^(?:code|token|token_hash|access_token|refresh_token|id_token|session|password|secret|key)$/i;

function hasRawTraversal(rawPath) {
  if (/%(?:00|25|2f|5c)/i.test(rawPath)) return true;
  for (const segment of rawPath.split("/")) {
    let decoded;
    try { decoded = decodeURIComponent(segment); } catch { return true; }
    if (decoded === "." || decoded === ".." || decoded.includes("\\")) return true;
  }
  return false;
}

function parsedPath(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.startsWith("/") || rawUrl.startsWith("//") ||
      rawUrl.length > 2048 || /[\\\r\n#]/.test(rawUrl)) return null;
  // URL() normalizes dot segments. Inspect the unparsed request target first.
  if (hasRawTraversal(rawUrl.split("?", 1)[0])) return null;
  let url;
  try { url = new URL(rawUrl, localOrigin); } catch { return null; }
  if (url.origin !== localOrigin || /%(?:00|25|2f|5c)/i.test(url.pathname) ||
      url.pathname.includes("//")) return null;
  for (const key of url.searchParams.keys()) if (secretKeys.test(key)) return null;
  return url;
}

export function observerQaRouteAllowed({ method, rawUrl, host, trustedHttps, ownerAuthorized }) {
  if (host !== OBSERVER_QA_HOST || trustedHttps !== true || ownerAuthorized !== true) return false;
  const url = parsedPath(rawUrl);
  if (!url) return false;
  if (method === "POST") return exactPost.has(url.pathname) && !url.search;
  if (method !== "GET" && method !== "HEAD") return false;
  if (url.pathname === "/auth/callback") return false; // No safe native exchange yet.
  if (url.search) {
    // Login errors are intentionally not transported through this dormant
    // profile until the exact callback/session contract is qualified.
    return false;
  }
  return exactGet.has(url.pathname) || assetPrefixes.some((prefix) =>
    url.pathname.startsWith(prefix) && url.pathname.length > prefix.length);
}

export function observerQaRedirect(rawLocation, gate) {
  if (typeof rawLocation !== "string" || rawLocation.length > 2048) return null;
  let destination = rawLocation;
  if (rawLocation.startsWith("https://")) {
    const rawPath = rawLocation.replace(/^https:\/\/[^/?#]+/, "").split("?", 1)[0];
    if (hasRawTraversal(rawPath)) return null;
    let absolute;
    try { absolute = new URL(rawLocation); } catch { return null; }
    if (absolute.origin !== localOrigin || absolute.username || absolute.password ||
        absolute.port || absolute.hash) return null;
    destination = `${absolute.pathname}${absolute.search}`;
  }
  if (!observerQaRouteAllowed({ ...gate, method: "GET", rawUrl: destination })) return null;
  return destination;
}

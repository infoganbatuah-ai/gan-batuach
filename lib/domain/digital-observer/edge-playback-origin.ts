// Server-only allowlist. A source's metadata must never choose a browser destination.
export function edgePlaybackOrigin(gatewayId: string, raw: string | undefined): string | null {
  if (!raw || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gatewayId)) return null;
  let mapping: unknown;
  try { mapping = JSON.parse(raw); } catch { return null; }
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return null;
  const value = (mapping as Record<string, unknown>)[gatewayId];
  if (typeof value !== "string" || value.length > 255) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash
      || url.pathname !== "/" || url.hostname === "localhost" || url.hostname.endsWith(".localhost")
      || /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || !url.hostname.includes(".")) return null;
    return url.origin;
  } catch { return null; }
}

export function localPlaybackAllowed(requestUrl: string, environment: string | undefined): boolean {
  if (environment !== "development") return false;
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(requestUrl).hostname); }
  catch { return false; }
}

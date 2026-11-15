export type NativePushRequest = { requestId: string; siteId: string };

export function parseNativePushRequest(detail: unknown, allowedSiteIds: readonly string[]): NativePushRequest | null {
  if (!detail || typeof detail !== "object") return null;
  const { requestId, siteId } = detail as Record<string, unknown>;
  if (typeof requestId !== "string" || requestId.length === 0 || requestId.length > 128 ||
    typeof siteId !== "string" || !allowedSiteIds.includes(siteId)) return null;
  return { requestId, siteId };
}

export function nativePushResult(request: NativePushRequest, ok: boolean, reason?: string) {
  return { requestId: request.requestId, siteId: request.siteId, ok, ...(reason ? { reason } : {}) };
}

import { z } from "zod";

export const DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT = "digital-observer-mobile-runtime-v1";

const publicObserverPaths = new Set([
  "/digital-observer",
  "/digital-observer/login",
  "/digital-observer/register",
  "/digital-observer/forgot-password",
  "/digital-observer/set-password",
  "/digital-observer/verify",
  "/digital-observer/pricing",
  "/digital-observer/privacy",
  "/digital-observer/trust",
  "/digital-observer/request-demo",
  "/digital-observer/start",
  "/digital-observer/home",
  "/digital-observer/business",
  "/digital-observer/office",
  "/digital-observer/warehouse",
  "/digital-observer/store",
  "/digital-observer/parking_lot"
]);

export function mobileRuntimeRequiresSession(pathname: string) {
  return pathname.startsWith("/digital-observer/") && !publicObserverPaths.has(pathname);
}

export const mobileLinkKinds = ["camera", "event", "incident", "evidence", "investigation", "notification"] as const;
export type MobileLinkKind = (typeof mobileLinkKinds)[number];

const uuid = z.string().uuid();
const parsedLinkSchema = z.object({
  kind: z.enum(mobileLinkKinds),
  observerSiteId: uuid,
  resourceId: uuid.optional()
}).superRefine((value, context) => {
  if (value.kind !== "investigation" && !value.resourceId) {
    context.addIssue({ code: "custom", message: "RESOURCE_ID_REQUIRED" });
  }
});

export type ParsedMobileLink = z.infer<typeof parsedLinkSchema>;

const nativeLinkSchemes = new Set(["digitalobserver:", "observerqaapp:", "observerqaandroid:"]);

// Native package IDs are checked locally before forwarding a captured URL to
// the server. This is routing isolation, not server-side device attestation.
export function nativeAppAcceptsMobileLink(rawUrl: string, appId: string, platform: string, currentOrigin: string): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  const expected = platform === "ios" && appId === "com.digitalobserver.app.qa" ? "observerqaapp:" :
    platform === "android" && appId === "com.digitalobserver.app.qa" ? "observerqaandroid:" :
    ["ios", "android"].includes(platform) && ["com.ganbatuach.app", "com.ganbatuach.app.qa"].includes(appId) ? "digitalobserver:" : null;
  if (!expected || url.username || url.password || url.port || url.hash) return false;
  // The Observer Android QA intent filter admits only the six resource hosts
  // and the separate native return authority. A resource link carries exactly
  // one site selector; never forward unknown query fields (including tokens).
  if (platform === "android" && appId === "com.digitalobserver.app.qa" &&
      (url.searchParams.size !== 1 || !url.searchParams.has("site"))) return false;
  if (url.protocol === "https:") {
    // A shared origin is not an installation identity. Only the distinct
    // Observer QA app may consume Observer HTTPS resource links.
    if (appId !== "com.digitalobserver.app.qa" || url.origin !== currentOrigin ||
        !url.pathname.startsWith("/digital-observer/open/")) return false;
  } else if (url.protocol !== expected) return false;
  try {
    parseMobileLink(rawUrl, [currentOrigin]);
    return true;
  } catch { return false; }
}

/**
 * Parses only the canonical custom scheme and same-product HTTPS paths. The
 * returned route is still untrusted until the server revalidates membership
 * and resource ownership.
 */
export function parseMobileLink(rawUrl: string, allowedHttpsOrigins: string[] = []): ParsedMobileLink {
  if (rawUrl.length > 2_048) throw new Error("MOBILE_LINK_TOO_LONG");
  const url = new URL(rawUrl);
  const customScheme = nativeLinkSchemes.has(url.protocol);
  const allowedHttps = url.protocol === "https:" && allowedHttpsOrigins.includes(url.origin);
  if (!customScheme && !allowedHttps) throw new Error("MOBILE_LINK_ORIGIN_DENIED");
  // The server must enforce the same URL-metadata boundary as the native app.
  // A fragment/userinfo/port is never part of a canonical resource identity.
  if (url.username || url.password || url.port || url.hash)
    throw new Error("MOBILE_LINK_INVALID");
  if (allowedHttps && !url.pathname.startsWith("/digital-observer/open/")) throw new Error("MOBILE_LINK_PATH_DENIED");
  // A resource link is not an Auth return. Reject extra or duplicate query
  // fields before forwarding or persisting it, even if the extra field would
  // otherwise be ignored when building the authorized destination.
  if (url.searchParams.size !== 1 || !url.searchParams.has("site"))
    throw new Error("MOBILE_LINK_INVALID");

  const parts = customScheme
    ? [url.hostname, ...url.pathname.split("/").filter(Boolean)]
    : url.pathname.replace(/^\/digital-observer\/open\/?/, "").split("/").filter(Boolean);
  const kind = parts[0];
  const resourceId = parts[1] || undefined;
  // A deep link identifies at most one resource. Reject trailing path parts
  // instead of silently authorizing a different link than the one received.
  if (parts.length > 2) throw new Error("MOBILE_LINK_INVALID");
  const observerSiteId = url.searchParams.get("site") ?? "";
  const parsed = parsedLinkSchema.safeParse({ kind, resourceId, observerSiteId });
  if (!parsed.success) throw new Error("MOBILE_LINK_INVALID");
  return parsed.data;
}

export function authorizedMobileDestination(link: ParsedMobileLink) {
  const query = new URLSearchParams({ site: link.observerSiteId });
  if (link.resourceId) query.set("selected", link.resourceId);
  const routeByKind: Record<MobileLinkKind, string> = {
    camera: `/digital-observer/sites/${link.observerSiteId}`,
    event: "/digital-observer/incidents",
    incident: "/digital-observer/incidents",
    evidence: "/digital-observer/investigation",
    investigation: "/digital-observer/investigation",
    notification: "/digital-observer/alerts"
  };
  return `${routeByKind[link.kind]}?${query.toString()}`;
}

export type MobileOfflineOperation = {
  id: string;
  kind: "runtime_revalidate" | "push_registration";
  createdAt: string;
  attempts: number;
};

export function sanitizeOfflineQueue(value: unknown, limit = 20): MobileOfflineOperation[] {
  const operation = z.object({
    id: z.string().uuid(),
    kind: z.enum(["runtime_revalidate", "push_registration"]),
    createdAt: z.string().datetime(),
    attempts: z.number().int().min(0).max(5)
  });
  const parsed = z.array(operation).max(100).safeParse(value);
  if (!parsed.success) return [];
  const deduped = new Map(parsed.data.map((item) => [`${item.kind}:${item.id}`, item]));
  return [...deduped.values()].slice(-Math.max(1, Math.min(limit, 20)));
}

export function mobileNotificationPreview(data: { title?: unknown; body?: unknown }) {
  // Native previews deliberately ignore provider bodies. The authorized Product
  // route contains the detail after a fresh authorization check.
  void data;
  return { title: "תצפיתן דיגיטלי", body: "יש עדכון חדש לבדיקה באפליקציה." };
}

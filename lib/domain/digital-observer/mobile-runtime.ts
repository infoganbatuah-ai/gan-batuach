import { z } from "zod";

export const DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT = "digital-observer-mobile-runtime-v1";

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

/**
 * Parses only the canonical custom scheme and same-product HTTPS paths. The
 * returned route is still untrusted until the server revalidates membership
 * and resource ownership.
 */
export function parseMobileLink(rawUrl: string, allowedHttpsOrigins: string[] = []): ParsedMobileLink {
  if (rawUrl.length > 2_048) throw new Error("MOBILE_LINK_TOO_LONG");
  const url = new URL(rawUrl);
  const customScheme = url.protocol === "digitalobserver:";
  const allowedHttps = url.protocol === "https:" && allowedHttpsOrigins.includes(url.origin);
  if (!customScheme && !allowedHttps) throw new Error("MOBILE_LINK_ORIGIN_DENIED");
  if (allowedHttps && !url.pathname.startsWith("/digital-observer/open/")) throw new Error("MOBILE_LINK_PATH_DENIED");

  const parts = customScheme
    ? [url.hostname, ...url.pathname.split("/").filter(Boolean)]
    : url.pathname.replace(/^\/digital-observer\/open\/?/, "").split("/").filter(Boolean);
  const kind = parts[0];
  const resourceId = parts[1] || undefined;
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

export function mobileNotificationPreview(_data: { title?: unknown; body?: unknown }) {
  // Native previews deliberately ignore provider bodies. The authorized Product
  // route contains the detail after a fresh authorization check.
  return { title: "תצפיתן דיגיטלי", body: "יש עדכון חדש לבדיקה באפליקציה." };
}

import { z } from "zod";
import { DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT } from "./mobile-runtime";

const runtimePayload = z.object({
  data: z.object({
    contract: z.literal(DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT),
    session: z.object({ active: z.literal(true), profile_id: z.string().uuid() }),
    sites: z.array(z.object({
      id: z.string().uuid(), name: z.string(), timezone: z.string().nullable()
    })).max(100)
  })
});

export function verifiedMobileRuntimeSites(payload: unknown) {
  const parsed = runtimePayload.safeParse(payload);
  if (!parsed.success) throw new Error("RUNTIME_RESPONSE_UNTRUSTED");
  const sites = parsed.data.data.sites;
  if (new Set(sites.map((site) => site.id)).size !== sites.length) {
    throw new Error("RUNTIME_RESPONSE_UNTRUSTED");
  }
  return sites;
}

export function scopedPushRevocationConfirmed(payload: unknown) {
  const parsed = z.object({
    data: z.object({
      confirmed: z.literal(true),
      devices: z.array(z.object({ id: z.string(), is_active: z.literal(false) }))
    })
  }).safeParse(payload);
  return parsed.success;
}

export async function resolveNativePushSite(
  authorizedSiteIds: string[],
  savedSiteId: string | null,
  requestedSiteId: string | null,
  revokeSaved: (siteId: string) => Promise<void>
) {
  const authorized = new Set(authorizedSiteIds);
  const requestedAllowed = requestedSiteId !== null && authorized.has(requestedSiteId);
  const savedAllowed = savedSiteId !== null && authorized.has(savedSiteId);
  const mustRevokeSaved = savedSiteId !== null &&
    (!savedAllowed || (requestedAllowed && requestedSiteId !== savedSiteId));
  if (mustRevokeSaved) await revokeSaved(savedSiteId);
  if (requestedSiteId !== null && !requestedAllowed) throw new Error("PUSH_SITE_REVOKED");
  // No implicit first-Site fallback: a different Site needs a fresh explicit
  // enable action, even after the former Site's revocation is confirmed.
  return { siteId: requestedSiteId ?? (savedAllowed && !mustRevokeSaved ? savedSiteId : null),
    revokedSiteId: mustRevokeSaved ? savedSiteId : null };
}

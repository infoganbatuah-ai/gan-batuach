import { z } from "zod";
import { DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT } from "./mobile-runtime";

export const browserPushBindingKey = "digital_observer_fcm_binding_v1";
const legacyDeviceReferenceKey = "digital_observer_device_reference";

const bindingSchema = z.object({
  version: z.literal(1),
  profileId: z.string().uuid(),
  siteId: z.string().uuid(),
  deviceReference: z.string().uuid()
}).strict();

export type BrowserPushBinding = z.infer<typeof bindingSchema>;
type BindingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function browserPushConflictMessage(previousSiteRevoked: boolean) {
  const blocked = "הטוקן שהתקבל כבר משויך או בוטל בשרת. רישום Push חדש לא הושלם; ביטול חוזר לבדו לא יפתור זאת. דרוש טוקן חדש או מסלול שיוך מחדש מבוקר.";
  return previousSiteRevoked ? `רישום ה־Push באתר הקודם בוטל. ${blocked}` : blocked;
}

export function readBrowserPushBinding(storage: BindingStorage): BrowserPushBinding | null {
  const raw = storage.getItem(browserPushBindingKey);
  if (!raw) {
    // The old browser registration did not retain an owner or Site. Guessing
    // either would risk orphaning another active server-side token.
    if (storage.getItem(legacyDeviceReferenceKey)) throw new Error("PUSH_LEGACY_BINDING_UNSCOPED");
    return null;
  }
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error("PUSH_BINDING_UNTRUSTED"); }
  const parsed = bindingSchema.safeParse(value);
  if (!parsed.success) throw new Error("PUSH_BINDING_UNTRUSTED");
  return parsed.data;
}

export function saveBrowserPushBinding(storage: BindingStorage, binding: BrowserPushBinding) {
  storage.setItem(browserPushBindingKey, JSON.stringify(bindingSchema.parse(binding)));
}

const legacyLookupSchema = z.object({ data: z.object({
  confirmed: z.literal(true),
  profile_id: z.string().uuid(),
  device_id: z.string().uuid(),
  observer_site_id: z.string().uuid()
}) });

export function recoverLegacyBrowserPushBinding(storage: BindingStorage, payload: unknown) {
  const reference = storage.getItem(legacyDeviceReferenceKey);
  if (!reference || storage.getItem(browserPushBindingKey)) throw new Error("PUSH_LEGACY_BINDING_UNTRUSTED");
  const parsed = legacyLookupSchema.safeParse(payload);
  if (!parsed.success || parsed.data.data.device_id !== reference) throw new Error("PUSH_LEGACY_BINDING_UNTRUSTED");
  const binding: BrowserPushBinding = { version: 1, profileId: parsed.data.data.profile_id,
    siteId: parsed.data.data.observer_site_id, deviceReference: reference };
  saveBrowserPushBinding(storage, binding);
  storage.removeItem(legacyDeviceReferenceKey);
  return binding;
}

export function clearConfirmedBrowserPushBinding(storage: BindingStorage, binding: BrowserPushBinding) {
  const current = readBrowserPushBinding(storage);
  if (!current || JSON.stringify(current) !== JSON.stringify(binding)) {
    throw new Error("PUSH_BINDING_CHANGED");
  }
  storage.removeItem(browserPushBindingKey);
}

const runtimeSchema = z.object({
  data: z.object({
    contract: z.literal(DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT),
    session: z.object({ active: z.literal(true), profile_id: z.string().uuid() }),
    sites: z.array(z.object({ id: z.string().uuid() })).max(100)
  })
});

export function verifiedBrowserPushRuntime(payload: unknown) {
  const parsed = runtimeSchema.safeParse(payload);
  if (!parsed.success) throw new Error("RUNTIME_RESPONSE_UNTRUSTED");
  const siteIds = parsed.data.data.sites.map((site) => site.id);
  if (new Set(siteIds).size !== siteIds.length) throw new Error("RUNTIME_RESPONSE_UNTRUSTED");
  return { profileId: parsed.data.data.session.profile_id, siteIds };
}

export function confirmedBrowserPushRevocation(payload: unknown, binding: BrowserPushBinding) {
  return z.object({ data: z.object({
    confirmed: z.literal(true),
    profile_id: z.literal(binding.profileId),
    devices: z.array(z.object({ id: z.string(), is_active: z.literal(false) }))
  }) }).safeParse(payload).success;
}

export async function reconcileBrowserPushBinding(
  binding: BrowserPushBinding | null,
  runtime: { profileId: string; siteIds: string[] },
  requestedSiteId: string | null,
  revoke: (binding: BrowserPushBinding) => Promise<void>
) {
  if (binding && binding.profileId !== runtime.profileId) throw new Error("PUSH_OWNER_CHANGED");
  if (binding && (!runtime.siteIds.includes(binding.siteId)
    || (requestedSiteId !== null && binding.siteId !== requestedSiteId))) {
    await revoke(binding);
    if (requestedSiteId && !runtime.siteIds.includes(requestedSiteId)) throw new Error("PUSH_SITE_REVOKED");
    return { revoked: true, binding: null };
  }
  if (requestedSiteId && !runtime.siteIds.includes(requestedSiteId)) throw new Error("PUSH_SITE_REVOKED");
  return { revoked: false, binding };
}

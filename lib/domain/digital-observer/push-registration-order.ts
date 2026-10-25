export type ObserverPushRegistration = {
  siteId: string;
  deviceLabel: string;
  deviceReference: string;
  platform: "web" | "android" | "ios";
  deviceToken?: string;
  appVersion?: string;
  source: "digital_observer_native" | "digital_observer_fcm";
};

// The site operation performs the canonical server-side manage check. A
// rejected Site must never leave a newly registered Push token behind.
export async function registerObserverPushAfterSiteGate(
  input: ObserverPushRegistration,
  post: (path: string, body: Record<string, unknown>) => Promise<unknown>
) {
  await post("/api/digital-observer/access-settings", {
    action: "register_device",
    observer_site_id: input.siteId,
    device_label: input.deviceLabel,
    platform: input.platform,
    device_reference: input.deviceReference
  });
  if (!input.deviceToken) return;
  await post("/api/push/register", {
    platform: input.platform,
    device_token: input.deviceToken,
    device_id: input.deviceReference,
    ...(input.appVersion ? { app_version: input.appVersion } : {}),
    metadata: { source: input.source, observer_site_id: input.siteId }
  });
}

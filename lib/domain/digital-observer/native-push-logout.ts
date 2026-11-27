export async function currentNativePushDeviceId(): Promise<string | null> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;

  const { Preferences } = await import("@capacitor/preferences");
  const site = await Preferences.get({ key: "digital_observer_native_push_site_v1" });
  if (!site.value) return null;
  if (Capacitor.getPlatform() === "ios") {
    const { App } = await import("@capacitor/app");
    const { id } = await App.getInfo();
    if (!id) throw new Error("PUSH_APP_ID_MISSING");
    // This bundle cannot register for native Push. Old preferences must not
    // turn its normal sign-out into a server-side token revocation.
    if (id === "com.digitalobserver.app.qa") return null;
  }
  const device = await Preferences.get({ key: "digital_observer_native_device_reference_v1" });
  if (!device.value) throw new Error("PUSH_DEVICE_ID_MISSING");
  return device.value;
}

export async function currentNativePushOwnerId(): Promise<string | null> {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const { Preferences } = await import("@capacitor/preferences");
  const owner = await Preferences.get({ key: "digital_observer_native_push_owner_v1" });
  return owner.value || null;
}

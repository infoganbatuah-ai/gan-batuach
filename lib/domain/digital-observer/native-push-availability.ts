// Offline QA packages have no qualified provider identity. Preserve the real
// Gan package (which can open Observer screens) and the future Observer release
// package; deny unknown IDs and platforms on both native systems.
export function observerNativePushAvailable(input: {
  appId: string | null | undefined;
  platform: string;
  pluginAvailable: boolean;
}): boolean {
  if (!input.pluginAvailable || !input.appId || !["android", "ios"].includes(input.platform)) return false;
  return input.appId === "com.ganbatuach.app" || input.appId === "com.digitalobserver.app";
}

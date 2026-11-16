// The offline Android QA app has no provider identity. Keep native Push available
// for other, separately qualified packages; fail closed if the app ID is unknown.
export function observerNativePushAvailable(input: {
  appId: string | null | undefined;
  platform: string;
  pluginAvailable: boolean;
}): boolean {
  if (!input.pluginAvailable || !input.appId) return false;
  if (input.platform === "android") return input.appId === "com.digitalobserver.app";
  return true;
}

// Preparatory build contract only. No origin, callback, or remote runtime is
// activated by importing this module or by validating a candidate.
export const OBSERVER_QA_ORIGIN = "https://observer-qa.ganbatuach.com";
export const OBSERVER_QA_BUNDLE_ID = "com.digitalobserver.app.qa";
export const OBSERVER_QA_CALLBACK = "observerqaapp://return/qa/device-proof";
export const OBSERVER_QA_ANDROID_CALLBACK = "observerqaandroid://return/qa/device-proof";

export function validateObserverQaAuthBuild(input) {
  const firstPartyLogin = input?.firstPartyLogin === "1";
  if (input?.firstPartyLogin !== undefined && (!firstPartyLogin || input?.platform !== "ios")) {
    throw new Error("OBSERVER_QA_FIRST_PARTY_LOGIN_INVALID");
  }
  const startPath = firstPartyLogin ? "digital-observer/login" : "digital-observer/dashboard";
  const expectedCallback = input?.platform === "ios" ? OBSERVER_QA_CALLBACK :
    input?.platform === "android" ? OBSERVER_QA_ANDROID_CALLBACK : null;
  if (input?.optIn !== "1" || input?.bundleId !== OBSERVER_QA_BUNDLE_ID ||
      !expectedCallback || input?.callback !== expectedCallback ||
      input?.origin !== OBSERVER_QA_ORIGIN ||
      input?.launchUrl !== `${OBSERVER_QA_ORIGIN}/${startPath}`) {
    throw new Error("OBSERVER_QA_AUTH_BUILD_NOT_APPROVED");
  }
  const url = new URL(input.launchUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      url.search || url.hash || url.hostname !== "observer-qa.ganbatuach.com") {
    throw new Error("OBSERVER_QA_AUTH_BUILD_INVALID_URL");
  }
  return Object.freeze({
    bundleId: OBSERVER_QA_BUNDLE_ID,
    origin: OBSERVER_QA_ORIGIN,
    launchUrl: input.launchUrl,
    callback: expectedCallback
  });
}

export function prepareObserverQaAuthConfig(input, offlineConfig) {
  const contract = validateObserverQaAuthBuild(input);
  if (!offlineConfig || offlineConfig.appId !== contract.bundleId ||
      offlineConfig.appName !== "תצפיתן דיגיטלי" ||
      offlineConfig.webDir !== "public" || offlineConfig.server?.url || offlineConfig.server?.appStartPath !== undefined ||
      offlineConfig.plugins?.PushNotifications ||
      offlineConfig.packageClassList?.includes("PushNotificationsPlugin")) {
    throw new Error("OBSERVER_QA_OFFLINE_TEMPLATE_INVALID");
  }
  if (input.platform === "ios" && offlineConfig.server.iosScheme !== "capacitor") {
    throw new Error("OBSERVER_QA_IOS_TEMPLATE_INVALID");
  }
  if (input.platform === "android" && offlineConfig.server.androidScheme !== "https") {
    throw new Error("OBSERVER_QA_ANDROID_TEMPLATE_INVALID");
  }
  if (input.platform !== "ios" && input.platform !== "android") {
    throw new Error("OBSERVER_QA_PLATFORM_INVALID");
  }
  if (input.firstPartyLogin === "1") {
    if (Object.keys(offlineConfig.server).some(key => key !== "iosScheme")) {
      throw new Error("OBSERVER_QA_UNEXPECTED_SERVER_SETTING");
    }
    // Capacitor uses a string prefix to classify top-level navigations. The
    // trailing slash keeps the form POST on-origin and excludes sibling hosts.
    return { ...offlineConfig, server: { iosScheme: "capacitor", cleartext: false,
      url: contract.origin + "/", appStartPath: "digital-observer/login" } };
  }
  return {
    ...offlineConfig,
    server: { ...offlineConfig.server, url: contract.launchUrl, cleartext: false }
  };
}

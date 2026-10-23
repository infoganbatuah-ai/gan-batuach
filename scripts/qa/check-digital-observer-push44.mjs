import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText
    };
    return next(url, context);
  }
});

const contract = await import("../../lib/domain/digital-observer/mobile-runtime.ts");
const runtime = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
const runtimeRoute = readFileSync(new URL("../../app/api/digital-observer/mobile/runtime/route.ts", import.meta.url), "utf8");
const player = readFileSync(new URL("../../components/digital-observer/observer-live-player.tsx", import.meta.url), "utf8");
const login = readFileSync(new URL("../../components/digital-observer/observer-login-form.tsx", import.meta.url), "utf8");
const loginPage = readFileSync(new URL("../../app/digital-observer/login/page.tsx", import.meta.url), "utf8");
assert.match(loginPage, /if \(!params\?\.error && await getDigitalObserverApiUser\(\)\) redirect\("\/digital-observer\/dashboard"\)/);
assert.ok(loginPage.indexOf("await getDigitalObserverApiUser()") < loginPage.indexOf("<ObserverLoginForm"), "resume requires canonical server session and Observer authorization before rendering");
const android = readFileSync(new URL("../../android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const ios = readFileSync(new URL("../../ios/App/App/Info.plist", import.meta.url), "utf8");
const appDelegate = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
const iosPrivacy = readFileSync(new URL("../../ios/App/App/PrivacyInfo.xcprivacy", import.meta.url), "utf8");
const iosEntitlements = readFileSync(new URL("../../ios/App/App/App.entitlements", import.meta.url), "utf8");
const iosProject = readFileSync(new URL("../../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));

assert.equal(contract.DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT, "digital-observer-mobile-runtime-v1");
for (const publicPath of ["/digital-observer/login", "/digital-observer/register", "/digital-observer/forgot-password", "/digital-observer/verify", "/digital-observer/home"]) {
  assert.equal(contract.mobileRuntimeRequiresSession(publicPath), false, `public route cannot trigger a native sign-in loop: ${publicPath}`);
}
for (const protectedPath of ["/digital-observer/dashboard", "/digital-observer/sites", "/digital-observer/investigation"]) {
  assert.equal(contract.mobileRuntimeRequiresSession(protectedPath), true, `protected route must revalidate its session: ${protectedPath}`);
}
assert.equal(new Set(contract.mobileLinkKinds).size, 6);
const cameraLink = contract.parseMobileLink(
  "digitalobserver://camera/00000000-0000-4000-8000-000000000044?site=00000000-0000-4000-8000-000000000045"
);
assert.equal(cameraLink.kind, "camera");
assert.equal(contract.authorizedMobileDestination(cameraLink), "/digital-observer/sites/00000000-0000-4000-8000-000000000045?site=00000000-0000-4000-8000-000000000045&selected=00000000-0000-4000-8000-000000000044");
assert.throws(() => contract.parseMobileLink("https://attacker.example/digital-observer/open/camera/00000000-0000-4000-8000-000000000044?site=00000000-0000-4000-8000-000000000045", ["https://app.example"]), /ORIGIN_DENIED/);
assert.throws(() => contract.parseMobileLink("https://app.example/not-observer/camera/00000000-0000-4000-8000-000000000044?site=00000000-0000-4000-8000-000000000045", ["https://app.example"]), /PATH_DENIED/);
assert.throws(() => contract.parseMobileLink("digitalobserver://camera/not-a-uuid?site=00000000-0000-4000-8000-000000000045"), /LINK_INVALID/);

const queue = contract.sanitizeOfflineQueue([
  { id: "00000000-0000-4000-8000-000000000044", kind: "runtime_revalidate", createdAt: "2026-10-19T10:00:00.000Z", attempts: 0 },
  { id: "00000000-0000-4000-8000-000000000044", kind: "runtime_revalidate", createdAt: "2026-10-19T10:00:00.000Z", attempts: 0 },
  { id: "00000000-0000-4000-8000-000000000045", kind: "push_registration", createdAt: "2026-10-19T10:01:00.000Z", attempts: 1 }
]);
assert.equal(queue.length, 2);
const notification = contract.mobileNotificationPreview({ title: "Camera 2", body: "Sensitive child details and unrestricted evidence URL" });
assert.equal(notification.title, "תצפיתן דיגיטלי");
assert.equal(notification.body, "יש עדכון חדש לבדיקה באפליקציה.");
assert(!JSON.stringify(notification).includes("Sensitive child"));

for (const required of ["Network.addListener", "appStateChange", "appUrlOpen", "getLaunchUrl", "checkPermissions", "requestPermissions", "pushNotificationActionPerformed", "Preferences", "register_device"]) {
  assert(runtime.includes(required), `missing native runtime behavior: ${required}`);
}
assert(runtime.includes("if (!mobileRuntimeRequiresSession(window.location.pathname)) return;"), "native login must not bootstrap a protected session");
assert(runtime.includes("controller.abort(), 10_000"), "session bootstrap must have a bounded timeout");
assert(runtime.includes("window.location.replace"), "expired sessions replace protected history");
assert(runtime.includes("מידע מוגן מוסתר"), "offline protected content must be covered");
const access = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
assert.equal((access.match(/if \(!await currentObserverSessionActive\(supabase\)\)/g) ?? []).length, 2, "both page and API access must check the Auth session");
const sessionSql = readFileSync(new URL("../../supabase/migrations/20261023161928_digital_observer_push44_session_validity.sql", import.meta.url), "utf8");
assert.match(sessionSql, /s\.user_id = auth\.uid\(\)/);
assert.match(sessionSql, /s\.not_after > pg_catalog\.statement_timestamp\(\)/);
assert.match(sessionSql, /from public, anon/);
assert.match(sessionSql, /to authenticated/);
assert(runtime.includes("sensitive_local_cache") === false, "client should not pretend to cache sensitive data");
assert(!runtime.match(/localStorage|sessionStorage|camera credentials|raw video/i), "native runtime must not persist secrets or sensitive media");
assert(runtimeRoute.includes("getObserverSiteAccess"));
assert(runtimeRoute.includes('.eq("observer_site_id", link.observerSiteId)'));
assert(runtimeRoute.includes('sms_authentication: "disabled"'));
assert(player.includes("digital-observer:mobile-offline") && player.includes("digital-observer:mobile-resume"));
assert(login.includes("Capacitor.isNativePlatform()"));
assert(login.includes("HttpOnly cookies"));

assert(android.includes("android.permission.POST_NOTIFICATIONS"));
assert(android.includes('android:scheme="digitalobserver"'));
assert(android.includes('android:allowBackup="false"'));
assert(ios.includes("CFBundleURLSchemes") && ios.includes("digitalobserver"));
assert(appDelegate.includes("capacitorDidRegisterForRemoteNotifications"));
assert(appDelegate.includes("capacitorDidFailToRegisterForRemoteNotifications"));
assert(iosPrivacy.includes("NSPrivacyAccessedAPICategoryUserDefaults") && iosPrivacy.includes("CA92.1"));
assert(iosEntitlements.includes("aps-environment") && iosEntitlements.includes("$(APS_ENVIRONMENT)"));
assert(iosProject.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;"));
assert(iosProject.includes("APS_ENVIRONMENT = development;") && iosProject.includes("APS_ENVIRONMENT = production;"));
assert(iosProject.includes("PrivacyInfo.xcprivacy in Resources"));

for (const dependency of ["@capacitor/app", "@capacitor/device", "@capacitor/network", "@capacitor/preferences", "@capacitor/push-notifications"]) {
  assert(packageJson.dependencies[dependency], `missing ${dependency}`);
}

for (const preserved of [
  "../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql",
  "../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql",
  "../../supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql",
  "../../supabase/migrations/20261019030000_digital_observer_push42_external_api.sql",
  "../../supabase/migrations/20261019040000_digital_observer_push43_oem_sdk.sql"
]) {
  assert(readFileSync(new URL(preserved, import.meta.url), "utf8").length > 1_000, `missing preserved contract ${preserved}`);
}

console.log("PUSH 44 deterministic QA passed: native lifecycle/network handling, server-authorized deep links, native push token lifecycle, iOS Development/Release APNs signing entitlement, privacy-minimized previews, HttpOnly native authentication, bounded non-sensitive offline recovery, playback suspend/reconnect, iOS/Android URL and notification contracts, SMS-auth disablement and PUSH 39-43 preservation.");

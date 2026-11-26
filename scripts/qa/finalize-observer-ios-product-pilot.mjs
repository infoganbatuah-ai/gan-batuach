import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { pathToFileURL } from "node:url";

const appId = "com.digitalobserver.app.pilot";
const appName = "תצפיתן דיגיטלי פיילוט";
const startPath = "digital-observer/login";
const fallback = "<!doctype html><html lang=\"he\" dir=\"rtl\"><meta charset=\"utf-8\">"
  + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
  + "<title>תצפיתן דיגיטלי</title><p>החיבור לתצפיתן אינו זמין כרגע.</p></html>";

export function finalizeProductPilot(app) {
  if (extname(app) !== ".app" || !lstatSync(app).isDirectory()) throw new Error("PRODUCT_PILOT_APP_REQUIRED");
  for (const name of ["_CodeSignature", "embedded.mobileprovision", "GoogleService-Info.plist"]) {
    if (existsSync(join(app, name))) throw new Error("PRODUCT_PILOT_UNSIGNED_ONLY");
  }
  const info = JSON.parse(execFileSync("/usr/bin/plutil",
    ["-convert", "json", "-o", "-", join(app, "Info.plist")], { encoding: "utf8" }));
  if (info.CFBundleIdentifier !== appId || info.CFBundleDisplayName !== appName
    || !info.UILaunchScreen || typeof info.UILaunchScreen !== "object" || Array.isArray(info.UILaunchScreen)
    || ["UIMainStoryboardFile", "UILaunchStoryboardName", "UIApplicationSceneManifest", "CFBundleURLTypes", "aps-environment", "com.apple.developer.associated-domains",
      "NSAppTransportSecurity", "UIBackgroundModes"].some(key => Object.hasOwn(info, key))) {
    throw new Error("PRODUCT_PILOT_IDENTITY_OR_CAPABILITIES_INVALID");
  }

  // Replace only generated WebView resources in the unsigned pilot bundle.
  const publicDir = join(app, "public");
  rmSync(publicDir, { recursive: true, force: true });
  mkdirSync(join(publicDir, "digital-observer"), { recursive: true });
  writeFileSync(join(publicDir, "index.html"), fallback);
  writeFileSync(join(publicDir, startPath), fallback);
  writeFileSync(join(publicDir, "offline.html"), fallback);
  const config = {
    appId, appName, webDir: "public",
    server: {
      url: "https://gan-batuach.vercel.app/",
      appStartPath: startPath, errorPath: "offline.html", cleartext: false, iosScheme: "capacitor"
    },
    packageClassList: ["AppPlugin"]
  };
  // Replace a resource symlink rather than writing through it.
  const configPath = join(app, "capacitor.config.json");
  rmSync(configPath, { force: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", { flag: "wx" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error("Usage: node finalize-observer-ios-product-pilot.mjs <unsigned App.app>");
  finalizeProductPilot(process.argv[2]);
}

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const source = readFileSync(new URL("capacitor.config.ts", root), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

function config(env) {
  const exports = {};
  runInNewContext(compiled, { exports, process: { env }, URL });
  return exports.default;
}

const observerEnv = {
  CAPACITOR_PRODUCT: "observer",
  CAPACITOR_BUILD_PROFILE: "qa",
  CAPACITOR_SERVER_URL: "https://observer-qa.example.test/digital-observer/dashboard",
  CAPACITOR_ALLOWED_SERVER_ORIGIN: "https://observer-qa.example.test"
};

test("Observer Android QA has its own identity and exact Development launch surface", () => {
  const observer = config(observerEnv);
  const gan = config({
    CAPACITOR_BUILD_PROFILE: "qa", CAPACITOR_SERVER_URL: "https://gan-qa.example.test",
    CAPACITOR_ALLOWED_SERVER_ORIGIN: "https://gan-qa.example.test"
  });
  assert.equal(observer.appId, "com.digitalobserver.app.qa");
  assert.equal(observer.appName, "תצפיתן דיגיטלי");
  assert.equal(observer.server.url, observerEnv.CAPACITOR_SERVER_URL);
  assert.equal(observer.server.cleartext, false);
  assert.equal(gan.appId, "com.ganbatuach.app.qa");
  assert.equal(gan.appName, "גן בטוח");
  assert.notEqual(observer.appId, gan.appId);
});

test("Observer selection fails closed on wrong profile, URL, origin or product", () => {
  for (const profile of ["development", "release"]) {
    assert.throws(() => config({ ...observerEnv, CAPACITOR_BUILD_PROFILE: profile }), /CAPACITOR_OBSERVER_QA_ONLY/);
  }
  assert.throws(() => config({ ...observerEnv, CAPACITOR_SERVER_URL: "https://gan-qa.example.test" }), /CAPACITOR_SERVER_URL_INVALID/);
  assert.throws(() => config({ ...observerEnv, CAPACITOR_SERVER_URL: "https://observer-qa.example.test/cameras" }), /CAPACITOR_SERVER_URL_INVALID/);
  assert.throws(() => config({ ...observerEnv, CAPACITOR_ALLOWED_SERVER_ORIGIN: "https://gan-qa.example.test" }), /CAPACITOR_SERVER_ORIGIN_NOT_APPROVED/);
  assert.throws(() => config({ ...observerEnv, CAPACITOR_PRODUCT: "unknown" }), /CAPACITOR_PRODUCT_INVALID/);
  assert.throws(() => config({ ...observerEnv, CAPACITOR_PRODUCT: "gan" }), /CAPACITOR_SERVER_URL_INVALID/);
});

test("Android packaging binds the selected product and denies Gan Push config for Observer", () => {
  const gradle = readFileSync(new URL("android/app/build.gradle", root), "utf8");
  const manifest = readFileSync(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
  assert.match(gradle, /applicationId = mobileProduct == 'observer' \? 'com\.digitalobserver\.app' : 'com\.ganbatuach\.app'/);
  assert.match(gradle, /CAPACITOR_OBSERVER_GAN_PUSH_CONFIG_FORBIDDEN/);
  assert.match(gradle, /CAPACITOR_PRODUCT_LAUNCH_PATH_MISMATCH/);
  assert.match(gradle, /CAPACITOR_APP_NAME_MISMATCH/);
  assert.match(gradle, /mobileCallbackScheme: mobileProduct == 'observer' \? 'observerqaandroid' : 'digitalobserver'/);
  assert.match(manifest, /android:label="\$\{mobileAppLabel\}"/);
  assert.match(manifest, /android:scheme="\$\{mobileCallbackScheme\}"/);
  assert.match(manifest, /android:icon="\$\{mobileLauncherIcon\}"/);
  assert.match(manifest, /android:roundIcon="\$\{mobileRoundIcon\}"/);
  assert.match(manifest, /android:theme="\$\{mobileLaunchTheme\}"/);
  assert.match(gradle, /mobileLauncherIcon: mobileProduct == 'observer' \? '@drawable\/observer_qa_icon' : '@mipmap\/ic_launcher'/);
  assert.match(gradle, /mobileLaunchTheme: mobileProduct == 'observer' \? '@style\/ObserverQALaunch' : '@style\/AppTheme\.NoActionBarLaunch'/);
});

test("Observer QA reuses distinct approved visual assets without changing Gan defaults", () => {
  const styles = readFileSync(new URL("android/app/src/main/res/values/styles.xml", root), "utf8");
  const splash = readFileSync(new URL("android/app/src/main/res/drawable/observer_qa_splash.xml", root), "utf8");
  assert.match(styles, /name="ObserverQALaunch"/);
  assert.match(styles, /windowSplashScreenAnimatedIcon">@drawable\/observer_qa_launch_mark/);
  assert.match(splash, /@drawable\/observer_qa_launch_mark/);
  const digest = (path) => createHash("sha256").update(readFileSync(new URL(path, root))).digest("hex");
  assert.equal(digest("android/app/src/main/res/drawable-nodpi/observer_qa_icon.png"),
    digest("ios/App/App/Assets.xcassets/ObserverQAIcon.appiconset/ObserverQAIcon.png"));
  assert.equal(digest("android/app/src/main/res/drawable-nodpi/observer_qa_launch_mark.png"),
    digest("ios/App/App/Assets.xcassets/ObserverQALaunchMark.imageset/ObserverQALaunchMark.png"));
  assert.notEqual(digest("android/app/src/main/res/drawable-nodpi/observer_qa_icon.png"),
    digest("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"));
});

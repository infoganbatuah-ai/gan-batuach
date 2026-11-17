import { execFileSync } from "node:child_process";
import { closeSync, lstatSync, openSync, readSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

const bundleId = "com.digitalobserver.app.qa";
const nestedBundles = new Set([".framework", ".appex", ".xpc", ".app"]);
const machOMagic = new Set(["feedface", "feedfacf", "cefaedfe", "cffaedfe", "cafebabe", "bebafeca", "cafebabf", "bfbafeca"]);

function codeSign(args) {
  return execFileSync("/usr/bin/codesign", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

export function nestedCodePaths(appPath) {
  const app = resolve(appPath);
  if (!lstatSync(app).isDirectory() || lstatSync(app).isSymbolicLink()) throw new Error("OBSERVER_QA_APP_PATH_INVALID");
  const found = [];
  function isMachO(path) {
    const descriptor = openSync(path, "r");
    try {
      const bytes = Buffer.alloc(4);
      return readSync(descriptor, bytes, 0, 4, 0) === 4 && machOMagic.has(bytes.toString("hex"));
    } finally { closeSync(descriptor); }
  }
  function walk(directory, insideNestedBundle = false) {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new Error(`OBSERVER_QA_SYMLINK_FORBIDDEN:${path}`);
      if (stat.isDirectory()) {
        const nested = nestedBundles.has(extname(entry));
        if (nested) found.push(path);
        walk(path, insideNestedBundle || nested);
      } else if (stat.isFile()) {
        if (extname(entry) === ".dylib") found.push(path);
        else if (!insideNestedBundle && !(directory === app && entry === "App") && isMachO(path))
          throw new Error(`OBSERVER_QA_UNEXPECTED_EXECUTABLE:${path}`);
      }
    }
  }
  walk(app);
  return found.sort((a, b) => b.split("/").length - a.split("/").length);
}

export function verifyObserverQaSignatures(appPath) {
  const app = resolve(appPath);
  const actual = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", join(app, "Info.plist")],
    { encoding: "utf8" }).trim();
  if (actual !== bundleId) throw new Error("OBSERVER_QA_BUNDLE_MISMATCH");
  const nested = nestedCodePaths(app);
  for (const path of nested) {
    try { codeSign(["--verify", "--strict", path]); }
    catch { throw new Error(`OBSERVER_QA_NESTED_SIGNATURE_INVALID:${path}`); }
  }
  try { codeSign(["--verify", "--deep", "--strict", app]); }
  catch { throw new Error("OBSERVER_QA_APP_SIGNATURE_INVALID"); }
  const entitlements = codeSign(["-d", "--entitlements", ":-", app]);
  if (/<key>aps-environment<\/key>/.test(entitlements)) throw new Error("OBSERVER_QA_PUSH_ENTITLEMENT_FORBIDDEN");
  return { bundleId: actual, nestedCount: nested.length, pushEntitlement: false };
}

export function signObserverQaApp({ appPath, identity, entitlementsPath }) {
  const app = resolve(appPath);
  if (!/^[A-Fa-f0-9]{40}$/.test(identity ?? "")) throw new Error("OBSERVER_QA_SIGNING_IDENTITY_REQUIRED");
  const actual = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", join(app, "Info.plist")],
    { encoding: "utf8" }).trim();
  if (actual !== bundleId) throw new Error("OBSERVER_QA_BUNDLE_MISMATCH");
  const entitlements = readFileSync(entitlementsPath, "utf8");
  if (/<key>aps-environment<\/key>/.test(entitlements)) throw new Error("OBSERVER_QA_PUSH_ENTITLEMENT_FORBIDDEN");
  for (const path of nestedCodePaths(app)) {
    codeSign(["--force", "--sign", identity, "--timestamp=none", path]);
    codeSign(["--verify", "--strict", path]);
  }
  codeSign(["--force", "--sign", identity, "--timestamp=none", "--entitlements", resolve(entitlementsPath),
    "--generate-entitlement-der", app]);
  return verifyObserverQaSignatures(app);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, appPath, identity, entitlementsPath] = process.argv.slice(2);
  if (mode === "verify" && appPath && !identity && !entitlementsPath) {
    console.log(JSON.stringify(verifyObserverQaSignatures(appPath)));
  } else if (mode === "sign" && appPath && identity && entitlementsPath) {
    console.log(JSON.stringify(signObserverQaApp({ appPath, identity, entitlementsPath })));
  } else throw new Error("Usage: sign-observer-ios-qa.mjs verify APP_PATH | sign APP_PATH IDENTITY_SHA1 ENTITLEMENTS_PATH");
}

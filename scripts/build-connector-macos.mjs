// Build engineering: never installs, enrolls, starts a service or contacts a camera.
// Inputs must be reviewed redistributable binaries. Ad-hoc QA output is NOT a
// signed/notarized commercial release and must never be offered for download.
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const args = Object.fromEntries(process.argv.slice(2).map(arg => { const i = arg.indexOf("="); return [arg.slice(0, i), arg.slice(i + 1)]; }));
for (const name of ["out", "node", "ffmpeg", "ffprobe", "ort", "model"]) if (!args[`--${name}`]) throw new Error(`BUILD_INPUT_REQUIRED_${name}`);
if (process.platform !== "darwin") throw new Error("MACOS_BUILD_HOST_REQUIRED");
const releaseClass = args["--release-class"] || "QA";
const signingIdentity = args["--signing-identity"] || "-";
if (!["QA", "PRODUCTION"].includes(releaseClass)) throw new Error("SIGNING_RELEASE_CLASS_INVALID");
if (releaseClass === "PRODUCTION" && signingIdentity === "-") throw new Error("APPLE_DISTRIBUTION_IDENTITY_REQUIRED");
const version = args["--version"] || "0.1.0";
const buildNumber = args["--build-number"] || "1";
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version) || !/^[1-9]\d*$/.test(buildNumber)) throw new Error("CONNECTOR_RELEASE_VERSION_INVALID");
if (args["--exact-commit"] === "1") {
  execFileSync("git", ["diff", "--quiet", "--exit-code"]);
  execFileSync("git", ["diff", "--cached", "--quiet", "--exit-code"]);
}
const out = resolve(args["--out"]);
if (existsSync(out)) throw new Error("BUILD_OUTPUT_MUST_BE_NEW");
const model = readFileSync(args["--model"]);
if (createHash("sha256").update(model).digest("hex") !== "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a") throw new Error("MODEL_DIGEST_MISMATCH");
const ort = resolve(args["--ort"]);
if (JSON.parse(readFileSync(join(ort, "package.json"))).version !== "1.29.0") throw new Error("ORT_VERSION_NOT_REVIEWED");
const app = join(out, "Digital Observer.app"), contents = join(app, "Contents"), resources = join(contents, "Resources");
for (const dir of ["MacOS", "Resources/bin", "Resources/lib", "Resources/models", "Resources/runtime/scripts", "Resources/runtime/services/video-gateway", "Resources/runtime/node_modules"]) mkdirSync(join(contents, dir), { recursive: true });
const run = (exe, argv) => execFileSync(exe, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
const sha = run("git", ["rev-parse", "HEAD"]).trim();
const scripts = ["connector-desktop-service.mjs", "run-software-connector.mjs", "run-persistent-home-gateway.mjs", "discover-software-connector-cameras.mjs"];
for (const name of scripts) copyFileSync(join("scripts", name), join(resources, "runtime/scripts", name));
for (const name of readdirSync("services/video-gateway").filter(name => name.endsWith(".mjs"))) copyFileSync(join("services/video-gateway", name), join(resources, "runtime/services/video-gateway", name));
writeFileSync(join(resources, "models/ssd_mobilenet_v1_10.onnx"), model);
copyFileSync("services/connector-desktop/THIRD_PARTY_NOTICES.txt", join(resources, "THIRD_PARTY_NOTICES.txt"));
for (const pkg of ["onnxruntime-node", "onnxruntime-common"]) {
  const source = join(dirname(ort), pkg), destination = join(resources, "runtime/node_modules", pkg);
  mkdirSync(destination);
  copyFileSync(join(source, "package.json"), join(destination, "package.json"));
  cpSync(join(source, "dist"), join(destination, "dist"), { recursive: true });
  if (pkg === "onnxruntime-node") cpSync(join(source, "bin/napi-v6/darwin", process.arch), join(destination, "bin/napi-v6/darwin", process.arch), { recursive: true, dereference: true });
}
// The Edge HTTP runtime imports the reviewed patched Undici package. Without
// bundling it, a clean Connector app can pass signing but fail to start.
cpSync("node_modules/undici", join(resources, "runtime/node_modules/undici"), { recursive: true });

// Relocate each non-system Mach-O dependency into the package; refuse unresolved
// paths instead of silently relying on a developer's Homebrew installation.
const copied = new Map();
const binaries = [];
function bundleBinary(source, destination) {
  const actual = realpathSync(source);
  if (copied.has(actual)) return copied.get(actual);
  copied.set(actual, destination); copyFileSync(actual, destination); binaries.push(destination);
  const deps = [...new Set(run("/usr/bin/otool", ["-L", actual]).split("\n").filter(line => line.includes(" (compatibility")).map(line => line.trim().split(" (compatibility")[0]))];
  for (const dep of deps) {
    if (dep.startsWith("/usr/lib/") || dep.startsWith("/System/Library/")) continue;
    let dependency = dep;
    if (dep.startsWith("@loader_path/")) dependency = join(dirname(actual), dep.slice(13));
    else if (dep.startsWith("@rpath/")) dependency = join(dirname(actual), dep.slice(7));
    if (!isAbsolute(dependency) || !existsSync(dependency)) throw new Error("UNRESOLVED_NATIVE_DEPENDENCY");
    if (realpathSync(dependency) === actual) continue;
    const uniqueName = `${createHash("sha256").update(realpathSync(dependency)).digest("hex").slice(0, 10)}-${basename(dependency)}`;
    const target = bundleBinary(dependency, join(resources, "lib", uniqueName));
    run("/usr/bin/install_name_tool", ["-change", dep, `@loader_path/${relative(dirname(destination), target)}`, destination]);
  }
  if (destination.endsWith(".dylib")) run("/usr/bin/install_name_tool", ["-id", `@loader_path/${basename(destination)}`, destination]);
  return destination;
}
for (const name of ["node", "ffmpeg", "ffprobe"]) bundleBinary(args[`--${name}`], join(resources, "bin", name));
run("/usr/bin/swiftc", ["-O", "-module-cache-path", join(out, "swift-cache"), "services/connector-desktop/macos/DesktopHost.swift", "-o", join(contents, "MacOS/DigitalObserver")]);
const plist = { CFBundleIdentifier: "com.digitalobserver.connector", CFBundleName: "Digital Observer", CFBundleExecutable: "DigitalObserver", CFBundlePackageType: "APPL", CFBundleShortVersionString: version, CFBundleVersion: buildNumber, ObserverBuildSHA: sha,
  NSLocalNetworkUsageDescription: "Digital Observer finds cameras on your network after you authorize setup.",
  CFBundleDocumentTypes: [{ CFBundleTypeName: "Digital Observer installation request", CFBundleTypeRole: "Viewer", CFBundleTypeExtensions: ["observer-connect"] }] };
writeFileSync(join(contents, "Info.plist"), JSON.stringify(plist));
writeFileSync(join(resources, "runtime/edge-release-metadata.json"), JSON.stringify({ version, build_sha: sha, health_contract: "observer-edge-health-v1", profile: "SOFTWARE_CONNECTOR" }));
run("/usr/bin/plutil", ["-convert", "xml1", join(contents, "Info.plist")]);
// install_name_tool mutates Mach-O binaries and invalidates their prior code
// signatures. Re-sign nested binaries before trying to execute them on arm64.
for (const binary of binaries.reverse()) run("/usr/bin/codesign", ["--force", "--sign", signingIdentity, binary]);
run(join(resources, "bin/node"), ["--version"]);
run(join(resources, "bin/ffmpeg"), ["-version"]);
run(join(resources, "bin/ffprobe"), ["-version"]);
execFileSync(join(resources, "bin/node"), ["--input-type=module", "-e", "import * as ort from 'onnxruntime-node'; await ort.InferenceSession.create(process.argv[1]);" , join(resources, "models/ssd_mobilenet_v1_10.onnx")], { cwd: join(resources, "runtime"), stdio: "pipe", timeout: 60000 });
execFileSync(join(resources, "bin/node"), ["--input-type=module", "-e", "await import('./services/video-gateway/http-runtime.mjs');"],
  { cwd: join(resources, "runtime"), stdio: "pipe", timeout: 15000 });
// ONNX Runtime may emit an optimized-session cache named ':memory:.ses'. It is
// a build-time derivative, not a runtime dependency and must not invalidate the
// sealed application after signing.
rmSync(join(resources, "runtime/:memory:.ses"), { force: true });
run("/usr/bin/codesign", ["--force", "--sign", signingIdentity, app]);
// Signing must be the final mutation of sealed bundle content. A successful
// codesign invocation alone does not prove the package still verifies.
run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
const staging = mkdtempSync(join(tmpdir(), "digital-observer-connector-dmg-"));
const dmg = join(out, "Digital Observer Connector.dmg");
try {
  cpSync(app, join(staging, "Digital Observer.app"), { recursive: true, dereference: true });
  run("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(staging, "Digital Observer.app")]);
  symlinkSync("/Applications", join(staging, "Applications"));
  run("/usr/bin/hdiutil", ["create", "-quiet", "-fs", "HFS+", "-volname", "Digital Observer Connector", "-srcfolder", staging, dmg]);
} finally { rmSync(staging, { recursive: true, force: true }); }
const dmgSha256 = createHash("sha256").update(readFileSync(dmg)).digest("hex");
writeFileSync(join(out, "package-status.json"), JSON.stringify({ status: "LOCAL_PACKAGE_QA_ONLY", platform: `macos-${process.arch}`, build: sha,
  version, buildNumber,
  dirtySnapshot: run("git", ["status", "--porcelain"]).trim().length > 0, nativeLibraries: copied.size,
  signing: signingIdentity === "-" ? "AD_HOC_QA_VERIFIED_NOT_NOTARIZED" : "IDENTITY_SIGNED_VERIFIED_NOT_NOTARIZED",
  releaseClass, signatureVerified: true, notarization: "NOT_VERIFIED", publicDownloadAllowed: false, redistributionNoticesBundled: true,
  ota: { contract: "observer-edge-update-v1", agentBundled: true, signedManifestRequired: true, atomicSlots: true, automaticRollback: true },
  dmg: { filename: basename(dmg), sha256: dmgSha256 }, serviceInstallTest: "NOT_RUN", enrollmentE2E: "NOT_RUN" }, null, 2));
console.log(JSON.stringify({ status: "LOCAL_PACKAGE_QA_ONLY", output: out, dmg, dmgSha256, nativeLibraries: copied.size, publicDownloadAllowed: false }));

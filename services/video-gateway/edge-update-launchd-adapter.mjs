// Isolated launchd adapter. Never use the QA label/path contract for a live device.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";

function fail(code) { throw Object.assign(new Error(code), { code }); }
function xml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { stdio: ["ignore", "pipe", "pipe"], timeout: 20_000, ...options });

export function createQaLaunchdEdgeAdapter({ root, label, profile, port, persistentRoot, installedRoot, installationId }) {
  if (process.platform !== "darwin" || !/^com\.digitalobserver\.qa\.push38g\.[a-z0-9.-]+$/.test(label)) fail("EDGE_QA_LAUNCHD_SCOPE_INVALID");
  if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(profile) || !Number.isInteger(port) || port < 20000 || port > 65000) fail("EDGE_QA_PROFILE_OR_PORT_INVALID");
  const qaRoot = resolve(root), stateRoot = resolve(persistentRoot), originalRoot = resolve(installedRoot);
  if (!stateRoot.startsWith(`${qaRoot}/`)) fail("EDGE_QA_STATE_SCOPE_INVALID");
  const plistPath = join(qaRoot, `${label}.plist`), domain = `gui/${process.getuid()}`;
  const member = profile === "PHYSICAL_GATEWAY" ? "services/video-gateway/server.mjs"
    : "Digital Observer.app/Contents/Resources/runtime/services/video-gateway/server.mjs";
  let active = false;
  function unpack({ artifactPath, staging, manifest }) {
    const runtime = join(staging, "runtime"); mkdirSync(runtime, { recursive: true, mode: 0o700 });
    run("tar", ["-xzf", artifactPath, "-C", runtime], { timeout: 120_000 });
    if (!existsSync(join(runtime, member))) fail("EDGE_QA_PACKAGE_ENTRY_MISSING");
    if (profile === "SOFTWARE_CONNECTOR") run("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(runtime, "Digital Observer.app")]);
    const metadataPath = profile === "PHYSICAL_GATEWAY" ? join(runtime, "edge-release-metadata.json")
      : join(runtime, "Digital Observer.app/Contents/Resources/runtime/edge-release-metadata.json");
    if (existsSync(metadataPath)) { const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
      if (metadata.profile !== profile || metadata.health_contract !== "observer-edge-health-v1" ||
        metadata.version !== manifest.version || metadata.build_sha !== manifest.build_sha) fail("EDGE_QA_PACKAGE_METADATA_INVALID"); }
    else if (!manifest.version.includes("legacy")) fail("EDGE_QA_PACKAGE_METADATA_MISSING");
  }
  function stop() { if (!active) return;
    try { run("/bin/launchctl", ["bootout", domain, plistPath]); } catch {}
    active = false;
  }
  function status() { try { const output = run("/bin/launchctl", ["print", `${domain}/${label}`], { encoding: "utf8" });
    return { registered: true, running: /state = running/.test(output), label }; }
    catch { return { registered: false, running: false, label }; } }
  async function restart({ slot, manifest, rollback = false }) {
    const runtime = join(slot, "runtime"), entry = join(runtime, member);
    if (!existsSync(entry)) fail("EDGE_QA_RUNTIME_ENTRY_MISSING");
    if (profile === "SOFTWARE_CONNECTOR") run("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(runtime, "Digital Observer.app")]);
    const release = manifest || JSON.parse(readFileSync(join(slot, "release.json")));
    const node = profile === "SOFTWARE_CONNECTOR" ? join(runtime, "Digital Observer.app/Contents/Resources/bin/node") : process.execPath;
    const workdir = profile === "SOFTWARE_CONNECTOR" ? join(runtime, "Digital Observer.app/Contents/Resources/runtime") : runtime;
    const env = { HOST: "127.0.0.1", PORT: String(port), OBSERVER_EDGE_DEVICE_TYPE: profile,
      OBSERVER_EDGE_VERSION: release.version, OBSERVER_EDGE_BUILD_SHA: release.build_sha,
      OBSERVER_EDGE_INSTALLATION_ID: installationId, OBSERVER_EDGE_DATA_DIR: join(stateRoot, "data"),
      GAN_BATUACH_GATEWAY_SECRET_DIR: join(stateRoot, "secrets") };
    mkdirSync(join(stateRoot, "data"), { recursive: true, mode: 0o700 });
    mkdirSync(join(stateRoot, "secrets"), { recursive: true, mode: 0o700 });
    const environment = Object.entries(env).map(([key, value]) => `<key>${key}</key><string>${xml(value)}</string>`).join("");
    const plist = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${xml(label)}</string><key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(entry)}</string></array><key>WorkingDirectory</key><string>${xml(workdir)}</string><key>EnvironmentVariables</key><dict>${environment}</dict><key>RunAtLoad</key><true/><key>KeepAlive</key><false/><key>StandardOutPath</key><string>${xml(join(qaRoot, "service.out.log"))}</string><key>StandardErrorPath</key><string>${xml(join(qaRoot, "service.err.log"))}</string></dict></plist>`;
    stop(); writeFileSync(plistPath, plist, { mode: 0o600 });
    run("/bin/launchctl", ["bootstrap", domain, plistPath]); active = true;
    return { rollback, service: status(), profile, port };
  }
  return { async verifyInstalled({ artifactPath }) {
      const extracted = mkdtempSync(join(tmpdir(), "observer-p38g-installed-compare-"));
      try { run("tar", ["-xzf", artifactPath, "-C", extracted], { timeout: 120_000 });
        const visit = directory => { for (const name of readdirSync(directory)) { const source = join(directory, name);
          if (statSync(source).isDirectory()) { if (!visit(source)) return false; }
          else { const counterpart = join(originalRoot, relative(extracted, source));
            if (!existsSync(counterpart) || createHash("sha256").update(readFileSync(source)).digest("hex") !==
              createHash("sha256").update(readFileSync(counterpart)).digest("hex")) return false; }
        } return true; };
        return visit(extracted);
      } finally { rmSync(extracted, { recursive: true, force: true }); }
    }, async stageBaseline(input) { unpack(input); }, async install(input) { unpack(input); },
    restart, stop, status,
    async health({ timeoutMs = 15_000 }) { const until = Date.now() + timeoutMs;
      while (Date.now() < until) { try { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) return { ok: true, body: await response.json(), service: status() }; } catch {}
        await new Promise(resolve => setTimeout(resolve, 250)); }
      return { ok: false, service: status() }; }
  };
}

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const label = "com.ganbatuach.video-gateway";
const projectRoot = process.cwd();
const runtimeRoot = join(homedir(), ".local", "share", "gan-batuach", "video-gateway");
const launchAgentPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
const logRoot = join(homedir(), "Library", "Logs");

const requiredFiles = [
  join(projectRoot, "scripts", "run-persistent-home-gateway.mjs"),
  join(projectRoot, "services", "video-gateway", "server.mjs"),
  join(projectRoot, "services", "video-gateway", "activity-insights.mjs")
];
for (const path of requiredFiles) {
  if (!existsSync(path)) throw new Error(`Gateway runtime file is missing: ${path}`);
}

mkdirSync(join(runtimeRoot, "scripts"), { recursive: true, mode: 0o700 });
mkdirSync(join(runtimeRoot, "services", "video-gateway"), { recursive: true, mode: 0o700 });
mkdirSync(join(runtimeRoot, "node_modules"), { recursive: true, mode: 0o700 });
mkdirSync(dirname(launchAgentPath), { recursive: true });
mkdirSync(logRoot, { recursive: true });

copyFileSync(requiredFiles[0], join(runtimeRoot, "scripts", "run-persistent-home-gateway.mjs"));
cpSync(join(projectRoot, "services", "video-gateway"), join(runtimeRoot, "services", "video-gateway"), {
  recursive: true,
  force: true
});
for (const packageName of ["onnxruntime-node", "onnxruntime-common"]) {
  const packagePath = join(projectRoot, "node_modules", packageName);
  if (!existsSync(packagePath)) throw new Error(`Gateway Edge runtime package is missing: ${packageName}`);
  cpSync(packagePath, join(runtimeRoot, "node_modules", packageName), { recursive: true, force: true });
}

const escaped = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const nodePath = process.execPath;
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${escaped(nodePath)}</string>
    <string>${escaped(join(runtimeRoot, "scripts", "run-persistent-home-gateway.mjs"))}</string>
  </array>
  <key>WorkingDirectory</key><string>${escaped(runtimeRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string><key>GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE</key><string>com.ganbatuach.video-gateway.runtime</string><key>GAN_BATUACH_GATEWAY_DISCOVERY</key><string>1</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${escaped(join(logRoot, `${label}.out.log`))}</string>
  <key>StandardErrorPath</key><string>${escaped(join(logRoot, `${label}.err.log`))}</string>
</dict>
</plist>
`;
writeFileSync(launchAgentPath, plist, { mode: 0o600 });
chmodSync(launchAgentPath, 0o600);

const domain = `gui/${process.getuid()}`;
try {
  execFileSync("/bin/launchctl", ["bootout", domain, launchAgentPath], { stdio: "ignore" });
} catch {}
execFileSync("/bin/launchctl", ["bootstrap", domain, launchAgentPath], { stdio: "ignore" });
execFileSync("/bin/launchctl", ["kickstart", "-k", `${domain}/${label}`], { stdio: "ignore" });

console.log("Persistent home video gateway installed and started");

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const source = join(process.cwd(), "services", "video-gateway", "vision-edge-worker.swift");
const output = process.env.VIDEO_GATEWAY_VISION_WORKER_PATH || join(homedir(), ".local", "share", "gan-batuach", "video-gateway", "vision-edge-worker");

if (!existsSync(source)) throw new Error("Vision worker source is missing.");
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
try {
  execFileSync("/usr/bin/xcrun", ["swiftc", "-O", source, "-o", output], { stdio: "inherit", timeout: 30_000 });
} catch (error) {
  if (error?.code === "ETIMEDOUT" || error?.signal === "SIGTERM") {
    throw new Error("Apple Vision worker build timed out. Keep Edge AI disabled and repair the local Apple toolchain before retrying.");
  }
  throw error;
}
chmodSync(output, 0o700);
execFileSync(output, ["--self-test"], { stdio: "inherit", timeout: 10_000 });
console.log("Apple Vision edge worker built and self-tested locally.");

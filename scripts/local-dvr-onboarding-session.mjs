import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const gatewayPort = Number(process.env.LOCAL_DVR_GATEWAY_PORT || 18080);
const appPort = Number(process.env.LOCAL_DVR_APP_PORT || 3100);
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const appUrl = `http://127.0.0.1:${appPort}`;

const gatewaySecret = crypto.randomBytes(48).toString("base64url");
const onboardingToken = crypto.randomBytes(48).toString("base64url");

const children = [];
const localEnv = loadLocalEnv();

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function loadLocalEnv() {
  const candidates = [
    ".env.local",
    ".env",
    "/Users/danielderi/Desktop/text-web-ai-1-rtl-2/.env.local",
    "/Users/danielderi/Desktop/text-web-ai-1-rtl-2/.env"
  ];
  return candidates.reduce((env, filePath) => ({ ...env, ...parseEnvFile(filePath) }), {});
}

function spawnChild(label, command, args, env) {
  const child = spawn(command, args, {
    env: { ...localEnv, ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  children.push(child);
  child.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    if (/ready|started|listening|local/i.test(text)) process.stdout.write(`[${label}] ${text}`);
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    if (!/secret|password|credential|rtsp/i.test(text)) process.stderr.write(`[${label}] ${text}`);
  });
  child.on("exit", (code) => {
    if (code && code !== 130) console.error(`[${label}] exited with code ${code}`);
  });
  return child;
}

async function waitFor(url, label, timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not become ready`);
}

function questioner() {
  return readline.createInterface({ input, output });
}

async function ask(prompt, defaultValue = "") {
  const rl = questioner();
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = await rl.question(`${prompt}${suffix}: `);
  rl.close();
  return answer.trim() || defaultValue;
}

async function askHidden(prompt) {
  if (!input.isTTY) return ask(prompt);
  output.write(`${prompt}: `);
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");
  let value = "";
  return new Promise((resolve) => {
    const onData = (char) => {
      if (char === "\r" || char === "\n") {
        input.setRawMode(false);
        input.off("data", onData);
        output.write("\n");
        resolve(value);
        return;
      }
      if (char === "\u0003") {
        input.setRawMode(false);
        input.off("data", onData);
        cleanup(130);
      }
      if (char === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += char;
    };
    input.on("data", onData);
  });
}

function cleanup(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => cleanup(130));
process.on("SIGTERM", () => cleanup(143));

async function main() {
  console.log("Starting local read-only DVR onboarding. Gateway secrets are generated in memory and are not printed or written to disk.");

  spawnChild("gateway", "node", ["services/video-gateway/server.mjs"], {
    HOST: "127.0.0.1",
    PORT: String(gatewayPort),
    VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret,
    DVR_EXPECTED_CHANNEL_COUNT: "16"
  });
  await waitFor(`${gatewayUrl}/health`, "Gateway");

  spawnChild("app", "npm", ["run", "dev"], {
    PORT: String(appPort),
    LOCAL_DVR_ONBOARDING_ENABLED: "true",
    LOCAL_DVR_ONBOARDING_TOKEN: onboardingToken,
    VIDEO_GATEWAY_PROVIDER: "custom"
  });
  await waitFor(`${appUrl}/api/health`, "Local app", 90000);

  console.log("Local Gateway and app are ready. Enter DVR details locally; hidden fields will not be echoed.");
  const gardenId = await ask("Garden/site UUID");
  const endpoint = await askHidden("DVR endpoint or host");
  const portRaw = await ask("DVR RTSP port", "554");
  const vendor = await ask("Vendor template (hikvision/dahua/uniview/generic)", "generic");
  const username = await askHidden("DVR username");
  const password = await askHidden("DVR password");
  const channelCountRaw = await ask("Expected channel count", "16");
  const confirmation = await ask("Type CONNECT to run live read-only channel discovery now");
  if (confirmation !== "CONNECT") {
    console.log("Cancelled before any DVR connection attempt.");
    cleanup(0);
    return;
  }

  const response = await fetch(`${appUrl}/api/video-gateway/local-dvr-onboarding`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-local-dvr-onboarding-token": onboardingToken
    },
    body: JSON.stringify({
      garden_id: gardenId,
      connection_type: "dvr",
      endpoint,
      port: Number(portRaw),
      username,
      password,
      gateway_url: gatewayUrl,
      gateway_secret: gatewaySecret,
      metadata: {
        vendor,
        expected_channel_count: Number(channelCountRaw),
        source: "local_dvr_onboarding_session",
        read_only_requested: true,
        ai_shadow_only: true
      }
    })
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error(`Connection failed with HTTP ${response.status}.`);
    console.error(body.error || "No error details returned.");
    cleanup(1);
    return;
  }

  const data = body.data ?? {};
  const channels = Array.isArray(data.channels) ? data.channels : [];
  const connected = channels.filter((item) => item?.camera?.status === "connected").length;
  console.log("DVR onboarding completed.");
  console.log(`Connection status: ${data.connection?.status ?? "unknown"}`);
  console.log(`Channels materialized: ${channels.length}`);
  console.log(`Connected channels: ${connected}`);
  console.log("No DVR credentials, Gateway secrets or RTSP URLs were printed.");
  cleanup(0);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local onboarding failed.");
  cleanup(1);
});

import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const gatewayPort = Number(process.env.LOCAL_DVR_GATEWAY_PORT || 18080);
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const gatewaySecret = crypto.randomBytes(48).toString("base64url");
const localCloudConfigPath = ".env.video-gateway.local";

function loadLocalCloudConfig() {
  if (!existsSync(localCloudConfigPath)) return {};
  const config = {};
  const content = readFileSync(localCloudConfigPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    config[key] = raw.replace(/^["']|["']$/g, "");
  }
  return config;
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
        output.write("\n");
        process.exit(130);
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

function startGateway() {
  return spawn("node", ["services/video-gateway/server.mjs"], {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(gatewayPort),
      VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret,
      DVR_EXPECTED_CHANNEL_COUNT: "16"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForGateway(timeoutMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${gatewayUrl}/health`);
      if (response.ok) return;
    } catch {
      // Continue polling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local Gateway did not become ready.");
}

function sanitizeDiscovery(discovery, inputData) {
  const channels = Array.isArray(discovery.channels) ? discovery.channels : [];
  return {
    gateway_id: inputData.gatewayId,
    observer_site_id: inputData.observerSiteId || undefined,
    garden_id: inputData.gardenId || undefined,
    connection_type: "dvr",
    vendor: inputData.vendor,
    discovery_id: crypto.randomUUID(),
    discovered_at: new Date().toISOString(),
    channel_count: Number(discovery.channel_count || channels.length || inputData.channelCount),
    connected_channel_count: Number(discovery.connected_channel_count || channels.filter((channel) => channel.status === "connected").length),
    failed_channel_count: Number(discovery.failed_channel_count || channels.filter((channel) => channel.status !== "connected").length),
    latency_ms: Number(discovery.latency_ms || 0),
    read_only: true,
    controls_supported: false,
    no_secrets_returned: true,
    channels: channels.map((channel, index) => ({
      channel: Number(channel.channel || index + 1),
      name: channel.name,
      area: channel.area,
      stream_id: channel.stream_id,
      gateway_stream_id: channel.gateway_stream_id,
      status: channel.status,
      health_status: channel.health_status,
      width: channel.width ?? null,
      height: channel.height ?? null,
      candidates_tried: channel.candidates_tried,
      template: channel.template,
      reason: channel.reason
    })),
    metadata: {
      source: "local_gateway_cloud_discovery",
      ai_shadow_only: true,
      read_only: true
    }
  };
}

function signBody(timestamp, nonce, body, secret) {
  return `sha256=${crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex")}`;
}

async function main() {
  console.log("Cloud DVR discovery session. DVR credentials stay local; only sanitized channel status is sent to the cloud endpoint.");
  const cloudConfig = loadLocalCloudConfig();
  const productionBaseUrl = process.env.VIDEO_GATEWAY_CLOUD_BASE_URL || cloudConfig.VIDEO_GATEWAY_CLOUD_BASE_URL || "https://gan-batuach.vercel.app";
  const gatewayId = process.env.VIDEO_GATEWAY_CLOUD_GATEWAY_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_GATEWAY_ID;
  const cloudSecret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || cloudConfig.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  const gardenId = process.env.VIDEO_GATEWAY_CLOUD_GARDEN_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_GARDEN_ID || "";
  const observerSiteId = process.env.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID || cloudConfig.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID || "";
  if (!gatewayId || !cloudSecret || (!gardenId && !observerSiteId)) {
    throw new Error("Local cloud gateway config is missing. Prepare .env.video-gateway.local before starting DVR discovery.");
  }
  const endpoint = await askHidden("DVR endpoint or host");
  const port = await ask("DVR RTSP port", "554");
  const vendor = await ask("Vendor template (hikvision/dahua/uniview/generic)", "generic");
  const username = await askHidden("DVR username");
  const password = await askHidden("DVR password");
  const channelCount = await ask("Expected channel count", "16");

  const confirmation = await ask("Type CONNECT to run live read-only discovery and send sanitized mapping to cloud");
  if (confirmation !== "CONNECT") {
    console.log("Cancelled before any DVR connection attempt.");
    return;
  }

  const gateway = startGateway();
  try {
    await waitForGateway();
    const discoveryResponse = await fetch(`${gatewayUrl}/dvr/connect`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-video-gateway-secret": gatewaySecret
      },
      body: JSON.stringify({
        connection_type: "dvr",
        endpoint,
        port: Number(port),
        username,
        password,
        metadata: { vendor, expected_channel_count: Number(channelCount), read_only_requested: true }
      })
    });
    const discovery = await discoveryResponse.json();
    if (!discoveryResponse.ok) throw new Error("Local discovery failed.");

    const payload = sanitizeDiscovery(discovery, { gatewayId, gardenId, observerSiteId, vendor, channelCount: Number(channelCount) });
    const body = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    const nonce = crypto.randomUUID();
    const cloudResponse = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/video-gateway/cloud-discovery`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-video-gateway-id": gatewayId,
        "x-video-gateway-timestamp": timestamp,
        "x-video-gateway-nonce": nonce,
        "x-video-gateway-signature": signBody(timestamp, nonce, body, cloudSecret)
      },
      body
    });
    const cloudResult = await cloudResponse.json().catch(() => ({}));
    if (!cloudResponse.ok) {
      console.error(`Cloud mapping failed with HTTP ${cloudResponse.status}.`);
      console.error(cloudResult.error || "No error details returned.");
      process.exitCode = 1;
      return;
    }
    console.log("Cloud mapping completed.");
    console.log(`Channels mapped: ${cloudResult.data?.channel_count ?? payload.channels.length}`);
    console.log(`Connected channels: ${cloudResult.data?.connected_channel_count ?? payload.connected_channel_count}`);
    console.log("No DVR credentials, RTSP URLs or private endpoints were sent to the cloud endpoint.");
  } finally {
    gateway.kill("SIGTERM");
  }
}

await main();
